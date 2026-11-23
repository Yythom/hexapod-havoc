import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, HUD_SCALE, NUM_FONT } from '../config';
import { EVT, listen } from '../core/bus';
import type { RunState } from '../core/RunState';
import { CHARACTERS } from '../data/characters';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton, drawKeycap } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import { addSettingsButtons } from '../ui/settingsButtons';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { COLOR, displayLabel, divider, panel } from '../ui/widgets';

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
  private waveText!: Phaser.GameObjects.Text;
  private weatherIcon!: Phaser.GameObjects.Image;
  private timerText!: Phaser.GameObjects.Text;
  private shieldBadge!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private bossCrown!: Phaser.GameObjects.Image;
  private bossShown = -1;
  private bossLag = 1;
  private hpLag = 1;
  private hpFlash = 0;
  private pulseTime = 0;
  private heartTimer = 0;
  private weatherFx!: WeatherAmbience;
  private joystick!: VirtualJoystick;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalAction: (() => void) | null = null;
  private paused = false;
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
    this.bossShown = -1;

    // 实时天气光影层 + 极轻微距前景草叶四角框景（完全不遮挡战斗视野）
    this.weatherFx = new WeatherAmbience(this, -10, this.run.setup.difficulty);
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
      this.banner(`第 ${n} 波`);
    });
    listen(this, EVT.WAVE_CLEAR, () => this.banner('撑过去了！', '#ffd44c'));
    listen(this, EVT.INTERMISSION, () => this.joystick.setEnabled(false));
    listen(this, EVT.UNLOCK, (id: string) => this.banner(`解锁新角色：${CHARACTERS[id].name}`, '#ffd44c'));
    listen(this, EVT.LEVEL_UP, () => {
      this.levelText.setScale(1.38);
      this.tweens.add({ targets: this.levelText, scale: 1, duration: 350, ease: 'Back.Out' });
    });
    listen(this, EVT.PLAYER_DEAD, () => {
      this.joystick.setEnabled(false);
      this.banner('被虫潮淹没了…', '#ff5d57');
    });
    listen(this, EVT.VICTORY, () => {
      this.joystick.setEnabled(false);
      this.banner('守住了！', '#ffd44c');
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-ENTER', () => this.modalAction?.());

    const autoPause = () => this.pause();
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
    const onOrientation = () => {
      if (portrait.matches) this.pause();
    };
    portrait.addEventListener('change', onOrientation);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
      portrait.removeEventListener('change', onOrientation);
    });

    if (this.run.phase === 'combat') this.banner(`第 ${this.run.wave} 波`);
  }

  update(_time: number, delta: number): void {
    const r = this.run;
    const dt = delta / 1000;
    this.pulseTime += dt;
    this.weatherFx.setVisible(r.phase !== 'intermission');
    if (r.phase !== 'intermission' && !this.paused) this.weatherFx.update(dt);
    const prevFlash = this.hpFlash;
    if (this.hpFlash > 0) this.hpFlash = Math.max(0, this.hpFlash - dt * 5.5);

    const hp = Math.max(0, Math.ceil(r.hp));
    const hpRatio = r.maxHp > 0 ? Math.min(1, hp / r.maxHp) : 0;
    const prevLag = this.hpLag;
    if (this.hpLag > hpRatio) {
      this.hpLag = Math.max(hpRatio, this.hpLag - dt * 0.55);
    } else {
      this.hpLag = hpRatio;
    }
    const lowPulse = hpRatio < LOW_HP && r.phase === 'combat' && hp > 0;
    if (hp !== this.shown.hp || r.maxHp !== this.shown.maxHp || Math.abs(this.hpLag - prevLag) > 0.002 || lowPulse || prevFlash > 0) {
      this.shown.hp = hp;
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

    if (r.wave !== this.shown.wave) {
      this.shown.wave = r.wave;
      this.waveText.setText(`第 ${r.wave} 波 · ${r.difficulty.name}`);
      this.weatherIcon.setPosition(-this.waveText.width / 2 - 14, 24);
    }

    this.shieldBadge.setVisible(r.shield > 0 && r.phase === 'combat');
    this.updateBoss(dt);
    this.updateLowHp(dt);

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
    // 左上：土豆兄弟极简硬朗血条 + 经验条 + 悬浮花蜜数（不加多余外框）
    const tl = this.add.container(0, 0).setScale(HUD_SCALE);
    this.hpBar = this.add.graphics();
    this.hpText = this.add.text(18 + 122, 31, '', style(19, '#ffffff', true)).setOrigin(0.5);
    this.xpBar = this.add.graphics();
    this.levelText = this.add.text(266, 59, '', style(17, '#8ee868', true)).setOrigin(1, 0.5);

    const shBg = this.add.graphics();
    shBg.fillStyle(COLOR.ink, 0.92);
    shBg.fillRoundedRect(-2, -11, 70, 26, 5);
    shBg.fillStyle(0x1e3852, 1);
    shBg.fillRoundedRect(-4, -13, 70, 26, 5);
    shBg.lineStyle(2.4, COLOR.ink, 1);
    shBg.strokeRoundedRect(-4, -13, 70, 26, 5);
    const shIcon = this.add.image(9, 0, 'ui-shield').setDisplaySize(17, 17);
    const shTxt = this.add.text(20, 0, '护盾', style(13, '#bceeff')).setOrigin(0, 0.5);
    this.shieldBadge = this.add.container(280, 31, [shBg, shIcon, shTxt]).setVisible(false);

    const nectarIcon = this.add.image(31, 90, 'nectar').setDisplaySize(26, 26);
    this.nectarText = this.add.text(50, 90, '0', style(28, '#ffd44c', true)).setOrigin(0, 0.5);

    tl.add([this.hpBar, this.hpText, this.xpBar, this.levelText, this.shieldBadge, nectarIcon, this.nectarText]);

    // 顶部中间：干净波次标题 + 大号倒计时 + Boss 血条
    const tc = this.add.container(W / 2, 0).setScale(HUD_SCALE);
    this.weatherIcon = this.add.image(0, 24, `weather-${this.run.setup.difficulty}`).setDisplaySize(22, 22);
    this.waveText = this.add.text(8, 24, '', style(20, '#f2f1ec')).setOrigin(0.5);
    this.timerText = this.add.text(0, 42, '', style(48, '#f2f1ec', true)).setOrigin(0.5, 0);
    this.bossBar = this.add.graphics();
    this.bossName = this.add.text(10, 102, '', style(18, '#ffe0c8')).setOrigin(0.5, 0.5).setVisible(false);
    this.bossCrown = this.add.image(0, 102, 'ui-crown').setDisplaySize(22, 22).setVisible(false);
    tc.add([this.weatherIcon, this.waveText, this.timerText, this.bossBar, this.bossCrown, this.bossName]);

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

    // 硬投影
    g.fillStyle(COLOR.ink, 0.94);
    g.fillRoundedRect(x + 3, y + 4, w, h, 5);
    g.fillStyle(0x281214, 1);
    g.fillRoundedRect(x, y, w, h, 5);

    if (this.hpLag > k + 0.005) {
      g.fillStyle(0xf2e4c4, 0.85);
      g.fillRoundedRect(x, y, Math.max(8, w * this.hpLag), h, 5);
    }

    if (k > 0) {
      const fillW = Math.max(10, w * k);
      g.fillStyle(low ? 0xff362c : 0xd63430, 1);
      g.fillRoundedRect(x, y, fillW, h, 5);
      // 极轻版画斜纹纹理
      g.lineStyle(1.5, 0x000000, 0.14);
      for (let sx = x + 10; sx < x + fillW - 4; sx += 14) {
        g.beginPath();
        g.moveTo(sx + 6, y + 2);
        g.lineTo(sx - 4, y + h - 2);
        g.strokePath();
      }
      if (this.hpFlash > 0) {
        g.fillStyle(0xffffff, this.hpFlash * 0.65);
        g.fillRoundedRect(x, y, fillW, h, 5);
      }
    }

    g.lineStyle(3, this.hpFlash > 0.3 ? 0xffffff : borderCol, borderAlpha);
    g.strokeRoundedRect(x, y, w, h, 5);
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
    g.fillStyle(COLOR.ink, 0.94);
    g.fillRoundedRect(x + 3, y + 4, w, h, 5);
    g.fillStyle(0x281012, 1);
    g.fillRoundedRect(x, y, w, h, 5);

    if (this.bossLag > k + 0.004) {
      g.fillStyle(0xf2e4c4, 0.85);
      g.fillRoundedRect(x, y, Math.max(10, w * this.bossLag), h, 5);
    }
    if (k > 0) {
      const fw = Math.max(12, w * k);
      g.fillStyle(k < 0.5 ? 0xff4a30 : 0xd43028, 1);
      g.fillRoundedRect(x, y, fw, h, 5);
    }
    g.fillStyle(0xffd44c, 1);
    g.fillRect(x + w * 0.5 - 1, y - 2, 3, h + 4);
    if (this.run.difficulty.bossPhase3) {
      g.fillStyle(0x74d6ff, 1);
      g.fillRect(x + w * 0.3 - 1, y - 2, 3, h + 4);
    }
    g.lineStyle(3, COLOR.ink, 1);
    g.strokeRoundedRect(x, y, w, h, 5);
  }

  private drawXp(k: number, level: number, pending: number): void {
    const g = this.xpBar;
    const x = 18;
    const y = 52;
    const w = 186;
    const h = 13;
    g.clear();
    g.fillStyle(COLOR.ink, 0.92);
    g.fillRoundedRect(x + 2, y + 3, w, h, 4);
    g.fillStyle(0x161c18, 1);
    g.fillRoundedRect(x, y, w, h, 4);
    if (k > 0) {
      const fw = Math.max(6, w * Math.min(1, k));
      g.fillStyle(0x4ad858, 1);
      g.fillRoundedRect(x, y, fw, h, 4);
    }
    g.lineStyle(2.5, COLOR.ink, 1);
    g.strokeRoundedRect(x, y, w, h, 4);
    this.levelText.setText(pending > 0 ? `LV.${level} ▲${pending}` : `LV.${level}`);
    this.levelText.setColor(pending > 0 ? '#ffd44c' : '#8ee868');
  }

  /** 硬朗漫画横幅 */
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
    const rw = Math.max(280, t.width + 80);
    const rh = 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(COLOR.ink, 0.94);
    ribbon.fillRoundedRect(-rw / 2 + 5, -rh / 2 + 6, rw, rh, 8);
    ribbon.fillStyle(0x1d1e24, 0.96);
    ribbon.fillRoundedRect(-rw / 2, -rh / 2, rw, rh, 8);
    ribbon.lineStyle(3, COLOR.ink, 1);
    ribbon.strokeRoundedRect(-rw / 2, -rh / 2, rw, rh, 8);

    const wrap = this.add
      .container(W / 2, H * 0.28, [ribbon, t])
      .setScale(1.28 * HUD_SCALE)
      .setAlpha(0)
      .setDepth(50);

    const hold = this.banners.length > 0 ? 650 : 1100;
    this.tweens.add({ targets: wrap, scale: HUD_SCALE, alpha: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({
      targets: wrap,
      alpha: 0,
      y: wrap.y - 24,
      delay: hold,
      duration: 280,
      onComplete: () => {
        wrap.destroy();
        this.nextBanner();
      },
    });
  }

  // ---------- 弹窗 ----------

  private openModal(title: string, ph: number, build: (c: Phaser.GameObjects.Container, top: number) => void, enter: () => void): void {
    this.closeModal();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    const pw = 580;
    const px = W / 2 - pw / 2;
    const top = H / 2 - ph / 2;
    const bg = panel(this, px, top, pw, ph, COLOR.border, COLOR.panel, 2, COLOR.gold);
    const titleText = displayLabel(this, W / 2, top + 44, title, 34, COLOR.text).setOrigin(0.5);
    const div = divider(this, px + 32, top + 76, pw - 64);
    c.add([dim, bg, titleText, div]);
    build(c, top);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 130 });
    this.modal = c;
    this.modalAction = enter;
    this.joystick.setEnabled(false);
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    this.modalAction = null;
    this.joystick.setEnabled(true);
  }

  // ---------- 暂停 ----------

  private canPause(): boolean {
    return this.run.phase === 'combat' || this.run.phase === 'cleanup';
  }

  private togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    if (this.paused || !this.canPause()) return;
    this.paused = true;
    this.scene.pause('Game');
    this.openModal(
      '游戏已暂停',
      376,
      (c, top) => {
        c.add(createButton(this, W / 2, top + 128, '继续战斗', () => this.resume(), { width: 268, height: 58 }));
        c.add(createButton(this, W / 2 - 135, top + 212, '重新开始', () => this.restart(), { width: 240, height: 52, fontSize: 21, primary: false }));
        c.add(createButton(this, W / 2 + 135, top + 212, '返回菜单', () => this.toMenu(), { width: 240, height: 52, fontSize: 21, primary: false }));
        addSettingsButtons(this, c, W / 2, top + 304);
      },
      () => this.resume(),
    );
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.closeModal();
    this.scene.resume('Game');
  }

  private restart(): void {
    this.scene.stop('Game');
    this.scene.start('Game');
  }

  private toMenu(): void {
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
