/* XENA Games mobile battlefield pan + pinch zoom controller. */
(function (global) {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function attach(options) {
    var viewport = document.querySelector(options.viewport);
    var stage = document.querySelector(options.stage);
    var target = document.querySelector(options.target);
    if (!viewport || !stage || !target || viewport.dataset.battleViewReady === '1') return null;

    var min = Number(options.min) || .62;
    var max = Number(options.max) || 1.35;
    var scale = clamp(Number(options.initial) || .82, min, max);
    var pointers = new Map();
    var lastPoint = null;
    var pinchDistance = 0;
    var pinchScale = scale;

    function measure() {
      target.style.transform = 'scale(' + scale + ')';
      stage.style.width = Math.ceil(target.scrollWidth * scale) + 'px';
      stage.style.height = Math.ceil(target.scrollHeight * scale) + 'px';
      viewport.style.setProperty('--battle-scale', scale.toFixed(2));
      var label = viewport.parentElement && viewport.parentElement.querySelector('[data-zoom-label]');
      if (label) label.textContent = Math.round(scale * 100) + '%';
    }

    function setScale(next, centerX, centerY) {
      next = clamp(next, min, max);
      var rect = viewport.getBoundingClientRect();
      var cx = centerX == null ? rect.left + rect.width / 2 : centerX;
      var cy = centerY == null ? rect.top + rect.height / 2 : centerY;
      var contentX = (viewport.scrollLeft + cx - rect.left) / scale;
      var contentY = (viewport.scrollTop + cy - rect.top) / scale;
      scale = next;
      measure();
      viewport.scrollLeft = contentX * scale - (cx - rect.left);
      viewport.scrollTop = contentY * scale - (cy - rect.top);
    }

    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
      if (pointers.size === 1) lastPoint = { x: event.clientX, y: event.clientY };
      if (pointers.size === 2) {
        var pair = Array.from(pointers.values());
        pinchDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        pinchScale = scale;
      }
    });
    viewport.addEventListener('pointermove', function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        event.preventDefault();
        var pair = Array.from(pointers.values());
        var distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        var centerX = (pair[0].x + pair[1].x) / 2;
        var centerY = (pair[0].y + pair[1].y) / 2;
        if (pinchDistance > 0) setScale(pinchScale * distance / pinchDistance, centerX, centerY);
      } else if (pointers.size === 1 && lastPoint) {
        var dx = event.clientX - lastPoint.x;
        var dy = event.clientY - lastPoint.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) {
          event.preventDefault();
          viewport.scrollLeft -= dx;
          viewport.scrollTop -= dy;
        }
        lastPoint = { x: event.clientX, y: event.clientY };
      }
    }, { passive: false });
    function release(event) {
      pointers.delete(event.pointerId);
      lastPoint = pointers.size === 1 ? Array.from(pointers.values())[0] : null;
      if (pointers.size < 2) pinchDistance = 0;
    }
    viewport.addEventListener('pointerup', release);
    viewport.addEventListener('pointercancel', release);

    var controls = viewport.parentElement && viewport.parentElement.querySelector('[data-battle-zoom-controls]');
    if (controls) controls.addEventListener('click', function (event) {
      var button = event.target.closest('[data-zoom-step]');
      if (!button) return;
      setScale(scale + Number(button.dataset.zoomStep || 0));
    });
    var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(target);
    viewport.dataset.battleViewReady = '1';
    measure();
    return { setScale: setScale, measure: measure, destroy: function () { if (observer) observer.disconnect(); } };
  }

  global.XenaBattleView = { attach: attach };
}(window));
