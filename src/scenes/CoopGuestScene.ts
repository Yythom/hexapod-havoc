import Phaser from 'phaser';
import { ensureBiomeGround } from '../art/biomeGrounds';
import { SPRITE_RES } from '../art/draw';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
type SoundName = Parameters<typeof sfx.play>[0];
import { CAMERA_ZOOM, DEPTH, FONT_FAMILY, RENDER_SCALE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { bus, EVT, listen } from '../core/bus';
import { touchMove } from '../core/input';
import { RunState } from '../core/RunState';
import { getSettings, useSettingsStore } from '../core/settings';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { coop } from '../net/coop';
import { REVIVE_RADIUS } from '../net/coopHost';
import type {
  CombatSnapshotPayload,
  CoopMessage,
  MatchResultPayload,
  MatchStartPayload,
  SnapPlayer,
} from '../net/protocol';
import { Effects } from '../systems/Effects';
import { shake } from '../ui/camera';
import type { ResultData } from './GameScene';

type MoveKeys = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

const GROUND_WEATHER_TINT = [0xffffff, 0xe8eff5, 0xd8e5ec, 0xbfcbd8, 0xa8b4cc];
const INPUT_INTERVAL = 1 / 30;

interface GhostEnemy {
  sprite: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  flags: number;
  status: number;
  radius: number;
}

/**
 * 双人联机客机战斗场景（P2）：
 * 接收房主 20Hz 状态快照并平滑插值渲染完整战场，同时以 30Hz 发送本地输入。
 * 共用 UIScene HUD 与 IntermissionScene 商店，体验与房主完全一致。
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
  private overlayG!: Phaser.GameObjects.Graphics;
  private enemyBarG!: Phaser.GameObjects.Graphics;
  private fx!: Effects;
  private keys!: MoveKeys;

  private p1Target = { x: WORLD_WIDTH / 2 - 48, y: WORLD_HEIGHT / 2, rot: 0, moving: false, downed: false, revivePct: 0 };
  private p2Target = { x: WORLD_WIDTH / 2 + 48, y: WORLD_HEIGHT / 2, rot: 0, moving: false, downed: false, revivePct: 0 };
  private p1Sig = '';
  private p2Sig = '';

  private enemies = new Map<number, GhostEnemy>();
  private projPool: Phaser.GameObjects.Image[] = [];
  private projActive: Phaser.GameObjects.Image[] = [];
  private shotPool: Phaser.GameObjects.Image[] = [];
  private shotActive: Phaser.GameObjects.Image[] = [];
  private pickupPool: Phaser.GameObjects.Image[] = [];
  private pickupActive: Phaser.GameObjects.Image[] = [];
  private extraPool: Phaser.GameObjects.Image[] = [];
  private extraActive: Phaser.GameObjects.Image[] = [];

  private inputAcc = 0;
  private inputSeq = 0;
  private dashQueued = false;
  private padDashDown = false;
  private padPauseDown = false;
  private lastWave = 0;
  private unsubMsg: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;
  private aimWorld = new Phaser.Math.Vector2();

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
    this.projPool = [];
    this.projActive = [];
    this.shotPool = [];
    this.shotActive = [];
    this.pickupPool = [];
    this.pickupActive = [];
    this.extraPool = [];
    this.extraActive = [];
    this.p1Sig = '';
    this.p2Sig = '';
    this.inputAcc = 0;
    this.inputSeq = 0;
    this.dashQueued = false;
    this.padDashDown = false;
    this.padPauseDown = false;
    this.lastWave = 1;
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
    cam.startFollow(this.view2, false, 0.14, 0.14);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as MoveKeys;
    const triggerDash = () => {
      if (this.run.phase === 'combat' && !this.run.coopDowned) {
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
    this.unsubState = coop.onState((st) => {
      if (st === 'disconnected') {
        bus.emit(EVT.WAVE_EVENT, '⚠ 与房主断开连接', '#ff6a5e');
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
    this.fx.update(dt);
    this.pollGamepadActions();

    if (this.run.phase === 'combat' || this.run.phase === 'cleanup') {
      this.inputAcc += dt;
      if (this.inputAcc >= INPUT_INTERVAL) {
        this.inputAcc = 0;
        this.sendInputNow();
      }
    }

    // 平滑插值双方角色
    const k = 1 - Math.exp(-dt * 18);
    this.view1.x += (this.p1Target.x - this.view1.x) * k;
    this.view1.y += (this.p1Target.y - this.view1.y) * k;
    this.view1.rotation = Phaser.Math.Angle.RotateTo(this.view1.rotation, this.p1Target.rot, dt * 16);
    this.view1.animate(dt, this.p1Target.moving ? 1 : 0);
    this.view1.setAlpha(this.p1Target.downed ? 0.48 : 1);

    this.view2.x += (this.p2Target.x - this.view2.x) * k;
    this.view2.y += (this.p2Target.y - this.view2.y) * k;
    this.view2.rotation = Phaser.Math.Angle.RotateTo(this.view2.rotation, this.p2Target.rot, dt * 16);
    this.view2.animate(dt, this.p2Target.moving ? 1 : 0);
    this.view2.setAlpha(this.p2Target.downed ? 0.48 : 1);

    // 平滑插值怪物
    const ek = 1 - Math.exp(-dt * 16);
    const barG = this.enemyBarG;
    barG.clear();
    for (const g of this.enemies.values()) {
      g.x += (g.tx - g.x) * ek;
      g.y += (g.ty - g.y) * ek;
      g.sprite.setPosition(g.x, g.y);
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

  private pollGamepadActions(): void {
    const pad = this.input.gamepad?.pad1;
    if (!pad) {
      this.padDashDown = false;
      this.padPauseDown = false;
      return;
    }
    const dashNow = !!(pad.A || pad.R1 || pad.buttons[0]?.pressed || pad.buttons[5]?.pressed);
    if (dashNow && !this.padDashDown) {
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

  private sendInputNow(): void {
    const [ix, iy] = this.readInput();
    const ptr = this.input.activePointer;
    const manual = getSettings().manualAim || (!ptr.wasTouch && ptr.leftButtonDown() && !touchMove.active);
    let aimX: number | undefined;
    let aimY: number | undefined;
    if (manual) {
      this.cameras.main.getWorldPoint(ptr.x, ptr.y, this.aimWorld);
      aimX = Math.round(this.aimWorld.x);
      aimY = Math.round(this.aimWorld.y);
    }
    coop.send({
      type: 'input',
      data: {
        seq: ++this.inputSeq,
        ix: Math.round(ix * 100) / 100,
        iy: Math.round(iy * 100) / 100,
        dash: this.dashQueued,
        aimX,
        aimY,
        manualAim: manual,
      },
    });
    this.dashQueued = false;
  }

  private handleMessage(msg: CoopMessage): void {
    if (msg.type === 'snap') {
      this.applySnapshot(msg.data);
    } else if (msg.type === 'enter_intermission') {
      const d = msg.data;
      this.run.wave = d.wave;
      this.run.endless = d.endless;
      this.run.won = d.won;
      this.run.nectar = d.nectar;
      this.run.totalNectar = d.totalNectar;
      this.run.waveNectar = d.waveNectar;
      this.run.waveKills = d.waveKills;
      this.run.waveHarvest = d.waveHarvest;
      this.run.waveInterest = d.waveInterest;
      this.run.kills = d.kills;
      this.run.level = d.level;
      this.run.xp = d.xp;
      this.run.pendingLevelUps = d.pendingLevelUps;
      this.run.chests = d.chests;
      this.run.bonus = { ...d.bonus };
      this.run.weapons = d.weapons.map((w) => ({ ...w }));
      this.run.recomputeStats();
      this.run.resetIntermissionState();
      this.run.phase = 'intermission';
      coop.resetWaveReady();
      this.clearWorldSprites();
      bgm.setMode('shop');
      bus.emit(EVT.INTERMISSION);
      this.scene.launch('Intermission');
    } else if (msg.type === 'start_wave') {
      this.run.wave = msg.wave;
      this.run.endless = msg.endless;
      this.run.phase = 'combat';
      this.lastWave = msg.wave;
      coop.resetWaveReady();
      if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
      bgm.setMode('combat');
      bus.emit(EVT.WAVE_START, msg.wave);
      sfx.play('waveStart');
    } else if (msg.type === 'pause_state') {
      const ui = this.scene.get('UI') as unknown as { applyRemotePause?: (p: boolean) => void };
      ui?.applyRemotePause?.(msg.paused);
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

    // 同步双方 BeetleView 武器外观与瞄准角
    this.syncPlayerView(this.view1, ally, true);
    this.syncPlayerView(this.view2, me, false);

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

    // 同步怪物
    const seen = new Set<number>();
    for (const row of s.enemies) {
      const [uid, defId, x, y, hp, maxHp, sc, rot, flags, status] = row;
      seen.add(uid);
      const def = ENEMIES[defId];
      if (!def) continue;
      let g = this.enemies.get(uid);
      if (!g) {
        const sprite = this.add.image(x, y, def.texture).setDepth(DEPTH.enemy);
        g = { sprite, tx: x, ty: y, x, y, hp, maxHp, flags, status, radius: def.radius };
        this.enemies.set(uid, g);
      }
      g.tx = x;
      g.ty = y;
      g.hp = hp;
      g.maxHp = maxHp;
      g.flags = flags;
      g.status = status;
      g.sprite.setScale(sc).setRotation(rot);
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

    // 同步投射物
    this.syncPoolSprites(this.projActive, this.projPool, s.projs.length, DEPTH.projectile, (img, idx) => {
      const [tex, x, y, rot, sc, alpha, tint] = s.projs[idx];
      if (this.textures.exists(tex)) img.setTexture(tex);
      img.setPosition(x, y).setRotation(rot).setScale(sc).setAlpha(alpha);
      if (tint && tint !== 0xffffff) img.setTint(tint);
      else img.clearTint();
    });

    // 同步敌方弹幕
    this.syncPoolSprites(this.shotActive, this.shotPool, s.shots.length, DEPTH.projectile, (img, idx) => {
      const [k, x, y, ang] = s.shots[idx];
      const tex = k === 1 ? 'enemy-stinger' : k === 2 ? 'enemy-orb' : 'silk';
      img.setTexture(tex).setPosition(x, y).setRotation(k === 1 ? ang : 0).setScale(1 / SPRITE_RES).clearTint().setAlpha(1);
    });

    // 同步掉落物
    this.syncPoolSprites(this.pickupActive, this.pickupPool, s.pickups.length, DEPTH.nectar, (img, idx) => {
      const [k, x, y, val] = s.pickups[idx];
      const tex = k === 1 ? 'chest' : k === 2 ? 'fruit' : k === 3 ? 'mushroom' : k === 4 ? 'frenzy-dew' : 'nectar';
      const boost = k === 0 ? (val >= 10 ? 1.44 : val >= 4 ? 1.24 : 1) : k === 1 ? 1.2 : 1;
      img.setTexture(tex).setPosition(x, y).setScale(boost / SPRITE_RES).setRotation(0).setAlpha(1);
      if (k === 0 && val >= 10) img.setTint(0xffc838);
      else if (k === 0 && val >= 4) img.setTint(0xffe67a);
      else img.clearTint();
      if (k === 1 && !view.contains(x, y)) markers.push({ x, y, kind: 'chest' });
    });

    // 同步召唤物 + 机关 + 毒云/蛛网
    const totalExtras = s.summons.length + s.devices.length + s.hazards.length;
    this.syncPoolSprites(this.extraActive, this.extraPool, totalExtras, DEPTH.mound, (img, idx) => {
      if (idx < s.summons.length) {
        const [tex, x, y, rot, sc] = s.summons[idx];
        if (this.textures.exists(tex)) img.setTexture(tex);
        img.setDepth(DEPTH.enemy - 1).setPosition(x, y).setRotation(rot).setScale(sc).setAlpha(1).clearTint();
      } else if (idx < s.summons.length + s.devices.length) {
        const [tex, x, y, rot, sc] = s.devices[idx - s.summons.length];
        if (this.textures.exists(tex)) img.setTexture(tex);
        img.setDepth(DEPTH.mound + 1).setPosition(x, y).setRotation(rot).setScale(sc).setAlpha(1).clearTint();
      } else {
        const [k, x, y, r, alpha] = s.hazards[idx - s.summons.length - s.devices.length];
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

  private syncPlayerView(view: BeetleView, sp: SnapPlayer, isHost: boolean): void {
    const tgt = isHost ? this.p1Target : this.p2Target;
    tgt.x = sp.x;
    tgt.y = sp.y;
    tgt.rot = sp.rot;
    tgt.moving = sp.moving;
    tgt.downed = sp.downed;
    tgt.revivePct = sp.revivePct;

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
    this.enemyBarG.clear();
    this.arenaG.clear();
    const hideAll = (arr: Phaser.GameObjects.Image[], pool: Phaser.GameObjects.Image[]) => {
      while (arr.length > 0) {
        const img = arr.pop()!;
        img.setVisible(false);
        pool.push(img);
      }
    };
    hideAll(this.projActive, this.projPool);
    hideAll(this.shotActive, this.shotPool);
    hideAll(this.pickupActive, this.pickupPool);
    hideAll(this.extraActive, this.extraPool);
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
