import {
  cCircle,
  cEllipse,
  cLine,
  cPoly,
  cRoundRect,
  cShellGrad,
  cSoftEllipse,
  type Draw2D,
} from './draw';

/** 15 把武器的 Canvas 2D 精绘图标：24×20 的空间里朝右绘制，挂在腿尖上时会旋转指向目标 */
export const WEAPON_ICONS: Record<string, Draw2D> = {
  // 大颚：深琥珀光泽双钳
  'w-mandible': (ctx) => {
    const base = cShellGrad(ctx, 4.5, 9, 5.5, '#c47234', '#723512', '#2d1205');
    cEllipse(ctx, 5.2, 10, 4.4, 5.4, base, '#240e04', 1.4);
    for (const s of [1, -1]) {
      const y = (v: number) => 10 + (v - 10) * s;
      ctx.strokeStyle = '#240e04';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(5.5, y(7.5));
      ctx.bezierCurveTo(11, y(3), 18, y(2.8), 22.2, y(7.6));
      ctx.stroke();
      // 内锯齿
      cPoly(ctx, [12.5, y(4.6), 14.2, y(8.2), 16, y(4.5)], '#240e04');
      cPoly(ctx, [17.2, y(5.2), 18.2, y(7.6), 19.6, y(5.8)], '#240e04');
      // 琥珀光泽脊
      ctx.strokeStyle = '#d4823a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6, y(7.2));
      ctx.bezierCurveTo(11.2, y(3.3), 17.5, y(3.1), 21.4, y(7.1));
      ctx.stroke();
    }
  },
  // 犄角：弯弧红木重角
  'w-horn': (ctx) => {
    const grad = ctx.createLinearGradient(2, 3, 22, 15);
    grad.addColorStop(0, '#c8783c');
    grad.addColorStop(0.5, '#7e3c16');
    grad.addColorStop(1, '#321406');
    cPoly(ctx, [1.5, 5.5, 9.5, 4.2, 17, 2.8, 23.2, 1.4, 19.6, 7.2, 12, 12.2, 4, 15.8, 1.5, 14], grad, '#220c04', 1.5);
    cLine(ctx, [4, 7.6, 12.5, 5.6, 20.4, 3.0], 'rgba(255,214,158,0.72)', 1.3);
    cPoly(ctx, [16.5, 3.2, 20.5, 0.8, 18.8, 4.5], '#4d220a', '#220c04', 0.9);
  },
  // 刺足：带骨刺锋刃节肢
  'w-legspike': (ctx) => {
    for (const x of [6, 11, 16]) {
      cPoly(ctx, [x - 1.5, 8.6, x + 1.2, 3.2, x + 1.8, 8.6], '#e8d8b0', '#261006', 1.1);
      cPoly(ctx, [x - 1.5, 11.4, x + 1.2, 16.8, x + 1.8, 11.4], '#e8d8b0', '#261006', 1.1);
    }
    cLine(ctx, [1.5, 10, 9.5, 9, 21, 10], '#261006', 4.4);
    cLine(ctx, [2, 9.8, 9.5, 8.8, 20.5, 9.8], '#b46224', 2.2);
    cPoly(ctx, [18.5, 8.2, 23.8, 10, 18.5, 11.8], '#fff0c8', '#261006', 1.1);
  },
  // 镰臂：翠绿锯齿螳螂镰刃
  'w-scythe': (ctx) => {
    const blade = ctx.createLinearGradient(2, 15, 22, 4);
    blade.addColorStop(0, '#5a9430');
    blade.addColorStop(0.55, '#98da58');
    blade.addColorStop(1, '#e8ffc0');
    cPoly(ctx, [1.2, 12.5, 9.2, 10.2, 18.2, 2.8, 23.4, 4.6, 15, 12, 4.2, 16.4], blade, '#1d3812', 1.5);
    cLine(ctx, [5, 12.6, 17.5, 4.8, 21.8, 5.2], 'rgba(255,255,230,0.72)', 1.1);
    for (const x of [11.5, 14.8, 18]) {
      const y = 11.2 - (x - 11.5) * 0.92;
      cPoly(ctx, [x, y, x + 1.4, y + 3.2, x + 2.4, y - 0.8], '#f4fad4', '#1d3812', 0.8);
    }
  },
  // 甲壳盾：鎏金纹理圆甲盾
  'w-shellshield': (ctx) => {
    cLine(ctx, [1.5, 10, 6.5, 10], '#281006', 3.4);
    const sg = cShellGrad(ctx, 11, 7.5, 10, '#ffd488', '#e88228', '#7d340a');
    cCircle(ctx, 13.5, 10, 8.6, sg, '#321406', 1.8);
    cCircle(ctx, 13.5, 10, 6.4, undefined, 'rgba(255,220,140,0.5)', 1);
    cLine(ctx, [13.5, 2.4, 13.5, 17.6], '#6b2c0a', 1.4);
    cSoftEllipse(ctx, 10.8, 7.2, 3.2, 2, 'rgba(255,250,230,0.68)', 'rgba(255,250,230,0)', -0.4);
    cCircle(ctx, 16.6, 12.2, 1.5, '#7a320c');
  },
  // 种子弹弓：木纹Y叉+弹力筋+饱满种子
  'w-slingshot': (ctx) => {
    // 橡皮筋
    cLine(ctx, [19, 3.5, 14.8, 10, 19, 16.5], '#f6e8c8', 1.7);
    // 木柄
    cLine(ctx, [2, 10, 11, 10], '#2a1608', 5.2);
    cLine(ctx, [11, 10, 19, 3.5], '#2a1608', 4.6);
    cLine(ctx, [11, 10, 19, 16.5], '#2a1608', 4.6);
    cLine(ctx, [2.5, 10, 11, 10], '#8d5b2d', 3.0);
    cLine(ctx, [11, 10, 18.8, 3.7], '#a86f38', 2.4);
    cLine(ctx, [11, 10, 18.8, 16.3], '#a86f38', 2.4);
    cLine(ctx, [4, 9.3, 10.5, 9.3], 'rgba(255,220,170,0.45)', 0.9);
    // 兜里蓄势待发的种子
    const sd = cShellGrad(ctx, 14.5, 9.2, 3, '#fff4cc', '#e2b25c', '#7c4c18');
    cCircle(ctx, 15, 10, 2.6, sd, '#3c2008', 1);
  },
  // 松针连射：松木管束+三根翠绿松针
  'w-pine': (ctx) => {
    cLine(ctx, [14, 7.6, 23, 6.2], '#3f7a2c', 1.7);
    cLine(ctx, [14, 10, 23.6, 10], '#549638', 1.7);
    cLine(ctx, [14, 12.4, 23, 13.8], '#3f7a2c', 1.7);
    cLine(ctx, [19.5, 6.8, 23, 6.2], '#ccf09c', 1);
    cLine(ctx, [20, 10, 23.6, 10], '#ccf09c', 1);
    cLine(ctx, [19.5, 13.2, 23, 13.8], '#ccf09c', 1);
    const tube = ctx.createLinearGradient(0, 5.5, 0, 14.5);
    tube.addColorStop(0, '#a87446');
    tube.addColorStop(0.5, '#7c4f2a');
    tube.addColorStop(1, '#462a14');
    cRoundRect(ctx, 1.2, 5.5, 15.8, 9, 3, tube, '#261408', 1.6);
    cLine(ctx, [5.5, 6.2, 5.5, 13.8], '#3e2410', 1.3);
    cLine(ctx, [10.5, 6.2, 10.5, 13.8], '#3e2410', 1.3);
    cRoundRect(ctx, 14.8, 5.6, 2.8, 8.8, 1, '#3e2410', '#201006', 0.9);
  },
  // 橡果炮：重木炮筒+饱胀橡果弹头
  'w-acorn': (ctx) => {
    const barrel = ctx.createLinearGradient(0, 5, 0, 15);
    barrel.addColorStop(0, '#9a6838');
    barrel.addColorStop(0.5, '#6a4220');
    barrel.addColorStop(1, '#3c220e');
    cRoundRect(ctx, 1.2, 5, 14.8, 10, 3, barrel, '#241206', 1.6);
    // 橡果弹头
    const nut = cShellGrad(ctx, 18.5, 8.5, 5.5, '#ffe0a0', '#c8823c', '#6a3812');
    cEllipse(ctx, 19.2, 10, 4.4, 5.2, nut, '#341a06', 1.3);
    // 炮口壳斗环
    cPoly(ctx, [14.2, 4.2, 18.2, 3, 18.2, 17, 14.2, 15.8], '#4c2c10', '#221004', 1.3);
    cLine(ctx, [16.2, 4.8, 16.2, 15.2], 'rgba(255,210,150,0.35)', 1);
  },
  // 蒲公英散射：细嫩花茎+蓬松发光绒球
  'w-dandelion': (ctx) => {
    cLine(ctx, [1.5, 10, 12.5, 10], '#2c4c1c', 3.4);
    cLine(ctx, [1.8, 10, 12.2, 10], '#74a848', 1.8);
    cSoftEllipse(ctx, 16, 10, 8, 8, 'rgba(255,252,238,0.45)', 'rgba(255,252,238,0)');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const ex = 16 + Math.cos(a) * 6.8;
      const ey = 10 + Math.sin(a) * 6.8;
      cLine(ctx, [16, 10, ex, ey], 'rgba(246,242,230,0.9)', 1);
      cCircle(ctx, ex, ey, 1.4, '#ffffff', 'rgba(180,175,155,0.45)', 0.4);
    }
    cCircle(ctx, 16, 10, 2.3, '#e2ce88', '#685426', 0.9);
  },
  // 露珠狙击：修长水晶狙击管+晶莹露珠
  'w-dewsniper': (ctx) => {
    const rail = ctx.createLinearGradient(0, 7, 0, 13);
    rail.addColorStop(0, '#90b8d8');
    rail.addColorStop(0.5, '#527898');
    rail.addColorStop(1, '#263e54');
    cRoundRect(ctx, 0.8, 7.4, 18.2, 5.2, 2.2, rail, '#142230', 1.4);
    cLine(ctx, [2.5, 8.6, 17, 8.6], 'rgba(220,245,255,0.55)', 0.9);
    // 发光露珠
    cSoftEllipse(ctx, 20.6, 10, 5.2, 5.2, 'rgba(130,220,255,0.5)', 'rgba(130,220,255,0)');
    const orb = cShellGrad(ctx, 20, 9, 3.6, '#ffffff', '#7ad4ff', '#1a5a8c');
    cCircle(ctx, 20.6, 10, 3.3, orb, '#143c5e', 1.1);
  },
  // 酸液喷囊：荧光绿半透明毒囊+喷嘴毒滴
  'w-acid': (ctx) => {
    cSoftEllipse(ctx, 9.5, 10, 10, 8.5, 'rgba(165,255,60,0.35)', 'rgba(165,255,60,0)');
    cRoundRect(ctx, 14.5, 7.3, 6.8, 5.4, 1.8, '#385e16', '#1b3008', 1.3);
    const sac = cShellGrad(ctx, 7.5, 7.5, 9, '#e8ff98', '#8ad830', '#386812');
    cEllipse(ctx, 9, 10, 8, 6.8, sac, '#203c0a', 1.6);
    cSoftEllipse(ctx, 7, 7.4, 3.4, 1.8, 'rgba(255,255,235,0.75)', 'rgba(255,255,235,0)', -0.2);
    cCircle(ctx, 22.6, 10, 1.8, '#ccff66', '#284a0c', 0.8);
  },
  // 毒孢子：妖紫斑点菌伞炮
  'w-spore': (ctx) => {
    cLine(ctx, [2, 10, 10.5, 10], '#5a4e36', 4.2);
    cLine(ctx, [2.2, 10, 10.2, 10], '#ece2c4', 2.2);
    const cap = cShellGrad(ctx, 13, 8, 9, '#df7ec2', '#9c3e82', '#4a143e');
    cPoly(ctx, [9.2, 1.8, 16.2, 3.2, 21.4, 10, 16.2, 16.8, 9.2, 18.2], cap, '#360c2c', 1.5);
    for (const [x, y, r] of [[13, 6, 1.5], [16.5, 10, 1.6], [13, 14, 1.4]]) {
      cCircle(ctx, x, y, r, '#fae0f4');
    }
  },
  // 蜂刺吹针：竹节吹管+黑黄毒针
  'w-stinger': (ctx) => {
    const pipe = ctx.createLinearGradient(0, 7.5, 0, 12.5);
    pipe.addColorStop(0, '#c09858');
    pipe.addColorStop(0.5, '#866230');
    pipe.addColorStop(1, '#483214');
    cRoundRect(ctx, 0.8, 7.8, 14.5, 4.4, 2, pipe, '#261406', 1.3);
    cLine(ctx, [6, 8, 6, 12], '#3a220c', 1.1);
    cLine(ctx, [11, 8, 11, 12], '#3a220c', 1.1);
    cPoly(ctx, [14.2, 7.2, 20.5, 8.6, 23.8, 10, 20.5, 11.4, 14.2, 12.8], '#1c1206');
    cPoly(ctx, [15, 8.3, 18.4, 9, 18.4, 11, 15, 11.7], '#f6bd28');
    cLine(ctx, [20, 10, 23.5, 10], '#b8ff58', 1.1);
  },
  // 蚜虫牧群：圆润嫩绿小蚜虫徽记
  'w-aphids': (ctx) => {
    const abd = cShellGrad(ctx, 8.5, 8, 8, '#dcffb0', '#86d854', '#367820');
    cEllipse(ctx, 10, 10, 7.6, 5.8, abd, '#204a14', 1.5);
    cSoftEllipse(ctx, 8, 7.8, 3, 1.5, 'rgba(255,255,240,0.75)', 'rgba(255,255,240,0)');
    cCircle(ctx, 17.8, 10, 3.6, cShellGrad(ctx, 17, 9, 3.8, '#a4e870', '#58a036', '#265618'), '#204a14', 1.4);
    cCircle(ctx, 19.2, 8.8, 0.9, '#102008');
    cCircle(ctx, 19.2, 11.2, 0.9, '#102008');
  },
  // 蛛网陷阱：银丝八角网+黑寡妇微徽
  'w-web': (ctx) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      cLine(ctx, [12, 10, 12 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8], '#f2f4ff', 1.2);
    }
    ctx.strokeStyle = 'rgba(232,238,255,0.9)';
    ctx.lineWidth = 1.1;
    for (const r of [3.8, 7.2]) {
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = 12 + Math.cos(a) * r;
        const py = 10 + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    cCircle(ctx, 12, 10, 2.4, '#24101a', '#0e060a', 0.8);
    cCircle(ctx, 12, 10, 0.9, '#e03a3a');
  },
};
