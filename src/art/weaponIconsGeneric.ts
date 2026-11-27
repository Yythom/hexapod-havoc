import { cCircle, cEllipse, cLine, cPoly, cRoundRect, cShellGrad, type Ctx, type Draw2D } from './draw';

const INK = '#050507';

/** 程序化武器图标：24×20、朝右。给没有手绘图的 Brotato 对齐武器用。 */
export function drawGenericWeaponIcon(shape: string, color: string): Draw2D {
  return (ctx: Ctx) => {
    const dark = 'rgba(0,0,0,0.55)';
    const light = 'rgba(255,255,255,0.35)';
    const blade = () => {
      const g = cShellGrad(ctx, 8, 10, 12, color, color, '#2a1a10');
      cPoly(ctx, [2, 10, 8, 7.6, 20, 3.6, 23, 5.2, 12, 11.2, 5, 13.2], g, INK, 1.4);
      cLine(ctx, [4, 10.6, 18, 5.4], light, 1.0);
      cRoundRect(ctx, 1.4, 9.2, 6.2, 2.4, 1, '#5a3a20', INK, 1.1);
    };
    const club = () => {
      const g = cShellGrad(ctx, 10, 9, 11, color, color, '#2a1a10');
      cRoundRect(ctx, 2, 8.4, 12, 4.2, 1.6, '#7a5a38', INK, 1.3);
      cCircle(ctx, 17, 10, 6.2, g, INK, 1.5);
      cLine(ctx, [6, 9.2, 15, 9.2], light, 1.0);
    };
    const spear = () => {
      cLine(ctx, [2, 11, 17, 8.2], INK, 4.2);
      cLine(ctx, [2.4, 10.8, 17, 8], '#8a6a44', 2.2);
      cPoly(ctx, [15.5, 5.4, 23, 7.8, 16.2, 10.6, 18.2, 8.0], color, INK, 1.2);
      cLine(ctx, [16.6, 7.8, 21.6, 7.8], light, 0.9);
    };
    const shield = () => {
      const g = cShellGrad(ctx, 11, 8, 9, color, color, '#2a1a10');
      cPoly(ctx, [3, 5.5, 12, 2.6, 21, 5.5, 19.6, 14.5, 12, 18, 4.4, 14.5], g, INK, 1.5);
      cCircle(ctx, 12, 10, 3.6, undefined, 'rgba(255,255,255,0.35)', 1.0);
      cLine(ctx, [3.8, 6.2, 20.2, 6.2], light, 0.9);
    };
    const fist = () => {
      const g = cShellGrad(ctx, 10, 10, 9, color, color, '#2a1a10');
      cRoundRect(ctx, 3, 6, 12, 9, 3.4, g, INK, 1.5);
      for (let i = 0; i < 3; i++) cRoundRect(ctx, 5 + i * 3, 4.8, 2.8, 4.2, 1.2, g, INK, 1.0);
      cRoundRect(ctx, 13, 8, 6, 4, 1.6, '#6a4a2c', INK, 1.1);
    };
    const gun = (long = false) => {
      cRoundRect(ctx, 2.4, 6.4, long ? 17 : 12, 4.4, 1.4, '#4a5262', INK, 1.4);
      cRoundRect(ctx, 3.2, 6.8, long ? 15 : 10, 1.8, 0.7, '#9aa4b8');
      cPoly(ctx, [3.2, 10.4, 7.6, 10.4, 6.4, 16.8, 2.4, 15.8], '#6a4a2c', INK, 1.2);
      cRoundRect(ctx, long ? 18.6 : 13.4, 7.2, long ? 4.4 : 6.2, 3.0, 1, '#2c313a', INK, 1.2);
      cLine(ctx, [4.2, 7.4, long ? 18.4 : 13.2, 7.4], light, 0.8);
    };
    const bow = () => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(9, 10, 7.4, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      cLine(ctx, [9.6, 3.6, 9.6, 16.4], 'rgba(255,255,255,0.5)', 0.8);
      cLine(ctx, [10, 10, 23, 10], '#c8b070', 1.4);
    };
    const device = () => {
      cRoundRect(ctx, 3, 8, 11, 7.6, 1.6, '#5a5e68', INK, 1.4);
      cCircle(ctx, 8.5, 11.8, 3.0, color, INK, 1.1);
      cLine(ctx, [14, 10.4, 21.6, 6.4], '#8a8e98', 3.0);
      cCircle(ctx, 21.8, 6.2, 1.8, color, INK, 0.9);
    };
    const grenade = () => {
      cEllipse(ctx, 11, 11.4, 7.4, 6.4, '#4a5a3a', INK, 1.4);
      cRoundRect(ctx, 9.8, 3.2, 2.6, 3.2, 0.8, '#7a8a5a', INK, 1.0);
      cLine(ctx, [9, 6.2, 5.6, 3.0], '#c8c0a0', 1.2);
      cCircle(ctx, 15.6, 9.4, 1.8, color, INK, 0.8);
    };
    const flute = () => {
      cLine(ctx, [2, 12, 22, 8], INK, 4.4);
      cLine(ctx, [2.4, 11.8, 22, 7.8], color, 2.4);
      for (let i = 0; i < 5; i++) cCircle(ctx, 6 + i * 3.4, 11.2 - i * 0.8, 1.0, INK);
      cCircle(ctx, 21.4, 8.1, 1.6, color, INK, 0.8);
    };
    const boomerang = () => {
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.quadraticCurveTo(12, 6, 21, 10);
      ctx.quadraticCurveTo(12, 14, 3, 17);
      ctx.quadraticCurveTo(9, 10, 3, 3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      cLine(ctx, [6, 5, 17, 9], light, 0.8);
    };
    const staff = () => {
      cLine(ctx, [3, 16, 17, 5], INK, 3.8);
      cLine(ctx, [3.4, 15.6, 16.8, 5.2], '#8a6a44', 2.0);
      cCircle(ctx, 19, 5.6, 4.4, color, INK, 1.3);
      cCircle(ctx, 17.8, 4.4, 1.2, 'rgba(255,255,255,0.5)');
    };
    const claw = () => {
      const g = cShellGrad(ctx, 11, 10, 9, color, color, '#2a1a10');
      cEllipse(ctx, 6, 10, 4.4, 5.2, g, INK, 1.3);
      for (const s of [1, -1]) {
        const y = (v: number) => 10 + (v - 10) * s;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(7, y(7.6));
        ctx.bezierCurveTo(12, y(3.2), 18, y(3), 22.4, y(7.6));
        ctx.stroke();
      }
    };
    const scythe = () => {
      cLine(ctx, [3, 16, 14, 5], INK, 3.6);
      cLine(ctx, [3.4, 15.6, 13.8, 5.2], '#8a6a44', 1.8);
      ctx.beginPath();
      ctx.moveTo(9, 7);
      ctx.quadraticCurveTo(19, 2, 23, 6);
      ctx.quadraticCurveTo(17, 6, 12, 11);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    };
    const saw = () => {
      cCircle(ctx, 12, 10, 7.6, color, INK, 1.5);
      cCircle(ctx, 12, 10, 2.2, '#2a2c32', INK, 1.0);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        cCircle(ctx, 12 + Math.cos(a) * 8.4, 10 + Math.sin(a) * 8.4, 1.2, '#dfe8f4');
      }
    };
    const whip = () => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(3, 15);
      ctx.bezierCurveTo(9, 2, 16, 18, 23, 5);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    const rock = () => {
      cEllipse(ctx, 11, 11, 8, 6.4, color, INK, 1.4);
      cCircle(ctx, 15, 8.4, 2.2, 'rgba(255,255,255,0.22)');
      cLine(ctx, [5, 13, 10, 15], dark, 1.0);
    };
    const flail = () => {
      // 带刺重铁球 + 顶部挂环（挥扫时由 BeetleView 铁链连回角色）
      const g = cShellGrad(ctx, 13, 9, 8, '#aab6c8', color, '#242834');
      cCircle(ctx, 14, 10, 5.8, g, INK, 1.5);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.25;
        const bx = 14 + Math.cos(a) * 5.2;
        const by = 10 + Math.sin(a) * 5.2;
        const tx = 14 + Math.cos(a) * 8.6;
        const ty = 10 + Math.sin(a) * 8.6;
        const nx = -Math.sin(a) * 1.5;
        const ny = Math.cos(a) * 1.5;
        cPoly(ctx, [bx + nx, by + ny, tx, ty, bx - nx, by - ny], '#dce4f0', INK, 1.0);
      }
      cCircle(ctx, 6.2, 10, 2.2, undefined, INK, 2.2);
      cCircle(ctx, 6.2, 10, 2.2, undefined, '#9aa6ba', 1.0);
    };
    const anchor = () => {
      // 重型铁锚：顶部锚环 + 锚干 + 横杠 + 双弯钩爪
      cCircle(ctx, 4.2, 10, 2.2, undefined, INK, 2.2);
      cCircle(ctx, 4.2, 10, 2.2, undefined, '#b4c0d2', 1.0);
      cLine(ctx, [6.5, 10, 19.5, 10], INK, 4.4);
      cLine(ctx, [6.5, 10, 19.5, 10], color, 2.2);
      cLine(ctx, [9.5, 5.2, 9.5, 14.8], INK, 3.6);
      cLine(ctx, [9.5, 5.2, 9.5, 14.8], '#b4c0d2', 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(14.5, 10, 6.4, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      // 双倒刺尖钩
      cPoly(ctx, [16.5, 3.2, 20.5, 4.4, 17.8, 6.4], '#cfd9e8', INK, 1.0);
      cPoly(ctx, [16.5, 16.8, 20.5, 15.6, 17.8, 13.6], '#cfd9e8', INK, 1.0);
    };
    const crowbar = () => {
      // 弯钩钢撬棍
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.8;
      ctx.beginPath();
      ctx.moveTo(3, 12);
      ctx.lineTo(17, 10.5);
      ctx.quadraticCurveTo(22.2, 9.5, 20.6, 4.5);
      ctx.lineTo(17.5, 4.8);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      cLine(ctx, [4.5, 11.4, 16.2, 10.2], light, 0.9);
      cPoly(ctx, [2, 10.4, 5.2, 11.4, 4.8, 13.6, 1.8, 13.4], '#c8d2de', INK, 0.9);
    };
    const shovel = () => {
      // 木柄 + 弧面铁铲斗
      cLine(ctx, [2.8, 10.5, 13.5, 10], INK, 4.2);
      cLine(ctx, [3, 10.5, 13.5, 10], '#8a623c', 2.2);
      cRoundRect(ctx, 1.4, 7.6, 2.4, 5.8, 1, '#5a3a1e', INK, 1.0);
      const g = cShellGrad(ctx, 17, 9, 7, '#cfd8e4', color, '#3e444e');
      cPoly(ctx, [13, 5.6, 19.6, 6.4, 22.8, 10, 19.6, 13.6, 13, 14.4], g, INK, 1.4);
      cLine(ctx, [14.6, 8.2, 20.2, 9.6], light, 1.0);
    };
    const plank = () => {
      // 粗厚带钉木板
      const g = cShellGrad(ctx, 12, 9, 12, '#d49a5a', color, '#543218');
      cPoly(ctx, [2.2, 7.2, 22, 6.2, 22.6, 13.8, 2.2, 13.2], g, INK, 1.5);
      cLine(ctx, [4.5, 9.2, 19.5, 8.8], dark, 0.9);
      cLine(ctx, [5.5, 11.6, 18.5, 11.4], dark, 0.8);
      // 外露铁钉与包铁带
      cLine(ctx, [16.5, 6.4, 16.5, 13.6], '#4a505c', 2.2);
      cLine(ctx, [18.5, 6.2, 20.2, 3.2], '#d8e0ec', 1.5);
      cLine(ctx, [20.5, 13.6, 22.2, 16.6], '#d8e0ec', 1.5);
    };
    switch (shape) {
      case 'club': case 'hammer': case 'mace': case 'brick': club(); break;
      case 'rock': rock(); break;
      case 'flail': flail(); break;
      case 'anchor': anchor(); break;
      case 'crowbar': crowbar(); break;
      case 'shovel': shovel(); break;
      case 'plank': plank(); break;
      case 'axe': case 'cleaver': case 'scythe': scythe(); break;
      case 'spear': case 'trident': case 'javelin': case 'staff': case 'awl': case 'drill': spear(); break;
      case 'shield': shield(); break;
      case 'claw': claw(); break;
      case 'fist': fist(); break;
      case 'saw': saw(); break;
      case 'whip': whip(); break;
      case 'bow': case 'crossbow': case 'slingshot': bow(); break;
      case 'gun': case 'pistol': case 'revolver': case 'smg': case 'machinegun': case 'minigun': case 'gatling': case 'laser': case 'rail': case 'sniper': case 'blunderbuss': case 'shotgun': case 'launcher': case 'harpoon': case 'tranq': case 'medical': gun(shape === 'sniper' || shape === 'rail' || shape === 'launcher' || shape === 'machinegun'); break;
      case 'taser': case 'icicle': case 'fireball': case 'flame': case 'particle': case 'beam': case 'wand': case 'torch': case 'scepter': staff(); break;
      case 'device': case 'mine': case 'turret': device(); break;
      case 'grenade': case 'molotov': grenade(); break;
      case 'flute': case 'panflute': case 'lute': flute(); break;
      case 'boomerang': case 'shuriken': boomerang(); break;
      case 'sickle': case 'shears': case 'tooth': scythe(); break;
      case 'spoon': case 'stick': case 'flint': spear(); break;
      case 'medieval': case 'blade': case 'saber': blade(); break;
      default: blade();
    }
    cLine(ctx, [4, 17.4, 20, 17.4], 'rgba(0,0,0,0.38)', 1.0);
    cCircle(ctx, 19.6, 3.2, 0.9, 'rgba(255,255,255,0.55)');
  };
}
