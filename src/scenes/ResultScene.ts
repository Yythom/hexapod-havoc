import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { weaponTex } from '../art/icons';
import { DISPLAY_FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CHALLENGES, type ChallengeId } from '../core/challenges';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { WAVES } from '../data/waves';
import { CLASS_LABEL, TIERS, WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton } from '../ui/Button';
import { fadeInScene, setupUICamera, transitionTo } from '../ui/camera';
import { CLASS_STYLE, COLOR, displayLabel, divider, drawChamferPlate, label, numLabel, panel, pill, slotBox } from '../ui/widgets';
import type { ResultData } from './GameScene';

interface Sparkle {
  img: Phaser.GameObjects.Image;
  vy: number;
  vx: number;
  phase: number;
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;
  private beetle!: BeetleView;
  private sparkles: Sparkle[] = [];
  private sunrays: Phaser.GameObjects.Image | null = null;
  private weatherFx!: WeatherAmbience;
  private elapsed = 0;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    setupUICamera(this);
    bgm.setMode('menu');
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const r = this.result;
    const character = CHARACTERS[r.character];
    const diff = DIFFICULTIES[r.difficulty];
    this.elapsed = 0;
    this.sparkles = [];
    this.sunrays = null;

    this.add.image(W / 2, H / 2, 'ground');
    const bg = this.add.graphics();
    bg.fillStyle(r.win ? 0x111316 : 0x160e10, 0.8);
    bg.fillRect(0, 0, W, H);
    this.add.tileSprite(0, 0, W, H, 'ui-grunge-tile').setOrigin(0).setAlpha(0.85);
    this.weatherFx = new WeatherAmbience(this, 0, r.difficulty);

