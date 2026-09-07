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
    watching: false,
    observedDocs: [],
  };

  var CONTAINER = '.beautiful-mermaid-confluence';

  function pendingSelector() {
    return CONTAINER + '[data-state="pending"]';
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

  // $body is inserted unescaped. <br> becomes a real HTML tag, and
  // textContent drops it without inserting a newline (source is also hidden,
  // so innerText is empty). Walk the DOM instead.
  function htmlSourceToText(node) {
    if (!node) return '';
    var type = node.nodeType;
    if (type === 3 || type === 4) {
      return String(node.nodeValue || '').replace(/\u00a0/g, ' ');
    }
    if (type !== 1) return '';
    var tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'SCRIPT' || tag === 'STYLE') return '';
    var parts = [];
    var child;
    for (child = node.firstChild; child; child = child.nextSibling) {
      parts.push(htmlSourceToText(child));
    }
    var text = parts.join('');
    if (
      tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'TR' ||
      tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' ||
      tag === 'H5' || tag === 'H6'
    ) {
      return text.replace(/\s+$/, '') + '\n';
    }
    return text;
  }

  // beautiful-mermaid splits the diagram on newlines before parsing nodes.
  // A label like A["foo\nbar"] becomes two broken lines, so the rest of the
  // quoted text is dropped. Fold those newlines back into <br>, which the
  // renderer already understands.
  function foldLabelNewlines(code) {
    var out = '';
    var inQuote = false;
    var square = 0;
    var round = 0;
    var curly = 0;
    var i;
    var c;

    function inLabel() {
      return inQuote || square > 0 || round > 0 || curly > 0;
    }

    for (i = 0; i < code.length; i++) {
      c = code.charAt(i);
      if (c === '"') {
        inQuote = !inQuote;
        out += c;
        continue;
      }
      if (!inQuote) {
        if (c === '[') square++;
        else if (c === ']' && square) square--;
        else if (c === '(') round++;
        else if (c === ')' && round) round--;
        else if (c === '{') curly++;
        else if (c === '}' && curly) curly--;
      }
      if (inLabel() && (c === '\n' || c === '\r')) {
        if (c === '\r' && code.charAt(i + 1) === '\n') i++;
        out += '<br>';
        while (i + 1 < code.length && (code.charAt(i + 1) === ' ' || code.charAt(i + 1) === '\t')) {
          i++;
        }
        continue;
      }
      out += c;
    }
    return out;
  }

  function readSource(el) {
    var source = el.querySelector('.bm-source');
    if (!source) return '';
    var raw = source.tagName === 'TEXTAREA' ? source.value : htmlSourceToText(source);
    return String(raw).replace(/^\s+|\s+$/g, '');
  }

  function normalizeSource(code) {
    return foldLabelNewlines(stripMermaidDirectives(code)).replace(/^\s+|\s+$/g, '');
  }

  function sourceForRender(el) {
    return normalizeSource(readSource(el));
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
    var code = normalizeSource(raw) || raw;
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

  function sameOriginDoc(iframe) {
    try {
      var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (!doc) return null;
      void doc.documentElement;
      return doc;
    } catch (err) {
      return null;
    }
  }

  function collectDocs(rootDoc, out, seen) {
    if (!rootDoc) return;
    var i;
    for (i = 0; i < seen.length; i++) {
      if (seen[i] === rootDoc) return;
    }
    seen.push(rootDoc);
    out.push(rootDoc);
    var iframes;
    try {
      iframes = rootDoc.querySelectorAll('iframe');
    } catch (err) {
      return;
    }
    for (i = 0; i < iframes.length; i++) {
      collectDocs(sameOriginDoc(iframes[i]), out, seen);
    }
  }

  function allDocs() {
    var out = [];
    collectDocs(document, out, []);
    return out;
  }

  function queryAllDocs(selector) {
    var docs = allDocs();
    var nodes = [];
    var i;
    var j;
    var found;
    for (i = 0; i < docs.length; i++) {
      try {
        found = docs[i].querySelectorAll(selector);
      } catch (err) {
        continue;
      }
      for (j = 0; j < found.length; j++) nodes.push(found[j]);
    }
    return nodes;
  }

  function scanAndRender() {
    NS.scanScheduled = false;

    var pending = queryAllDocs(pendingSelector());
    if (!pending.length) return;

    var seenDocs = [];
    pending.forEach(function (el) {
      var doc = el.ownerDocument;
      if (!doc) return;
      var i;
      for (i = 0; i < seenDocs.length; i++) {
        if (seenDocs[i] === doc) return;
      }
      seenDocs.push(doc);
      injectStyles(doc);
    });

    loadBundle()
      .then(function (BM) {
        var render = BM.renderMermaidSVG;
        pending.forEach(function (el) {
          renderNode(el, render);
        });
      })
      .catch(function (err) {
        queryAllDocs(pendingSelector() + ', ' + CONTAINER + '[data-state="rendering"]').forEach(
          function (el) {
            showError(
              el,
              'Failed to load renderer: ' +
                (err && err.message ? err.message : String(err))
            );
          }
        );
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

  function observeDoc(doc) {
    if (!doc || !global.MutationObserver) return;
    var list = NS.observedDocs;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] === doc) return;
    }
    var root = doc.documentElement || doc;
    if (!root) return;
    list.push(doc);
    new MutationObserver(onMutations).observe(root, {
      childList: true,
      subtree: true,
    });
  }

  function isEditorIframe(iframe) {
    var id = iframe.id || '';
    if (id === 'wysiwygTextarea_ifr') return true;
    var cls = typeof iframe.className === 'string' ? iframe.className : '';
    return cls.indexOf('tox-edit-area') !== -1;
  }

  function watchIframe(iframe) {
    if (!iframe || iframe.getAttribute('data-bm-watched') === '1') return;
    if (isEditorIframe(iframe)) return;
    iframe.setAttribute('data-bm-watched', '1');
    var bind = function () {
      var doc = sameOriginDoc(iframe);
      if (!doc) return;
      observeDoc(doc);
      var nested = doc.querySelectorAll('iframe');
      var i;
      for (i = 0; i < nested.length; i++) watchIframe(nested[i]);
      scheduleScan();
    };
    iframe.addEventListener('load', bind);
    bind();
  }

  function watchIframesIn(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'IFRAME') {
      watchIframe(node);
      return;
    }
    if (!node.querySelectorAll) return;
    var iframes = node.querySelectorAll('iframe');
    var i;
    for (i = 0; i < iframes.length; i++) watchIframe(iframes[i]);
  }

  function addedNodeNeedsScan(node) {
    if (!node || node.nodeType !== 1) return false;
    watchIframesIn(node);
    if (node.classList && node.classList.contains('beautiful-mermaid-confluence')) return true;
    return !!(node.querySelector && node.querySelector(CONTAINER));
  }

  function onMutations(records) {
    var i;
    var j;
    var added;
    var scanned = false;
    for (i = 0; i < records.length; i++) {
      added = records[i].addedNodes;
      for (j = 0; j < added.length; j++) {
        if (addedNodeNeedsScan(added[j])) scanned = true;
      }
    }
    if (scanned) scheduleScan();
  }

  function startWatch() {
    if (NS.watching) return;
    NS.watching = true;
    observeDoc(document);
    watchIframesIn(document.documentElement);
  }

  function bootstrap() {
    if (!NS.bootstrapped) {
      NS.bootstrapped = true;
      startWatch();
    }
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
