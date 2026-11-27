import Peer, { type DataConnection } from 'peerjs';
import {
  COOP_PEER_PREFIX,
  generateRoomCode,
  isLocalRoomCode,
  normalizeRoomCode,
  type CoopMessage,
  type CoopRole,
  type LobbyPlayer,
  type LobbyStatePayload,
  type MatchStartPayload,
} from './protocol';

export type CoopConnState = 'idle' | 'hosting' | 'connecting' | 'connected' | 'disconnected' | 'error';

type MessageListener = (msg: CoopMessage) => void;
type StateListener = (state: CoopConnState, detail?: string) => void;

/**
 * 双人联机会话管理器（WebRTC P2P 房主权威 + LOCAL-* BroadcastChannel 同机双标签测试）。
 * 兼容纯静态部署（Netlify/GitHub Pages），零后端运维。
 */
class CoopSession {
  role: CoopRole = 'off';
  state: CoopConnState = 'idle';
  roomCode = '';
  errorText = '';
  rttMs = 0;

  /** 最近一次大厅状态（供大厅与返回大厅复用） */
  lobby: LobbyStatePayload | null = null;
  /** 开局快照（供 GameScene / CoopGuestScene 读取双方角色与配置） */
  match: MatchStartPayload | null = null;
  /** 波间双方准备状态 */
  hostReady = false;
  guestReady = false;
  /** 联机暂停标记 */
  remotePaused = false;

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private bc: BroadcastChannel | null = null;
  private localClientId = Math.random().toString(36).slice(2, 10);
  private pingTimer: number | null = null;
  private msgListeners = new Set<MessageListener>();
  private stateListeners = new Set<StateListener>();

  get active(): boolean {
    return this.role !== 'off' && (this.state === 'connected' || this.state === 'hosting' || this.state === 'connecting');
  }

  get isHost(): boolean {
    return this.role === 'host' && this.state === 'connected';
  }

  get isGuest(): boolean {
    return this.role === 'guest' && this.state === 'connected';
  }

  get isCoopMatch(): boolean {
    return this.role !== 'off' && this.match !== null;
  }

