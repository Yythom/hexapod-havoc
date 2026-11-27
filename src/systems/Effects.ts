import Phaser from 'phaser';
import { DAMAGE_FONT, DAMAGE_FONT_SIZE, ensureDamageFont } from '../art/damageFont';
import { DEPTH, FONT_FAMILY, IS_COARSE_POINTER } from '../config';
import { getSettings } from '../core/settings';

export type NumberKind = 'normal' | 'crit' | 'player' | 'dodge' | 'heal' | 'level' | 'poison' | 'shield' | 'burn';

/** 纯数字用位图文字（便宜），带汉字的少数提示（闪避、升级！）用普通文字 */
type FloatObject = Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text;

interface FloatText {
  obj: FloatObject;
  bitmap: boolean;
  life: number;
  vx: number;
  vy: number;
  /** 本条数字的基础缩放（位图字体按字号换算） */
  baseScale: number;
}

const NUMERIC = /^[+-]?\d+$/;

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  streak: boolean;
  glow: boolean;
}

const MAX_TEXTS = 80;
/** 手机上伤害数字放大一点 */
const NUMBER_BOOST = IS_COARSE_POINTER ? 1.2 : 1;
const MAX_PARTICLES = 480;
const TEXT_LIFE = 0.68;

const NUMBER_STYLE: Record<NumberKind, { color: number; size: number; scale: number }> = {
  normal: { color: 0xffffff, size: 20, scale: 1 },
  crit: { color: 0xffd23f, size: 27, scale: 1.38 },
  player: { color: 0xff5a4a, size: 24, scale: 1.22 },
  dodge: { color: 0xcfe8ff, size: 18, scale: 1 },
  heal: { color: 0x7dff8a, size: 20, scale: 1 },
  level: { color: 0xffe27a, size: 26, scale: 1.22 },
  poison: { color: 0xa8f060, size: 16, scale: 1 },
  shield: { color: 0x9fd8ff, size: 20, scale: 1.1 },
  burn: { color: 0xffa040, size: 16, scale: 1 },
};

interface Ring {
  x: number;
  y: number;
  r: number;
  color: number;
  t: number;
}

interface Bolt {
  pts: number[];
  t: number;
}

export type SlashVariant = 'blade' | 'fire' | 'electric' | 'ethereal' | 'heavy' | 'saw' | 'whip' | 'holy';
export type ThrustVariant = 'needle' | 'electric' | 'ethereal' | 'music' | 'drill' | 'fire';
export type ChompVariant = 'jaw' | 'punch' | 'firePunch';
export type BashVariant = 'slam' | 'shield' | 'plasma' | 'explosive' | 'rock';
export type SonicVariant = 'lance' | 'trident' | 'fire' | 'electric';

interface Slash {
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
  color: number;
  tier: number;
  variant: SlashVariant;
  seed: number;
  t: number;
  total: number;
}

interface Thrust {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  width: number;
  tier: number;
  variant: ThrustVariant;
  seed: number;
  t: number;
  total: number;
}

interface Beam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  tier: number;
  t: number;
  total: number;
}

interface Zap {
  pts: number[];
  branches: number[][];
  nodes: number[];
  tier: number;
  t: number;
}

interface Chomp {
  x: number;
  y: number;
  ang: number;
  r: number;
  color: number;
  tier: number;
  variant: ChompVariant;
  seed: number;
  t: number;
  total: number;
}

interface BashWave {
  x: number;
  y: number;
  ang: number;
  arc: number;
  r: number;
  color: number;
  tier: number;
  variant: BashVariant;
  seed: number;
  t: number;
  total: number;
}

interface StarBurst {
  x: number;
  y: number;
  r: number;
  rot: number;
  color: number;
  t: number;
  total: number;
}

interface SonicThrust {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  width: number;
  rings: number;
  tier: number;
  variant: SonicVariant;
  t: number;
  total: number;
}

interface Tracer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  width: number;
  t: number;
  total: number;
}

interface ShellCasing {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  bounces: number;
  t: number;
  total: number;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r0: number;
  r1: number;
  color: number;
  t: number;
  total: number;
}

interface ExplosionPuff {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  r: number;
  delay: number;
}

interface ComicExplosion {
  x: number;
  y: number;
  r: number;
  color: number;
  tier: number;
  puffs: ExplosionPuff[];
  t: number;
  total: number;
}

interface HitSlash {
  x: number;
  y: number;
  ang: number;
  color: number;
  scale: number;
  t: number;
  total: number;
}

interface Tether {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  getTarget: () => { x: number; y: number };
  color: number;
  t: number;
  total: number;
}

interface PoisonBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wob: number;
  r: number;
  t: number;
  total: number;
}

interface IceShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  len: number;
  w: number;
  t: number;
  total: number;
}

interface Splat {
  img: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  baseAlpha: number;
}

interface SpriteFx {
  img: Phaser.GameObjects.Image;
  t: number;
  delay: number;
  total: number;
  s0: number;
  s1: number;
  rot0: number;
  rotDelta: number;
  alpha0: number;
  fadeIn: number;
  addBlend: boolean;
}

const VFX_TEX_SIZE = 256;
const MAX_SPRITE_FX = 180;
const RING_TIME = 0.32;
const BOLT_TIME = 0.2;
const ZAP_TIME = 0.18;
const MAX_SPLATS = 85;
const SPLAT_LIFE = 5.5;
const CRATER_LIFE = 3.2;
const MAX_TRACERS = 160;
const MAX_SHELLS = 44;
const MAX_SMOKES = 56;
const MAX_BUBBLES = 54;
const MAX_SHARDS = 68;
const MAX_TETHERS = 24;
const MAX_HIT_SLASHES = 48;
/** 传说品阶（IV级）双色高能辉光 */
const LEGENDARY_GOLD = 0xffe46b;
const LEGENDARY_VIOLET = 0xff7ae8;

