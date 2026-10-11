import { Experience, type Mode } from './Experience';
import { decodeHeart } from '../lib/heartConfig';
import { initSoundToggle } from '../ui/sound';
import { $, show } from '../ui/dom';

/** Client-only entry point, loaded by HeartglassApp after mount. */
export function boot() {
  const h = new URLSearchParams(location.search).get('h');
  const mode: Mode = h !== null ? { kind: 'recipient', config: decodeHeart(h) } : { kind: 'main' };

  initSoundToggle();

  new Experience(mode).init().catch((err) => {
    console.error(err);
    show($('#loader'), false);
    show($('#fallback'));
  });
}
