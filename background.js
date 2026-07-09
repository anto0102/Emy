importScripts('lib/storage-utils.js');

// Edit these to match your repo
const GITHUB_OWNER  = 'anto0102';
const GITHUB_REPO   = 'Emy';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/';
const DYNAMIC_RULES_URL = GITHUB_RAW_BASE + 'filters/rules_dynamic.json';
const VERSION_URL       = GITHUB_RAW_BASE + 'filters/version.json';

const LOCAL_SCRIPTLET_VERSION = '2.1.1';
const LOCAL_EXTENSION_VERSION = '1.1.1';

const ALARM_NAME = 'updateFilters';
const ALARM_PERIOD_MINUTES = 360;

chrome.runtime.onInstalled.addListener(async function () {
  const { enabled = true } = await getStorage({ enabled: true });
  await setStorage({ enabled, localScriptletVersion: LOCAL_SCRIPTLET_VERSION, localExtensionVersion: LOCAL_EXTENSION_VERSION });
  await loadLocalDynamicRules();
  await applyBadge(enabled, false);
  await ensureAlarm();
  await addDebugLog('Extension installed/updated. enabled=' + enabled);
});

chrome.runtime.onStartup.addListener(async function () {
  await ensureAlarm();
  const { enabled = true } = await getStorage({ enabled: true });
  await applyBadge(enabled, false);
});

function ensureAlarm() {
  return new Promise(function (resolve) {
    chrome.alarms.get(ALARM_NAME, function (alarm) {
      if (!alarm) chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      resolve();
    });
  });
}

async function loadLocalDynamicRules() {
  try {
    var resp = await fetch(chrome.runtime.getURL('filters/rules_dynamic.json'));
    var rules = await resp.json();
    if (Array.isArray(rules) && rules.length > 0) {
      await applyDynamicRules(rules);
      await setStorage({ savedDynamicRules: rules });
      await addDebugLog('Local dynamic rules loaded: ' + rules.length);
    } else {
      await addDebugLog('No local dynamic rules (empty)');
    }
  } catch (e) {
    await addDebugLog('Error loading local rules: ' + e.message);
  }
}

async function applyDynamicRules(rules) {
  var existing = await chrome.declarativeNetRequest.getDynamicRules();
  var idsToRemove = existing.map(function (r) { return r.id; });
  if (idsToRemove.length === 0 && (!rules || rules.length === 0)) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: idsToRemove,
    addRules: rules || []
  });
}

async function removeAllDynamicRules() {
  var existing = await chrome.declarativeNetRequest.getDynamicRules();
  var idsToRemove = existing.map(function (r) { return r.id; });
  if (idsToRemove.length > 0)
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: idsToRemove });
}

async function fetchUpdates() {
  var data = await getStorage({ filterEtag: '', versionEtag: '' });
  var updatedSomething = false;

  try {
    var headers = {};
    if (data.filterEtag) headers['If-None-Match'] = data.filterEtag;
    var resp = await fetch(DYNAMIC_RULES_URL, { headers: headers, cache: 'no-store' });
    if (resp.status === 200) {
      var newEtag = resp.headers.get('ETag') || '';
      var rules = await resp.json();
      if (!Array.isArray(rules)) rules = [];
      await applyDynamicRules(rules);
      await setStorage({
        savedDynamicRules: rules,
        filterEtag: newEtag,
        lastFilterUpdate: new Date().toISOString()
      });
      await addDebugLog('DNR rules updated from GitHub: ' + rules.length + ' rules');
      updatedSomething = true;
    } else if (resp.status === 304) {
      await addDebugLog('DNR rules: no update (304)');
    } else {
      await addDebugLog('DNR rules: unexpected status ' + resp.status);
    }
  } catch (e) {
    await addDebugLog('Error fetching DNR rules: ' + e.message);
  }

  try {
    var vresp = await fetch(VERSION_URL, { cache: 'no-store' });
    if (vresp.status === 200) {
      var vjson = await vresp.json();
      var remoteVersion = (vjson && vjson.version) ? String(vjson.version) : '';
      await setStorage({
        remoteScriptletVersion: remoteVersion,
        remoteVersionInfo: vjson,
        lastVersionCheck: new Date().toISOString()
      });
      await refreshBadge();
      await addDebugLog('Remote scriptlet version: ' + remoteVersion + ' (local: ' + LOCAL_SCRIPTLET_VERSION + ')');
    } else {
      await addDebugLog('Version check: status ' + vresp.status);
    }
  } catch (e) {
    await addDebugLog('Error fetching version.json: ' + e.message);
  }

  if (!updatedSomething) await addDebugLog('Update pass complete, no DNR changes');
}

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_NAME) {
    getStorage({ enabled: true }).then(function (d) {
      if (d.enabled) fetchUpdates();
    });
  }
});

