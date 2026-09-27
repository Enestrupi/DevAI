const APP_VERSION = 26;
const API = location.origin.startsWith('http') ? location.origin.replace(/\/$/,'') : 'http://127.0.0.1:42069';

let ws=null, connected=false, studioConnected=false;
let state = {
  model: localStorage.getItem('devai_model')||'auto',
  mode: 'build',
  convs: JSON.parse(localStorage.getItem('devai_convs')||'null')||[{id:'c1',title:'New Chat',messages:[]}],
  convId: localStorage.getItem('devai_conv')||'c1',
  history: [],
  pendingActions: {},  // actionId -> {meta, approved/rejected}
  currentAI: null,
  currentDeltaMsg: null,
  models: [],
  context: {selection:null, script:null, tree:null, output:[]},
};

document.addEventListener('DOMContentLoaded',()=>{
  marked.setOptions({gfm:true,breaks:true});
  connectWS();
  renderConvs();renderChat();renderSettings();
  document.querySelectorAll('.ctx-item input').forEach(c=>c.addEventListener('change',()=>{}));
  setInterval(checkHealth, 3000);
  checkHealth();
});

function connectWS(){
  try{
    // Always connect to local backend (must run on user's PC via start-devai.bat)
    ws = new WebSocket('ws://127.0.0.1:42069/ws');
    ws.onopen=()=>{connected=true;setBackend(true);wsSend({type:'get_models'});wsSend({type:'get_keys'});wsSend({type:'get_history'});};
    ws.onclose=()=>{connected=false;setBackend(false);setStudioConn(false);setTimeout(connectWS,1500);};
    ws.onerror=()=>{setBackend(false);};
    ws.onmessage=(e)=>{try{handleMsg(JSON.parse(e.data));}catch(err){console.error(err);}};
  }catch(e){setBackend(false);setTimeout(connectWS,2000);}
}
function wsSend(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}
function checkHealth(){fetch(API+'/api/health').then(r=>r.json()).then(j=>{setBackend(true);setStudioConn(!!j.connected);}).catch(()=>setBackend(false));fetch(API+'/api/models').then(r=>r.json()).then(j=>{state.models=j.models||[];renderModels();renderSettings();}).catch(()=>{});}

function handleMsg(m){
  switch(m.type){
    case 'hello': toast('Connected to DevAI backend v'+m.version,'ok'); break;
    case 'studio_status': setStudioConn(m.connected); break;
    case 'pair_code': document.getElementById('pairCode').textContent=m.code;toast('📋 Pairing code generated — paste in plugin','ok');navigator.clipboard&&navigator.clipboard.writeText(m.code).catch(()=>{});break;
    case 'ai_meta': startAIMsg(m); break;
    case 'ai_delta': appendDelta(m.delta); break;
    case 'ai_done': finishAIMsg(); break;
    case 'action_queued': showAction(m.action); break;
    case 'action_updated': updateActionStatus(m.actionId,m.status); break;
    case 'action_result': finishAction(m); break;
    case 'project_tree': state.context.tree=m.tree;toast('📥 Project tree received','ok');break;
    case 'script': state.context.script=m.data;toast('📥 Script received: '+m.data.path,'ok');break;
    case 'selection': state.context.selection=m.data;toast('📥 Selection: '+m.data.path,'ok');break;
    case 'scan': showScan(m.data);break;
    case 'output_line': appendOutput(m.line);break;
    case 'output_cleared': document.getElementById('outBox').innerHTML='';break;
    case 'keys': renderSettings();break;
    case 'models': state.models=m.models;renderModels();renderSettings();break;
    case 'history': state.history=m.history||[];renderHistory();break;
    case 'error': toast(m.error,'err');break;
  }
}

function setBackend(on){
  document.getElementById('connDot').classList.toggle('on',on);
  document.getElementById('connLabel').textContent=on?'Backend: ON':'Backend: OFF';
  document.getElementById('backendErr').classList.toggle('show',!on);
}
function setStudioConn(on){
  studioConnected=on;
  document.getElementById('studioDot').classList.toggle('on',on);
  document.getElementById('studioLabel').textContent=on?'Studio: ON':'Studio: OFF';
  const b=document.getElementById('studioBig');if(b){b.className='big-status '+(on?'on':'off');b.innerHTML=`<span class="pulse"></span><span>${on?'● Connected to Roblox Studio':'Waiting for Studio…'}</span>`;}
}

