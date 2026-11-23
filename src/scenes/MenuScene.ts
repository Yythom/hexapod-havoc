import Phaser from 'phaser';
import { DISPLAY_FONT, FONT_FAMILY, fontPx, GAME_HEIGHT, GAME_WIDTH, IS_COARSE_POINTER } from '../config';
import { loadSave } from '../core/save';
import { BeetleView, SLOT_COUNT } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton, slantPoints } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import { addSettingsButtons } from '../ui/settingsButtons';
import { COLOR, displayLabel, divider, panel } from '../ui/widgets';

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
  amp: number;
  speed: number;
  phase: number;
}

/** 菜单展示 6 把不同武器与不同品阶（普通~传说），直观传达六足武装与锻造进化 */
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

export class MenuScene extends Phaser.Scene {
  private beetle!: BeetleView;
  private motes: DustMote[] = [];
  private grass: SwayGrass[] = [];
  private reticle!: Phaser.GameObjects.Graphics;
  private weatherFx!: WeatherAmbience;
  private elapsed = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupUICamera(this);
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    this.elapsed = 0;
    this.motes = [];
    this.grass = [];

    // 1. 背景：将战场中央树桩对准右侧主角舞台（非对称三分法构图）
    this.add.image(HERO_X, HERO_Y + 6, 'ground');

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

    // 4. 右侧特写主角舞台：双环准星 + 巨型武装锹甲（六把武器随鼠标实时瞄准！）
    this.reticle = this.add.graphics().setPosition(HERO_X, HERO_Y).setDepth(6);
    this.reticle.lineStyle(2, 0xf0efe9, 0.22);
    this.reticle.strokeCircle(0, 0, 152);
    this.reticle.lineStyle(2.8, 0xf0b238, 0.52);
    for (let k = 0; k < 4; k++) {
      const a0 = (k * Math.PI) / 2 + 0.18;
      const a1 = a0 + Math.PI / 2 - 0.36;
      this.reticle.beginPath();
      this.reticle.arc(0, 0, 174, a0, a1);
      this.reticle.strokePath();
    }

