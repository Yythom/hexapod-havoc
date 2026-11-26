import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { DISPLAY_FONT, FONT_FAMILY, fontPx, GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER } from '../config';
import { CHALLENGE_ORDER, CHALLENGES, type ChallengeId } from '../core/challenges';
import { DAILY_MUTATORS, getDailyChallenge } from '../core/daily';
import { hasNativeInstallPrompt, onPwaStateChange, triggerPwaInstall } from '../core/pwa';
import { getDailyBest, loadActiveRun, loadSave } from '../core/save';
import { decodeSeedChallenge, generateSeed, normalizeSeed, type SeedChallengePayload } from '../core/seed';
import { BIOMES, DEFAULT_BIOME } from '../data/biomes';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton, slantPoints } from '../ui/Button';
import { fadeInScene, setupUICamera, transitionTo, uiPointer } from '../ui/camera';
import { addSettingsButtons } from '../ui/settingsButtons';
import { COLOR, displayLabel, divider, drawChamferPlate, label, panel, pill } from '../ui/widgets';

interface DustMote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  baseAlpha: number;
}

interface SwayGrass {
  img: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  parallax: number;
  amp: number;
  speed: number;
  phase: number;
}

interface AmbientBug {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  angle: number;
  speed: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  phase: number;
}

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;

export class MenuScene extends Phaser.Scene {
  private groundImg!: Phaser.GameObjects.Image;
  private sunrays: Phaser.GameObjects.Image | null = null;
  private motes: DustMote[] = [];
  private grass: SwayGrass[] = [];
  private bugs: AmbientBug[] = [];
  private weatherFx!: WeatherAmbience;
  private px = 0;
  private py = 0;
  private elapsed = 0;
  /** 当前打开的弹窗：打开时屏蔽主菜单 Enter/Space 开战快捷键 */
  private modal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupUICamera(this);
    bgm.setMode('menu');
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    this.elapsed = 0;
    this.px = 0;
    this.py = 0;
    this.motes = [];
    this.grass = [];
    this.bugs = [];
    this.sunrays = null;
    this.modal = null;

    // 1. 背景：后院中央老树桩居中铺底，营造完整沉浸式微距空间
    this.groundImg = this.add.image(CX, CY + 22, 'ground');

    // 电影级暗角压底 + 居中暖光呼吸光晕
    const shade = this.add.graphics();
    shade.fillStyle(0x090b0d, 0.58);
    shade.fillRect(0, 0, W, H);
    // 上下左右柔和暗边（四层递进，不生硬）
    for (let i = 0; i < 4; i++) {
      const a = 0.12 + i * 0.05;
      const stripX = 180 - i * 38;
      const stripY = 120 - i * 24;
      shade.fillStyle(0x050608, a);
      shade.fillRect(0, 0, stripX, H);
      shade.fillRect(W - stripX, 0, stripX, H);
      shade.fillRect(0, 0, W, stripY);
      shade.fillRect(0, H - stripY, W, stripY);
    }
    // 树桩与标题背后极克制的暖金聚光
    for (let i = 5; i >= 1; i--) {
      const k = i / 5;
      shade.fillStyle(0xffd268, 0.032 * (1.25 - k * 0.5));
      shade.fillEllipse(CX, 240, 620 * k, 360 * k);
    }
    this.add.tileSprite(0, 0, W, H, 'ui-grunge-tile').setOrigin(0).setAlpha(0.76);

    this.sunrays = this.add
      .image(CX, 220, 'ui-sunrays')
      .setScale(1.65)
      .setTint(0xffd97a)
      .setAlpha(0.085)
      .setDepth(2);

    // 2. 实时天气光影氛围（按上次选的天气难度预览）
    const save = loadSave();
    this.weatherFx = new WeatherAmbience(this, 4, save.last.difficulty);

    // 3. 暗处偶现的 1:1 原比例背景小虫剪影（只沿外围草地穿梭，营造活着的后院氛围，绝不抢戏）
    const spawnBug = (i: number): AmbientBug => {
      const isMosquito = i % 2 === 1;
      const side = i % 4;
      const x = side === 0 ? Phaser.Math.Between(60, 280) : side === 1 ? Phaser.Math.Between(W - 280, W - 60) : Phaser.Math.Between(120, W - 120);
      const y = side === 2 ? Phaser.Math.Between(48, 150) : side === 3 ? Phaser.Math.Between(H - 150, H - 48) : Phaser.Math.Between(90, H - 90);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const img = this.add
        .image(x, y, isMosquito ? 'mosquito' : 'ant')
        .setScale((isMosquito ? 0.86 : 0.94) / SPRITE_RES)
        .setRotation(angle)
        .setTint(isMosquito ? 0x7e877a : 0x6e685c)
        .setAlpha(isMosquito ? 0.36 : 0.44)
        .setDepth(5);
      return {
        img,
        x,
        y,
        angle,
        speed: isMosquito ? Phaser.Math.FloatBetween(42, 64) : Phaser.Math.FloatBetween(24, 38),
        wobbleAmp: isMosquito ? 1.5 : 0.55,
        wobbleSpeed: isMosquito ? 3.2 : 1.7,
        phase: Math.random() * Math.PI * 2,
      };
    };
    for (let i = 0; i < 6; i++) this.bugs.push(spawnBug(i));

