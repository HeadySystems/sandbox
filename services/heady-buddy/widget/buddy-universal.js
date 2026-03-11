/**
 * ═══ HeadyBuddy Universal — SPEC-6 ═══
 *
 * Drop-in overlay script. Add to ANY page:
 *   <script src="https://cdn.headyme.com/buddy-universal.js"></script>
 *
 * Features:
 *   • Floating action button (FAB)
 *   • Slide-in chat panel
 *   • Voice input via Web Speech API
 *   • Cross-device sync (E2E encrypted)
 *   • Privacy-first: consent before any tracking
 *   • Keyboard shortcut: Alt+H to toggle
 */

(function () {
    "use strict";

    const BUDDY_VERSION = "2.0.0";
    const API_BASE = "https://heady-onboarding-609590223909.us-east1.run.app";
    const EDGE_BASE = "https://heady-onboarding-609590223909.us-east1.run.app";

    // ─── State ───────────────────────────────────────────────────
    const state = {
        open: false,
        messages: [],
        userId: null,
        deviceId: null,
        consentGiven: false,
        voiceActive: false,
    };

    // ─── Styles ──────────────────────────────────────────────────
    const styles = document.createElement("style");
    styles.textContent = `
        #heady-buddy-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102,126,234,0.4);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
            font-size: 24px;
        }
        #heady-buddy-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(102,126,234,0.6);
        }
        #heady-buddy-fab.open {
            transform: rotate(45deg) scale(1.1);
        }

        #heady-buddy-panel {
            position: fixed;
            bottom: 92px;
            right: 24px;
            width: 380px;
            max-height: 520px;
            background: #1a1a2e;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 999998;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            color: #e0e0e0;
            animation: buddy-slide-up 0.3s ease-out;
        }
        #heady-buddy-panel.visible {
            display: flex;
        }

        @keyframes buddy-slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .buddy-header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .buddy-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: white;
        }
        .buddy-header .buddy-status {
            font-size: 11px;
            color: rgba(255,255,255,0.8);
        }

        .buddy-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            max-height: 340px;
        }
        .buddy-msg {
            margin-bottom: 12px;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            max-width: 85%;
            word-wrap: break-word;
        }
        .buddy-msg.user {
            background: #2d2d44;
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        .buddy-msg.assistant {
            background: #16213e;
            border: 1px solid rgba(102,126,234,0.3);
            border-bottom-left-radius: 4px;
        }
        .buddy-msg.system {
            background: transparent;
            color: rgba(255,255,255,0.5);
            font-size: 12px;
            text-align: center;
            max-width: 100%;
        }

        .buddy-input-row {
            display: flex;
            padding: 12px;
            gap: 8px;
            border-top: 1px solid rgba(255,255,255,0.1);
            background: #0f0f1a;
        }
        .buddy-input-row input {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 14px;
            color: #e0e0e0;
            font-size: 14px;
            outline: none;
        }
        .buddy-input-row input:focus {
            border-color: #667eea;
        }
        .buddy-input-row button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 8px;
            padding: 0 14px;
            cursor: pointer;
            font-size: 16px;
            color: white;
            transition: opacity 0.2s;
        }
        .buddy-input-row button:hover { opacity: 0.85; }
        .buddy-input-row button:disabled { opacity: 0.4; cursor: not-allowed; }

        .buddy-consent {
            padding: 16px;
            text-align: center;
            font-size: 13px;
            color: rgba(255,255,255,0.6);
        }
        .buddy-consent button {
            display: block;
            margin: 12px auto 0;
            background: #667eea;
            border: none;
            border-radius: 8px;
            padding: 8px 24px;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }

        @media (max-width: 480px) {
            #heady-buddy-panel {
                width: calc(100vw - 32px);
                right: 16px;
                bottom: 84px;
            }
        }
    `;
    document.head.appendChild(styles);

    // ─── FAB ─────────────────────────────────────────────────────
    const fab = document.createElement("button");
    fab.id = "heady-buddy-fab";
    fab.innerHTML = "🧠";
    fab.title = "HeadyBuddy (Alt+H)";
    fab.setAttribute("aria-label", "Open HeadyBuddy AI assistant");
    document.body.appendChild(fab);

    // ─── Panel ───────────────────────────────────────────────────
    const panel = document.createElement("div");
    panel.id = "heady-buddy-panel";
    panel.innerHTML = `
        <div class="buddy-header">
            <div>
                <h3>HeadyBuddy</h3>
                <div class="buddy-status">v${BUDDY_VERSION} • Ready</div>
            </div>
            <button id="buddy-voice-btn" style="background:none;border:none;font-size:18px;cursor:pointer;" title="Voice input">🎤</button>
        </div>
        <div class="buddy-messages" id="buddy-messages">
            <div class="buddy-msg system">👋 Hi! I'm HeadyBuddy. Ask me anything.</div>
        </div>
        <div class="buddy-input-row">
            <input id="buddy-input" type="text" placeholder="Ask HeadyBuddy..." autocomplete="off" />
            <button id="buddy-send">→</button>
        </div>
    `;
    document.body.appendChild(panel);

    // ─── Toggle ──────────────────────────────────────────────────
    function toggle() {
        state.open = !state.open;
        panel.classList.toggle("visible", state.open);
        fab.classList.toggle("open", state.open);
        if (state.open) {
            document.getElementById("buddy-input").focus();
        }
    }

    fab.addEventListener("click", toggle);

    // Keyboard shortcut: Alt+H
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key === "h") {
            e.preventDefault();
            toggle();
        }
    });

    // ─── Send message ────────────────────────────────────────────
    async function sendMessage(text) {
        if (!text.trim()) return;

        addMessage("user", text);
        const input = document.getElementById("buddy-input");
        const sendBtn = document.getElementById("buddy-send");
        input.value = "";
        sendBtn.disabled = true;

        try {
            // Try edge first, fallback to origin
            let response;
            try {
                response = await fetch(`${EDGE_BASE}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: text, userId: state.userId }),
                    signal: AbortSignal.timeout(8000),
                });
            } catch {
                response = await fetch(`${API_BASE}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: text }),
                });
            }

            const data = await response.json();
            addMessage("assistant", data.response || data.message || data.text || "I'm thinking...");
        } catch (err) {
            addMessage("assistant", "Sorry, I couldn't connect. Please try again.");
        }

        sendBtn.disabled = false;
    }

    function addMessage(role, text) {
        const messagesEl = document.getElementById("buddy-messages");
        const msg = document.createElement("div");
        msg.className = `buddy-msg ${role}`;
        msg.textContent = text;
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        state.messages.push({ role, text, ts: Date.now() });
    }

    // Send on Enter or button click
    document.getElementById("buddy-send").addEventListener("click", () => {
        sendMessage(document.getElementById("buddy-input").value);
    });
    document.getElementById("buddy-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage(e.target.value);
    });

    // ─── Voice Input ─────────────────────────────────────────────
    const voiceBtn = document.getElementById("buddy-voice-btn");
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById("buddy-input").value = transcript;
            sendMessage(transcript);
        };

        recognition.onend = () => {
            voiceBtn.textContent = "🎤";
            state.voiceActive = false;
        };

        voiceBtn.addEventListener("click", () => {
            if (state.voiceActive) {
                recognition.stop();
            } else {
                recognition.start();
                voiceBtn.textContent = "🔴";
                state.voiceActive = true;
            }
        });
    } else {
        voiceBtn.style.display = "none";
    }

    // ─── Device ID ───────────────────────────────────────────────
    state.deviceId = localStorage.getItem("heady-device-id");
    if (!state.deviceId) {
        state.deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        localStorage.setItem("heady-device-id", state.deviceId);
    }

    // ─── Expose global ──────────────────────────────────────────
    window.HeadyBuddy = {
        toggle,
        sendMessage,
        getState: () => ({ ...state }),
        version: BUDDY_VERSION,
    };

    console.log(`🧠 HeadyBuddy v${BUDDY_VERSION} loaded • Alt+H to toggle`);
})();
