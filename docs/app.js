const APP_VERSION = 29;

let ws=null, connected=false, studioConnected=false;
let state = {
  model:localStorage.getItem('devai_model')||'auto',
  conv:{id:'c1',title:'New Chat',messages:[]},
  history:[],
  models:[],
  pending:{},
  currentAI:null,
  curDelta:null,
  context:{selection:null,script:null,tree:null,output:[]},
};

document.addEventListener('DOMContentLoaded',()=>{
  marked.setOptions({gfm:true,breaks:true});
  checkHealth(); // load models immediately via HTTP
  connectWS();
  renderHero();
  setInterval(checkHealth,5000);
  document.addEventListener('click',e=>{
    if(!e.target.closest('.model-btn'))document.getElementById('picker').classList.remove('open');
  });
});

function connectWS(){
  try{
    ws = new WebSocket('ws://127.0.0.1:42069/ws');
    ws.onopen=()=>{connected=true;setBackend(true);wsSend({type:'get_models'});wsSend({type:'get_keys'});wsSend({type:'get_history'});};
    ws.onclose=()=>{connected=false;setBackend(false);setStudioConn(false);setTimeout(connectWS,1500);};
    ws.onerror=()=>setBackend(false);
    ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch(err){console.error(err);}};
  }catch(e){setBackend(false);setTimeout(connectWS,2000);}
}
function wsSend(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}
function checkHealth(){
  fetch('http://127.0.0.1:42069/api/health').then(r=>r.json()).then(j=>{setBackend(true);setStudioConn(!!j.connected);}).catch(()=>setBackend(false));
  fetch('http://127.0.0.1:42069/api/models').then(r=>r.json()).then(j=>{
    if(j.models&&j.models.length){state.models=j.models;renderPicker();renderKeyList();}
  }).catch(()=>{
    // Fallback: even if backend is down show all models so UI isn't empty
    state.models=state.models.length?state.models:[
      {id:'auto',name:'Auto',provider:'DevAI',best:'Picks the best model for your task',configured:true},
      {id:'claude-sonnet',name:'Claude Sonnet',provider:'Anthropic',best:'Complex Roblox coding, architecture, debugging',configured:false},
      {id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',best:'General coding, Roblox systems, explanations',configured:false},
      {id:'gpt-4o-mini',name:'GPT-4o Mini',provider:'OpenAI',best:'Fast responses, small scripts',configured:false},
      {id:'gemini-pro',name:'Gemini Pro',provider:'Google',best:'Large context, multimodal',configured:false},
      {id:'deepseek',name:'DeepSeek Coder',provider:'DeepSeek',best:'Coding & technical reasoning (free key)',configured:false},
      {id:'groq-llm',name:'Llama 3.1 70B (Groq)',provider:'Groq',best:'Extremely fast responses (free key)',configured:false},
    ];
    renderPicker();renderKeyList();
  });
}

function handle(m){
  switch(m.type){
    case 'hello': toast('Connected to DevAI backend v'+m.version,'ok'); break;
    case 'studio_status': setStudioConn(m.connected); break;
    case 'pair_code':
      document.getElementById('pairCode').textContent=m.code;
      toast('📋 Pairing code copied','ok');
      navigator.clipboard&&navigator.clipboard.writeText(m.code).catch(()=>{});
      break;
    case 'ai_meta': startMsg(m); break;
    case 'ai_delta': appendDelta(m.delta); break;
    case 'ai_done': finishMsg(); break;
    case 'action_queued': showActionCard(m.action); break;
    case 'action_updated': updateAction(m.actionId,m.status); break;
    case 'action_result': finishAction(m); break;
    case 'project_tree': state.context.tree=m.tree;toast('📥 Project tree received','ok');break;
    case 'script': state.context.script=m.data;toast('📥 Script: '+m.data.path,'ok');break;
    case 'selection': state.context.selection=m.data;toast('📥 Selection: '+m.data.path,'ok');break;
    case 'scan': showScan(m.data);break;
    case 'output_line': appendOutput(m.line);break;
    case 'output_cleared': break;
    case 'keys': renderKeyList();break;
    case 'models': state.models=m.models;renderPicker();renderKeyList();break;
    case 'history': state.history=m.history||[];renderHistory();break;
    case 'error': toast(m.error,'err');break;
  }
}

function setBackend(on){
  const p=document.getElementById('backendPill');p.classList.toggle('on',on);
  p.querySelector('.dot').style.background=on?'var(--green)':'var(--red)';
  document.getElementById('backendErr').classList.toggle('show',!on);
  if(!on)document.getElementById('backendErr').innerHTML='⚠ Cannot reach local backend. <br><b>Double-click start-devai.bat</b> to start the server.';
}
function setStudioConn(on){
  studioConnected=on;
  const p=document.getElementById('studioPill');p.classList.toggle('on',on);
  p.querySelector('.dot').style.background=on?'var(--green)':'var(--red)';
}

/* PAGES */
function showPage(p){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===p));
  ['studio','history','settings'].forEach(x=>document.getElementById('page-'+x).classList.remove('open'));
  document.getElementById('page-'+p).classList.add('open');
}
function toggleSettings(){document.getElementById('page-settings').classList.toggle('open');}

