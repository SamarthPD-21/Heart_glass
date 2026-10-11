import type { HeartConfig } from '../lib/heartConfig';
import { $, show } from './dom';

/** Text only: every user-provided string goes through textContent, never innerHTML. */
export function showRecipient(cfg: HeartConfig | null, reducedMotion: boolean) {
  const home = location.pathname;
  $<HTMLAnchorElement>('#r-cta').href = home;
  show($('#recipient'));

  if (!cfg) {
    $('#r-msg').textContent = "This heart couldn't be found. The link may be incomplete.";
    return;
  }
  $('#r-to').textContent = cfg.to ? `For ${cfg.to}` : 'Someone made you a heart';
  $('#r-from').textContent = cfg.from ? `with love, ${cfg.from}` : '';

  const msg = cfg.msg ?? '';
  const el = $('#r-msg');
  if (reducedMotion || !msg) {
    el.textContent = msg;
    return;
  }
  el.setAttribute('aria-label', msg);
  let i = 0;
  const tick = () => {
    el.textContent = msg.slice(0, ++i);
    if (i < msg.length) setTimeout(tick, 32);
  };
  setTimeout(tick, 600);
}
