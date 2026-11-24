import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { DISPLAY_FONT, FONT_FAMILY, fontPx, GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER } from '../config';
import { UI_WEAPON_RES, weaponTex } from '../art/icons';
import { DAILY_MUTATORS, getDailyChallenge } from '../core/daily';
import { getDailyBest, loadActiveRun, loadSave } from '../core/save';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { TIERS, WEAPONS } from '../data/weapons';
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

interface HaloWeapon {
  baseAngle: number;
  rx: number;
  ry: number;
  phase: number;
  scale: number;
  groundShadow: Phaser.GameObjects.Ellipse;
  spriteShadow: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
}

/** 菜单展示 6 把不同武器（仿土豆兄弟：环绕主角身体外侧悬浮，不贴脸、无多余底座框） */
const SHOWCASE: [string, number][] = [
  ['w-mandible', 2],
  ['w-slingshot', 1],
  ['w-scythe', 3],
  ['w-acorn', 1],
  ['w-acid', 2],
  ['w-dewsniper', 3],
];

const HERO_X = 900;
const HERO_Y = 368;
const HALO_RX = 148;
const HALO_RY = 136;
/** 土豆兄弟风格：左右两翼各 3 把悬浮武器对称环抱主角，完全避开正上方钳角与正下方 */
const HALO_ANGLES = [-0.82, 0, 0.82, Math.PI - 0.82, Math.PI, Math.PI + 0.82];

export class MenuScene extends Phaser.Scene {
  private beetle!: BeetleView;
  private groundImg!: Phaser.GameObjects.Image;
  private motes: DustMote[] = [];
  private grass: SwayGrass[] = [];
  private halo: HaloWeapon[] = [];
  private weatherFx!: WeatherAmbience;
  private px = 0;
  private py = 0;
  private elapsed = 0;

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
    this.halo = [];

    // 1. 背景：将战场中央树桩对准右侧主角舞台（非对称三分法构图）
    this.groundImg = this.add.image(HERO_X, HERO_Y + 6, 'ground');

    // 左侧深色电影暗角渐变 + 右侧舞台聚光
    const shade = this.add.graphics();
    shade.fillStyle(0x0b0c0e, 0.56);
    shade.fillRect(0, 0, W, H);
    shade.fillStyle(0x08090b, 0.58);
    shade.fillRect(0, 0, 560, H);
    for (let i = 5; i >= 1; i--) {
      const k = i / 5;
      shade.fillStyle(0xffd268, 0.036 * (1.2 - k * 0.5));
      shade.fillEllipse(HERO_X, HERO_Y, 540 * k, 380 * k);
    }
    this.add.tileSprite(0, 0, W, H, 'ui-grunge-tile').setOrigin(0).setAlpha(0.72);

    // 2. 实时天气光影氛围（按上次选的天气难度预览）
    const save = loadSave();
    this.weatherFx = new WeatherAmbience(this, 4, save.last.difficulty);

