import {
  DEFAULT_HEART, SWATCHES, STICKER_IDS, MAX_STICKERS, randomHeart,
  type HeartConfig, type MaterialId, type Sticker, type StickerId,
} from '../lib/heartConfig';
import { drawSticker, STICKER_LABELS } from '../lib/stickers';
import { $, show, toast } from './dom';

type ChangeKind = 'look' | 'text' | 'sticker';

/** Tabbed DOM panel ↔ HeartConfig. The 3D side listens through the callbacks. */
export class Customizer {
  config: HeartConfig = { ...DEFAULT_HEART };
  /** Sticker waiting to be placed with a tap on the heart, or null. */
  armed: StickerId | null = null;
  private panel = $('#customizer');

  constructor(
    private onChange: (cfg: HeartConfig, kind: ChangeKind) => void,
    private onCreateLink: (cfg: HeartConfig) => void,
    private onTab: (tab: string) => void,
  ) {
    const colors = $('#colors');
    for (const c of SWATCHES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.color = c;
      b.style.background = c;
      b.setAttribute('aria-label', `Color ${c}`);
      colors.appendChild(b);
    }

    const stickers = $('#stickers');
    for (const id of STICKER_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.sticker = id;
      b.setAttribute('aria-label', STICKER_LABELS[id]);
      b.setAttribute('aria-pressed', 'false');
      const img = document.createElement('img');
      img.alt = '';
      img.src = drawSticker(id, 96).toDataURL();
      b.appendChild(img);
      stickers.appendChild(b);
    }

    this.panel.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.tab) this.selectTab(b.dataset.tab);
      else if (b.dataset.material) this.set({ m: b.dataset.material as MaterialId });
      else if (b.dataset.color) this.set({ c: b.dataset.color });
      else if (b.dataset.frame !== undefined) this.set({ f: Number(b.dataset.frame) });
      else if (b.dataset.sticker) this.arm(b.dataset.sticker as StickerId);
    });

    // Arrow keys move between tabs (WAI-ARIA tabs pattern)
    $('.tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = [...this.panel.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      this.selectTab(next.dataset.tab!);
    });

    const to = $<HTMLInputElement>('#to'), from = $<HTMLInputElement>('#from'), msg = $<HTMLTextAreaElement>('#msg');
    const onText = () => {
      $('#msg-count').textContent = String(msg.value.length);
      this.config = { ...this.config, to: to.value, from: from.value, msg: msg.value };
      this.onChange(this.config, 'text');
    };
    [to, from, msg].forEach((el) => el.addEventListener('input', onText));

    $('#sticker-undo').addEventListener('click', () => {
      const st = this.config.st ?? [];
      if (st.length) this.set({ st: st.slice(0, -1) }, 'sticker');
    });
    $('#sticker-clear').addEventListener('click', () => this.set({ st: [] }, 'sticker'));
    $('#randomize').addEventListener('click', () => this.set(randomHeart(this.config)));
    $('#create-link').addEventListener('click', () => this.onCreateLink(this.config));

    this.render();
  }

  selectTab(tab: string) {
    this.panel.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    this.panel.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab !== 'stickers') this.arm(null);
    this.onTab(tab);
  }

  private arm(id: StickerId | null) {
    this.armed = this.armed === id ? null : id;
    this.panel.querySelectorAll<HTMLButtonElement>('[data-sticker]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.sticker === this.armed)),
    );
    document.body.classList.toggle('placing', this.armed !== null);
    $('#sticker-note').textContent = this.armed
      ? 'Now tap the heart where it should go.'
      : 'Pick a sticker, then tap the heart to place it.';
  }

  /** Called by the 3D side when a tap hits the heart while a sticker is armed. */
  addSticker(st: Sticker) {
    const list = this.config.st ?? [];
    if (list.length >= MAX_STICKERS) {
      toast(`Up to ${MAX_STICKERS} stickers`);
      return;
    }
    this.set({ st: [...list, st] }, 'sticker');
  }

  private set(patch: Partial<HeartConfig>, kind: ChangeKind = 'look') {
    this.config = { ...this.config, ...patch };
    this.render();
    this.onChange(this.config, kind);
  }

  private render() {
    const press = (sel: string, attr: string, value: string) =>
      this.panel.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
    press('[data-material]', 'material', this.config.m);
    press('[data-color]', 'color', this.config.c);
    press('[data-frame]', 'frame', String(this.config.f));
    const n = this.config.st?.length ?? 0;
    $<HTMLButtonElement>('#sticker-undo').disabled = n === 0;
    $<HTMLButtonElement>('#sticker-clear').disabled = n === 0;
  }

  open() {
    show(this.panel);
    this.selectTab('material');
    this.panel.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  }

  close() {
    show(this.panel, false);
  }
}
