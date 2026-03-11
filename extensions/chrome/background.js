/**
 * Heady Chrome Extension v3.1.0 — Background Service Worker
 * Production-ready with Cloud Run endpoints, side panel, and context menus
 */

const API_ENDPOINTS = {
  production: 'https://heady-ai-main-1003436179562.us-central1.run.app',
  headyme: 'https://headyme.com',
  headysystems: 'https://headysystems.com',
  headymcp: 'https://headymcp.com',
  local: 'http://localhost:3300',
};

let activeEndpoint = API_ENDPOINTS.production;

// ── Installation ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Heady] Extension installed:', details.reason);

  chrome.contextMenus.create({ id: 'ask-heady', title: 'Ask Heady about "%s"', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'summarize-page', title: 'Summarize this page with Heady', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'explain-selection', title: 'Explain this with Heady', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'send-to-heady', title: 'Send to Heady', contexts: ['selection'] });

  const { endpoint } = await chrome.storage.sync.get('endpoint');
  if (endpoint) activeEndpoint = endpoint;

  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
  checkHealth();
});

// ── Context Menu Handler ────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ask-heady' && info.selectionText) {
    if (chrome.sidePanel) {
      await chrome.sidePanel.open({ tabId: tab.id });
      setTimeout(() => chrome.runtime.sendMessage({ type: 'SIDE_PANEL_QUERY', query: `Explain: ${info.selectionText}` }), 500);
    }
  }
  if (info.menuItemId === 'summarize-page' && chrome.sidePanel) {
    await chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => chrome.runtime.sendMessage({ type: 'SIDE_PANEL_QUERY', query: 'Summarize this page' }), 500);
  }
  if (info.menuItemId === 'explain-selection' && info.selectionText && chrome.sidePanel) {
    await chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => chrome.runtime.sendMessage({ type: 'SIDE_PANEL_QUERY', query: `Explain simply: ${info.selectionText}` }), 500);
  }
  if (info.menuItemId === 'send-to-heady') {
    sendToHeady({ text: info.selectionText, url: tab.url, title: tab.title });
  }
});

// ── Command Listener ────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-heady') chrome.action.openPopup();
  else if (command === 'capture-selection') captureSelection();
  else if (command === 'ask-heady') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || '',
      });
      if (result?.result && chrome.sidePanel) {
        await chrome.sidePanel.open({ tabId: tab.id });
        setTimeout(() => chrome.runtime.sendMessage({ type: 'SIDE_PANEL_QUERY', query: result.result }), 500);
      }
    }
  }
});

// ── Message Handler ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToHeady') { sendToHeady(request.data).then(sendResponse); return true; }
  if (request.action === 'checkHealth') { checkHealth().then(sendResponse); return true; }
  if (request.action === 'switchEndpoint') { switchEndpoint(request.endpoint).then(sendResponse); return true; }
  if (request.type === 'CHAT') { handleChat(request.query, request.context).then(sendResponse); return true; }
  if (request.type === 'HEALTH_CHECK') { checkHealth().then(sendResponse); return true; }
  if (request.type === 'GET_PAGE_CONTENT') { getPageContent(sender.tab?.id).then(sendResponse); return true; }
});

// ── Chat API ────────────────────────────────────────────────
async function handleChat(query, context = '') {
  try {
    const res = await fetch(`${activeEndpoint}/api/buddy/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, context, source: 'chrome-extension', history: [] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return { ok: true, reply: data.reply || data.message || "I'm here to help!" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Send to Heady Inbox ─────────────────────────────────────
async function sendToHeady(data) {
  try {
    const response = await fetch(`${activeEndpoint}/api/inbox/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'chrome-extension', timestamp: new Date().toISOString(), data }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    showNotification('Sent to Heady', 'Data successfully captured');
    return { success: true, result };
  } catch (error) {
    showNotification('Heady Connection Error', `Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ── Health Check ────────────────────────────────────────────
async function checkHealth() {
  const results = {};
  for (const [name, url] of Object.entries(API_ENDPOINTS)) {
    try {
      const response = await fetch(`${url}/api/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
      results[name] = response.ok ? { status: 'healthy' } : { status: 'unhealthy', code: response.status };
    } catch (error) {
      results[name] = { status: 'unreachable', error: error.message };
    }
  }
  const activeKey = Object.keys(API_ENDPOINTS).find(k => API_ENDPOINTS[k] === activeEndpoint);
  const activeHealth = results[activeKey];
  if (activeHealth?.status === 'healthy') {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setBadgeText({ text: '✓' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#FF5722' });
    chrome.action.setBadgeText({ text: '!' });
  }
  return results;
}

// ── Switch Endpoint ─────────────────────────────────────────
async function switchEndpoint(endpoint) {
  if (API_ENDPOINTS[endpoint]) {
    activeEndpoint = API_ENDPOINTS[endpoint];
    await chrome.storage.sync.set({ endpoint: activeEndpoint });
    await checkHealth();
    return { success: true, endpoint: activeEndpoint };
  }
  return { success: false, error: 'Invalid endpoint' };
}

// ── Capture Selection ───────────────────────────────────────
async function captureSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ text: window.getSelection().toString(), url: window.location.href, title: document.title }),
  }).then((results) => { if (results[0]?.result) sendToHeady(results[0].result); });
}

// ── Get Page Content ────────────────────────────────────────
async function getPageContent(tabId) {
  if (!tabId) return { text: '' };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (document.querySelector('article') || document.querySelector('main') || document.body)?.innerText?.slice(0, 8000) || '',
    });
    return { text: result?.result || '' };
  } catch { return { text: '' }; }
}

// ── Notification Helper ─────────────────────────────────────
function showNotification(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-128.png', title, message });
}

// Periodic health check (every 5 minutes)
setInterval(checkHealth, 5 * 60 * 1000);
