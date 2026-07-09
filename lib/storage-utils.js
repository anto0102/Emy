var MAX_DEBUG_LOGS = 100;

function getStorage(keys) { return chrome.storage.local.get(keys); }
function setStorage(obj) { return chrome.storage.local.set(obj); }

async function addDebugLog(msg) {
  const { debugLogs = [] } = await getStorage('debugLogs');
  debugLogs.push('[' + new Date().toISOString() + '] ' + msg);
  if (debugLogs.length > MAX_DEBUG_LOGS) debugLogs.splice(0, debugLogs.length - MAX_DEBUG_LOGS);
  return setStorage({ debugLogs });
}
