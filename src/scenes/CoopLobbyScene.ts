import Phaser from 'phaser';
import { bgm } from '../audio/bgm';
import { sfx } from '../audio/sfx';
import { weaponTex } from '../art/icons';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave, SHELL_SKINS, codexMilestones, type ShellSkinId } from '../core/save';
import { generateSeed } from '../core/seed';
import { BIOME_ORDER, BIOMES, DEFAULT_BIOME, type BiomeId } from '../data/biomes';
import { CHARACTER_ORDER, CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import { WEAPONS } from '../data/weapons';
import { BeetleView } from '../entities/BeetleView';
import { coop } from '../net/coop';
import { normalizeRoomCode, type CoopMessage, type LobbyPlayer, type LobbyStatePayload, type MatchStartPayload } from '../net/protocol';
import { createButton } from '../ui/Button';
import { fadeInScene, setupUICamera, transitionTo } from '../ui/camera';
import { COLOR, cardTitle, displayLabel, divider, drawChamferPlate, label, panel, pill, slotBox, warmBackdrop } from '../ui/widgets';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;

export interface CoopLobbyInit {
  joinCode?: string;
}

/** 双人联机大厅（WebRTC P2P 房主权威 + 同机双标签本地测试） */
export class CoopLobbyScene extends Phaser.Scene {
  private root: Phaser.GameObjects.Container | null = null;
  private preview1: BeetleView | null = null;
  private preview2: BeetleView | null = null;
  private elapsed = 0;
  private statusMsg = '';
  private infoToast = '';

  // 本地配置
  private myProfile!: LobbyPlayer;
  private hostDifficulty = 0;
  private hostBiome: BiomeId = DEFAULT_BIOME;
  private hostSeed = generateSeed();
  private guestProfile: LobbyPlayer | null = null;
  private remoteLobby: LobbyStatePayload | null = null;

  private unsubMsg: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private pendingJoinCode = '';

  constructor() {
    super('CoopLobby');
  }

  init(data?: CoopLobbyInit): void {
    this.pendingJoinCode = data?.joinCode ? normalizeRoomCode(data.joinCode) : '';
  }

  create(): void {
    setupUICamera(this);
    bgm.setMode('menu');
    warmBackdrop(this, W, H);

    this.root = null;
    this.preview1 = null;
    this.preview2 = null;
    this.elapsed = 0;
    this.statusMsg = '';
    this.infoToast = '';

    const save = loadSave();
    const startChar = CHARACTERS[save.last.character] ? save.last.character : CHARACTER_ORDER[0];
    const startWeapons = CHARACTERS[startChar].startWeapons;
    const startW = startWeapons.includes(save.last.weapon) ? save.last.weapon : (startWeapons[0] ?? '');

    if (coop.role === 'host' && coop.lobby) {
      this.myProfile = { ...coop.lobby.host, ready: true };
      this.hostDifficulty = coop.lobby.difficulty;
      this.hostBiome = coop.lobby.biome;
      this.hostSeed = generateSeed();
      this.guestProfile = coop.lobby.guest ? { ...coop.lobby.guest, ready: false } : null;
    } else if (coop.role === 'guest' && coop.lobby?.guest) {
      this.myProfile = { ...coop.lobby.guest, ready: false };
      this.remoteLobby = coop.lobby;
    } else {
      this.myProfile = {
        character: startChar,
        weapon: startW,
        shellSkin: save.shellSkin ?? 'default',
        ready: false,
      };
      this.hostDifficulty = save.last.difficulty ?? 0;
      this.hostBiome = save.last.biome ?? DEFAULT_BIOME;
      this.hostSeed = generateSeed();
      this.guestProfile = null;
      this.remoteLobby = null;
    }

    this.unsubMsg = coop.onMessage((msg) => this.handleMessage(msg));
    this.unsubState = coop.onState((st, detail) => {
      if (detail) this.statusMsg = detail;
      if (st === 'connected' && coop.role === 'host') {
        this.broadcastLobby();
      } else if (st === 'disconnected') {
        if (coop.role === 'host') {
          this.guestProfile = null;
          this.statusMsg = '队友已断开连接，等待重新加入…';
        } else {
          this.statusMsg = detail || '与房主断开连接';
        }
      }
      if (this.scene.isActive()) this.render();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubMsg?.();
      this.unsubState?.();
      this.unsubMsg = null;
      this.unsubState = null;
    });

    this.input.keyboard!.on('keydown-ESC', () => this.leaveToMenu());

    if (this.pendingJoinCode && coop.role === 'off') {
      const code = this.pendingJoinCode;
      this.pendingJoinCode = '';
      this.joinByCode(code);
    } else if (coop.role === 'host' && coop.state === 'connected') {
      this.broadcastLobby();
    } else if (coop.role === 'guest' && coop.state === 'connected') {
      coop.send({ type: 'guest_profile', data: this.myProfile });
    }

    this.render();
    fadeInScene(this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.preview1?.animate(dt, 0.55);
    this.preview2?.animate(dt, 0.55);
  }

  private leaveToMenu(): void {
    coop.disconnect();
    transitionTo(this, 'Menu');
  }

  private createHostRoom(local = false): void {
    this.myProfile.ready = true;
    this.guestProfile = null;
    this.hostSeed = generateSeed();
    this.infoToast = '';
    const code = coop.createRoom(this.myProfile, { local });
    this.statusMsg = local
      ? `本地测试房 ${code} 已就绪，打开第二个标签页加入即可`
      : `房间 ${code} 已创建，分享房间码或链接给好友即可开黑`;
    this.updateLobbyCache();
    this.render();
  }

  private joinByCode(raw: string): void {
    const code = normalizeRoomCode(raw);
    if (!code) {
      this.infoToast = '房间码格式无效，请输入 6 位字母数字或粘贴邀请链接';
      this.render();
      return;
    }
    this.myProfile.ready = false;
    this.remoteLobby = null;
    this.infoToast = '';
    coop.joinRoom(code, this.myProfile);
    this.statusMsg = `正在连接房间 ${code}…`;
    this.render();
  }

  private askJoinCode(): void {
    const input = window.prompt('请输入好友的 6 位房间码（或直接粘贴邀请链接）：', '');
    if (!input) return;
    this.joinByCode(input);
  }

  private buildInviteLink(): string {
    if (typeof window === 'undefined') return coop.roomCode;
    const url = new URL(window.location.href);
    url.searchParams.set('coop', coop.roomCode);
    url.searchParams.delete('challenge');
    return url.toString();
  }

  private copyInvite(linkMode: boolean): void {
    const text = linkMode ? this.buildInviteLink() : coop.roomCode;
    sfx.play('unlock');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          this.infoToast = linkMode ? `已复制邀请链接（房间 ${coop.roomCode}）！发给好友点开即入房` : `已复制房间码：${coop.roomCode}`;
          this.render();
        },
        () => window.prompt(linkMode ? '请复制以下邀请链接：' : '请复制房间码：', text),
      );
    } else {
      window.prompt(linkMode ? '请复制以下邀请链接：' : '请复制房间码：', text);
    }
  }

  private updateLobbyCache(): LobbyStatePayload {
    const payload: LobbyStatePayload = {
      roomCode: coop.roomCode,
      difficulty: this.hostDifficulty,
      biome: this.hostBiome,
      seed: this.hostSeed,
      host: { ...this.myProfile, ready: true },
      guest: this.guestProfile ? { ...this.guestProfile } : null,
    };
    coop.lobby = payload;
    return payload;
  }

  private broadcastLobby(): void {
    if (coop.role !== 'host') return;
    const payload = this.updateLobbyCache();
    coop.send({ type: 'lobby_state', data: payload });
  }

  private syncGuestProfile(): void {
    if (coop.role !== 'guest') return;
    coop.send({ type: 'guest_profile', data: { ...this.myProfile } });
  }

  private handleMessage(msg: CoopMessage): void {
    if (msg.type === 'guest_profile' && coop.role === 'host') {
      this.guestProfile = { ...msg.data };
      this.broadcastLobby();
      this.render();
    } else if (msg.type === 'lobby_state' && coop.role === 'guest') {
      this.remoteLobby = msg.data;
      coop.lobby = msg.data;
      this.render();
    } else if (msg.type === 'start_match' && coop.role === 'guest') {
      coop.match = msg.data;
      coop.resetWaveReady();
      sfx.play('waveStart');
      transitionTo(this, 'CoopGuest', msg.data);
    }
  }

  private startMatch(): void {
    if (coop.role !== 'host' || coop.state !== 'connected' || !this.guestProfile || !this.guestProfile.ready) return;
    const payload: MatchStartPayload = {
      seed: this.hostSeed,
      difficulty: this.hostDifficulty,
      biome: this.hostBiome,
      host: { ...this.myProfile, ready: true },
      guest: { ...this.guestProfile, ready: true },
    };
    this.updateLobbyCache();
    coop.match = payload;
    coop.resetWaveReady();
    coop.send({ type: 'start_match', data: payload });
    sfx.play('waveStart');
    transitionTo(this, 'Game', {
      character: payload.host.character,
      difficulty: payload.difficulty,
      weapon: payload.host.weapon,
      biome: payload.biome,
      seed: payload.seed,
      shellSkin: payload.host.shellSkin,
    });
  }

  private cycleCharacter(dir: number): void {
    const idx = CHARACTER_ORDER.indexOf(this.myProfile.character);
    const nextId = CHARACTER_ORDER[(idx + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length];
    this.myProfile.character = nextId;
    this.myProfile.weapon = CHARACTERS[nextId].startWeapons[0] ?? '';
    if (coop.role === 'guest') this.myProfile.ready = false;
    sfx.play('click');
    if (coop.role === 'host') this.broadcastLobby();
    else this.syncGuestProfile();
    this.render();
  }

  private cycleWeapon(dir: number): void {
    const list = CHARACTERS[this.myProfile.character].startWeapons;
    if (list.length <= 1) return;
    const idx = list.indexOf(this.myProfile.weapon);
    this.myProfile.weapon = list[(idx + dir + list.length) % list.length];
    if (coop.role === 'guest') this.myProfile.ready = false;
    sfx.play('click');
    if (coop.role === 'host') this.broadcastLobby();
    else this.syncGuestProfile();
    this.render();
  }

  private cycleSkin(): void {
    const unlocked = codexMilestones().unlockedSkins;
    const idx = unlocked.indexOf(this.myProfile.shellSkin);
    this.myProfile.shellSkin = unlocked[(idx + 1) % unlocked.length] as ShellSkinId;
    sfx.play('click');
    if (coop.role === 'host') this.broadcastLobby();
    else this.syncGuestProfile();
    this.render();
  }

  private render(): void {
    this.root?.destroy();
    this.preview1 = null;
    this.preview2 = null;
    const root = this.add.container(0, 0);
    this.root = root;

    // 顶栏
    root.add(displayLabel(this, 44, 38, '🤝 双人联机大厅', 30, COLOR.goldText).setOrigin(0, 0.5));
    const subTag =
      coop.role === 'off'
        ? 'WebRTC P2P 在线双排 · 零服务器 · 独立商店 · 倒地互救'
        : `房间码 ${coop.roomCode} · ${coop.role === 'host' ? '房主 (P1)' : '队友 (P2)'}`;
    const sp = pill(this, 0, 38, subTag, COLOR.panelDeep, COLOR.gold, COLOR.goldText, 13, 12, 26);
    sp.x = 304 + sp.width / 2;
    root.add(sp);
    root.add(
      createButton(this, W - 98, 38, coop.role === 'off' ? '返回菜单' : '退出房间', () => this.leaveToMenu(), {
        width: 142,
        height: 42,
        fontSize: 17,
        primary: false,
      }),
    );

    if (coop.role === 'off') {
      this.renderEntry(root);
    } else {
      this.renderRoom(root);
    }

    if (this.infoToast) {
      root.add(label(this, W / 2, H - 24, this.infoToast, 14, COLOR.good, true).setOrigin(0.5));
    }
  }

  private renderEntry(root: Phaser.GameObjects.Container): void {
    const cw = 460;
    const ch = 420;
    const gap = 44;
    const x1 = Math.round(W / 2 - cw - gap / 2);
    const x2 = Math.round(W / 2 + gap / 2);
    const y0 = 130;

    // 左卡：创建房间
    root.add(panel(this, x1, y0, cw, ch, COLOR.gold, COLOR.panel, 2, COLOR.gold));
    const cx1 = x1 + cw / 2;
    root.add(displayLabel(this, cx1, y0 + 54, '🏠 创建房间', 30, COLOR.goldText).setOrigin(0.5));
    root.add(pill(this, cx1, y0 + 96, '担任 P1 房主 · 选择天气难度与生态', COLOR.panelDeep, COLOR.gold, '#ffe696', 13, 12, 26));
    root.add(divider(this, x1 + 32, y0 + 128, cw - 64, COLOR.gold, 0.45));
    const hostBullets = [
      '• 生成 6 位专属房间码与一键邀请链接，支持跨设备在线开黑',
      '• 各自独立花蜜、装备与商店，波间同时选购，全员准备后开波',
      '• 队友倒地可靠近 2.5 秒拉起，未救起下波自动满血复活',
      '• 兼容电脑与手机，无需额外后端服务器',
    ];
    hostBullets.forEach((b, i) => {
      root.add(label(this, x1 + 34, y0 + 148 + i * 38, b, 14, '#e4e3dc', false, cw - 68).setOrigin(0, 0).setAlign('left'));
    });
    root.add(
      createButton(this, cx1, y0 + 330, '创建在线房间 ▶', () => this.createHostRoom(false), {
        width: 280,
        height: 54,
        fontSize: 20,
      }),
    );
    root.add(
      createButton(this, cx1, y0 + 386, '同机双标签测试房（离线可用）', () => this.createHostRoom(true), {
        width: 280,
        height: 36,
        fontSize: 13.5,
        primary: false,
        variant: 'emerald',
      }),
    );

    // 右卡：加入房间
    root.add(panel(this, x2, y0, cw, ch, 0x5cd8ff, COLOR.panel, 2, 0x5cd8ff));
    const cx2 = x2 + cw / 2;
    root.add(displayLabel(this, cx2, y0 + 54, '🚀 加入房间', 30, '#9ceeff').setOrigin(0.5));
    root.add(pill(this, cx2, y0 + 96, '作为 P2 队友加入好友的房间', COLOR.panelDeep, 0x5cd8ff, '#c6f4ff', 13, 12, 26));
    root.add(divider(this, x2 + 32, y0 + 128, cw - 64, 0x5cd8ff, 0.45));
    const guestBullets = [
      '• 输入好友发来的 6 位房间码，或直接粘贴完整邀请链接',
      '• 联机模式下可直接选用全部 13 个虫族角色，无需预先解锁',
      '• 客机拥有独立第一视角镜头、完整战斗音效与实时队友定位箭标',
      '• 如遇公司/校园严格内网防火墙，建议切换至同一 Wi-Fi 或手机热点',
    ];
    guestBullets.forEach((b, i) => {
      root.add(label(this, x2 + 34, y0 + 148 + i * 38, b, 14, '#e4e3dc', false, cw - 68).setOrigin(0, 0).setAlign('left'));
    });
    root.add(
      createButton(this, cx2, y0 + 344, '输入房间码 / 链接 ▶', () => this.askJoinCode(), {
        width: 280,
        height: 56,
        fontSize: 20,
        variant: 'emerald',
      }),
    );
  }

  private renderRoom(root: Phaser.GameObjects.Container): void {
    const isHost = coop.role === 'host';
    const connected = coop.state === 'connected';
    const hostData: LobbyPlayer = isHost
      ? this.myProfile
      : (this.remoteLobby?.host ?? { character: 'stag', weapon: 'jaw', shellSkin: 'default', ready: true });
    const guestData: LobbyPlayer | null = isHost ? this.guestProfile : this.myProfile;
    const diffIdx = isHost ? this.hostDifficulty : (this.remoteLobby?.difficulty ?? 0);
    const biomeId: BiomeId = isHost ? this.hostBiome : (this.remoteLobby?.biome ?? DEFAULT_BIOME);

    // 房间状态条
    const barY = 92;
    const stateCol =
      coop.state === 'connected' ? 0x5de862 : coop.state === 'error' || coop.state === 'disconnected' ? 0xff5d57 : 0xffd44c;
    const stateText =
      coop.state === 'connected'
        ? `● 已连接${coop.rttMs > 0 ? ` · ${coop.rttMs}ms` : ''}`
        : coop.state === 'hosting'
          ? '◌ 等待队友加入…'
          : coop.state === 'connecting'
            ? '◌ 正在建立 P2P 连接…'
            : `✕ ${coop.errorText || this.statusMsg || '已断开'}`;
    const stPill = pill(this, 0, barY, stateText, COLOR.panelDeep, stateCol, '#f2f1ec', 13.5, 14, 28);
    stPill.x = 44 + stPill.width / 2;
    root.add(stPill);

    if (isHost) {
      root.add(
        createButton(this, W - 362, barY, '📋 复制邀请链接', () => this.copyInvite(true), {
          width: 162,
          height: 36,
          fontSize: 14,
          primary: false,
          variant: 'emerald',
        }),
      );
      root.add(
        createButton(this, W - 196, barY, `复制码 ${coop.roomCode}`, () => this.copyInvite(false), {
          width: 152,
          height: 36,
          fontSize: 13.5,
          primary: false,
        }),
      );
      if (coop.roomCode.startsWith('LOCAL-')) {
        root.add(
          createButton(
            this,
            W - 538,
            barY,
            '↗ 新开 2P 标签页',
            () => {
              window.open(this.buildInviteLink(), '_blank');
            },
            { width: 164, height: 36, fontSize: 13.5, primary: false, accentColor: 0x62e8ff },
          ),
        );
      }
    }

    // 左右双人准备卡
    const cw = 576;
    const ch = 434;
    const gap = 36;
    const x1 = Math.round(W / 2 - cw - gap / 2);
    const x2 = Math.round(W / 2 + gap / 2);
    const y0 = 128;

    this.renderPlayerCard(root, x1, y0, cw, ch, 'P1 · 房主', COLOR.gold, '#ffd44c', hostData, isHost, diffIdx, biomeId, true);
    this.renderPlayerCard(root, x2, y0, cw, ch, 'P2 · 队友', 0x5cd8ff, '#9ceeff', guestData, !isHost, diffIdx, biomeId, false);

    // 底部行动栏
    const footY = H - 68;
    if (isHost) {
      const canStart = connected && !!guestData && guestData.ready;
      const btnText = !connected
        ? '等待队友加入房间…'
        : !guestData?.ready
          ? '等待 P2 队友点击准备…'
          : '开始双人战斗 ▶';
      root.add(
        createButton(this, W / 2, footY, btnText, () => this.startMatch(), {
          width: 340,
          height: 58,
          fontSize: 22,
          disabled: !canStart,
        }),
      );
    } else {
      const ready = this.myProfile.ready;
      root.add(
        createButton(
          this,
          W / 2,
          footY,
          ready ? '✓ 已准备（点击取消）' : '准备就绪 ▶',
          () => {
            if (!connected) return;
            this.myProfile.ready = !this.myProfile.ready;
            sfx.play(this.myProfile.ready ? 'unlock' : 'click');
            this.syncGuestProfile();
            this.render();
          },
          {
            width: 320,
            height: 58,
            fontSize: 22,
            variant: ready ? 'emerald' : undefined,
            primary: !ready,
            disabled: !connected,
          },
        ),
      );
    }
  }

  private renderPlayerCard(
    root: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    roleTitle: string,
    accent: number,
    css: string,
    player: LobbyPlayer | null,
    editable: boolean,
    diffIdx: number,
    biomeId: BiomeId,
    isHostCard: boolean,
  ): void {
    const g = this.add.graphics();
    drawChamferPlate(g, x, y, w, h, {
      fill: COLOR.panel,
      border: accent,
      borderWidth: 2,
      accentTop: accent,
      headerH: 0,
      shadowX: 4,
      shadowY: 5,
      cutBig: 10,
      cutSmall: 4,
      inkWidth: 3,
    });
    root.add(g);

    root.add(displayLabel(this, x + 22, y + 32, roleTitle, 24, css).setOrigin(0, 0.5));
    const readyStr = !player ? '空位' : isHostCard ? '房主就绪' : player.ready ? '✓ 已准备' : '选角中…';
    const readyCol = !player ? COLOR.borderSoft : isHostCard || player.ready ? 0x5de862 : COLOR.gold;
    const rp = pill(this, 0, y + 32, readyStr, COLOR.panelDeep, readyCol, !player ? COLOR.dim : '#f2f1ec', 12.5, 11, 24);
    rp.x = x + w - 20 - rp.width / 2;
    root.add(rp);
    root.add(divider(this, x + 20, y + 58, w - 40, accent, 0.45));

    if (!player) {
      root.add(label(this, x + w / 2, y + h / 2 - 18, '等待好友输入房间码加入…', 20, COLOR.dim, true).setOrigin(0.5));
      root.add(label(this, x + w / 2, y + h / 2 + 18, `房间码：${coop.roomCode}`, 18, COLOR.goldText, true).setOrigin(0.5));
      return;
    }

    const ch = CHARACTERS[player.character] ?? CHARACTERS[CHARACTER_ORDER[0]];
    const weap = player.weapon ? WEAPONS[player.weapon] : null;
    const skin = SHELL_SKINS[player.shellSkin] ?? SHELL_SKINS.default;

    // 左侧角色立绘台
    const bx = x + 116;
    const by = y + 158;
    const spot = this.add.graphics();
    spot.fillStyle(COLOR.panelDeep, 1);
    spot.fillCircle(bx, by, 68);
    spot.lineStyle(2.8, accent, 0.85);
    spot.strokeCircle(bx, by, 68);
    root.add(spot);

    const bv = new BeetleView(this, bx, by, ch.shell).setScale(1.65).setRotation(-Math.PI / 2);
    bv.setShellSkin(player.shellSkin);
    if (weap) {
      bv.setWeapon(0, weap.icon, 0, true);
      bv.setWeaponAim(0, bv.rotation + bv.tipLocalAngle(0) - 0.55);
    }
    root.add(bv);
    if (isHostCard) this.preview1 = bv;
    else this.preview2 = bv;

    root.add(cardTitle(this, bx, by + 88, ch.name, 20, COLOR.goldText).setOrigin(0.5));
    root.add(label(this, bx, by + 114, ch.role, 13, COLOR.dim).setOrigin(0.5));

    // 右侧信息与切换控件
    const rx = x + 216;
    const rw = w - 236;
    root.add(label(this, rx, y + 76, '角色切换', 13, COLOR.dim, true).setOrigin(0, 0));
    if (editable) {
      root.add(createButton(this, rx + 36, y + 114, '◀', () => this.cycleCharacter(-1), { width: 64, height: 34, fontSize: 16, primary: false }));
      root.add(label(this, rx + rw / 2, y + 114, ch.name, 16, COLOR.text, true).setOrigin(0.5));
      root.add(createButton(this, rx + rw - 36, y + 114, '▶', () => this.cycleCharacter(1), { width: 64, height: 34, fontSize: 16, primary: false }));
    } else {
      root.add(pill(this, rx + rw / 2, y + 114, `${ch.name} · ${ch.role}`, COLOR.panelDeep, accent, COLOR.text, 14, 14, 30));
    }

    // 初始武器
    root.add(label(this, rx, y + 144, '初始武器', 13, COLOR.dim, true).setOrigin(0, 0));
    if (weap) {
      root.add(slotBox(this, rx + 26, y + 186, 44, COLOR.border));
      const wImg = this.add.image(rx + 26, y + 185, weaponTex(weap.icon, 0, true));
      wImg.setScale(32 / Math.max(wImg.width, wImg.height));
      root.add(wImg);
      root.add(label(this, rx + 58, y + 186, weap.name, 15, COLOR.text, true).setOrigin(0, 0.5));
    } else {
      root.add(label(this, rx + 8, y + 186, '工蚁随从（无武器槽）', 14, COLOR.goldText, true).setOrigin(0, 0.5));
    }
    if (editable && ch.startWeapons.length > 1) {
      root.add(createButton(this, rx + rw - 44, y + 186, '换武器', () => this.cycleWeapon(1), { width: 84, height: 32, fontSize: 13, primary: false }));
    }

    // 涂装
    root.add(label(this, rx, y + 220, `甲壳涂装：${skin.name}`, 13, skin.css, true).setOrigin(0, 0));
    if (editable && codexMilestones().unlockedSkins.length > 1) {
      root.add(createButton(this, rx + rw - 44, y + 228, '换涂装', () => this.cycleSkin(), { width: 84, height: 30, fontSize: 12.5, primary: false }));
    }

    // 角色优缺点简览
    const perkY = y + 258;
    root.add(divider(this, rx, perkY, rw, COLOR.border, 0.45));
    const prosText = ch.pros.slice(0, 2).join('；') || '均衡全能';
    const consText = ch.cons.slice(0, 1).join('；') || '无负面限制';
    root.add(label(this, rx, perkY + 10, `✦ ${prosText}`, 12.5, COLOR.good, false, rw).setOrigin(0, 0).setAlign('left'));
    root.add(label(this, rx, perkY + 52, `• ${consText}`, 12.5, '#ff9a92', false, rw).setOrigin(0, 0).setAlign('left'));

    // 底部：房主显示难度与生态选择器；客机显示当前房主所选战场信息
    const footBarY = y + h - 54;
    root.add(divider(this, x + 20, footBarY - 14, w - 40, COLOR.border, 0.45));
    const diff = DIFFICULTIES[diffIdx] ?? DIFFICULTIES[0];
    const biome = BIOMES[biomeId];
    if (isHostCard && editable) {
      root.add(
        createButton(
          this,
          x + 148,
          footBarY + 18,
          `天气：${diff.name} ▸`,
          () => {
            this.hostDifficulty = (this.hostDifficulty + 1) % DIFFICULTIES.length;
            sfx.play('click');
            this.broadcastLobby();
            this.render();
          },
          { width: 244, height: 38, fontSize: 15, primary: false },
        ),
      );
      root.add(
        createButton(
          this,
          x + w - 148,
          footBarY + 18,
          `生态：${biome.name} ▸`,
          () => {
            const bi = BIOME_ORDER.indexOf(this.hostBiome);
            this.hostBiome = BIOME_ORDER[(bi + 1) % BIOME_ORDER.length];
            sfx.play('click');
            this.broadcastLobby();
            this.render();
          },
          { width: 244, height: 38, fontSize: 15, primary: false, accentColor: biome.accent },
        ),
      );
    } else {
      root.add(
        label(
          this,
          x + w / 2,
          footBarY + 18,
          `当前战场：${diff.name}难度 · ${biome.name}（${biome.tagline}）`,
          13.5,
          biome.css,
          true,
        ).setOrigin(0.5),
      );
    }
  }
}
