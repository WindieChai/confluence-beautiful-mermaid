/**
 * Inline fit + fullscreen lightbox for rendered diagrams.
 * Zoom/pan run only inside the overlay so wiki scrolling stays intact.
 */

var STYLE_ID = 'bm-confluence-styles';
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 8;
var Z_INDEX = 100000;

var lightbox = null;

var CSS_TEXT =
  '.beautiful-mermaid-confluence{position:relative;display:block;width:fit-content;max-width:100%;min-width:0}' +
  '.beautiful-mermaid-confluence .bm-source{display:none!important}' +
  '.beautiful-mermaid-confluence[data-state="error"]{width:100%;display:flex;flex-direction:column-reverse}' +
  '.beautiful-mermaid-confluence[data-state="error"] .bm-source{' +
    'display:block!important;margin:8px 0 0;padding:12px;white-space:pre-wrap;overflow:auto;' +
    'font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
    'background:#F4F5F7;border-radius:4px;color:#172B4D' +
  '}' +
  '.beautiful-mermaid-confluence[data-chrome="dark"][data-state="error"] .bm-source{' +
    'background:#27272A;color:#FAFAFA' +
  '}' +
  '.beautiful-mermaid-confluence .bm-render-target{padding:8px 0;color:#666;font-size:13px}' +
  '.beautiful-mermaid-confluence[data-chrome="dark"] .bm-render-target{color:#a1a1aa}' +
  '.beautiful-mermaid-confluence .bm-render-target svg{max-width:100%;height:auto;display:block}' +
  '.beautiful-mermaid-confluence .bm-error{' +
    'color:#c62828;white-space:pre-wrap;margin:0;padding:12px;' +
    'background:#ffebee;border-radius:4px;font-size:13px' +
  '}' +
  '.beautiful-mermaid-confluence .bm-fs-btn{' +
    'position:absolute;top:8px;right:8px;z-index:2;' +
    'width:32px;height:32px;padding:0;margin:0;border:0;border-radius:6px;' +
    'display:flex;align-items:center;justify-content:center;' +
    'background:rgba(255,255,255,.92);color:#172B4D;' +
    'box-shadow:0 1px 4px rgba(9,30,66,.25);cursor:pointer;' +
    'opacity:0;transition:opacity .15s ease,background .15s ease' +
  '}' +
  '.beautiful-mermaid-confluence[data-chrome="dark"] .bm-fs-btn{' +
    'background:rgba(24,24,27,.92);color:#FAFAFA' +
  '}' +
  '.beautiful-mermaid-confluence:hover .bm-fs-btn,' +
  '.beautiful-mermaid-confluence:focus-within .bm-fs-btn{opacity:1}' +
  '@media (hover:none){.beautiful-mermaid-confluence .bm-fs-btn{opacity:1}}' +
  '.beautiful-mermaid-confluence .bm-fs-btn:hover{background:#fff}' +
  '.beautiful-mermaid-confluence[data-chrome="dark"] .bm-fs-btn:hover{background:#27272A}' +
  '.beautiful-mermaid-confluence .bm-fs-btn:focus,' +
  '.beautiful-mermaid-confluence .bm-fs-btn:focus-visible{outline:none;box-shadow:none;opacity:1}' +
  'html.bm-lightbox-open,html.bm-lightbox-open body{overflow:hidden!important}' +
  '.bm-lightbox{' +
    'position:fixed;top:0;right:0;bottom:0;left:0;z-index:' + Z_INDEX + ';' +
    'background:#fff' +
  '}' +
  '.bm-lightbox-bar{' +
    'position:absolute;top:0;left:0;right:0;z-index:2;' +
    'display:flex;align-items:center;justify-content:flex-end;' +
    'padding:8px 12px;color:#172B4D;' +
    'font:13px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
    'pointer-events:none;' +
    'background:rgba(223,225,230,.9)' +
  '}' +
  '.bm-lightbox-hint{margin-right:auto;opacity:.78}' +
  '.bm-lightbox-zoom{margin-right:12px;font-variant-numeric:tabular-nums;opacity:.85}' +
  '.bm-lightbox-close{' +
    'pointer-events:auto;width:32px;height:32px;padding:0;border:0;border-radius:6px;' +
    'background:transparent;color:#172B4D;font-size:22px;line-height:1;cursor:pointer' +
  '}' +
  '.bm-lightbox-close:hover{background:rgba(9,30,66,.08)}' +
  '.bm-lightbox-close:focus,' +
  '.bm-lightbox-close:focus-visible{outline:none;box-shadow:none}' +
  '.bm-lightbox-stage{' +
    'position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;' +
    'overflow:auto;cursor:grab;-webkit-user-select:none;user-select:none' +
  '}' +
  '.bm-lightbox-stage.bm-panning{cursor:grabbing}' +
  '.bm-lightbox-canvas{display:inline-block;line-height:0}' +
  '.bm-lightbox-canvas svg{display:block;max-width:none;height:auto}';

