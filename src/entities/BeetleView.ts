import Phaser from 'phaser';
import { SPRITE_RES } from '../art/draw';
import { UI_WEAPON_RES, weaponTex } from '../art/icons';
import { SHELL_SKINS, type ShellSkinId } from '../core/save';

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

/** 鞭类/链锤/长柄/伸缩臂武器的实时物理连结状态（本地坐标系） */
export interface WeaponTether {
  kind: 'whip' | 'chain' | 'sections' | 'pole' | 'scissor';
  /** 挥扫/刺出进度 0~1 */
  st: number;
  /** 1 或 -1，决定甩动弯曲方向 */
  dir: 1 | -1;
  /** 本地伸展距离 */
  ext: number;
  /** 当前指向角（本地弧度） */
  localAngle: number;
  /** 挥扫半角 */
  arc: number;
}

/** 单次攻击帧的武器实体姿态微调（抬锤下砸、咬合挤压、电锯震动等，纯实体物理表现） */
export interface WeaponMotion {
  /** 世界竖直方向抬升/下砸偏移（负值向上抬起，正值下砸） */
  liftY?: number;
  /** 武器绕自身中心额外倾角（弧度） */
  tilt?: number;
  /** 武器轴向/法向弹性缩放 */
  scaleX?: number;
  scaleY?: number;
  /** 高频机械震动幅度（像素） */
  jitter?: number;
}

