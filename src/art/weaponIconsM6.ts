import { cCircle, cEllipse, cLine, cPoly, cRoundRect, cShellGrad, cSoftEllipse, type Ctx, type Draw2D } from './draw';

/** M6 新增的 14 把武器图标：24×20 的空间里朝右绘制，规格同 weaponIcons.ts */

/** 上下对称：s = 1 原样，s = -1 关于 y = 10 镜像 */
const my = (s: number) => (v: number) => 10 + (v - 10) * s;

function mandibles(ctx: Ctx, out: string, hi: string, mid: string, dark: string, ridge: string): void {
  cEllipse(ctx, 5.2, 10, 4.4, 5.4, cShellGrad(ctx, 4.5, 9, 5.5, hi, mid, dark), out, 1.4);
  for (const s of [1, -1]) {
    const y = my(s);
    ctx.strokeStyle = out;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5.5, y(7.5));
    ctx.bezierCurveTo(11, y(3), 18, y(2.8), 22.2, y(7.6));
    ctx.stroke();
    cPoly(ctx, [12.5, y(4.6), 14.2, y(8.2), 16, y(4.5)], out);
    ctx.strokeStyle = ridge;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(6, y(7.2));
    ctx.bezierCurveTo(11.2, y(3.3), 17.5, y(3.1), 21.4, y(7.1));
    ctx.stroke();
  }
}

