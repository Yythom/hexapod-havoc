import type { Mods } from './items';
import type { Stats } from '../core/stats';

export type BiomeId = 'meadow' | 'pond' | 'hollow';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  shortName: string;
  tagline: string;
  desc: string;
  groundKey: string;
  accent: number;
  css: string;
  /** 开局生效的基础属性倾向 */
  stats?: Partial<Stats>;
  /** 开局生效的机制修正 */
  mods?: Partial<Mods>;
  /** 是否自带池岸湿滑轻惯性 */
  slippery?: boolean;
  /** 额外常驻大水洼数量（不受天气限制） */
  extraPuddles?: number;
  /** 露珠冰球刷新间隔倍率 */
  dewIntervalMult?: number;
  /** 可引燃干叶堆数量 */
  leafPiles?: number;
  /** 可挡敌弹的天然木桩掩体数量 */
  stumpCount?: number;
}

export const DEFAULT_BIOME: BiomeId = 'meadow';

export const BIOMES: Record<BiomeId, BiomeDef> = {
  meadow: {
    id: 'meadow',
    name: '经典草坪',
    shortName: '草坪',
    tagline: '均衡标准战场',
    desc: '开阔平坦的后院草地与中心老树桩，无额外地形偏置，最适合测试任意构筑。',
    groundKey: 'ground',
    accent: 0x78c850,
    css: '#a4e878',
  },
  pond: {
    id: 'pond',
    name: '青苔池塘',
    shortName: '池塘',
    tagline: '大水洼导电 · 湿滑滑步',
    desc: '常驻 4 处大水洼（潮湿怪吃冰/电/元素伤 +25% 且全洼导电）；池岸湿滑带轻惯性，移速 +8%、元素 +1，露珠冰球更频出。',
    groundKey: 'ground-pond',
    accent: 0x4ec8e8,
    css: '#8eeaff',
    stats: { speedPct: 0.08, elemental: 1 },
    slippery: true,
    extraPuddles: 4,
    dewIntervalMult: 0.7,
  },
  hollow: {
    id: 'hollow',
    name: '枯叶树洞',
    shortName: '树洞',
    tagline: '干叶连环火墙 · 木桩挡弹',
    desc: '5 处干叶堆遇火即燃并连锁蔓延成烈焰区；2 根苔木桩掩体阻挡敌方弹幕；近战 +2，灼烧伤害 +20%、传火范围 +30%。',
    groundKey: 'ground-hollow',
    accent: 0xf08c38,
    css: '#ffbc72',
    stats: { melee: 2 },
    mods: { burnDamagePct: 0.2, burnSpreadPct: 0.3 },
    leafPiles: 5,
    stumpCount: 2,
  },
};

export const BIOME_ORDER: BiomeId[] = ['meadow', 'pond', 'hollow'];

export function isBiomeId(v: unknown): v is BiomeId {
  return typeof v === 'string' && v in BIOMES;
}

export function resolveBiome(id?: string | null): BiomeDef {
  return isBiomeId(id) ? BIOMES[id] : BIOMES[DEFAULT_BIOME];
}
