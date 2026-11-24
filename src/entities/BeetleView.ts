import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { UI_WEAPON_RES, weaponTex } from '../art/icons';

type P = readonly [number, number];

/** 一条腿：根部、膝、爪尖（相对身体中心，朝右为前；side = 1 是右侧），group 是步态分组 */
interface LegDef {
  root: P;
  knee: P;
  tip: P;
  side: 1 | -1;
  group: 0 | 1;
  /** 粗细倍率 */
  w?: number;
}

/** 身体结构：按武器槽顺序排列的腿，加上超出时长出来的额外肢体（尾巴、纺器） */
interface BodyPlan {
  legs: LegDef[];
  extra: LegDef[];
  palette: { out: number; mid: number; hi: number };
  /** 腿整体粗细 */
  width: number;
}

/** 一对左右对称的腿（右侧先、左侧后），三角步态：同一对左右分在不同组 */
function pair(root: P, knee: P, tip: P, group: 0 | 1, w?: number): LegDef[] {
  return [
    { root, knee, tip, side: 1, group, w },
    { root, knee, tip, side: -1, group: group === 0 ? 1 : 0, w },
  ];
}

const TAIL: LegDef = { root: [-14, 0], knee: [-24, 3], tip: [-36, 0], side: 1, group: 1 };

/** 甲虫的六条腿：前足、中足、后足 */
const BEETLE_LEGS = [
  ...pair([15, 6], [23, 14], [31, 18], 0),
  ...pair([7, 8], [12, 19], [5, 27], 1),
  ...pair([1, 9], [-7, 18], [-21, 23], 0),
];

function beetle(out: number, mid: number, hi: number): BodyPlan {
  return { legs: BEETLE_LEGS, extra: [TAIL], palette: { out, mid, hi }, width: 1 };
}

/** 各角色的身体：腿的数量和位置 = 武器槽（DESIGN.md 15.5） */
const BODY_PLANS: Record<string, BodyPlan> = {
  'beetle-stag': beetle(0x2d1205, 0x9c4d18, 0xd8823c),
  'beetle-rhino': beetle(0x180904, 0x5c2b12, 0x9e5832),
  'beetle-bombardier': beetle(0x0c1228, 0x3b4d8c, 0xe68830),
  'beetle-ladybug': beetle(0x160605, 0x3a1c1a, 0x70423e),
  'beetle-tiger': beetle(0x0a2414, 0x2f8a52, 0x9ce8a8),
  'beetle-dung': beetle(0x08080c, 0x2a2a38, 0x6a6a88),
  'bug-cicada': beetle(0x1a1408, 0x5a4a22, 0xa8925a),
  'bug-termite': beetle(0x3a2a14, 0xc8a878, 0xf4e0bc),
  // 蜘蛛：八条腿，膝盖高高拱起
  'bug-spider': {
    legs: [
      ...pair([12, 5], [22, 17], [34, 20], 0),
      ...pair([9, 7], [15, 21], [18, 30], 1),
      ...pair([5, 7], [1, 22], [-7, 29], 0),
      ...pair([2, 6], [-10, 18], [-25, 22], 1),
    ],
    extra: [{ root: [-20, 0], knee: [-28, 2], tip: [-38, 0], side: 1, group: 1 }],
    palette: { out: 0x120a10, mid: 0x4a3040, hi: 0x9a7088 },
    width: 0.9,
  },
  // 螳螂：一对粗壮的捕捉足（前两个槽）+ 四条细长步足
  'bug-mantis': {
    legs: [
      ...pair([14, 4], [24, 13], [34, 7], 0, 1.5),
      ...pair([2, 5], [8, 18], [2, 28], 1),
      ...pair([-6, 5], [-14, 18], [-28, 25], 0),
    ],
    extra: [{ root: [-24, 0], knee: [-32, 2], tip: [-41, 0], side: 1, group: 1 }],
    palette: { out: 0x1c3410, mid: 0x6aa83a, hi: 0xb8e878 },
    width: 0.8,
  },
  // 刺蛾幼虫：短短的胸足
  'bug-caterpillar': {
    legs: [...pair([17, 7], [20, 11], [23, 15], 0), ...pair([9, 8], [11, 12], [12, 17], 1), ...pair([1, 8], [1, 12], [0, 17], 0)],
    extra: [{ root: [-24, 0], knee: [-31, 2], tip: [-39, 0], side: 1, group: 1 }],
    palette: { out: 0x1e3008, mid: 0x7aa82a, hi: 0xd8f06a },
    width: 1.35,
  },
  // 蚊子：又细又长的腿
  'bug-mosquito': {
    legs: [
      ...pair([8, 3], [18, 14], [34, 22], 0),
      ...pair([4, 4], [6, 18], [2, 32], 1),
      ...pair([0, 4], [-12, 16], [-30, 28], 0),
    ],
    extra: [{ root: [-18, 0], knee: [-28, 1], tip: [-38, 0], side: 1, group: 1 }],
    palette: { out: 0x14100c, mid: 0x5a4a3a, hi: 0xc8b8a0 },
    width: 0.55,
  },
  // 蚁后：腿长在胸部，后面拖着大腹部
  'bug-antqueen': {
    legs: [...pair([12, 5], [20, 14], [30, 18], 0), ...pair([8, 6], [12, 18], [6, 27], 1), ...pair([4, 6], [-4, 17], [-16, 24], 0)],
    extra: [{ root: [-28, 0], knee: [-35, 2], tip: [-43, 0], side: 1, group: 1 }],
    palette: { out: 0x1e0a06, mid: 0x7a3418, hi: 0xd8784a },
    width: 0.85,
  },
};

