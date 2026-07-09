(function () {
  'use strict';

  var toggle = document.getElementById('toggleEnabled');
  var toggleText = document.getElementById('toggleText');
  var btnUpdate = document.getElementById('btnUpdate');
  var updateStatus = document.getElementById('updateStatus');
  var showDebug = document.getElementById('showDebug');
  var debugSection = document.getElementById('debugSection');
  var debugLog = document.getElementById('debugLog');
  var btnClearLog = document.getElementById('btnClearLog');
  var btnCheckScriptlet = document.getElementById('btnCheckScriptlet');
  var localVersionEl = document.getElementById('localVersion');
  var remoteVersionEl = document.getElementById('remoteVersion');
  var updateBanner = document.getElementById('updateBanner');

  function refreshStatus() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, function (resp) {
      if (chrome.runtime.lastError || !resp) return;
      toggle.checked = !!resp.enabled;
      updateToggleText(resp.enabled);
      localVersionEl.textContent = resp.localVersion || '-';
      remoteVersionEl.textContent = resp.remoteVersion || '-';
      if (resp.outdated) {
        updateBanner.classList.remove('hidden');
        updateBanner.textContent = 'A newer scriptlet (' + resp.remoteVersion + ') is available. Update the extension.';
      } else {
        updateBanner.classList.add('hidden');
      }
    });
  }

  function updateToggleText(enabled) {
    toggleText.textContent = enabled ? 'Active' : 'Inactive';
  }

  refreshStatus();

  toggle.addEventListener('change', function () {
    var enabled = toggle.checked;
    updateToggleText(enabled);
    chrome.runtime.sendMessage({ type: 'toggleEnabled', enabled: enabled }, function () {
      if (chrome.runtime.lastError) updateStatus.textContent = 'Communication error';
      else refreshStatus();
    });
  });

  btnUpdate.addEventListener('click', function () {
    btnUpdate.disabled = true;
    updateStatus.textContent = 'Updating...';
    chrome.runtime.sendMessage({ type: 'forceUpdate' }, function () {
      btnUpdate.disabled = false;
      if (chrome.runtime.lastError) updateStatus.textContent = 'Error: ' + chrome.runtime.lastError.message;
      else {
        updateStatus.textContent = 'Update complete';
        refreshStatus();
        if (!debugSection.classList.contains('hidden')) loadLogs();
      }
    });
  });

  showDebug.addEventListener('change', function () {
    if (showDebug.checked) { debugSection.classList.remove('hidden'); loadLogs(); }
    else debugSection.classList.add('hidden');
  });

  function loadLogs() {
    chrome.runtime.sendMessage({ type: 'getLogs' }, function (response) {
      if (chrome.runtime.lastError || !response) { debugLog.value = 'Error loading logs'; return; }
      debugLog.value = (response.logs || []).join('\n');
      debugLog.scrollTop = debugLog.scrollHeight;
    });
  }

  btnClearLog.addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'clearLogs' }, function () { debugLog.value = ''; });
  });

  btnCheckScriptlet.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) { debugLog.value += '\n[ERROR] No active tab'; return; }
      var tab = tabs[0];
      if (!tab.url || tab.url.indexOf('youtube.com') === -1) { debugLog.value += '\n[INFO] Active tab is not YouTube'; return; }
      chrome.tabs.sendMessage(tab.id, { type: 'getScriptletStatus' }, function (response) {
        if (chrome.runtime.lastError) debugLog.value += '\n[ERROR] ' + chrome.runtime.lastError.message;
        else if (response) {
          debugLog.value += '\n--- SCRIPTLET STATUS ---';
          debugLog.value += '\n  Injected:     ' + (response.injected ? 'YES' : 'NO');
          debugLog.value += '\n  Active:       ' + (response.active ? 'YES' : 'NO');
          debugLog.value += '\n  Local ver:    ' + (response.localVersion || '-');
          debugLog.value += '\n  Main ver:     ' + (response.version || '-');
          debugLog.value += '\n  Up to date:   ' + (response.upToDate ? 'YES' : 'NO');
          debugLog.value += '\n  URL:          ' + (response.url || '-');
          if (response.stats) {
            var s = response.stats;
            debugLog.value += '\n--- STATS ---';
            debugLog.value += '\n  JSON stripped:    ' + (s.jsonStripped || 0);
            debugLog.value += '\n  fetch blocked:    ' + (s.fetchBlocked || 0);
            debugLog.value += '\n  XHR blocked:      ' + (s.xhrBlocked || 0);
            debugLog.value += '\n  Ads skipped:      ' + (s.adsSkipped || 0);
            debugLog.value += '\n  Overlays removed: ' + (s.overlaysRemoved || 0);
          }
        } else debugLog.value += '\n[ERROR] No response from content script';
        debugLog.scrollTop = debugLog.scrollHeight;
      });
    });
  });
})();