/* CHAT */
function renderHero(){
  const msgs=document.getElementById('messages');
  if(state.conv.messages.length===0){
    document.getElementById('hero').style.display='';
    msgs.innerHTML='';
  }else{
    document.getElementById('hero').style.display='none';
    msgs.innerHTML='';state.conv.messages.forEach(m=>msgs.appendChild(renderM(m)));msgs.scrollTop=msgs.scrollHeight;
  }
}
function renderM(m){
  const w=document.createElement('div');w.className='msg-'+m.role;
  if(m.role==='user'){
    const b=document.createElement('div');b.className='bubble';b.textContent=m.text;w.appendChild(b);return w;
  }
  const av=document.createElement('div');av.className='ava';av.textContent='🍋';w.appendChild(av);
  const b=document.createElement('div');b.className='bubble';
  const model=state.models.find(x=>x.id===m.model)||{name:m.modelName||'DevAI',provider:'',best:''};
  const head=document.createElement('div');head.className='ai-head';
  head.innerHTML=`<span class="ai-name">${model.name}</span>`+
    (model.provider?`<span class="ai-provider">· ${model.provider}</span>`:'')+
    (model.best?`<span class="ai-best">${model.best.split(',')[0]}</span>`:'')+
    (m.why?`<span class="ai-why">${m.why}</span>`:'');
  b.appendChild(head);
  const c=document.createElement('div');c.className='content';c.innerHTML=m.html||m.text||'';b.appendChild(c);
  w.appendChild(b);return w;
}
function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px'}
function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}}
function sendMsg(){
  const inp=document.getElementById('userInput');const text=inp.value.trim();if(!text)return;
  inp.value='';inp.style.height='auto';
  if(state.conv.messages.length===0){state.conv.title=text.slice(0,40);}
  state.conv.messages.push({role:'user',text});
  renderHero();
  document.getElementById('sendBtn').disabled=true;
  wsSend({type:'chat',messages:state.conv.messages.map(x=>({role:x.role,content:x.text})),model:state.model,context:collectCtx(),mode:'build'});
  state.curDelta=null;
}
function collectCtx(){
  return {selection:state.context.selection,script:state.context.script,tree:state.context.tree?trunc(state.context.tree,3000):null,errors:state.context.output.filter(l=>l.level==='error').slice(-20)};
}
function trunc(o,max){const s=JSON.stringify(o);return s.length>max?s.slice(0,max)+'…':o;}
function startMsg(meta){
  state.curDelta={role:'ai',model:state.model,modelName:meta.model,why:meta.why,text:'',html:''};
  state.conv.messages.push(state.curDelta);
  document.getElementById('hero').style.display='none';
  renderHero();
}
function appendDelta(d){
  if(!state.curDelta)return;
  state.curDelta.text+=d;
  state.curDelta.html=renderMD(state.curDelta.text);
  const msgs=document.getElementById('messages');
  const last=msgs.querySelector('.msg-ai:last-child');
  if(last){last.querySelector('.content').innerHTML=state.curDelta.html;}
  msgs.scrollTop=msgs.scrollHeight;
}
function finishMsg(){
  document.getElementById('sendBtn').disabled=false;
  if(state.curDelta)state.curDelta.html=renderMD(state.curDelta.text);
}
function stopGen(){toast('Stop requested','warn');}
function useQuick(text){document.getElementById('userInput').value=text;sendMsg();}