/** 伤害数字、粒子、近战刀光、地面虫液战痕、闪光等一次性特效，全部走对象池 */
export class Effects {
  private readonly texts: FloatText[] = [];
  private readonly freeBitmaps: FloatText[] = [];
  private readonly freeTexts: FloatText[] = [];
  private readonly particles: Particle[] = [];
  private readonly freeParticles: Particle[] = [];
  private readonly splats: Splat[] = [];
  private readonly freeSplats: Phaser.GameObjects.Image[] = [];
  private readonly spriteFx: SpriteFx[] = [];
  private readonly freeSpriteFx: Phaser.GameObjects.Image[] = [];
  private slashFlip = false;
  private readonly rings: Ring[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly slashes: Slash[] = [];
  private readonly thrusts: Thrust[] = [];
  private readonly beams: Beam[] = [];
  private readonly zaps: Zap[] = [];
  private readonly chomps: Chomp[] = [];
  private readonly bashes: BashWave[] = [];
  private readonly stars: StarBurst[] = [];
  private readonly sonics: SonicThrust[] = [];
  private readonly tracers: Tracer[] = [];
  private readonly shells: ShellCasing[] = [];
  private readonly smokes: SmokePuff[] = [];
  private readonly explosions: ComicExplosion[] = [];
  private readonly hitSlashes: HitSlash[] = [];
  private readonly tethers: Tether[] = [];
  private readonly bubbles: PoisonBubble[] = [];
  private readonly shards: IceShard[] = [];
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly glowG: Phaser.GameObjects.Graphics;
  /** 后期满屏防糊阀：根据活跃特效密度平滑压低 ADD 发光层透明度 */
  private glowMult = 1;
  private stagger = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.effect);
    this.glowG = scene.add.graphics().setDepth(DEPTH.effect + 1).setBlendMode(Phaser.BlendModes.ADD);
    ensureDamageFont(scene);
  }

  /** 投放一枚预烘焙 Canvas 2D 高质感特效贴图（走对象池、零 GC） */
  private spawnSpriteFx(o: {
    key: string;
    x: number;
    y: number;
    s0: number;
    s1: number;
    rot0: number;
    rotDelta?: number;
    alpha0?: number;
    fadeIn?: number;
    delay?: number;
    total: number;
    tint?: number | null;
    flipY?: boolean;
    addBlend?: boolean;
    depth?: number;
  }): void {
    let img = this.freeSpriteFx.pop();
    if (!img) {
      if (this.spriteFx.length >= MAX_SPRITE_FX) {
        const oldest = this.spriteFx.shift()!;
        img = oldest.img;
      } else {
        img = this.scene.add.image(o.x, o.y, o.key);
      }
    }
    const addBlend = !!o.addBlend;
    img
      .setTexture(o.key)
      .setPosition(o.x, o.y)
      .setRotation(o.rot0)
      .setScale(o.s0)
      .setFlipY(!!o.flipY)
      .setDepth(o.depth ?? (addBlend ? DEPTH.effect + 1 : DEPTH.effect))
      .setBlendMode(addBlend ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setAlpha(o.delay && o.delay > 0 ? 0 : o.fadeIn ? 0 : (o.alpha0 ?? 1))
      .setVisible(true);
    if (o.tint !== undefined && o.tint !== null) img.setTint(o.tint);
    else img.clearTint();

    this.spriteFx.push({
      img,
      t: -(o.delay ?? 0),
      delay: o.delay ?? 0,
      total: o.total,
      s0: o.s0,
      s1: o.s1,
      rot0: o.rot0,
      rotDelta: o.rotDelta ?? 0,
      alpha0: o.alpha0 ?? 1,
      fadeIn: o.fadeIn ?? 0.025,
      addBlend,
    });
  }

  /** 扩散的能量冲击波环（预烘焙柔边羽化环，严格收在 r 内） */
  ring(x: number, y: number, r: number, color = 0xffffff): void {
    const full = (r * 2) / VFX_TEX_SIZE;
    this.spawnSpriteFx({
      key: 'fx-nova-ring',
      x,
      y,
      s0: full * 0.36,
      s1: full,
      rot0: Math.random() * Math.PI * 2,
      alpha0: 0.9,
      fadeIn: 0.02,
      total: RING_TIME,
      tint: color,
      addBlend: false,
    });
  }

  /** 近战扇形横扫刀光（高质感预烘焙笔触贴图，严格限制在攻击半径 r 之内；空挥不喷爆炸火花） */
  slash(
    x: number,
    y: number,
    r: number,
    angle: number,
    _arc: number,
    color = 0x78d0ff,
    tier = 0,
    variant: SlashVariant = 'blade',
  ): void {
    const full = (r * 2) / VFX_TEX_SIZE;
    const isTintable = variant === 'blade' || variant === 'heavy';
    const flip = variant === 'whip' ? false : (this.slashFlip = !this.slashFlip);
    const dir = flip ? -1 : 1;

    if (variant === 'whip') {
      this.spawnSpriteFx({
        key: 'fx-slash-whip',
        x,
        y,
        s0: full * 0.72,
        s1: full,
        rot0: angle,
        rotDelta: 0,
        alpha0: 0.96,
        fadeIn: 0.018,
        total: 0.17,
        tint: null,
      });
      return;
    }

    const total = variant === 'heavy' ? 0.21 : 0.18 + Math.min(2, tier) * 0.012;
    this.spawnSpriteFx({
      key: `fx-slash-${variant}`,
      x,
      y,
      s0: full * 0.88,
      s1: full,
      rot0: angle - 0.32 * dir,
      rotDelta: 0.46 * dir,
      alpha0: 0.95,
      fadeIn: 0.02,
      total,
      tint: isTintable ? color : null,
      flipY: flip,
    });

    // 高品阶（IV 阶传说）叠加内层轻盈金辉余韵，保持在 0.86*r 内绝不越界
    if (tier >= 3 && isTintable) {
      this.spawnSpriteFx({
        key: 'fx-slash-holy',
        x,
        y,
        s0: full * 0.78,
        s1: full * 0.88,
        rot0: angle - 0.36 * dir,
        rotDelta: 0.48 * dir,
        alpha0: 0.55,
        fadeIn: 0.02,
        delay: 0.02,
        total: total * 0.92,
        tint: null,
        flipY: flip,
      });
    }
  }

  /** 范围横扫实际命中目标时的克制特效（严格收在命中点小半径内，不超出武器攻击范围） */
  sweepHitBurst(x: number, y: number, maxR: number, ang: number, color: number, variant: SlashVariant): void {
    const capR = Math.max(8, Math.min(28, maxR));
    const spd = Math.min(135, capR * 4.2);
    if (variant === 'fire') {
      this.burst(x, y, 0xff9828, 3, spd, 0.58);
    } else if (variant === 'electric' || variant === 'holy') {
      this.star(x, y, Math.min(13, capR * 0.55), variant === 'holy' ? LEGENDARY_GOLD : color, ang);
      this.streaks(x, y, ang, color, 2, spd, 0.56);
    } else if (variant === 'saw') {
      this.streaks(x, y, ang + Math.PI * 0.35, 0xffd258, 3, spd, 0.58);
    } else if (variant === 'whip') {
      this.star(x, y, Math.min(13, capR * 0.55), 0xfff0a0, ang);
    } else if (variant === 'heavy') {
      this.burst(x, y, color, 2, spd * 0.85, 0.55);
    }
  }

  /** 近战直刺 / 雷针 / 幽灵刃 / 乐声音波 / 螺旋钻角 */
  thrust(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color = 0x78e8ff,
    width = 6,
    tier = 0,
    variant: ThrustVariant = 'needle',
  ): void {
    const total = variant === 'music' ? 0.24 : variant === 'ethereal' || variant === 'drill' ? 0.16 : 0.13;
    this.thrusts.push({ x0, y0, x1, y1, color, width, tier, variant, seed: Math.random() * 100, t: 0, total });
  }

  /** 带破风冲击环的重型突刺（长角 / 骑甲长枪 / 三叉戟 / 锥刺） */
  sonicThrust(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color = 0xffc858,
    width = 9,
    rings = 2,
    tier = 0,
    variant: SonicVariant = 'lance',
  ): void {
    this.sonics.push({ x0, y0, x1, y1, color, width, rings: rings + (tier >= 2 ? 1 : 0), tier, variant, t: 0, total: 0.17 });
  }

  /** 钳颚夹击 / 拳击气爆 */
  chomp(
    x: number,
    y: number,
    ang: number,
    r: number,
    color = 0xffbe48,
    tier = 0,
    variant: ChompVariant = 'jaw',
  ): void {
    this.chomps.push({ x, y, ang, r, color, tier, variant, seed: Math.random() * 100, t: 0, total: 0.18 });
  }

  /** 重锤砸地 / 甲壳盾推 / 等离子锤 / 滚石撞击（仅命中目标触发；使用 256×256 立体质感贴图，严格收在半径 r 内） */
  bash(
    x: number,
    y: number,
    ang: number,
    _arc: number,
    r: number,
    color = 0xff9a48,
    _tier = 0,
    variant: BashVariant = 'slam',
  ): void {
    if (variant === 'shield') {
      const full = (r * 2) / VFX_TEX_SIZE;
      this.spawnSpriteFx({
        key: 'fx-bash-shield',
        x,
        y,
        s0: full * 0.62,
        s1: full,
        rot0: ang,
        alpha0: 0.96,
        fadeIn: 0.018,
        total: 0.24,
        tint: null,
      });
      this.streaks(x + Math.cos(ang) * r * 0.56, y + Math.sin(ang) * r * 0.56, ang, color, 2, Math.min(115, r * 1.1), 0.6);
      return;
    }

    const ix = x + Math.cos(ang) * r * 0.52;
    const iy = y + Math.sin(ang) * r * 0.52;
    const maxLocalR = r * 0.44;
    const full = (maxLocalR * 2) / VFX_TEX_SIZE;
    // 纯地面开裂效果：迅速砸开后在地面短暂停留淡出，不叠加多余光圈
    this.spawnSpriteFx({
      key: `fx-bash-${variant}`,
      x: ix,
      y: iy,
      s0: full * 0.82,
      s1: full,
      rot0: ang + (Math.random() - 0.5) * 0.5,
      alpha0: 0.94,
      fadeIn: 0.015,
      total: 0.48,
      tint: null,
      depth: DEPTH.ground + 2,
    });

    const spd = Math.min(105, maxLocalR * 2.0);
    if (variant === 'rock') {
      this.burst(ix, iy, 0xb8844c, 3, spd, 0.65);
    } else if (variant === 'slam') {
      this.burst(ix, iy, 0x9c8264, 2, spd * 0.8, 0.58);
    }
  }

  /** 四芒爆闪星光（收短收小，克制点缀） */
  star(x: number, y: number, r = 12, color = 0xffe878, rot = Math.random() * Math.PI): void {
    this.stars.push({ x, y, r: r * 0.72, rot, color, t: 0, total: 0.11 });
  }

  /** 定向漫画速度线碎屑（普通混合模式，绝不 ADD 叠加过曝） */
  streaks(x: number, y: number, ang: number, color: number, count: number, speed = 165, size = 0.7): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = ang + (Math.random() - 0.5) * 0.95;
      const v = speed * (0.45 + Math.random() * 0.55);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.12 + Math.random() * 0.1;
      p.size = size * 0.75 * (0.7 + Math.random() * 0.45);
      p.streak = true;
      p.glow = false;
      p.img
        .setTexture('fx-streak')
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(0.88)
        .setScale(p.size)
        .setVisible(true);
    }
  }

  /** 枪械/元素发射口极短小闪焰（不画光束、不刺眼） */
  muzzle(x: number, y: number, ang: number, color = 0xffe498, len = 10, count = 2, _tier = 0): void {
    this.star(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, Math.min(9, len * 0.45), color, ang);
    if (count > 0) this.streaks(x, y, ang, color, Math.min(2, count), 120, 0.5);
  }

  /** 轻量高速弹道拖尾线段（1~2 帧渐隐，统一画在 Graphics 层） */
  tracer(x0: number, y0: number, x1: number, y1: number, color = 0xffe898, width = 2.2, life = 0.075): void {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    this.tracers.push({ x0, y0, x1, y1, color, width, t: 0, total: life });
  }

  /** 枪械开火抛出的黄铜弹壳（侧向抛物线 + 落地轻弹一下淡出） */
  shellCasing(x: number, y: number, ejectAngle: number): void {
    if (this.shells.length >= MAX_SHELLS) this.shells.shift();
    const a = ejectAngle + (Math.random() - 0.5) * 0.5;
    const spd = 55 + Math.random() * 48;
    this.shells.push({
      x,
      y,
      z: 6 + Math.random() * 3,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      vz: 72 + Math.random() * 38,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 10),
      bounces: 0,
      t: 0,
      total: 0.65 + Math.random() * 0.25,
    });
  }

  /** 霰弹/重炮枪口快速消散的小白烟 */
  smoke(x: number, y: number, ang: number, count = 3, color = 0xe8e2d6): void {
    for (let i = 0; i < count; i++) {
      if (this.smokes.length >= MAX_SMOKES) this.smokes.shift();
      const a = ang + (Math.random() - 0.5) * 0.9;
      const spd = 28 + Math.random() * 52;
      this.smokes.push({
        x: x + Math.cos(a) * (4 + Math.random() * 5),
        y: y + Math.sin(a) * (4 + Math.random() * 5),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 12,
        r0: 3.5 + Math.random() * 2.5,
        r1: 9.5 + Math.random() * 5.5,
        color,
        t: 0,
        total: 0.26 + Math.random() * 0.14,
      });
    }
  }

  /** 三段式体积感爆破（灼白热核 -> 立体翻涌火球 -> 暗灰烟云 + 精准 1:1 伤害外环 + 焦黑弹坑，全部严格收在 r 内） */
  explosion(x: number, y: number, r: number, color = 0xff7830, tier = 0): void {
    const full = (r * 2) / VFX_TEX_SIZE;
    const rot = Math.random() * Math.PI * 2;
    // 1) 瞬时灼白热核闪球
    this.spawnSpriteFx({
      key: 'fx-exp-core',
      x,
      y,
      s0: full * 0.36,
      s1: full * 0.86,
      rot0: rot,
      rotDelta: 0.22,
      alpha0: 0.96,
      fadeIn: 0.01,
      total: 0.14,
      addBlend: true,
    });
    // 2) 立体体积火球云团
    this.spawnSpriteFx({
      key: 'fx-exp-fire',
      x,
      y,
      s0: full * 0.46,
      s1: full,
      rot0: rot,
      rotDelta: 0.16,
      alpha0: 0.96,
      fadeIn: 0.02,
      delay: 0.02,
      total: 0.3,
    });
    // 3) 暗灰翻滚余烟
    this.spawnSpriteFx({
      key: 'fx-exp-smoke',
      x,
      y,
      s0: full * 0.64,
      s1: full,
      rot0: rot + 0.8,
      rotDelta: -0.14,
      alpha0: 0.78,
      fadeIn: 0.05,
      delay: 0.1,
      total: 0.38,
    });
    // 4) 1:1 真实伤害外环
    this.ring(x, y, r, tier >= 3 ? LEGENDARY_GOLD : color);
    this.streaks(x, y, Math.random() * Math.PI * 2, color, 4 + Math.min(3, Math.round(r / 24)), Math.min(160, r * 2.1), 0.72);
    this.crater(x, y, r * 0.72);
  }

  /** 子弹穿透敌人时在背后迸出的克制定向穿透线（清晰区分穿透与单体，不抢戏） */
  pierceBreak(x: number, y: number, ang: number, color = 0xfff0a8): void {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    this.tracer(x - c * 6, y - s * 6, x + c * 20, y + s * 20, color, 2.2, 0.09);
    this.streaks(x + c * 6, y + s * 6, ang, color, 2, 175, 0.55);
  }

  /** 单体子弹命中并立刻消散时的极简小碎屑（无多余闪光） */
  bulletImpact(x: number, y: number, ang: number, color = 0xffe498): void {
    this.burst(x, y, color, 2, 75, 0.45, false);
    this.streaks(x, y, ang + Math.PI, color, 1, 95, 0.42);
  }

  /** 爆炸地面焦黑弹坑印记（约 3 秒淡出，复用地面痕迹对象池） */
  crater(x: number, y: number, radius = 36): void {
    let img: Phaser.GameObjects.Image;
    if (this.freeSplats.length > 0) {
      img = this.freeSplats.pop()!;
    } else if (this.splats.length >= MAX_SPLATS) {
      const oldest = this.splats.shift()!;
      img = oldest.img;
    } else {
      img = this.scene.add.image(x, y, 'fx-crater').setDepth(DEPTH.ground + 1);
    }
    const scale = Phaser.Math.Clamp(radius / 28, 0.55, 2.1);
    const baseAlpha = 0.72;
    img
      .setTexture('fx-crater')
      .setPosition(x, y)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(scale * Phaser.Math.FloatBetween(0.92, 1.08), scale * Phaser.Math.FloatBetween(0.84, 1.02))
      .clearTint()
      .setAlpha(baseAlpha)
      .setVisible(true);
    this.splats.push({ img, life: CRATER_LIFE, maxLife: CRATER_LIFE, baseAlpha });
  }

  /** 近战/重击实际命中时的定向交叉白斩痕（区分砍中与挥空） */
  hitSlash(x: number, y: number, ang: number, color = 0xffffff, scale = 1): void {
    if (this.hitSlashes.length >= MAX_HIT_SLASHES) this.hitSlashes.shift();
    this.hitSlashes.push({ x, y, ang, color, scale, t: 0, total: 0.12 });
  }

  /** 吸血 / 回血光丝：从受击敌人飞出弧线光点吸入甲虫体内 */
  tether(x0: number, y0: number, getTarget: () => { x: number; y: number }, color = 0xff4d6d): void {
    if (this.tethers.length >= MAX_TETHERS) this.tethers.shift();
    const tgt = getTarget();
    const mx = (x0 + tgt.x) * 0.5;
    const my = (y0 + tgt.y) * 0.5;
    const dx = tgt.x - x0;
    const dy = tgt.y - y0;
    const len = Math.hypot(dx, dy) || 1;
    const side = Math.random() < 0.5 ? 1 : -1;
    const bow = Math.min(68, Math.max(24, len * 0.32)) * side;
    this.tethers.push({
      x0,
      y0,
      cx: mx + (-dy / len) * bow,
      cy: my + (dx / len) * bow,
      getTarget,
      color,
      t: 0,
      total: 0.28,
    });
  }

  /** 叠毒/毒伤上升毒泡（亮绿漫画空心泡 + 高光点） */
  poisonBubbles(x: number, y: number, count = 3): void {
    for (let i = 0; i < count; i++) {
      if (this.bubbles.length >= MAX_BUBBLES) this.bubbles.shift();
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 18,
        vy: -(24 + Math.random() * 26),
        wob: Math.random() * Math.PI * 2,
        r: 2.6 + Math.random() * 2.4,
        t: 0,
        total: 0.42 + Math.random() * 0.22,
      });
    }
  }

  /** 冰晶碎裂：锐利冰碴飞溅（冻结、解冻、冰碎击杀） */
  iceShatter(x: number, y: number, radius = 14, count = 6): void {
    for (let i = 0; i < count; i++) {
      if (this.shards.length >= MAX_SHARDS) this.shards.shift();
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const spd = 85 + Math.random() * 125;
      this.shards.push({
        x: x + Math.cos(a) * radius * 0.35,
        y: y + Math.sin(a) * radius * 0.35,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        rot: a,
        vrot: (Math.random() - 0.5) * 16,
        len: 5.5 + Math.random() * 4.5,
        w: 2.4 + Math.random() * 1.8,
        t: 0,
        total: 0.26 + Math.random() * 0.16,
      });
    }
  }

  /** 持续照射的光束（每次结算画一段，连起来像一直亮着） */
  beam(x0: number, y0: number, x1: number, y1: number, color = 0xffd060, total = 0.22, tier = 0): void {
    this.beams.push({ x0, y0, x1, y1, color, tier, t: 0, total });
  }

  /** 链式闪电：主电弧 + 随机分叉电须 + 跳跃节点电环 */
  zap(points: number[], tier = 0): void {
    const pts: number[] = [points[0], points[1]];
    const branches: number[][] = [];
    const nodes: number[] = [];
    for (let i = 2; i < points.length; i += 2) {
      const ax = points[i - 2];
      const ay = points[i - 1];
      const bx = points[i];
      const by = points[i + 1];
      nodes.push(bx, by);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const segAng = Math.atan2(by - ay, bx - ax);
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const segs = Math.max(2, Math.round(len / 28));
      const forkBudget = tier >= 2 ? 2 : 1;
      let forks = 0;
      for (let k = 1; k < segs; k++) {
        const t = k / segs;
        const off = (Math.random() - 0.5) * Math.min(26, len * 0.3);
        const px = ax + (bx - ax) * t + nx * off;
        const py = ay + (by - ay) * t + ny * off;
        pts.push(px, py);
        if (forks < forkBudget && (k === Math.floor(segs / 2) || Math.random() < 0.45)) {
          forks++;
          const side = Math.random() < 0.5 ? 1 : -1;
          const fa = segAng + side * (0.45 + Math.random() * 0.55);
          const fl = Math.min(34, Math.max(14, len * (0.24 + Math.random() * 0.16)));
          const midX = px + Math.cos(fa + (Math.random() - 0.5) * 0.4) * (fl * 0.55);
          const midY = py + Math.sin(fa + (Math.random() - 0.5) * 0.4) * (fl * 0.55);
          const endX = midX + Math.cos(fa + (Math.random() - 0.5) * 0.5) * (fl * 0.5);
          const endY = midY + Math.sin(fa + (Math.random() - 0.5) * 0.5) * (fl * 0.5);
          branches.push([px, py, midX, midY, endX, endY]);
        }
      }
      pts.push(bx, by);
    }
    this.zaps.push({ pts, branches, nodes, tier, t: 0 });
  }

  /** 枪口/命中轻闪火花 */
  spark(x: number, y: number, color = 0xffe498, count = 4): void {
    this.burst(x, y, color, count, 120, 0.55);
  }

  /** 从天而降的闪电 */
  bolt(x: number, y: number): void {
    const pts: number[] = [];
    const top = y - 260;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(x + (k === 0 || k === 6 ? 0 : (Math.random() - 0.5) * 38), Phaser.Math.Linear(top, y, t));
    }
    this.bolts.push({ pts, t: 0 });
  }

  number(x: number, y: number, value: number | string, kind: NumberKind = 'normal'): void {
    const dmgMode = getSettings().damageNumbers;
    if (dmgMode !== 'all') {
      const isEnemyDmg = kind === 'normal' || kind === 'poison' || kind === 'burn';
      if (dmgMode === 'crit' && isEnemyDmg) return;
      if (dmgMode === 'off' && (isEnemyDmg || kind === 'crit')) return;
    }
    const label = String(value);
    const bitmap = NUMERIC.test(label);
    const ft = this.acquire(bitmap);
    const st = NUMBER_STYLE[kind];
    const size = st.size * NUMBER_BOOST;
    if (bitmap) {
      const b = ft.obj as Phaser.GameObjects.BitmapText;
      b.setText(label).setTint(st.color);
      ft.baseScale = st.scale * (size / DAMAGE_FONT_SIZE);
    } else {
      const t = ft.obj as Phaser.GameObjects.Text;
      t.setText(label).setColor(`#${st.color.toString(16).padStart(6, '0')}`).setFontSize(Math.round(size));
      ft.baseScale = st.scale;
    }
    // 交替错开位置和微弱横飘，避免连击数字完全重叠
    this.stagger = (this.stagger + 1) % 5;
    const spread = (this.stagger - 2) * 8 + Phaser.Math.Between(-3, 3);
    const oy = (this.stagger % 2) * -6;
    ft.obj.setPosition(x + spread, y + oy).setAlpha(1).setScale(ft.baseScale).setVisible(true);
    ft.life = TEXT_LIFE;
    ft.vx = spread * 1.6;
    ft.vy = kind === 'crit' ? -96 : -80;
  }

  /** 击杀敌人后在地面留下缓慢渗入泥土的虫液痕迹 */
  splat(x: number, y: number, color: number, radius = 12): void {
    let img: Phaser.GameObjects.Image;
    if (this.freeSplats.length > 0) {
      img = this.freeSplats.pop()!;
    } else if (this.splats.length >= MAX_SPLATS) {
      const oldest = this.splats.shift()!;
      img = oldest.img;
    } else {
      img = this.scene.add.image(x, y, 'ui-splat').setDepth(DEPTH.ground + 1);
    }
    const scale = Phaser.Math.Clamp(radius / 16, 0.55, 1.55);
    const baseAlpha = 0.52;
    img
      .setTexture('ui-splat')
      .setPosition(x, y)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(scale * Phaser.Math.FloatBetween(0.9, 1.15), scale * Phaser.Math.FloatBetween(0.75, 1.05))
      .setTint(color)
      .setAlpha(baseAlpha)
      .setVisible(true);
    this.splats.push({ img, life: SPLAT_LIFE, maxLife: SPLAT_LIFE, baseAlpha });
  }

  burst(x: number, y: number, color: number, count: number, speed = 150, size = 1, _glow = false): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.2 + Math.random() * 0.22;
      p.size = size * 0.6 * (0.6 + Math.random() * 0.55);
      p.streak = false;
      p.glow = false;
      p.img
        .setTexture('dot')
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(0.92)
        .setScale(p.size)
        .setVisible(true);
    }
  }

  update(dt: number): void {
    this.updateShapes(dt);
    const dragTxt = Math.exp(-4 * dt);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.release(i);
        continue;
      }
      ft.vx *= dragTxt;
      ft.vy *= dragTxt;
      ft.obj.x += ft.vx * dt;
      ft.obj.y += ft.vy * dt;
      const t = 1 - ft.life / TEXT_LIFE;
      ft.obj.setScale(ft.baseScale * (t < 0.14 ? 1 + (0.14 - t) * 3.2 : 1));
      ft.obj.setAlpha(Math.min(1, ft.life / 0.24));
    }

    const drag = Math.exp(-5 * dt);
    const partGlowDim = this.particles.length > 140 ? Phaser.Math.Clamp(1 - (this.particles.length - 140) / 280, 0.55, 1) : 1;
    const addDim = Math.min(this.glowMult, partGlowDim);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        this.freeParticles.push(p);
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      const k = p.life / p.maxLife;
      if (p.streak) {
        p.img.setScale(p.size * (0.6 + 0.6 * k), p.size * (0.35 + 0.65 * k));
      } else {
        p.img.setScale(p.size * (0.35 + 0.65 * k));
      }
      p.img.setAlpha(p.glow ? k * addDim : k);
    }

    for (let i = this.splats.length - 1; i >= 0; i--) {
      const sp = this.splats[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.img.setVisible(false);
        this.freeSplats.push(sp.img);
        this.splats[i] = this.splats[this.splats.length - 1];
        this.splats.pop();
        continue;
      }
      if (sp.life < 2) sp.img.setAlpha(sp.baseAlpha * (sp.life / 2));
    }

    // 预烘焙高质感 Sprite 特效动画（刀光 / 地裂 / 体积爆炸 / 柔边冲击波）
    for (let i = this.spriteFx.length - 1; i >= 0; i--) {
      const sf = this.spriteFx[i];
      sf.t += dt;
      if (sf.t < 0) continue;
      if (sf.t >= sf.total) {
        sf.img.setVisible(false);
        this.freeSpriteFx.push(sf.img);
        this.spriteFx[i] = this.spriteFx[this.spriteFx.length - 1];
        this.spriteFx.pop();
        continue;
      }
      const k = sf.t / sf.total;
      const ease = Phaser.Math.Easing.Quadratic.Out(k);
      const scale = Phaser.Math.Linear(sf.s0, sf.s1, ease);
      const fadeIn = sf.fadeIn > 0 ? Math.min(1, sf.t / sf.fadeIn) : 1;
      const fadeOut = Math.pow(1 - k, 1.35);
      const alpha = sf.alpha0 * fadeIn * fadeOut * (sf.addBlend ? this.glowMult : 1);
      sf.img.setScale(scale).setRotation(sf.rot0 + sf.rotDelta * ease).setAlpha(alpha);
    }
  }

  private fillCrescent(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number,
    thickness: number,
    a0: number,
    a1: number,
    color: number,
    alpha: number,
    segs = 18,
  ): void {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const a = a0 + (a1 - a0) * t;
      const bulge = Math.sin(t * Math.PI);
      const rad = r + thickness * 0.35 * bulge;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    for (let k = segs; k >= 0; k--) {
      const t = k / segs;
      const a = a0 + (a1 - a0) * t;
      const bulge = Math.sin(t * Math.PI);
      const rad = r - thickness * 0.72 * bulge;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  private fillLance(
    g: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    halfW: number,
    color: number,
    alpha: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy * halfW;
    const ny = ux * halfW;
    const mx = x0 + dx * 0.34;
    const my = y0 + dy * 0.34;
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        { x: x0, y: y0 },
        { x: mx + nx, y: my + ny },
        { x: x1, y: y1 },
        { x: mx - nx, y: my - ny },
      ],
      true,
    );
  }

  private fillStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rOuter: number, rInner: number, rot: number, color: number, alpha: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? rOuter : rInner;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  private updateShapes(dt: number): void {
    const g = this.g;
    const glow = this.glowG;
    g.clear();
    glow.clear();

    // 后期满屏防糊阀：同屏图形特效超过阈值时平滑压低 ADD 发光层透明度，避免过曝盖住敌方子弹
    const activeShapes =
      this.slashes.length +
      this.thrusts.length +
      this.sonics.length +
      this.beams.length +
      this.zaps.length +
      this.rings.length +
      this.chomps.length +
      this.bashes.length +
      this.explosions.length * 2 +
      this.bolts.length +
      this.stars.length * 0.45;
    const targetGlow = activeShapes > 10 ? Phaser.Math.Clamp(1 - ((activeShapes - 10) / 18) * 0.55, 0.45, 1) : 1;
    this.glowMult += (targetGlow - this.glowMult) * Math.min(1, dt * 10);
    glow.setAlpha(this.glowMult);

    // 轻量高速弹道细尾线（单层清爽细线，不再三层发光把普通子弹画成激光）
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.tracers.splice(i, 1);
        continue;
      }
      const a = 1 - tr.t / tr.total;
      g.lineStyle(Math.max(1, tr.width * 0.72 * a), tr.color, 0.52 * a);
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.strokePath();
    }

    // 枪口抛出的黄铜弹壳（抛物线 + 落地轻弹一下淡出）
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.t += dt;
      if (sh.t >= sh.total) {
        this.shells.splice(i, 1);
        continue;
      }
      sh.vz -= 340 * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.z += sh.vz * dt;
      if (sh.z <= 0) {
        sh.z = 0;
        if (sh.bounces < 1 && Math.abs(sh.vz) > 26) {
          sh.vz = -sh.vz * 0.42;
          sh.vx *= 0.55;
          sh.vy *= 0.55;
          sh.vrot *= 0.5;
          sh.bounces++;
        } else {
          sh.vz = 0;
          sh.vx *= Math.exp(-9 * dt);
          sh.vy *= Math.exp(-9 * dt);
          sh.vrot *= Math.exp(-9 * dt);
        }
      }
      sh.rot += sh.vrot * dt;
      const a = Math.min(1, (sh.total - sh.t) / 0.24);
      const sx = sh.x;
      const sy = sh.y - sh.z;
      const dx = Math.cos(sh.rot) * 2.5;
      const dy = Math.sin(sh.rot) * 2.5;
      // 地面微弱落影
      g.fillStyle(0x100a06, 0.26 * a);
      g.fillEllipse(sh.x, sh.y + 1.5, 4.5, 2);
      // 黑墨外轮廓 + 黄铜壳身 + 高光点
      g.lineStyle(3.8, 0x1a1108, 0.92 * a);
      g.beginPath();
      g.moveTo(sx - dx, sy - dy);
      g.lineTo(sx + dx, sy + dy);
      g.strokePath();
      g.lineStyle(2.1, 0xe8b948, 0.96 * a);
      g.beginPath();
      g.moveTo(sx - dx, sy - dy);
      g.lineTo(sx + dx, sy + dy);
      g.strokePath();
      g.fillStyle(0xfff4c2, 0.9 * a);
      g.fillCircle(sx + dx * 0.4, sy + dy * 0.4, 0.9);
    }

    // 霰弹 / 重炮枪口快速消散的小白烟
    const smokeDrag = Math.exp(-4.8 * dt);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      sm.t += dt;
      if (sm.t >= sm.total) {
        this.smokes.splice(i, 1);
        continue;
      }
      sm.vx *= smokeDrag;
      sm.vy *= smokeDrag;
      sm.x += sm.vx * dt;
      sm.y += sm.vy * dt;
      const k = sm.t / sm.total;
      const a = (1 - k) * (1 - k * 0.35);
      const rad = Phaser.Math.Linear(sm.r0, sm.r1, Phaser.Math.Easing.Quadratic.Out(k));
      g.fillStyle(0x221b18, 0.3 * a);
      g.fillCircle(sm.x, sm.y, rad + 1.2);
      g.fillStyle(sm.color, 0.56 * a);
      g.fillCircle(sm.x, sm.y, rad);
      g.fillStyle(0xffffff, 0.25 * a);
      g.fillCircle(sm.x - rad * 0.22, sm.y - rad * 0.22, rad * 0.45);
    }

    // 漫画感三段式爆破（瞬时纯白核 -> 黑墨边橙红火球转暗灰烟云）
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.t += dt;
      if (ex.t >= ex.total) {
        this.explosions.splice(i, 1);
        continue;
      }
      const k = ex.t / ex.total;
      // 第一阶段：0~0.065s 瞬时纯白核心闪球（严格收在 ex.r 内）
      if (ex.t < 0.07) {
        const fk = ex.t / 0.07;
        const fr = ex.r * (0.28 + 0.26 * Phaser.Math.Easing.Quadratic.Out(fk));
        const fa = 1 - fk * 0.7;
        g.fillStyle(0x140d0a, 0.75 * fa);
        g.fillCircle(ex.x, ex.y, Math.min(ex.r - 1, fr + 2.2));
        g.fillStyle(0xffffff, 0.96 * fa);
        g.fillCircle(ex.x, ex.y, fr);
        glow.fillStyle(ex.tier >= 3 ? LEGENDARY_GOLD : 0xfff4b0, 0.58 * fa);
        glow.fillCircle(ex.x, ex.y, Math.min(ex.r * 0.88, fr * 1.25));
      }
      // 第二阶段：黑墨边缘火球膨胀并从明黄 -> 橙红 -> 暗灰烟云过渡
      for (const pf of ex.puffs) {
        const pt = ex.t - pf.delay;
        if (pt <= 0) continue;
        const pk = Math.min(1, pt / (ex.total - pf.delay));
        const ease = Phaser.Math.Easing.Quadratic.Out(pk);
        const px = ex.x + pf.ox + pf.dx * ease;
        const py = ex.y + pf.oy + pf.dy * ease;
        const rad = pf.r * (pk < 0.3 ? 0.45 + (pk / 0.3) * 0.68 : 1.13 - ((pk - 0.3) / 0.7) * 0.65);
        if (rad <= 0.8) continue;
        const alpha = pk < 0.55 ? 0.94 : 0.94 * (1 - (pk - 0.55) / 0.45);
        const fillCol = pk < 0.16 ? 0xfff3a8 : pk < 0.48 ? ex.color : pk < 0.74 ? 0x5c4138 : 0x383234;
        g.fillStyle(0x160e0b, alpha * 0.95);
        g.fillCircle(px, py, rad + 2.0);
        g.fillStyle(fillCol, alpha);
        g.fillCircle(px, py, rad);
        if (pk < 0.45) {
          g.fillStyle(0xfff6c8, alpha * (1 - pk / 0.45) * 0.85);
          g.fillCircle(px - rad * 0.22, py - rad * 0.22, rad * 0.46);
        }
      }
      if (k < 0.35 && ex.tier >= 3) {
        const lk = 1 - k / 0.35;
        glow.lineStyle(3.2 * lk, LEGENDARY_VIOLET, 0.6 * lk);
        glow.strokeCircle(ex.x, ex.y, ex.r * (0.5 + 0.46 * (1 - lk)));
      }
    }

    // 扇形横扫刀光：暗墨外描边 + 饱和主题色 + 速度弧纹 + 武器专属形态（鞭/锯/火/电/虚灵/重锤/圣剑）
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t += dt;
      if (s.t >= s.total) {
        this.slashes.splice(i, 1);
        continue;
      }
      const k = s.t / s.total;
      const a = 1 - k;
      const tierBoost = 1 + Math.min(3, s.tier) * 0.08;

      if (s.variant === 'whip') {
        // 虫鞭：S 形波浪甩鞭，鞭梢严格收在 s.r 内
        const midA = (s.a0 + s.a1) * 0.5;
        const ca = Math.cos(midA);
        const sa = Math.sin(midA);
        const nx = -sa;
        const ny = ca;
        const maxWhipR = Math.max(12, s.r - 4);
        const reach = maxWhipR * Phaser.Math.Easing.Quadratic.Out(Math.min(1, k * 2.2));
        const segs = 14;
        const pts: { x: number; y: number }[] = [];
        for (let m = 0; m <= segs; m++) {
          const u = m / segs;
          const dist = reach * u;
          const wave = Math.sin(u * Math.PI * 2.3 - k * 9 + s.seed) * (1 - u) * 14 * a;
          pts.push({ x: s.x + ca * dist + nx * wave, y: s.y + sa * dist + ny * wave });
        }
        g.lineStyle(6.2 * a + 1.4, 0x18100a, 0.72 * a);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let m = 1; m < pts.length; m++) g.lineTo(pts[m].x, pts[m].y);
        g.strokePath();
        g.lineStyle(3.2 * a + 0.8, s.color, 0.94 * a);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let m = 1; m < pts.length; m++) g.lineTo(pts[m].x, pts[m].y);
        g.strokePath();
        continue;
      }

      const head = s.a0 + (s.a1 - s.a0) * Math.min(1, k * 2.15);
      const tail = s.a0 + (s.a1 - s.a0) * Math.max(0, (k - 0.16) * 1.12);
      const maxR = s.r;
      const baseThick = s.variant === 'heavy' ? Math.min(28, Math.max(14, maxR * 0.24)) : Math.min(24, Math.max(12, maxR * 0.21));
      const thick = baseThick * (0.45 + 0.55 * a) * tierBoost;
      // 严格向内扣掉描边与锯齿/火舌余量，确保最外缘绝对不超过攻击半径 s.r
      const outerPad = s.variant === 'fire' || s.variant === 'saw' ? 9 : s.variant === 'heavy' ? 6 : 2;
      const rad = Math.max(8, maxR - (thick + 5.5) * 0.35 - outerPad);

      // 漫画暗墨描边背底 + 饱和主体色
      this.fillCrescent(g, s.x, s.y, rad, thick + 5.5, tail, head, 0x120d0a, 0.56 * a);
      this.fillCrescent(g, s.x, s.y, rad, thick, tail, head, s.color, 0.86 * a);

      // 仅在外缘锋刃描一条利落的浅亮高光边，不再大面积纯白盖掉主体颜色
      if (head - tail > 0.08) {
        g.lineStyle(Math.max(1.5, thick * 0.14), s.variant === 'fire' ? 0xfff2a6 : 0xffffff, 0.72 * a);
        g.beginPath();
        const segs = 12;
        for (let m = 0; m <= segs; m++) {
          const u = m / segs;
          const th = tail + (head - tail) * u;
          const ro = Math.min(maxR, rad + thick * 0.34 * Math.sin(u * Math.PI));
          const px = s.x + Math.cos(th) * ro;
          const py = s.y + Math.sin(th) * ro;
          if (m === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();

        // 内部漫画速度弧纹
        g.lineStyle(1.4, 0x140e0a, 0.36 * a);
        g.beginPath();
        for (let m = 0; m <= 10; m++) {
          const u = m / 10;
          const th = tail + (head - tail) * (0.12 + 0.76 * u);
          const ri = rad - thick * 0.26 * Math.sin(u * Math.PI);
          const px = s.x + Math.cos(th) * ri;
          const py = s.y + Math.sin(th) * ri;
          if (m === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }

      // 武器专属变体细节（全部钳制在 <= maxR 之内）
      if (s.variant === 'fire') {
        const flames = 5;
        for (let f = 0; f < flames; f++) {
          const u = (f + 0.5) / flames;
          const th = tail + (head - tail) * u;
          const bulge = Math.sin(u * Math.PI);
          const baseR = rad + thick * 0.15 * bulge;
          const tipR = Math.min(maxR - 1, baseR + (6 + 5 * Math.sin(s.seed + f * 2.1 + k * 12)) * bulge * a);
          if (tipR <= baseR + 1.5) continue;
          const span = 0.08 * bulge;
          g.fillStyle(0x1e0c06, 0.5 * a);
          g.fillTriangle(
            s.x + Math.cos(th - span) * (baseR - 2),
            s.y + Math.sin(th - span) * (baseR - 2),
            s.x + Math.cos(th + 0.03) * Math.min(maxR, tipR + 1.2),
            s.y + Math.sin(th + 0.03) * Math.min(maxR, tipR + 1.2),
            s.x + Math.cos(th + span) * (baseR - 2),
            s.y + Math.sin(th + span) * (baseR - 2),
          );
          g.fillStyle(f % 2 === 0 ? 0xff9828 : 0xffdf54, 0.88 * a);
          g.fillTriangle(
            s.x + Math.cos(th - span * 0.8) * baseR,
            s.y + Math.sin(th - span * 0.8) * baseR,
            s.x + Math.cos(th + 0.03) * tipR,
            s.y + Math.sin(th + 0.03) * tipR,
            s.x + Math.cos(th + span * 0.8) * baseR,
            s.y + Math.sin(th + span * 0.8) * baseR,
          );
        }
      } else if (s.variant === 'electric') {
        const zSegs = 8;
        glow.lineStyle(4.0 * a, s.color, 0.45 * a);
        glow.beginPath();
        g.lineStyle(1.8 * a + 0.6, 0xe8fdff, 0.9 * a);
        g.beginPath();
        for (let m = 0; m <= zSegs; m++) {
          const u = m / zSegs;
          const th = tail + (head - tail) * u;
          const jit = m === 0 || m === zSegs ? 0 : Math.sin(s.seed + m * 5.7 + Math.floor(s.t * 45) * 3.1) * 7 * a;
          const rr = Math.min(maxR - 1, rad + jit);
          const px = s.x + Math.cos(th) * rr;
          const py = s.y + Math.sin(th) * rr;
          if (m === 0) {
            glow.moveTo(px, py);
            g.moveTo(px, py);
          } else {
            glow.lineTo(px, py);
            g.lineTo(px, py);
          }
        }
        glow.strokePath();
        g.strokePath();
      } else if (s.variant === 'saw') {
        const teeth = 7;
        for (let m = 0; m < teeth; m++) {
          const u = (m + 0.5) / teeth;
          const th = tail + (head - tail) * u;
          const bulge = Math.sin(u * Math.PI);
          if (bulge < 0.25) continue;
          const rIn = rad + thick * 0.14 * bulge;
          const rOut = Math.min(maxR - 1, rIn + 7.5 * bulge * a);
          if (rOut <= rIn + 1.5) continue;
          const dth = 0.06;
          g.fillStyle(0x161214, 0.65 * a);
          g.fillTriangle(
            s.x + Math.cos(th - dth) * rIn,
            s.y + Math.sin(th - dth) * rIn,
            s.x + Math.cos(th + dth * 0.6) * Math.min(maxR, rOut + 1),
            s.y + Math.sin(th + dth * 0.6) * Math.min(maxR, rOut + 1),
            s.x + Math.cos(th + dth) * rIn,
            s.y + Math.sin(th + dth) * rIn,
          );
          g.fillStyle(0xffe078, 0.9 * a);
          g.fillTriangle(
            s.x + Math.cos(th - dth * 0.65) * rIn,
            s.y + Math.sin(th - dth * 0.65) * rIn,
            s.x + Math.cos(th + dth * 0.5) * rOut,
            s.y + Math.sin(th + dth * 0.5) * rOut,
            s.x + Math.cos(th + dth * 0.65) * rIn,
            s.y + Math.sin(th + dth * 0.65) * rIn,
          );
        }
      } else if (s.variant === 'ethereal') {
        this.fillCrescent(g, s.x, s.y, Math.max(6, rad - thick * 0.62), thick * 0.45, Math.max(s.a0, tail - 0.14), Math.max(tail, head - 0.12), 0xa868ff, 0.52 * a, 14);
      } else if (s.variant === 'holy' || s.tier >= 3) {
        this.fillCrescent(g, s.x, s.y, Math.max(6, rad - thick * 0.55), thick * 0.42, tail, head, s.variant === 'holy' ? LEGENDARY_GOLD : LEGENDARY_VIOLET, 0.55 * a, 14);
      } else if (s.variant === 'heavy') {
        const midA = (tail + head) * 0.5;
        g.lineStyle(2.8 * a, 0x16100a, 0.45 * a);
        g.beginPath();
        g.arc(s.x, s.y, Math.min(maxR - 1, rad + thick * 0.45), midA - 0.35, midA + 0.35);
        g.strokePath();
      }
    }

    // 直刺 / 雷针 / 幽灵刃 / 虫鸣琴音波 / 螺旋钻角
    for (let i = this.thrusts.length - 1; i >= 0; i--) {
      const tr = this.thrusts[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.thrusts.splice(i, 1);
        continue;
      }
      const k = tr.t / tr.total;
      const a = 1 - k;
      const dx = tr.x1 - tr.x0;
      const dy = tr.y1 - tr.y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const ang = Math.atan2(dy, dx);

      if (tr.variant === 'music') {
        // 虫鸣琴：向前扩散的 3 道金色音波弧 + 飘起漫画音符
        for (let w = 0; w < 3; w++) {
          const wk = Phaser.Math.Clamp(k * 1.35 - w * 0.18, 0, 1);
          if (wk <= 0) continue;
          const wa = (1 - wk) * a;
          const dist = len * (0.2 + 0.85 * Phaser.Math.Easing.Quadratic.Out(wk));
          const rad = 12 + dist * 0.34;
          const arcSpan = 0.52 + 0.15 * w;
          const cx = tr.x0 + ux * (dist * 0.55);
          const cy = tr.y0 + uy * (dist * 0.55);
          g.lineStyle(4.2 * wa + 1.2, 0x1a1208, 0.58 * wa);
          g.beginPath();
          g.arc(cx, cy, rad, ang - arcSpan, ang + arcSpan);
          g.strokePath();
          g.lineStyle(2.2 * wa + 0.8, w === 1 ? 0xffe878 : tr.color, 0.92 * wa);
          g.beginPath();
          g.arc(cx, cy, rad, ang - arcSpan, ang + arcSpan);
          g.strokePath();
        }
        // 飘出的小音符（符头 + 符干 + 符尾）
        const noteDist = len * (0.35 + 0.65 * Phaser.Math.Easing.Quadratic.Out(k));
        const sway = Math.sin(k * 9 + tr.seed) * 9;
        const nX = tr.x0 + ux * noteDist + nx * sway;
        const nY = tr.y0 + uy * noteDist + ny * sway - k * 10;
        g.fillStyle(0x181008, 0.85 * a);
        g.fillCircle(nX, nY, 4.2);
        g.fillStyle(tr.color, 0.95 * a);
        g.fillCircle(nX, nY, 3);
        g.lineStyle(2, 0x181008, 0.85 * a);
        g.beginPath();
        g.moveTo(nX + 2.4, nY);
        g.lineTo(nX + 2.4, nY - 11);
        g.lineTo(nX + 7.5, nY - 8.5);
        g.strokePath();
        g.lineStyle(1.3, 0xfff0a0, 0.92 * a);
        g.beginPath();
        g.moveTo(nX + 2.4, nY);
        g.lineTo(nX + 2.4, nY - 10.5);
        g.lineTo(nX + 7, nY - 8.5);
        g.strokePath();
      } else if (tr.variant === 'electric') {
        // 雷针：锯齿折线电矛
        const segs = 6;
        const pts: number[] = [tr.x0, tr.y0];
        for (let m = 1; m < segs; m++) {
          const u = m / segs;
          const off = Math.sin(tr.seed + m * 4.7 + Math.floor(tr.t * 50) * 2.3) * 10 * a;
          pts.push(tr.x0 + dx * u + nx * off, tr.y0 + dy * u + ny * off);
        }
        pts.push(tr.x1, tr.y1);
        glow.lineStyle(7 * a, tr.color, 0.45 * a);
        glow.beginPath();
        glow.moveTo(pts[0], pts[1]);
        for (let m = 2; m < pts.length; m += 2) glow.lineTo(pts[m], pts[m + 1]);
        glow.strokePath();
        g.lineStyle(3.4 * a + 1, 0x101824, 0.65 * a);
        g.beginPath();
        g.moveTo(pts[0], pts[1]);
        for (let m = 2; m < pts.length; m += 2) g.lineTo(pts[m], pts[m + 1]);
        g.strokePath();
        g.lineStyle(2.2 * a + 0.6, tr.color, 0.95 * a);
        g.beginPath();
        g.moveTo(pts[0], pts[1]);
        for (let m = 2; m < pts.length; m += 2) g.lineTo(pts[m], pts[m + 1]);
        g.strokePath();
      } else if (tr.variant === 'drill') {
        // 钻角/锯齿颚：螺旋钻纹 + 尖端亮芯
        const hw = Math.max(3.2, tr.width * 0.72 * a);
        this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw + 1.8, 0x161210, 0.6 * a);
        this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw, tr.color, 0.85 * a);
        const turns = 12;
        g.lineStyle(2.2 * a + 0.6, 0xfff0a0, 0.9 * a);
        g.beginPath();
        for (let m = 0; m <= turns; m++) {
          const u = m / turns;
          const amp = (1 - u * 0.7) * (hw + 4.5);
          const off = Math.sin(u * Math.PI * 5 - tr.t * 48 + tr.seed) * amp;
          const px = tr.x0 + dx * u + nx * off;
          const py = tr.y0 + dy * u + ny * off;
          if (m === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      } else if (tr.variant === 'ethereal') {
        // 幽甲斧/幽火燧：波动幽灵气刃 + 拖尾鬼火珠
        const segs = 8;
        g.lineStyle(8 * a + 1.5, 0x0e1820, 0.55 * a);
        g.beginPath();
        for (let m = 0; m <= segs; m++) {
          const u = m / segs;
          const w = Math.sin(u * Math.PI * 2 + tr.seed) * 6 * Math.sin(u * Math.PI);
          const px = tr.x0 + dx * u + nx * w;
          const py = tr.y0 + dy * u + ny * w;
          if (m === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
        g.lineStyle(4.8 * a + 0.8, tr.color, 0.88 * a);
        g.beginPath();
        for (let m = 0; m <= segs; m++) {
          const u = m / segs;
          const w = Math.sin(u * Math.PI * 2 + tr.seed) * 6 * Math.sin(u * Math.PI);
          const px = tr.x0 + dx * u + nx * w;
          const py = tr.y0 + dy * u + ny * w;
          if (m === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
        g.fillStyle(0xc8fff2, 0.9 * a);
        g.fillCircle(tr.x1, tr.y1, 4.5 * a);
      } else {
        // 标准锐利刺击 / 焰刺：漫画黑墨描边尖矛 + 饱和主题色 + 尖端火花点
        const hw = Math.max(2.6, tr.width * 0.68 * (0.45 + 0.55 * a));
        this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw + 2.0, 0x140f0c, 0.62 * a);
        this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw, tr.color, 0.88 * a);
        this.fillLance(g, tr.x0 + dx * 0.2, tr.y0 + dy * 0.2, tr.x1, tr.y1, hw * 0.34, tr.variant === 'fire' ? 0xfff098 : 0xffffff, 0.78 * a);
      }
    }

    // 重型破风突刺（长角 / 骑甲长枪 / 三叉戟 / 锥刺）：锥形破空尖锋 + 滑行音爆环
    for (let i = this.sonics.length - 1; i >= 0; i--) {
      const sn = this.sonics[i];
      sn.t += dt;
      if (sn.t >= sn.total) {
        this.sonics.splice(i, 1);
        continue;
      }
      const k = sn.t / sn.total;
      const a = 1 - k;
      const dx = sn.x1 - sn.x0;
      const dy = sn.y1 - sn.y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const hw = Math.max(3.5, sn.width * 0.72 * (0.4 + 0.6 * a));

      if (sn.variant === 'trident') {
        // 三叉戟：三道并行海蓝金叉锋
        for (const off of [-10, 0, 10]) {
          const sx = sn.x0 + nx * off * 0.7;
          const sy = sn.y0 + ny * off * 0.7;
          const ex = sn.x1 + nx * off - ux * Math.abs(off) * 0.55;
          const ey = sn.y1 + ny * off - uy * Math.abs(off) * 0.55;
          const w = off === 0 ? hw * 0.9 : hw * 0.58;
          this.fillLance(g, sx, sy, ex, ey, w + 1.8, 0x0e1a22, 0.6 * a);
          this.fillLance(g, sx, sy, ex, ey, w, off === 0 ? sn.color : 0x8ef4ff, 0.88 * a);
        }
      } else {
        this.fillLance(g, sn.x0, sn.y0, sn.x1, sn.y1, hw + 2.4, 0x140e0a, 0.65 * a);
        this.fillLance(g, sn.x0, sn.y0, sn.x1, sn.y1, hw, sn.color, 0.9 * a);
        this.fillLance(g, sn.x0 + dx * 0.25, sn.y0 + dy * 0.25, sn.x1, sn.y1, hw * 0.35, 0xfff6d0, 0.8 * a);
      }

      // 沿长枪轴线套出的扁椭圆破风冲击环（立体感极强，一眼区别于横扫圆弧）
      const ringCount = Math.min(3, Math.max(1, sn.rings));
      for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const frac = 0.32 + rIdx * 0.28 + k * 0.2;
        if (frac > 1.02) continue;
        const cx = sn.x0 + dx * frac;
        const cy = sn.y0 + dy * frac;
        const rx = (5 + 6 * k) * (1 - rIdx * 0.14);
        const ry = (11 + 14 * Phaser.Math.Easing.Quadratic.Out(k)) * (1 - rIdx * 0.14);
        const pts: { x: number; y: number }[] = [];
        const segs = 14;
        for (let m = 0; m <= segs; m++) {
          const th = (m / segs) * Math.PI * 2;
          const lx = Math.cos(th) * rx;
          const ly = Math.sin(th) * ry;
          pts.push({ x: cx + ux * lx + nx * ly, y: cy + uy * lx + ny * ly });
        }
        g.lineStyle(3.8 * a + 0.8, 0x140e0a, 0.55 * a);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let m = 1; m < pts.length; m++) g.lineTo(pts[m].x, pts[m].y);
        g.strokePath();
        g.lineStyle(2.0 * a + 0.5, sn.color, 0.9 * a);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let m = 1; m < pts.length; m++) g.lineTo(pts[m].x, pts[m].y);
        g.strokePath();
      }
    }

    // 光束（高阶加粗高能内核，IV 级附加金紫外鞘）
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t >= b.total) {
        this.beams.splice(i, 1);
        continue;
      }
      const a = 1 - b.t / b.total;
      const tb = 1 + b.tier * 0.14;
      if (b.tier >= 3) {
        glow.lineStyle(17 * tb, LEGENDARY_VIOLET, a * 0.34);
        glow.beginPath();
        glow.moveTo(b.x0, b.y0);
        glow.lineTo(b.x1, b.y1);
        glow.strokePath();
      }
      glow.lineStyle(12 * tb, b.color, a * 0.45);
      glow.beginPath();
      glow.moveTo(b.x0, b.y0);
      glow.lineTo(b.x1, b.y1);
      glow.strokePath();
      g.lineStyle(4.5 * tb, b.color, a * 0.85);
      g.beginPath();
      g.moveTo(b.x0, b.y0);
      g.lineTo(b.x1, b.y1);
      g.strokePath();
      glow.lineStyle(2.1 * tb, 0xffffff, a * 0.98);
      glow.beginPath();
      glow.moveTo(b.x0, b.y0);
      glow.lineTo(b.x1, b.y1);
      glow.strokePath();
      this.fillStar(glow, b.x1, b.y1, 13 * tb * a, 3.5 * tb * a, b.t * 14, b.tier >= 3 ? LEGENDARY_GOLD : b.color, 0.78 * a);
      this.fillStar(glow, b.x1, b.y1, 8 * tb * a, 2 * tb * a, b.t * 14, 0xffffff, 0.95 * a);
    }

    // 链式闪电（主电弧 + 随机分叉电须 + 跳跃节点电环）
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.t += dt;
      if (z.t >= ZAP_TIME) {
        this.zaps.splice(i, 1);
        continue;
      }
      const k = z.t / ZAP_TIME;
      const a = 1 - k;
      const outerCol = z.tier >= 3 ? 0x9c88ff : 0x4ca8ff;
      const midCol = z.tier >= 3 ? LEGENDARY_GOLD : 0x9ce0ff;
      glow.lineStyle(10 + z.tier * 1.5, outerCol, a * 0.55);
      glow.beginPath();
      glow.moveTo(z.pts[0], z.pts[1]);
      for (let m = 2; m < z.pts.length; m += 2) glow.lineTo(z.pts[m], z.pts[m + 1]);
      glow.strokePath();
      g.lineStyle(3.8 + z.tier * 0.6, midCol, a * 0.92);
      g.beginPath();
      g.moveTo(z.pts[0], z.pts[1]);
      for (let m = 2; m < z.pts.length; m += 2) g.lineTo(z.pts[m], z.pts[m + 1]);
      g.strokePath();
      glow.lineStyle(1.8 + z.tier * 0.25, 0xffffff, a);
      glow.beginPath();
      glow.moveTo(z.pts[0], z.pts[1]);
      for (let m = 2; m < z.pts.length; m += 2) glow.lineTo(z.pts[m], z.pts[m + 1]);
      glow.strokePath();
      // 随机分叉电须
      for (const br of z.branches) {
        glow.lineStyle(4.2, outerCol, a * 0.45);
        glow.beginPath();
        glow.moveTo(br[0], br[1]);
        for (let m = 2; m < br.length; m += 2) glow.lineTo(br[m], br[m + 1]);
        glow.strokePath();
        g.lineStyle(1.6, midCol, a * 0.85);
        g.beginPath();
        g.moveTo(br[0], br[1]);
        for (let m = 2; m < br.length; m += 2) g.lineTo(br[m], br[m + 1]);
        g.strokePath();
      }
      // 每个跳跃节点闪出小电环
      const nr = 7 + 13 * Phaser.Math.Easing.Quadratic.Out(k);
      for (let n = 0; n < z.nodes.length; n += 2) {
        const nx = z.nodes[n];
        const ny = z.nodes[n + 1];
        glow.lineStyle(3.2 * a + 0.8, midCol, 0.72 * a);
        glow.strokeCircle(nx, ny, nr);
        g.lineStyle(1.4 * a + 0.5, 0xffffff, 0.85 * a);
        g.strokeCircle(nx, ny, nr * 0.78);
      }
    }

    // 扩散冲击波环（漫画黑墨外缘 + 饱和主环，大半径附内圈回波）
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= RING_TIME) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.t / RING_TIME;
      const a = 1 - k;
      const rad = r.r * (0.36 + 0.64 * Phaser.Math.Easing.Quadratic.Out(k));
      g.lineStyle(4.8 * a + 1.4, 0x120d0a, 0.42 * a);
      g.strokeCircle(r.x, r.y, rad);
      g.lineStyle(2.8 * a + 1.0, r.color, 0.88 * a);
      g.strokeCircle(r.x, r.y, rad);
      if (r.r >= 70 && k < 0.72) {
        const ia = (1 - k / 0.72) * 0.55;
        g.lineStyle(1.5, r.color, ia);
        g.strokeCircle(r.x, r.y, rad * 0.76);
      }
      g.fillStyle(r.color, 0.08 * a);
      g.fillCircle(r.x, r.y, rad);
    }

    // 钳颚撕咬 / 拳击气爆（彻底告别两根小白弧）
    for (let i = this.chomps.length - 1; i >= 0; i--) {
      const c = this.chomps[i];
      c.t += dt;
      if (c.t >= c.total) {
        this.chomps.splice(i, 1);
        continue;
      }
      const k = c.t / c.total;
      const a = 1 - k;
      const ux = Math.cos(c.ang);
      const uy = Math.sin(c.ang);
      const nx = -uy;
      const ny = ux;

      if (c.variant === 'punch' || c.variant === 'firePunch') {
        // 拳击/燃焰指虎：向前轰出的漫画冲击锥 + 扁椭圆气爆环 + 放射速度线
        const ease = Phaser.Math.Easing.Quadratic.Out(k);
        const bx = c.x + ux * (c.r * (0.38 + 0.48 * ease));
        const by = c.y + uy * (c.r * (0.38 + 0.48 * ease));
        const baseX = c.x + ux * (c.r * 0.12);
        const baseY = c.y + uy * (c.r * 0.12);
        const spread = (14 + 14 * ease) * (0.6 + 0.4 * a);

        // 拳风锥体（黑墨底 + 主题色）
        const conePts = [
          { x: baseX, y: baseY },
          { x: bx + nx * spread, y: by + ny * spread },
          { x: bx + ux * (14 * a), y: by + uy * (14 * a) },
          { x: bx - nx * spread, y: by - ny * spread },
        ];
        g.fillStyle(0x160e0a, 0.42 * a);
        g.fillPoints(conePts, true);
        const innerPts = [
          { x: baseX + ux * 4, y: baseY + uy * 4 },
          { x: bx + nx * (spread * 0.72), y: by + ny * (spread * 0.72) },
          { x: bx + ux * (11 * a), y: by + uy * (11 * a) },
          { x: bx - nx * (spread * 0.72), y: by - ny * (spread * 0.72) },
        ];
        g.fillStyle(c.color, 0.76 * a);
        g.fillPoints(innerPts, true);

        // 拳面气爆椭圆环（正对撞击方向拍扁）
        const rx = 5 + 6 * ease;
        const ry = 13 + 17 * ease;
        const ringPts: { x: number; y: number }[] = [];
        for (let m = 0; m <= 14; m++) {
          const th = (m / 14) * Math.PI * 2;
          const lx = Math.cos(th) * rx;
          const ly = Math.sin(th) * ry;
          ringPts.push({ x: bx + ux * lx + nx * ly, y: by + uy * lx + ny * ly });
        }
        g.lineStyle(4.4 * a + 1, 0x160d08, 0.62 * a);
        g.beginPath();
        g.moveTo(ringPts[0].x, ringPts[0].y);
        for (let m = 1; m < ringPts.length; m++) g.lineTo(ringPts[m].x, ringPts[m].y);
        g.strokePath();
        g.lineStyle(2.4 * a + 0.6, c.variant === 'firePunch' ? 0xffd24c : c.color, 0.94 * a);
        g.beginPath();
        g.moveTo(ringPts[0].x, ringPts[0].y);
        for (let m = 1; m < ringPts.length; m++) g.lineTo(ringPts[m].x, ringPts[m].y);
        g.strokePath();

        // 3 条放射击打冲击线
        for (const sOff of [-0.45, 0, 0.45]) {
          const ra = c.ang + sOff;
          const r0 = 8 + 10 * ease;
          const r1 = r0 + 13 * a;
          g.lineStyle(2.2 * a, c.variant === 'firePunch' ? 0xff9228 : 0xfff0b8, 0.85 * a);
          g.beginPath();
          g.moveTo(bx + Math.cos(ra) * r0, by + Math.sin(ra) * r0);
          g.lineTo(bx + Math.cos(ra) * r1, by + Math.sin(ra) * r1);
          g.strokePath();
        }
      } else {
        // 大颚/双刃剪：双锋利尖牙从两侧 V→X 合拢夹斩 + 交汇闪光
        const close = Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 1.7));
        const jawSpread = (1 - close) * 0.62 + 0.04;
        const bx = c.x + ux * (c.r * 0.78);
        const by = c.y + uy * (c.r * 0.78);
        const bladeLen = c.r * 0.56;
        for (const side of [-1, 1]) {
          const rootX = c.x + ux * (c.r * 0.22) + nx * side * (16 + 14 * (1 - close));
          const rootY = c.y + uy * (c.r * 0.22) + ny * side * (16 + 14 * (1 - close));
          const tipX = bx + nx * (-side * 8 * close) + ux * (bladeLen * 0.24);
          const tipY = by + ny * (-side * 8 * close) + uy * (bladeLen * 0.24);
          const midX = (rootX + tipX) * 0.5 + nx * side * (11 * (1 - close * 0.55) + jawSpread * 6);
          const midY = (rootY + tipY) * 0.5 + ny * side * (11 * (1 - close * 0.55) + jawSpread * 6);
          const fangOut = [
            { x: rootX - nx * side * 3, y: rootY - ny * side * 3 },
            { x: midX + nx * side * 5.5, y: midY + ny * side * 5.5 },
            { x: tipX, y: tipY },
            { x: midX - nx * side * 2.5, y: midY - ny * side * 2.5 },
          ];
          g.fillStyle(0x160e08, 0.7 * a);
          g.fillPoints(fangOut, true);
          const fangIn = [
            { x: rootX, y: rootY },
            { x: midX + nx * side * 3.2, y: midY + ny * side * 3.2 },
            { x: tipX, y: tipY },
            { x: midX - nx * side * 0.8, y: midY - ny * side * 0.8 },
          ];
          g.fillStyle(c.color, 0.92 * a);
          g.fillPoints(fangIn, true);
        }
        // 合拢瞬间的利落 X 咬合切痕
        if (k > 0.14) {
          const xa = a * 0.92;
          const xLen = 13 + 7 * close;
          for (const dAng of [c.ang + 0.68, c.ang - 0.68]) {
            const ca = Math.cos(dAng);
            const sa = Math.sin(dAng);
            this.fillLance(g, bx - ca * xLen, by - sa * xLen, bx + ca * xLen, by + sa * xLen, 2.4 * xa, 0x160d08, 0.6 * xa);
            this.fillLance(g, bx - ca * xLen, by - sa * xLen, bx + ca * xLen, by + sa * xLen, 1.3 * xa, 0xfff2b8, 0.9 * xa);
          }
        }
      }
    }

    // 重锤砸地 / 甲壳盾推 / 等离子锤 / 滚石撞击（彻底告别细白弧！）
    for (let i = this.bashes.length - 1; i >= 0; i--) {
      const b = this.bashes[i];
      b.t += dt;
      if (b.t >= b.total) {
        this.bashes.splice(i, 1);
        continue;
      }
      const k = b.t / b.total;
      const a = 1 - k;
      const ease = Phaser.Math.Easing.Quadratic.Out(k);
      const ux = Math.cos(b.ang);
      const uy = Math.sin(b.ang);
      const ix = b.x + ux * (b.r * 0.52);
      const iy = b.y + uy * (b.r * 0.52);

      if (b.variant === 'shield') {
        // 甲壳盾：硬朗折角棱面能量盾墙，外缘严格 <= b.r
        const segs = 4;
        const rNow = b.r * (0.55 + 0.45 * ease);
        const a0 = b.ang - b.arc;
        const a1 = b.ang + b.arc;
        const outer: { x: number; y: number }[] = [];
        const inner: { x: number; y: number }[] = [];
        const thick = Math.min(16, b.r * 0.22) * (0.45 + 0.55 * a);
        for (let m = 0; m <= segs; m++) {
          const th = a0 + ((a1 - a0) * m) / segs;
          outer.push({ x: b.x + Math.cos(th) * rNow, y: b.y + Math.sin(th) * rNow });
          inner.push({ x: b.x + Math.cos(th) * Math.max(6, rNow - thick), y: b.y + Math.sin(th) * Math.max(6, rNow - thick) });
        }
        const poly = [...outer, ...inner.reverse()];
        g.fillStyle(0x101824, 0.58 * a);
        g.fillPoints(poly, true);
        g.fillStyle(b.color, 0.62 * a);
        g.fillPoints(poly, true);
        g.lineStyle(3.0 * a + 1, 0x101c28, 0.78 * a);
        g.beginPath();
        g.moveTo(outer[0].x, outer[0].y);
        for (let m = 1; m < outer.length; m++) g.lineTo(outer[m].x, outer[m].y);
        g.strokePath();
        g.lineStyle(1.8 * a + 0.8, 0xd8f6ff, 0.92 * a);
        g.beginPath();
        g.moveTo(outer[0].x, outer[0].y);
        for (let m = 1; m < outer.length; m++) g.lineTo(outer[m].x, outer[m].y);
        g.strokePath();
      } else {
        // 砸地裂纹 + 冲击脉冲：圆心在 0.52*b.r，局部最大半径 <= 0.44*b.r，确保整体 0.52+0.44 <= 0.96*b.r 绝不越界
        const maxLocalR = b.r * 0.44;
        const slamR = maxLocalR * (0.62 + 0.38 * ease);
        // 1) 地面放射状锯齿裂纹
        const cracks = b.variant === 'plasma' ? 6 : 5;
        for (let cIdx = 0; cIdx < cracks; cIdx++) {
          const frac = cracks > 1 ? cIdx / (cracks - 1) - 0.5 : 0;
          const ca = b.ang + frac * b.arc * 1.85 + Math.sin(b.seed + cIdx * 3.1) * 0.12;
          const cLen = slamR * (0.72 + 0.25 * ((cIdx * 37 + 13) % 10) * 0.1) * Math.min(1, k * 3.2);
          const mx = ix + Math.cos(ca + 0.16) * cLen * 0.52;
          const my = iy + Math.sin(ca + 0.16) * cLen * 0.52;
          const ex = ix + Math.cos(ca) * cLen;
          const ey = iy + Math.sin(ca) * cLen;
          g.lineStyle(3.4 * a + 1.0, 0x18100a, 0.78 * a);
          g.beginPath();
          g.moveTo(ix, iy);
          g.lineTo(mx, my);
          g.lineTo(ex, ey);
          g.strokePath();
          if (k < 0.55 || b.variant === 'plasma' || b.variant === 'explosive') {
            const flashA = b.variant === 'plasma' ? a * 0.92 : a * Math.max(0.25, 1 - k * 1.4);
            g.lineStyle(1.6 * a + 0.5, b.color, flashA);
            g.beginPath();
            g.moveTo(ix, iy);
            g.lineTo(mx, my);
            g.lineTo(ex, ey);
            g.strokePath();
          }
        }

        // 2) 冲击中心震荡环（严格 <= maxLocalR）
        const pulseR = slamR;
        g.fillStyle(b.color, (b.variant === 'plasma' || b.variant === 'explosive' ? 0.24 : 0.15) * a);
        g.fillCircle(ix, iy, pulseR);
        g.lineStyle(4.0 * a + 1.0, 0x18100a, 0.55 * a);
        g.strokeCircle(ix, iy, pulseR);
        g.lineStyle(2.2 * a + 0.8, b.color, 0.86 * a);
        g.strokeCircle(ix, iy, pulseR);

        // 3) 等离子锤电流外圈 / 滚石碎块（均钳制在 slamR 以内）
        if (b.variant === 'plasma') {
          glow.lineStyle(4.5 * a, b.color, 0.42 * a);
          glow.strokeCircle(ix, iy, pulseR);
        } else if (b.variant === 'rock') {
          for (let rIdx = 0; rIdx < 4; rIdx++) {
            const ra = b.ang + (rIdx - 1.5) * 0.55 + Math.sin(b.seed + rIdx) * 0.18;
            const rd = slamR * (0.3 + 0.58 * ease);
            const rx = ix + Math.cos(ra) * rd;
            const ry = iy + Math.sin(ra) * rd - Math.sin(k * Math.PI) * 6;
            const sz = (3.4 + (rIdx % 2) * 1.4) * a;
            g.fillStyle(0x1a120a, 0.85 * a);
            g.fillRect(rx - sz - 0.8, ry - sz - 0.8, sz * 2 + 1.6, sz * 2 + 1.6);
            g.fillStyle(b.color, 0.92 * a);
            g.fillRect(rx - sz, ry - sz, sz * 2, sz * 2);
          }
        }
      }
    }

    // 暴击/重击定向交叉斩痕（干脆实线，不叠 ADD 发光）
    for (let i = this.hitSlashes.length - 1; i >= 0; i--) {
      const hs = this.hitSlashes[i];
      hs.t += dt;
      if (hs.t >= hs.total) {
        this.hitSlashes.splice(i, 1);
        continue;
      }
      const k = hs.t / hs.total;
      const a = 1 - k;
      const grow = 0.65 + 0.45 * Phaser.Math.Easing.Quadratic.Out(k);
      const mainLen = 14 * hs.scale * grow;
      const crossLen = 7.5 * hs.scale * grow;
      const ca = Math.cos(hs.ang);
      const sa = Math.sin(hs.ang);
      const pa = -sa;
      const pb = ca;
      this.fillLance(g, hs.x - ca * mainLen, hs.y - sa * mainLen, hs.x + ca * mainLen, hs.y + sa * mainLen, 2.2 * hs.scale * a, hs.color, 0.85 * a);
      this.fillLance(g, hs.x - pa * crossLen, hs.y - pb * crossLen, hs.x + pa * crossLen, hs.y + pb * crossLen, 1.2 * hs.scale * a, 0xffffff, 0.82 * a);
    }

    // 吸血 / 回血光丝（二次贝塞尔曲线从敌人飞入甲虫）
    for (let i = this.tethers.length - 1; i >= 0; i--) {
      const th = this.tethers[i];
      th.t += dt;
      const tgt = th.getTarget();
      if (th.t >= th.total) {
        this.star(tgt.x, tgt.y, 11, th.color);
        this.tethers.splice(i, 1);
        continue;
      }
      const k = Phaser.Math.Easing.Quadratic.In(th.t / th.total);
      const evalPt = (u: number) => {
        const inv = 1 - u;
        return [
          inv * inv * th.x0 + 2 * inv * u * th.cx + u * u * tgt.x,
          inv * inv * th.y0 + 2 * inv * u * th.cy + u * u * tgt.y,
        ] as const;
      };
      const tailK = Math.max(0, k - 0.36);
      const segs = 6;
      const alpha = Math.sin(Math.min(1, th.t / th.total) * Math.PI * 0.85 + 0.15);
      glow.lineStyle(5.5, th.color, 0.45 * alpha);
      glow.beginPath();
      for (let s = 0; s <= segs; s++) {
        const [px, py] = evalPt(Phaser.Math.Linear(tailK, k, s / segs));
        if (s === 0) glow.moveTo(px, py);
        else glow.lineTo(px, py);
      }
      glow.strokePath();
      g.lineStyle(2.2, th.color, 0.92 * alpha);
      g.beginPath();
      for (let s = 0; s <= segs; s++) {
        const [px, py] = evalPt(Phaser.Math.Linear(tailK, k, s / segs));
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      const [hx, hy] = evalPt(k);
      glow.fillStyle(th.color, 0.72 * alpha);
      glow.fillCircle(hx, hy, 5.2);
      g.fillStyle(0xffffff, 0.96 * alpha);
      g.fillCircle(hx, hy, 2.5);
    }

    // 毒素气泡（上升摇曳 + 末期爆泡小圈）
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      if (b.t >= b.total) {
        this.bubbles.splice(i, 1);
        continue;
      }
      const k = b.t / b.total;
      b.x += (b.vx + Math.sin(b.t * 14 + b.wob) * 14) * dt;
      b.y += b.vy * dt;
      const rad = b.r * (0.75 + 0.45 * k);
      if (k > 0.82) {
        const pk = (k - 0.82) / 0.18;
        g.lineStyle(1.4, 0xb8ff48, (1 - pk) * 0.9);
        g.strokeCircle(b.x, b.y, rad * (1 + pk * 0.7));
      } else {
        const a = Math.min(1, (1 - k) * 1.4);
        g.fillStyle(0x9cf428, 0.28 * a);
        g.fillCircle(b.x, b.y, rad);
        g.lineStyle(1.4, 0x1c3408, 0.85 * a);
        g.strokeCircle(b.x, b.y, rad + 0.4);
        g.lineStyle(1.1, 0xc8ff68, 0.92 * a);
        g.strokeCircle(b.x, b.y, rad);
        g.fillStyle(0xf2ffd8, 0.95 * a);
        g.fillCircle(b.x - rad * 0.34, b.y - rad * 0.34, Math.max(0.8, rad * 0.28));
      }
    }

    // 冰晶碎裂锐利冰碴
    const shardDrag = Math.exp(-4.2 * dt);
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.t += dt;
      if (sh.t >= sh.total) {
        this.shards.splice(i, 1);
        continue;
      }
      sh.vx *= shardDrag;
      sh.vy *= shardDrag;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.rot += sh.vrot * dt;
      const a = 1 - sh.t / sh.total;
      const c = Math.cos(sh.rot);
      const s = Math.sin(sh.rot);
      const nx = -s;
      const ny = c;
      const hl = sh.len * (0.55 + 0.45 * a);
      const hw = sh.w * (0.55 + 0.45 * a);
      const pts = [
        { x: sh.x + c * hl, y: sh.y + s * hl },
        { x: sh.x + nx * hw, y: sh.y + ny * hw },
        { x: sh.x - c * hl * 0.8, y: sh.y - s * hl * 0.8 },
        { x: sh.x - nx * hw, y: sh.y - ny * hw },
      ];
      g.fillStyle(0x163852, 0.82 * a);
      g.fillPoints(pts, true);
      g.fillStyle(0x9ceeff, 0.92 * a);
      g.fillPoints(
        [
          { x: sh.x + c * (hl - 0.8), y: sh.y + s * (hl - 0.8) },
          { x: sh.x + nx * (hw * 0.72), y: sh.y + ny * (hw * 0.72) },
          { x: sh.x - c * (hl * 0.65), y: sh.y - s * (hl * 0.65) },
          { x: sh.x - nx * (hw * 0.72), y: sh.y - ny * (hw * 0.72) },
        ],
        true,
      );
      glow.fillStyle(0xffffff, 0.85 * a);
      glow.fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, sh.x, sh.y);
    }

    // 四芒小闪星（去掉外层 ADD 炫光，保持清爽小巧）
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.t += dt;
      if (st.t >= st.total) {
        this.stars.splice(i, 1);
        continue;
      }
      const k = st.t / st.total;
      const a = 1 - k;
      const pop = k < 0.25 ? 0.6 + (k / 0.25) * 0.45 : 1.05 - (k - 0.25) * 0.35;
      const rad = st.r * pop;
      this.fillStar(g, st.x, st.y, rad, rad * 0.22, st.rot, st.color, 0.78 * a);
      this.fillStar(g, st.x, st.y, rad * 0.55, rad * 0.14, st.rot, 0xffffff, 0.85 * a);
    }

    // 闪电
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= BOLT_TIME) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = 1 - b.t / BOLT_TIME;
      glow.lineStyle(14, 0xffe050, a * 0.55);
      glow.beginPath();
      glow.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) glow.lineTo(b.pts[k], b.pts[k + 1]);
      glow.strokePath();
      g.lineStyle(6, 0xfff498, a * 0.9);
      g.beginPath();
      g.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) g.lineTo(b.pts[k], b.pts[k + 1]);
      g.strokePath();
      glow.lineStyle(2.5, 0xffffff, a);
      glow.beginPath();
      glow.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) glow.lineTo(b.pts[k], b.pts[k + 1]);
      glow.strokePath();
      const lx = b.pts[b.pts.length - 2];
      const ly = b.pts[b.pts.length - 1];
      this.fillStar(glow, lx, ly, 24 * a, 5 * a, b.t * 10, 0xffe468, 0.85 * a);
    }
  }

  private release(i: number): void {
    const ft = this.texts[i];
    ft.obj.setVisible(false);
    this.texts[i] = this.texts[this.texts.length - 1];
    this.texts.pop();
    (ft.bitmap ? this.freeBitmaps : this.freeTexts).push(ft);
  }

  private acquire(bitmap: boolean): FloatText {
    let ft = (bitmap ? this.freeBitmaps : this.freeTexts).pop();
    if (!ft && this.texts.length >= MAX_TEXTS) {
      // 池满了就把最早的那条收回来再用
      const oldest = this.texts.findIndex((f) => f.bitmap === bitmap);
      if (oldest >= 0) {
        this.release(oldest);
        ft = (bitmap ? this.freeBitmaps : this.freeTexts).pop();
      }
    }
    if (!ft) {
      const obj = bitmap
        ? this.scene.add.bitmapText(0, 0, DAMAGE_FONT, '', DAMAGE_FONT_SIZE).setOrigin(0.5).setDepth(DEPTH.text)
        : this.scene.add
            .text(0, 0, '', {
              fontFamily: FONT_FAMILY,
              fontSize: '20px',
              fontStyle: 'bold',
              color: '#ffffff',
              stroke: '#1a1208',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(DEPTH.text);
      ft = { obj, bitmap, life: 0, vx: 0, vy: 0, baseScale: 1 };
    }
    this.texts.push(ft);
    return ft;
  }

  private acquireParticle(): Particle | null {
    let p = this.freeParticles.pop();
    if (!p) {
      if (this.particles.length >= MAX_PARTICLES) return null;
      const img = this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.effect);
      p = { img, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, streak: false, glow: true };
    }
    this.particles.push(p);
    return p;
  }
}