    if (r.win) {
      this.sunrays = this.add.image(W / 2, 270, 'ui-sunrays').setScale(1.2).setAlpha(0.28);
      for (let i = 0; i < 24; i++) {
        const img = this.add
          .image(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(40, H - 40), 'dot')
          .setTint(i % 2 === 0 ? 0xffd44c : 0x74ea78)
          .setScale(Phaser.Math.FloatBetween(0.3, 0.7));
        this.sparkles.push({
          img,
          vx: Phaser.Math.FloatBetween(-16, 16),
          vy: Phaser.Math.FloatBetween(-32, -10),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    if (r.win) {
      const crown = this.add.image(W / 2, 52, 'ui-crown').setDisplaySize(44, 44);
      const targetScale = crown.scaleX;
      crown.setScale(targetScale * 0.45);
      this.tweens.add({ targets: crown, scale: targetScale, duration: 340, ease: 'Back.Out' });
    }
    const headText = r.endless ? `无尽止步 · 第 ${r.wave} 波` : r.win ? '守住了树桩！' : '被虫潮淹没了…';
    const headline = this.add
      .text(W / 2, 92, headText, {
        fontFamily: DISPLAY_FONT,
        fontSize: '56px',
        fontStyle: 'bold',
        color: r.win ? '#ffd44c' : '#ff5d57',
        stroke: '#050507',
        strokeThickness: 14,
        shadow: { offsetX: 4, offsetY: 5, color: '#050507', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0.5)
      .setScale(1.18)
      .setAlpha(0);
    const hGrad = headline.context.createLinearGradient(0, 0, 0, headline.height);
    if (r.win) {
      hGrad.addColorStop(0, '#fff7cf');
      hGrad.addColorStop(0.55, '#ffd44c');
      hGrad.addColorStop(1, '#e88e1a');
    } else {
      hGrad.addColorStop(0, '#ffc8c4');
      hGrad.addColorStop(0.55, '#ff5d57');
      hGrad.addColorStop(1, '#b82522');
    }
    headline.setFill(hGrad);
    this.tweens.add({ targets: headline, scale: 1, alpha: 1, duration: 240, ease: 'Back.Out' });

    // 主结算面板（含最终构筑总览与 MVP 武器展示）
    const hasBuild = (r.weapons?.length ?? 0) > 0;
    const pw = 840;
    const ph = hasBuild ? 426 : 338;
    const px = W / 2 - pw / 2;
    const py = hasBuild ? 142 : 166;
    const accent = r.win ? COLOR.gold : 0xd84640;
    panel(this, px, py, pw, ph, accent, COLOR.panel, 2, accent, 0);

    // 左侧：主角展示台
    const leftCx = px + 148;
    const spot = this.add.graphics();
    spot.fillStyle(COLOR.panelDeep, 1);
    spot.fillCircle(leftCx, py + 126, 78);
    spot.lineStyle(3, COLOR.ink, 1);
    spot.strokeCircle(leftCx, py + 126, 78);

    this.beetle = new BeetleView(this, leftCx, py + 126, character.shell).setScale(1.92).setRotation(-Math.PI / 2);
    const startW = character.startWeapons[0] ? WEAPONS[character.startWeapons[0]] : null;
    if (startW) {
      this.beetle.setWeapon(0, startW.icon, r.win ? 2 : 0, true);
      this.beetle.setWeaponAim(0, this.beetle.rotation + this.beetle.tipLocalAngle(0) - 0.55);
    }

    displayLabel(this, leftCx, py + 226, character.name, 22, COLOR.goldText).setOrigin(0.5);
    const badgeY = py + 264;
    const diffPill = pill(this, leftCx, badgeY, `      ${diff.name}难度`, COLOR.panelDeep, COLOR.border, COLOR.text, 14, 16, 28);
    this.add.image(diffPill.x - diffPill.width / 2 + 20, badgeY, `weather-${r.difficulty}`).setDisplaySize(18, 18);
    if (r.daily) {
      pill(this, leftCx, badgeY + 34, `★ 每日挑战 ${r.daily}`, 0x3b2c10, COLOR.gold, COLOR.goldText, 12, 12, 22);
    } else if (r.challenge) {
      const ch = CHALLENGES[r.challenge as ChallengeId];
      pill(this, leftCx, badgeY + 34, `🏆 挑战 · ${ch?.name ?? r.challenge}`, 0x2a1842, 0xc068ff, '#e4b8ff', 12, 12, 22);
    }

    // 竖向分割线
    const sep = this.add.graphics();
    sep.lineStyle(2, COLOR.ink, 0.9);
    sep.beginPath();
    sep.moveTo(px + 292, py + 24);
    sep.lineTo(px + 292, py + 292);
    sep.strokePath();

    // 右侧：2×2 切角战绩卡片（错峰弹入 + 数字滚动计数）
    const targetWaves = r.maxWaves ?? WAVES.length;
    const waveLabel = r.endless ? `第 ${r.wave} 波` : `${r.wave} / ${targetWaves}`;
    const waveFmt = (n: number) => (r.endless ? `第 ${n} 波` : `${n} / ${targetWaves}`);
    const stats = [
      { title: r.endless ? '无尽波次' : '到达波次', value: waveLabel, countTo: r.wave, fmt: waveFmt, color: r.win ? COLOR.good : COLOR.text, accent: r.win ? 0x5de862 : COLOR.border },
      { title: '最终等级', value: `LV.${r.level}`, countTo: r.level, fmt: (n: number) => `LV.${n}`, color: '#74d6ff', accent: 0x5cb6f0 },
      { title: '累计击杀', value: String(r.kills), countTo: r.kills, fmt: (n: number) => String(n), color: '#ffb258', accent: 0xee8a30 },
      { title: '收集花蜜', value: String(r.nectar), countTo: r.nectar, fmt: (n: number) => String(n), color: COLOR.goldText, accent: COLOR.gold, icon: 'nectar' },
    ];
    const gx0 = px + 322;
    const gy0 = py + 26;
    const cw = 232;
    const ch = 98;
    const gap = 16;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = gx0 + col * (cw + gap);
      const cy = gy0 + row * (ch + gap);
      const cardWrap = this.add.container(cx + cw / 2, cy + ch / 2);
      const lx = -cw / 2;
      const ly = -ch / 2;
      const card = this.add.graphics();
      drawChamferPlate(card, lx, ly, cw, ch, {
        fill: COLOR.panelDeep,
        border: COLOR.borderSoft,
        borderWidth: 1.4,
        accentTop: s.accent,
        headerH: 0,
        shadowX: 3,
        shadowY: 4,
        cutBig: 8,
        cutSmall: 3,
        inkWidth: 2.8,
      });
      cardWrap.add(card);
      cardWrap.add(label(this, lx + 16, ly + 15, s.title, 14, COLOR.dim).setOrigin(0, 0));
      let valTxt: Phaser.GameObjects.Text;
      if (s.icon) {
        cardWrap.add(this.add.image(lx + 28, ly + 64, s.icon).setDisplaySize(26, 26));
        valTxt = numLabel(this, lx + 48, ly + 64, s.fmt(0), 30, s.color).setOrigin(0, 0.5);
      } else {
        valTxt = numLabel(this, lx + 16, ly + 64, s.fmt(0), 30, s.color).setOrigin(0, 0.5);
      }
      cardWrap.add(valTxt);
      cardWrap.setScale(0.9).setAlpha(0);
      this.tweens.add({
        targets: cardWrap,
        scale: 1,
        alpha: 1,
        delay: 80 + i * 65,
        duration: 180,
        ease: 'Back.Out',
      });
      this.tweens.addCounter({
        from: 0,
        to: s.countTo,
        delay: 110 + i * 65,
        duration: Math.min(580, Math.max(240, s.countTo * 12)),
        ease: 'Quad.Out',
        onUpdate: (tw) => valTxt.setText(s.fmt(Math.round(tw.getValue() ?? 0))),
        onComplete: () => valTxt.setText(s.value),
      });
    });

    const news: string[] = [];
    if (r.newDifficulty) news.push(`${character.name} 解锁新难度：${DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, r.difficulty + 1)].name}`);
    if (r.newEndlessRecord) news.push(`无尽新纪录！${character.name} 到达第 ${r.wave} 波`);
    if (r.newDailyBest && r.daily) news.push(`刷新今日每日挑战最佳成绩！`);
    if (r.newChallengeCleared && r.challenge) {
      const ch = CHALLENGES[r.challenge as ChallengeId];
      news.push(`首次通关主题挑战「${ch?.name ?? r.challenge}」！`);
    }
    for (const id of r.unlocked) news.push(`解锁新角色：${CHARACTERS[id].name}`);
    if (news.length > 0) {
      divider(this, gx0, py + 244, cw * 2 + gap, COLOR.gold, 0.65);
      news.forEach((t, i) => {
        label(this, gx0 + (cw * 2 + gap) / 2, py + 266 + i * 22, `★ ${t}`, 15, COLOR.goldText, true).setOrigin(0.5);
      });
    } else {
      label(
        this,
        gx0 + (cw * 2 + gap) / 2,
        py + 268,
        r.win ? '后院恢复了宁静，树桩安然无恙！' : '调整配装，再来守卫树桩！',
        15,
        COLOR.dim,
      ).setOrigin(0.5);
    }

    // 底部：最终构筑总览（武器槽 + MVP 标记 + 激活羁绊徽章）
    if (hasBuild && r.weapons) {
      const by = py + 306;
      divider(this, px + 26, by, pw - 52, COLOR.border, 0.65);
      label(this, px + 30, by + 18, '最终构筑', 15, COLOR.text, true).setOrigin(0, 0.5);

      const weapons = r.weapons;
      let mvpIdx = -1;
      let bestDmg = 0;
      weapons.forEach((w, idx) => {
        if (w.totalDamage > bestDmg) {
          bestDmg = w.totalDamage;
          mvpIdx = idx;
        }
      });

      const slotSize = 54;
      const step = Math.min(68, Math.floor(470 / Math.max(1, weapons.length)));
      const wx0 = px + 56;
      const wy = by + 62;
      weapons.forEach((w, idx) => {
        const def = WEAPONS[w.id];
        if (!def) return;
        const cx = wx0 + idx * step;
        const isMvp = idx === mvpIdx && bestDmg > 0;
        slotBox(this, cx, wy, slotSize, TIERS[w.tier].color, isMvp, w.tier);
        const img = this.add.image(cx, wy - 2, weaponTex(def.icon, w.tier, true));
        img.setScale((slotSize - 14) / Math.max(img.width, img.height));
        if (isMvp) {
          pill(this, cx, wy - slotSize / 2 - 4, 'MVP', 0x523408, COLOR.gold, COLOR.goldText, 10, 6, 16);
        }
        const dmgStr = w.totalDamage >= 1000 ? `${(w.totalDamage / 1000).toFixed(1)}k` : String(Math.round(w.totalDamage));
        label(this, cx, wy + slotSize / 2 + 12, dmgStr, 12, isMvp ? COLOR.goldText : COLOR.dim, isMvp).setOrigin(0.5);
      });

      // 右侧展示已激活羁绊
      const sets = r.sets ?? [];
      if (sets.length > 0) {
        let sx = px + 558;
        let sy = by + 46;
        for (const st of sets.slice(0, 6)) {
          const ts = CLASS_STYLE[st.cls];
          const p = pill(this, sx, sy, `${CLASS_LABEL[st.cls]}×${st.count}`, ts.bg, ts.border, ts.text, 12, 8, 22);
          if (sx + p.width > px + pw - 22) {
            sx = px + 558;
            sy += 28;
          }
          p.setPosition(sx + p.width / 2, sy);
          sx += p.width + 6;
        }
      }
    }

    const btnY = hasBuild ? 626 : 588;
    const again = () => transitionTo(this, 'Game');
    createButton(this, W / 2 - 280, btnY, '再来一局', again, { width: 250, height: 60 });
    createButton(this, W / 2, btnY, '更换角色', () => transitionTo(this, 'CharacterSelect'), { width: 250, height: 60, primary: false });
    createButton(this, W / 2 + 280, btnY, '返回菜单', () => transitionTo(this, 'Menu'), { width: 250, height: 60, primary: false });
    this.input.keyboard!.once('keydown-ENTER', again);
    fadeInScene(this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.weatherFx.update(dt);
    this.beetle.animate(dt, this.result.win ? 0.65 : 0.15);
    if (this.sunrays) this.sunrays.rotation += dt * 0.12;
    for (const s of this.sparkles) {
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      if (s.img.y < -12) s.img.y = GAME_HEIGHT + 12;
      s.img.setAlpha(0.3 + 0.45 * Math.abs(Math.sin(this.elapsed * 3 + s.phase)));
    }
  }
}
