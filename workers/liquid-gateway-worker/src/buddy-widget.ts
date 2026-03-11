/**
 * HeadyBuddy Widget — Inline injection script
 * Injected into every HTML page served by the gateway.
 * Context-aware, auth-aware, workspace-persistent.
 */

export function getBuddyWidgetScript(): string {
  return `<script data-heady="buddy-widget">(function(){
'use strict';
var PHI=1.6180339887498949,PSI=0.6180339887498949;
var API=location.origin+'/api/brain/chat';
var host=location.hostname;
var token=(document.cookie.match(/heady_token=([^;]+)/)||[])[1]||'';
var deviceId=localStorage.getItem('heady_device_id');
if(!deviceId){deviceId=crypto.randomUUID?crypto.randomUUID():Date.now().toString(36);localStorage.setItem('heady_device_id',deviceId)}
var wsId='vw:'+host+':'+(token?token.slice(0,16):'anon')+':'+deviceId.slice(0,8);
var histKey='buddy:'+host+':'+(token?token.slice(0,12):'anon');
var history=JSON.parse(localStorage.getItem(histKey)||'[]').slice(-34);

function save(){localStorage.setItem(histKey,JSON.stringify(history.slice(-34)))}

var fab=document.createElement('div');
fab.id='heady-buddy-fab';
fab.innerHTML='\\u{1F9E0}';
fab.title='HeadyBuddy';
Object.assign(fab.style,{position:'fixed',bottom:'21px',right:'21px',width:'55px',height:'55px',borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#4ecdc4)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'24px',boxShadow:'0 4px 21px rgba(108,99,255,0.4)',zIndex:'99999',transition:'transform 0.3s',userSelect:'none'});
fab.addEventListener('mouseenter',function(){fab.style.transform='scale(1.1)'});
fab.addEventListener('mouseleave',function(){fab.style.transform='scale(1)'});

var panel=document.createElement('div');
panel.id='heady-buddy-panel';
Object.assign(panel.style,{position:'fixed',bottom:'89px',right:'21px',width:'370px',maxHeight:'520px',background:'#0a0a0f',border:'1px solid #1e1e2e',borderRadius:'13px',boxShadow:'0 8px 34px rgba(0,0,0,0.6)',zIndex:'99998',display:'none',flexDirection:'column',overflow:'hidden',fontFamily:'-apple-system,sans-serif'});

panel.innerHTML='<div style="padding:13px 16px;background:#12121a;border-bottom:1px solid #1e1e2e;display:flex;justify-content:space-between;align-items:center"><div style="color:#e4e4ef;font-weight:600;font-size:14px">\\u{1F9E0} HeadyBuddy</div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:#4ecdc4;background:#12221a;padding:2px 8px;border-radius:8px">'+host+'</span><span id="hb-close" style="cursor:pointer;color:#8888a0;font-size:18px">\\u00D7</span></div></div><div id="hb-msgs" style="flex:1;overflow-y:auto;padding:13px;min-height:300px;max-height:380px"></div><div style="padding:8px 13px;border-top:1px solid #1e1e2e;display:flex;gap:8px"><input id="hb-input" type="text" placeholder="Ask Buddy anything..." style="flex:1;background:#12121a;border:1px solid #1e1e2e;border-radius:8px;padding:8px 13px;color:#e4e4ef;font-size:13px;outline:none"><button id="hb-send" style="background:#6c63ff;border:none;border-radius:8px;padding:8px 13px;color:white;cursor:pointer;font-size:13px">Send</button></div>';

var open=false;
fab.addEventListener('click',function(){
  open=!open;
  panel.style.display=open?'flex':'none';
  if(open&&!panel.dataset.loaded){panel.dataset.loaded='1';renderHistory()}
});

function renderHistory(){
  var c=panel.querySelector('#hb-msgs');c.innerHTML='';
  if(history.length===0){c.innerHTML='<div style="color:#8888a0;text-align:center;padding:34px 13px;font-size:13px;line-height:1.618">Welcome to HeadyBuddy \\u{1F9E0}<br><br>Your AI companion for the Heady\\u2122 Liquid Latent OS.<br>Ask me anything about this site, your workspace, or Heady services.</div>';return}
  history.forEach(function(m){addMsg(m.role,m.content,false)});
  c.scrollTop=c.scrollHeight;
}

function addMsg(role,text,scroll){
  var c=panel.querySelector('#hb-msgs');
  var d=document.createElement('div');
  d.style.cssText='margin-bottom:8px;padding:8px 13px;border-radius:8px;font-size:13px;line-height:1.618;max-width:85%;word-wrap:break-word;'+(role==='user'?'background:#1a1a2e;color:#e4e4ef;margin-left:auto;text-align:right':'background:#12121a;color:#e4e4ef;border:1px solid #1e1e2e');
  d.textContent=text;
  c.appendChild(d);
  if(scroll!==false)c.scrollTop=c.scrollHeight;
}

async function send(){
  var input=panel.querySelector('#hb-input');
  var msg=input.value.trim();if(!msg)return;
  input.value='';
  history.push({role:'user',content:msg});save();
  addMsg('user',msg);
  try{
    var res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-Heady-Device':deviceId,'X-Heady-Workspace':wsId},body:JSON.stringify({message:msg,history:history.slice(-4).map(function(m){return{role:m.role,content:m.content}}),context:{site:host,workspaceId:wsId,channel:'buddy-chat',vector3d:true,phi:PHI}})});
    var data=await res.json();
    var reply=data.response||data.message||'I\\'m here to help.';
    history.push({role:'assistant',content:reply});save();
    addMsg('assistant',reply);
  }catch(e){
    addMsg('assistant','Connection issue — Heady services are recalibrating.');
  }
}

document.body.appendChild(fab);
document.body.appendChild(panel);
panel.querySelector('#hb-close').addEventListener('click',function(){open=false;panel.style.display='none'});
panel.querySelector('#hb-send').addEventListener('click',send);
panel.querySelector('#hb-input').addEventListener('keydown',function(e){if(e.key==='Enter')send()});
})()</script>`;
}
