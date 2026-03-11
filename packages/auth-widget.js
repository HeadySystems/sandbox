/**
 * HEADY™ Auth Widget — Centralized Authentication Launcher
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 *
 * Security model:
 * - Authentication happens only on auth.headysystems.com
 * - No browser storage or client-managed auth tokens
 * - State and nonce are generated per launch
 * - Local sites redirect to the central auth domain for sign-in
 */

const DEFAULT_ALLOWED_HOSTS = [
  'headyme.com',
  'headysystems.com',
  'heady-ai.com',
  'headyos.com',
  'headyconnection.org',
  'headyconnection.com',
  'headyex.com',
  'headyfinance.com',
  'admin.headysystems.com',
  'auth.headysystems.com',
];

function createRandomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

function isAllowedReturnUrl(url) {
  try {
    const parsed = new URL(url);
    return DEFAULT_ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

class HeadyAuthWidget {
  constructor(options = {}) {
    this.opts = {
      authEndpoint: options.authEndpoint || 'https://auth.headysystems.com',
      siteId: options.siteId || 'headysystems',
      accentColor: options.accentColor || '#7c5eff',
      onLaunch: options.onLaunch || null,
      position: options.position || 'top-right',
      ...options,
    };
    this.panelOpen = false;
    this.init();
  }

  init() {
    this.renderTrigger();
    this.renderPanel();
  }

  buildAuthUrl(mode = 'login') {
    const redirect = window.location.href;
    if (!isAllowedReturnUrl(redirect)) {
      throw new Error(`Refusing auth launch for non-allowlisted return URL: ${redirect}`);
    }

    const url = new URL('/login', this.opts.authEndpoint);
    url.searchParams.set('mode', mode);
    url.searchParams.set('redirect', redirect);
    url.searchParams.set('site', this.opts.siteId);
    url.searchParams.set('state', createRandomToken());
    url.searchParams.set('nonce', createRandomToken());
    return url.toString();
  }

  launch(mode = 'login') {
    const target = this.buildAuthUrl(mode);
    if (typeof this.opts.onLaunch === 'function') {
      this.opts.onLaunch({ mode, target, siteId: this.opts.siteId });
    }
    window.location.href = target;
  }

  renderTrigger() {
    this.trigger = document.createElement('button');
    this.trigger.className = 'heady-auth-trigger';
    this.trigger.type = 'button';
    this.trigger.setAttribute('aria-label', 'Open Heady auth');
    this.trigger.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>`;
    this.trigger.addEventListener('click', () => this.togglePanel());
    document.body.appendChild(this.trigger);
  }

  renderPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'heady-auth-panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="heady-auth-panel-card glass">
        <div class="heady-auth-panel-header">
          <div class="heady-auth-logo">HEADY</div>
          <p>Central authentication routes through auth.headysystems.com.</p>
        </div>
        <div class="heady-auth-actions">
          <button type="button" class="heady-auth-action primary" data-mode="login">Sign In</button>
          <button type="button" class="heady-auth-action secondary" data-mode="signup">Create Account</button>
        </div>
        <div class="heady-auth-meta">
          <div>Cookie model: httpOnly · Secure · SameSite=Strict</div>
          <div>Return site: ${this.opts.siteId}</div>
        </div>
      </div>
    `;

    this.panel.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.launch(btn.dataset.mode));
    });

    document.addEventListener('click', event => {
      if (!this.panelOpen) return;
      const insidePanel = this.panel.contains(event.target);
      const insideTrigger = this.trigger.contains(event.target);
      if (!insidePanel && !insideTrigger) this.closePanel();
    });

    document.body.appendChild(this.panel);
  }

  togglePanel() {
    this.panelOpen ? this.closePanel() : this.openPanel();
  }

  openPanel() {
    this.panelOpen = true;
    this.panel.hidden = false;
    this.panel.classList.add('active');
  }

  closePanel() {
    this.panelOpen = false;
    this.panel.classList.remove('active');
    this.panel.hidden = true;
  }
}

const authStyles = document.createElement('style');
authStyles.textContent = `
.heady-auth-trigger{position:fixed;top:13px;right:21px;z-index:999;width:40px;height:40px;border-radius:50%;background:rgba(13,13,26,.65);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.08);color:#e8e8f0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .382s cubic-bezier(.16,1,.3,1)}
.heady-auth-trigger:hover{border-color:rgba(255,255,255,.14);background:rgba(17,17,38,.75)}
.heady-auth-panel{position:fixed;top:60px;right:21px;z-index:10000;width:min(320px,calc(100vw - 32px))}
.heady-auth-panel-card{background:rgba(13,13,26,.92);backdrop-filter:blur(40px);border:1px solid rgba(255,255,255,.08);border-radius:21px;padding:21px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.heady-auth-panel-header{margin-bottom:16px}
.heady-auth-logo{font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;letter-spacing:4px;background:linear-gradient(135deg,#7c5eff,#40e0d0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.heady-auth-panel-header p{color:#9898b0;font-size:.875rem;line-height:1.5}
.heady-auth-actions{display:grid;grid-template-columns:1fr;gap:10px}
.heady-auth-action{padding:12px 14px;border-radius:10px;font-size:.9rem;font-weight:600;border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:all .2s;font-family:inherit}
.heady-auth-action.primary{background:#7c5eff;color:#fff}
.heady-auth-action.primary:hover{transform:translateY(-1px);box-shadow:0 0 21px rgba(124,94,255,.3)}
.heady-auth-action.secondary{background:rgba(255,255,255,.03);color:#e8e8f0}
.heady-auth-action.secondary:hover{background:rgba(255,255,255,.06)}
.heady-auth-meta{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);display:grid;gap:6px;color:#7d7d99;font-size:.72rem}
`;
document.head.appendChild(authStyles);

if (typeof window !== 'undefined') {
  window.HeadyAuthWidget = HeadyAuthWidget;
}

export { HeadyAuthWidget };