/* ========= NAV ========= */
function showPage(p){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  document.querySelectorAll('.page').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
}

/* ========= CHAT ========= */
function currentConv(){return state.convs.find(c=>c.id===state.convId);}
function renderChat(){
  const conv=currentConv();document.getElementById('chatTitle').textContent=conv.title;
  const box=document.getElementById('chatMsgs');if(conv.messages.length===0){box.innerHTML=welcomeMsg();return;}
  box.innerHTML='';conv.messages.forEach(m=>box.appendChild(renderMsg(m)));box.scrollTop=box.scrollHeight;
}
function welcomeMsg(){
  return `<div class="msg ai"><div class="msg-bubble"><div class="ai-badge"><div class="ai-avatar">⚔</div><span class="ai-name">DevAI ready</span></div>
  <p>Hi 👋 I'm DevAI — your Roblox Studio copilot. Build a system, fix bugs, scan your project.</p>
  <p>Try:</p><ul>
  <li><code class="inline-code">/create inventory system with DataStore saving</code></li>
  <li><code class="inline-code">Create a round-based PvP system</code></li>
  <li><code class="inline-code">Fix the Output errors in my project</code></li></ul>
  <p style="color:var(--muted);font-size:12px;margin-top:10px">👉 1) Start the backend (<code class="inline-code">start-devai.bat</code>). 2) Open plugin and pair. 3) Code away.</p></div></div>`;
}
function renderMsg(m){
  const w=document.createElement('div');w.className='msg '+m.role;const b=document.createElement('div');b.className='msg-bubble';
  if(m.role==='ai'){
    const model=m.model?state.models.find(x=>x.id===m.model):null;
    const n=model?model.name:(m.modelName||'DevAI');const p=model?model.provider:'';const bst=model?model.best:'';
    b.innerHTML=`<div class="ai-badge"><div class="ai-avatar">⚔</div>
      <span class="ai-name">AI: ${n}</span>${bst?`<span class="ai-best">Best for: ${bst.split(',')[0]}</span>`:''}
      ${m.why?`<span class="ai-why">${m.why}</span>`:''}
      ${p?`<span class="ai-provider">${p}</span>`:''}</div><div class="msg-content">${m.html||m.text||''}</div>`;
  } else b.textContent=m.text;
  w.appendChild(b);return w;
}

function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px'}
function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}}
function sendMsg(){
  const inp=document.getElementById('userInput');const text=inp.value.trim();if(!text)return;
  inp.value='';inp.style.height='auto';
  const conv=currentConv();
  if(conv.messages.length===0){conv.title=text.slice(0,40)+(text.length>40?'…':'');renderConvs();}
  conv.messages.push({role:'user',text});
  // gather context
  const ctx={};
  if(document.getElementById('ctx1').checked)ctx.selection=state.context.selection;
  if(document.getElementById('ctx2').checked)ctx.script=state.context.script;
  if(document.getElementById('ctx3').checked)ctx.tree=state.context.tree?truncate(state.context.tree,2000):null;
  if(document.getElementById('ctx4').checked)ctx.errors=state.context.output.filter(l=>l.level==='error').slice(-20);
  wsSend({type:'chat',messages:conv.messages.map(m=>({role:m.role,content:m.text})),model:state.model,context:ctx,mode:state.mode});
  state.currentDeltaMsg=null;
  renderChat();
  document.getElementById('sendBtn').disabled=true;
}
function truncate(o,max){const s=JSON.stringify(o);return s.length>max?s.slice(0,max)+'…':o;}
function startAIMsg(meta){
  const conv=currentConv();
  state.currentDeltaMsg={role:'ai',modelName:meta.model,model:state.model,why:meta.why,text:'',html:''};
  conv.messages.push(state.currentDeltaMsg);
  renderChat();
}
function appendDelta(delta){
  if(!state.currentDeltaMsg)return;
  state.currentDeltaMsg.text+=delta;
  // render progressively (full markdown each update)
  state.currentDeltaMsg.html=renderMarkdownWithCode(state.currentDeltaMsg.text);
  renderChat();
}
function finishAIMsg(){
  document.getElementById('sendBtn').disabled=false;
  if(state.currentDeltaMsg)state.currentDeltaMsg.html=renderMarkdownWithCode(state.currentDeltaMsg.text);
  saveConvs();renderChat();
}
function stopGen(){toast('Stop requested','warn');}
function setMode(m){state.mode=m;document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));}

