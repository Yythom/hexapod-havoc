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

interface Slash {
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
  color: number;
  tier: number;
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

  /** 扩散的圆环（爆炸、震击） */
  ring(x: number, y: number, r: number, color = 0xffffff): void {
    this.rings.push({ x, y, r, color, t: 0 });
    if (r >= 45) this.star(x, y, r * 0.42, color);
  }

  /** 近战扇形横扫刀光（品阶 I→IV 进化：高阶加厚白芯火花，IV 级双层错位二重斩弧） */
  slash(x: number, y: number, r: number, angle: number, arc: number, color = 0xfff0c0, tier = 0): void {
    this.slashes.push({ x, y, r, a0: angle - arc, a1: angle + arc, color, tier, t: 0, total: tier >= 3 ? 0.27 : 0.24 });
    const count = tier >= 3 ? 3 : tier >= 1 ? 2 : 1;
    const samples = tier >= 1 ? [-0.65, -0.22, 0.22, 0.65] : [-0.5, 0, 0.5];
    for (const f of samples) {
      const a = angle + arc * f;
      const sx = x + Math.cos(a) * r * 0.85;
      const sy = y + Math.sin(a) * r * 0.85;
      this.streaks(sx, sy, a, tier >= 3 && Math.abs(f) < 0.3 ? LEGENDARY_GOLD : color, count, 175 + tier * 15, 0.72 + tier * 0.08);
    }
    if (tier >= 3) {
      this.star(x + Math.cos(angle) * r * 0.92, y + Math.sin(angle) * r * 0.92, 18, LEGENDARY_GOLD, angle);
    }
  }

  /** 近战直刺锋芒拖尾（品阶驱动核心厚度与传说爆星） */
  thrust(x0: number, y0: number, x1: number, y1: number, color = 0xfff0c0, width = 7, tier = 0): void {
    this.thrusts.push({ x0, y0, x1, y1, color, width: width * (1 + tier * 0.1), tier, t: 0, total: 0.17 + tier * 0.01 });
    if (tier >= 2) {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      this.streaks(x1, y1, ang, tier >= 3 ? LEGENDARY_GOLD : color, tier >= 3 ? 3 : 2, 185, 0.78);
    }
    if (tier >= 3) {
      this.star(x1, y1, 15, LEGENDARY_VIOLET, Math.atan2(y1 - y0, x1 - x0));
    }
  }

  /** 带破风冲击环的重型突刺（犄角 / 枪械） */
  sonicThrust(x0: number, y0: number, x1: number, y1: number, color = 0xffe49a, width = 12, rings = 2, tier = 0): void {
    this.sonics.push({ x0, y0, x1, y1, color, width: width * (1 + tier * 0.08), rings: rings + (tier >= 2 ? 1 : 0), tier, t: 0, total: 0.22 + tier * 0.015 });
    const ang = Math.atan2(y1 - y0, x1 - x0);
    this.star(x1, y1, width * (1.35 + tier * 0.15), tier >= 3 ? LEGENDARY_GOLD : color, ang);
    this.streaks(x1, y1, ang, color, 4 + tier, 210 + tier * 15, 0.85 + tier * 0.06);
  }

  /** 大颚钳合撕咬特效：双弯月钳刃 1:1 覆盖真实打击距离 + 咬合中心爆星 */
  chomp(x: number, y: number, ang: number, r: number, color = 0xffc858, tier = 0): void {
    this.chomps.push({ x, y, ang, r, color, tier, t: 0, total: 0.22 + tier * 0.015 });
    const bx = x + Math.cos(ang) * r * 0.86;
    const by = y + Math.sin(ang) * r * 0.86;
    this.star(bx, by, 17 + tier * 3, tier >= 3 ? LEGENDARY_GOLD : color, ang);
    this.streaks(bx, by, ang, color, 3 + tier, 165 + tier * 15, 0.78 + tier * 0.06);
  }

  /** 甲壳盾猛击震荡扇形波（精准贴合真实锤/盾击外缘） */
  bash(x: number, y: number, ang: number, arc: number, r: number, color = 0x72d8ff, tier = 0): void {
    this.bashes.push({ x, y, ang, arc, r, color, tier, t: 0, total: 0.26 + tier * 0.015 });
    const hx = x + Math.cos(ang) * r * 0.76;
    const hy = y + Math.sin(ang) * r * 0.76;
    this.star(hx, hy, 19 + tier * 3, tier >= 3 ? LEGENDARY_GOLD : color, ang);
    this.streaks(hx, hy, ang, color, 5 + tier, 200 + tier * 14, 0.9 + tier * 0.06);
  }

