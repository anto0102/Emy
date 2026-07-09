(function () {
  'use strict';

  if (window.__emy_injected) {
    refreshMarker();
    return;
  }
  window.__emy_injected = true;

  var SCRIPTLET_VERSION = '2.1.1';
  var LOG_PREFIX = '[Emy]';
  var stats = { jsonStripped: 0, fetchBlocked: 0, xhrBlocked: 0, adsSkipped: 0, overlaysRemoved: 0 };

  function log(msg) { try { console.log(LOG_PREFIX, msg); } catch (e) {} }
  log('Scriptlet v' + SCRIPTLET_VERSION + ' initialized');

  // 1) JSON.parse hook — strip ad keys
  var AD_KEYS = [
    'adPlacements', 'playerAds', 'adSlots', 'adBreakParams',
    'adBreakHeartbeatParams', 'instreamAdBreak', 'bannerPromo',
    'sparklesWebInterstitial', 'promotedSparklesWebRenderer',
    'enforcementMessage', 'advertiserVideoRenderer',
    'actionCompanionAdRenderer', 'adPlacementRenderer',
    'promotedSparklesTextSearchRenderer', 'playerLegacyDesktopWatchAdsRenderer',
    'adLayoutMetadata', 'linearAdSequenceRenderer'
  ];

  var _origParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    var result = _origParse.call(this, text, reviver);
    if (result && typeof result === 'object' && deepClean(result)) stats.jsonStripped++;
    return result;
  };
  try { JSON.parse.toString = function () { return 'function parse() { [native code] }'; } } catch (e) {}

  function deepClean(obj, depth) {
    if (!obj || typeof obj !== 'object' || (depth || 0) > 15) return false;
    var cleaned = false, d = (depth || 0) + 1;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++)
        if (obj[i] && typeof obj[i] === 'object' && deepClean(obj[i], d)) cleaned = true;
      return cleaned;
    }
    for (var k = 0; k < AD_KEYS.length; k++)
      if (AD_KEYS[k] in obj) { delete obj[AD_KEYS[k]]; cleaned = true; }
    var keys = Object.keys(obj);
    for (var j = 0; j < keys.length; j++) {
      var val = obj[keys[j]];
      if (val && typeof val === 'object' && deepClean(val, d)) cleaned = true;
    }
    return cleaned;
  }

  // 2) fetch hook
  var AD_URL_PATTERNS = [
    '/pagead/', '/ptracking', '/api/stats/ads', '/get_midroll_',
    '/ad_break', '/log_interaction', '/log_event',
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adservice.google.', 'googleads.g.doubleclick', 'innovid.com',
    'securepubads', '/youtubei/v1/player/ad_break',
    'play.google.com/log', '/generate_204'
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    for (var i = 0; i < AD_URL_PATTERNS.length; i++)
      if (url.indexOf(AD_URL_PATTERNS[i]) !== -1) return true;
    return false;
  }

  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
    if (isAdUrl(url)) {
      stats.fetchBlocked++;
      log('fetch blocked: ' + url.substring(0, 90));
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return _origFetch.apply(this, arguments);
  };
  try { window.fetch.toString = function () { return 'function fetch() { [native code] }'; } } catch (e) {}

  // 3) XHR hook
  var _origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isAdUrl(url)) { stats.xhrBlocked++; this.__emy_blocked = true; }
    return _origXHROpen.apply(this, arguments);
  };

  var _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this.__emy_blocked) {
      try {
        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(this, 'status', { value: 200, configurable: true });
        Object.defineProperty(this, 'responseText', { value: '{}', configurable: true });
        Object.defineProperty(this, 'response', { value: '{}', configurable: true });
      } catch (e) {}
      if (typeof this.onreadystatechange === 'function') try { this.onreadystatechange(); } catch (e) {}
      try { this.dispatchEvent(new Event('load')); } catch (e) {}
      return;
    }
    return _origXHRSend.apply(this, arguments);
  };

  // 4) DOM observer — remove overlays + auto-skip
  var AD_SELECTORS = [
    '.ytp-ad-overlay-container', '.ytp-ad-text-overlay', '.video-ads',
    '#player-ads', '#masthead-ad', 'ytd-ad-slot-renderer',
    'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
    'ytd-in-feed-ad-layout-renderer', 'ytd-display-ad-renderer',
    'ytd-companion-slot-renderer', 'ytd-promoted-sparkles-web-renderer',
    'ytd-action-companion-ad-renderer', 'ytd-promoted-sparkles-text-search-renderer',
    '.ytp-ad-module', '.ytp-ad-image-overlay', 'ytd-enforcement-message-view-model'
  ];

  var SKIP_SELECTORS = [
    '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
    'button.ytp-ad-skip-button-modern', '.ytp-ad-skip-button-slot button', '[id^="skip-button"]'
  ];

  function safeQS(sel) { try { return document.querySelectorAll(sel); } catch (e) { return []; } }

  function removeAdOverlays() {
    var removed = 0;
    for (var i = 0; i < AD_SELECTORS.length; i++) {
      var els = safeQS(AD_SELECTORS[i]);
      for (var j = 0; j < els.length; j++) { try { els[j].remove(); removed++; } catch (e) {} }
    }

    for (var s = 0; s < SKIP_SELECTORS.length; s++) {
      try { var btn = document.querySelector(SKIP_SELECTORS[s]); if (btn) { btn.click(); stats.adsSkipped++; } } catch (e) {}
    }

    try {
      var player = document.querySelector('.html5-video-player');
      if (player && player.classList && player.classList.contains('ad-showing')) {
        var video = player.querySelector('video');
        if (video) {
          try { video.playbackRate = 16; video.muted = true; } catch (e) {}
          if (video.duration && isFinite(video.duration)) video.currentTime = video.duration;
          stats.adsSkipped++;
        }
      }
    } catch (e) {}

    if (removed > 0) stats.overlaysRemoved += removed;
  }

  var throttleTimer = null;
  var observer = null;
  try { observer = new MutationObserver(function () { if (!throttleTimer) throttleTimer = setTimeout(function () { throttleTimer = null; removeAdOverlays(); }, 100); }); } catch (e) {}

  function startObserver() {
    if (observer && document.body) try { observer.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    removeAdOverlays();
  }
  if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);
  setInterval(removeAdOverlays, 2000);

  // 5) DOM marker + debug
  function getMarker() { return document.getElementById('__emy_scriptlet_marker'); }
  function createMarker() {
    var m = document.createElement('div');
    m.id = '__emy_scriptlet_marker'; m.style.display = 'none';
    (document.head || document.documentElement).appendChild(m);
    return m;
  }
  function updateMarker() {
    var m = getMarker() || createMarker();
    m.setAttribute('data-active', 'true'); m.setAttribute('data-version', SCRIPTLET_VERSION);
    m.setAttribute('data-stats', JSON.stringify(stats));
  }
  function refreshMarker() { var m = getMarker(); if (m) { m.setAttribute('data-active', 'true'); m.setAttribute('data-version', SCRIPTLET_VERSION); m.setAttribute('data-stats', JSON.stringify(stats)); } }

  window.__emy_disableMarker = function () {
    var m = getMarker(); if (m) m.setAttribute('data-active', 'false');
    window.__emy_injected = false;
  };

  updateMarker(); setInterval(updateMarker, 5000);

  window.__emy_debug = function () {
    try { console.table(stats); } catch (e) {}
    log('Version: ' + SCRIPTLET_VERSION);
    log('JSON.parse hooked: ' + (JSON.parse !== _origParse));
    log('fetch hooked:      ' + (window.fetch !== _origFetch));
    log('XHR open hooked:   ' + (XMLHttpRequest.prototype.open !== _origXHROpen));
    return stats;
  };

  log('All hooks active. Run __emy_debug() in console for stats.');

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.__emy !== 'main-cmd') return;
    if (ev.data.cmd === 'disable') {
      try { if (typeof window.__emy_disableMarker === 'function') window.__emy_disableMarker(); var m = document.getElementById('__emy_scriptlet_marker'); if (m) m.setAttribute('data-active', 'false'); } catch (e) {}
    }
  });

})();
