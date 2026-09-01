/**
 * Confluence Beautiful Mermaid — init script
 *
 * Loaded once per page (idempotent). Dynamically loads the beautiful-mermaid
 * bundle, then scans for unrendered `.bm-mermaid-diagram` nodes.
 *
 * Configure BUNDLE_URL before hosting on your internal static server.
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  // Replace with your internal static server base URL (no trailing slash).
  // Example: https://static.example.com/confluence-beautiful-mermaid
  var BASE_URL = global.__bmConfluenceBaseUrl || '';

  var BUNDLE_URL = BASE_URL
    ? BASE_URL + '/beautiful-mermaid.bundle.js?v=' + VERSION
    : '';

  var NS = global.__bmConfluence = global.__bmConfluence || {
    bootstrapped: false,
    bootstrapping: null,
    scanScheduled: false,
  };

  function getBundleUrl() {
    if (BUNDLE_URL) return BUNDLE_URL;

    // Fallback: resolve relative to this script's location.
    var current = document.currentScript;
    if (current && current.src) {
      return current.src.replace(/mermaid-init\.js.*$/, 'beautiful-mermaid.bundle.js?v=' + VERSION);
    }

    throw new Error(
      'confluence-beautiful-mermaid: set window.__bmConfluenceBaseUrl or host init.js next to the bundle'
    );
  }

  function loadBundle() {
    if (global.BeautifulMermaid) {
      return Promise.resolve(global.BeautifulMermaid);
    }

    if (NS.bootstrapping) {
      return NS.bootstrapping;
    }

    var bundleUrl = getBundleUrl();

    NS.bootstrapping = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bm-bundle]');
      if (existing) {
        if (global.BeautifulMermaid) {
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
        if (!global.BeautifulMermaid) {
          reject(new Error('beautiful-mermaid bundle loaded but BeautifulMermaid is undefined'));
          return;
        }
        resolve(global.BeautifulMermaid);
      };
      script.onerror = function () {
        reject(new Error('Failed to load beautiful-mermaid bundle from ' + bundleUrl));
      };
      document.head.appendChild(script);
    });

    return NS.bootstrapping;
  }

  function renderNode(el, render) {
    if (el.dataset.state !== 'pending') return;

    el.dataset.state = 'rendering';

    var target = el.querySelector('.bm-render-target');
    var source = el.querySelector('.bm-source');

    if (!source || !target) {
      el.dataset.state = 'error';
      return;
    }

    var theme = el.dataset.theme || 'light';
    var colors = theme === 'dark'
      ? { bg: '#18181B', fg: '#FAFAFA', transparent: true }
      : { bg: '#FFFFFF', fg: '#172B4D', transparent: true };

    try {
      var svg = render(source.textContent, colors);
      target.innerHTML = svg;

      var svgEl = target.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('role', 'img');
        svgEl.setAttribute('aria-label', 'Mermaid diagram');
      }

      el.dataset.state = 'rendered';
    } catch (err) {
      target.innerHTML =
        '<pre class="bm-error" style="color:#c62828;white-space:pre-wrap;margin:0;padding:12px;background:#ffebee;border-radius:4px;">' +
        'Mermaid syntax error: ' +
        (err && err.message ? err.message : String(err)) +
        '</pre>';
      el.dataset.state = 'error';
    }
  }

  function scanAndRender() {
    NS.scanScheduled = false;

    var pending = document.querySelectorAll('.bm-mermaid-diagram[data-state="pending"]');
    if (!pending.length) return;

    loadBundle()
      .then(function (BM) {
        var render = BM.renderMermaidSVG;
        pending.forEach(function (el) {
          renderNode(el, render);
        });
      })
      .catch(function (err) {
        document
          .querySelectorAll(
            '.bm-mermaid-diagram[data-state="pending"], .bm-mermaid-diagram[data-state="rendering"]'
          )
          .forEach(function (el) {
            var target = el.querySelector('.bm-render-target');
            if (target) {
              target.innerHTML =
                '<pre class="bm-error" style="color:#c62828;white-space:pre-wrap;margin:0;padding:12px;background:#ffebee;border-radius:4px;">' +
                'Failed to load renderer: ' +
                (err && err.message ? err.message : String(err)) +
                '</pre>';
            }
            el.dataset.state = 'error';
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
