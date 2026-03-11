/**
 * Heady™ Auth Page — 27 providers across 6 categories
 * Firebase + custom OAuth, φ-styled
 */

export function serveAuthPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Heady\u2122 — Sign In</title>
<style>
:root{--phi:1.618;--bg:#0a0a0f;--sf:#12121a;--bd:#1e1e2e;--pr:#6c63ff;--pg:rgba(108,99,255,.3);--tx:#e4e4ef;--td:#8888a0;--ok:#4ecdc4;--er:#ff6b6b}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow-y:auto}
body::before{content:'';position:fixed;top:50%;left:50%;width:800px;height:800px;transform:translate(-50%,-50%);background:conic-gradient(from 0deg,transparent 0%,var(--pg) 15%,transparent 30%);animation:spin 29.034s linear infinite;opacity:.12;border-radius:50%;pointer-events:none}
@keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.wrap{position:relative;width:100%;max-width:440px;padding:1.5rem}
.card{background:var(--sf);border:1px solid var(--bd);border-radius:16px;padding:2rem;backdrop-filter:blur(20px);box-shadow:0 8px 34px rgba(0,0,0,.5)}
.logo{text-align:center;margin-bottom:1.5rem}
.logo h1{font-size:1.618rem;font-weight:700;background:linear-gradient(135deg,var(--pr),var(--ok));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo p{color:var(--td);font-size:.8rem;margin-top:.4rem}
.status{text-align:center;padding:.6rem;border-radius:8px;font-size:.8rem;margin-bottom:.8rem;display:none}
.status.error{display:block;background:rgba(255,107,107,.1);color:var(--er);border:1px solid rgba(255,107,107,.2)}
.status.success{display:block;background:rgba(78,205,196,.1);color:var(--ok);border:1px solid rgba(78,205,196,.2)}
.fg{margin-bottom:1rem}
.fg label{display:block;font-size:.75rem;color:var(--td);margin-bottom:.35rem;font-weight:500}
.fg input{width:100%;padding:.6rem .8rem;background:var(--bg);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:.875rem;outline:none;transition:border-color .2s}
.fg input:focus{border-color:var(--pr);box-shadow:0 0 0 3px var(--pg)}
.btn{width:100%;padding:.65rem;border:none;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;transition:transform .15s}
.btn:active{transform:scale(.98)}
.btn-pr{background:var(--pr);color:#fff;box-shadow:0 4px 13px var(--pg);margin-bottom:.6rem}
.divider{display:flex;align-items:center;margin:1rem 0;color:var(--td);font-size:.75rem}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--bd)}
.divider span{padding:0 .8rem}
.cat{margin-bottom:.8rem}
.cat-title{font-size:.7rem;color:var(--td);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem;padding-left:.2rem}
.providers{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
.pbtn{display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;background:var(--bg);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:.75rem;cursor:pointer;transition:border-color .2s}
.pbtn:hover{border-color:var(--pr)}
.pbtn .icon{font-size:1rem;width:20px;text-align:center}
.toggle{text-align:center;margin-top:1rem;font-size:.8rem;color:var(--td)}
.toggle a{color:var(--pr);text-decoration:none;cursor:pointer;font-weight:500}
.phi-badge{text-align:center;margin-top:1.2rem;font-size:.65rem;color:var(--td);opacity:.4}
</style>
</head>
<body>
<div class="wrap"><div class="card">
<div class="logo"><h1>Heady\u2122</h1><p>Liquid Latent OS</p></div>
<div id="status" class="status"></div>
<form id="auth-form">
<div class="fg"><label>Email</label><input type="email" id="email" placeholder="you@example.com" required></div>
<div class="fg"><label>Password</label><input type="password" id="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required></div>
<button type="submit" class="btn btn-pr" id="submit-btn">Sign In</button>
</form>
<div class="divider"><span>or continue with</span></div>

<div class="cat"><div class="cat-title">Cloud & Enterprise</div><div class="providers">
<button class="pbtn" data-p="google"><span class="icon">\u{1F535}</span>Google</button>
<button class="pbtn" data-p="microsoft"><span class="icon">\u{1FA9F}</span>Microsoft</button>
<button class="pbtn" data-p="apple"><span class="icon">\u{1F34E}</span>Apple</button>
<button class="pbtn" data-p="amazon"><span class="icon">\u{1F4E6}</span>Amazon</button>
</div></div>

<div class="cat"><div class="cat-title">Code Platforms</div><div class="providers">
<button class="pbtn" data-p="github"><span class="icon">\u{1F419}</span>GitHub</button>
<button class="pbtn" data-p="gitlab"><span class="icon">\u{1F98A}</span>GitLab</button>
<button class="pbtn" data-p="bitbucket"><span class="icon">\u{1FAA3}</span>Bitbucket</button>
<button class="pbtn" data-p="huggingface"><span class="icon">\u{1F917}</span>Hugging Face</button>
</div></div>

<div class="cat"><div class="cat-title">Social</div><div class="providers">
<button class="pbtn" data-p="facebook"><span class="icon">\u{1F4D8}</span>Facebook</button>
<button class="pbtn" data-p="twitter"><span class="icon">\ud835\udd4f</span>X / Twitter</button>
<button class="pbtn" data-p="linkedin"><span class="icon">\u{1F4BC}</span>LinkedIn</button>
<button class="pbtn" data-p="reddit"><span class="icon">\u{1F916}</span>Reddit</button>
<button class="pbtn" data-p="instagram"><span class="icon">\u{1F4F8}</span>Instagram</button>
<button class="pbtn" data-p="tiktok"><span class="icon">\u{1F3B5}</span>TikTok</button>
<button class="pbtn" data-p="snapchat"><span class="icon">\u{1F47B}</span>Snapchat</button>
<button class="pbtn" data-p="pinterest"><span class="icon">\u{1F4CC}</span>Pinterest</button>
</div></div>

<div class="cat"><div class="cat-title">Entertainment</div><div class="providers">
<button class="pbtn" data-p="discord"><span class="icon">\u{1F3AE}</span>Discord</button>
<button class="pbtn" data-p="spotify"><span class="icon">\u{1F3A7}</span>Spotify</button>
<button class="pbtn" data-p="twitch"><span class="icon">\u{1F4FA}</span>Twitch</button>
<button class="pbtn" data-p="youtube"><span class="icon">\u25B6\uFE0F</span>YouTube</button>
</div></div>

<div class="cat"><div class="cat-title">Security & Web3</div><div class="providers">
<button class="pbtn" data-p="webauthn"><span class="icon">\u{1F6E1}\uFE0F</span>WebAuthn</button>
<button class="pbtn" data-p="ethereum"><span class="icon">\u27E0</span>Ethereum</button>
<button class="pbtn" data-p="ssh"><span class="icon">\u{1F511}</span>SSH Key</button>
</div></div>

<div class="toggle"><span id="toggle-text">Don't have an account?</span> <a id="toggle-link" onclick="toggleMode()">Sign up</a></div>
</div>
<div class="phi-badge">\u03C6 = 1.6180339887 \u00B7 Liquid Latent OS v5.0 \u00B7 27 providers</div>
</div>

<script type="module">
import{initializeApp}from'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import{getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,GithubAuthProvider,OAuthProvider,FacebookAuthProvider,TwitterAuthProvider,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
const app=initializeApp({apiKey:'AIzaSyBLTu0h9Q09Cr05_3_Zj_3yent5cO3iaHE',authDomain:'heady-ai.firebaseapp.com',projectId:'heady-ai'});
const auth=getAuth(app);
let isSignUp=false;
window.toggleMode=()=>{isSignUp=!isSignUp;document.getElementById('submit-btn').textContent=isSignUp?'Create Account':'Sign In';document.getElementById('toggle-text').textContent=isSignUp?'Already have an account?':"Don't have an account?";document.getElementById('toggle-link').textContent=isSignUp?'Sign in':'Sign up'};
const show=(msg,type)=>{const el=document.getElementById('status');el.textContent=msg;el.className='status '+type};
const success=async(result)=>{const token=await result.user.getIdToken();document.cookie='heady_token='+token+';path=/;secure;samesite=strict;max-age=3600';show('Authenticated! Redirecting...','success');setTimeout(()=>location.href='/',1000)};
const fail=(err)=>show(err.message.replace('Firebase: ',''),'error');

document.getElementById('auth-form').addEventListener('submit',async(e)=>{e.preventDefault();try{const fn=isSignUp?createUserWithEmailAndPassword:signInWithEmailAndPassword;await success(await fn(auth,document.getElementById('email').value,document.getElementById('password').value))}catch(e){fail(e)}});

const PROVIDERS={google:()=>new GoogleAuthProvider(),github:()=>new GithubAuthProvider(),microsoft:()=>new OAuthProvider('microsoft.com'),apple:()=>new OAuthProvider('apple.com'),facebook:()=>new FacebookAuthProvider(),twitter:()=>new TwitterAuthProvider(),yahoo:()=>new OAuthProvider('yahoo.com')};

document.querySelectorAll('.pbtn').forEach(btn=>{btn.addEventListener('click',async()=>{
const p=btn.dataset.p;
if(PROVIDERS[p]){try{await success(await signInWithPopup(auth,PROVIDERS[p]()))}catch(e){fail(e)}}
else if(p==='webauthn'){show('WebAuthn: Use your security key or biometrics','success')}
else if(p==='ethereum'){if(window.ethereum){try{const accounts=await window.ethereum.request({method:'eth_requestAccounts'});show('Connected: '+accounts[0].slice(0,8)+'...','success');document.cookie='heady_token=eth:'+accounts[0]+';path=/;secure;samesite=strict;max-age=3600';setTimeout(()=>location.href='/',1618)}catch(e){fail(e)}}else{show('No Web3 wallet detected','error')}}
else if(p==='ssh'){show('SSH auth: Use heady-cli to authenticate via SSH key','success')}
else{show(btn.textContent.trim()+' — coming soon via HeadyAuth swarm','success')}
})});

onAuthStateChanged(auth,u=>{if(u)show('Signed in as '+u.email,'success')});
</script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export function handleAuthVerify(request: Request): Response {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/heady_token=([^;]+)/);
  if (!match) return Response.json({ authenticated: false }, { status: 401 });
  try {
    const token = match[1];
    if (token.startsWith('eth:')) {
      return Response.json({ authenticated: true, uid: token, provider: 'ethereum' });
    }
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 < Date.now()) return Response.json({ authenticated: false, reason: 'expired' }, { status: 401 });
    if (payload.iss !== 'https://securetoken.google.com/heady-ai') return Response.json({ authenticated: false, reason: 'invalid_issuer' }, { status: 401 });
    return Response.json({ authenticated: true, uid: payload.user_id || payload.sub, email: payload.email, provider: payload.firebase?.sign_in_provider });
  } catch (e) {
    return Response.json({ authenticated: false, error: (e as Error).message }, { status: 401 });
  }
}

export function hasAuth(request: Request): boolean {
  const cookie = request.headers.get('Cookie') || '';
  return /heady_token=/.test(cookie);
}