function renderMD(text){
  const blocks=[];
  const pre=text.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g,(mm,l,c)=>{blocks.push({lang:l||'',code:c.trimEnd()});return`%%CB${blocks.length-1}%%`;});
  let html=marked.parse(pre);
  html=html.replace(/%%CB(\d+)%%/g,(_,i)=>{
    const b=blocks[+i];const loc=b.code.match(/^--\s*@location\s+(\S+)/i);
    const shown=b.code.replace(/^--\s*@location\s+\S+\s*\n/i,'');
    let hl=shown;try{hl=hljs.highlight(shown,{language:b.lang==='lua'?'lua':'javascript'}).value;}catch(e){}
    const pathLabel=loc?`<span class="code-path">${loc[1]}</span>`:'';
    const sendBtn=(b.lang==='lua'||loc)?`<button class="code-act send" onclick="queueSend(this)">📤 Send to Studio</button>`:'';
    return `<div class="code" data-lang="${b.lang}" data-code="${encodeURIComponent(b.code)}" ${loc?`data-path="${loc[1]}"`:''}>
      <div class="code-head"><span class="code-lang">${b.lang||'code'}</span>${pathLabel}
      <div class="code-acts"><button class="code-act" onclick="copyBlock(this)">📋 Copy</button><button class="code-act" onclick="previewBlock(this)">👁 Preview</button>${sendBtn}</div></div>
      <pre><code>${hl}</code></pre></div>`;
  });
  return html;
}

