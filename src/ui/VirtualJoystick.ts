import Phaser from 'phaser';
import { GAME_HEIGHT, HUD_SCALE } from '../config';
import { touchMove } from '../core/input';
import { getSettings } from '../core/settings';

const DEADZONE = 0.12;
/** 推到这个比例就算全速，手机上不用推到底 */
const FULL_AT = 0.6;
const BASE_R = 72;
const KNOB_R = 28;
const SVG_NS = 'http://www.w3.org/2000/svg';

type ActiveMode = 'none' | 'touch' | 'pointer';

function findTouch(list: TouchList, id: number): Touch | null {
  for (let i = 0; i < list.length; i++) {
    const t = list.item(i);
    if (t && t.identifier === id) return t;
  }
  return null;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function createJoystickOverlay(): { svg: SVGSVGElement; base: SVGGElement; knob: SVGGElement } {
  const svg = svgEl('svg', { width: '100%', height: '100%' });
  svg.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;z-index:20;display:none;';

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
 * - 触屏直接基于 window TouchEvent（Touch.identifier + ev.touches 实时触点表），
 *   彻底避免 Touch.identifier 与 PointerEvent.pointerId 混用错配，且在系统漏发 touchend/touchcancel 时自动自愈；
 * - 鼠标 / 手写笔由 window PointerEvent 接管；
 * - 按下时同步调用 Phaser 命中检测，点中暂停/冲刺等 UI 按钮时不触发摇杆。
 */
export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly svg: SVGSVGElement;
  private readonly base: SVGGElement;
  private readonly knob: SVGGElement;
  private activeMode: ActiveMode = 'none';
  private activeId = 0;
  private ox = 0;
  private oy = 0;
  private activeScale = 1;
  private enabled = true;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly radius = BASE_R * HUD_SCALE,
  ) {
    this.scene = scene;
    this.canvas = scene.game.canvas;
    const overlay = createJoystickOverlay();
    this.svg = overlay.svg;
    this.base = overlay.base;
    this.knob = overlay.knob;

    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onRelease);
    window.addEventListener('pagehide', this.onRelease);
    window.addEventListener('orientationchange', this.onRelease);
    window.addEventListener('contextmenu', this.onRelease);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    scene.events.on(Phaser.Scenes.Events.PAUSE, this.onRelease);
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.onRelease);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.release();
  }

  private cssScale(): number {
    const rectH = this.canvas.getBoundingClientRect().height || window.innerHeight || GAME_HEIGHT;
    return Math.max(0.45, (this.radius / BASE_R) * (rectH / GAME_HEIGHT));
  }

  private hitsInteractiveUI(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return false;
    }
    const input = this.scene.input;
    if (!this.scene.sys?.isActive() || !input?.isActive()) return false;
    const probe = {
      x: ((clientX - rect.left) / rect.width) * this.scene.scale.width,
      y: ((clientY - rect.top) / rect.height) * this.scene.scale.height,
      worldX: 0,
      worldY: 0,
      camera: null,
    } as unknown as Phaser.Input.Pointer;
    return input.hitTestPointer(probe).length > 0;
  }

  private start(mode: Exclude<ActiveMode, 'none'>, id: number, x: number, y: number): void {
    this.activeMode = mode;
    this.activeId = id;
    this.ox = x;
    this.oy = y;
    this.activeScale = this.cssScale();
    const tf = `translate(${x}, ${y}) scale(${this.activeScale})`;
    this.base.setAttribute('transform', tf);
    this.knob.setAttribute('transform', tf);
    this.svg.style.display = 'block';
    touchMove.active = true;
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

  private readonly onTouchStart = (ev: TouchEvent): void => {
    if (!this.enabled) {
      if (this.activeMode !== 'none') this.release();
      return;
    }
    // 实时校验当前追踪的触点是否仍在屏幕上：若系统漏发了 touchend/touchcancel，立即释放避免轮盘卡死
    if (this.activeMode === 'touch') {
      if (findTouch(ev.touches, this.activeId)) return;
      this.release();
    } else if (this.activeMode === 'pointer') {
      this.release();
    }

    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches.item(i);
      if (!t) continue;
      if (this.hitsInteractiveUI(t.clientX, t.clientY)) continue;
      this.start('touch', t.identifier, t.clientX, t.clientY);
      if (ev.target !== this.canvas && ev.cancelable) ev.preventDefault();
      return;
    }
  };

  private readonly onTouchMove = (ev: TouchEvent): void => {
    if (this.activeMode !== 'touch') return;
    if (!this.enabled) {
      this.release();
      return;
    }
    const active = findTouch(ev.touches, this.activeId);
    if (!active) {
      this.release();
      return;
    }
    if (ev.target !== this.canvas && ev.cancelable) ev.preventDefault();
    this.move(active.clientX, active.clientY);
  };

  private readonly onTouchEnd = (ev: TouchEvent): void => {
    if (this.activeMode !== 'touch') return;
    if (findTouch(ev.changedTouches, this.activeId) || !findTouch(ev.touches, this.activeId)) {
      this.release();
    }
  };

  private readonly onPointerDown = (ev: PointerEvent): void => {
    // 触屏设备统一由 TouchEvent 追踪（有 ev.touches 真值表可自愈）；仅无 TouchEvent 的环境回退到 PointerEvent
    if (ev.pointerType === 'touch' && 'ontouchstart' in window) return;
    if (ev.pointerType === 'mouse' && (ev.button !== 0 || touchMove.keyboardActive || getSettings().manualAim)) return;
    if (!this.enabled) return;
    if (this.activeMode === 'touch') return;
    if (this.activeMode === 'pointer') {
      if (ev.pointerType === 'mouse') this.release();
      else return;
    }
    if (this.hitsInteractiveUI(ev.clientX, ev.clientY)) return;
    this.start('pointer', ev.pointerId, ev.clientX, ev.clientY);
  };

  private readonly onPointerMove = (ev: PointerEvent): void => {
    if (this.activeMode !== 'pointer' || ev.pointerId !== this.activeId) return;
    if (!this.enabled || (ev.pointerType === 'mouse' && ((ev.buttons & 1) === 0 || touchMove.keyboardActive))) {
      this.release();
      return;
    }
    this.move(ev.clientX, ev.clientY);
  };

  private readonly onPointerUp = (ev: PointerEvent): void => {
    if (this.activeMode === 'pointer' && ev.pointerId === this.activeId) {
      this.release();
    }
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.release();
  };

  private readonly onRelease = (): void => {
    this.release();
  };

  private readonly destroy = (): void => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.release();
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.onRelease);
    window.removeEventListener('pagehide', this.onRelease);
    window.removeEventListener('orientationchange', this.onRelease);
    window.removeEventListener('contextmenu', this.onRelease);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.onRelease);
    this.scene.events.off(Phaser.Scenes.Events.SLEEP, this.onRelease);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy);
    this.svg.remove();
  };

  private release(): void {
    this.activeMode = 'none';
    this.activeId = 0;
    this.svg.style.display = 'none';
    touchMove.active = false;
    touchMove.x = touchMove.y = 0;
  }
}
