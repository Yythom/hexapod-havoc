import Phaser from 'phaser';
import { DISPLAY_FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { WAVES } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { WeatherAmbience } from '../systems/WeatherAmbience';
import { createButton } from '../ui/Button';
import { setupUICamera } from '../ui/camera';
import { COLOR, displayLabel, divider, label, numLabel, panel, pill } from '../ui/widgets';
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
      this.add.image(W / 2, 52, 'ui-crown').setDisplaySize(44, 44);
    }
    this.add
      .text(W / 2, 108, r.win ? '守住了树桩！' : '被虫潮淹没了…', {
        fontFamily: DISPLAY_FONT,
        fontSize: '60px',
        fontStyle: 'bold',
        color: r.win ? '#ffd44c' : '#ff5d57',
        stroke: '#050507',
        strokeThickness: 14,
        shadow: { offsetX: 4, offsetY: 5, color: '#050507', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0.5);

    // 主结算面板
    const pw = 804;
    const ph = 338;
    const px = W / 2 - pw / 2;
    const py = 166;
    const accent = r.win ? COLOR.gold : 0xd84640;
    panel(this, px, py, pw, ph, accent, COLOR.panel, 2, accent, 0);

    // 左侧：主角展示台
    const leftCx = px + 148;
    const spot = this.add.graphics();
    spot.fillStyle(COLOR.panelDeep, 1);
    spot.fillCircle(leftCx, py + 138, 82);
    spot.lineStyle(3, COLOR.ink, 1);
    spot.strokeCircle(leftCx, py + 138, 82);

    this.beetle = new BeetleView(this, leftCx, py + 138, character.shell).setScale(2.0).setRotation(-Math.PI / 2);
    const startW = character.startWeapons[0] ? WEAPONS[character.startWeapons[0]] : null;
    if (startW) {
      this.beetle.setWeapon(0, startW.icon, r.win ? 2 : 0, true);
      this.beetle.setWeaponAim(0, this.beetle.rotation + this.beetle.tipLocalAngle(0) - 0.55);
    }

    displayLabel(this, leftCx, py + 244, character.name, 22, COLOR.goldText).setOrigin(0.5);
    const badgeY = py + 284;
    const diffPill = pill(this, leftCx, badgeY, `      ${diff.name}难度`, COLOR.panelDeep, COLOR.border, COLOR.text, 14, 16, 28);
    this.add.image(diffPill.x - diffPill.width / 2 + 20, badgeY, `weather-${r.difficulty}`).setDisplaySize(18, 18);

    // 竖向分割线
    const sep = this.add.graphics();
    sep.lineStyle(2, COLOR.ink, 0.9);
    sep.beginPath();
    sep.moveTo(px + 292, py + 24);
    sep.lineTo(px + 292, py + ph - 24);
    sep.strokePath();

    // 右侧：2×2 战绩卡片
    const stats = [
      { title: '到达波次', value: `${r.wave} / ${WAVES.length}`, color: r.win ? COLOR.good : COLOR.text },
      { title: '最终等级', value: `LV.${r.level}`, color: '#74d6ff' },
      { title: '累计击杀', value: String(r.kills), color: '#ffb258' },
      { title: '收集花蜜', value: String(r.nectar), color: COLOR.goldText, icon: 'nectar' },
    ];
    const gx0 = px + 322;
    const gy0 = py + 34;
    const cw = 216;
    const ch = 104;
    const gap = 16;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = gx0 + col * (cw + gap);
      const cy = gy0 + row * (ch + gap);
      const card = this.add.graphics();
      card.fillStyle(COLOR.ink, 0.92);
      card.fillRoundedRect(cx + 3, cy + 4, cw, ch, 7);
      card.fillStyle(COLOR.panelDeep, 1);
      card.fillRoundedRect(cx, cy, cw, ch, 7);
      card.lineStyle(2.8, COLOR.ink, 1);
      card.strokeRoundedRect(cx, cy, cw, ch, 7);
      label(this, cx + 16, cy + 16, s.title, 15, COLOR.dim).setOrigin(0, 0);
      if (s.icon) {
        this.add.image(cx + 28, cy + 68, s.icon).setDisplaySize(26, 26);
        numLabel(this, cx + 48, cy + 68, s.value, 32, s.color).setOrigin(0, 0.5);
      } else {
        numLabel(this, cx + 16, cy + 68, s.value, 32, s.color).setOrigin(0, 0.5);
      }
    });

    const news: string[] = [];
    if (r.newDifficulty) news.push(`${character.name} 解锁新难度：${DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, r.difficulty + 1)].name}`);
    for (const id of r.unlocked) news.push(`解锁新角色：${CHARACTERS[id].name}`);
    if (news.length > 0) {
      divider(this, gx0, py + 266, cw * 2 + gap, COLOR.gold, 0.65);
      news.forEach((t, i) => {
        label(this, gx0 + (cw * 2 + gap) / 2, py + 290 + i * 24, `★ ${t}`, 16, COLOR.goldText, true).setOrigin(0.5);
      });
    } else {
      label(
        this,
        gx0 + (cw * 2 + gap) / 2,
        py + 292,
        r.win ? '后院恢复了宁静，树桩安然无恙！' : '调整配装，再来守卫树桩！',
        16,
        COLOR.dim,
      ).setOrigin(0.5);
    }

    const again = () => this.scene.start('Game');
    createButton(this, W / 2 - 280, 588, '再来一局', again, { width: 250, height: 62 });
    createButton(this, W / 2, 588, '更换角色', () => this.scene.start('CharacterSelect'), { width: 250, height: 62, primary: false });
    createButton(this, W / 2 + 280, 588, '返回菜单', () => this.scene.start('Menu'), { width: 250, height: 62, primary: false });
    this.input.keyboard!.once('keydown-ENTER', again);
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