export const M6_WEAPON_ICONS: Record<string, Draw2D> = {
  // 回旋叶刃：弯成回旋镖形状的锯齿叶片
  'w-boomerang': (ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 3);
    ctx.quadraticCurveTo(12, 6, 22.5, 10);
    ctx.quadraticCurveTo(12, 14, 2, 17);
    ctx.quadraticCurveTo(9, 10, 2, 3);
    ctx.closePath();
    ctx.fillStyle = cShellGrad(ctx, 10, 8, 12, '#d8ff9a', '#6ac03a', '#2a6a16');
    ctx.fill();
    ctx.strokeStyle = '#1e4a10';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    cLine(ctx, [4, 4.6, 13, 8.2, 21, 10], '#2a6a16', 1);
    cLine(ctx, [4, 15.4, 13, 11.8, 21, 10], '#2a6a16', 1);
    cSoftEllipse(ctx, 9, 6.6, 5, 1.4, 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)', 0.3);
  },
  // 滚粪球：带草屑的土褐色球
  'w-dungball': (ctx) => {
    cCircle(ctx, 13, 10, 8, cShellGrad(ctx, 11, 7.5, 8, '#c8a06a', '#6a4a24', '#2e1e0c'), '#1e1208', 1.5);
    for (const [x, y, r] of [[10, 7, 1.6], [16, 6.5, 1.3], [9, 12.5, 1.2], [15.5, 13, 1.8]]) cCircle(ctx, x, y, r, 'rgba(60,40,18,0.5)');
    cLine(ctx, [7, 9, 10.5, 7.5], '#e0c878', 0.9);
    cLine(ctx, [14, 15.5, 18, 14], '#e0c878', 0.9);
    cSoftEllipse(ctx, 10.5, 6.5, 3.4, 1.8, 'rgba(255,240,210,0.5)', 'rgba(255,240,210,0)');
  },
  // 萤火光束：萤火虫发光的尾灯
  'w-firebeam': (ctx) => {
    cSoftEllipse(ctx, 17, 10, 7, 7, 'rgba(255,220,80,0.75)', 'rgba(255,200,60,0)');
    cEllipse(ctx, 7, 10, 5.5, 4, cShellGrad(ctx, 6, 8.5, 5.5, '#6a5a4a', '#2e2418', '#120c06'), '#0c0804', 1.2);
    cEllipse(ctx, 15, 10, 4.6, 3.8, cShellGrad(ctx, 14, 9, 4.6, '#ffffe0', '#ffe060', '#d89a10'), '#8a5a08', 1.2);
    cCircle(ctx, 15.5, 9.2, 1.3, '#ffffff');
    cLine(ctx, [19, 10, 23.5, 10], 'rgba(255,240,160,0.9)', 1.6);
  },
  // 绕身飞蛾：张开翅膀的小飞蛾
  'w-moths': (ctx) => {
    for (const s of [1, -1]) {
      const y = my(s);
      cEllipse(ctx, 14, y(5.4), 5.2, 4.2, cShellGrad(ctx, 13, y(4.5), 5.2, '#fff4dc', '#e0c8a0', '#9a7c52'), '#5a4428', 1, -0.5 * s);
      cEllipse(ctx, 8.5, y(6.4), 4, 3.2, cShellGrad(ctx, 8, y(5.8), 4, '#f8e8c8', '#d0b488', '#8a6a40'), '#5a4428', 1, 0.4 * s);
      cCircle(ctx, 14.4, y(5), 1.4, '#6a4a8a');
      cCircle(ctx, 14.4, y(5), 0.5, '#f8f0ff');
    }
    cEllipse(ctx, 12, 10, 6, 2, '#8a6a40', '#3a2810', 1);
    cCircle(ctx, 18.4, 10, 1.8, '#6a4a28', '#3a2810', 0.8);
    cLine(ctx, [19.4, 9, 22.6, 6], '#3a2810', 0.8);
    cLine(ctx, [19.4, 11, 22.6, 14], '#3a2810', 0.8);
  },
  // 弹跳石子：两块扁石片和跳跃的弧线
  'w-skipstone': (ctx) => {
    ctx.strokeStyle = 'rgba(200,230,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 14);
    ctx.quadraticCurveTo(6, 6, 10, 13);
    ctx.quadraticCurveTo(13.5, 8, 17, 12.5);
    ctx.stroke();
    cEllipse(ctx, 7, 14.5, 4.6, 2.6, cShellGrad(ctx, 6, 13.5, 4.6, '#e8e4d8', '#9a968a', '#4e4a40'), '#2e2c26', 1.1);
    cEllipse(ctx, 18.5, 10, 4.8, 3.6, cShellGrad(ctx, 17.5, 8.8, 4.8, '#f4f0e4', '#a8a498', '#545048'), '#2e2c26', 1.2);
    cSoftEllipse(ctx, 17.4, 8.8, 2.2, 1, 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)');
  },
  // 雷甲触须：一对分节触须，尖端噼啪放电
  'w-thunder': (ctx) => {
    for (const s of [1, -1]) {
      const y = my(s);
      for (let k = 0; k < 5; k++) cCircle(ctx, 3 + k * 3.2, y(9.2 - k * 1.1), 1.5, k % 2 ? '#3a4a8a' : '#5a6ac8', '#141a3a', 0.6);
    }
    cSoftEllipse(ctx, 20, 10, 4.5, 6, 'rgba(140,200,255,0.7)', 'rgba(140,200,255,0)');
    cLine(ctx, [17.5, 4.6, 21.5, 8, 18.5, 10, 23, 14.5], '#e8f6ff', 1.4);
    cLine(ctx, [17.5, 4.6, 21.5, 8, 18.5, 10, 23, 14.5], 'rgba(120,180,255,0.6)', 2.8);
  },
  // 种子地雷：种荚顶上一点红光
  'w-mine': (ctx) => {
    cEllipse(ctx, 12, 11, 8.5, 6.8, cShellGrad(ctx, 10, 9, 8.5, '#d8a868', '#8a5a28', '#3a2208'), '#2a1806', 1.4);
    for (const x of [7, 10, 13.5, 17]) cLine(ctx, [x, 6, x + 0.5, 16], 'rgba(60,34,10,0.5)', 0.9);
    cSoftEllipse(ctx, 12, 9.5, 4, 4, 'rgba(255,90,60,0.65)', 'rgba(255,90,60,0)');
    cCircle(ctx, 12, 9.5, 1.7, '#ff6a48', '#6a1808', 0.8);
    cLine(ctx, [12, 4.4, 12, 1.5], '#4a8a28', 1.2);
    cEllipse(ctx, 14, 2, 2, 1, '#6ac03a', undefined, 0, -0.4);
  },
  // 蚁丘炮台：小土丘加一根炮管
  'w-turret': (ctx) => {
    cEllipse(ctx, 9, 12.5, 8, 6.2, cShellGrad(ctx, 7, 10, 8, '#d8a868', '#9a6a34', '#4a2c10'), '#2a1806', 1.4);
    cRoundRect(ctx, 9, 7.2, 14, 5.4, 2.2, cShellGrad(ctx, 16, 8.5, 7, '#a8886a', '#5a4a3a', '#2a2018'), '#1a120a', 1.2);
    cLine(ctx, [11, 8.6, 21, 8.6], 'rgba(255,240,210,0.45)', 0.9);
    cCircle(ctx, 9, 11, 2.6, '#2a1608', '#1a0c04', 0.8);
  },
  // 爆燃腺：橙红色腺囊，口子上喷出火苗
  'w-flamegland': (ctx) => {
    cSoftEllipse(ctx, 19, 10, 5.5, 5, 'rgba(255,140,40,0.85)', 'rgba(255,80,20,0)');
    cSoftEllipse(ctx, 19.5, 10, 2.8, 2.4, 'rgba(255,240,180,1)', 'rgba(255,200,80,0)');
    cEllipse(ctx, 8.5, 10, 7, 5.6, cShellGrad(ctx, 7, 8, 7, '#ffb878', '#d8501e', '#6a1a06'), '#3a0c02', 1.4);
    cRoundRect(ctx, 13.5, 8.2, 4, 3.6, 1.4, '#8a2a0a', '#3a0c02', 1);
    cSoftEllipse(ctx, 6.5, 7.6, 3, 1.4, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
  },
  // 霜露弹：冰蓝色的尖冰晶
  'w-frostdew': (ctx) => {
    cSoftEllipse(ctx, 12, 10, 11, 8, 'rgba(160,220,255,0.45)', 'rgba(160,220,255,0)');
    cPoly(ctx, [2, 10, 9, 4, 22.5, 10, 9, 16], cShellGrad(ctx, 10, 7, 11, '#ffffff', '#9ae0ff', '#3a8ac8'), '#1e5a8a', 1.3);
    cLine(ctx, [4, 10, 21, 10], 'rgba(255,255,255,0.85)', 1);
    cLine(ctx, [9, 5, 9, 15], 'rgba(255,255,255,0.5)', 0.8);
  },
  // 破甲刺：带倒钩的红尖长刺
  'w-armorbreak': (ctx) => {
    const g = ctx.createLinearGradient(0, 6, 0, 14);
    g.addColorStop(0, '#e8d8c0');
    g.addColorStop(1, '#7a6a5a');
    cPoly(ctx, [1.5, 7.6, 15, 8.4, 23.5, 10, 15, 11.6, 1.5, 12.4], g, '#2a1e14', 1.3);
    cPoly(ctx, [15, 8.4, 23.5, 10, 15, 11.6], '#d8302a', '#4a0a08', 0.9);
    cPoly(ctx, [8, 8, 10.5, 4.5, 11, 8.2], '#9a8a7a', '#2a1e14', 0.9);
    cPoly(ctx, [8, 12, 10.5, 15.5, 11, 11.8], '#9a8a7a', '#2a1e14', 0.9);
    cLine(ctx, [3, 9.2, 14, 9.4], 'rgba(255,255,255,0.6)', 0.8);
  },
  // 蜂蜜罐：小陶罐，罐口淌着蜜
  'w-honeyjar': (ctx) => {
    cRoundRect(ctx, 3, 4.5, 13, 12, 4.5, cShellGrad(ctx, 7, 7, 10, '#e8b878', '#a8682a', '#4a2a0c'), '#2a1606', 1.4);
    cRoundRect(ctx, 14, 6.5, 4, 7, 1.6, '#8a5220', '#2a1606', 1.1);
    cPoly(ctx, [17.5, 7.5, 22.5, 9, 22.5, 11, 17.5, 12.5], cShellGrad(ctx, 19, 9, 4, '#fff0a0', '#f0b020', '#9a5a08'), '#6a3a04', 1);
    cCircle(ctx, 21.5, 13.6, 1.4, '#f0b020', '#6a3a04', 0.7);
    cLine(ctx, [5, 8, 12, 8], 'rgba(255,230,190,0.5)', 1);
  },
  // 金龟子钳：金绿色金属光泽的双钳
  'w-scarab': (ctx) => mandibles(ctx, '#1a2a08', '#f0e088', '#8aa830', '#2a4010', '#f8e070'),
  // 战痕大颚：暗红色大颚，带一道道白色划痕
  'w-scarred': (ctx) => {
    mandibles(ctx, '#200806', '#c85a48', '#7a2418', '#2a0804', '#e07a5a');
    for (const [x0, y0, x1, y1] of [
      [9, 3.6, 11, 6.4],
      [14, 3, 15.6, 5.6],
      [10, 16.4, 12, 13.6],
      [16, 16.6, 17.2, 14.2],
    ]) {
      cLine(ctx, [x0, y0, x1, y1], 'rgba(255,240,220,0.85)', 0.8);
    }
  },
};
