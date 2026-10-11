import { audio } from '../lib/audio';
import { $ } from './dom';

export function initSoundToggle() {
  const btn = $<HTMLButtonElement>('#sound');
  const label = btn.querySelector('.sound-label')!;
  const render = () => {
    label.textContent = audio.muted ? 'Sound off' : 'Sound on';
    btn.setAttribute('aria-pressed', String(!audio.muted));
    btn.classList.toggle('muted', audio.muted);
  };
  btn.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    render();
  });
  render();
}