    // 4. 飘浮萤火虫与微尘光粒
    for (let i = 0; i < 32; i++) {
      const x = Phaser.Math.Between(40, W - 40);
      const y = Phaser.Math.Between(40, H - 40);
      const warm = i % 3 !== 2;
      const img = this.add
        .image(x, y, 'dot')
        .setTint(warm ? 0xffd86b : 0xc8d2be)
        .setScale(Phaser.Math.FloatBetween(0.22, warm ? 0.58 : 0.42))
        .setAlpha(0.32)
        .setDepth(6);
      this.motes.push({
        img,
        x,
        y,
        vx: Phaser.Math.FloatBetween(-11, 11),
        vy: Phaser.Math.FloatBetween(-14, -4),
        phase: Math.random() * Math.PI * 2,
        baseAlpha: Phaser.Math.FloatBetween(0.18, warm ? 0.52 : 0.34),
      });
    }

    // 5. 微距前景草叶剪影（四角框景 + 鼠标视差，营造 1cm 昆虫视角景深）
    const addGrass = (x: number, y: number, key: string, ox: number, oy: number, sx: number, sy: number, amp: number, phase: number, parallax: number) => {
      const img = this.add.image(x, y, key).setOrigin(ox, oy).setScale(sx, sy).setDepth(25).setAlpha(0.9);
      this.grass.push({ img, baseX: x, baseY: y, parallax, amp, speed: 1.05, phase });
    };
    addGrass(-18, -14, 'ui-macro-grass-tl', 0, 0, 0.62, 0.62, 0.022, 0, 15);
    addGrass(W + 18, -14, 'ui-macro-grass-tl', 0, 0, -0.54, 0.54, -0.02, 1.3, 13);
    addGrass(W + 18, H + 16, 'ui-macro-grass-br', 1, 1, 0.66, 0.66, 0.024, 2.1, 16);
    addGrass(-18, H + 16, 'ui-macro-grass-br', 1, 1, -0.56, 0.56, -0.022, 3.4, 14);