    this.beetle = new BeetleView(this, HERO_X, HERO_Y, 'beetle-stag')
      .setScale(3.15)
      .setRotation(-Math.PI * 0.62)
      .setDepth(8);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const [tex, tier] = SHOWCASE[i];
      this.beetle.setWeapon(i, tex, tier);
      this.beetle.setWeaponAim(i, this.beetle.rotation + this.beetle.tipLocalAngle(i));
    }

    // 5. 微距前景草叶剪影（四角框景，营造 1cm 昆虫视角景深）
    const addGrass = (x: number, y: number, key: string, ox: number, oy: number, sx: number, sy: number, amp: number, phase: number) => {
      const img = this.add.image(x, y, key).setOrigin(ox, oy).setScale(sx, sy).setDepth(25).setAlpha(0.88);
      this.grass.push({ img, amp, speed: 1.1, phase });
    };
    addGrass(-14, -10, 'ui-macro-grass-tl', 0, 0, 0.58, 0.58, 0.022, 0);
    addGrass(W + 14, -10, 'ui-macro-grass-tl', 0, 0, -0.48, 0.48, -0.02, 1.3);
    addGrass(W + 14, H + 12, 'ui-macro-grass-br', 1, 1, 0.62, 0.62, 0.024, 2.1);
    addGrass(-14, H + 12, 'ui-macro-grass-br', 1, 1, -0.5, 0.5, -0.022, 3.4);

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
    this.tweens.add({ targets: titleObj, y: 223, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add
      .text(LX + 2, 294, '六条腿，六把武器，守住后院最后一截树桩。', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#b8b9c2',
        stroke: '#050507',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setDepth(16);

    const start = () => this.scene.start('CharacterSelect');
    createButton(this, LX + 160, 396, '开始战斗 ▶', start, { width: 318, height: 70, fontSize: 28, shape: 'slant' }).setDepth(30);
    createButton(this, LX + 114, 482, '游戏设置', () => this.openSettings(), {
      width: 226,
      height: 50,
      fontSize: 20,
      primary: false,
      shape: 'slant',
      leftIcon: 'ui-gear',
    }).setDepth(30);

    // 7. 生涯战绩印记 & 操作提示
    if (save.runs > 0) {
      const statStr = `已出战 ${save.runs} 局  ·  守住树桩 ${save.wins} 次`;
      const st = this.add
        .text(LX + 14, 548, statStr, { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#ffd44c' })
        .setOrigin(0, 0.5)
        .setDepth(31);
      const sg = this.add.graphics().setDepth(30);
      sg.fillStyle(0x050507, 0.92);
      sg.fillRoundedRect(LX + 3, 535, st.width + 28, 30, 5);
      sg.fillStyle(0x1b1c22, 1);
      sg.fillRoundedRect(LX, 532, st.width + 28, 30, 5);
      sg.lineStyle(2.4, 0x050507, 1);
      sg.strokeRoundedRect(LX, 532, st.width + 28, 30, 5);
    }

    const hint = IS_COARSE_POINTER
      ? '按住屏幕任意位置拖动移动 · 武器自动开火'
      : 'WASD / 方向键移动 · 武器自动瞄准开火 · P / ESC 暂停';
    const hintText = this.add
      .text(LX + 14, H - 36, hint, { fontFamily: FONT_FAMILY, fontSize: fontPx(14), fontStyle: 'bold', color: '#c4c5ce' })
      .setOrigin(0, 0.5)
      .setDepth(31);
    const hw = hintText.width + 28;
    const hintBg = this.add.graphics().setDepth(30);
    hintBg.fillStyle(0x050507, 0.88);
    hintBg.fillRoundedRect(LX + 3, H - 49, hw, 28, 5);
    hintBg.fillStyle(0x18191e, 0.95);
    hintBg.fillRoundedRect(LX, H - 51, hw, 28, 5);
    hintBg.lineStyle(2.2, 0x050507, 1);
    hintBg.strokeRoundedRect(LX, H - 51, hw, 28, 5);

    this.add
      .text(W - 22, H - 18, 'v0.5', { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: '#787a84' })
      .setOrigin(1, 1)
      .setDepth(30);

    this.input.keyboard!.once('keydown-ENTER', start);
    this.input.keyboard!.once('keydown-SPACE', start);
  }

  /** 设置弹窗 */
  private openSettings(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x050507, 0.74).setOrigin(0).setInteractive();
    const pw = 580;
    const ph = 292;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const bg = panel(this, px, py, pw, ph, COLOR.border, COLOR.panel, 2, COLOR.gold);
    const title = displayLabel(this, W / 2, py + 44, '游戏设置', 32, COLOR.text).setOrigin(0.5);
    const div = divider(this, px + 32, py + 78, pw - 64);
    c.add([dim, bg, title, div]);
    addSettingsButtons(this, c, W / 2, py + 136);
    c.add(createButton(this, W / 2, py + 228, '完成', () => c.destroy(), { width: 220, height: 54 }));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.weatherFx.update(dt);
    this.beetle.animate(dt, 0.45);
    this.beetle.rotation = -Math.PI * 0.62 + Math.sin(this.elapsed * 0.85) * 0.07;

    // 武器随鼠标指针实时瞄准互动（无鼠标移动时保持自然外指）
    const p = this.input.activePointer;
    const hasPointer = p.x > 0 || p.y > 0;
    const tipVec = new Phaser.Math.Vector2();
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (hasPointer) {
        this.beetle.tipWorld(i, tipVec);
        const target = Math.atan2(p.y - tipVec.y, p.x - tipVec.x);
        this.beetle.setWeaponAim(i, target);
      } else {
        this.beetle.setWeaponAim(i, this.beetle.rotation + this.beetle.tipLocalAngle(i));
      }
    }

    this.reticle.rotation += dt * 0.22;
    for (const g of this.grass) {
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