/* ========= MARKDOWN / CODE BLOCKS ========= */
function renderMarkdownWithCode(text){
  const blocks=[];
  const pre=text.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g,(mm,lang,code)=>{blocks.push({lang:lang||'',code:code.trimEnd()});return`%%CB${blocks.length-1}%%`;});
  let html=marked.parse(pre);
  html=html.replace(/%%CB(\d+)%%/g,(_,i)=>{
    const b=blocks[+i];const loc=b.code.match(/^--\s*@location\s+(\S+)/i);
    const shown=b.code.replace(/^--\s*@location\s+\S+\s*\n/i,'');
    let hl=shown;try{hl=hljs.highlight(shown,{language:b.lang==='lua'?'lua':'javascript'}).value;}catch(e){}
    const pathLabel=loc?`<span class="code-path">${loc[1]}</span>`:'';
    const sendBtn=b.lang==='lua'||loc?`<button class="code-act send" onclick="queueSend(this)">📤 Send to Studio</button>`:'';
    return `<div class="code-block" data-lang="${b.lang}" data-code="${encodeURIComponent(b.code)}" ${loc?`data-path="${loc[1]}"`:''}>
      <div class="code-head"><span class="code-lang">${b.lang||'code'}</span>${pathLabel}
      <div class="code-actions"><button class="code-act" onclick="copyBlock(this)">📋 Copy</button>${sendBtn}<button class="code-act" onclick="previewBlock(this)">👁 Preview</button></div></div>
      <pre><code>${hl}</code></pre></div>`;
  });
  return html;
}
function copyBlock(btn){const b=btn.closest('.code-block');navigator.clipboard.writeText(decodeURIComponent(b.dataset.code)).then(()=>toast('📋 Copied','ok'));}
function previewBlock(btn){
  const b=btn.closest('.code-block');const code=decodeURIComponent(b.dataset.code);const path=b.dataset.path||'(unknown)';
  document.getElementById('diffMeta').innerHTML=`<b>Preview:</b> <span style="color:var(--citrus);font-family:var(--mono)">${path}</span>`;
  document.getElementById('diffBox').textContent=code;
  document.getElementById('diffApply').style.display='none';document.getElementById('diffReject').style.display='none';
  document.getElementById('diffModal').classList.add('open');
}
function closeDiff(){document.getElementById('diffModal').classList.remove('open');}
function queueSend(btn){
  const b=btn.closest('.code-block');const code=decodeURIComponent(b.dataset.code);let path=b.dataset.path;
  if(!path)path=guessPath(code);
  const parts=path.split('.');const parent=parts.slice(0,-1).join('.');const name=parts[parts.length-1];
  const type=guessType(code,name);
  const confirmOn=document.getElementById('setConfirm')?.checked!==false;
  // Default op is create_instance; if user says it's an update we'd switch, but create + replace is safe in Studio via new instance
  const action={op:'create_instance',params:{className:type,parent,name,source:code}};
  const meta={path,name,type,code};
  if(confirmOn){
    showDiffModal('create_instance',meta,()=>{wsSend({type:'send_to_studio',action});toast('📤 Sent create '+name+' → '+parent,'ok');},()=>{toast('Cancelled','warn');});
  }else{wsSend({type:'send_to_studio',action});toast('📤 Sent create '+name+' → '+parent,'ok');}
}
function showDiffModal(op,meta,onApply,onReject){
  document.getElementById('diffMeta').innerHTML=`<b style="color:var(--amber)">${op.toUpperCase()}</b> · <span style="font-family:var(--mono);color:var(--text)">${meta.path}</span> <span style="color:var(--muted)">(${meta.type})</span>`;
  const diff = simpleDiff(null,meta.code);
  document.getElementById('diffBox').innerHTML=diff;
  const apply=document.getElementById('diffApply');const rej=document.getElementById('diffReject');
  apply.style.display='';rej.style.display='';apply.textContent='Apply';
  apply.onclick=()=>{closeDiff();onApply&&onApply();};
  rej.onclick=()=>{closeDiff();onReject&&onReject();};
  document.getElementById('diffModal').classList.add('open');
}
function simpleDiff(oldSrc,newSrc){
  if(!oldSrc){return newSrc.split('\n').map(l=>`<span class="diff-add">+ ${escapeHtml(l)}</span>`).join('');}
  const o=oldSrc.split('\n'),n=newSrc.split('\n');
  let out='';const max=Math.max(o.length,n.length);
  for(let i=0;i<max;i++){
    if(o[i]===n[i])out+=`<span class="diff-ctx">  ${escapeHtml(n[i]||'')}</span>`;
    else{if(o[i]!==undefined)out+=`<span class="diff-del">- ${escapeHtml(o[i])}</span>`;if(n[i]!==undefined)out+=`<span class="diff-add">+ ${escapeHtml(n[i])}</span>`;}
  }
  return out;
}
function guessPath(code){
  if(code.includes('LocalScript')||code.includes('UserInputService')||code.includes('PlayerGui'))return'StarterPlayerScripts.Client';
  if(code.includes('ModuleScript')||/return\s+\{/.test(code))return'ReplicatedStorage.Modules.Module';
  return'ServerScriptService.Script';
}
function guessType(code,name){if(code.includes('LocalScript'))return'LocalScript';if(code.includes('ModuleScript')||/return\s+\{/.test(code))return'ModuleScript';return'Script';}

function showAction(a){state.pendingActions[a.id]=a;renderActionCard(a);}
function renderActionCard(a){
  const box=document.getElementById('chatMsgs');
  const card=document.createElement('div');card.className='msg ai';card.id='action-'+a.id;
  card.innerHTML=`<div class="msg-bubble" style="border-color:var(--amber)"><div class="action-card">
    <h4>⚡ Studio Action <span class="action-status pending">pending</span></h4>
    <div class="action-path">${a.op} · ${a.params.name||a.params.path||''}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Parent: ${a.params.parent||''}</div>
    <div style="display:flex;gap:6px">
      <button class="code-act send" onclick="approveAction(${a.id},true)">✓ Apply</button>
      <button class="code-act" onclick="approveAction(${a.id},false)">✕ Cancel</button>
    </div></div></div>`;
  box.appendChild(card);box.scrollTop=box.scrollHeight;
}
function approveAction(id,ok){wsSend({type:'approve_action',actionId:id,approved:ok});updateActionStatus(id,ok?'queued':'cancelled');}
function updateActionStatus(id,status){
  const el=document.getElementById('action-'+id);if(!el)return;
  const s=el.querySelector('.action-status');if(s){s.className='action-status '+status;s.textContent=status;}
}
function finishAction(m){
  updateActionStatus(m.actionId,m.success?'done':'failed');
  const el=document.getElementById('action-'+m.actionId);if(!el)return;
  const note=document.createElement('div');note.style.cssText='margin-top:8px;font-size:11px;color:'+(m.success?'var(--green)':'var(--red)');
  note.textContent=m.success?('✓ '+m.path):('✗ '+m.error);
  el.querySelector('.action-card').appendChild(note);
  state.history.unshift({ts:Date.now(),actionId:m.actionId,success:m.success,path:m.path,error:m.error});renderHistory();
}

/* ========= PAIR / STUDIO ========= */
function genPairCode(){wsSend({type:'generate_pair'});}
function sendAction(action){
  if(!connected){toast('Backend not running — start start-devai.bat','err');return;}
  if(!studioConnected && !['get_project_tree','get_selection','get_script','get_output','scan_project'].includes(action.op)){toast('Studio not connected','err');return;}
  wsSend({type:'send_to_studio',action});
  toast('📤 Queued: '+action.op,'ok');
}
function reqScan(){wsSend({type:'send_to_studio',action:{op:'scan_project'}});showPage('scan');toast('📤 Scan requested from Studio','ok');}
function startOutput(){wsSend({type:'send_to_studio',action:{op:'get_output',subscribe:true}});showPage('output');toast('📤 Requesting output stream — toggle button in plugin if it does not start','ok');}
function showScan(d){
  const keys=['Script','LocalScript','ModuleScript','RemoteEvent','RemoteFunction','Folder','Model','Part'];
  const labels=['Scripts','LocalScripts','ModuleScripts','RemoteEvents','RemoteFns','Folders','Models','Parts'];
  const grid=document.getElementById('scanGrid');
  grid.innerHTML=keys.map((k,i)=>`<div class="scan-stat"><div class="n">${d[k]||0}</div><div class="lbl">${labels[i]}</div></div>`).join('');
}
function appendOutput(line){
  const box=document.getElementById('outBox');
  const d=document.createElement('div');d.className='out-line '+(line.level==='error'?'err':line.level==='warn'?'warn':'ok');
  d.textContent=`[${new Date(line.ts).toLocaleTimeString()}] ${line.message}`;
  box.appendChild(d);box.scrollTop=box.scrollHeight;
  state.context.output.push(line);if(state.context.output.length>200)state.context.output.shift();
}
function fixErrors(){
  const errs=Array.from(document.querySelectorAll('#outBox .out-line.err')).map(e=>e.textContent).join('\n');
  if(!errs){toast('No errors captured.','err');return;}
  document.getElementById('userInput').value='/fix\n'+errs;sendMsg();
}

/* ========= HISTORY ========= */
function renderHistory(){
  const box=document.getElementById('histList');if(!box)return;
  if(!state.history.length){box.innerHTML='<p style="color:var(--muted);font-size:12px">No changes yet.</p>';}
  else box.innerHTML=state.history.slice(0,100).map(h=>`<div class="int-item"><div class="int-icon">${h.success?'✓':'✗'}</div>
    <div class="int-info"><h4>${h.op||'action'} #${h.actionId} — ${h.path||''}</h4><p>${new Date(h.ts).toLocaleString()} ${h.error?'· '+h.error:''}</p></div>
    <span class="int-status ${h.success?'on':'off'}">${h.success?'done':'failed'}</span></div>`).join('');
  showRecentActivity();updateStudioStatusUI();
}

/* ========= MODELS ========= */
function renderModels(){
  const grid=document.getElementById('modelGrid');if(!grid||!state.models.length)return;
  const card=m=>{const cfg=m.configured!==false;return`<div class="model-card ${m.id===state.model?'sel':''}" onclick="selectModel('${m.id}')">
    <h4>${m.name} <span class="config ${cfg?'on':'off'}">${cfg?'READY':'NO KEY'}</span></h4><div class="provider">${m.provider}</div>
    <div class="best">${m.best}</div>
    <div style="margin-top:8px"><button class="code-act ${m.id===state.model?'send':''}" onclick="event.stopPropagation();selectModel('${m.id}')">${m.id===state.model?'✓ Selected':'Select'}</button></div></div>`;};
  grid.innerHTML=state.models.map(card).join('');
  document.getElementById('modelPill').textContent=(state.models.find(x=>x.id===state.model)||{}).name||'Auto';
  toggleDrawer(false);
}
function selectModel(id){state.model=id;localStorage.setItem('devai_model',id);renderModels();}
function toggleDrawer(force){const d=document.getElementById('modelDrawer');if(typeof force==='boolean')d.classList.toggle('open',force);else d.classList.toggle('open');if(d.classList.contains('open'))document.getElementById('ctxPanel').classList.remove('open');}
function toggleCtx(){const d=document.getElementById('ctxPanel');d.classList.toggle('open');if(d.classList.contains('open'))document.getElementById('modelDrawer').classList.remove('open');}

/* ========= CONVERSATIONS ========= */
function renderConvs(){
  const list=document.getElementById('convList');list.innerHTML='';
  state.convs.forEach(c=>{const d=document.createElement('div');d.className='conv-item'+(c.id===state.convId?' active':'');d.textContent='💬 '+(c.title||'New Chat');d.onclick=()=>{state.convId=c.id;localStorage.setItem('devai_conv',c.id);renderChat();renderConvs();};list.appendChild(d);});
}
function newChat(){const id='c'+Date.now();state.convs.unshift({id,title:'New Chat',messages:[]});state.convId=id;localStorage.setItem('devai_conv',id);saveConvs();renderConvs();renderChat();}
function saveConvs(){localStorage.setItem('devai_convs',JSON.stringify(state.convs));}

/* ========= SETTINGS / KEYS ========= */
const PROVIDERS=[{id:'openai',name:'OpenAI (GPT-4o, GPT-4o Mini)',ph:'sk-...'},{id:'anthropic',name:'Anthropic (Claude Sonnet)',ph:'sk-ant-...'},{id:'google',name:'Google Gemini',ph:'AIza...'},{id:'deepseek',name:'DeepSeek (free tier available)',ph:'sk-...'},{id:'groq',name:'Groq (free tier, fast)',ph:'gsk_...'}];
function renderSettings(){
  const list=document.getElementById('keyList');if(!list)return;
  list.innerHTML=PROVIDERS.map(p=>{
    const has=state.keyState&&state.keyState[p.id];
    return `<div class="int-item"><div class="int-icon">🔑</div><div class="int-info"><h4>${p.name}</h4><p>${has?'● Key saved on backend':'○ Not configured'}</p></div>
    <input type="password" class="int-input" data-prov="${p.id}" placeholder="${p.ph}"></div>`;}).join('');
  const dd=document.getElementById('setModel');if(dd&&state.models.length){dd.innerHTML=state.models.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');dd.value=state.model;}
}
function saveKeys(){
  const keys={};document.querySelectorAll('[data-prov]').forEach(inp=>{if(inp.value.trim())keys[inp.dataset.prov]=inp.value.trim();});
  wsSend({type:'save_keys',keys});toast('💾 Keys sent to backend (stored locally on your machine)','ok');
  setTimeout(()=>{wsSend({type:'get_models'});wsSend({type:'get_keys'});},500);
}

/* Handle key state update from models messages */
const _origHandle=handleMsg;
handleMsg=function(m){
  if(m.type==='models'){
    state.keyState={};
    (m.models||[]).forEach(x=>{
      const pid={'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llama':'groq'}[x.id];
      if(pid&&x.configured)state.keyState[pid]=true;
    });
    renderSettings();
  }
  _origHandle(m);
};

/* ========= UTILS ========= */
function newProject(){
  const name=prompt('Project name?');if(!name)return;
  document.getElementById('curProjName').textContent=name;
  toast('Project "'+name+'" created','ok');
}
function showRecentActivity(){
  const box=document.getElementById('recentActivity');if(!box)return;
  if(!state.history.length){box.innerHTML='<p style="color:var(--muted);font-size:12px">Activity will appear after you send scripts to Studio.</p>';return;}
  box.innerHTML=state.history.slice(0,10).map(h=>{
    const d=new Date(h.ts);
    return `<div class="int-item"><div class="int-icon">${h.success?'✓':'✗'}</div>
    <div class="int-info"><h4>${h.op||'action'} — ${h.path||''}</h4><p>${d.toLocaleString()} ${h.error?'· '+h.error:''}</p></div>
    <span class="int-status ${h.success?'on':'off'}">${h.success?'done':'failed'}</span></div>`;
  }).join('');
}
function updateStudioStatusUI(){
  document.getElementById('curProjStatus').textContent=studioConnected?'Connected':'Disconnected';
  document.getElementById('curProjStatus').style.color=studioConnected?'var(--green)':'var(--red)';
  document.getElementById('curProjChanges').textContent=state.history.filter(h=>h.ts>Date.now()-86400000).length;
}
const _setStudioConn=setStudioConn;setStudioConn=function(on){_setStudioConn(on);updateStudioStatusUI();};