    // 3. 飘浮尘埃微粒
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(40, W - 40);
      const y = Phaser.Math.Between(40, H - 40);
      const img = this.add
        .image(x, y, 'dot')
        .setTint(i % 3 === 0 ? 0xffd460 : 0xc8ccc0)
        .setScale(Phaser.Math.FloatBetween(0.24, 0.55))
        .setAlpha(0.32)
        .setDepth(5);
      this.motes.push({
        img,
        x,
        y,
        vx: Phaser.Math.FloatBetween(-10, 10),
        vy: Phaser.Math.FloatBetween(-12, -3),
        phase: Math.random() * Math.PI * 2,
        baseAlpha: Phaser.Math.FloatBetween(0.16, 0.44),
      });
    }

    // 4. 右侧特写主角舞台：居中巨型锹甲 + 土豆兄弟风格环绕悬浮武器（大尺寸、干净黑墨武器 + 地面投影）
    this.beetle = new BeetleView(this, HERO_X, HERO_Y, 'beetle-stag')
      .setScale(2.85)
      .setRotation(-Math.PI * 0.62)
      .setDepth(8);

    const wScale = 3.05 / UI_WEAPON_RES;
    SHOWCASE.forEach(([tex, tier], i) => {
      const baseAngle = HALO_ANGLES[i];
      const wx = HERO_X + Math.cos(baseAngle) * HALO_RX;
      const wy = HERO_Y + Math.sin(baseAngle) * HALO_RY;
      const tCol = TIERS[tier].color;

      // 地面悬浮接触投影（位于武器正下方地面上，体现真正离地浮空感）
      const groundShadow = this.add
        .ellipse(wx + 2, wy + 24, 54, 18, 0x050507, 0.44)
        .setDepth(6);

      // 极轻品质微光晕（无圆框无贴纸硬边）
      const aura = this.add
        .image(wx, wy, 'dot')
        .setTint(tCol)
        .setScale(2.8)
        .setAlpha(tier >= 2 ? 0.16 : 0.08)
        .setDepth(7);

      const cleanKey = weaponTex(tex, 0, true);
      const spriteShadow = this.add
        .image(wx + 3, wy + 5, cleanKey)
        .setScale(wScale)
        .setRotation(baseAngle)
        .setFlipY(Math.cos(baseAngle) < 0)
        .setTint(0x050507)
        .setAlpha(0.32)
        .setDepth(9);
      const sprite = this.add
        .image(wx, wy, cleanKey)
        .setScale(wScale)
        .setRotation(baseAngle)
        .setFlipY(Math.cos(baseAngle) < 0)
        .setDepth(10);

      this.halo.push({
        baseAngle,
        rx: HALO_RX,
        ry: HALO_RY,
        phase: i * 1.1,
        scale: wScale,
        groundShadow,
        spriteShadow,
        sprite,
        aura,
      });
    });

    // 5. 微距前景草叶剪影（四角框景 + 鼠标视差，营造 1cm 昆虫视角景深）
    const addGrass = (x: number, y: number, key: string, ox: number, oy: number, sx: number, sy: number, amp: number, phase: number, parallax: number) => {
      const img = this.add.image(x, y, key).setOrigin(ox, oy).setScale(sx, sy).setDepth(25).setAlpha(0.88);
      this.grass.push({ img, baseX: x, baseY: y, parallax, amp, speed: 1.1, phase });
    };
    addGrass(-18, -14, 'ui-macro-grass-tl', 0, 0, 0.58, 0.58, 0.022, 0, 15);
    addGrass(W + 18, -14, 'ui-macro-grass-tl', 0, 0, -0.48, 0.48, -0.02, 1.3, 12);
    addGrass(W + 18, H + 16, 'ui-macro-grass-br', 1, 1, 0.62, 0.62, 0.024, 2.1, 16);
    addGrass(-18, H + 16, 'ui-macro-grass-br', 1, 1, -0.5, 0.5, -0.022, 3.4, 13);

    // 6. 左侧封面级标题与行动堆栈（非对称冲击构图）
    const LX = 104;
    // 微倾红金序列斜切徽条
    const tagBg = this.add.graphics().setDepth(15).setPosition(LX, 132).setRotation(-0.025);
    const traceSlant = (ox: number, oy: number) => {
      const pts = slantPoints(ox, oy, 304, 30, 12);
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
        { x: 10, y: 2.5 },
        { x: 17, y: 2.5 },
        { x: 7, y: 27.5 },
        { x: 0, y: 27.5 },
      ],
      true,
    );
    tagBg.lineStyle(2.5, 0x050507, 1);
    traceSlant(0, 0);
    tagBg.strokePath();
    this.add
      .text(LX + 155, 147, 'HEXAPOD HAVOC · 后院虫潮生存', {
        fontFamily: DISPLAY_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff8ec',
      })
      .setOrigin(0.5)
      .setRotation(-0.025)
      .setDepth(16);

    // 标题背后极克制的琥珀斜切光影条
    const titleBack = this.add.graphics().setDepth(14);
    titleBack.fillStyle(0xf0b238, 0.08);
    titleBack.fillPoints(slantPoints(LX - 10, 212, 390, 62, 18), true);

    const titleObj = this.add
      .text(LX - 4, 218, '六足战虫', {
        fontFamily: DISPLAY_FONT,
        fontSize: '98px',
        fontStyle: 'bold',
        color: '#f4f3ee',
        stroke: '#050507',
        strokeThickness: 18,
        shadow: { offsetX: 6, offsetY: 8, color: '#050507', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0, 0.5)
      .setDepth(16);
    const titleGrad = titleObj.context.createLinearGradient(0, 0, 0, titleObj.height);
    titleGrad.addColorStop(0, '#fffef9');
    titleGrad.addColorStop(0.58, '#f4f0e4');
    titleGrad.addColorStop(1, '#ffd573');
    titleObj.setFill(titleGrad);
    this.tweens.add({ targets: titleObj, y: 223, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add
      .text(LX + 2, 294, '六条腿，六把武器，守住后院最后一截树桩。', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#c4c5cf',
        stroke: '#050507',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setDepth(16);

    const savedRun = loadActiveRun();
    const start = () => transitionTo(this, 'CharacterSelect');
    const resume = () => {
      if (savedRun) transitionTo(this, 'Game', { resume: savedRun });
    };

    const primaryY = savedRun ? 372 : 396;
    const ctaRing = this.add.graphics().setPosition(LX + 160, primaryY).setDepth(28);
    ctaRing.lineStyle(3, savedRun ? 0x5de862 : 0xffd44c, 0.55);
    const ringPts = slantPoints(-159, -35, 318, 70, 15);
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
      createButton(this, LX + 160, primaryY, `继续 · ${waveTag} ▶`, resume, {
        width: 318,
        height: 68,
        fontSize: 25,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      this.add
        .text(LX + 14, primaryY + 46, `上次进度：${charName} · 已通第 ${savedRun.wave} 波`, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#9cf2a8',
          stroke: '#050507',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5)
        .setDepth(30);
      createButton(this, LX + 82, 464, '开始新局 ▶', start, { width: 162, height: 50, fontSize: 20, shape: 'slant' }).setDepth(30);
      createButton(this, LX + 250, 464, '★ 每日挑战', () => this.openDailyModal(), {
        width: 158,
        height: 50,
        fontSize: 19,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, LX + 82, 524, '后院图鉴', () => transitionTo(this, 'Codex'), {
        width: 162,
        height: 46,
        fontSize: 18,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, LX + 250, 524, '游戏设置', () => this.openSettings(), {
        width: 158,
        height: 46,
        fontSize: 18,
        primary: false,
        shape: 'slant',
        leftIcon: 'ui-gear',
      }).setDepth(30);
    } else {
      createButton(this, LX + 160, primaryY, '开始战斗 ▶', start, { width: 318, height: 70, fontSize: 28, shape: 'slant' }).setDepth(30);
      createButton(this, LX + 160, 468, '★ 每日挑战', () => this.openDailyModal(), {
        width: 318,
        height: 48,
        fontSize: 20,
        primary: false,
        shape: 'slant',
        variant: 'emerald',
      }).setDepth(30);
      createButton(this, LX + 80, 526, '后院图鉴', () => transitionTo(this, 'Codex'), {
        width: 158,
        height: 46,
        fontSize: 18,
        primary: false,
        shape: 'slant',
      }).setDepth(30);
      createButton(this, LX + 250, 526, '游戏设置', () => this.openSettings(), {
        width: 158,
        height: 46,
        fontSize: 18,
        primary: false,
        shape: 'slant',
        leftIcon: 'ui-gear',
      }).setDepth(30);
    }

    // 7. 生涯战绩印记 & 操作提示（切角铭牌）
    const statY = 584;
    if (save.runs > 0) {
      const statStr = `已出战 ${save.runs} 局  ·  守住树桩 ${save.wins} 次`;
      const st = this.add
        .text(LX + 14, statY, statStr, { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffd44c' })
        .setOrigin(0, 0.5)
        .setDepth(31);
      const sg = this.add.graphics().setDepth(30);
      drawChamferPlate(sg, LX, statY - 15, st.width + 28, 30, {
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
      .text(LX + 14, H - 36, hint, { fontFamily: FONT_FAMILY, fontSize: fontPx(14), fontStyle: 'bold', color: '#c4c5ce' })
      .setOrigin(0, 0.5)
      .setDepth(31);
    const hw = hintText.width + 28;
    const hintBg = this.add.graphics().setDepth(30);
    drawChamferPlate(hintBg, LX, H - 50, hw, 28, {
      fill: 0x18191e,
      fillAlpha: 0.96,
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

    this.input.keyboard!.once('keydown-ENTER', savedRun ? resume : start);
    this.input.keyboard!.once('keydown-SPACE', savedRun ? resume : start);
    fadeInScene(this);
  }

  /** 每日挑战弹窗：展示今日固定角色、初始武器、天气难度与 2 条随机突变词条 */
  private openDailyModal(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const daily = getDailyChallenge();
    const char = CHARACTERS[daily.character];
    const diff = DIFFICULTIES[daily.difficulty];
    const weap = daily.weapon ? WEAPONS[daily.weapon] : null;
    const best = getDailyBest(daily.dateKey);

    const c = this.add.container(0, 0).setDepth(100);
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
    c.add(label(this, bx, by + 94, `${diff.name} · ${weap ? weap.name : '工蚁随从'}`, 13, COLOR.dim).setOrigin(0.5));

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

  /** 设置弹窗 */
  private openSettings(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    const pw = 580;
    const ph = 420;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const bg = panel(this, px, py, pw, ph, COLOR.border, COLOR.panel, 2, COLOR.gold);
    const title = displayLabel(this, W / 2, py + 44, '游戏设置', 32, COLOR.text).setOrigin(0.5);
    const div = divider(this, px + 32, py + 78, pw - 64);
    c.add([dim, bg, title, div]);
    addSettingsButtons(this, c, W / 2, py + 126, {
      showSaveTransfer: true,
      onSaveImported: () => {
        c.destroy();
        this.scene.restart();
      },
    });
    c.add(createButton(this, W / 2, py + 362, '完成', () => c.destroy(), { width: 220, height: 52 }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.weatherFx.update(dt);
    this.beetle.animate(dt, 0.45);
    this.beetle.rotation = -Math.PI * 0.62 + Math.sin(this.elapsed * 0.85) * 0.07;

    // 武器随鼠标指针实时瞄准互动 + 微距景深视差
    const p = this.input.activePointer;
    const pt = uiPointer(p);
    const hasPointer = p.x > 0 || p.y > 0;
    const targetPx = hasPointer ? Phaser.Math.Clamp((pt.x - GAME_WIDTH / 2) / (GAME_WIDTH / 2), -1, 1) : 0;
    const targetPy = hasPointer ? Phaser.Math.Clamp((pt.y - GAME_HEIGHT / 2) / (GAME_HEIGHT / 2), -1, 1) : 0;
    const lerpK = 1 - Math.exp(-dt * 6);
    this.px += (targetPx - this.px) * lerpK;
    this.py += (targetPy - this.py) * lerpK;

    this.groundImg.setPosition(HERO_X - this.px * 4, HERO_Y + 6 - this.py * 3);
    this.beetle.setPosition(HERO_X - this.px * 7, HERO_Y - this.py * 5);
    const haloCx = HERO_X - this.px * 7;
    const haloCy = HERO_Y - this.py * 5;

    for (const h of this.halo) {
      const sx = haloCx + Math.cos(h.baseAngle) * h.rx;
      const sy = haloCy + Math.sin(h.baseAngle) * h.ry;
      const wave = Math.sin(this.elapsed * 2.3 + h.phase);
      const bob = wave * 5;
      const aim = hasPointer
        ? Math.atan2(pt.y - (sy + bob), pt.x - sx)
        : h.baseAngle + Math.sin(this.elapsed * 1.35 + h.phase) * 0.08;
      const flipY = Math.cos(aim) < 0;

      h.groundShadow.setPosition(sx + 2, sy + 24).setScale(1 - wave * 0.08, 1 - wave * 0.05);
      h.aura.setPosition(sx, sy + bob);
      h.sprite.setPosition(sx, sy + bob).setRotation(aim).setFlipY(flipY).setScale(h.scale);
      h.spriteShadow.setPosition(sx + 3, sy + bob + 5).setRotation(aim).setFlipY(flipY).setScale(h.scale);
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
