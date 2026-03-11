/* ═══════════════════════════════════════════════════════════════════════
   HeadyBuddy Chrome Extension — Background Service Worker
   Opens the sidebar on icon click. Routes all Buddy communication.
   ═══════════════════════════════════════════════════════════════════════ */

// Open Side Panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Enable side panel on all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const apiBase = msg.apiBase || "https://headyapi.com";
    const apiKey = msg.apiKey || "";
    const authHeaders = apiKey ? { "Authorization": `Bearer ${apiKey}` } : {};

    if (msg.action === "fetchBuddy" || msg.action === "fetchHealth") {
        fetch(`${apiBase}/api/health`, {
            headers: { Accept: "application/json", ...authHeaders },
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }

    // Real AI Chat — Buddy does the legwork
    if (msg.action === "fetchChat") {
        const model = msg.model || "heady-buddy";
        const systemPrompt = "You are HeadyBuddy, a friendly and capable AI companion. You remember context, proactively help, and do all the digital legwork for your user. You're warm, professional, and action-oriented. When you can do something yourself (research, code, analyze), just do it and report back. Never make the user do unnecessary work. Format responses with markdown for readability.";
        fetch(`${apiBase}/api/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...authHeaders,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: msg.message },
                ],
                temperature: 0.7,
            }),
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => {
                const content = data.choices?.[0]?.message?.content || data.response || data.text || JSON.stringify(data);
                sendResponse({ ok: true, data: { content, model: data.model || model, usage: data.usage } });
            })
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }

    // MCP Tool Discovery
    if (msg.action === "fetchMCPTools") {
        fetch(`${apiBase}/api/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
            body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/list", params: {} }),
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data: data.result?.tools || [] }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }

    // MCP Tool Call
    if (msg.action === "callMCPTool") {
        fetch(`${apiBase}/api/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
            body: JSON.stringify({
                jsonrpc: "2.0", id: Date.now(),
                method: "tools/call",
                params: { name: msg.toolName, arguments: msg.toolArgs || {} },
            }),
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data: data.result }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }

    // Service Discovery
    if (msg.action === "fetchServices") {
        const services = [
            { name: "HeadyAPI", url: "https://headyapi.com", path: "/api/health" },
            { name: "HeadyMCP", url: "https://headymcp.com", path: "/api/health" },
            { name: "HeadyAI", url: "https://heady-ai.com", path: "/api/health" },
            { name: "HeadyBuddy", url: "https://headybuddy.org", path: "/api/health" },
            { name: "HeadyIO", url: "https://headyio.com", path: "/api/health" },
            { name: "HeadyCloud", url: "https://headycloud.com", path: "/api/health" },
            { name: "HeadyOS", url: "https://headyos.com", path: "/api/health" },
        ];
        Promise.all(services.map(async (svc) => {
            const start = Date.now();
            try {
                const r = await fetch(`${svc.url}${svc.path}`, { signal: AbortSignal.timeout(5000) });
                return { ...svc, healthy: r.ok, latencyMs: Date.now() - start };
            } catch {
                return { ...svc, healthy: false, latencyMs: -1 };
            }
        }))
            .then((results) => sendResponse({ ok: true, data: results }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }

    if (msg.action === "fetchA2UI") {
        fetch(`${apiBase}/api/buddy/output`, {
            headers: { Accept: "application/json", ...authHeaders },
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ installed: Date.now(), version: "3.2.3" });
});

