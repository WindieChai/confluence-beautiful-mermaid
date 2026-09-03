/**
 * Confluence Beautiful Mermaid — init script
 *
 * Loaded globally via Custom HTML. Only injects beautiful-mermaid.bundle.js
 * when the page contains `.beautiful-mermaid-confluence` and the bundle is
 * not already mounted.
 *
 * Requires window.beautifulMermaidBundleUrl (full URL of the bundle).
 * Do not put <script> tags in the User Macro — they split the editor.
 */
import { injectStyles, enhanceDiagram } from './viewer.js';

(function (global) {
  'use strict';

  var NS = global.__bmConfluence = global.__bmConfluence || {
    bootstrapped: false,
    bootstrapping: null,
    scanScheduled: false,
  };

  var CONTAINER = '.beautiful-mermaid-confluence';

  function contentRoot() {
    return document.getElementById('main-content')
      || document.querySelector('.wiki-content')
      || document.getElementById('content')
      || document;
  }

  function hasContainer() {
    return !!contentRoot().querySelector(CONTAINER);
  }

  function mermaidReady() {
    return !!global.BeautifulMermaid;
  }

  // mermaid.live paste includes %%{init:...}%%; beautiful-mermaid rejects it.
  function stripMermaidDirectives(code) {
    return String(code).replace(/%%\{[\s\S]*?\}%%/g, '');
  }

  function copyPalette(palette) {
    var colors = {};
    var key;
    for (key in palette) {
      if (Object.prototype.hasOwnProperty.call(palette, key)) colors[key] = palette[key];
    }
    return colors;
  }

  function colorsForTheme(BM, rawName) {
    var name = String(rawName || 'default').replace(/^\s+|\s+$/g, '');
    var themes = (BM && BM.THEMES) || {};
    var defaults = (BM && BM.DEFAULTS) || { bg: '#FFFFFF', fg: '#27272A' };
    if (!name || name === 'default') return copyPalette(defaults);
    return copyPalette(themes[name] || defaults);
  }

  function readSource(el) {
    var source = el.querySelector('.bm-source');
    if (!source) return '';
    var raw = source.tagName === 'TEXTAREA' ? source.value : (source.textContent || '');
    return String(raw).replace(/^\s+|\s+$/g, '');
  }

  function sourceForRender(el) {
    return stripMermaidDirectives(readSource(el)).replace(/^\s+|\s+$/g, '');
  }

  // Custom HTML / leftover template nodes never go through Velocity, so the
  // source is the literal "$body". Ignore those; do not feed them to Mermaid.
  function isPlaceholderSource(code) {
    return /^\$\{?body\}?$/i.test(code);
  }

  function getBundleUrl() {
    var url = global.beautifulMermaidBundleUrl;
    if (url) return url;

    throw new Error(
      'confluence-beautiful-mermaid: set window.beautifulMermaidBundleUrl in Custom HTML'
    );
  }

  function loadBundle() {
    if (mermaidReady()) {
      return Promise.resolve(global.BeautifulMermaid);
    }

    if (NS.bootstrapping) {
      return NS.bootstrapping;
    }

    var bundleUrl;
    try {
      bundleUrl = getBundleUrl();
    } catch (err) {
      return Promise.reject(err);
    }

    NS.bootstrapping = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bm-bundle]');
      if (existing) {
        if (mermaidReady()) {
          resolve(global.BeautifulMermaid);
          return;
        }
        existing.addEventListener('load', function () {
          resolve(global.BeautifulMermaid);
        });
        existing.addEventListener('error', function () {
          reject(new Error('Failed to load beautiful-mermaid bundle'));
        });
        return;
      }

      var script = document.createElement('script');
      script.src = bundleUrl;
      script.async = true;
      script.setAttribute('data-bm-bundle', '1');
      script.onload = function () {
        if (!mermaidReady()) {
          reject(new Error('beautiful-mermaid bundle loaded but BeautifulMermaid is undefined'));
          return;
        }
        resolve(global.BeautifulMermaid);
      };
      script.onerror = function () {
        reject(new Error('Failed to load beautiful-mermaid bundle from ' + bundleUrl));
      };
      (document.body || document.head).appendChild(script);
    });

    return NS.bootstrapping;
  }

  function revealSourceOnError(el) {
    var raw = readSource(el);
    if (!raw || isPlaceholderSource(raw)) return;
    var code = stripMermaidDirectives(raw).replace(/^\s+|\s+$/g, '') || raw;
    var source = el.querySelector('.bm-source');
    if (!source) return;
    source.textContent = code;
    source.removeAttribute('hidden');
    source.style.removeProperty('display');
  }

  function showError(el, message) {
    if (isPlaceholderSource(readSource(el))) {
      el.dataset.state = 'skipped';
      var skipTarget = el.querySelector('.bm-render-target');
      if (skipTarget) skipTarget.innerHTML = '';
      el.style.display = 'none';
      return;
    }

    var target = el.querySelector('.bm-render-target');
    if (target) {
      target.innerHTML = '<pre class="bm-error">' + message + '</pre>';
    }
    revealSourceOnError(el);
    el.dataset.state = 'error';
  }

  function renderNode(el, render) {
    if (el.dataset.state !== 'pending') return;

    el.dataset.state = 'rendering';

    var target = el.querySelector('.bm-render-target');
    var raw = readSource(el);

    if (!target || !raw) {
      revealSourceOnError(el);
      el.dataset.state = 'error';
      return;
    }

    if (isPlaceholderSource(raw)) {
      el.dataset.state = 'skipped';
      target.innerHTML = '';
      el.style.display = 'none';
      return;
    }

    var code = sourceForRender(el);
    if (!code) {
      showError(el, 'Mermaid syntax error: empty diagram');
      return;
    }

    var colors = colorsForTheme(global.BeautifulMermaid, el.dataset.theme);

    try {
      var svg = render(code, colors);
      target.innerHTML = svg;

      var svgEl = target.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('role', 'img');
        svgEl.setAttribute('aria-label', 'Mermaid diagram');
        enhanceDiagram(el);
      }

      el.dataset.state = 'rendered';
    } catch (err) {
      showError(
        el,
        'Mermaid syntax error: ' + (err && err.message ? err.message : String(err))
      );
    }
  }

  function scanAndRender() {
    NS.scanScheduled = false;

    if (!hasContainer()) return;

    var pending = contentRoot().querySelectorAll(CONTAINER + '[data-state="pending"]');
    if (!pending.length) return;

    loadBundle()
      .then(function (BM) {
        var render = BM.renderMermaidSVG;
        pending.forEach(function (el) {
          renderNode(el, render);
        });
      })
      .catch(function (err) {
        contentRoot()
          .querySelectorAll(
            CONTAINER + '[data-state="pending"], ' + CONTAINER + '[data-state="rendering"]'
          )
          .forEach(function (el) {
            showError(
              el,
              'Failed to load renderer: ' +
                (err && err.message ? err.message : String(err))
            );
          });
      });
  }

  function scheduleScan() {
    if (NS.scanScheduled) return;
    NS.scanScheduled = true;

    var raf = global.requestAnimationFrame || function (fn) {
      setTimeout(fn, 0);
    };
    raf(scanAndRender);
  }

  function bootstrap() {
    if (!hasContainer()) return;

    injectStyles();

    if (NS.bootstrapped) {
      scheduleScan();
      return;
    }
    NS.bootstrapped = true;
    scheduleScan();
  }

  if (global.AJS && global.AJS.toInit) {
    global.AJS.toInit(bootstrap);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
