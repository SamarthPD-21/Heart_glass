import { $, show, toast } from './dom';

export function openShare(url: string, onClose: () => void) {
  const modal = $('#share');
  const input = $<HTMLInputElement>('#share-url');
  const nativeBtn = $<HTMLButtonElement>('#share-native');
  input.value = url;
  const text = encodeURIComponent('I made you something.');
  const u = encodeURIComponent(url);
  $<HTMLAnchorElement>('#share-whatsapp').href = `https://wa.me/?text=${text}%20${u}`;
  $<HTMLAnchorElement>('#share-x').href = `https://x.com/intent/post?text=${text}&url=${u}`;
  $<HTMLAnchorElement>('#share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  show(modal);
  show(nativeBtn, typeof navigator.share === 'function');
  $<HTMLButtonElement>('#share-copy').focus();

  const close = () => {
    show(modal, false);
    cleanup();
    onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      input.select();
      toast('Press Ctrl/Cmd + C to copy');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'A heart for you', text: 'I made you something.', url });
    } catch {
      /* user cancelled */
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  const copyBtn = $('#share-copy'), closeBtn = $('#share-close');
  copyBtn.addEventListener('click', copy);
  nativeBtn.addEventListener('click', share);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  function cleanup() {
    copyBtn.removeEventListener('click', copy);
    nativeBtn.removeEventListener('click', share);
    closeBtn.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey);
  }
}