    // 6. 极简居中封面标题与行动按钮栈
    const tagW = 312;
    const tagH = 30;
    const tagY = 116;
    const tagBg = this.add.graphics().setDepth(15).setPosition(CX, tagY).setRotation(-0.015);
    const traceSlant = (ox: number, oy: number) => {
      const pts = slantPoints(-tagW / 2 + ox, -tagH / 2 + oy, tagW, tagH, 12);
      tagBg.beginPath();
      tagBg.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) tagBg.lineTo(pts[i].x, pts[i].y);
      tagBg.closePath();
    };
    tagBg.fillStyle(0x050507, 0.95);
    traceSlant(3, 4);
    tagBg.fillPath();
    tagBg.fillStyle(0xd83430, 1);
    traceSlant(0, 0);
    tagBg.fillPath();
    tagBg.fillStyle(0xffc940, 0.95);
    tagBg.fillPoints(
      [
        { x: -tagW / 2 + 10, y: -tagH / 2 + 2.5 },
        { x: -tagW / 2 + 17, y: -tagH / 2 + 2.5 },
        { x: -tagW / 2 + 7, y: tagH / 2 - 2.5 },
        { x: -tagW / 2, y: tagH / 2 - 2.5 },
      ],
      true,
    );
    tagBg.lineStyle(2.5, 0x050507, 1);
    traceSlant(0, 0);
    tagBg.strokePath();
    this.add
      .text(CX + 2, tagY, 'HEXAPOD HAVOC · 后院虫潮生存', {
        fontFamily: DISPLAY_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff8ec',
      })
      .setOrigin(0.5)
      .setRotation(-0.015)
      .setDepth(16);

    // 标题背后极克制的琥珀斜切光影条
    const titleBack = this.add.graphics().setDepth(14);
    titleBack.fillStyle(0xf0b238, 0.075);
    titleBack.fillPoints(slantPoints(CX - 230, 180, 460, 68, 20), true);

    const titleObj = this.add
      .text(CX, 202, '六足战虫', {
        fontFamily: DISPLAY_FONT,
        fontSize: '108px',
        fontStyle: 'bold',
        color: '#f4f3ee',
        stroke: '#050507',
        strokeThickness: 20,
        shadow: { offsetX: 6, offsetY: 8, color: '#050507', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0.5)
      .setDepth(16);
    const titleGrad = titleObj.context.createLinearGradient(0, 0, 0, titleObj.height);
    titleGrad.addColorStop(0, '#fffef9');
    titleGrad.addColorStop(0.58, '#f4f0e4');
    titleGrad.addColorStop(1, '#ffd573');
    titleObj.setFill(titleGrad);
    this.tweens.add({ targets: titleObj, y: 207, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add
      .text(CX, 282, '六条腿，六把武器，守住后院最后一截树桩。', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#cbcdd6',
        stroke: '#050507',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(16);

    const savedRun = loadActiveRun();
    const start = () => transitionTo(this, 'CharacterSelect');
    const resume = () => {
      if (savedRun) transitionTo(this, 'Game', { resume: savedRun });
    };

    const primaryW = 344;
    const halfW = 166;
    const halfOffset = 89;
    const primaryY = savedRun ? 356 : 374;

    const ctaRing = this.add.graphics().setPosition(CX, primaryY).setDepth(28);
    ctaRing.lineStyle(3, savedRun ? 0x5de862 : 0xffd44c, 0.55);
    const ringPts = slantPoints(-primaryW / 2, -35, primaryW, 70, 15);
    ctaRing.beginPath();
    ctaRing.moveTo(ringPts[0].x, ringPts[0].y);
    for (let i = 1; i < ringPts.length; i++) ctaRing.lineTo(ringPts[i].x, ringPts[i].y);
    ctaRing.closePath();
    ctaRing.strokePath();
    this.tweens.add({
      targets: ctaRing,
      scaleX: 1.07,
      scaleY: 1.18,
      alpha: 0,
      duration: 1650,
      repeat: -1,
      repeatDelay: 900,
      ease: 'Quad.Out',
    });

    if (savedRun) {
      const charName = CHARACTERS[savedRun.setup.character]?.name ?? '';
      const waveTag = savedRun.endless ? `无尽第 ${savedRun.wave + 1} 波` : `第 ${savedRun.wave + 1} 波`;
      createButton(this, CX, primaryY, `继续 · ${waveTag} ▶`, resume, {
        width: primaryW,
        height: 66,
        fontSize: 25,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      this.add
        .text(CX, primaryY + 45, `上次进度：${charName} · 已通第 ${savedRun.wave} 波`, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#9cf2a8',
          stroke: '#050507',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(30);
      createButton(this, CX - halfOffset, 444, '开始新局 ▶', start, { width: halfW, height: 46, fontSize: 19, shape: 'slant' }).setDepth(30);
      createButton(this, CX + halfOffset, 444, '★ 每日挑战', () => this.openDailyModal(), {
        width: halfW,
        height: 46,
        fontSize: 18,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, CX - 131, 502, '🏆 挑战关', () => this.openChallengeModal(), {
        width: 82,
        height: 44,
        fontSize: 13.5,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, CX - 44, 502, '🌱 种子', () => this.openSeedModal(), {
        width: 82,
        height: 44,
        fontSize: 13.5,
        primary: false,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      createButton(this, CX + 44, 502, '图鉴', () => transitionTo(this, 'Codex'), {
        width: 82,
        height: 44,
        fontSize: 14,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, CX + 131, 502, '设置', () => this.openSettings(), {
        width: 82,
        height: 44,
        fontSize: 14,
        primary: false,
        shape: 'slant',
        leftIcon: 'ui-gear',
      }).setDepth(30);
    } else {
      createButton(this, CX, primaryY, '开始战斗 ▶', start, { width: primaryW, height: 68, fontSize: 28, shape: 'slant' }).setDepth(30);
      createButton(this, CX - halfOffset, 448, '★ 每日挑战', () => this.openDailyModal(), {
        width: halfW,
        height: 48,
        fontSize: 19,
        primary: false,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      createButton(this, CX + halfOffset, 448, '🏆 主题挑战', () => this.openChallengeModal(), {
        width: halfW,
        height: 48,
        fontSize: 19,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, CX - 116, 508, '🌱 种子挑战', () => this.openSeedModal(), {
        width: 108,
        height: 46,
        fontSize: 15,
        primary: false,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      createButton(this, CX, 508, '后院图鉴', () => transitionTo(this, 'Codex'), {
        width: 108,
        height: 46,
        fontSize: 16,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, CX + 116, 508, '设置', () => this.openSettings(), {
        width: 108,
        height: 46,
        fontSize: 16,
        primary: false,
        shape: 'slant',
        leftIcon: 'ui-gear',
      }).setDepth(30);
    }

    // 7. 生涯战绩印记 & 底部操作提示（居中切角铭牌）
    const statY = 582;
    if (save.runs > 0) {
      const statStr = `已出战 ${save.runs} 局  ·  守住树桩 ${save.wins} 次`;
      const st = this.add
        .text(CX, statY, statStr, { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffd44c' })
        .setOrigin(0.5)
        .setDepth(31);
      const sw = st.width + 32;
      const sg = this.add.graphics().setDepth(30);
      drawChamferPlate(sg, CX - sw / 2, statY - 15, sw, 30, {
        fill: 0x1b1c22,
        border: 0x564624,
        borderWidth: 1.5,
        shadowX: 3,
        shadowY: 4,
        cutBig: 7,
        cutSmall: 3,
        inkWidth: 2.4,
      });
    }

    const hint = IS_COARSE_POINTER
      ? '拖动移动 · 右下角按钮冲刺 · 武器自动开火'
      : 'WASD 移动 · Space 轻冲刺 · 按住左键集火 · P 暂停';
    const hintText = this.add
      .text(CX, H - 36, hint, { fontFamily: FONT_FAMILY, fontSize: fontPx(14), fontStyle: 'bold', color: '#c4c5ce' })
      .setOrigin(0.5)
      .setDepth(31);
    const hw = hintText.width + 32;
    const hintBg = this.add.graphics().setDepth(30);
    drawChamferPlate(hintBg, CX - hw / 2, H - 50, hw, 28, {
      fill: 0x18191e,
      fillAlpha: 0.94,
      border: COLOR.borderSoft,
      borderWidth: 1.4,
      shadowX: 3,
      shadowY: 3,
      cutBig: 6,
      cutSmall: 3,
      inkWidth: 2.2,
    });

    this.add
      .text(W - 22, H - 18, 'v0.5', { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#787a84' })
      .setOrigin(1, 1)
      .setDepth(30);

    // 8. 若浏览器触发了原生 PWA 安装条件，在主菜单右上角展示轻巧的「安装应用」快捷按钮
    let installBtn: Phaser.GameObjects.Container | null = null;
    const syncInstallBtn = () => {
      if (!this.scene.isActive()) return;
      if (hasNativeInstallPrompt() && !installBtn) {
        installBtn = createButton(
          this,
          W - 88,
          36,
          '📲 安装应用',
          () => {
            void triggerPwaInstall().then((res) => {
              if (res === 'accepted') sfx.play('unlock');
              syncInstallBtn();
            });
          },
          { width: 132, height: 38, fontSize: 14, primary: false, shape: 'slant', variant: 'emerald' },
        ).setDepth(35);
      } else if (!hasNativeInstallPrompt() && installBtn) {
        installBtn.destroy();
        installBtn = null;
      }
    };
    syncInstallBtn();
    const unsubPwa = onPwaStateChange(syncInstallBtn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubPwa);

    const keyboardStart = () => {
      if (this.modal) return;
      (savedRun ? resume : start)();
    };
    this.input.keyboard!.on('keydown-ENTER', keyboardStart);
    this.input.keyboard!.on('keydown-SPACE', keyboardStart);
    fadeInScene(this);

    // 若 URL 携带好友分享的 ?challenge=HHS1:... 参数，首次进主菜单自动打开挑战书
    if (typeof window !== 'undefined' && !this.registry.get('urlChallengeHandled')) {
      const param = new URLSearchParams(window.location.search).get('challenge');
      if (param) {
        this.registry.set('urlChallengeHandled', true);
        const decoded = decodeSeedChallenge(param);
        if (decoded) this.openSeedModal(decoded);
      }
    }
  }

  /** 记录当前弹窗，销毁时解除；弹窗打开期间不响应主菜单的开战快捷键 */
  private trackModal(c: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    this.modal = c;
    c.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.modal === c) this.modal = null;
    });
    return c;
  }

  /** 每日挑战弹窗：展示今日固定角色、初始武器、天气难度与 2 条随机突变词条 */
  private openDailyModal(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const daily = getDailyChallenge();
    const char = CHARACTERS[daily.character];
    const diff = DIFFICULTIES[daily.difficulty];
    const biome = BIOMES[daily.biome];
    const weap = daily.weapon ? WEAPONS[daily.weapon] : null;
    const best = getDailyBest(daily.dateKey);

    const c = this.trackModal(this.add.container(0, 0).setDepth(100));
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.78).setOrigin(0).setInteractive();
    const pw = 620;
    const ph = 432;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    c.add([
      dim,
      panel(this, px, py, pw, ph, COLOR.gold, COLOR.panel, 2, COLOR.gold),
      displayLabel(this, W / 2, py + 40, `★ 每日挑战 · ${daily.dateKey}`, 28, COLOR.goldText).setOrigin(0.5),
      divider(this, px + 32, py + 72, pw - 64, COLOR.gold, 0.55),
    ]);

    // 左侧固定主角预览
    const bx = px + 116;
    const by = py + 162;
    const spot = this.add.graphics();
    spot.fillStyle(COLOR.panelDeep, 1);
    spot.fillCircle(bx, by, 54);
    spot.lineStyle(2.5, COLOR.gold, 0.85);
    spot.strokeCircle(bx, by, 54);
    const view = new BeetleView(this, bx, by, char.shell).setScale(1.45).setRotation(-Math.PI / 2);
    c.add([spot, view]);
    c.add(label(this, bx, by + 70, char.name, 17, COLOR.text, true).setOrigin(0.5));
    c.add(label(this, bx, by + 94, `${diff.name} · ${biome.name}`, 13, biome.css, true).setOrigin(0.5));
    c.add(label(this, bx, by + 114, weap ? weap.name : '工蚁随从', 12.5, COLOR.dim).setOrigin(0.5));

    // 右侧今日两条词条
    const rx = px + 216;
    c.add(label(this, rx, py + 98, '今日突变词条', 16, COLOR.goldText, true).setOrigin(0, 0.5));
    daily.mutators.forEach((mid, i) => {
      const m = DAILY_MUTATORS[mid];
      const my = py + 132 + i * 74;
      const box = this.add.graphics();
      drawChamferPlate(box, rx, my, 372, 62, {
        fill: COLOR.panelDeep,
        border: 0x584a2a,
        borderWidth: 1.5,
        accentTop: COLOR.gold,
        cutBig: 7,
        cutSmall: 3,
        inkWidth: 2.2,
      });
      c.add(box);
      c.add(pill(this, rx + 54, my + 20, m.name, 0x3b2c10, COLOR.gold, COLOR.goldText, 12, 10, 20));
      c.add(label(this, rx + 14, my + 44, m.desc, 13, '#e4e2da').setOrigin(0, 0.5));
    });

    const recStr = best
      ? `今日最佳：${best.win ? '★ 已通关' : `第 ${best.wave} 波`}`
      : '今日尚未挑战（即使角色未解锁也可直接游玩）';
    c.add(label(this, W / 2, py + 318, recStr, 14, best?.win ? COLOR.good : COLOR.dim, !!best).setOrigin(0.5));

    c.add(
      createButton(
        this,
        W / 2 - 116,
        py + 374,
        '接受今日挑战 ▶',
        () => {
          transitionTo(this, 'Game', {
            character: daily.character,
            difficulty: daily.difficulty,
            weapon: daily.weapon,
            biome: daily.biome,
            seed: daily.seed,
            daily: daily.dateKey,
            mutators: daily.mutators,
          });
        },
        { width: 224, height: 54, fontSize: 20 },
      ),
    );
    c.add(createButton(this, W / 2 + 124, py + 374, '返回', () => c.destroy(), { width: 156, height: 54, fontSize: 19, primary: false }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  /** 主题挑战关弹窗：6 个 10 波短局特殊规则挑战 */
  private openChallengeModal(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const save = loadSave();
    const cleared = new Set(save.challengesCleared);

    const c = this.trackModal(this.add.container(0, 0).setDepth(100));
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.78).setOrigin(0).setInteractive();
    const pw = 960;
    const ph = 560;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    c.add([
      dim,
      panel(this, px, py, pw, ph, COLOR.gold, COLOR.panel, 2, COLOR.gold),
      displayLabel(this, W / 2, py + 38, `🏆 主题挑战模式 (${cleared.size}/${CHALLENGE_ORDER.length})`, 28, COLOR.goldText).setOrigin(0.5),
      label(this, W / 2, py + 68, '10 波快节奏特殊规则挑战，第 10 波迎来 Boss 决战（无需预先解锁角色）', 13, COLOR.dim).setOrigin(0.5),
      divider(this, px + 32, py + 84, pw - 64, COLOR.gold, 0.55),
    ]);

    const cols = 3;
    const cw = 286;
    const ch = 186;
    const gapX = 18;
    const gapY = 16;
    const gx0 = px + (pw - (cols * cw + (cols - 1) * gapX)) / 2;
    const gy0 = py + 98;

    CHALLENGE_ORDER.forEach((cid: ChallengeId, i) => {
      const def = CHALLENGES[cid];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gx0 + col * (cw + gapX);
      const cy = gy0 + row * (ch + gapY);
      const done = cleared.has(cid);
      const box = this.add.graphics();
      drawChamferPlate(box, cx, cy, cw, ch, {
        fill: COLOR.panelDeep,
        border: done ? 0x5de862 : def.accent,
        borderWidth: 1.8,
        accentTop: def.accent,
        headerH: 0,
        cutBig: 8,
        cutSmall: 3,
        inkWidth: 2.4,
      });
      c.add(box);
      c.add(label(this, cx + 14, cy + 16, def.name, 18, def.css, true).setOrigin(0, 0));
      if (done) {
        c.add(pill(this, cx + cw - 40, cy + 25, '★ 通关', 0x164a22, 0x5de862, '#c8ffd0', 11, 7, 20));
      }
      c.add(label(this, cx + 14, cy + 44, `${CHARACTERS[def.character].name} · ${def.tagline}`, 12.5, COLOR.goldText, true).setOrigin(0, 0));
      c.add(label(this, cx + 14, cy + 68, def.desc, 12.5, '#d4d6de', false, cw - 28).setOrigin(0, 0).setAlign('left'));
      c.add(
        createButton(
          this,
          cx + cw / 2,
          cy + ch - 28,
          done ? '再次挑战 ▶' : '开始挑战 ▶',
          () => {
            transitionTo(this, 'Game', {
              character: def.character,
              difficulty: def.difficulty,
              weapon: def.weapon,
              challenge: cid,
              mutators: [...def.mutators],
              shellSkin: save.shellSkin,
            });
          },
          { width: cw - 28, height: 36, fontSize: 15, variant: done ? 'emerald' : undefined },
        ),
      );
    });

    c.add(createButton(this, W / 2, py + ph - 36, '返回主菜单', () => c.destroy(), { width: 200, height: 46, fontSize: 18, primary: false }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  /** 种子分享挑战弹窗：粘贴 HHS1:... 挑战码或输入任意自定义种子同图竞速 */
  private openSeedModal(initial?: SeedChallengePayload, errMsg = ''): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const save = loadSave();

    const c = this.trackModal(this.add.container(0, 0).setDepth(100));
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.8).setOrigin(0).setInteractive();
    const pw = 680;
    const ph = initial ? 476 : 360;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    c.add([
      dim,
      panel(this, px, py, pw, ph, 0x5de862, COLOR.panel, 2, 0x5de862),
      displayLabel(this, W / 2, py + 38, '🌱 种子分享挑战', 28, '#a4ffaa').setOrigin(0.5),
      divider(this, px + 32, py + 70, pw - 64, 0x5de862, 0.55),
    ]);

    const reopen = (p?: SeedChallengePayload, msg = '') => {
      c.destroy();
      this.openSeedModal(p, msg);
    };

    const askPasteCode = () => {
      const raw = window.prompt('请粘贴好友分享的种子挑战码（HHS1:...）或输入自定义种子：');
      if (!raw) return;
      const decoded = decodeSeedChallenge(raw);
      if (decoded) {
        sfx.play('unlock');
        reopen(decoded);
        return;
      }
      const clean = normalizeSeed(raw);
      if (clean) {
        sfx.play('click');
        reopen({
          seed: clean,
          character: save.last.character,
          difficulty: save.last.difficulty,
          weapon: save.last.weapon,
          biome: save.last.biome ?? DEFAULT_BIOME,
        });
        return;
      }
      reopen(initial, '挑战码或种子格式无效，请检查后重试');
    };

    if (!initial) {
      c.add(
        label(
          this,
          W / 2,
          py + 124,
          '粘贴结算页导出的「种子挑战码（HHS1:...）」即可与好友挑战\n完全相同的后院生态、刷怪事件、Boss、商店、升级与宝箱！\n（无需预先解锁对应角色或天气难度）',
          15,
          '#e2e4ec',
          false,
          pw - 84,
        ).setOrigin(0.5),
      );
      if (errMsg) {
        c.add(label(this, W / 2, py + 194, errMsg, 14, COLOR.bad, true).setOrigin(0.5));
      }
      c.add(
        createButton(this, W / 2 - 122, py + 244, '📋 粘贴挑战码 / 种子', askPasteCode, {
          width: 230,
          height: 54,
          fontSize: 17,
          variant: 'emerald',
        }),
      );
      c.add(
        createButton(
          this,
          W / 2 + 122,
          py + 244,
          '🎲 随机生成一局种子',
          () => {
            sfx.play('reroll');
            reopen({
              seed: generateSeed(),
              character: save.last.character,
              difficulty: save.last.difficulty,
              weapon: save.last.weapon,
              biome: save.last.biome ?? DEFAULT_BIOME,
            });
          },
          { width: 220, height: 54, fontSize: 16, primary: false },
        ),
      );
      c.add(createButton(this, W / 2, py + 314, '返回主菜单', () => c.destroy(), { width: 170, height: 42, fontSize: 16, primary: false }));
    } else {
      const char = CHARACTERS[initial.character];
      const diff = DIFFICULTIES[initial.difficulty];
      const biome = BIOMES[initial.biome];
      const weap = initial.weapon ? WEAPONS[initial.weapon] : null;

      // 左侧角色预览
      const bx = px + 118;
      const by = py + 168;
      const spot = this.add.graphics();
      spot.fillStyle(COLOR.panelDeep, 1);
      spot.fillCircle(bx, by, 54);
      spot.lineStyle(2.5, biome.accent, 0.9);
      spot.strokeCircle(bx, by, 54);
      const view = new BeetleView(this, bx, by, char.shell).setScale(1.45).setRotation(-Math.PI / 2);
      c.add([spot, view]);
      c.add(label(this, bx, by + 70, char.name, 17, COLOR.text, true).setOrigin(0.5));
      c.add(label(this, bx, by + 94, weap ? weap.name : '工蚁随从', 13, COLOR.dim).setOrigin(0.5));

      // 右侧种子战报详情
      const rx = px + 220;
      const rw = pw - 252;
      c.add(pill(this, rx + 76, py + 104, `种子 #${initial.seed}`, 0x163826, 0x5de862, '#a4ffaa', 13, 12, 24));
      c.add(pill(this, rx + 216, py + 104, `${biome.name} · ${diff.name}`, COLOR.panelDeep, biome.accent, biome.css, 13, 12, 24));

      c.add(label(this, rx, py + 132, `生态特性：${biome.tagline}`, 13.5, biome.css, true, rw).setOrigin(0, 0).setAlign('left'));
      if (initial.mutators && initial.mutators.length > 0) {
        const mNames = initial.mutators.map((m) => DAILY_MUTATORS[m]?.name ?? m).join(' · ');
        c.add(label(this, rx, py + 158, `附加词条：${mNames}`, 13, COLOR.goldText, true, rw).setOrigin(0, 0).setAlign('left'));
      }

      const targetBoxY = py + 190;
      const tBox = this.add.graphics();
      drawChamferPlate(tBox, rx, targetBoxY, rw, 126, {
        fill: COLOR.panelDeep,
        border: initial.target ? COLOR.gold : COLOR.borderSoft,
        borderWidth: 1.6,
        accentTop: initial.target ? COLOR.gold : 0x5de862,
        cutBig: 7,
        cutSmall: 3,
        inkWidth: 2.2,
      });
      c.add(tBox);
      if (initial.target) {
        const t = initial.target;
        const mvpName = t.mvpId && WEAPONS[t.mvpId] ? WEAPONS[t.mvpId].name : '';
        c.add(label(this, rx + 14, targetBoxY + 18, '⚔ 发起者战绩目标', 14.5, COLOR.goldText, true).setOrigin(0, 0));
        c.add(
          label(
            this,
            rx + 14,
            targetBoxY + 46,
            `${t.win ? '★ 已通关' : '止步'} 第 ${t.wave} 波  ·  LV.${t.level}`,
            16,
            t.win ? COLOR.good : COLOR.text,
            true,
          ).setOrigin(0, 0),
        );
        c.add(label(this, rx + 14, targetBoxY + 74, `击杀 ${t.kills}  ·  花蜜 ${t.nectar}`, 14, '#e4e2da').setOrigin(0, 0));
        if (mvpName) {
          c.add(label(this, rx + 14, targetBoxY + 98, `发起者 MVP 武器：${mvpName}`, 13, COLOR.goldText).setOrigin(0, 0));
        }
      } else {
        c.add(label(this, rx + 14, targetBoxY + 24, '🏁 同图盲盒竞速', 15, '#a4ffaa', true).setOrigin(0, 0));
        c.add(
          label(
            this,
            rx + 14,
            targetBoxY + 56,
            '本种子尚未绑定战绩目标。\n打完后在结算页点「分享种子」，即可把你的最终成绩打包发给好友！',
            13,
            COLOR.dim,
            false,
            rw - 28,
          )
            .setOrigin(0, 0)
            .setAlign('left'),
        );
      }

      if (errMsg) {
        c.add(label(this, W / 2, py + 346, errMsg, 13.5, COLOR.bad, true).setOrigin(0.5));
      }

      c.add(
        createButton(
          this,
          W / 2 - 140,
          py + 408,
          '接受种子挑战 ▶',
          () => {
            transitionTo(this, 'Game', {
              character: initial.character,
              difficulty: initial.difficulty,
              weapon: initial.weapon,
              biome: initial.biome,
              seed: initial.seed,
              seedTarget: initial.target,
              mutators: initial.mutators ? [...initial.mutators] : undefined,
              shellSkin: save.shellSkin,
            });
          },
          { width: 224, height: 54, fontSize: 19, variant: 'emerald' },
        ),
      );
      c.add(createButton(this, W / 2 + 56, py + 408, '更换挑战码', askPasteCode, { width: 142, height: 54, fontSize: 15, primary: false }));
      c.add(createButton(this, W / 2 + 206, py + 408, '返回', () => c.destroy(), { width: 122, height: 54, fontSize: 16, primary: false }));
    }

    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  /** 设置弹窗 */
  private openSettings(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const c = this.trackModal(this.add.container(0, 0).setDepth(100));
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    const pw = 580;
    const ph = 474;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const bg = panel(this, px, py, pw, ph, COLOR.border, COLOR.panel, 2, COLOR.gold);
    const title = displayLabel(this, W / 2, py + 44, '游戏设置', 32, COLOR.text).setOrigin(0.5);
    const div = divider(this, px + 32, py + 78, pw - 64);
    c.add([dim, bg, title, div]);
    addSettingsButtons(this, c, W / 2, py + 124, {
      showSaveTransfer: true,
      onSaveImported: () => {
        c.destroy();
        this.scene.restart();
      },
    });
    c.add(createButton(this, W / 2, py + 416, '完成', () => c.destroy(), { width: 220, height: 52 }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.weatherFx.update(dt);
    if (this.sunrays) this.sunrays.rotation += dt * 0.045;

    // 微距景深视差
    const p = this.input.activePointer;
    const pt = uiPointer(p);
    const hasPointer = p.x > 0 || p.y > 0;
    const targetPx = hasPointer ? Phaser.Math.Clamp((pt.x - GAME_WIDTH / 2) / (GAME_WIDTH / 2), -1, 1) : 0;
    const targetPy = hasPointer ? Phaser.Math.Clamp((pt.y - GAME_HEIGHT / 2) / (GAME_HEIGHT / 2), -1, 1) : 0;
    const lerpK = 1 - Math.exp(-dt * 6);
    this.px += (targetPx - this.px) * lerpK;
    this.py += (targetPy - this.py) * lerpK;

    this.groundImg.setPosition(CX - this.px * 5, CY + 22 - this.py * 3.5);

    // 外围暗处 1:1 小虫自然漫游（避开屏幕正中标题按钮区，出界平滑绕回）
    for (const b of this.bugs) {
      b.angle += Math.sin(this.elapsed * b.wobbleSpeed + b.phase) * b.wobbleAmp * dt;
      // 柔和避开中央封面文字与按钮区域
      const dx = b.x - CX;
      const dy = b.y - (CY + 10);
      if (Math.abs(dx) < 290 && Math.abs(dy) < 210) {
        const away = Math.atan2(dy, dx);
        const diff = Phaser.Math.Angle.Wrap(away - b.angle);
        b.angle += Phaser.Math.Clamp(diff, -2.2 * dt, 2.2 * dt);
      }
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      if (b.x < -36) b.x = GAME_WIDTH + 32;
      if (b.x > GAME_WIDTH + 36) b.x = -32;
      if (b.y < -36) b.y = GAME_HEIGHT + 32;
      if (b.y > GAME_HEIGHT + 36) b.y = -32;
      b.img.setPosition(b.x - this.px * 6, b.y - this.py * 4).setRotation(b.angle);
    }

    for (const g of this.grass) {
      g.img.setPosition(g.baseX + this.px * g.parallax, g.baseY + this.py * (g.parallax * 0.7));
      g.img.rotation = Math.sin(this.elapsed * g.speed + g.phase) * g.amp;
    }
    for (const f of this.motes) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < -10) f.y = GAME_HEIGHT + 10;
      if (f.x < -10) f.x = GAME_WIDTH + 10;
      if (f.x > GAME_WIDTH + 10) f.x = -10;
      f.img.setPosition(f.x, f.y);
      f.img.setAlpha(f.baseAlpha * (0.55 + 0.45 * Math.sin(this.elapsed * 2.4 + f.phase)));
    }
  }
}
