export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
};

export const show = (el: HTMLElement, on = true) => el.classList.toggle('hidden', !on);

export function announce(text: string) {
  $('#sr-status').textContent = text;
}

let toastTimer = 0;
export function toast(text: string) {
  const el = $('#toast');
  el.textContent = text;
  show(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => show(el, false), 2200);
}