/* SEND TO STUDIO */
function queueSend(btn){
  const b=btn.closest('.code');const code=decodeURIComponent(b.dataset.code);let path=b.dataset.path;
  if(!path)path=guessPath(code);
  const parts=path.split('.');const parent=parts.slice(0,-1).join('.');const name=parts[parts.length-1];
  const type=guessType(code,name);
  const action={op:'create_instance',params:{className:type,parent,name,source:code}};
  const meta={path,name,type,code};
  if(document.getElementById('setConfirm')?.checked){
    showDiff('CREATE '+name,meta,
      ()=>{wsSend({type:'send_to_studio',action});toast('📤 Sent to Studio','ok');},
      ()=>toast('Cancelled','warn'));
  }else{wsSend({type:'send_to_studio',action});toast('📤 Sent to Studio','ok');}
}
function guessPath(c){
  if(c.includes('LocalScript')||c.includes('UserInputService'))return'StarterPlayerScripts.Client';
  if(c.includes('ModuleScript')||/return\s+\{/.test(c))return'ReplicatedStorage.Modules.Module';
  return'ServerScriptService.Script';
}
function guessType(c,n){if(c.includes('LocalScript'))return'LocalScript';if(c.includes('ModuleScript')||/return\s+\{/.test(c))return'ModuleScript';return'Script';}
function copyBlock(btn){const b=btn.closest('.code');navigator.clipboard.writeText(decodeURIComponent(b.dataset.code)).then(()=>toast('📋 Copied','ok'));}
function previewBlock(btn){
  const b=btn.closest('.code');const code=decodeURIComponent(b.dataset.code);
  document.getElementById('diffTitle').textContent='👁 Preview Code';
  document.getElementById('diffMeta').innerHTML=`<span style="color:var(--lemon);font-family:var(--mono)">${b.dataset.path||'(no location)'}</span>`;
  document.getElementById('diffBox').textContent=code;
  document.getElementById('diffApply').style.display='none';document.getElementById('diffReject').textContent='Close';
  document.getElementById('diffReject').onclick=closeDiff;document.getElementById('diffApply').onclick=null;
  document.getElementById('diffModal').classList.add('open');
}
function showDiff(title,meta,apply,reject){
  document.getElementById('diffTitle').innerHTML='⚠ '+title;
  document.getElementById('diffMeta').innerHTML=`<b>${meta.op||'create_instance'}</b> · <span style="color:var(--lemon);font-family:var(--mono)">${meta.path}</span> <span style="color:var(--muted)">(${meta.type})</span>`;
  document.getElementById('diffBox').innerHTML=meta.code.split('\n').map(l=>`<span class="add">+ ${esc(l)}</span>`).join('');
  document.getElementById('diffApply').style.display='';document.getElementById('diffApply').textContent='Apply';
  document.getElementById('diffReject').style.display='';document.getElementById('diffReject').textContent='Cancel';
  document.getElementById('diffApply').onclick=()=>{closeDiff();apply&&apply();};
  document.getElementById('diffReject').onclick=()=>{closeDiff();reject&&reject();};
  document.getElementById('diffModal').classList.add('open');
}
function closeDiff(){document.getElementById('diffModal').classList.remove('open');}

/* ACTIONS IN FLIGHT */
function showActionCard(a){
  state.pending[a.id]=a;
  const card=document.createElement('div');card.className='msg-ai';card.id='act-'+a.id;
  card.innerHTML=`<div class="ava">⚡</div><div class="bubble"><div class="ai-head"><span class="ai-name" style="color:var(--amber)">Studio Action</span></div>
    <div class="content"><div class="plan">
      <h4>⚡ ${a.op.toUpperCase()}</h4>
      <div style="font-family:var(--mono);font-size:12px;color:var(--text);margin-bottom:10px">${a.params.name||a.params.path||''} <span style="color:var(--muted)">→ ${a.params.parent||a.params.to||''}</span></div>
      <span class="ai-why" id="act-status-${a.id}">queued</span>
    </div></div></div>`;
  if(state.curDelta&&document.querySelector('#messages .msg-ai:last-child')===document.querySelector(`#act-${a.id-1}`)){
    // just insert after current
  }
  document.getElementById('messages').appendChild(card);
  document.getElementById('messages').scrollTop=document.getElementById('messages').scrollHeight;
}
function updateAction(id,s){
  const el=document.getElementById('act-'+id);if(!el)return;
  const st=el.querySelector('#act-status-'+id);if(st){st.textContent=s;st.style.color=s==='done'?'var(--green)':s==='failed'?'var(--red)':s==='cancelled'?'var(--red)':'var(--amber)';}
}
function finishAction(m){
  updateAction(m.actionId,m.success?'done':'failed');
  const el=document.getElementById('act-'+m.actionId);if(!el)return;
  const note=document.createElement('div');note.style.cssText='margin-top:8px;font-size:13px;color:'+(m.success?'var(--green)':'var(--red)');
  note.textContent=m.success?'✓ Created '+m.path:'✗ Failed: '+m.error;
  el.querySelector('.content').appendChild(note);
  state.history.unshift({ts:Date.now(),actionId:m.actionId,op:m.op,success:m.success,path:m.path,error:m.error});
  renderHistory();
}

/* STUDIO */
function genPairCode(){wsSend({type:'generate_pair'});}
function sendAction(a){
  if(!connected){toast('Start the backend first (start-devai.bat)','err');return;}
  wsSend({type:'send_to_studio',action});toast('📤 '+a.op,'ok');
}
function showScan(d){
  const keys=['Script','LocalScript','ModuleScript','RemoteEvent','RemoteFunction','Folder','Model','Part'];
  const labels=['Scripts','LocalScripts','Modules','RemoteEvents','RemoteFns','Folders','Models','Parts'];
  toast('📊 Scan: '+keys.map((k,i)=>`${d[k]||0} ${labels[i]}`).join(', '),'ok');
}
function appendOutput(line){
  state.context.output.push(line);if(state.context.output.length>200)state.context.output.shift();
}

/* MODELS / PICKER */
function renderPicker(){
  const pk=document.getElementById('picker');if(!pk||!state.models.length)return;
  pk.innerHTML='<h5>Select Model</h5>'+state.models.map(m=>{
    const cfg=m.configured!==false;
    const colors={'auto':'var(--lemon)','claude-sonnet':'#d4a27f','gpt-4o':'#74aa9c','gpt-4o-mini':'#74aa9c','gemini-pro':'#4285f4','deepseek':'#6366f1','groq-llama':'#f55036'};
    const icons={'auto':'🤖','claude-sonnet':'🟠','gpt-4o':'🟢','gpt-4o-mini':'🟢','gemini-pro':'🔵','deepseek':'🟣','groq-llama':'🔴'};
    return `<div class="pick-item ${m.id===state.model?'sel':''}" onclick="selectModel('${m.id}')">
      <div class="pick-icon" style="background:${colors[m.id]||'#888'}22;color:${colors[m.id]||'#fff'}">${icons[m.id]||'🧠'}</div>
      <div class="pick-body">
        <h6>${m.name} <span class="pick-badge ${cfg?'ready':'nokey'}">${cfg||m.id==='auto'?'READY':'NO KEY'}</span></h6>
        <p>${m.provider} · ${m.best}</p>
      </div></div>`;
  }).join('');
  const cm=state.models.find(x=>x.id===state.model);
  document.getElementById('modelPill').textContent=cm?cm.name:'Auto';
}
function selectModel(id){state.model=id;localStorage.setItem('devai_model',id);renderPicker();document.getElementById('picker').classList.remove('open');toast('Model: '+(state.models.find(x=>x.id===id)||{}).name,'ok');}
function togglePicker(){document.getElementById('picker').classList.toggle('open');}

/* HISTORY */
function renderHistory(){
  const box=document.getElementById('historyList');if(!box)return;
  if(!state.history.length){box.innerHTML='<div class="card"><p>No changes yet. Send a script to Studio to get started.</p></div>';return;}
  box.innerHTML=state.history.slice(0,100).map(h=>`<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 20px">
    <div style="font-size:24px">${h.success?'✓':'✗'}</div>
    <div style="flex:1"><h3 style="margin:0;font-size:13px;color:${h.success?'var(--green)':'var(--red)'}">${h.op} — ${h.path||''}</h3>
    <p style="margin:0">${new Date(h.ts).toLocaleString()} ${h.error?'· '+h.error:''}</p></div>
  </div>`).join('');
}

/* SETTINGS */
const PROVIDERS=[
  {id:'openai',name:'OpenAI (GPT-4o, GPT-4o Mini)',ph:'sk-...'},
  {id:'anthropic',name:'Anthropic (Claude Sonnet)',ph:'sk-ant-...'},
  {id:'google',name:'Google Gemini',ph:'AIza...'},
  {id:'deepseek',name:'DeepSeek (free tier)',ph:'sk-...'},
  {id:'groq',name:'Groq (free, ultra-fast)',ph:'gsk_...'},
];
function renderKeyList(){
  const kl=document.getElementById('keyList');if(!kl)return;
  kl.innerHTML=PROVIDERS.map(p=>{
    const has=state.models.some(m=>{
      const map={'openai':['gpt-4o','gpt-4o-mini'],'anthropic':['claude-sonnet'],'google':['gemini-pro'],'deepseek':['deepseek'],'groq':['groq-llama']};
      return (map[p.id]||[]).includes(m.id)&&m.configured;
    });
    return `<div class="kv"><label>${p.name} ${has?'<span style="color:var(--green);font-size:11px">● ready</span>':''}</label><input type="password" data-prov="${p.id}" placeholder="${p.ph}"></div>`;
  }).join('');
}
function saveKeys(){
  const keys={};document.querySelectorAll('[data-prov]').forEach(i=>{if(i.value.trim())keys[i.dataset.prov]=i.value.trim();});
  wsSend({type:'save_keys',keys});toast('💾 Keys saved to backend','ok');
  setTimeout(()=>{wsSend({type:'get_models'});wsSend({type:'get_keys'});},500);
}

/* DOWNLOADS */
function downloadZip(){const a=document.createElement('a');a.href='DevAI-v7.zip';a.download='DevAI-v7.zip';a.click();}
function downloadBat(){const a=document.createElement('a');a.href='start-devai.bat';a.download='start-devai.bat';a.click();}

/* UTILS */
function toast(msg,kind){
  const t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(kind||'');setTimeout(()=>t.classList.remove('show'),2600);
}
function esc(s){return(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
