'use client';

import { useEffect, useRef } from 'react';
import { STORY } from '@/lib/story';

/**
 * React renders the static markup once; the three.js engine (plain TypeScript, client-only)
 * then drives it directly. Nothing here re-renders, so the two never fight over the DOM.
 */
export default function HeartglassApp() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    import('@/experience/boot').then(({ boot }) => boot());
  }, []);

  return (
    <>
      <div id="app" aria-hidden="true" />
      <div id="journey" aria-hidden="true" />

      <header className="topbar">
        <span className="logo">Heartglass</span>
        <div className="topbar-actions">
          <button id="skip" className="ghost hidden" type="button">Skip to the heart</button>
          <button id="sound" className="ghost sound" type="button" aria-pressed="false">
            <span className="eq" aria-hidden="true"><i /><i /><i /></span>
            <span className="sound-label">Sound off</span>
          </button>
        </div>
      </header>

      <div id="loader" className="loader" role="status" aria-live="polite" aria-busy="true">
        <svg className="loader-heart" viewBox="0 0 64 60" aria-hidden="true">
          <path d="M32 56C14 43 2 33 2 19 2 9 10 2 19 2c6 0 10 3 13 8 3-5 7-8 13-8 9 0 17 7 17 17 0 14-12 24-30 37z" />
        </svg>
        <p className="loader-text">finding the words…</p>
        <div className="loader-bar"><span id="loader-fill" /></div>
      </div>

      <section id="intro" className="intro hidden" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero">
          <span className="hero-word hero-left">Say</span>
          <span className="sr-only"> </span>
          <span className="hero-word hero-right">it</span>
        </h1>
        <div className="intro-cta">
          <p className="intro-kicker">Some words can&apos;t wait.</p>
          <button id="enter" className="primary" type="button">Begin the journey</button>
          <p className="intro-hint">or click the mirror</p>
        </div>
      </section>

      <div id="story" className="story" aria-live="polite">
        {STORY.map((l, i) => (
          <p
            key={i}
            className={`story-line${l.cta ? ' cta' : ''}`}
            data-start={l.start}
            data-peak={l.peak}
            data-end={l.end}
          >
            {l.text.split(' ').map((w, j) => (
              <span key={j} className="w">{w} </span>
            ))}
          </p>
        ))}
      </div>
      <div id="progress" className="progress hidden" aria-hidden="true"><span id="progress-fill" /></div>
      <p id="scroll-hint" className="scroll-hint hidden" aria-hidden="true">Scroll to explore</p>

      <aside id="customizer" className="panel hidden" aria-label="Customize your heart">
        <header className="panel-head">
          <h2>Make it yours</h2>
          <p className="panel-hint">Drag to turn it</p>
        </header>

        <div className="tabs" role="tablist" aria-label="Customize">
          {['material', 'color', 'frame', 'stickers', 'message'].map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              data-tab={t}
              aria-selected={i === 0}
              aria-controls={`panel-${t}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <section id="panel-material" role="tabpanel" aria-labelledby="tab-material" data-panel="material">
          <div className="row" id="materials">
            <button type="button" data-material="gold">Gold</button>
            <button type="button" data-material="glass">Glass</button>
            <button type="button" data-material="velvet">Velvet</button>
          </div>
        </section>

        <section id="panel-color" role="tabpanel" aria-labelledby="tab-color" data-panel="color" hidden>
          <div className="row swatches" id="colors" />
        </section>

        <section id="panel-frame" role="tabpanel" aria-labelledby="tab-frame" data-panel="frame" hidden>
          <div className="row" id="frames">
            <button type="button" data-frame="-1">None</button>
            <button type="button" data-frame="0">Ring</button>
            <button type="button" data-frame="1">Pearls</button>
          </div>
        </section>

        <section id="panel-stickers" role="tabpanel" aria-labelledby="tab-stickers" data-panel="stickers" hidden>
          <div className="row stickers" id="stickers" />
          <p className="note" id="sticker-note">Pick a sticker, then tap the heart to place it.</p>
          <div className="row">
            <button id="sticker-undo" type="button" className="ghost">Undo</button>
            <button id="sticker-clear" type="button" className="ghost">Clear all</button>
          </div>
        </section>

        <section id="panel-message" role="tabpanel" aria-labelledby="tab-message" data-panel="message" hidden>
          <label>To <input id="to" type="text" maxLength={30} autoComplete="off" /></label>
          <label>From <input id="from" type="text" maxLength={30} autoComplete="off" /></label>
          <label>Message <textarea id="msg" maxLength={140} rows={3} /></label>
          <p className="counter"><span id="msg-count">0</span>/140</p>
        </section>

        <footer className="panel-foot">
          <button id="randomize" type="button" className="ghost">Surprise me</button>
          <button id="create-link" type="button" className="primary">Finish &amp; share</button>
        </footer>
      </aside>

      <div id="share" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="modal-card">
          <h2 id="share-title">Your heart is ready</h2>
          <p>Send this link. They&apos;ll see exactly the heart you made.</p>
          <input id="share-url" type="text" readOnly aria-label="Share link" />
          <div className="row">
            <button id="share-copy" type="button" className="primary">Copy link</button>
            <button id="share-native" type="button" className="ghost">Share…</button>
          </div>
          <div className="row socials">
            <a id="share-whatsapp" className="ghost" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a id="share-x" className="ghost" target="_blank" rel="noopener noreferrer">X</a>
            <a id="share-linkedin" className="ghost" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
          <button id="share-close" type="button" className="link">Back to editing</button>
        </div>
      </div>

      <div id="recipient" className="recipient hidden" aria-live="polite">
        <p id="r-to" className="r-to" />
        <p id="r-msg" className="r-msg" />
        <p id="r-from" className="r-from" />
        <a id="r-cta" className="primary" href="/">Make one for someone</a>
      </div>

      <div id="toast" className="toast hidden" role="status" />
      <div id="fade" className="fade" aria-hidden="true" />
      <div id="sr-status" className="sr-only" aria-live="polite" />

      <div id="fallback" className="fallback hidden">
        <h1>Heartglass</h1>
        <p>Your browser can&apos;t show this 3D experience. Try a recent version of Chrome, Edge, Safari or Firefox.</p>
      </div>
    </>
  );
}
