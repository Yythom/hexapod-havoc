import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { weaponTex } from '../art/icons';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, HUD_SCALE, IS_COARSE_POINTER, NUM_FONT } from '../config';
import { bus, EVT, listen } from '../core/bus';
import { CHALLENGES } from '../core/challenges';
import type { RunState } from '../core/RunState';
import { activeSets } from '../core/sets';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { CLASS_LABEL, TIERS, WEAPONS } from '../data/weapons';
import { coop } from '../net/coop';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { chamferPoints, createButton, drawKeycap, fillPoly, slantPoints, strokePoly } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import { openMechanicsGuide, type GuideModalHandle } from '../ui/guideModal';
import { addSettingsButtons } from '../ui/settingsButtons';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { CLASS_STYLE, COLOR, createStatsPanel, displayLabel, divider, drawChamferPlate, label, panel, pill, slotBox } from '../ui/widgets';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const LOW_HP = 0.3;
const CRITICAL_HP = 0.15;
const MAX_BANNERS = 3;

function style(size: number, color = '#f2f1ec', num = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: num ? NUM_FONT : FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: '#050507',
    strokeThickness: Math.max(4, Math.round(size / 5.5)),
    shadow: { offsetX: 2, offsetY: 2, color: '#050507', blur: 0, fill: true, stroke: true },
  };
}

/**
 * 土豆兄弟风格（Brotato）极简硬核战斗 HUD：
 * 粗黑墨描边血条 + 鲜绿经验条 + 裸露高对比花蜜数字 + 干净波次与大倒计时。
 */
export class UIScene extends Phaser.Scene {
  private run!: RunState;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private nectarText!: Phaser.GameObjects.Text;
  private dashBar!: Phaser.GameObjects.Graphics;
  private dashText!: Phaser.GameObjects.Text;
  private frenzyBadge!: Phaser.GameObjects.Container;
  private frenzyText!: Phaser.GameObjects.Text;
  private allyBox!: Phaser.GameObjects.Container;
  private allyBar!: Phaser.GameObjects.Graphics;
  private allyNameText!: Phaser.GameObjects.Text;
  private allyStatusText!: Phaser.GameObjects.Text;
  private mobileDashBtn: Phaser.GameObjects.Container | null = null;
  private waveText!: Phaser.GameObjects.Text;
  private weatherIcon!: Phaser.GameObjects.Image;
  private timerText!: Phaser.GameObjects.Text;
  private arenaHintText!: Phaser.GameObjects.Text;
  private shieldBadge!: Phaser.GameObjects.Container;
  private shieldText!: Phaser.GameObjects.Text;
  private shownWeather = -1;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private bossCrown!: Phaser.GameObjects.Image;
  private bossShown = -1;
  private bossLag = 1;
  private hpLag = 1;
  private hpFlash = 0;
  private lowHpVignette!: Phaser.GameObjects.Image;
  private edgeIndicators!: Phaser.GameObjects.Graphics;
  private pulseTime = 0;
  private heartTimer = 0;
  private weatherFx!: WeatherAmbience;
  private joystick!: VirtualJoystick;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalAction: (() => void) | null = null;
  private guideModal: GuideModalHandle | null = null;
  private paused = false;
  private padResumeDown = false;
  private banners: { text: string; color: string }[] = [];
  private bannerBusy = false;
  private shown = { hp: -1, maxHp: -1, nectar: -1, wave: -1, time: -2, xp: -1, level: -1, pending: -1 };

  constructor() {
    super('UI');
  }

  create(): void {
    setupUICamera(this);
    this.run = this.registry.get('run') as RunState;
    this.modal = null;
    this.modalAction = null;
    this.paused = false;
    this.banners = [];
    this.bannerBusy = false;
    this.heartTimer = 0;
    this.hpLag = 1;
    this.hpFlash = 0;
    this.bossLag = 1;
    this.pulseTime = 0;
    this.shown = { hp: -1, maxHp: -1, nectar: -1, wave: -1, time: -2, xp: -1, level: -1, pending: -1 };
    this.shownWeather = this.run.activeWeather;
    this.bossShown = -1;

    // 实时天气光影层 + 极轻微距前景草叶四角框景（完全不遮挡战斗视野）
    this.weatherFx = new WeatherAmbience(this, -10, this.run.activeWeather);
    this.add.image(-12, -10, 'ui-macro-grass-tl').setOrigin(0, 0).setScale(0.36).setAlpha(0.36).setDepth(-5);
    this.add.image(W + 12, -10, 'ui-macro-grass-tl').setOrigin(0, 0).setScale(-0.34, 0.34).setAlpha(0.32).setDepth(-5);
    this.add.image(W + 12, H + 12, 'ui-macro-grass-br').setOrigin(1, 1).setScale(0.38).setAlpha(0.36).setDepth(-5);
    this.add.image(-12, H + 12, 'ui-macro-grass-br').setOrigin(1, 1).setScale(-0.34, 0.34).setAlpha(0.32).setDepth(-5);

    this.buildHud();
    this.joystick = new VirtualJoystick(this);

    listen(this, EVT.PLAYER_HIT, () => {
      this.hpFlash = 1;
    });

    listen(this, EVT.WAVE_START, (n: number) => {
      this.joystick.setEnabled(true);
      this.hpLag = 1;
      this.banner(this.run.endless ? `无尽 · 第 ${n} 波` : `第 ${n} 波`, this.run.endless ? '#ffd44c' : '#f2f1ec');
    });
    listen(this, EVT.WAVE_EVENT, (text: string, color?: string) => this.banner(text, color ?? '#ffd44c'));
    listen(this, EVT.KILL_STREAK, (count: number) => this.showKillStreak(count));
    listen(this, EVT.WAVE_CLEAR, () => this.banner('撑过去了！', '#ffd44c'));
    listen(this, EVT.INTERMISSION, () => this.joystick.setEnabled(false));
    listen(this, EVT.UNLOCK, (id: string) => this.banner(`解锁新角色：${CHARACTERS[id].name}`, '#ffd44c'));
    listen(this, EVT.LEVEL_UP, () => {
      this.levelText.setScale(1.38);
      this.tweens.add({ targets: this.levelText, scale: 1, duration: 350, ease: 'Back.Out' });
    });
    listen(this, EVT.PLAYER_DEAD, () => {
      if (this.paused) this.resume(false);
      this.joystick.setEnabled(false);
      this.banner(this.run.endless ? `无尽止步第 ${this.run.wave} 波` : '被虫潮淹没了…', this.run.endless ? '#ffd44c' : '#ff5d57');
    });
    listen(this, EVT.VICTORY, () => {
      this.joystick.setEnabled(false);
      this.banner('守住了树桩！', '#ffd44c');
    });
    listen(this, EVT.VICTORY_CHOICE, () => this.openVictoryChoice());

    const kb = this.input.keyboard!;
    kb.on('keydown-P', () => {
      if (this.guideModal) this.guideModal.close();
      else this.togglePause();
    });
    kb.on('keydown-ESC', () => {
      if (this.guideModal) this.guideModal.close();
      else this.togglePause();
    });
    kb.on('keydown-ENTER', () => {
      if (!this.guideModal) this.modalAction?.();
    });

    const autoPause = () => {
      if (!coop.isCoopMatch) this.pause();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
    const onOrientation = () => {
      if (portrait.matches && !coop.isCoopMatch) this.pause();
    };
    if (portrait.addEventListener) portrait.addEventListener('change', onOrientation);
    else portrait.addListener(onOrientation);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
      if (portrait.removeEventListener) portrait.removeEventListener('change', onOrientation);
      else portrait.removeListener(onOrientation);
    });

