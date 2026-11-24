import type { DailyMutatorId } from './daily';

export type ChallengeId = 'chaos_arsenal' | 'one_leg' | 'chain_boom' | 'turbo_blitz' | 'cursed_abyss' | 'glass_soul';

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  tagline: string;
  desc: string;
  character: string;
  weapon: string;
  difficulty: number;
  /** 挑战局目标波次（10 波短局快节奏） */
  maxWaves: number;
  mutators: DailyMutatorId[];
  accent: number;
  css: string;
}

/** 6 个高辨识度主题挑战关（10 波短局，第 10 波直接迎来 Boss 决战） */
export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  chaos_arsenal: {
    id: 'chaos_arsenal',
    name: '百变虫军',
    tagline: '每波武器全随机重铸',
    desc: '每过 1 波，你身上的所有武器自动随机重铸为同品阶的新武器（保留诅咒与附魔）。适应力拉满！',
    character: 'stag',
    weapon: 'slingshot',
    difficulty: 1,
    maxWaves: 10,
    mutators: ['chaos', 'treasure'],
    accent: 0x62d8ff,
    css: '#9ceeff',
  },
  one_leg: {
    id: 'one_leg',
    name: '孤胆一击',
    tagline: '单槽极限战神',
    desc: '武器槽锁为 1 格，但全伤害 +180%、攻速 +80%、暴击 +20%。用一把神器杀穿虫潮！',
    character: 'mantis',
    weapon: 'light-saber',
    difficulty: 1,
    maxWaves: 10,
    mutators: ['one_slot'],
    accent: 0xff9a3c,
    css: '#ffc67a',
  },
  chain_boom: {
    id: 'chain_boom',
    name: '引爆后院',
    tagline: '连环毒菇与气囊爆破',
    desc: '爆裂毒菇与气囊虫高频刷出，击杀气囊虫会引发大范围连锁爆破重创周围虫群！',
    character: 'bombardier',
    weapon: 'flamethrower',
    difficulty: 2,
    maxWaves: 10,
    mutators: ['boom_party', 'swarm'],
    accent: 0xff5a48,
    css: '#ff9688',
  },
  turbo_blitz: {
    id: 'turbo_blitz',
    name: '极速狂飙',
    tagline: '超高移速 + 疾影连冲',
    desc: '移速攻速双暴涨，冲刺冷却减半，敌人同样狂奔！靠极限擦弹闪避秀翻全场。',
    character: 'tiger',
    weapon: 'knife',
    difficulty: 2,
    maxWaves: 10,
    mutators: ['turbo', 'quick_dash'],
    accent: 0x5de862,
    css: '#a4ffaa',
  },
  cursed_abyss: {
    id: 'cursed_abyss',
    name: '诅咒深渊',
    tagline: '高危高回报黑市',
    desc: '开局 诅咒 +15，商店高频刷新紫火诅咒神装，满屏变异虫爆海量花蜜与宝箱！',
    character: 'ladybug',
    weapon: 'slingshot',
    difficulty: 2,
    maxWaves: 10,
    mutators: ['cursed_market'],
    accent: 0xc068ff,
    css: '#e2a8ff',
  },
  glass_soul: {
    id: 'glass_soul',
    name: '纯血玻璃',
    tagline: '1 血护盾极限走位',
    desc: '最大生命锁为 1 点，但全伤害 +100%，开局 2 层护盾且每 12 秒自动再生 1 层护盾！',
    character: 'spider',
    weapon: 'pistol',
    difficulty: 1,
    maxWaves: 10,
    mutators: ['glass_soul', 'quick_dash'],
    accent: 0x9fd8ff,
    css: '#d4f0ff',
  },
};

export const CHALLENGE_ORDER: ChallengeId[] = [
  'chaos_arsenal',
  'one_leg',
  'chain_boom',
  'turbo_blitz',
  'cursed_abyss',
  'glass_soul',
];
