import Phaser from 'phaser';
import { GAME_HEIGHT, HUD_SCALE } from '../config';
import { touchMove } from '../core/input';

const DEADZONE = 0.12;
/** 推到这个比例就算全速，手机上不用推到底 */
const FULL_AT = 0.6;
const BASE_R = 72;
const KNOB_R = 28;
const MOUSE_FALLBACK_ID = -2;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface PendingPointer {
  id: number;
  pointerType: string;
  x: number;
  y: number;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function createJoystickOverlay(): { svg: SVGSVGElement; base: SVGGElement; knob: SVGGElement } {
  const svg = svgEl('svg', { width: '100%', height: '100%' });
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:20;display:none;';

  const base = svgEl('g', {});
  base.appendChild(svgEl('circle', { cx: 0, cy: 0, r: BASE_R, fill: 'rgba(20,13,7,0.34)', stroke: 'rgba(255,224,152,0.5)', 'stroke-width': 3 }));
  base.appendChild(svgEl('circle', { cx: 0, cy: 0, r: BASE_R * FULL_AT, fill: 'none', stroke: 'rgba(255,228,168,0.22)', 'stroke-width': 1.4 }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const r0 = k % 2 === 0 ? BASE_R - 9 : BASE_R - 5;
    base.appendChild(
      svgEl('line', {
        x1: Math.cos(a) * r0,
        y1: Math.sin(a) * r0,
        x2: Math.cos(a) * (BASE_R - 1),
        y2: Math.sin(a) * (BASE_R - 1),
        stroke: k % 2 === 0 ? 'rgba(255,216,122,0.58)' : 'rgba(255,216,122,0.34)',
        'stroke-width': k % 2 === 0 ? 2 : 1.2,
        'stroke-linecap': 'round',
      }),
    );
  }

  const knob = svgEl('g', {});
  knob.appendChild(svgEl('circle', { cx: 2, cy: 4, r: KNOB_R, fill: 'rgba(5,5,7,0.45)' }));
  knob.appendChild(svgEl('circle', { cx: 0, cy: 0, r: KNOB_R, fill: '#c47218', stroke: '#050507', 'stroke-width': 2.6 }));
  knob.appendChild(svgEl('circle', { cx: 0, cy: -1, r: KNOB_R * 0.84, fill: '#f6b842' }));
  knob.appendChild(svgEl('circle', { cx: -KNOB_R * 0.26, cy: -KNOB_R * 0.28, r: KNOB_R * 0.32, fill: 'rgba(255,244,200,0.55)' }));
  knob.appendChild(svgEl('circle', { cx: 0, cy: 0, r: KNOB_R - 1.5, fill: 'none', stroke: 'rgba(255,240,192,0.85)', 'stroke-width': 1.5 }));

  svg.appendChild(base);
  svg.appendChild(knob);
  document.body.appendChild(svg);
  return { svg, base, knob };
}

/**
 * 全视口浮动摇杆（包括宽屏手机横屏两侧的黑边留白区域）：
 * - 画布内按空白处由 Phaser 判定不穿透按钮后触发；
 * - 画布外（左右留白黑边/上下边距）由 window PointerEvent 直接接管；
 * - 拖动全程由 window 追踪，跨过画布边界也不会断触或卡死。
 */
export class VirtualJoystick {
  private readonly canvas: HTMLCanvasElement;
  private readonly svg: SVGSVGElement;
  private readonly base: SVGGElement;
  private readonly knob: SVGGElement;
  private pointerId = -1;
  private ox = 0;
  private oy = 0;
  private activeScale = 1;
  private enabled = true;
  /** Phaser 的 MouseManager/TouchManager 使用 mousedown/touchstart，需通过前置 pointerdown 关联真实的 PointerEvent.pointerId */
  private readonly pendingCanvasDowns: PendingPointer[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly radius = BASE_R * HUD_SCALE,
  ) {
    this.canvas = scene.game.canvas;
    const overlay = createJoystickOverlay();
    this.svg = overlay.svg;
    this.base = overlay.base;
    this.knob = overlay.knob;

    const input = scene.input;
    input.on('pointerdown', this.onCanvasDown, this);
    window.addEventListener('pointerdown', this.onWindowDown);
    window.addEventListener('pointermove', this.onWindowMove);
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('pointercancel', this.onWindowUp);
    window.addEventListener('blur', this.onBlur);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.release();
      input.off('pointerdown', this.onCanvasDown, this);
      window.removeEventListener('pointerdown', this.onWindowDown);
      window.removeEventListener('pointermove', this.onWindowMove);
      window.removeEventListener('pointerup', this.onWindowUp);
      window.removeEventListener('pointercancel', this.onWindowUp);
      window.removeEventListener('blur', this.onBlur);
      this.svg.remove();
    });
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.release();
  }

  private cssScale(): number {
    const rectH = this.canvas.getBoundingClientRect().height || window.innerHeight || GAME_HEIGHT;
    return Math.max(0.45, (this.radius / BASE_R) * (rectH / GAME_HEIGHT));
  }

  private start(id: number, x: number, y: number): void {
    this.pointerId = id;
    this.ox = x;
    this.oy = y;
    this.activeScale = this.cssScale();
    const tf = `translate(${x}, ${y}) scale(${this.activeScale})`;
    this.base.setAttribute('transform', tf);
    this.knob.setAttribute('transform', tf);
    this.svg.style.display = 'block';
    touchMove.x = touchMove.y = 0;
  }

  private move(x: number, y: number): void {
    const maxR = BASE_R * this.activeScale;
    let dx = x - this.ox;
    let dy = y - this.oy;
    let len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
      len = maxR;
    }
    this.knob.setAttribute('transform', `translate(${this.ox + dx}, ${this.oy + dy}) scale(${this.activeScale})`);
    const k = len / maxR;
    if (k < DEADZONE) {
      touchMove.x = touchMove.y = 0;
      return;
    }
    const m = Math.min(1, (k - DEADZONE) / (FULL_AT - DEADZONE));
    touchMove.x = (dx / len) * m;
    touchMove.y = (dy / len) * m;
  }

  private takePendingCanvasDown(isMouse: boolean): PendingPointer | undefined {
    const idx = this.pendingCanvasDowns.findIndex((item) =>
      isMouse ? item.pointerType !== 'touch' : item.pointerType !== 'mouse',
    );
    if (idx === -1) return undefined;
    return this.pendingCanvasDowns.splice(idx, 1)[0];
  }

  private matchesActive(ev: PointerEvent): boolean {
    if (this.pointerId === -1) return false;
    if (this.pointerId === MOUSE_FALLBACK_ID) return ev.pointerType === 'mouse';
    return ev.pointerId === this.pointerId;
  }

  private onCanvasDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    const isMouse = !p.wasTouch;
    if (isMouse && p.button !== 0) return;
    const pending = this.takePendingCanvasDown(isMouse);
    if (!this.enabled || this.pointerId !== -1 || over.length > 0) return;

    const ev = p.event as PointerEvent | TouchEvent | MouseEvent | undefined;
    if (ev && 'pointerId' in ev) {
      this.start(ev.pointerId, ev.clientX, ev.clientY);
      return;
    }
    if (pending) {
      this.start(pending.id, pending.x, pending.y);
      return;
    }
    const touch = ev && 'changedTouches' in ev ? ev.changedTouches[0] : undefined;
    const rect = this.canvas.getBoundingClientRect();
    const x = touch
      ? touch.clientX
      : ev && 'clientX' in ev
        ? ev.clientX
        : rect.left + (p.x / (this.canvas.width || 1)) * rect.width;
    const y = touch
      ? touch.clientY
      : ev && 'clientY' in ev
        ? ev.clientY
        : rect.top + (p.y / (this.canvas.height || 1)) * rect.height;
    this.start(touch ? touch.identifier : isMouse ? MOUSE_FALLBACK_ID : p.id, x, y);
  }

  private readonly onWindowDown = (ev: PointerEvent): void => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (!this.enabled || this.pointerId !== -1) return;
    // 画布内部需等 Phaser onCanvasDown 判定是否点中按钮，这里先记下 PointerEvent 以便关联 pointerId
    if (ev.target === this.canvas) {
      this.pendingCanvasDowns.push({
        id: ev.pointerId,
        pointerType: ev.pointerType,
        x: ev.clientX,
        y: ev.clientY,
      });
      if (this.pendingCanvasDowns.length > 8) this.pendingCanvasDowns.shift();
      return;
    }
    this.start(ev.pointerId, ev.clientX, ev.clientY);
  };

  private readonly onWindowMove = (ev: PointerEvent): void => {
    if (!this.matchesActive(ev)) return;
    if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
      this.release();
      return;
    }
    this.move(ev.clientX, ev.clientY);
  };

  private readonly onWindowUp = (ev: PointerEvent): void => {
    const pendingIdx = this.pendingCanvasDowns.findIndex((item) => item.id === ev.pointerId);
    if (pendingIdx !== -1) this.pendingCanvasDowns.splice(pendingIdx, 1);
    if (this.matchesActive(ev)) this.release();
  };

  private readonly onBlur = (): void => {
    this.release();
  };

  private release(): void {
    this.pointerId = -1;
    this.pendingCanvasDowns.length = 0;
    this.svg.style.display = 'none';
    touchMove.x = touchMove.y = 0;
  }
}
