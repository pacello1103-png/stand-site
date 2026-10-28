/* ---------- try Stand: the real app in a frame, with three Bach scores already in it ---------- */
(() => {
  const PH = /iPhone|iPod/.test(navigator.userAgent) || (Math.min(screen.width, screen.height) < 500 && matchMedia('(pointer: coarse)').matches);
  const box = document.createElement('section');
  box.className = 'trybox' + (PH ? ' ph' : ''); box.id = 'trybox'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', U.tryTitle);
  box.innerHTML = `<div class="tbar"><b>Stand</b>
      <span class="tkind">${PH
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.6 5.2h2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="19" cy="12" r=".9" fill="currentColor"/></svg>'}${PH ? U.tryIphone : U.tryIpad}</span>
      <span class="thint">${PH ? U.tryHintPhone : U.tryHint}</span>
      <button class="tbtn" id="tryReset" aria-label="${U.tryReset}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${U.tryReset}</span></button>
      <button class="icon" id="tryClose" aria-label="${U.close}"><svg><use href="#i-x"/></svg></button></div>
    <div class="tstage"><div class="tdev"><div class="tscr"><iframe title="Stand" allow="microphone; camera; autoplay; fullscreen; clipboard-write"></iframe><div class="tload"><i></i></div></div></div></div>`;
  document.body.append(box);
  const frame = box.querySelector('iframe'), dev = box.querySelector('.tdev'), stage = box.querySelector('.tstage');
  let y = 0, pushed = false;
  /* an 11-inch iPad, the right way round for the window, as large as fits */
  const fit = () => {
    if (box.hidden || PH) return;
    const w = stage.clientWidth, h = stage.clientHeight, land = w >= h * 0.95;
    const W = land ? 1180 : 820, H = land ? 820 : 1180, B = 16;
    const k = Math.min(1, (w - 24) / (W + 2 * B), (h - 24) / (H + 2 * B));
    dev.style.width = W + 'px'; dev.style.height = H + 'px'; dev.style.transform = `translate(-50%, -50%) scale(${k})`;
  };
  addEventListener('resize', fit);
  const pauseAll = () => document.querySelectorAll('video.vid').forEach((v) => (typeof vidCheck === 'function' ? vidCheck(v) : v.pause()));
  const load = (reset) => { box.classList.add('loading'); frame.src = 'demo/index.html?lang=' + LANG + (reset ? '&again=' + Date.now() : ''); };
  frame.addEventListener('load', () => setTimeout(() => box.classList.remove('loading'), 600));
  function open(push = true) {
    if (!box.hidden) return;
    y = scrollY; document.body.style.top = -y + 'px'; document.body.classList.add('locked');
    box.hidden = false; fit(); load(false); pauseAll();
    requestAnimationFrame(() => box.classList.add('in'));
    if (push) { try { history.pushState({ stand: 'try' }, '', '#try'); pushed = true; } catch {} }
  }
  function shut() {
    if (box.hidden) return;
    box.classList.remove('in'); box.hidden = true; frame.src = 'about:blank';
    /* what was tried is not kept */
    setTimeout(() => { try { indexedDB.deleteDatabase('stand'); } catch {} }, 300);
    document.body.classList.remove('locked'); document.body.style.top = ''; scrollTo(0, y);
    pauseAll();
  }
  const ask = () => { if (pushed && history.state && history.state.stand === 'try') history.back(); else { shut(); try { history.replaceState(null, '', location.pathname + location.search); } catch {} } };
  document.getElementById('tryClose').addEventListener('click', ask);
  document.getElementById('tryReset').addEventListener('click', () => load(true));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) ask(); });
  addEventListener('popstate', () => { if (location.hash === '#try') open(false); else { pushed = false; shut(); } });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-try]'); if (!t) return; e.preventDefault(); e.stopPropagation(); open(); }, true);
  if (location.hash === '#try') open(false);
})();