export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  (document.head || document.documentElement).appendChild(style);
}

function getSvgNaturalSize(svgEl) {
  var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { w: vb.width, h: vb.height };
  }
  var w = parseFloat(svgEl.getAttribute('width')) || svgEl.getBoundingClientRect().width || 400;
  var h = parseFloat(svgEl.getAttribute('height')) || svgEl.getBoundingClientRect().height || 300;
  return { w: w, h: h };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readCssVar(el, name) {
  if (!el) return '';
  if (el.style && el.style.getPropertyValue) {
    var direct = el.style.getPropertyValue(name);
    if (direct) return String(direct).replace(/^\s+|\s+$/g, '');
  }
  var raw = el.getAttribute && el.getAttribute('style');
  if (!raw) return '';
  var escaped = name.replace(/-/g, '\\-');
  var match = raw.match(new RegExp('(?:^|;)\\s*' + escaped + '\\s*:\\s*([^;]+)'));
  return match ? match[1].replace(/^\s+|\s+$/g, '') : '';
}

function isDarkHex(color) {
  var hex = String(color || '').replace(/\s/g, '');
  var m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return false;
  var h = m[1];
  if (h.length === 3) {
    h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  }
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

function applyChrome(el, svg) {
  el.dataset.chrome = isDarkHex(readCssVar(svg, '--bg')) ? 'dark' : 'light';
}

function expandIcon() {
  return (
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M2 2h5v2H4v3H2V2zm7 0h5v5h-2V4H9V2zM2 9h2v3h3v2H2V9zm10 0h2v5H9v-2h3V9z"/>' +
    '</svg>'
  );
}

export function enhanceDiagram(el) {
  if (!el || el.querySelector('.bm-fs-btn')) return;
  var svg = el.querySelector('.bm-render-target svg');
  if (!svg) return;

  applyChrome(el, svg);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bm-fs-btn';
  btn.setAttribute('aria-label', 'View diagram fullscreen');
  btn.setAttribute('title', 'Fullscreen');
  btn.innerHTML = expandIcon();
  btn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    openLightbox(el, svg, btn);
  });
  el.appendChild(btn);
}

