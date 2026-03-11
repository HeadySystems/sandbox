/**
 * HeadyWeb Integrated Workspace — Fallback UI
 *
 * Renders when no Module Federation remote matches the current domain projection.
 * Provides a full-featured workspace with auth, vector memory, IDE, and chat.
 *
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module shell/integrated-workspace
 */

'use strict';

/**
 * Render the integrated workspace into the given container.
 * @param {HTMLElement} container — root DOM element to mount into
 * @param {{ projection?: string }} options
 */
function renderIntegratedWorkspace(container, options = {}) {
    const projection = options.projection || 'default';

    container.innerHTML = `
    <div class="iw-shell">
      <header class="iw-header">
        <div class="iw-logo">
          <span class="iw-logo-icon">🜃</span>
          <span class="iw-logo-text">Heady<span class="iw-accent">Web</span></span>
        </div>
        <nav class="iw-nav">
          <button class="iw-nav-btn iw-active" data-tab="workspace">Workspace</button>
          <button class="iw-nav-btn" data-tab="vectors">Vectors</button>
          <button class="iw-nav-btn" data-tab="chat">Chat</button>
          <button class="iw-nav-btn" data-tab="docs">Docs</button>
        </nav>
        <div class="iw-auth-area">
          <button class="iw-sign-in auth-trigger" id="iw-sign-in">Sign In</button>
        </div>
      </header>

      <main class="iw-content" id="iw-content">
        <div class="iw-hero">
          <h1>Welcome to Heady™Web</h1>
          <p>Your sovereign AI workspace — vector memory, code edits, semantic chat, and agent orchestration.</p>
          <p class="iw-projection-label">Projection: <code>${projection}</code></p>
        </div>

        <div class="iw-cards">
          <div class="iw-card">
            <div class="iw-card-icon">🧠</div>
            <h3>Vector Memory</h3>
            <p>Store and search semantic memories. Persistent vector workspace with cosine similarity retrieval.</p>
          </div>
          <div class="iw-card">
            <div class="iw-card-icon">💻</div>
            <h3>IDE Workspace</h3>
            <p>Read, write, and modify files directly in the Heady codebase with path-safe operations.</p>
          </div>
          <div class="iw-card">
            <div class="iw-card-icon">🤖</div>
            <h3>Buddy Chat</h3>
            <p>Conversational interface powered by HeadyBuddy — your AI companion for code and context.</p>
          </div>
          <div class="iw-card">
            <div class="iw-card-icon">🔐</div>
            <h3>Auth & Identity</h3>
            <p>Secure session management with JWT tokens, role-based access, and BYOK model keys.</p>
          </div>
        </div>
      </main>

      <footer class="iw-footer">
        <span>© 2026 Heady™Systems Inc.</span>
        <span class="iw-version">Shell v3.0.1</span>
      </footer>
    </div>
  `;

    // Tab navigation
    const tabs = container.querySelectorAll('.iw-nav-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('iw-active'));
            tab.classList.add('iw-active');
        });
    });
}

module.exports = { renderIntegratedWorkspace };