  onMessage(fn: MessageListener): () => void {
    this.msgListeners.add(fn);
    return () => this.msgListeners.delete(fn);
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  /** 创建房间（房主）；local=true 时走浏览器 BroadcastChannel，可在同机开两个标签页零网络联机测试 */
  createRoom(hostProfile: LobbyPlayer, opts?: { local?: boolean; code?: string }): string {
    this.disconnect();
    const local = !!opts?.local;
    const code = opts?.code ? normalizeRoomCode(opts.code) : generateRoomCode(local);
    this.role = 'host';
    this.roomCode = code;
    this.errorText = '';
    this.rttMs = 0;
    this.hostReady = false;
    this.guestReady = false;
    this.match = null;
    this.setState('hosting', '等待队友加入房间…');

    if (isLocalRoomCode(code)) {
      this.openBroadcastHost(code);
      return code;
    }

    const peerId = `${COOP_PEER_PREFIX}${code}`;
    try {
      const peer = new Peer(peerId, { debug: 0 });
      this.peer = peer;
      peer.on('open', () => {
        if (this.peer !== peer) return;
        this.setState('hosting', '房间已就绪，复制房间码或链接给好友即可开黑');
      });
      peer.on('connection', (conn) => {
        if (this.peer !== peer) return;
        if (this.conn && this.conn.open) {
          conn.close();
          return;
        }
        this.bindPeerConn(conn);
      });
      peer.on('error', (err) => {
        if (this.peer !== peer) return;
        const msg = err?.type === 'unavailable-id' ? '该房间码已被占用，请重试' : `联机信令异常：${err?.message || err?.type || '未知错误'}`;
        this.setState('error', msg);
      });
      peer.on('disconnected', () => {
        if (this.peer !== peer) return;
        if (this.state === 'hosting') {
          try {
            peer.reconnect();
          } catch {
            // ignore
          }
        }
      });
    } catch (e) {
      this.setState('error', `无法初始化 WebRTC：${e instanceof Error ? e.message : String(e)}`);
    }
    void hostProfile;
    return code;
  }

  /** 加入房间（客机） */
  joinRoom(rawCode: string, guestProfile: LobbyPlayer): boolean {
    const code = normalizeRoomCode(rawCode);
    if (!code) {
      this.setState('error', '请输入有效的房间码');
      return false;
    }
    this.disconnect();
    this.role = 'guest';
    this.roomCode = code;
    this.errorText = '';
    this.rttMs = 0;
    this.hostReady = false;
    this.guestReady = false;
    this.match = null;
    this.setState('connecting', `正在连接房间 ${code}…`);

    if (isLocalRoomCode(code)) {
      this.openBroadcastGuest(code, guestProfile);
      return true;
    }

    const targetId = `${COOP_PEER_PREFIX}${code}`;
    try {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timeout = window.setTimeout(() => {
        if (this.peer === peer && this.state === 'connecting') {
          this.setState('error', '连接超时，请确认房主在线且房间码无误');
        }
      }, 14000);
      peer.on('open', () => {
        if (this.peer !== peer) return;
        const conn = peer.connect(targetId, { reliable: true, serialization: 'json' });
        this.bindPeerConn(conn, () => {
          window.clearTimeout(timeout);
          this.send({ type: 'guest_profile', data: guestProfile });
        });
      });
      peer.on('error', (err) => {
        if (this.peer !== peer) return;
        window.clearTimeout(timeout);
        const msg =
          err?.type === 'peer-unavailable'
            ? `未找到房间 ${code}，请检查房间码是否正确`
            : `连接失败：${err?.message || err?.type || '网络受限'}`;
        this.setState('error', msg);
      });
    } catch (e) {
      this.setState('error', `无法建立连接：${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
    return true;
  }

  send(msg: CoopMessage): void {
    if (this.bc) {
      try {
        this.bc.postMessage({ from: this.localClientId, msg });
      } catch {
        // ignore
      }
      return;
    }
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
      } catch {
        // ignore
      }
    }
  }

  resetWaveReady(): void {
    this.hostReady = false;
    this.guestReady = false;
  }

  disconnect(notifyPeer = true): void {
    if (notifyPeer && this.state === 'connected') {
      this.send({ type: 'leave', reason: '玩家已退出房间' });
    }
    this.stopPing();
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // ignore
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    if (this.bc) {
      try {
        this.bc.close();
      } catch {
        // ignore
      }
      this.bc = null;
    }
    this.role = 'off';
    this.roomCode = '';
    this.lobby = null;
    this.match = null;
    this.hostReady = false;
    this.guestReady = false;
    this.remotePaused = false;
    this.rttMs = 0;
    this.setState('idle', '');
  }

  private bindPeerConn(conn: DataConnection, onOpenExtra?: () => void): void {
    this.conn = conn;
    conn.on('open', () => {
      if (this.conn !== conn) return;
      this.setState('connected', '已建立 P2P 联机通道');
      this.startPing();
      onOpenExtra?.();
    });
    conn.on('data', (raw) => {
      if (this.conn !== conn) return;
      if (!raw || typeof raw !== 'object') return;
      this.handleIncoming(raw as CoopMessage);
    });
    conn.on('close', () => {
      if (this.conn !== conn) return;
      this.stopPing();
      this.conn = null;
      this.setState('disconnected', '队友已断开连接');
    });
    conn.on('error', () => {
      if (this.conn !== conn) return;
      this.stopPing();
      this.setState('disconnected', '连接中断');
    });
  }

  private openBroadcastHost(code: string): void {
    if (typeof BroadcastChannel === 'undefined') {
      this.setState('error', '当前浏览器不支持 BroadcastChannel 本地联机');
      return;
    }
    const bc = new BroadcastChannel(`hexapod-local-${code}`);
    this.bc = bc;
    bc.onmessage = (ev) => {
      const payload = ev.data as { from?: string; msg?: CoopMessage } | undefined;
      if (!payload || payload.from === this.localClientId || !payload.msg) return;
      if (this.state !== 'connected') {
        this.setState('connected', '同机本地通道已连接');
        this.startPing();
      }
      this.handleIncoming(payload.msg);
    };
    this.setState('hosting', '本地测试房间已创建：再开一个标签页加入此房间码即可');
  }

  private openBroadcastGuest(code: string, guestProfile: LobbyPlayer): void {
    if (typeof BroadcastChannel === 'undefined') {
      this.setState('error', '当前浏览器不支持 BroadcastChannel 本地联机');
      return;
    }
    const bc = new BroadcastChannel(`hexapod-local-${code}`);
    this.bc = bc;
    bc.onmessage = (ev) => {
      const payload = ev.data as { from?: string; msg?: CoopMessage } | undefined;
      if (!payload || payload.from === this.localClientId || !payload.msg) return;
      if (this.state !== 'connected') {
        this.setState('connected', '同机本地通道已连接');
        this.startPing();
      }
      this.handleIncoming(payload.msg);
    };
    // 立刻广播加入握手
    this.send({ type: 'guest_profile', data: guestProfile });
    window.setTimeout(() => {
      if (this.bc === bc && this.state === 'connecting') {
        this.send({ type: 'guest_profile', data: guestProfile });
      }
    }, 350);
  }

  private handleIncoming(msg: CoopMessage): void {
    if (msg.type === 'ping') {
      this.send({ type: 'pong', ts: msg.ts });
      return;
    }
    if (msg.type === 'pong') {
      this.rttMs = Math.max(1, Math.round(performance.now() - msg.ts));
      return;
    }
    if (msg.type === 'leave') {
      this.stopPing();
      this.setState('disconnected', msg.reason ?? '队友已离开房间');
    }
    for (const fn of [...this.msgListeners]) fn(msg);
  }

  private startPing(): void {
    this.stopPing();
    this.send({ type: 'ping', ts: performance.now() });
    this.pingTimer = window.setInterval(() => {
      if (this.state === 'connected') this.send({ type: 'ping', ts: performance.now() });
    }, 1500);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setState(next: CoopConnState, detail = ''): void {
    this.state = next;
    this.errorText = next === 'error' || next === 'disconnected' ? detail : '';
    for (const fn of [...this.stateListeners]) fn(next, detail);
  }
}

export const coop = new CoopSession();