/** 六条腿的角色数量（菜单里的装饰甲虫用） */
export const SLOT_COUNT = 6;
/** 武器槽最多 9 个（蜘蛛 8 个 + 第七条腿） */
export const MAX_SLOTS = 9;

/** 甲虫的外观：身体、六条会走路的关节腿、腿尖上挂的武器、护盾与增益光环 */
export class BeetleView extends Phaser.GameObjects.Container {
  private readonly legs: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Graphics;
  private readonly shell: Phaser.GameObjects.Image;
  private readonly plan: BodyPlan;
  private readonly weaponSprites: (Phaser.GameObjects.Image | null)[] = new Array(MAX_SLOTS).fill(null);
  private readonly weaponShadows: (Phaser.GameObjects.Ellipse | null)[] = new Array(MAX_SLOTS).fill(null);
  private readonly weaponActive: boolean[] = new Array(MAX_SLOTS).fill(false);
  private readonly weaponKick: number[] = new Array(MAX_SLOTS).fill(0);
  private readonly weaponKickDur: number[] = new Array(MAX_SLOTS).fill(0.12);
  private readonly weaponKickMag: number[] = new Array(MAX_SLOTS).fill(6);
  /** 品质越高，悬浮在周身的武器略大一点 */
  private readonly weaponScale: number[] = new Array(MAX_SLOTS).fill(1);
  /** 近战武器刺出去的距离 */
  private readonly weaponExtend: number[] = new Array(MAX_SLOTS).fill(0);
  private weaponsVisible = true;
  private walkPhase = 0;
  private walkAmount = 0;
  private auraTime = 0;
  private hasShield = false;
  private hasHaste = false;
  private hasSlow = false;
  private hasFrenzy = false;
  /** 当前武器槽数量：超过腿数时长出额外肢体 */
  private slotCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, shell = 'beetle-stag') {
    super(scene, x, y);
    this.plan = BODY_PLANS[shell] ?? BODY_PLANS['beetle-stag'];
    // 统一左上角 35° 光源方向，投影略向右下偏移
    const shadow = scene.add.image(2, 6, 'shadow').setScale(1 / SPRITE_RES).setAlpha(0.9);
    this.legs = scene.add.graphics();
    this.shell = scene.add.image(0, 0, shell).setScale(1 / SPRITE_RES);
    this.aura = scene.add.graphics();
    this.add([shadow, this.legs, this.shell, this.aura]);
    scene.add.existing(this);
    this.drawLegs();
  }

  /** 更新角色身上的实时视觉状态（护盾气泡、加速风环、丝网减速、琥珀狂热） */
  setStatus(shield: boolean, haste: boolean, slow: boolean, frenzy = false): void {
    this.hasShield = shield;
    this.hasHaste = haste;
    this.hasSlow = slow;
    this.hasFrenzy = frenzy;
  }

  /** 设置局内周身悬浮武器是否显示（设置项：隐藏武器） */
  setWeaponsVisible(visible: boolean): void {
    if (this.weaponsVisible === visible) return;
    this.weaponsVisible = visible;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const show = visible && this.weaponActive[i];
      this.weaponSprites[i]?.setVisible(show);
      this.weaponShadows[i]?.setVisible(show);
    }
  }

  setWeapon(slot: number, texture: string | null, tier = 0, hiRes = false): void {
    let sprite = this.weaponSprites[slot];
    let shadow = this.weaponShadows[slot];
    const texScale = hiRes ? UI_WEAPON_RES : SPRITE_RES;
    this.weaponScale[slot] = (1 + 0.08 * tier) / texScale;
    this.weaponExtend[slot] = 0;
    if (!texture) {
      this.weaponActive[slot] = false;
      sprite?.setVisible(false);
      shadow?.setVisible(false);
      return;
    }
    this.weaponActive[slot] = true;
    // 统一使用干净黑墨原画，避免高品阶 UI 卡片贴纸边框与横切色带糊在甲虫身上
    const key = weaponTex(texture, 0, hiRes);
    if (!shadow) {
      shadow = this.scene.add.ellipse(0, 0, 17, 6.5, 0x050507, 0.36);
      this.weaponShadows[slot] = shadow;
      this.addAt(shadow, 1);
    }
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, key);
      this.weaponSprites[slot] = sprite;
      this.add(sprite);
      // 保持状态光环在最顶层
      this.bringToTop(this.aura);
    }
    const show = this.weaponsVisible;
    shadow.setVisible(show);
    sprite.setTexture(key).setVisible(show);
    this.placeWeapon(slot);
  }

  /** 让武器朝向世界坐标下的某个角度；kick > 0 时触发沿枪管反方向的物理后坐回弹 */
  setWeaponAim(slot: number, worldAngle: number, kick = 0, recoilMag = 6): void {
    const sprite = this.weaponSprites[slot];
    if (!sprite) return;
    sprite.rotation = worldAngle - this.rotation;
    sprite.setFlipY(Math.cos(worldAngle) < 0);
    if (kick > 0) {
      this.weaponKick[slot] = kick;
      this.weaponKickDur[slot] = kick;
      this.weaponKickMag[slot] = recoilMag;
    }
  }

  /** 武器槽数量；超过腿数的部分长在尾巴上 */
  setSlotCount(n: number): void {
    this.slotCount = n;
    this.drawLegs();
  }

  /** 这个身体默认有几条腿 */
  get legCount(): number {
    return this.plan.legs.length;
  }

  private legAt(slot: number): LegDef {
    const legs = this.plan.legs;
    return slot < legs.length ? legs[slot] : this.plan.extra[Math.min(this.plan.extra.length - 1, slot - legs.length)];
  }

  /** 近战攻击时武器沿瞄准方向刺出的距离（本地像素） */
  setWeaponExtend(slot: number, distance: number): void {
    this.weaponExtend[slot] = distance;
  }

  /** 腿尖（武器挂点）的世界坐标 */
  tipWorld(slot: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const [lx, ly] = this.tipLocal(slot);
    const c = Math.cos(this.rotation) * this.scaleX;
    const s = Math.sin(this.rotation) * this.scaleX;
    return out.set(this.x + lx * c - ly * s, this.y + lx * s + ly * c);
  }

  /** 腿尖在本地坐标里的角度，用于武器没目标时朝外摆放 */
  tipLocalAngle(slot: number): number {
    const [lx, ly] = this.tipLocal(slot);
    return Math.atan2(ly, lx);
  }

  /** amount：0 静止 ~ 1 全速行走 */
  animate(dt: number, amount: number): void {
    if (!Number.isFinite(amount)) amount = 0;
    this.auraTime += dt;
    this.walkAmount += (amount - this.walkAmount) * Math.min(1, dt * 12);
    this.walkPhase += dt * (4 + 14 * this.walkAmount);
    const breath = 1 + Math.sin(this.auraTime * 3.2) * 0.012 + Math.sin(this.walkPhase * 2) * 0.022 * this.walkAmount;
    this.shell.setScale(breath / SPRITE_RES);
    this.drawLegs();
    this.drawAura();
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.weaponKick[i] > 0) this.weaponKick[i] = Math.max(0, this.weaponKick[i] - dt);
      this.placeWeapon(i);
    }
  }

  private legOffset(group: number): number {
    const idle = 0.6;
    return Math.sin(this.walkPhase + group * Math.PI) * (idle + 5 * this.walkAmount);
  }

  private tipLocal(slot: number): [number, number] {
    const L = this.legAt(slot);
    // 将武器从腿尖外推到甲虫轮廓之外，形成土豆兄弟风格周身悬浮武器环
    const tx = L.tip[0];
    const ty = L.tip[1] * L.side;
    const len = Math.hypot(tx, ty) || 1;
    const extraRing = Math.max(0, slot - this.plan.legs.length) * 0.45;
    const rx = 44 + extraRing * 6;
    const ry = 40 + extraRing * 6;
    return [(tx / len) * rx, (ty / len) * ry];
  }

  private placeWeapon(slot: number): void {
    const sprite = this.weaponSprites[slot];
    if (!sprite || !this.weaponActive[slot] || !this.weaponsVisible) return;
    const [bx, by] = this.tipLocal(slot);
    const ext = this.weaponExtend[slot];
    // 真实沿枪管反方向的物理后坐回弹：瞬时猛缩 -> 弹性微过冲回位 + 轻微轴向压缩
    const kick = this.weaponKick[slot];
    let recoil = 0;
    let punch = 0;
    if (kick > 0) {
      const dur = Math.max(0.04, this.weaponKickDur[slot]);
      const p = 1 - kick / dur;
      const mag = this.weaponKickMag[slot];
      if (p < 0.18) {
        const k = p / 0.18;
        recoil = -mag * (0.45 + 0.55 * k);
        punch = 0.6 + 0.4 * k;
      } else {
        const k = (p - 0.18) / 0.82;
        // 阻尼弹性回位（带约 12% 的柔和前冲收束）
        const ease = 1 - Math.pow(1 - k, 2.4);
        const overshoot = Math.sin(k * Math.PI) * 0.14 * mag;
        recoil = -mag * (1 - ease) + overshoot;
        punch = (1 - k) * (1 - k);
      }
    }
    const wave = Math.sin(this.auraTime * 2.5 + slot * 1.15);
    const bob = Math.abs(ext) > 1 || kick > 0.01 ? 0 : wave * 1.8;
    // 在世界竖直方向做轻盈悬浮呼吸，同时把投影始终落在武器正下方地面
    const c = Math.cos(this.rotation);
    const s = Math.sin(this.rotation);
    const bobLx = bob * s;
    const bobLy = bob * c;
    const reach = ext + recoil;
    const wx = bx + Math.cos(sprite.rotation) * reach + bobLx;
    const wy = by + Math.sin(sprite.rotation) * reach + bobLy;
    sprite.setPosition(wx, wy);
    const baseSc = this.weaponScale[slot];
    sprite.setScale(baseSc * (1 - punch * 0.14), baseSc * (1 + punch * 0.1));

    const shadow = this.weaponShadows[slot];
    if (shadow) {
      const shOffY = 7;
      shadow.setPosition(bx + Math.cos(sprite.rotation) * reach + shOffY * s, by + Math.sin(sprite.rotation) * reach + shOffY * c);
      shadow.setRotation(-this.rotation);
      shadow.setScale(1 - wave * 0.08, 1 - wave * 0.05);
    }
  }

  private drawAura(): void {
    const g = this.aura;
    g.clear();
    if (this.hasShield) {
      const pulse = 31 + Math.sin(this.auraTime * 4.5) * 1.4;
      g.fillStyle(0x7fd4ff, 0.11);
      g.fillCircle(0, 0, pulse);
      g.lineStyle(2.2, 0x9fe4ff, 0.72);
      g.strokeCircle(0, 0, pulse);
      const a0 = this.auraTime * 2.2;
      g.lineStyle(3, 0xe8faff, 0.85);
      g.beginPath();
      g.arc(0, 0, pulse, a0, a0 + 1.1);
      g.strokePath();
    }
    if (this.hasHaste) {
      g.lineStyle(2, 0xffe27a, 0.65);
      const a = this.auraTime * 7;
      g.beginPath();
      g.arc(0, 0, 26, a, a + 1.6);
      g.strokePath();
      g.beginPath();
      g.arc(0, 0, 26, a + Math.PI, a + Math.PI + 1.6);
      g.strokePath();
    }
    if (this.hasFrenzy) {
      const a = this.auraTime * 9;
      g.fillStyle(0xffb828, 0.12);
      g.fillCircle(0, 0, 29);
      g.lineStyle(2.6, 0xffd44c, 0.85);
      g.beginPath();
      g.arc(0, 0, 29, a, a + 1.3);
      g.strokePath();
      g.beginPath();
      g.arc(0, 0, 29, a + Math.PI, a + Math.PI + 1.3);
      g.strokePath();
    }
    if (this.hasSlow) {
      g.lineStyle(1.6, 0xd8dcff, 0.7);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.4;
        g.beginPath();
        g.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
        g.lineTo(Math.cos(a + 2.3) * 18, Math.sin(a + 2.3) * 18);
        g.strokePath();
      }
    }
  }

  private drawLegs(): void {
    const g = this.legs;
    g.clear();
    const plan = this.plan;
    const extra = Math.max(0, Math.min(plan.extra.length, this.slotCount - plan.legs.length));
    const pal = plan.palette;

    // 绘制带黑墨轮廓与渐变宽度的节肢装甲片段
    const drawSegment = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, fill: number, out: number) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const outlinePad = 1.25;

      g.fillStyle(out, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x0 + nx * (r0 + outlinePad), y0 + ny * (r0 + outlinePad)),
          new Phaser.Math.Vector2(x1 + nx * (r1 + outlinePad), y1 + ny * (r1 + outlinePad)),
          new Phaser.Math.Vector2(x1 - nx * (r1 + outlinePad), y1 - ny * (r1 + outlinePad)),
          new Phaser.Math.Vector2(x0 - nx * (r0 + outlinePad), y0 - ny * (r0 + outlinePad)),
        ],
        true,
      );
      g.fillCircle(x0, y0, r0 + outlinePad);
      g.fillCircle(x1, y1, r1 + outlinePad);

      g.fillStyle(fill, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x0 + nx * r0, y0 + ny * r0),
          new Phaser.Math.Vector2(x1 + nx * r1, y1 + ny * r1),
          new Phaser.Math.Vector2(x1 - nx * r1, y1 - ny * r1),
          new Phaser.Math.Vector2(x0 - nx * r0, y0 - ny * r0),
        ],
        true,
      );
      g.fillCircle(x0, y0, r0);
      g.fillCircle(x1, y1, r1);
    };

    for (let i = 0; i < plan.legs.length + extra; i++) {
      const L = i < plan.legs.length ? plan.legs[i] : plan.extra[i - plan.legs.length];
      const side = L.side;
      const w = plan.width * (L.w ?? 1);
      const o = this.legOffset(L.group);
      const rx = L.root[0];
      const ry = L.root[1] * side;
      const kx = L.knee[0] + o * 0.5;
      const ky = L.knee[1] * side;
      const tx = L.tip[0] + o;
      const ty = L.tip[1] * side;

      // 大腿（粗壮甲壳节）+ 小腿（尖锐节肢 + 距刺）
      drawSegment(rx, ry, kx, ky, 2.2 * w, 1.55 * w, pal.mid, pal.out);
      drawSegment(kx, ky, tx, ty, 1.45 * w, 0.75 * w, pal.mid, pal.out);

      // 赛璐璐大腿高光边
      g.lineStyle(1.1 * Math.max(0.7, w), pal.hi, 0.85);
      g.beginPath();
      g.moveTo(rx, ry - 0.5 * side);
      g.lineTo(kx, ky - 0.5 * side);
      g.strokePath();

      // 膝甲关节与爪尖倒刺
      g.fillStyle(pal.out, 1);
      g.fillCircle(kx, ky, 2.3 * Math.max(0.7, w));
      g.fillStyle(pal.hi, 0.95);
      g.fillCircle(kx, ky, 1.15 * Math.max(0.7, w));
      g.fillStyle(pal.out, 1);
      g.fillCircle(tx, ty, 1.8 * Math.max(0.7, w));
    }
  }
}