/** 甲虫的外观：身体、六条会走路的关节腿、腿尖上挂的武器、护盾与增益光环 */
export class BeetleView extends Phaser.GameObjects.Container {
  private readonly legs: Phaser.GameObjects.Graphics;
  private readonly weaponTethers: Phaser.GameObjects.Graphics;
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
  /** 武器真实瞄准角（本地坐标系，独立于圆锯自转/重锤倾角） */
  private readonly weaponAimLocal: number[] = new Array(MAX_SLOTS).fill(0);
  /** 武器镜像翻转缓存（带迟滞防竖直朝向高频抖翻，挥砍期间锁定翻转方向） */
  private readonly weaponFlipY: boolean[] = new Array(MAX_SLOTS).fill(false);
  /** 武器绕自身枢轴点（手持近战设为握柄端，真正绕手腕挥砍；枪械/圆锯保持 0.5 中心） */
  private readonly weaponOriginX: number[] = new Array(MAX_SLOTS).fill(0.5);
  /** 圆锯等旋转武器的自转速度与累计角度 */
  private readonly weaponSpinRate: number[] = new Array(MAX_SLOTS).fill(0);
  private readonly weaponSpinAngle: number[] = new Array(MAX_SLOTS).fill(0);
  /** 鞭子/铁链/长杆/伸缩臂的实时物理连结参数 */
  private readonly tetherStates: (WeaponTether | null)[] = new Array(MAX_SLOTS).fill(null);
  /** 武器额外实体姿态（下砸抬升、咬合挤压、震动） */
  private readonly motionStates: (WeaponMotion | null)[] = new Array(MAX_SLOTS).fill(null);
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
    this.weaponTethers = scene.add.graphics();
    this.aura = scene.add.graphics();
    this.add([shadow, this.legs, this.shell, this.weaponTethers, this.aura]);
    scene.add.existing(this);
    this.drawLegs();
  }

  /** 应用局外图鉴解锁的炫彩甲壳涂装（不影响数值） */
  setShellSkin(skin?: ShellSkinId): void {
    const info = skin ? SHELL_SKINS[skin] : null;
    if (info?.tint) this.shell.setTint(info.tint);
    else this.shell.clearTint();
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
    this.weaponOriginX[slot] = 0.5;
    this.weaponAimLocal[slot] = this.tipLocalAngle(slot);
    this.weaponSpinRate[slot] = 0;
    this.weaponSpinAngle[slot] = 0;
    this.tetherStates[slot] = null;
    this.motionStates[slot] = null;
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
    sprite.setTexture(key).setOrigin(0.5, 0.5).setVisible(show);
    this.placeWeapon(slot);
  }

  /** 设置武器枢轴点（手持刀剑/斧锤设为握柄端 0.16，挥砍时绕握柄真实摆动） */
  setWeaponPivot(slot: number, originX: number): void {
    this.weaponOriginX[slot] = originX;
    this.weaponSprites[slot]?.setOrigin(originX, 0.5);
  }

  /** 让武器朝向世界坐标下的某个角度；kick > 0 时触发沿枪管反方向的物理后坐回弹；lockFlipAngle 可在挥砍期间锁定镜像朝向防中途翻转 */
  setWeaponAim(slot: number, worldAngle: number, kick = 0, recoilMag = 6, lockFlipAngle?: number): void {
    const sprite = this.weaponSprites[slot];
    if (!sprite) return;
    this.weaponAimLocal[slot] = worldAngle - this.rotation;
    if (lockFlipAngle !== undefined) {
      this.weaponFlipY[slot] = Math.cos(lockFlipAngle) < 0;
    } else {
      const cx = Math.cos(worldAngle);
      if (Math.abs(cx) > 0.12) this.weaponFlipY[slot] = cx < 0;
    }
    sprite.setFlipY(this.weaponFlipY[slot]);
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

  /** 设置软体/链锤/长柄武器的实时物理连结状态（null 表示收起归位） */
  setWeaponTether(slot: number, state: WeaponTether | null): void {
    this.tetherStates[slot] = state;
  }

  /** 设置武器当前帧的额外实体姿态（抬锤下砸、夹咬挤压、电锯震动） */
  setWeaponMotion(slot: number, motion: WeaponMotion | null): void {
    this.motionStates[slot] = motion;
  }

  /** 设置旋转类武器（圆锯甲）的自转角速度（弧度/秒） */
  setWeaponSpin(slot: number, radPerSec: number): void {
    this.weaponSpinRate[slot] = radPerSec;
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
      if (this.weaponSpinRate[i] !== 0) this.weaponSpinAngle[i] += this.weaponSpinRate[i] * dt;
      this.placeWeapon(i);
    }
    this.drawTethers();
  }

  private legOffset(group: number): number {
    const idle = 0.6;
    return Math.sin(this.walkPhase + group * Math.PI) * (idle + 5 * this.walkAmount);
  }

  private tipLocal(slot: number): [number, number] {
    const L = this.legAt(slot);
    // 武器稳稳挂在对应腿爪尖端（仅微外扩 2.5px 避免与甲壳穿模），绝不漂浮远离身体乱飞
    const tx = L.tip[0];
    const ty = L.tip[1] * L.side;
    const len = Math.hypot(tx, ty) || 1;
    const extraRing = Math.max(0, slot - this.plan.legs.length) * 6;
    const pad = 2.5 + extraRing;
    return [tx + (tx / len) * pad, ty + (ty / len) * pad];
  }

  private placeWeapon(slot: number): void {
    const sprite = this.weaponSprites[slot];
    if (!sprite || !this.weaponActive[slot] || !this.weaponsVisible) return;
    const tether = this.tetherStates[slot];
    // 虫鞭与四节棍在挥扫时由实时物理连杆完整表现，隐藏静止小图标
    if (tether?.kind === 'whip' || tether?.kind === 'sections') {
      sprite.setVisible(false);
      this.weaponShadows[slot]?.setVisible(false);
      return;
    }
    if (!sprite.visible) {
      sprite.setVisible(true);
      this.weaponShadows[slot]?.setVisible(true);
    }
    const [bx, by] = this.tipLocal(slot);
    const ext = this.weaponExtend[slot];
    const aim = this.weaponAimLocal[slot];
    const motion = this.motionStates[slot];
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
        const ease = 1 - Math.pow(1 - k, 2.4);
        const overshoot = Math.sin(k * Math.PI) * 0.14 * mag;
        recoil = -mag * (1 - ease) + overshoot;
        punch = (1 - k) * (1 - k);
      }
    }
    const wave = Math.sin(this.auraTime * 2.5 + slot * 1.15);
    const bob = Math.abs(ext) > 1 || kick > 0.01 || motion ? 0 : wave * 1.8;
    // 在世界竖直方向做悬浮呼吸 / 重锤抬升下砸，同时把投影始终留在武器正下方地面
    const c = Math.cos(this.rotation);
    const s = Math.sin(this.rotation);
    const lift = bob + (motion?.liftY ?? 0);
    const liftLx = lift * s;
    const liftLy = lift * c;
    const jit = motion?.jitter ?? 0;
    const jx = jit > 0 ? Math.sin(this.auraTime * 78 + slot * 2.3) * jit : 0;
    const jy = jit > 0 ? Math.cos(this.auraTime * 91 + slot * 1.7) * jit : 0;

    const reach = ext + recoil;
    const gx = bx + Math.cos(aim) * reach;
    const gy = by + Math.sin(aim) * reach;
    sprite.setPosition(gx + liftLx + jx, gy + liftLy + jy);
    const tilt = motion?.tilt ?? 0;
    const spin = this.weaponSpinRate[slot] !== 0 ? this.weaponSpinAngle[slot] : 0;
    sprite.rotation = aim + tilt + spin;

    const baseSc = this.weaponScale[slot];
    const sx = (motion?.scaleX ?? 1) * (1 - punch * 0.14);
    const sy = (motion?.scaleY ?? 1) * (1 + punch * 0.1);
    sprite.setScale(baseSc * sx, baseSc * sy);

    const shadow = this.weaponShadows[slot];
    if (shadow) {
      const shOffY = 7;
      // 枢轴在握柄端时，投影沿刀身中段偏移，贴合刀体位置
      const midOff = (0.5 - this.weaponOriginX[slot]) * 26 * (motion?.scaleX ?? 1);
      const visAng = aim + tilt;
      shadow.setPosition(gx + Math.cos(visAng) * midOff + shOffY * s, gy + Math.sin(visAng) * midOff + shOffY * c);
      shadow.setRotation(-this.rotation);
      // 武器高高抬起时地面投影同步略缩小，营造立体高低差
      const liftShrink = lift < 0 ? Math.max(0.55, 1 + lift * 0.022) : 1;
      shadow.setScale((1 - wave * 0.08) * liftShrink, (1 - wave * 0.05) * liftShrink);
    }
  }

  /** 绘制虫鞭实时甩鞭行波动画 & 流星锤/锚壳重锤的牵引铁链（纯实体物理运动，无光效） */
  private drawTethers(): void {
    const g = this.weaponTethers;
    g.clear();
    if (!this.weaponsVisible) return;
    const cRot = Math.cos(this.rotation);
    const sRot = Math.sin(this.rotation);
    // 世界竖直向下方向的投影偏移（转换到容器本地坐标）
    const shX = 6 * sRot;
    const shY = 6 * cRot;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const t = this.tetherStates[i];
      if (!t || !this.weaponActive[i]) continue;
      const [bx, by] = this.tipLocal(i);

      if (t.kind === 'whip') {
        const ang = t.localAngle;
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const nx = -uy;
        const ny = ux;
        const st = t.st;
        // 手柄留在槽位处微甩，绝不脱离角色飞出去
        const handleLen = 11;
        const hx0 = bx - ux * 3;
        const hy0 = by - uy * 3;
        const hx1 = bx + ux * handleLen;
        const hy1 = by + uy * handleLen;

        // 鞭身从手柄尖端向外延展至 t.ext，并沿绳身传播一道真实的甩鞭行波：
        // 蓄力/初段大幅 S 形甩卷 -> 中段抽直破空 -> 末段自然回卷收回
        const ropeLen = Math.max(10, t.ext - handleLen);
        const segs = 18;
        const crackTaut = 1 - Math.exp(-Math.pow((st - 0.54) / 0.18, 2)); // 0.54 处瞬间抽紧拉直
        const waveAmp = Math.min(24, ropeLen * 0.24) * (0.25 + 0.75 * crackTaut) * Math.sin(Math.min(1, st) * Math.PI);
        const phase = st * 11.5;
        const pts: [number, number][] = [];
        for (let k = 0; k <= segs; k++) {
          const u = k / segs;
          // 梢端角滞后感：甩动前半段梢部滞后拖尾，过中段后甩过头抽响
          const lag = (0.5 - st) * 0.42 * u * u * t.dir;
          const a = ang + lag;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const lnx = -sa;
          const lny = ca;
          // 行波从手腕(u=0)向鞭梢(u=1)传递，振幅中段最大、梢尖利落收束
          const wave = Math.sin(u * Math.PI * 2.2 - phase) * Math.sin(u * Math.PI) * waveAmp * t.dir;
          const dist = ropeLen * u;
          pts.push([hx1 + ca * dist + lnx * wave, hy1 + sa * dist + lny * wave]);
        }

        // 1) 地面柔影
        g.lineStyle(4.2, 0x080604, 0.22);
        g.beginPath();
        g.moveTo(hx0 + shX, hy0 + shY);
        for (let k = 0; k < pts.length; k++) g.lineTo(pts[k][0] + shX, pts[k][1] + shY);
        g.strokePath();

        // 2) 鞭绳分段由粗到细绘制（黑墨外轮廓 + 编织皮革暖棕 + 顶部柔高光）
        for (let k = 0; k < segs; k++) {
          const u = k / segs;
          const [x0, y0] = pts[k];
          const [x1, y1] = pts[k + 1];
          const w = Math.max(1.3, (1 - u * 0.72) * 4.8);
          g.lineStyle(w + 2.6, 0x1c0f08, 0.94);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.strokePath();
          g.lineStyle(w, u > 0.86 ? 0x4a2414 : 0xc6823c, 0.98);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.strokePath();
          if (u < 0.72) {
            g.lineStyle(Math.max(0.8, w * 0.35), 0xf2c886, 0.65);
            g.beginPath();
            g.moveTo(x0 - nx * 0.5, y0 - ny * 0.5);
            g.lineTo(x1 - nx * 0.5, y1 - ny * 0.5);
            g.strokePath();
          }
        }

        // 3) 握把（深木色缠革 + 黄铜尾帽，稳稳留在槽位处）
        g.lineStyle(7.2, 0x1a0e06, 0.96);
        g.beginPath();
        g.moveTo(hx0, hy0);
        g.lineTo(hx1, hy1);
        g.strokePath();
        g.lineStyle(4.4, 0x6b3b1e, 1);
        g.beginPath();
        g.moveTo(hx0, hy0);
        g.lineTo(hx1, hy1);
        g.strokePath();
        g.fillStyle(0xd8a84e, 1);
        g.fillCircle(hx0, hy0, 2.6);
      } else if (t.kind === 'sections') {
        // 四节棍：4 段硬木棍以钢环铰接，从槽位向挥扫方向甩出微弯
        const ang = t.localAngle;
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const nx = -uy;
        const ny = ux;
        const totalLen = Math.max(18, t.ext);
        const bend = Math.min(20, totalLen * 0.16) * Math.sin(Math.min(1, t.st) * Math.PI) * -t.dir;
        const knots: [number, number][] = [];
        for (let k = 0; k <= 4; k++) {
          const u = k / 4;
          const off = Math.sin(u * Math.PI) * bend;
          knots.push([bx + ux * (totalLen * u) + nx * off, by + uy * (totalLen * u) + ny * off]);
        }
        // 地面投影
        g.lineStyle(4.5, 0x080604, 0.22);
        g.beginPath();
        g.moveTo(knots[0][0] + shX, knots[0][1] + shY);
        for (let k = 1; k <= 4; k++) g.lineTo(knots[k][0] + shX, knots[k][1] + shY);
        g.strokePath();
        // 4 节木棍 + 金属铰链环
        for (let k = 0; k < 4; k++) {
          const [x0, y0] = knots[k];
          const [x1, y1] = knots[k + 1];
          const sx = x0 + (x1 - x0) * 0.08;
          const sy = y0 + (y1 - y0) * 0.08;
          const ex = x0 + (x1 - x0) * 0.92;
          const ey = y0 + (y1 - y0) * 0.92;
          g.lineStyle(6.4, 0x1a0e06, 0.95);
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(ex, ey);
          g.strokePath();
          g.lineStyle(3.6, k % 2 === 0 ? 0xb47e42 : 0x9c6832, 1);
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(ex, ey);
          g.strokePath();
          if (k > 0) {
            g.fillStyle(0x161a22, 0.96);
            g.fillCircle(x0, y0, 3.0);
            g.fillStyle(0xb8c6d8, 1);
            g.fillCircle(x0, y0, 1.6);
          }
        }
      } else if (t.kind === 'pole') {
        // 刚性长柄杆（长角 / 骑甲长枪 / 三叉戟 / 镰臂 / 远足杖 / 树枝）：尾杆穿过爪尖握环直连兵器头，像真正持杆刺/扫
        const sprite = this.weaponSprites[i];
        if (!sprite) continue;
        const wx = sprite.x;
        const wy = sprite.y;
        const dx = wx - bx;
        const dy = wy - by;
        const dist = Math.hypot(dx, dy);
        const ux = dist > 2 ? dx / dist : Math.cos(t.localAngle);
        const uy = dist > 2 ? dy / dist : Math.sin(t.localAngle);
        const sx = bx - ux * 11;
        const sy = by - uy * 11;
        const ex = wx - ux * 4;
        const ey = wy - uy * 4;
        g.lineStyle(4.2, 0x080604, 0.22);
        g.beginPath();
        g.moveTo(sx + shX, sy + shY);
        g.lineTo(ex + shX, ey + shY);
        g.strokePath();
        g.lineStyle(5.8, 0x1a1008, 0.95);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.strokePath();
        g.lineStyle(3.2, 0x9c7244, 1);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.strokePath();
        g.lineStyle(1.1, 0xdeb880, 0.65);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.strokePath();
        // 爪尖持握套环
        g.fillStyle(0x1a1008, 0.96);
        g.fillCircle(bx, by, 3.6);
        g.fillStyle(0xd8a852, 1);
        g.fillCircle(bx, by, 2.0);
      } else if (t.kind === 'scissor') {
        // 爆雷钳机械剪刀伸缩臂：底座稳固锚在爪尖，手风琴式交叉钢梁连着钳头
        const sprite = this.weaponSprites[i];
        if (!sprite) continue;
        const wx = sprite.x;
        const wy = sprite.y;
        const dx = wx - bx;
        const dy = wy - by;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) continue;
        const ux = dx / dist;
        const uy = dy / dist;
        const nx = -uy;
        const ny = ux;
        const cells = Math.min(7, Math.max(3, Math.round(dist / 26)));
        const halfW = Math.max(3.5, Math.min(8.2, 10.5 - dist * 0.025));
        for (let k = 0; k < cells; k++) {
          const d0 = (dist * k) / cells;
          const d1 = (dist * (k + 1)) / cells;
          const a0x = bx + ux * d0 + nx * halfW;
          const a0y = by + uy * d0 + ny * halfW;
          const b0x = bx + ux * d0 - nx * halfW;
          const b0y = by + uy * d0 - ny * halfW;
          const a1x = bx + ux * d1 + nx * halfW;
          const a1y = by + uy * d1 + ny * halfW;
          const b1x = bx + ux * d1 - nx * halfW;
          const b1y = by + uy * d1 - ny * halfW;
          g.lineStyle(3.4, 0x16181e, 0.92);
          g.beginPath();
          g.moveTo(a0x, a0y);
          g.lineTo(b1x, b1y);
          g.moveTo(b0x, b0y);
          g.lineTo(a1x, a1y);
          g.strokePath();
          g.lineStyle(1.6, 0xc2ccd8, 0.96);
          g.beginPath();
          g.moveTo(a0x, a0y);
          g.lineTo(b1x, b1y);
          g.moveTo(b0x, b0y);
          g.lineTo(a1x, a1y);
          g.strokePath();
          const cx = bx + ux * ((d0 + d1) * 0.5);
          const cy = by + uy * ((d0 + d1) * 0.5);
          g.fillStyle(0xe8b848, 1);
          g.fillCircle(cx, cy, 1.5);
        }
        // 爪尖机械底座
        g.fillStyle(0x16181e, 0.96);
        g.fillCircle(bx, by, 4.2);
        g.fillStyle(0x9aa8b8, 1);
        g.fillCircle(bx, by, 2.3);
      } else {
        // 铁链（流星锤 / 锚壳重锤）：握柄留在爪尖，一节节铁链将锤头/船锚牢牢拴回手边
        const sprite = this.weaponSprites[i];
        if (!sprite) continue;
        const wx = sprite.x;
        const wy = sprite.y;
        const dx = wx - bx;
        const dy = wy - by;
        const dist = Math.hypot(dx, dy);
        if (dist < 8) continue;
        const ux = dx / dist;
        const uy = dy / dist;
        const nx = -uy;
        const ny = ux;
        const bow = Math.min(16, dist * 0.15) * Math.sin(Math.min(1, t.st) * Math.PI) * -t.dir;
        const mx = (bx + wx) * 0.5 + nx * bow;
        const my = (by + wy) * 0.5 + ny * bow;
        const evalQ = (u: number): [number, number] => {
          const inv = 1 - u;
          return [inv * inv * bx + 2 * inv * u * mx + u * u * wx, inv * inv * by + 2 * inv * u * my + u * u * wy];
        };

        // 铁链地面微影
        g.lineStyle(3.2, 0x080604, 0.2);
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const [px, py] = evalQ(k / 10);
          if (k === 0) g.moveTo(px + shX, py + shY);
          else g.lineTo(px + shX, py + shY);
        }
        g.strokePath();

        // 一节一节的铁链环（深墨边 + 钢灰环身 + 高光点）
        const links = Math.max(3, Math.round(dist / 8));
        for (let k = 0; k < links; k++) {
          const u0 = k / links;
          const u1 = Math.min(1, (k + 0.85) / links);
          const [x0, y0] = evalQ(u0);
          const [x1, y1] = evalQ(u1);
          const wide = k % 2 === 0;
          g.lineStyle(wide ? 5.2 : 4.2, 0x141820, 0.95);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.strokePath();
          g.lineStyle(wide ? 2.8 : 2.0, wide ? 0x8a9ab0 : 0x627086, 1);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.strokePath();
          if (wide) {
            g.fillStyle(0xd8e4f4, 0.78);
            g.fillCircle((x0 + x1) * 0.5, (y0 + y1) * 0.5, 1.0);
          }
        }
        // 爪尖短握柄 + 铁环
        g.lineStyle(6.4, 0x18120c, 0.96);
        g.beginPath();
        g.moveTo(bx - ux * 5, by - uy * 5);
        g.lineTo(bx + ux * 5, by + uy * 5);
        g.strokePath();
        g.lineStyle(3.6, 0x7c4e28, 1);
        g.beginPath();
        g.moveTo(bx - ux * 5, by - uy * 5);
        g.lineTo(bx + ux * 5, by + uy * 5);
        g.strokePath();
        g.fillStyle(0xc8d4e4, 1);
        g.fillCircle(bx + ux * 5, by + uy * 5, 2.2);
      }
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