function openLightbox(el, sourceSvg, trigger) {
  closeLightbox();

  var nat = getSvgNaturalSize(sourceSvg);
  var overlay = document.createElement('div');
  overlay.className = 'bm-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Fullscreen diagram');

  overlay.innerHTML =
    '<div class="bm-lightbox-bar">' +
      '<span class="bm-lightbox-hint">Scroll to zoom · Drag to pan · Double-click to reset</span>' +
      '<span class="bm-lightbox-zoom" aria-live="polite">100%</span>' +
      '<button type="button" class="bm-lightbox-close" aria-label="Close fullscreen">×</button>' +
    '</div>' +
    '<div class="bm-lightbox-stage">' +
      '<div class="bm-lightbox-canvas"></div>' +
    '</div>';

  var stage = overlay.querySelector('.bm-lightbox-stage');
  var canvas = overlay.querySelector('.bm-lightbox-canvas');
  var zoomLabel = overlay.querySelector('.bm-lightbox-zoom');
  var closeBtn = overlay.querySelector('.bm-lightbox-close');
  var clone = sourceSvg.cloneNode(true);
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.style.maxWidth = 'none';
  var themeBg = readCssVar(sourceSvg, '--bg') || '#fff';
  overlay.style.background = themeBg;
  canvas.style.background = themeBg;
  canvas.appendChild(clone);

  var state = {
    zoom: 1,
    fitZoom: 1,
    nat: nat,
    pan: null,
    padX: 0,
    padY: 0,
  };

  function applyZoom(next) {
    state.zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    clone.style.width = state.nat.w * state.zoom + 'px';
    clone.style.height = state.nat.h * state.zoom + 'px';
    zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
    centerIfNeeded();
  }

  function centerIfNeeded() {
    state.padX = Math.max(0, (stage.clientWidth - state.nat.w * state.zoom) / 2);
    state.padY = Math.max(0, (stage.clientHeight - state.nat.h * state.zoom) / 2);
    canvas.style.paddingLeft = state.padX + 'px';
    canvas.style.paddingRight = state.padX + 'px';
    canvas.style.paddingTop = state.padY + 'px';
    canvas.style.paddingBottom = state.padY + 'px';
  }

  function fitZoom() {
    var fit = Math.min(stage.clientWidth / state.nat.w, stage.clientHeight / state.nat.h);
    if (!isFinite(fit) || fit <= 0) fit = 1;
    state.fitZoom = Math.min(1, fit);
    applyZoom(state.fitZoom);
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
  }

  function onWheel(event) {
    event.preventDefault();
    var dy = event.deltaY;
    if (event.deltaMode === 1) dy *= 16;
    if (event.deltaMode === 2) dy *= stage.clientHeight;
    var factor = Math.exp(-dy * 0.002);
    var oldZoom = state.zoom;
    var next = clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (next === oldZoom) return;

    var rect = stage.getBoundingClientRect();
    var ox = event.clientX - rect.left;
    var oy = event.clientY - rect.top;
    var contentX = (stage.scrollLeft + ox - state.padX) / oldZoom;
    var contentY = (stage.scrollTop + oy - state.padY) / oldZoom;

    applyZoom(next);

    stage.scrollLeft = contentX * state.zoom + state.padX - ox;
    stage.scrollTop = contentY * state.zoom + state.padY - oy;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (event.target.closest && event.target.closest('button')) return;
    event.preventDefault();
    state.pan = {
      x: event.clientX,
      y: event.clientY,
      sl: stage.scrollLeft,
      st: stage.scrollTop,
      id: event.pointerId,
    };
    stage.classList.add('bm-panning');
    if (stage.setPointerCapture && event.pointerId != null) {
      try { stage.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function onPointerMove(event) {
    if (!state.pan) return;
    stage.scrollLeft = state.pan.sl - (event.clientX - state.pan.x);
    stage.scrollTop = state.pan.st - (event.clientY - state.pan.y);
  }

  function onPointerUp() {
    if (!state.pan) return;
    state.pan = null;
    stage.classList.remove('bm-panning');
  }

  function onDblClick(event) {
    if (event.target.closest && event.target.closest('button')) return;
    event.preventDefault();
    fitZoom();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      event.preventDefault();
      closeLightbox();
    }
  }

  function onResize() {
    var previousFit = state.fitZoom;
    var wasFit = Math.abs(state.zoom - previousFit) < 0.01;
    var fit = Math.min(stage.clientWidth / state.nat.w, stage.clientHeight / state.nat.h);
    if (!isFinite(fit) || fit <= 0) fit = 1;
    state.fitZoom = Math.min(1, fit);
    if (wasFit) applyZoom(state.fitZoom);
    else centerIfNeeded();
  }

  closeBtn.addEventListener('click', closeLightbox);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('dblclick', onDblClick);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  document.documentElement.classList.add('bm-lightbox-open');
  document.body.appendChild(overlay);

  lightbox = {
    overlay: overlay,
    trigger: trigger,
    cleanup: function () {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      document.documentElement.classList.remove('bm-lightbox-open');
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (trigger && trigger.focus) trigger.focus();
    },
  };

  // Layout after attach so clientWidth is real.
  fitZoom();
  closeBtn.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.cleanup();
  lightbox = null;
}