async function refreshBadge() {
  const { enabled = true } = await getStorage({ enabled: true });
  const { remoteScriptletVersion = '' } = await getStorage({ remoteScriptletVersion: '' });
  var outdated = remoteScriptletVersion && compareVersions(remoteScriptletVersion, LOCAL_SCRIPTLET_VERSION) > 0;
  await applyBadge(enabled, !!outdated);
}

async function applyBadge(enabled, outdated) {
  if (!enabled) {
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: '#777777' });
  } else if (outdated) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ff8c00' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

function compareVersions(a, b) {
  var pa = a.split('.').map(function (n) { return parseInt(n, 10) || 0; });
  var pb = b.split('.').map(function (n) { return parseInt(n, 10) || 0; });
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var da = pa[i] || 0, db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return false;

  if (msg.type === 'toggleEnabled') {
    handleToggle(!!msg.enabled).then(function () { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === 'forceUpdate') {
    fetchUpdates().then(function () { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === 'getLogs') {
    getStorage({ debugLogs: [] }).then(function (d) { sendResponse({ logs: d.debugLogs }); });
    return true;
  }

  if (msg.type === 'clearLogs') {
    setStorage({ debugLogs: [] }).then(function () { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === 'getStatus') {
    getStorage({ enabled: true, remoteScriptletVersion: '', remoteVersionInfo: null })
      .then(function (d) {
        sendResponse({
          enabled: d.enabled,
          localVersion: LOCAL_SCRIPTLET_VERSION,
          remoteVersion: d.remoteScriptletVersion || '',
          outdated: !!(d.remoteScriptletVersion && compareVersions(d.remoteScriptletVersion, LOCAL_SCRIPTLET_VERSION) > 0),
          remoteInfo: d.remoteVersionInfo || null
        });
      });
    return true;
  }

  if (msg.type === 'requestScriptletInjection') {
    if (!sender.tab || typeof sender.tab.id !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return false;
    }
    getStorage({ enabled: true }).then(function (d) {
      if (!d.enabled) {
        sendResponse({ ok: false, reason: 'disabled' });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ['filters/scriptlets.js'],
        world: 'MAIN'
      }).then(function () {
        addDebugLog('Scriptlet injected on tab ' + sender.tab.id);
        sendResponse({ ok: true });
      }).catch(function (err) {
        addDebugLog('Injection error on tab ' + sender.tab.id + ': ' + err.message);
        sendResponse({ ok: false, reason: err.message });
      });
    });
    return true;
  }
});

async function handleToggle(enabled) {
  await setStorage({ enabled: enabled });
  await refreshBadge();
  if (enabled) {
    const { savedDynamicRules = [] } = await getStorage('savedDynamicRules');
    if (savedDynamicRules.length > 0) await applyDynamicRules(savedDynamicRules);
    else await loadLocalDynamicRules();
    await addDebugLog('Extension ENABLED');
  } else {
    await removeAllDynamicRules();
    try {
      const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
      for (const t of tabs) {
        chrome.tabs.sendMessage(t.id, { type: 'disableScriptlet' }, function () { if (chrome.runtime.lastError) {} });
      }
    } catch (e) {}
    await addDebugLog('Extension DISABLED');
  }
}
