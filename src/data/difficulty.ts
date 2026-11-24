/** 5 档难度，见 DESIGN.md 第 9 节 */
export interface DifficultyDef {
  name: string;
  /** 怪物生命、伤害倍率（Boss 也吃） */
  mult: number;
  /** 第 7 波起每隔几波混入一只精英 */
  extraElites: boolean;
  /** 刷怪间隔倍率（< 1 更快） */
  spawnInterval: number;
  /** 精英随机带一个词条 */
  eliteAffix: boolean;
  /** 螳螂女王第三阶段（30% 血以下落雷） */
  bossPhase3: boolean;
  desc: string;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { name: '晴天', mult: 1, extraElites: false, spawnInterval: 1, eliteAffix: false, bossPhase3: false, desc: '标准难度' },
  { name: '阴天', mult: 1.12, extraElites: false, spawnInterval: 1, eliteAffix: false, bossPhase3: false, desc: '怪物生命和伤害 +12%' },
  {
    name: '小雨',
    mult: 1.28,
    extraElites: true,
    spawnInterval: 0.96,
    eliteAffix: false,
    bossPhase3: false,
    desc: '怪物生命和伤害 +28%；第 7 波起，每隔 3 波混入一只精英',
  },
  {
    name: '暴雨',
    mult: 1.38,
    extraElites: true,
    spawnInterval: 0.88,
    eliteAffix: true,
    bossPhase3: false,
    desc: '怪物生命和伤害 +38%；刷怪间隔 −12%；精英随机带一个词条（狂暴 / 护盾 / 再生）',
  },
  {
    name: '雷暴',
    mult: 1.55,
    extraElites: true,
    spawnInterval: 0.86,
    eliteAffix: true,
    bossPhase3: true,
    desc: '怪物生命和伤害 +55%；包含暴雨的全部规则；螳螂女王 30% 血以下进入第三阶段，全场落雷',
  },
];

export type EliteAffix = 'rage' | 'shield' | 'regen';

export const AFFIX_LABEL: Record<EliteAffix, { name: string; tint: number; color: string }> = {
  rage: { name: '狂暴', tint: 0xff8a7a, color: '#ff8a7a' },
  shield: { name: '护盾', tint: 0x9fd8ff, color: '#9fd8ff' },
  regen: { name: '再生', tint: 0x9fff9f, color: '#9fff9f' },
};