    if (this.run.phase === 'combat') {
      this.banner(`第 ${this.run.wave} 波`);
      if (this.run.wave === 1) this.showControlHint();
    }
  }

  /** 第 1 波开局极简按键提示条（5 秒后自动淡出，不打扰战斗） */
  private showControlHint(): void {
    const text = IS_COARSE_POINTER ? '左侧摇杆移动 · 右下冲刺闪避' : 'WASD 移动 · Space/Shift 冲刺闪避 · 按住左键集火 · P 暂停';
    const hint = pill(this, W / 2, H - 30, text, 0x101218, COLOR.border, '#e8e4d8', 13, 16, 28).setDepth(25).setAlpha(0);
    this.tweens.add({
      targets: hint,
      alpha: 0.92,
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => {
        this.time.delayedCall(5000, () => {
          if (!hint.scene) return;
          this.tweens.add({
            targets: hint,
            alpha: 0,
            y: H - 18,
            duration: 500,
            ease: 'Quad.In',
            onComplete: () => hint.destroy(),
          });
        });
      },
    });
  }

  /** 瞬间清屏连破提示（极简漫画风，独立于波次横幅不排队阻塞） */
  private showKillStreak(count: number): void {
    const col = count >= 14 ? '#ff6a4c' : '#ffd44c';
    const t = this.add
      .text(W - 44, 124, `×${count} 连破！`, style(26, col))
      .setOrigin(1, 0.5)
      .setDepth(28)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      scale: 1.08,
      alpha: 1,
      duration: 150,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: t,
          y: 96,
          scale: 0.96,
          alpha: 0,
          delay: 750,
          duration: 360,
          ease: 'Quad.In',
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  update(_time: number, delta: number): void {
    const r = this.run;
    const dt = delta / 1000;
    const pad = this.input.gamepad?.pad1;
    if (this.paused && pad) {
      const resumeNow = !!(pad.buttons[9]?.pressed || pad.B || pad.buttons[1]?.pressed);
      if (resumeNow && !this.padResumeDown) {
        if (this.guideModal) this.guideModal.close();
        else this.togglePause();
      }
      this.padResumeDown = resumeNow;
    } else {
      this.padResumeDown = false;
    }
    this.pulseTime += dt;
    this.weatherFx.setVisible(r.phase !== 'intermission');
    if (r.phase !== 'intermission' && !this.paused) this.weatherFx.update(dt);
    const prevFlash = this.hpFlash;
    if (this.hpFlash > 0) this.hpFlash = Math.max(0, this.hpFlash - dt * 5.5);

    const hp = r.coopDowned ? 0 : Math.max(0, Math.ceil(r.hp));
    const hpRatio = r.maxHp > 0 ? Math.min(1, hp / r.maxHp) : 0;
    const prevLag = this.hpLag;
    if (this.hpLag > hpRatio) {
      this.hpLag = Math.max(hpRatio, this.hpLag - dt * 0.55);
    } else {
      this.hpLag = hpRatio;
    }
    const lowPulse = hpRatio < LOW_HP && r.phase === 'combat' && hp > 0;
    if (r.coopDowned || hp !== this.shown.hp || r.maxHp !== this.shown.maxHp || Math.abs(this.hpLag - prevLag) > 0.002 || lowPulse || prevFlash > 0) {
      this.shown.hp = r.coopDowned ? -1 : hp;
      this.shown.maxHp = r.maxHp;
      this.drawHp(hp, r.maxHp, hpRatio);
    }

    if (r.xp !== this.shown.xp || r.level !== this.shown.level || r.pendingLevelUps !== this.shown.pending) {
      this.shown.xp = r.xp;
      this.shown.level = r.level;
      this.shown.pending = r.pendingLevelUps;
      this.drawXp(r.xp / r.xpNeeded, r.level, r.pendingLevelUps);
    }

    if (r.nectar !== this.shown.nectar) {
      if (this.shown.nectar >= 0) this.nectarText.setScale(1.26);
      this.shown.nectar = r.nectar;
      this.nectarText.setText(String(r.nectar));
    }
    const s = this.nectarText.scale;
    if (s > 1) this.nectarText.setScale(Math.max(1, s - dt * 2.2));

    if (r.wave !== this.shown.wave || r.activeWeather !== this.shownWeather) {
      this.shown.wave = r.wave;
      this.shownWeather = r.activeWeather;
      this.weatherFx.setWeather(r.activeWeather);
      this.weatherIcon.setTexture(`weather-${r.activeWeather}`);
      const weatherName = DIFFICULTIES[r.activeWeather]?.name ?? r.difficulty.name;
      const chName = r.setup.challenge ? CHALLENGES[r.setup.challenge]?.name : '';
      const labelStr = r.endless
        ? `无尽 · 第 ${r.wave} 波 · ${weatherName}`
        : chName
          ? `${chName} · 第 ${r.wave}/${r.maxWaves} 波 · ${weatherName}`
          : `第 ${r.wave} 波 · ${weatherName}`;
      this.waveText.setText(labelStr);
      this.weatherIcon.setPosition(-this.waveText.width / 2 - 14, 24);
    }

    this.shieldBadge.setVisible(r.shield > 0 && r.phase === 'combat');
    if (r.shield > 0) this.shieldText.setText(r.shield > 1 ? `护盾×${r.shield}` : '护盾');
    this.drawDashHud(r.dashRatio, r.dashCharges, r.maxDashCharges, r.phase === 'combat');
    this.arenaHintText.setVisible(r.phase === 'combat' && !r.boss && r.arenaHint.length > 0);
    if (r.arenaHint) this.arenaHintText.setText(r.arenaHint);
    const frenzyOn = r.frenzyTime > 0 && r.phase === 'combat';
    this.frenzyBadge.setVisible(frenzyOn);
    if (frenzyOn) this.frenzyText.setText(`狂热 ${r.frenzyTime.toFixed(1)}s`);
    this.mobileDashBtn?.setVisible(r.phase === 'combat' && !this.paused);
    if (lowPulse) {
      const a = 0.22 + 0.32 * (0.5 + 0.5 * Math.sin(this.pulseTime * 7.5));
      this.lowHpVignette.setAlpha(a);
    } else if (this.lowHpVignette.alpha > 0) {
      this.lowHpVignette.setAlpha(Math.max(0, this.lowHpVignette.alpha - dt * 2.5));
    }
    this.updateBoss(dt);
    this.updateLowHp(dt);
    this.updateAllyHud();
    this.drawEdgeIndicators();

    const t = r.phase !== 'combat' ? -1 : Number.isFinite(r.waveTimeLeft) ? Math.ceil(r.waveTimeLeft) : -3;
    if (t !== this.shown.time) {
      this.shown.time = t;
      this.timerText.setText(t >= 0 ? String(t) : t === -3 ? 'BOSS' : '');
      this.timerText.setColor((t >= 0 && t <= 5) || t === -3 ? '#ff4a44' : '#f2f1ec');
      if (t >= 0 && t <= 5) {
        this.timerText.setScale(1.25);
        this.tweens.add({ targets: this.timerText, scale: 1, duration: 280, ease: 'Quad.Out' });
      }
    }
  }

  private updateLowHp(dt: number): void {
    const r = this.run;
    const k = r.maxHp > 0 ? r.hp / r.maxHp : 1;
    const low = r.phase === 'combat' && !this.paused && r.hp > 0 && k < LOW_HP;
    if (!low) {
      this.heartTimer = 0;
      return;
    }
    this.heartTimer -= dt;
    if (this.heartTimer <= 0) {
      this.heartTimer = k < CRITICAL_HP ? 0.6 : 0.9;
      sfx.play('heartbeat');
    }
  }

  private buildHud(): void {
    // 低血量边缘危机暗红平滑渐变晕影（贴合四周，无矩形接缝，不遮挡中央战场）
    if (!this.textures.exists('ui-lowhp-vignette')) {
      const tex = this.textures.createCanvas('ui-lowhp-vignette', 320, 180);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(160, 90, 92, 160, 90, 198);
        g.addColorStop(0, 'rgba(185, 16, 16, 0)');
        g.addColorStop(0.55, 'rgba(185, 16, 16, 0.14)');
        g.addColorStop(1, 'rgba(165, 10, 10, 0.62)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 320, 180);
        tex.refresh();
      }
    }
    this.lowHpVignette = this.add.image(0, 0, 'ui-lowhp-vignette').setOrigin(0).setDisplaySize(W, H).setDepth(-3).setAlpha(0);
    this.edgeIndicators = this.add.graphics().setDepth(18);

    // 左上：土豆兄弟极简硬朗血条 + 经验条 + 悬浮花蜜数（不加多余外框）
    const tl = this.add.container(0, 0).setScale(HUD_SCALE);
    this.hpBar = this.add.graphics();
    this.hpText = this.add.text(18 + 122, 31, '', style(19, '#ffffff', true)).setOrigin(0.5);
    this.xpBar = this.add.graphics();
    this.levelText = this.add.text(266, 59, '', style(17, '#8ee868', true)).setOrigin(1, 0.5);

    const shBg = this.add.graphics();
    drawChamferPlate(shBg, -4, -13, 72, 26, {
      fill: 0x1e3852,
      border: 0x74d6ff,
      borderWidth: 1.5,
      shadowX: 2,
      shadowY: 2.5,
      cutBig: 6,
      cutSmall: 3,
      inkWidth: 2.4,
    });
    const shIcon = this.add.image(9, 0, 'ui-shield').setDisplaySize(17, 17);
    this.shieldText = this.add.text(20, 0, '护盾', style(13, '#bceeff')).setOrigin(0, 0.5);
    this.shieldBadge = this.add.container(280, 31, [shBg, shIcon, this.shieldText]).setVisible(false);

    const nectarIcon = this.add.image(31, 90, 'nectar').setDisplaySize(26, 26);
    this.nectarText = this.add.text(50, 90, '0', style(28, '#ffd44c', true)).setOrigin(0, 0.5);

    // 主动冲刺充能条（轻量紧凑，位于花蜜数下方）
    this.dashBar = this.add.graphics();
    this.dashText = this.add.text(110, 121, '冲刺 [Space]', style(12, '#cfefff')).setOrigin(0, 0.5);

    // 琥珀狂热倒计时徽标
    const frBg = this.add.graphics();
    drawChamferPlate(frBg, -4, -13, 98, 26, {
      fill: 0x3b2208,
      border: 0xffd44c,
      borderWidth: 1.6,
      shadowX: 2,
      shadowY: 2.5,
      cutBig: 6,
      cutSmall: 3,
      inkWidth: 2.4,
    });
    const frIcon = this.add.image(10, 0, 'frenzy-dew').setDisplaySize(17, 17);
    this.frenzyText = this.add.text(22, 0, '狂热 5.0s', style(12, '#ffe88a', true)).setOrigin(0, 0.5);
    this.frenzyBadge = this.add.container(280, 62, [frBg, frIcon, this.frenzyText]).setVisible(false);

    // 双人联机：左上角队友迷你状态卡（血条 + 倒地救援预警 + 实时延迟）
    const allyBg = this.add.graphics();
    drawChamferPlate(allyBg, 0, 0, 196, 46, {
      fill: 0x11151d,
      fillAlpha: 0.9,
      border: 0x5cd8ff,
      borderWidth: 1.5,
      shadowX: 2,
      shadowY: 3,
      cutBig: 6,
      cutSmall: 3,
      inkWidth: 2.2,
    });
    this.allyBar = this.add.graphics();
    this.allyNameText = this.add.text(10, 9, '', style(12, '#9ceeff')).setOrigin(0, 0);
    this.allyStatusText = this.add.text(186, 9, '', style(11, '#b8d8e8', true)).setOrigin(1, 0);
    this.allyBox = this.add.container(18, 138, [allyBg, this.allyBar, this.allyNameText, this.allyStatusText]).setVisible(false);

    tl.add([this.hpBar, this.hpText, this.xpBar, this.levelText, this.shieldBadge, nectarIcon, this.nectarText, this.dashBar, this.dashText, this.frenzyBadge, this.allyBox]);

    // 移动端右下角独立冲刺大按钮
    if (IS_COARSE_POINTER) {
      const db = createButton(this, W - 92, H - 96, '冲刺', () => bus.emit(EVT.DASH_TRIGGER), {
        width: 112,
        height: 62,
        fontSize: 22,
        variant: 'emerald',
      }).setDepth(30);
      this.mobileDashBtn = db;
    }

    // 顶部中间：干净波次标题 + 大号倒计时 + Boss 血条
    const tc = this.add.container(W / 2, 0).setScale(HUD_SCALE);
    this.weatherIcon = this.add.image(0, 24, `weather-${this.run.setup.difficulty}`).setDisplaySize(22, 22);
    this.waveText = this.add.text(8, 24, '', style(20, '#f2f1ec')).setOrigin(0.5);
    this.timerText = this.add.text(0, 42, '', style(48, '#f2f1ec', true)).setOrigin(0.5, 0);
    this.arenaHintText = this.add.text(0, 102, '', style(13, '#aeeeff')).setOrigin(0.5, 0.5).setVisible(false);
    this.bossBar = this.add.graphics();
    this.bossName = this.add.text(10, 102, '', style(18, '#ffe0c8')).setOrigin(0.5, 0.5).setVisible(false);
    this.bossCrown = this.add.image(0, 102, 'ui-crown').setDisplaySize(22, 22).setVisible(false);
    tc.add([this.weatherIcon, this.waveText, this.timerText, this.arenaHintText, this.bossBar, this.bossCrown, this.bossName]);

    // 右上：八角机械键帽暂停键
    const pg = this.add.graphics();
    const drawPause = (state: 'idle' | 'hover' | 'down') => {
      const hover = state === 'hover';
      const oy = state === 'down' ? 3 : hover ? -1 : 0;
      drawKeycap(pg, {
        w: 46,
        h: 44,
        shape: 'notch',
        bg: hover ? 0xf0efe9 : 0x252730,
        lip: hover ? 0x8e8d87 : 0x121318,
        border: hover ? 0x050507 : 0x5c606e,
        lipH: 4,
        ox: 0,
        oy,
        lightBevel: !hover,
      });
      const fg = hover ? 0x121316 : 0xf2f1ec;
      pg.fillStyle(fg, 1);
      pg.fillRect(-7.5, -9 + oy, 5, 18);
      pg.fillRect(2.5, -9 + oy, 5, 18);
    };
    drawPause('idle');
    const btn = this.add
      .container(W - 40 * HUD_SCALE, 38 * HUD_SCALE, [pg])
      .setScale(HUD_SCALE)
      .setSize(56, 56)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => drawPause('hover'));
    btn.on('pointerout', () => drawPause('idle'));
    btn.on('pointerdown', () => drawPause('down'));
    btn.on('pointerup', () => {
      drawPause('hover');
      this.togglePause();
    });
  }

  private fillBarSlice(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    cBig: number,
    cSmall: number,
    color: number,
    highlightAlpha = 0.2,
    shadeAlpha = 0.22,
  ): number {
    const fw = Math.max(cBig + 4, Math.round(w * Math.min(1, ratio)));
    const rightBig = fw >= w - cSmall ? cSmall : 1;
    const pts = chamferPoints(x, y, fw, h, cBig, rightBig, cBig, rightBig);
    fillPoly(g, pts, color, 1);
    if (highlightAlpha > 0) {
      fillPoly(
        g,
        [
          { x: x + cBig, y: y + 1 },
          { x: x + fw - rightBig, y: y + 1 },
          { x: x + fw - 1, y: y + Math.min(6, Math.round(h * 0.26)) },
          { x: x + 2, y: y + Math.min(6, Math.round(h * 0.26)) },
        ],
        0xffffff,
        highlightAlpha,
      );
    }
    if (shadeAlpha > 0) {
      fillPoly(
        g,
        [
          { x: x + 2, y: y + h - Math.min(5, Math.round(h * 0.2)) },
          { x: x + fw - 1, y: y + h - Math.min(5, Math.round(h * 0.2)) },
          { x: x + fw - rightBig, y: y + h - 1 },
          { x: x + cBig, y: y + h - 1 },
        ],
        0x000000,
        shadeAlpha,
      );
    }
    return fw;
  }

  private drawHp(hp: number, max: number, k: number): void {
    const g = this.hpBar;
    const x = 18;
    const y = 18;
    const w = 244;
    const h = 26;
    g.clear();

    const low = k < LOW_HP && hp > 0;
    const borderCol = low ? 0xff4c42 : COLOR.ink;
    const borderAlpha = low ? 0.65 + 0.35 * Math.sin(this.pulseTime * 9) : 1;
    const pts = chamferPoints(x, y, w, h, 6, 3, 6, 3);

    // 硬投影与暗红凹槽底
    fillPoly(g, chamferPoints(x + 3, y + 4, w, h, 6, 3, 6, 3), COLOR.ink, 0.94);
    fillPoly(g, pts, 0x261012, 1);

    if (this.hpLag > k + 0.005) {
      fillPoly(g, chamferPoints(x + 1, y + 1, Math.max(10, (w - 2) * this.hpLag), h - 2, 5, 2, 5, 2), 0xf2e4c4, 0.85);
    }

    const downed = this.run.coopDowned && this.run.phase === 'combat';
    if (downed) {
      if (this.run.coopRevivePct > 0.01) {
        this.fillBarSlice(g, x + 1, y + 1, w - 2, h - 2, this.run.coopRevivePct, 5, 2, 0x5de862);
      }
      strokePoly(g, pts, 3, 0xff5a52, 0.7 + 0.3 * Math.sin(this.pulseTime * 10));
      this.hpText.setText(this.run.coopRevivePct > 0.01 ? `救援中 ${Math.round(this.run.coopRevivePct * 100)}%` : '倒地 · 等待救援');
      return;
    }

    if (k > 0) {
      const fillW = this.fillBarSlice(g, x + 1, y + 1, w - 2, h - 2, k, 5, 2, low ? 0xff362c : 0xd63430);
      // 极轻版画斜纹纹理
      g.lineStyle(1.5, 0x000000, 0.14);
      for (let sx = x + 12; sx < x + fillW - 4; sx += 14) {
        g.beginPath();
        g.moveTo(sx + 5, y + 3);
        g.lineTo(sx - 3, y + h - 3);
        g.strokePath();
      }
      if (this.hpFlash > 0) {
        fillPoly(g, chamferPoints(x + 1, y + 1, fillW, h - 2, 5, 2, 5, 2), 0xffffff, this.hpFlash * 0.65);
      }
    }

    strokePoly(g, pts, 3, this.hpFlash > 0.3 ? 0xffffff : borderCol, borderAlpha);
    this.hpText.setText(`${hp} / ${max}`);
  }

  private updateBoss(dt: number): void {
    const b = this.run.boss;
    const k = b && this.run.phase === 'combat' ? Math.max(0, b.hp / b.maxHp) : -1;
    if (k < 0) {
      this.bossLag = 1;
    } else if (this.bossLag > k) {
      this.bossLag = Math.max(k, this.bossLag - dt * 0.35);
    } else {
      this.bossLag = k;
    }
    const shown = Math.round(k * 400) + Math.round(this.bossLag * 400) * 1000;
    if (shown === this.bossShown) return;
    this.bossShown = shown;
    const g = this.bossBar;
    g.clear();
    const visible = k >= 0 && !!b;
    this.bossName.setVisible(visible);
    this.bossCrown.setVisible(visible);
    if (!visible || !b) return;

    this.bossName.setText(b.name);
    this.bossCrown.setPosition(-this.bossName.width / 2 - 8, 102);

    const w = 520;
    const x = -w / 2;
    const y = 116;
    const h = 20;
    const pts = chamferPoints(x, y, w, h, 6, 3, 6, 3);
    fillPoly(g, chamferPoints(x + 3, y + 4, w, h, 6, 3, 6, 3), COLOR.ink, 0.94);
    fillPoly(g, pts, 0x260f11, 1);

    if (this.bossLag > k + 0.004) {
      fillPoly(g, chamferPoints(x + 1, y + 1, Math.max(10, (w - 2) * this.bossLag), h - 2, 5, 2, 5, 2), 0xf2e4c4, 0.85);
    }
    if (k > 0) {
      this.fillBarSlice(g, x + 1, y + 1, w - 2, h - 2, k, 5, 2, k < 0.5 ? 0xff4a30 : 0xd43028);
    }
    const drawPhaseMark = (ratio: number, col: number) => {
      const mx = x + w * ratio;
      g.fillStyle(col, 1);
      g.fillRect(mx - 1.5, y - 2, 3, h + 4);
      fillPoly(
        g,
        [
          { x: mx, y: y - 5 },
          { x: mx + 4, y: y - 1 },
          { x: mx, y: y + 3 },
          { x: mx - 4, y: y - 1 },
        ],
        col,
        1,
      );
    };
    drawPhaseMark(0.5, 0xffd44c);
    if (this.run.difficulty.bossPhase3) {
      drawPhaseMark(0.3, 0x74d6ff);
    }
    strokePoly(g, pts, 3, COLOR.ink, 1);
  }

  private drawXp(k: number, level: number, pending: number): void {
    const g = this.xpBar;
    const x = 18;
    const y = 52;
    const w = 186;
    const h = 13;
    g.clear();
    const pts = chamferPoints(x, y, w, h, 4, 2, 4, 2);
    fillPoly(g, chamferPoints(x + 2, y + 3, w, h, 4, 2, 4, 2), COLOR.ink, 0.92);
    fillPoly(g, pts, 0x161c18, 1);
    if (k > 0) {
      this.fillBarSlice(g, x + 1, y + 1, w - 2, h - 2, k, 3, 1.5, 0x4ad858, 0.32, 0.14);
    }
    strokePoly(g, pts, 2.5, COLOR.ink, 1);
    this.levelText.setText(pending > 0 ? `LV.${level} ▲${pending}` : `LV.${level}`);
    this.levelText.setColor(pending > 0 ? '#ffd44c' : '#8ee868');
  }

  private drawDashHud(ratio: number, charges: number, maxCharges: number, visible: boolean): void {
    const g = this.dashBar;
    g.clear();
    this.dashText.setVisible(visible);
    if (!visible) return;
    const x = 18;
    const y = 116;
    const w = 86;
    const h = 10;
    const ready = charges > 0;
    const pts = chamferPoints(x, y, w, h, 3, 2, 3, 2);
    fillPoly(g, chamferPoints(x + 2, y + 2, w, h, 3, 2, 3, 2), COLOR.ink, 0.9);
    fillPoly(g, pts, 0x121b22, 1);
    const displayRatio = charges >= maxCharges ? 1 : ratio;
    if (displayRatio > 0.02) {
      this.fillBarSlice(g, x + 1, y + 1, w - 2, h - 2, displayRatio, 2, 1, ready ? 0x62e8ff : 0x3b7b9e, 0.28, 0.14);
    }
    strokePoly(g, pts, 2.2, COLOR.ink, 1);
    const chargeTag = maxCharges > 1 ? ` ×${charges}/${maxCharges}` : '';
    this.dashText.setText(ready ? (IS_COARSE_POINTER ? `冲刺${chargeTag}` : `冲刺${chargeTag} [Space]`) : '充能中');
    this.dashText.setColor(ready ? '#a8f4ff' : '#808896');
  }

  /** 硬朗斜切战旗横幅（滑入定格 + 两侧速度斜杠） */
  private banner(text: string, color = '#f2f1ec'): void {
    this.banners.push({ text, color });
    if (this.banners.length > MAX_BANNERS) this.banners.shift();
    if (!this.bannerBusy) this.nextBanner();
  }

  private nextBanner(): void {
    const b = this.banners.shift();
    if (!b) {
      this.bannerBusy = false;
      return;
    }
    this.bannerBusy = true;
    const t = this.add.text(0, 0, b.text, style(44, b.color)).setOrigin(0.5);
    const rw = Math.max(300, t.width + 96);
    const rh = 68;
    const ribbon = this.add.graphics();
    const accentNum = Phaser.Display.Color.HexStringToColor(b.color).color;
    fillPoly(ribbon, slantPoints(-rw / 2 + 5, -rh / 2 + 6, rw, rh, 18), COLOR.ink, 0.94);
    const facePts = slantPoints(-rw / 2, -rh / 2, rw, rh, 18);
    fillPoly(ribbon, facePts, 0x1d1e25, 0.98);
    // 左右速度感斜杠装饰
    const slash = (sx: number, w: number, a: number) =>
      fillPoly(
        ribbon,
        [
          { x: sx + 7, y: -rh / 2 + 5 },
          { x: sx + 7 + w, y: -rh / 2 + 5 },
          { x: sx - 7 + w, y: rh / 2 - 5 },
          { x: sx - 7, y: rh / 2 - 5 },
        ],
        accentNum,
        a,
      );
    slash(-rw / 2 + 20, 7, 0.85);
    slash(-rw / 2 + 32, 3.5, 0.5);
    slash(rw / 2 - 26, 7, 0.85);
    slash(rw / 2 - 36, 3.5, 0.5);
    strokePoly(ribbon, facePts, 3, COLOR.ink, 1);

    const wrap = this.add
      .container(W / 2 - 48, H * 0.28, [ribbon, t])
      .setScale(1.16 * HUD_SCALE)
      .setAlpha(0)
      .setDepth(50);

    const hold = this.banners.length > 0 ? 620 : 1080;
    this.tweens.add({ targets: wrap, x: W / 2, scale: HUD_SCALE, alpha: 1, duration: 210, ease: 'Back.Out' });
    this.tweens.add({
      targets: wrap,
      alpha: 0,
      x: W / 2 + 44,
      delay: hold,
      duration: 240,
      ease: 'Quad.In',
      onComplete: () => {
        wrap.destroy();
        this.nextBanner();
      },
    });
  }

  // ---------- 弹窗 ----------

  private openModal(
    title: string,
    ph: number,
    build: (c: Phaser.GameObjects.Container, top: number, px: number, pw: number) => void,
    enter: () => void,
    pw = 580,
  ): void {
    this.closeModal();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    const px = W / 2 - pw / 2;
    const top = H / 2 - ph / 2;
    const bg = panel(this, px, top, pw, ph, COLOR.border, COLOR.panel, 2, COLOR.gold);
    const titleText = displayLabel(this, W / 2, top + 44, title, 34, COLOR.text).setOrigin(0.5);
    const div = divider(this, px + 32, top + 76, pw - 64);
    c.add([dim, bg, titleText, div]);
    build(c, top, px, pw);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 130 });
    this.modal = c;
    this.modalAction = enter;
    this.joystick.setEnabled(false);
  }

  private closeModal(): void {
    this.guideModal?.close();
    this.guideModal = null;
    this.modal?.destroy();
    this.modal = null;
    this.modalAction = null;
    this.joystick.setEnabled(true);
  }

  private updateAllyHud(): void {
    const ally = this.run.coopTeammate;
    const show = !!ally && (this.run.phase === 'combat' || this.run.phase === 'cleanup');
    this.allyBox.setVisible(show);
    if (!show || !ally) return;
    this.allyNameText.setText(ally.name);
    const rtt = coop.rttMs > 0 ? `${coop.rttMs}ms` : 'P2P';
    if (ally.downed) {
      this.allyStatusText.setText(ally.revivePct > 0 ? `救援 ${Math.round(ally.revivePct * 100)}%` : '⚠ 倒地').setColor('#ff7870');
    } else {
      this.allyStatusText.setText(`${ally.hp}/${ally.maxHp} · ${rtt}`).setColor('#b8f0d0');
    }
    const g = this.allyBar;
    g.clear();
    const bx = 10;
    const by = 29;
    const bw = 176;
    const bh = 9;
    g.fillStyle(0x0b0e14, 1);
    g.fillRect(bx, by, bw, bh);
    if (ally.downed) {
      g.fillStyle(0x74ea78, 0.95);
      g.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * ally.revivePct), bh - 2);
    } else {
      const ratio = ally.maxHp > 0 ? Math.max(0, Math.min(1, ally.hp / ally.maxHp)) : 0;
      g.fillStyle(ratio < 0.3 ? 0xff5a52 : 0x5cd8ff, 1);
      g.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * ratio), bh - 2);
    }
    g.lineStyle(1.4, 0x050507, 1);
    g.strokeRect(bx, by, bw, bh);
  }

  /** 屏幕边缘方向指示箭头：指引镜头外的宝藏虫、精英、Boss、宝箱与队友 */
  private drawEdgeIndicators(): void {
    const g = this.edgeIndicators;
    g.clear();
    const markers = this.run.offscreenMarkers;
    if (this.run.phase !== 'combat' || markers.length === 0) return;
    const gameScene = this.scene.isActive('Game') ? this.scene.get('Game') : this.scene.get('CoopGuest');
    const cam = gameScene?.cameras?.main;
    if (!cam) return;
    const view = cam.worldView;
    const cxWorld = view.centerX;
    const cyWorld = view.centerY;
    const margin = 36;
    const halfW = W / 2 - margin;
    const halfH = H / 2 - margin;
    const pulse = 0.85 + 0.15 * Math.sin(this.pulseTime * 8);

    for (const m of markers) {
      const dx = m.x - cxWorld;
      const dy = m.y - cyWorld;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const tx = Math.abs(ux) > 1e-4 ? halfW / Math.abs(ux) : Infinity;
      const ty = Math.abs(uy) > 1e-4 ? halfH / Math.abs(uy) : Infinity;
      const t = Math.min(tx, ty);
      const sx = W / 2 + ux * t;
      const sy = H / 2 + uy * t;
      const ang = Math.atan2(uy, ux);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const pa = -sa;
      const pb = ca;
      const isDanger = m.kind === 'elite' || m.kind === 'boss' || m.kind === 'ally_down';
      const fillCol =
        m.kind === 'ally'
          ? 0x5cd8ff
          : isDanger
            ? 0xff463e
            : m.kind === 'lootbug'
              ? 0xffd44c
              : m.kind === 'bloom'
                ? 0xffe458
                : 0x62e878;
      const sz = (m.kind === 'boss' || m.kind === 'bloom' || m.kind === 'ally_down' ? 14 : 11) * pulse;
      const tipX = sx + ca * sz;
      const tipY = sy + sa * sz;
      const backX = sx - ca * (sz * 0.7);
      const backY = sy - sa * (sz * 0.7);
      const wing = sz * 0.72;
      const pts = [
        { x: tipX, y: tipY },
        { x: backX + pa * wing, y: backY + pb * wing },
        { x: sx - ca * (sz * 0.2), y: sy - sa * (sz * 0.2) },
        { x: backX - pa * wing, y: backY - pb * wing },
      ];
      fillPoly(g, pts, fillCol, 0.95);
      strokePoly(g, pts, 2.8, COLOR.ink, 1);
      // 中心亮芯点
      g.fillStyle(0xffffff, 0.92);
      g.fillCircle(sx + ca * (sz * 0.15), sy + sa * (sz * 0.15), 2.4);
    }
  }

  private openVictoryChoice(): void {
    this.openModal(
      '守住了树桩！',
      310,
      (c, top) => {
        c.add(
          this.add
            .text(W / 2, top + 114, '第 20 波通关！你可以立刻结算，或继续挑战第 21 波无尽虫潮。', {
              fontFamily: FONT_FAMILY,
              fontSize: '18px',
              fontStyle: 'bold',
              color: '#d8d9e2',
            })
            .setOrigin(0.5),
        );
        c.add(
          createButton(
            this,
            W / 2,
            top + 184,
            '进入无尽模式 ▶ 第 21 波',
            () => {
              this.closeModal();
              bus.emit(EVT.CONTINUE_ENDLESS);
            },
            { width: 320, height: 58, fontSize: 22 },
          ),
        );
        c.add(
          createButton(
            this,
            W / 2,
            top + 256,
            '凯旋结算',
            () => {
              this.closeModal();
              bus.emit(EVT.FINISH_RUN);
            },
            { width: 220, height: 48, fontSize: 20, primary: false },
          ),
        );
      },
      () => {
        this.closeModal();
        bus.emit(EVT.CONTINUE_ENDLESS);
      },
    );
  }

  // ---------- 暂停 ----------

  get isPaused(): boolean {
    return this.paused;
  }

  showCoopDisconnected(reason = '与房主的联机已断开'): void {
    this.paused = true;
    bgm.setPaused(true);
    this.openModal(
      '联机已断开',
      268,
      (c, top) => {
        c.add(
          this.add
            .text(W / 2, top + 124, reason, {
              fontFamily: FONT_FAMILY,
              fontSize: '18px',
              fontStyle: 'bold',
              color: '#ff9c94',
            })
            .setOrigin(0.5),
        );
        c.add(
          createButton(this, W / 2, top + 206, '返回主菜单', () => this.toMenu(), {
            width: 240,
            height: 54,
            fontSize: 20,
          }),
        );
      },
      () => this.toMenu(),
      500,
    );
  }

  private canPause(): boolean {
    return this.run.phase === 'combat' || this.run.phase === 'cleanup';
  }

  applyRemotePause(nextPaused: boolean): void {
    if (nextPaused && !this.paused) this.pause(false);
    else if (!nextPaused && this.paused) this.resume(false);
  }

  private togglePause(): void {
    if (this.paused) this.resume(true);
    else this.pause(true);
  }

  private pause(broadcast = true): void {
    if (this.paused || !this.canPause()) return;
    this.paused = true;
    bgm.setPaused(true);
    if (this.scene.isActive('Game')) this.scene.pause('Game');
    if (broadcast && coop.isCoopMatch) {
      coop.send({ type: 'pause_state', paused: true, by: coop.role === 'host' ? 'host' : 'guest' });
    }
    const r = this.run;
    this.openModal(
      '游戏已暂停',
      568,
      (c, top, px) => {
        const leftCx = px + 296;
        c.add(
          pill(
            this,
            leftCx,
            top + 86,
            coop.isCoopMatch ? `🤝 房间 ${coop.roomCode} · ${r.biome.name}` : `${r.biome.name} · 种子 #${r.seed}`,
            COLOR.panelDeep,
            r.biome.accent,
            r.biome.css,
            12,
            12,
            22,
          ),
        );
        c.add(createButton(this, leftCx - 102, top + 130, '继续战斗', () => this.resume(true), { width: 280, height: 50 }));
        c.add(
          createButton(
            this,
            leftCx + 150,
            top + 130,
            '📖 机制速查',
            () => {
              if (this.guideModal) return;
              this.guideModal = openMechanicsGuide(this, {
                initialTab: 'combat',
                depth: 140,
                onClose: () => {
                  this.guideModal = null;
                },
              });
            },
            { width: 196, height: 50, fontSize: 18, primary: false, variant: 'emerald' },
          ),
        );
        c.add(
          createButton(this, leftCx - 134, top + 194, coop.isCoopMatch ? '返回大厅' : '重新开始', () => (coop.isCoopMatch ? this.toCoopLobby() : this.restart()), {
            width: 238,
            height: 46,
            fontSize: 19,
            primary: false,
          }),
        );
        c.add(createButton(this, leftCx + 134, top + 194, '放弃本局', () => this.toMenu(), { width: 238, height: 46, fontSize: 19, primary: false }));
        addSettingsButtons(this, c, leftCx, top + 258);

        // 左侧底部：当前局内构筑预览（武器槽 + 激活羁绊）
        const buildY = top + 412;
        c.add(divider(this, px + 30, buildY, 532, COLOR.border, 0.6));
        c.add(label(this, px + 32, buildY + 18, `当前配装 (${r.weapons.length}/${r.weaponSlots})`, 14, COLOR.dim, true).setOrigin(0, 0.5));
        const slotSz = 48;
        const step = Math.min(58, Math.floor(350 / Math.max(1, r.weapons.length)));
        r.weapons.forEach((w, idx) => {
          const def = WEAPONS[w.id];
          if (!def) return;
          const sx = px + 56 + idx * step;
          const sy = buildY + 62;
          c.add(slotBox(this, sx, sy, slotSz, TIERS[w.tier].color, w.tier >= 2, w.tier));
          const img = this.add.image(sx, sy - 2, weaponTex(def.icon, w.tier, true));
          img.setScale((slotSz - 12) / Math.max(img.width, img.height));
          c.add(img);
        });
        const sets = activeSets(r.weapons);
        let sy = buildY + 46;
        for (const st of sets.slice(0, 3)) {
          const ts = CLASS_STYLE[st.cls];
          const p = pill(this, px + 494, sy, `${CLASS_LABEL[st.cls]}×${st.count}`, ts.bg, ts.border, ts.text, 12, 8, 22);
          c.add(p);
          sy += 26;
        }

        // 右侧：实时战斗属性面板（随时查看闪避/暴击/移速/护甲）
        const sp = createStatsPanel(this, px + 586, top + 90, 252, 462, r.stats);
        c.add(sp.container);
      },
      () => this.resume(),
      868,
    );
  }

  private resume(broadcast = true): void {
    if (!this.paused) return;
    this.paused = false;
    bgm.setPaused(false);
    this.closeModal();
    if (this.scene.isPaused('Game')) this.scene.resume('Game');
    if (broadcast && coop.isCoopMatch) {
      coop.send({ type: 'pause_state', paused: false, by: coop.role === 'host' ? 'host' : 'guest' });
    }
  }

  private restart(): void {
    bgm.setPaused(false);
    this.scene.stop('Game');
    this.scene.start('Game');
  }

  private toCoopLobby(): void {
    this.paused = false;
    bgm.setPaused(false);
    if (coop.isCoopMatch && coop.state === 'connected') {
      coop.send({ type: 'return_lobby' });
    }
    if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
    this.scene.stop('Game');
    this.scene.stop('CoopGuest');
    this.scene.start('CoopLobby');
  }

  private toMenu(): void {
    this.paused = false;
    bgm.setPaused(false);
    if (coop.isCoopMatch) coop.disconnect();
    if (this.scene.isActive('Intermission')) this.scene.stop('Intermission');
    this.scene.stop('Game');
    this.scene.stop('CoopGuest');
    this.scene.start('Menu');
  }
}
