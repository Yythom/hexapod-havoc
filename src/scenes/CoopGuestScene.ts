import Phaser from 'phaser';
import { ensureBiomeGround } from '../art/biomeGrounds';
import { SPRITE_RES } from '../art/draw';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
type SoundName = Parameters<typeof sfx.play>[0];
import { CAMERA_ZOOM, DEPTH, FONT_FAMILY, RENDER_SCALE, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { bus, EVT, listen } from '../core/bus';
import { touchMove } from '../core/input';
import { RunState } from '../core/RunState';
import { getSettings, useSettingsStore } from '../core/settings';
import { moveSpeed } from '../core/stats';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { coop } from '../net/coop';
import { REVIVE_RADIUS } from '../net/coopHost';
import {
  applyEnterIntermission,
  type CombatSnapshotPayload,
  type CoopMessage,
  type MatchResultPayload,
  type MatchStartPayload,
  type SnapPlayer,
} from '../net/protocol';
import { Effects } from '../systems/Effects';
import { shake } from '../ui/camera';
import type { ResultData } from './GameScene';

type MoveKeys = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

const GROUND_WEATHER_TINT = [0xffffff, 0xe8eff5, 0xd8e5ec, 0xbfcbd8, 0xa8b4cc];
const INPUT_INTERVAL_ACTIVE = 1 / 60;
const INPUT_INTERVAL_IDLE = 1 / 30;

interface GhostEnemy {
  sprite: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  trot: number;
  rot: number;
  snapAge: number;
  hp: number;
  maxHp: number;
  flags: number;
  status: number;
  radius: number;
}

interface GhostProj {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
}

interface GhostShot {
  sprite: Phaser.GameObjects.Image;
  kind: number;
  vx: number;
  vy: number;
}

interface GhostPickup {
  sprite: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  x: number;
  y: number;
  kind: number;
  val: number;
}

interface GhostSummon {
  sprite: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  x: number;
  y: number;
  trot: number;
  rot: number;
}

/**
 * 双人联机客机战斗场景（P2）：
 * 接收房主 30Hz（同机 60Hz）状态快照，以屏幕原生高刷（60/120/144Hz）执行：
 * - P2 本地移动预测 + 权威平滑纠偏 + 与帧率无关的顺滑镜头
 * - 怪物/掉落物/召唤物逐帧平滑插值
 * - 子弹与敌弹逐帧速度外推与危险光环渲染
 * 同时以 60Hz / 变化即发回传本地输入，手感与 1P 保持一致。
 */
export class CoopGuestScene extends Phaser.Scene {
  private match!: MatchStartPayload;
  private run!: RunState;
  private groundImg!: Phaser.GameObjects.Image;
  private view1!: BeetleView;
  private view2!: BeetleView;
  private p1Tag!: Phaser.GameObjects.Text;
  private p2Tag!: Phaser.GameObjects.Text;
  private arenaG!: Phaser.GameObjects.Graphics;
  private shotAuraG!: Phaser.GameObjects.Graphics;
  private overlayG!: Phaser.GameObjects.Graphics;
  private enemyBarG!: Phaser.GameObjects.Graphics;
  private fx!: Effects;
  private keys!: MoveKeys;

  private p1Target = { x: WORLD_WIDTH / 2 - 48, y: WORLD_HEIGHT / 2, vx: 0, vy: 0, rot: 0, moving: false, downed: false, revivePct: 0, snapAge: 0 };
  private p2Target = { x: WORLD_WIDTH / 2 + 48, y: WORLD_HEIGHT / 2, rot: 0, speed: 0, dashTime: 0, moving: false, downed: false, revivePct: 0 };
  private p1Init = false;
  private p2Init = false;
  private camX = WORLD_WIDTH / 2 + 48;
  private camY = WORLD_HEIGHT / 2;
  private p1Sig = '';
  private p2Sig = '';

  private enemies = new Map<number, GhostEnemy>();
  private pickups = new Map<number, GhostPickup>();
  private summons = new Map<number, GhostSummon>();
  private projPool: Phaser.GameObjects.Image[] = [];
  private projActive: GhostProj[] = [];
  private shotPool: Phaser.GameObjects.Image[] = [];
  private shotActive: GhostShot[] = [];
  private extraPool: Phaser.GameObjects.Image[] = [];
  private extraActive: Phaser.GameObjects.Image[] = [];

  private inputAcc = 0;
  private inputSeq = 0;
  private lastSentIx = 0;
  private lastSentIy = 0;
  private dashQueued = false;
  private padDashDown = false;
  private padPauseDown = false;
  private lastWave = 0;
  private lastSnapMs = 0;
  private pulse = 0;
  private deadNotified = false;
  private unsubMsg: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;

  constructor() {
    super('CoopGuest');
  }

  create(data?: MatchStartPayload): void {
    const match = data ?? coop.match;
    if (!match) {
      this.scene.start('Menu');
      return;
    }
    this.match = match;
    this.enemies.clear();
    this.pickups.clear();
    this.summons.clear();
    this.projPool = [];
    this.projActive = [];
    this.shotPool = [];
    this.shotActive = [];
    this.extraPool = [];
    this.extraActive = [];
    this.p1Init = false;
    this.p2Init = false;
    this.camX = WORLD_WIDTH / 2 + 48;
    this.camY = WORLD_HEIGHT / 2;
    this.p1Sig = '';
    this.p2Sig = '';
    this.inputAcc = 0;
    this.inputSeq = 0;
    this.lastSentIx = 0;
    this.lastSentIy = 0;
    this.dashQueued = false;
    this.padDashDown = false;
    this.padPauseDown = false;
    this.lastWave = 1;
    this.lastSnapMs = 0;
    this.pulse = 0;
    this.deadNotified = false;
    touchMove.x = touchMove.y = 0;
    touchMove.active = false;
    touchMove.keyboardActive = false;

    this.run = new RunState({
      character: match.guest.character,
      difficulty: match.difficulty,
      weapon: match.guest.weapon,
      biome: match.biome,
      seed: `${match.seed}-P2`,
      shellSkin: match.guest.shellSkin,
    });
    this.run.phase = 'combat';
    this.registry.set('run', this.run);

    const groundKey = ensureBiomeGround(this, this.run.biome.id);
    this.groundImg = this.add.image(0, 0, groundKey).setOrigin(0).setDepth(DEPTH.ground).setTint(GROUND_WEATHER_TINT[match.difficulty] ?? 0xffffff);
    this.arenaG = this.add.graphics().setDepth(DEPTH.ground + 3);
    this.shotAuraG = this.add.graphics().setDepth(DEPTH.projectile - 0.5);
    this.overlayG = this.add.graphics().setDepth(DEPTH.player - 1);
    this.enemyBarG = this.add.graphics().setDepth(DEPTH.enemy + 4);
    this.fx = new Effects(this);

    const hostChar = CHARACTERS[match.host.character];
    const guestChar = CHARACTERS[match.guest.character];
    this.view1 = new BeetleView(this, WORLD_WIDTH / 2 - 48, WORLD_HEIGHT / 2, hostChar.shell).setScale(0.78).setDepth(DEPTH.player);
    this.view1.setShellSkin(match.host.shellSkin);
    this.view2 = new BeetleView(this, WORLD_WIDTH / 2 + 48, WORLD_HEIGHT / 2, guestChar.shell).setScale(0.78).setDepth(DEPTH.player + 1);
    this.view2.setShellSkin(match.guest.shellSkin);

    const tagStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      fontStyle: 'bold',
      stroke: '#050507',
      strokeThickness: 3,
    };
    this.p1Tag = this.add.text(0, 0, 'P1', { ...tagStyle, color: '#ffd44c' }).setOrigin(0.5).setDepth(DEPTH.player + 4);
    this.p2Tag = this.add.text(0, 0, 'P2', { ...tagStyle, color: '#7ceeff' }).setOrigin(0.5).setDepth(DEPTH.player + 4);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const applyZoom = (z: number) => cam.setZoom(CAMERA_ZOOM * z * RENDER_SCALE);
    applyZoom(getSettings().cameraZoom);
    this.unsubSettings = useSettingsStore.subscribe((n, p) => {
      if (n.cameraZoom !== p.cameraZoom) applyZoom(n.cameraZoom);
    });
    cam.centerOn(this.camX, this.camY);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as MoveKeys;
    const triggerDash = () => {
      if (this.run.phase === 'combat' && !this.run.coopDowned && !this.isUiPaused()) {
        this.dashQueued = true;
        this.sendInputNow();
      }
    };
    this.input.keyboard!.on('keydown-SPACE', triggerDash);
    this.input.keyboard!.on('keydown-SHIFT', triggerDash);
    listen(this, EVT.DASH_TRIGGER, triggerDash);
    listen(this, EVT.CONTINUE_ENDLESS, () => coop.send({ type: 'continue_endless' }));
    listen(this, EVT.FINISH_RUN, () => coop.send({ type: 'finish_run' }));

    this.unsubMsg = coop.onMessage((msg) => this.handleMessage(msg));
    this.unsubState = coop.onState((st, detail) => {
      if (st === 'disconnected') {
        bus.emit(EVT.WAVE_EVENT, '⚠ 与房主断开连接', '#ff6a5e');
        if (!this.scene.isActive('Intermission')) {
          const ui = this.scene.get('UI') as unknown as { showCoopDisconnected?: (reason?: string) => void };
          ui?.showCoopDisconnected?.(detail || '与房主的联机已断开');
        }
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubMsg?.();
      this.unsubState?.();
      this.unsubSettings?.();
    });

    bgm.setMode('combat');
    this.scene.launch('UI');
    bus.emit(EVT.WAVE_START, 1);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.pulse += dt;
    this.fx.update(dt);
    this.pollGamepadActions();

    const paused = this.isUiPaused();
    const inCombat = this.run.phase === 'combat' || this.run.phase === 'cleanup';
    const [ix, iy] = inCombat && !paused ? this.readInput() : [0, 0];
    const inputLen = Math.hypot(ix, iy);

    if (inCombat && !paused) {
      const qx = Math.round(ix * 100) / 100;
      const qy = Math.round(iy * 100) / 100;
      const changed = qx !== this.lastSentIx || qy !== this.lastSentIy;
      const interval = inputLen > 0.01 ? INPUT_INTERVAL_ACTIVE : INPUT_INTERVAL_IDLE;
      this.inputAcc += dt;
      if (changed || this.inputAcc >= interval) {
        this.inputAcc = 0;
        this.sendInputNow(ix, iy);
      }
    }

    // 1. P1 队友速度外推 + 顺滑插值（满刷 60/120/144Hz）
    this.p1Target.snapAge += dt;
    const p1Lead = Math.min(this.p1Target.snapAge, 0.05);
    const p1GoalX = Phaser.Math.Clamp(this.p1Target.x + this.p1Target.vx * p1Lead, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
    const p1GoalY = Phaser.Math.Clamp(this.p1Target.y + this.p1Target.vy * p1Lead, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
    const k1 = 1 - Math.exp(-dt * 24);
    this.view1.x += (p1GoalX - this.view1.x) * k1;
    this.view1.y += (p1GoalY - this.view1.y) * k1;
    this.view1.rotation = Phaser.Math.Angle.RotateTo(this.view1.rotation, this.p1Target.rot, dt * 18);
    this.view1.animate(dt, this.p1Target.moving ? 1 : 0);
    this.view1.setAlpha(this.p1Target.downed ? 0.48 : 1);

    // 2. P2 自身本地移动预测 + 房主权威平滑纠偏
    if (inCombat && !paused && !this.p2Target.downed) {
      if (this.p2Target.dashTime > 0) {
        const dk = 1 - Math.exp(-dt * 34);
        this.view2.x += (this.p2Target.x - this.view2.x) * dk;
        this.view2.y += (this.p2Target.y - this.view2.y) * dk;
        this.view2.rotation = Phaser.Math.Angle.RotateTo(this.view2.rotation, this.p2Target.rot, dt * 26);
      } else {
        const predSpeed = this.p2Target.speed > 0 ? this.p2Target.speed : moveSpeed(this.run.stats);
        if (inputLen > 0.01) {
          const nx = inputLen > 1 ? ix / inputLen : ix;
          const ny = inputLen > 1 ? iy / inputLen : iy;
          this.view2.x = Phaser.Math.Clamp(this.view2.x + nx * predSpeed * dt, WORLD_MARGIN, WORLD_WIDTH - WORLD_MARGIN);
          this.view2.y = Phaser.Math.Clamp(this.view2.y + ny * predSpeed * dt, WORLD_MARGIN, WORLD_HEIGHT - WORLD_MARGIN);
          this.view2.rotation = Phaser.Math.Angle.RotateTo(this.view2.rotation, Math.atan2(ny, nx), dt * 18);
        } else {
          this.view2.rotation = Phaser.Math.Angle.RotateTo(this.view2.rotation, this.p2Target.rot, dt * 16);
        }
        const halfRtt = coop.rttMs > 0 ? Math.min(0.06, coop.rttMs * 0.0005) : 0.012;
        const authX = Phaser.Math.Clamp(
          this.p2Target.x + (inputLen > 0.01 ? ix * predSpeed * halfRtt : 0),
          WORLD_MARGIN,
          WORLD_WIDTH - WORLD_MARGIN,
        );
        const authY = Phaser.Math.Clamp(
          this.p2Target.y + (inputLen > 0.01 ? iy * predSpeed * halfRtt : 0),
          WORLD_MARGIN,
          WORLD_HEIGHT - WORLD_MARGIN,
        );
        const err = Math.hypot(authX - this.view2.x, authY - this.view2.y);
        if (err > 150) {
          this.view2.x = this.p2Target.x;
          this.view2.y = this.p2Target.y;
        } else if (err > 0.5) {
          const rk = 1 - Math.exp(-dt * (err > 28 ? 16 : 9));
          this.view2.x += (authX - this.view2.x) * rk;
          this.view2.y += (authY - this.view2.y) * rk;
        }
      }
      this.view2.animate(dt, inputLen > 0.1 || this.p2Target.moving ? 1 : 0);
    } else {
      const k2 = 1 - Math.exp(-dt * 20);
      this.view2.x += (this.p2Target.x - this.view2.x) * k2;
      this.view2.y += (this.p2Target.y - this.view2.y) * k2;
      this.view2.rotation = Phaser.Math.Angle.RotateTo(this.view2.rotation, this.p2Target.rot, dt * 16);
      this.view2.animate(dt, 0);
    }
    this.view2.setAlpha(this.p2Target.downed ? 0.48 : 1);

    // 帧率无关顺滑镜头跟随（60Hz / 120Hz / 144Hz 手感完全一致）
    const ck = 1 - Math.exp(-dt * 12);
    this.camX += (this.view2.x - this.camX) * ck;
    this.camY += (this.view2.y - this.camY) * ck;
    this.cameras.main.centerOn(this.camX, this.camY);

    // 3. 怪物速度外推 + 平滑插值与朝向旋转
    const ek = 1 - Math.exp(-dt * 24);
    const barG = this.enemyBarG;
    barG.clear();
    for (const g of this.enemies.values()) {
      g.snapAge += dt;
      const lead = Math.min(g.snapAge, 0.055);
      const gx = g.tx + g.vx * lead;
      const gy = g.ty + g.vy * lead;
      g.x += (gx - g.x) * ek;
      g.y += (gy - g.y) * ek;
      g.rot = Phaser.Math.Angle.RotateTo(g.rot, g.trot, dt * 18);
      g.sprite.setPosition(g.x, g.y).setRotation(g.rot);
      if (g.hp < g.maxHp && g.maxHp > 0 && (g.flags & 24) !== 0) {
        const bw = (g.flags & 16) ? 68 : 42;
        const bx = g.x - bw / 2;
        const by = g.y - g.radius - 12;
        barG.fillStyle(0x090b10, 0.85);
        barG.fillRect(bx - 1, by - 1, bw + 2, 6);
        barG.fillStyle((g.flags & 16) ? 0xff4a42 : 0xffb238, 1);
        barG.fillRect(bx, by, bw * Math.max(0, Math.min(1, g.hp / g.maxHp)), 4);
      }
      if (g.status & 4) {
        barG.lineStyle(2, 0x8ceeff, 0.9);
        barG.strokeCircle(g.x, g.y, g.radius + 3);
      }
    }

    // 4. 我方子弹每帧速度外推（彻底告别 20fps 跳跃）
    if (!paused) {
      for (const p of this.projActive) {
        if (p.vx !== 0 || p.vy !== 0) {
          p.sprite.x += p.vx * dt;
          p.sprite.y += p.vy * dt;
        }
        if (p.spin !== 0) p.sprite.rotation += p.spin * dt;
      }
    }

    // 5. 敌方弹幕每帧速度外推 + 高对比危险光环
    const sg = this.shotAuraG;
    sg.clear();
    const ringPulse = 0.88 + 0.14 * Math.sin(this.pulse * 18);
    for (const s of this.shotActive) {
      if (!paused) {
        s.sprite.x += s.vx * dt;
        s.sprite.y += s.vy * dt;
        if (s.kind === 0) s.sprite.rotation += dt * 6;
      }
      const col = s.kind === 1 ? 0xff4668 : s.kind === 2 ? 0xff3ee0 : 0xff52a8;
      const haloR = (s.kind === 1 ? 8.2 : s.kind === 2 ? 9.4 : 8.8) * ringPulse;
      sg.fillStyle(col, 0.22);
      sg.fillCircle(s.sprite.x, s.sprite.y, haloR);
      sg.lineStyle(2.0, 0x160408, 0.88);
      sg.strokeCircle(s.sprite.x, s.sprite.y, haloR + 0.8);
      sg.lineStyle(1.6, col, 0.94);
      sg.strokeCircle(s.sprite.x, s.sprite.y, haloR);
    }

    // 6. 掉落物（花蜜/宝箱/果实）逐帧顺滑插值（吸蜜飞入全满刷）
    const pk = 1 - Math.exp(-dt * 26);
    for (const d of this.pickups.values()) {
      d.x += (d.tx - d.x) * pk;
      d.y += (d.ty - d.y) * pk;
      d.sprite.setPosition(d.x, d.y);
    }

    // 7. 召唤物（蚜虫/工蚁/绕身飞蛾）逐帧顺滑插值
    const sk = 1 - Math.exp(-dt * 26);
    for (const sm of this.summons.values()) {
      sm.x += (sm.tx - sm.x) * sk;
      sm.y += (sm.ty - sm.y) * sk;
      sm.rot = Phaser.Math.Angle.RotateTo(sm.rot, sm.trot, dt * 20);
      sm.sprite.setPosition(sm.x, sm.y).setRotation(sm.rot);
    }

    this.drawPlayerOverlays();
  }

  private drawPlayerOverlays(): void {
    const g = this.overlayG;
    g.clear();
    g.lineStyle(2.2, this.p1Target.downed ? 0xff5d57 : 0xffd44c, this.p1Target.downed ? 0.9 : 0.55);
    g.strokeCircle(this.view1.x, this.view1.y + 4, 22);
    g.lineStyle(2.2, this.p2Target.downed ? 0xff5d57 : 0x5cd8ff, this.p2Target.downed ? 0.9 : 0.62);
    g.strokeCircle(this.view2.x, this.view2.y + 4, 22);

    const drawRevive = (x: number, y: number, pct: number) => {
      g.fillStyle(0xff4a42, 0.14);
      g.fillCircle(x, y, REVIVE_RADIUS);
      g.lineStyle(2.5, 0xff6a62, 0.85);
      g.strokeCircle(x, y, REVIVE_RADIUS);
      if (pct > 0.01) {
        g.lineStyle(5, 0x74ea78, 0.96);
        g.beginPath();
        g.arc(x, y, REVIVE_RADIUS - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false);
        g.strokePath();
      }
    };
    if (this.p1Target.downed) drawRevive(this.view1.x, this.view1.y, this.p1Target.revivePct);
    if (this.p2Target.downed) drawRevive(this.view2.x, this.view2.y, this.p2Target.revivePct);

    this.p1Tag.setPosition(this.view1.x, this.view1.y - 26).setText(this.p1Target.downed ? 'P1 倒地' : 'P1');
    this.p2Tag.setPosition(this.view2.x, this.view2.y - 26).setText(this.p2Target.downed ? 'P2 倒地' : 'P2');
  }

  private readInput(): [number, number] {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    touchMove.keyboardActive = x !== 0 || y !== 0;
    if (touchMove.keyboardActive) {
      const l = Math.hypot(x, y);
      return [x / l, y / l];
    }
    const pad = this.input.gamepad?.pad1;
    if (pad) {
      let gx = pad.leftStick.x;
      let gy = pad.leftStick.y;
      if (Math.hypot(gx, gy) < 0.18) {
        gx = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
        gy = (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
      }
      const gl = Math.hypot(gx, gy);
      if (gl > 0.18) return gl > 1 ? [gx / gl, gy / gl] : [gx, gy];
    }
    return [touchMove.x, touchMove.y];
  }

  private isUiPaused(): boolean {
    const ui = this.scene.get('UI') as unknown as { isPaused?: boolean } | undefined;
    return !!ui?.isPaused;
  }

  private pollGamepadActions(): void {
    const pad = this.input.gamepad?.pad1;
    if (!pad) {
      this.padDashDown = false;
      this.padPauseDown = false;
      return;
    }
    const dashNow = !!(pad.A || pad.R1 || pad.buttons[0]?.pressed || pad.buttons[5]?.pressed);
    if (dashNow && !this.padDashDown && !this.isUiPaused() && this.run.phase === 'combat' && !this.run.coopDowned) {
      this.dashQueued = true;
      this.sendInputNow();
    }
    this.padDashDown = dashNow;
    const pauseNow = !!(pad.buttons[9]?.pressed);
    if (pauseNow && !this.padPauseDown) {
      const ui = this.scene.get('UI') as unknown as { togglePause?: () => void };
      ui?.togglePause?.();
    }
    this.padPauseDown = pauseNow;
  }

  private sendInputNow(rawIx?: number, rawIy?: number): void {
    const [ix, iy] = rawIx !== undefined && rawIy !== undefined ? [rawIx, rawIy] : this.readInput();
    const qx = Math.round(ix * 100) / 100;
    const qy = Math.round(iy * 100) / 100;
    this.lastSentIx = qx;
    this.lastSentIy = qy;
    coop.send({
      type: 'input',
      data: {
        seq: ++this.inputSeq,
        ix: qx,
        iy: qy,
        dash: this.dashQueued,
      },
    });
    this.dashQueued = false;
  }

  private handleMessage(msg: CoopMessage): void {
    if (msg.type === 'snap') {
      this.applySnapshot(msg.data);
    } else if (msg.type === 'enter_intermission') {
      applyEnterIntermission(this.run, msg.data);
      coop.resetWaveReady();
      this.clearWorldSprites();
      bgm.setMode('shop');
      bus.emit(EVT.INTERMISSION);
      this.scene.launch('Intermission');
    } else if (msg.type === 'start_wave') {
      this.run.wave = msg.wave;
      this.run.endless = msg.endless;
      this.run.activeContract = null;
      this.run.nextWaveOneHp = false;
      this.run.nextWaveBait = 0;
      this.run.nextWavePeacock = 0;
      this.run.curseOfferBonus = false;
      this.run.coopDowned = false;
      this.run.coopRevivePct = 0;
      this.run.phase = 'combat';
      this.lastWave = msg.wave;
      this.p1Init = false;
      this.p2Init = false;
      this.lastSnapMs = 0;
      coop.resetWaveReady();
      if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
      bgm.setMode('combat');
      bus.emit(EVT.WAVE_START, msg.wave);
      sfx.play('waveStart');
    } else if (msg.type === 'pause_state') {
      const ui = this.scene.get('UI') as unknown as { applyRemotePause?: (p: boolean) => void };
      ui?.applyRemotePause?.(msg.paused);
    } else if (msg.type === 'return_lobby') {
      bgm.setPaused(false);
      if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
      this.scene.stop('UI');
      this.scene.start('CoopLobby');
    } else if (msg.type === 'victory_choice') {
      this.run.won = true;
      this.run.phase = 'victory';
      bgm.setMode('shop');
      bus.emit(EVT.VICTORY);
      sfx.play('victory');
      this.time.delayedCall(900, () => bus.emit(EVT.VICTORY_CHOICE));
    } else if (msg.type === 'match_result') {
      this.toResult(msg.data);
    }
  }

  private applySnapshot(s: CombatSnapshotPayload): void {
    const run = this.run;
    run.wave = s.wave;
    run.endless = s.endless;
    if (s.wave !== this.lastWave && s.phase === 'combat') {
      this.lastWave = s.wave;
      bus.emit(EVT.WAVE_START, s.wave);
    }
    if (run.phase !== 'intermission') run.phase = s.phase;
    if (s.phase === 'dead' && !this.deadNotified) {
      this.deadNotified = true;
      bus.emit(EVT.PLAYER_DEAD);
    }
    run.waveTimeLeft = s.waveTimeLeft < 0 ? Infinity : s.waveTimeLeft;
    run.activeWeather = s.activeWeather;
    run.arenaHint = s.arenaHint;
    run.boss = s.boss;
    this.groundImg.setTint(GROUND_WEATHER_TINT[s.activeWeather] ?? 0xffffff);
    if (s.boss && bgm) bgm.setMode('boss');

    // 更新自己（P2）HUD 状态与队友（P1）HUD 迷你卡
    const me = s.p2;
    const ally = s.p1;
    run.hp = me.hp;
    run.coopMaxHp = me.maxHp;
    run.shield = me.shield;
    run.nectar = me.nectar;
    run.totalNectar = me.totalNectar;
    run.level = me.level;
    run.xp = me.xp;
    run.pendingLevelUps = me.pendingLevelUps;
    run.chests = me.chests;
    run.kills = me.kills;
    run.dashRatio = me.dashRatio;
    run.dashCharges = me.dashCharges;
    run.maxDashCharges = me.maxDashCharges;
    run.frenzyTime = me.frenzyTime;
    run.coopDowned = me.downed;
    run.coopRevivePct = me.revivePct;
    run.coopTeammate = {
      name: `P1 · ${CHARACTERS[this.match.host.character]?.name ?? '房主'}`,
      hp: ally.hp,
      maxHp: ally.maxHp,
      level: ally.level,
      downed: ally.downed,
      revivePct: ally.revivePct,
      x: ally.x,
      y: ally.y,
    };

    const nowMs = performance.now();
    const snapDt = this.lastSnapMs > 0 ? Phaser.Math.Clamp((nowMs - this.lastSnapMs) / 1000, 0.012, 0.12) : 0.033;
    this.lastSnapMs = nowMs;

    // 同步双方 BeetleView 武器外观与瞄准角
    this.syncPlayerView(this.view1, ally, true, snapDt);
    this.syncPlayerView(this.view2, me, false, snapDt);

    // 屏幕外方向指示（队友 + Boss）
    const view = this.cameras.main.worldView;
    const markers = run.offscreenMarkers;
    markers.length = 0;
    if (!view.contains(ally.x, ally.y)) {
      markers.push({ x: ally.x, y: ally.y, kind: ally.downed ? 'ally_down' : 'ally' });
    }
    if (s.arena.bloom && !view.contains(s.arena.bloom[0], s.arena.bloom[1])) {
      markers.push({ x: s.arena.bloom[0], y: s.arena.bloom[1], kind: 'bloom' });
    }

    // 同步怪物（带速度估计与平滑旋转）
    const seen = new Set<number>();
    for (const row of s.enemies) {
      const [uid, defId, x, y, hp, maxHp, sc, rot, flags, status] = row;
      seen.add(uid);
      const def = ENEMIES[defId];
      if (!def) continue;
      let g = this.enemies.get(uid);
      if (!g) {
        const sprite = this.add.image(x, y, def.texture).setDepth(DEPTH.enemy).setRotation(rot);
        g = { sprite, tx: x, ty: y, vx: 0, vy: 0, x, y, trot: rot, rot, snapAge: 0, hp, maxHp, flags, status, radius: def.radius };
        this.enemies.set(uid, g);
      } else {
        const dx = x - g.tx;
        const dy = y - g.ty;
        const dist = Math.hypot(dx, dy);
        if (dist > 140) {
          g.x = x;
          g.y = y;
          g.vx = 0;
          g.vy = 0;
        } else {
          const rvx = dx / snapDt;
          const rvy = dy / snapDt;
          const sp = Math.hypot(rvx, rvy);
          const cap = sp > 680 ? 680 / sp : 1;
          g.vx = g.vx * 0.35 + rvx * cap * 0.65;
          g.vy = g.vy * 0.35 + rvy * cap * 0.65;
        }
        g.tx = x;
        g.ty = y;
        g.trot = rot;
        g.snapAge = 0;
        g.hp = hp;
        g.maxHp = maxHp;
        g.flags = flags;
        g.status = status;
      }
      g.sprite.setScale(sc);
      if (flags & 1) g.sprite.setTintFill(0xffffff);
      else if (flags & 2) g.sprite.setTint(0xd488ff);
      else if (flags & 4) g.sprite.setTint(0xff6b6b);
      else if (status & 4) g.sprite.setTint(0x9ceeff);
      else if (status & 2) g.sprite.setTint(0xffaa60);
      else if (status & 1) g.sprite.setTint(0x98f060);
      else g.sprite.clearTint();
      if ((flags & 24) && !view.contains(x, y)) {
        markers.push({ x, y, kind: (flags & 16) ? 'boss' : 'elite' });
      }
    }
    for (const [uid, g] of this.enemies) {
      if (!seen.has(uid)) {
        g.sprite.destroy();
        this.enemies.delete(uid);
      }
    }

    // 同步我方投射物（记录速度与自转，每帧平滑外推）
    while (this.projActive.length > s.projs.length) {
      const gp = this.projActive.pop()!;
      gp.sprite.setVisible(false);
      this.projPool.push(gp.sprite);
    }
    while (this.projActive.length < s.projs.length) {
      const img = this.projPool.pop() ?? this.add.image(0, 0, 'dot').setDepth(DEPTH.projectile);
      img.setVisible(true);
      this.projActive.push({ sprite: img, vx: 0, vy: 0, spin: 0 });
    }
    for (let i = 0; i < s.projs.length; i++) {
      const [tex, x, y, rot, sc, alpha, tint, vx, vy, spin] = s.projs[i];
      const gp = this.projActive[i];
      if (this.textures.exists(tex)) gp.sprite.setTexture(tex);
      gp.sprite.setPosition(x, y).setRotation(rot).setScale(sc).setAlpha(alpha);
      if (tint && tint !== 0xffffff) gp.sprite.setTint(tint);
      else gp.sprite.clearTint();
      gp.vx = vx;
      gp.vy = vy;
      gp.spin = spin;
    }

    // 同步敌方弹幕（记录速度，每帧平滑外推 + 绘制危险光环）
    while (this.shotActive.length > s.shots.length) {
      const gs = this.shotActive.pop()!;
      gs.sprite.setVisible(false);
      this.shotPool.push(gs.sprite);
    }
    while (this.shotActive.length < s.shots.length) {
      const img = this.shotPool.pop() ?? this.add.image(0, 0, 'silk').setDepth(DEPTH.projectile);
      img.setVisible(true);
      this.shotActive.push({ sprite: img, kind: 0, vx: 0, vy: 0 });
    }
    for (let i = 0; i < s.shots.length; i++) {
      const [k, x, y, ang, vx, vy] = s.shots[i];
      const gs = this.shotActive[i];
      const tex = k === 1 ? 'enemy-stinger' : k === 2 ? 'enemy-orb' : 'silk';
      gs.sprite
        .setTexture(tex)
        .setPosition(x, y)
        .setScale((k === 1 ? 1.05 : k === 2 ? 0.98 : 1) / SPRITE_RES)
        .clearTint()
        .setAlpha(1);
      if (k === 1) gs.sprite.setRotation(ang);
      gs.kind = k;
      gs.vx = vx;
      gs.vy = vy;
    }

    // 同步掉落物（按 uid 逐帧顺滑插值）
    const seenPickups = new Set<number>();
    for (const row of s.pickups) {
      const [uid, k, x, y, val] = row;
      seenPickups.add(uid);
      let d = this.pickups.get(uid);
      const tex = k === 1 ? 'chest' : k === 2 ? 'fruit' : k === 3 ? 'mushroom' : k === 4 ? 'frenzy-dew' : 'nectar';
      const boost = k === 0 ? (val >= 10 ? 1.44 : val >= 4 ? 1.24 : 1) : k === 1 ? 1.2 : 1;
      if (!d) {
        const sprite = this.add.image(x, y, tex).setDepth(k === 0 ? DEPTH.nectar : DEPTH.nectar + 1).setScale(boost / SPRITE_RES);
        d = { sprite, tx: x, ty: y, x, y, kind: k, val };
        this.pickups.set(uid, d);
      } else {
        d.tx = x;
        d.ty = y;
        if (d.val !== val || d.kind !== k) {
          d.val = val;
          d.kind = k;
          d.sprite.setTexture(tex).setScale(boost / SPRITE_RES);
        }
      }
      if (k === 0 && val >= 10) d.sprite.setTint(0xffc838);
      else if (k === 0 && val >= 4) d.sprite.setTint(0xffe67a);
      else d.sprite.clearTint();
      if (k === 1 && !view.contains(x, y)) markers.push({ x, y, kind: 'chest' });
    }
    for (const [uid, d] of this.pickups) {
      if (!seenPickups.has(uid)) {
        d.sprite.destroy();
        this.pickups.delete(uid);
      }
    }

    // 同步召唤物（按 uid 逐帧顺滑插值）
    const seenSummons = new Set<number>();
    for (const row of s.summons) {
      const [uid, tex, x, y, rot, sc] = row;
      seenSummons.add(uid);
      let sm = this.summons.get(uid);
      if (!sm) {
        const sprite = this.add
          .image(x, y, this.textures.exists(tex) ? tex : 'dot')
          .setDepth(DEPTH.enemy - 1)
          .setRotation(rot)
          .setScale(sc);
        sm = { sprite, tx: x, ty: y, x, y, trot: rot, rot };
        this.summons.set(uid, sm);
      } else {
        if (Math.hypot(x - sm.tx, y - sm.ty) > 180) {
          sm.x = x;
          sm.y = y;
        }
        sm.tx = x;
        sm.ty = y;
        sm.trot = rot;
        if (this.textures.exists(tex) && sm.sprite.texture.key !== tex) sm.sprite.setTexture(tex);
        sm.sprite.setScale(sc);
      }
    }
    for (const [uid, sm] of this.summons) {
      if (!seenSummons.has(uid)) {
        sm.sprite.destroy();
        this.summons.delete(uid);
      }
    }

    // 同步固定机关 + 毒云/蛛网
    const totalExtras = s.devices.length + s.hazards.length;
    this.syncPoolSprites(this.extraActive, this.extraPool, totalExtras, DEPTH.mound, (img, idx) => {
      if (idx < s.devices.length) {
        const [tex, x, y, rot, sc] = s.devices[idx];
        if (this.textures.exists(tex)) img.setTexture(tex);
        img.setDepth(DEPTH.mound + 1).setPosition(x, y).setRotation(rot).setScale(sc).setAlpha(1).clearTint();
      } else {
        const [k, x, y, r, alpha] = s.hazards[idx - s.devices.length];
        img.setTexture(k === 1 ? 'webzone' : 'cloud').setDepth(DEPTH.mound - 1).setPosition(x, y).setDisplaySize(r * 2.2, r * 2.2).setAlpha(alpha).clearTint();
      }
    });

    // 绘制生态地形（水洼/干叶/木桩/金露花/火迹/诱饵）
    this.drawArena(s.arena);

    // 回放房主推送的瞬时特效与音效
    for (const ev of s.fx) {
      if (ev.t === 'num') this.fx.number(ev.x, ev.y, ev.v, ev.kind);
      else if (ev.t === 'ring') this.fx.ring(ev.x, ev.y, ev.r, ev.col);
      else if (ev.t === 'exp') this.fx.explosion(ev.x, ev.y, ev.r, ev.col, ev.tier);
      else if (ev.t === 'burst') this.fx.burst(ev.x, ev.y, ev.col, ev.n, ev.sp, ev.sc);
      else if (ev.t === 'beam') this.fx.beam(ev.x1, ev.y1, ev.x2, ev.y2, ev.col, 0.2);
      else if (ev.t === 'chain') this.fx.zap(ev.pts.flat());
      else if (ev.t === 'sfx') sfx.play(ev.name as SoundName);
      else if (ev.t === 'banner') bus.emit(EVT.WAVE_EVENT, ev.text, ev.col);
      else if (ev.t === 'streak') bus.emit(EVT.KILL_STREAK, ev.count);
      else if (ev.t === 'shake') shake(this, ev.ms, ev.amp);
    }
  }

  private syncPlayerView(view: BeetleView, sp: SnapPlayer, isHost: boolean, snapDt: number): void {
    if (isHost) {
      if (!this.p1Init) {
        this.p1Init = true;
        view.setPosition(sp.x, sp.y).setRotation(sp.rot);
        this.p1Target.vx = 0;
        this.p1Target.vy = 0;
      } else {
        const dx = sp.x - this.p1Target.x;
        const dy = sp.y - this.p1Target.y;
        if (Math.hypot(dx, dy) > 160) {
          view.setPosition(sp.x, sp.y);
          this.p1Target.vx = 0;
          this.p1Target.vy = 0;
        } else {
          this.p1Target.vx = this.p1Target.vx * 0.3 + (dx / snapDt) * 0.7;
          this.p1Target.vy = this.p1Target.vy * 0.3 + (dy / snapDt) * 0.7;
        }
      }
      this.p1Target.x = sp.x;
      this.p1Target.y = sp.y;
      this.p1Target.rot = sp.rot;
      this.p1Target.moving = sp.moving;
      this.p1Target.downed = sp.downed;
      this.p1Target.revivePct = sp.revivePct;
      this.p1Target.snapAge = 0;
    } else {
      if (!this.p2Init) {
        this.p2Init = true;
        view.setPosition(sp.x, sp.y).setRotation(sp.rot);
        this.camX = sp.x;
        this.camY = sp.y;
        this.cameras.main.centerOn(this.camX, this.camY);
      }
      this.p2Target.x = sp.x;
      this.p2Target.y = sp.y;
      this.p2Target.rot = sp.rot;
      this.p2Target.speed = sp.speed ?? 0;
      this.p2Target.dashTime = sp.dashTime;
      this.p2Target.moving = sp.moving;
      this.p2Target.downed = sp.downed;
      this.p2Target.revivePct = sp.revivePct;
    }

    const sig = `${sp.weaponSlots}|${sp.weapons.map((w) => `${w.id}:${w.tier}`).join(',')}`;
    const prevSig = isHost ? this.p1Sig : this.p2Sig;
    if (sig !== prevSig) {
      if (isHost) this.p1Sig = sig;
      else this.p2Sig = sig;
      view.setSlotCount(sp.weaponSlots);
      for (let i = 0; i < sp.weaponSlots; i++) {
        const w = sp.weapons[i];
        const def = w ? WEAPONS[w.id] : null;
        if (w && def) view.setWeapon(i, def.icon, w.tier);
        else view.setWeapon(i, null);
      }
    }
    view.setWeaponsVisible(!getSettings().hideWeapons);
    for (let i = 0; i < sp.aims.length; i++) {
      view.setWeaponAim(i, sp.aims[i]);
    }
  }

  private drawArena(a: CombatSnapshotPayload['arena']): void {
    const g = this.arenaG;
    g.clear();
    for (const [x, y, r] of a.puddles) {
      g.fillStyle(0x2a88c8, 0.34);
      g.fillCircle(x, y, r);
      g.lineStyle(2, 0x7ce4ff, 0.55);
      g.strokeCircle(x, y, r);
    }
    for (const [x, y, r, burn] of a.leaves) {
      g.fillStyle(burn > 0 ? 0xff6e28 : 0x8a5e2c, burn > 0 ? 0.44 : 0.36);
      g.fillCircle(x, y, r);
      g.lineStyle(2, burn > 0 ? 0xffc858 : 0xb88446, 0.65);
      g.strokeCircle(x, y, r);
    }
    for (const [x, y, r] of a.stumps) {
      g.fillStyle(0x5a4228, 0.95);
      g.fillCircle(x, y, r);
      g.lineStyle(3, 0x1a120a, 1);
      g.strokeCircle(x, y, r);
    }
    for (const [x, y, r] of a.flames) {
      g.fillStyle(0xff7830, 0.38);
      g.fillCircle(x, y, r);
    }
    for (const [x, y] of a.decoys) {
      g.fillStyle(0xffe068, 0.45);
      g.fillCircle(x, y, 20);
      g.lineStyle(2, 0xfff4b0, 0.85);
      g.strokeCircle(x, y, 20);
    }
    if (a.bloom) {
      const [x, y, r, ratio] = a.bloom;
      g.fillStyle(0xffd84c, 0.14);
      g.fillCircle(x, y, r);
      g.lineStyle(2.5, 0xffe478, 0.8);
      g.strokeCircle(x, y, r);
      if (ratio > 0.01) {
        g.lineStyle(5, 0x74ea78, 0.95);
        g.beginPath();
        g.arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
        g.strokePath();
      }
    }
  }

  private syncPoolSprites(
    active: Phaser.GameObjects.Image[],
    pool: Phaser.GameObjects.Image[],
    count: number,
    depth: number,
    apply: (img: Phaser.GameObjects.Image, idx: number) => void,
  ): void {
    while (active.length > count) {
      const img = active.pop()!;
      img.setVisible(false);
      pool.push(img);
    }
    while (active.length < count) {
      const img = pool.pop() ?? this.add.image(0, 0, 'dot').setDepth(depth);
      img.setVisible(true);
      active.push(img);
    }
    for (let i = 0; i < count; i++) apply(active[i], i);
  }

  private clearWorldSprites(): void {
    for (const g of this.enemies.values()) g.sprite.destroy();
    this.enemies.clear();
    for (const d of this.pickups.values()) d.sprite.destroy();
    this.pickups.clear();
    for (const sm of this.summons.values()) sm.sprite.destroy();
    this.summons.clear();
    this.enemyBarG.clear();
    this.shotAuraG.clear();
    this.arenaG.clear();
    while (this.projActive.length > 0) {
      const gp = this.projActive.pop()!;
      gp.sprite.setVisible(false);
      this.projPool.push(gp.sprite);
    }
    while (this.shotActive.length > 0) {
      const gs = this.shotActive.pop()!;
      gs.sprite.setVisible(false);
      this.shotPool.push(gs.sprite);
    }
    while (this.extraActive.length > 0) {
      const img = this.extraActive.pop()!;
      img.setVisible(false);
      this.extraPool.push(img);
    }
  }

  private toResult(res: MatchResultPayload): void {
    if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
    this.scene.stop('UI');
    bgm.setMode('menu');
    const me = res.guest;
    const partner = res.host;
    const data: ResultData = {
      win: res.win,
      endless: res.endless,
      wave: res.wave,
      level: me.level,
      kills: me.kills,
      nectar: me.nectar,
      character: me.character,
      difficulty: res.difficulty,
      weapon: me.weapon,
      biome: res.biome,
      seed: res.seed,
      newDifficulty: false,
      maxWaves: res.maxWaves,
      unlocked: [],
      weapons: me.weapons,
      sets: me.sets,
      coopPartner: {
        roleLabel: 'P1 · 房主',
        ...partner,
      },
    };
    this.scene.start('Result', data);
  }
}