  /** 四芒爆闪星光（暴击、破甲、枪口、冲击点） */
  star(x: number, y: number, r = 16, color = 0xffe878, rot = Math.random() * Math.PI): void {
    this.stars.push({ x, y, r, rot, color, t: 0, total: 0.18 });
  }

  /** 定向速度线火花粒子 */
  streaks(x: number, y: number, ang: number, color: number, count: number, speed = 180, size = 0.8): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = ang + (Math.random() - 0.5) * 1.1;
      const v = speed * (0.45 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.16 + Math.random() * 0.16;
      p.size = size * (0.7 + Math.random() * 0.5);
      p.streak = true;
      p.glow = true;
      p.img
        .setTexture('fx-streak')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(1)
        .setScale(p.size)
        .setVisible(true);
    }
  }

  /** 枪械/元素发射口定向光束与星芒火花（IV 级升级为金紫高能枪口焰） */
  muzzle(x: number, y: number, ang: number, color = 0xffe498, len = 20, count = 4, tier = 0): void {
    const reach = len * (1 + tier * 0.12);
    this.thrust(x, y, x + Math.cos(ang) * reach, y + Math.sin(ang) * reach, tier >= 3 ? LEGENDARY_GOLD : color, 8.5 + tier * 1.1, Math.min(tier, 2));
    this.star(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, reach * 0.56, tier >= 3 ? LEGENDARY_GOLD : color, ang);
    if (tier >= 3) {
      this.star(x + Math.cos(ang) * 5, y + Math.sin(ang) * 5, reach * 0.44, LEGENDARY_VIOLET, ang + Math.PI / 4);
      this.rings.push({ x: x + Math.cos(ang) * 4, y: y + Math.sin(ang) * 4, r: Math.max(12, reach * 0.55), color: LEGENDARY_VIOLET, t: 0.12 });
    }
    this.streaks(x, y, ang, tier >= 3 ? LEGENDARY_GOLD : color, count + (tier >= 2 ? 2 : tier >= 1 ? 1 : 0), 190 + tier * 18, 0.76 + tier * 0.06);
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

  /** 漫画感三段式爆破：纯白核心闪球 -> 黑墨边缘橙红火球转暗灰烟云 -> 精确 1:1 伤害外环 + 地面焦黑弹坑 */
  explosion(x: number, y: number, r: number, color = 0xff7830, tier = 0): void {
    const puffCount = Math.min(7, Math.max(5, Math.round(r / 15) + (tier >= 3 ? 1 : 0)));
    const puffs: ExplosionPuff[] = [
      { ox: 0, oy: 0, dx: 0, dy: -4, r: Math.max(14, r * 0.44), delay: 0.015 },
    ];
    for (let i = 0; i < puffCount; i++) {
      const a = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const dist = r * (0.34 + Math.random() * 0.24);
      const drift = r * (0.24 + Math.random() * 0.16);
      puffs.push({
        ox: Math.cos(a) * dist,
        oy: Math.sin(a) * dist,
        dx: Math.cos(a) * drift,
        dy: Math.sin(a) * drift - 5,
        r: Math.max(11, r * (0.28 + Math.random() * 0.12)),
        delay: 0.025 + Math.random() * 0.035,
      });
    }
    this.explosions.push({ x, y, r, color, tier, puffs, t: 0, total: 0.42 });
    this.rings.push({ x, y, r, color, t: 0 });
    this.star(x, y, Math.max(18, r * 0.48), tier >= 3 ? LEGENDARY_GOLD : 0xfff2a6);
    this.streaks(x, y, Math.random() * Math.PI * 2, color, 5 + Math.min(4, Math.round(r / 20)), 215, 0.9);
    this.crater(x, y, r * 0.85);
  }

  /** 子弹穿透敌人时在背后迸出的定向破空锥 + 亮白穿透尾线（清晰区分穿透与单体） */
  pierceBreak(x: number, y: number, ang: number, color = 0xfff0a8): void {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    this.tracer(x - c * 10, y - s * 10, x + c * 28, y + s * 28, color, 3.2, 0.11);
    this.streaks(x + c * 8, y + s * 8, ang, color, 3, 220, 0.72);
    this.star(x + c * 6, y + s * 6, 11, 0xffffff, ang);
  }

  /** 单体子弹命中并立刻消散时的干脆收敛火花（明确表示子弹已在此终止） */
  bulletImpact(x: number, y: number, ang: number, color = 0xffe498): void {
    this.burst(x, y, color, 3, 95, 0.55);
    this.streaks(x, y, ang + Math.PI, color, 2, 130, 0.55);
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

  burst(x: number, y: number, color: number, count: number, speed = 160, size = 1, glow = true): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.25 + Math.random() * 0.28;
      p.size = size * 0.68 * (0.6 + Math.random() * 0.6);
      p.streak = false;
      p.glow = glow;
      p.img
        .setTexture(glow && i % 3 === 0 ? 'fx-flare' : 'dot')
        .setBlendMode(glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
        .setPosition(x, y)
        .setRotation(a)
        .setTint(color)
        .setAlpha(1)
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

    // 轻量高速弹道拖尾线（1~2 帧渐隐）
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.tracers.splice(i, 1);
        continue;
      }
      const a = 1 - tr.t / tr.total;
      glow.lineStyle(tr.width * 1.9 * a + 0.6, tr.color, 0.34 * a);
      glow.beginPath();
      glow.moveTo(tr.x0, tr.y0);
      glow.lineTo(tr.x1, tr.y1);
      glow.strokePath();
      g.lineStyle(tr.width * a + 0.4, tr.color, 0.72 * a);
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.strokePath();
      glow.lineStyle(Math.max(0.8, tr.width * 0.42 * a), 0xffffff, 0.78 * a);
      glow.beginPath();
      glow.moveTo(tr.x0, tr.y0);
      glow.lineTo(tr.x1, tr.y1);
      glow.strokePath();
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
      // 第一阶段：0~0.065s 瞬时纯白核心闪球
      if (ex.t < 0.07) {
        const fk = ex.t / 0.07;
        const fr = ex.r * (0.34 + 0.28 * Phaser.Math.Easing.Quadratic.Out(fk));
        const fa = 1 - fk * 0.7;
        g.fillStyle(0x140d0a, 0.75 * fa);
        g.fillCircle(ex.x, ex.y, fr + 2.5);
        g.fillStyle(0xffffff, 0.96 * fa);
        g.fillCircle(ex.x, ex.y, fr);
        glow.fillStyle(ex.tier >= 3 ? LEGENDARY_GOLD : 0xfff4b0, 0.65 * fa);
        glow.fillCircle(ex.x, ex.y, fr * 1.35);
      }
      // 第二阶段：黑墨边缘火球膨胀并从明黄 -> 橙红 -> 暗灰烟云过渡
      for (const pf of ex.puffs) {
        const pt = ex.t - pf.delay;
        if (pt <= 0) continue;
        const pk = Math.min(1, pt / (ex.total - pf.delay));
        const ease = Phaser.Math.Easing.Quadratic.Out(pk);
        const px = ex.x + pf.ox + pf.dx * ease;
        const py = ex.y + pf.oy + pf.dy * ease;
        const rad = pf.r * (pk < 0.3 ? 0.45 + (pk / 0.3) * 0.7 : 1.15 - ((pk - 0.3) / 0.7) * 0.65);
        if (rad <= 0.8) continue;
        const alpha = pk < 0.55 ? 0.94 : 0.94 * (1 - (pk - 0.55) / 0.45);
        const fillCol = pk < 0.16 ? 0xfff3a8 : pk < 0.48 ? ex.color : pk < 0.74 ? 0x5c4138 : 0x383234;
        g.fillStyle(0x160e0b, alpha * 0.95);
        g.fillCircle(px, py, rad + 2.1);
        g.fillStyle(fillCol, alpha);
        g.fillCircle(px, py, rad);
        if (pk < 0.45) {
          g.fillStyle(0xfff6c8, alpha * (1 - pk / 0.45) * 0.85);
          g.fillCircle(px - rad * 0.22, py - rad * 0.22, rad * 0.46);
        }
      }
      if (k < 0.35 && ex.tier >= 3) {
        const lk = 1 - k / 0.35;
        glow.lineStyle(3.5 * lk, LEGENDARY_VIOLET, 0.65 * lk);
        glow.strokeCircle(ex.x, ex.y, ex.r * (0.5 + 0.55 * (1 - lk)));
      }
    }

    // 扇形横扫刀光（I 级干净单弧 -> II~III 级加厚白芯 -> IV 级双层错位二重斩弧）
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t += dt;
      if (s.t >= s.total) {
        this.slashes.splice(i, 1);
        continue;
      }
      const k = s.t / s.total;
      const a = 1 - k;
      const head = s.a0 + (s.a1 - s.a0) * Math.min(1, k * 2.2);
      const tail = s.a0 + (s.a1 - s.a0) * Math.max(0, (k - 0.18) * 1.15);
      // 视觉弧半径与厚度 1:1 贴合真实横扫内外圈，避免刀光外侧或内侧“无特效却死怪”
      const rad = s.r * (0.94 + 0.1 * Phaser.Math.Easing.Quadratic.Out(k));
      const tierBoost = 1 + s.tier * 0.1;
      const thick = Math.max(22, s.r * 0.34) * (0.45 + 0.55 * a) * tierBoost;
      const coreRatio = s.tier >= 1 ? 0.52 : 0.36;
      this.fillCrescent(glow, s.x, s.y, rad, thick * 1.32, tail, head, s.color, 0.48 * a);
      this.fillCrescent(g, s.x, s.y, rad, thick * 0.88, tail, head, s.color, 0.84 * a);
      this.fillCrescent(glow, s.x, s.y, rad + 2, thick * coreRatio, tail + 0.06, head, 0xffffff, (s.tier >= 1 ? 0.96 : 0.86) * a);
      // IV 级传说：错位延迟的二重金紫斩弧
      if (s.tier >= 3) {
        const k2 = Math.max(0, (s.t - 0.025) / (s.total - 0.025));
        if (k2 > 0) {
          const a2 = 1 - k2;
          const h2 = s.a0 + (s.a1 - s.a0) * Math.min(1, k2 * 2.05);
          const t2 = s.a0 + (s.a1 - s.a0) * Math.max(0, (k2 - 0.22) * 1.18);
          this.fillCrescent(glow, s.x, s.y, rad * 1.11, thick * 0.78, t2, h2, LEGENDARY_VIOLET, 0.56 * a2);
          this.fillCrescent(g, s.x, s.y, rad * 0.78, thick * 0.52, t2 + 0.05, h2, LEGENDARY_GOLD, 0.78 * a2);
          this.fillCrescent(glow, s.x, s.y, rad * 1.12, thick * 0.28, t2 + 0.1, h2, 0xffffff, 0.9 * a2);
        }
      }
    }

    // 锋芒矛形直刺
    for (let i = this.thrusts.length - 1; i >= 0; i--) {
      const tr = this.thrusts[i];
      tr.t += dt;
      if (tr.t >= tr.total) {
        this.thrusts.splice(i, 1);
        continue;
      }
      const a = 1 - tr.t / tr.total;
      const hw = (tr.width * 0.72 + 1.5) * a;
      const coreRatio = tr.tier >= 1 ? 0.54 : 0.4;
      if (tr.tier >= 3) {
        this.fillLance(glow, tr.x0, tr.y0, tr.x1, tr.y1, hw * 2.1, LEGENDARY_VIOLET, 0.45 * a);
      }
      this.fillLance(glow, tr.x0, tr.y0, tr.x1, tr.y1, hw * 1.65, tr.tier >= 3 ? LEGENDARY_GOLD : tr.color, 0.52 * a);
      this.fillLance(g, tr.x0, tr.y0, tr.x1, tr.y1, hw, tr.color, 0.86 * a);
      this.fillLance(glow, tr.x0, tr.y0, tr.x1, tr.y1, hw * coreRatio, 0xffffff, 0.96 * a);
    }

    // 破风冲击锥刺
    for (let i = this.sonics.length - 1; i >= 0; i--) {
      const sn = this.sonics[i];
      sn.t += dt;
      if (sn.t >= sn.total) {
        this.sonics.splice(i, 1);
        continue;
      }
      const k = sn.t / sn.total;
      const a = 1 - k;
      const hw = (sn.width * 0.75 + 2) * a;
      if (sn.tier >= 3) {
        this.fillLance(glow, sn.x0, sn.y0, sn.x1, sn.y1, hw * 2.05, LEGENDARY_VIOLET, 0.42 * a);
      }
      this.fillLance(glow, sn.x0, sn.y0, sn.x1, sn.y1, hw * 1.6, sn.tier >= 3 ? LEGENDARY_GOLD : sn.color, 0.55 * a);
      this.fillLance(g, sn.x0, sn.y0, sn.x1, sn.y1, hw, sn.color, 0.9 * a);
      this.fillLance(glow, sn.x0, sn.y0, sn.x1, sn.y1, hw * (sn.tier >= 1 ? 0.52 : 0.42), 0xffffff, 0.95 * a);
      const ang = Math.atan2(sn.y1 - sn.y0, sn.x1 - sn.x0);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (let r = 1; r <= sn.rings; r++) {
        const frac = 0.32 + (r / (sn.rings + 1)) * 0.58;
        const cx = Phaser.Math.Linear(sn.x0, sn.x1, frac);
        const cy = Phaser.Math.Linear(sn.y0, sn.y1, frac);
        const span = (12 + r * 6) * (0.45 + 0.8 * k);
        const back = 10 * (0.5 + 0.5 * k);
        const tx = cx - Math.cos(ang) * back;
        const ty = cy - Math.sin(ang) * back;
        const ringCol = sn.tier >= 3 && r === sn.rings ? LEGENDARY_GOLD : sn.color;
        glow.lineStyle(4 * a + 1, ringCol, 0.65 * a);
        glow.beginPath();
        glow.moveTo(tx + nx * span, ty + ny * span);
        glow.lineTo(cx, cy);
        glow.lineTo(tx - nx * span, ty - ny * span);
        glow.strokePath();
        g.lineStyle(1.8 * a + 0.6, 0xffffff, 0.85 * a);
        g.beginPath();
        g.moveTo(tx + nx * span * 0.8, ty + ny * span * 0.8);
        g.lineTo(cx, cy);
        g.lineTo(tx - nx * span * 0.8, ty - ny * span * 0.8);
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

    // 扩散冲击波环
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= RING_TIME) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.t / RING_TIME;
      const rad = r.r * (0.34 + 0.66 * Phaser.Math.Easing.Quadratic.Out(k));
      glow.lineStyle(10 * (1 - k) + 2, r.color, 0.55 * (1 - k));
      glow.strokeCircle(r.x, r.y, rad);
      g.lineStyle(4.5 * (1 - k) + 1.2, r.color, 0.92 * (1 - k));
      g.strokeCircle(r.x, r.y, rad);
      glow.lineStyle(2, 0xffffff, 0.72 * (1 - k));
      glow.strokeCircle(r.x, r.y, rad * 0.92);
      g.fillStyle(r.color, 0.14 * (1 - k));
      g.fillCircle(r.x, r.y, rad);
    }

    // 钳颚撕咬双新月刃
    for (let i = this.chomps.length - 1; i >= 0; i--) {
      const c = this.chomps[i];
      c.t += dt;
      if (c.t >= c.total) {
        this.chomps.splice(i, 1);
        continue;
      }
      const k = c.t / c.total;
      const a = 1 - k;
      const clamp = 0.55 * (1 - Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 1.5)));
      // 视觉咬合范围直抵 100% 真实射程 c.r（不再缩水到 42%~66%）
      const rad = c.r * (0.76 + 0.24 * Phaser.Math.Easing.Quadratic.Out(k));
      const tb = 1 + c.tier * 0.1;
      for (const side of [-1, 1]) {
        const jawA = c.ang + side * (clamp + 0.05);
        const startA = jawA - side * 0.52;
        const a0 = Math.min(startA, jawA);
        const a1 = Math.max(startA, jawA);
        this.fillCrescent(glow, c.x, c.y, rad, 18 * tb * a, a0, a1, c.color, 0.58 * a, 12);
        this.fillCrescent(g, c.x, c.y, rad, 12 * tb * a, a0, a1, c.color, 0.9 * a, 12);
        this.fillCrescent(glow, c.x, c.y, rad + 1, (c.tier >= 1 ? 6.2 : 4.8) * tb * a, a0, a1, 0xffffff, 0.95 * a, 12);
        if (c.tier >= 3) {
          this.fillCrescent(glow, c.x, c.y, rad * 1.12, 7 * a, a0, a1, LEGENDARY_VIOLET, 0.52 * a, 10);
        }
      }
    }

    // 盾击扇形震荡波（1:1 覆盖真实砸击外缘 b.r）
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
      const rOuter = b.r * (0.48 + 0.52 * ease);
      const rInner = rOuter * 0.58;
      const a0 = b.ang - b.arc;
      const a1 = b.ang + b.arc;
      const tb = 1 + b.tier * 0.1;
      this.fillCrescent(glow, b.x, b.y, rOuter, (24 * a + 4) * tb, a0, a1, b.color, 0.6 * a, 18);
      this.fillCrescent(g, b.x, b.y, rOuter, (15 * a + 2) * tb, a0, a1, b.color, 0.88 * a, 18);
      this.fillCrescent(glow, b.x, b.y, rOuter + 2, (b.tier >= 1 ? 7.2 : 5.8) * a, a0 + 0.08, a1 - 0.08, 0xffffff, 0.95 * a, 16);
      this.fillCrescent(glow, b.x, b.y, rInner, 10 * tb * a, a0 + 0.15, a1 - 0.15, b.tier >= 3 ? LEGENDARY_GOLD : b.color, 0.52 * a, 12);
      if (b.tier >= 3) {
        this.fillCrescent(glow, b.x, b.y, rOuter * 1.08, 8 * a, a0 + 0.1, a1 - 0.1, LEGENDARY_VIOLET, 0.55 * a, 14);
      }
    }

    // 近战/重击定向命中交叉斩痕（Hit-Spark）
    for (let i = this.hitSlashes.length - 1; i >= 0; i--) {
      const hs = this.hitSlashes[i];
      hs.t += dt;
      if (hs.t >= hs.total) {
        this.hitSlashes.splice(i, 1);
        continue;
      }
      const k = hs.t / hs.total;
      const a = 1 - k;
      const grow = 0.65 + 0.55 * Phaser.Math.Easing.Quadratic.Out(k);
      const mainLen = 19 * hs.scale * grow;
      const crossLen = 10 * hs.scale * grow;
      const ca = Math.cos(hs.ang);
      const sa = Math.sin(hs.ang);
      const pa = -sa;
      const pb = ca;
      // 主斩痕（黑墨微边 + 亮白锐利刃芒）
      this.fillLance(glow, hs.x - ca * mainLen, hs.y - sa * mainLen, hs.x + ca * mainLen, hs.y + sa * mainLen, 4.4 * hs.scale * a, hs.color, 0.65 * a);
      this.fillLance(g, hs.x - ca * mainLen, hs.y - sa * mainLen, hs.x + ca * mainLen, hs.y + sa * mainLen, 2.4 * hs.scale * a, 0xffffff, 0.98 * a);
      // 垂直交叉细闪
      this.fillLance(glow, hs.x - pa * crossLen, hs.y - pb * crossLen, hs.x + pa * crossLen, hs.y + pb * crossLen, 2.2 * hs.scale * a, hs.color, 0.62 * a);
      this.fillLance(g, hs.x - pa * crossLen, hs.y - pb * crossLen, hs.x + pa * crossLen, hs.y + pb * crossLen, 1.2 * hs.scale * a, 0xffffff, 0.92 * a);
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

    // 四芒爆闪星光
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.t += dt;
      if (st.t >= st.total) {
        this.stars.splice(i, 1);
        continue;
      }
      const k = st.t / st.total;
      const a = 1 - k;
      const pop = k < 0.25 ? 0.55 + (k / 0.25) * 0.65 : 1.2 - (k - 0.25) * 0.4;
      const rad = st.r * pop;
      this.fillStar(glow, st.x, st.y, rad * 1.25, rad * 0.24, st.rot, st.color, 0.65 * a);
      this.fillStar(g, st.x, st.y, rad, rad * 0.2, st.rot, st.color, 0.9 * a);
      this.fillStar(glow, st.x, st.y, rad * 0.68, rad * 0.12, st.rot, 0xffffff, 0.98 * a);
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
