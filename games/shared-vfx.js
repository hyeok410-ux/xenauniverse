/* XENA Games premium VFX runtime — 2026-08-01. */
(function (global) {
  'use strict';
  var files = {
    impact:'signal-impact.png', buff:'neon-ascension.png', debuff:'signal-corruption.png',
    shatter:'data-shatter.png', summon:'signal-summon.png', affinity:'resonance-break.png',
    core:'core-overload.png', daily:'daily-signal-claim.png'
  };
  var base = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = (scripts[i].getAttribute('src') || '').split('?')[0];
      if (src.indexOf('shared-vfx.js') >= 0) return src.replace('shared-vfx.js', '_assets/vfx/');
    }
    return '../_assets/vfx/';
  }());
  var styleReady = false;
  function ensureStyle() {
    if (styleReady) return; styleReady = true;
    var style = document.createElement('style');
    style.textContent =
      '.xena-vfx-host{position:relative!important}.xena-vfx-layer{position:absolute;inset:-22%;z-index:90;pointer-events:none;overflow:visible;display:grid;place-items:center;isolation:isolate}'+
      '.xena-vfx-layer>img{width:100%;height:100%;object-fit:contain;mix-blend-mode:screen;filter:drop-shadow(0 0 12px rgba(63,224,255,.45));animation:xenaVfxResolve var(--xvfx-ms,720ms) cubic-bezier(.12,.72,.22,1) both}'+
      '.xena-vfx-layer[data-kind="shatter"]>img{animation-name:xenaVfxShatter}.xena-vfx-layer[data-kind="buff"]>img{animation-name:xenaVfxRise}.xena-vfx-layer[data-kind="debuff"]>img{animation-name:xenaVfxCorrupt}'+
      '@keyframes xenaVfxResolve{0%{opacity:0;transform:scale(.42) rotate(-5deg)}20%{opacity:1;transform:scale(1.03)}70%{opacity:.92}100%{opacity:0;transform:scale(1.24)}}'+
      '@keyframes xenaVfxRise{0%{opacity:0;transform:translateY(18%) scale(.56)}24%{opacity:1}100%{opacity:0;transform:translateY(-12%) scale(1.12)}}'+
      '@keyframes xenaVfxCorrupt{0%{opacity:0;transform:scaleX(.55)}22%{opacity:1;transform:scaleX(1.05)}55%{transform:translateX(-2%) skewX(3deg)}100%{opacity:0;transform:translateY(12%) scale(.92)}}'+
      '@keyframes xenaVfxShatter{0%{opacity:0;transform:scale(.75)}18%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.42) rotate(4deg)}}'+
      '@media(prefers-reduced-motion:reduce){.xena-vfx-layer>img{animation-duration:180ms!important}}';
    document.head.appendChild(style);
  }
  function resolveTarget(target) { return typeof target === 'string' ? document.querySelector(target) : target; }
  function play(target, kind, options) {
    target = resolveTarget(target); kind = files[kind] ? kind : 'impact'; options = options || {};
    if (!target) return Promise.resolve(false); ensureStyle(); target.classList.add('xena-vfx-host');
    var duration = Math.max(180, Number(options.duration) || (kind === 'core' ? 1050 : kind === 'shatter' ? 820 : 700));
    var layer = document.createElement('span'); layer.className = 'xena-vfx-layer'; layer.dataset.kind = kind;
    layer.style.setProperty('--xvfx-ms', duration + 'ms'); if (options.inset) layer.style.inset = options.inset;
    var img = document.createElement('img'); img.src = base + files[kind]; img.alt = ''; img.setAttribute('aria-hidden', 'true');
    layer.appendChild(img); target.appendChild(layer);
    return new Promise(function (resolve) { setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); resolve(true); }, duration + 60); });
  }
  function preload(kinds) { (kinds || Object.keys(files)).forEach(function (kind) { if (files[kind]) { var img = new Image(); img.src = base + files[kind]; } }); }
  global.XenaVfx = { play:play, preload:preload, files:Object.assign({}, files) };
}(window));
