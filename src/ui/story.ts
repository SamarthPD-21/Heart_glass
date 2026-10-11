import { smoothstep } from '../lib/random';
import { $ } from './dom';

interface Line { el: HTMLElement; words: HTMLElement[]; start: number; peak: number; end: number; shown: boolean }

/**
 * DOM story lines driven by scroll progress. Words arrive one after another (blur → sharp)
 * and leave together; onBeat fires once when a line's peak is passed going forward.
 */
export class Story {
  private lines: Line[];
  private last = 0;

  constructor(private onBeat: (index: number) => void) {
    this.lines = [...document.querySelectorAll<HTMLElement>('.story-line')].map((el) => ({
      el,
      words: [...el.querySelectorAll<HTMLElement>('.w')],
      start: Number(el.dataset.start),
      peak: Number(el.dataset.peak),
      end: Number(el.dataset.end),
      shown: false,
    }));
  }

  update(p: number, reducedMotion: boolean) {
    this.lines.forEach((l, i) => {
      const out = 1 - smoothstep(l.peak, l.end, p);
      const span = l.peak - l.start;
      const n = l.words.length;
      let visible = 0;
      l.words.forEach((w, j) => {
        // Each word gets its own slice of the way in
        const a = l.start + (span * 0.75 * j) / Math.max(1, n - 1);
        const o = smoothstep(a, a + span * 0.35, p) * out;
        visible = Math.max(visible, o);
        w.style.opacity = o.toFixed(3);
        if (!reducedMotion) {
          w.style.filter = o > 0.98 ? 'none' : `blur(${((1 - o) * 8).toFixed(1)}px)`;
          w.style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`;
        }
      });
      l.el.style.visibility = visible > 0.001 ? 'visible' : 'hidden';
      l.el.setAttribute('aria-hidden', visible < 0.5 ? 'true' : 'false');
      if (this.last < l.peak && p >= l.peak && !l.shown) {
        l.shown = true;
        this.onBeat(i);
      }
    });
    this.last = p;
    $('#progress-fill').style.width = `${(p * 100).toFixed(1)}%`;
  }

  hide() {
    $('#story').classList.add('hidden');
  }
}
