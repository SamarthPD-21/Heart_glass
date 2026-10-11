import { $ } from './dom';

const started = performance.now();

export function setLoaderProgress(p: number) {
  $('#loader-fill').style.width = `${Math.round(Math.min(1, p) * 100)}%`;
}

/** Hide the loader, but never before it has been visible for ~1 s (avoids a flash). */
export async function finishLoader() {
  setLoaderProgress(1);
  const wait = Math.max(0, 1000 - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  const el = $('#loader');
  el.classList.add('done');
  el.setAttribute('aria-busy', 'false');
  setTimeout(() => el.remove(), 1000);
}
