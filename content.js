(function () {
  'use strict';

  var MARKER_ID = '__emy_scriptlet_marker';
  var LOG_PREFIX = '[Emy/content]';
  var LOCAL_SCRIPTLET_VERSION = '2.1.1';

  function log(msg) {
    try { console.log(LOG_PREFIX, msg); } catch (e) {}
  }

  function requestInjection(reason) {
    log('Requesting scriptlet injection' + (reason ? ' (' + reason + ')' : '') + '...');
    try {
      chrome.runtime.sendMessage({ type: 'requestScriptletInjection' }, function (response) {
        if (chrome.runtime.lastError) {
          log('ERROR communicating with background: ' + chrome.runtime.lastError.message);
        } else if (response && response.ok) {
          log('Background confirmed scriptlet injection');
        } else {
          log('Background refused injection (extension disabled?)');
        }
      });
    } catch (e) {
      log('sendMessage threw: ' + e.message);
    }
  }

  requestInjection('initial');

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes.enabled) {
      if (changes.enabled.newValue === false) {
        log('Extension disabled -> deactivating marker');
        try { window.postMessage({ __emy: 'disable' }, '*'); } catch (e) {}
      } else if (changes.enabled.newValue === true) {
        log('Extension re-enabled -> requesting injection');
        requestInjection('re-enabled');
      }
    }
  });

  document.addEventListener('yt-navigate-finish', function () {
    log('yt-navigate-finish -> requesting injection');
    requestInjection('spa-navigation');
  });
  window.addEventListener('popstate', function () {
    log('popstate -> requesting injection');
    requestInjection('popstate');
  });

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.__emy !== 'main-status') return;
    if (ev.data.action === 'disable') {
      var m = document.getElementById(MARKER_ID);
      if (m) m.setAttribute('data-active', 'false');
    }
  });

  function getScriptletStatus() {
    var marker = document.getElementById(MARKER_ID);
    var result = {
      injected: !!marker,
      active: marker ? marker.getAttribute('data-active') === 'true' : false,
      localVersion: LOCAL_SCRIPTLET_VERSION,
      version: marker ? (marker.getAttribute('data-version') || 'N/A') : 'N/A',
      upToDate: marker ? (marker.getAttribute('data-version') === LOCAL_SCRIPTLET_VERSION) : false,
      stats: null,
      url: window.location.href
    };
    if (marker) {
      try { result.stats = JSON.parse(marker.getAttribute('data-stats') || '{}'); }
      catch (e) { result.stats = {}; }
    }
    return result;
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'getScriptletStatus' || msg.type === 'checkVersion') {
      sendResponse(getScriptletStatus());
    } else if (msg.type === 'disableScriptlet') {
      try {
        var marker = document.getElementById(MARKER_ID);
        if (marker) marker.setAttribute('data-active', 'false');
        window.postMessage({ __emy: 'main-cmd', cmd: 'disable' }, '*');
      } catch (e) {}
      sendResponse({ ok: true });
    }
  });

  log('Content script (ISOLATED) loaded on ' + window.location.href);
})();
