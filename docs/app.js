const APP_VERSION = 25;

const MODELS = [
  { id:'auto',     name:'Auto',           provider:'DevAI',     best:'Picks the best model for your task',                  coding:5, reasoning:5, speed:4, ctx:5, vision:true,  color:'#d4f522' },
  { id:'claude-s', name:'Claude Sonnet',  provider:'Anthropic', best:'Complex Roblox coding, architecture, debugging',     coding:5, reasoning:5, speed:4, ctx:5, vision:true,  color:'#d4a27f' },
  { id:'gpt',      name:'GPT-4o',         provider:'OpenAI',    best:'General coding, Roblox systems, explanations',       coding:5, reasoning:4, speed:4, ctx:4, vision:true,  color:'#74aa9c' },
  { id:'gpt-mini', name:'GPT-4o Mini',    provider:'OpenAI',    best:'Fast responses, small scripts',                      coding:4, reasoning:3, speed:5, ctx:3, vision:true,  color:'#74aa9c' },
  { id:'gemini',   name:'Gemini Pro',     provider:'Google',    best:'Large context, multimodal, project understanding',   coding:4, reasoning:4, speed:4, ctx:5, vision:true,  color:'#4285f4' },
  { id:'deepseek', name:'DeepSeek Coder', provider:'DeepSeek',  best:'Coding and technical reasoning (free key)',          coding:5, reasoning:4, speed:4, ctx:4, vision:false, color:'#6366f1' },
  { id:'groq-llm', name:'Llama 3 (Groq)', provider:'Groq',      best:'Extremely fast responses (free key)',                coding:4, reasoning:3, speed:5, ctx:3, vision:false, color:'#f55036' },
];

let state = {
  page:'chat',
  model: localStorage.getItem('devai_model') || 'auto',
  mode: 'build',
  convs: JSON.parse(localStorage.getItem('devai_convs')||'null') || [{id:'c1',title:'New Chat',pinned:false,messages:[]}],
  convId: localStorage.getItem('devai_conv') || 'c1',
  projects: JSON.parse(localStorage.getItem('devai_projects')||'null') || [
    {id:'p1',name:'My Survival Game',lastEdit:'Today',connected:true},
    {id:'p2',name:'Fantasy Adventure',lastEdit:'Yesterday',connected:false},
  ],
  projectId: localStorage.getItem('devai_proj') || 'p1',
  history: JSON.parse(localStorage.getItem('devai_history')||'[]'),
  studioConnected: false,
  pairCode: localStorage.getItem('devai_pair') || null,
  studio: { scripts:0, locals:0, modules:0, re:0, rf:0, models:0, parts:0, explorer:null, selectedScript:null, selected:null },
  outStream: false,
  generating: false,
  stopFlag: false,
};

document.addEventListener('DOMContentLoaded', () => {
  marked.setOptions({gfm:true,breaks:true});
  document.querySelectorAll('.ctx-item input').forEach(cb=>cb.addEventListener('change',updateCtxCount));
  loadKeys(); renderConvs(); renderProjects(); renderModels(); renderIntegrations();
  renderSettings(); renderHistory(); renderScan(); selectModel(state.model); updateCtxCount();
  startClipboardListen(); startPreview();
  if(!state.pairCode) genPairCode(); else document.getElementById('pairCode').textContent=state.pairCode;
  setProject(state.projectId);
  renderChat();
  setTimeout(()=>toast('DevAI v25 ready · Lemonade Studio Bridge','ok'),500);
});

function showPage(p){
  state.page=p;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  document.querySelectorAll('.page').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  if(window.innerWidth<=768) document.getElementById('sidebar').classList.remove('open');
}

function currentConv(){ return state.convs.find(c=>c.id===state.convId) || state.convs[0]; }
function renderChat(){
  const conv=currentConv();
  const box=document.getElementById('chatMsgs');
  document.getElementById('chatTitle').textContent=conv.title;
  if(conv.messages.length===0){box.innerHTML=welcomeMsg();return;}
  box.innerHTML='';conv.messages.forEach(m=>box.appendChild(renderMsg(m)));box.scrollTop=box.scrollHeight;
}
function welcomeMsg(){
  return `<div class="msg ai"><div class="msg-bubble"><div class="ai-badge"><div class="ai-avatar">⚔</div><span class="ai-name">DevAI</span><span class="ai-best">Your Roblox Studio copilot</span></div>
    <p>Hi 👋 I'm DevAI. I write Luau, build systems, and send scripts straight into Roblox Studio.</p>
    <p>Try asking:</p><ul>
      <li><code class="inline-code">/create inventory system with Tokens and DataStore</code></li>
      <li><code class="inline-code">Create a round-based PvP system</code></li>
      <li><code class="inline-code">Fix error: attempt to index nil with 'Player'</code></li>
    </ul>
    <p style="margin-top:12px;color:var(--muted);font-size:12px">👉 Install the plugin, open 🔌 Studio Sync, generate a pairing code, and the plugin pairs automatically.</p>
  </div></div>`;
}
function renderMsg(m){
  const wrap=document.createElement('div');wrap.className='msg '+m.role;
  const bub=document.createElement('div');bub.className='msg-bubble';
  if(m.role==='ai'){
    const mdl=MODELS.find(x=>x.id===m.model)||MODELS[0];
    bub.innerHTML=`<div class="ai-badge"><div class="ai-avatar" style="background:linear-gradient(135deg,${mdl.color},var(--green))">⚔</div>
      <span class="ai-name">AI: ${mdl.name}</span><span class="ai-best">Best for: ${mdl.best.split(',')[0]}</span>
      <span class="ai-provider">${mdl.provider}</span></div><div class="msg-content">${m.html||m.text}</div>`;
  } else bub.textContent=m.text;
  wrap.appendChild(bub);return wrap;
}
function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px'}
function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}}

async function sendMsg(){
  const inp=document.getElementById('userInput');const text=inp.value.trim();if(!text)return;
  inp.value='';inp.style.height='auto';
  let conv=currentConv();
  if(conv.messages.length===0){conv.title=text.slice(0,40)+(text.length>40?'…':'');renderConvs();}
  conv.messages.push({role:'user',text});renderChat();
  if(text.startsWith('/scan')){doScan();return;}
  if(text.startsWith('/fix')){doFixErrors(text);return;}
  if(text.startsWith('/create')){planAndBuild(text);return;}
  doChat(text);
}
async function doChat(userText){
  state.generating=true;state.stopFlag=false;
  document.getElementById('stopBtn').style.display='';document.getElementById('sendBtn').disabled=true;
  const conv=currentConv();const mdl=pickModel(userText);
  const sys=buildSystemPrompt();const ctx=buildContext();
  const full=ctx?'[PROJECT CONTEXT]\n'+ctx+'\n\n'+userText:userText;
  let reply='';
  try{reply=await callAI(mdl,sys,full);}catch(e){reply=simulateResponse(userText,mdl,state.mode);}
  if(state.stopFlag){state.generating=false;document.getElementById('stopBtn').style.display='none';document.getElementById('sendBtn').disabled=false;return;}
  const html=renderMarkdownWithCode(reply);
  conv.messages.push({role:'ai',text:reply,html,model:mdl.id});
  saveConvs();renderChat();
  state.generating=false;document.getElementById('stopBtn').style.display='none';document.getElementById('sendBtn').disabled=false;
}
function stopGen(){state.stopFlag=true;}
function regenLast(){const c=currentConv();while(c.messages.length&&c.messages[c.messages.length-1].role==='ai')c.messages.pop();if(c.messages.length){const last=c.messages.pop();doChat(last.text);}}

function pickModel(text){
  if(state.model!=='auto')return state.model;
  const t=text.toLowerCase();
  if(t.includes('/fix')||t.includes('error')||t.includes('debug')||t.includes('architecture'))return 'claude-s';
  if(t.includes('fast')||t.includes('quick'))return 'groq-llm';
  if(t.length>3000)return 'gemini';
  if(t.includes('/create')||t.includes('system')||t.includes('build'))return 'deepseek';
  return 'gpt-mini';
}
function buildSystemPrompt(){
  if(state.mode==='design')return 'You are DevAI Design Mode. Help plan Roblox games: concepts, loops, maps, quests, balance, progression. Output a structured plan, not full code unless asked.';
  return `You are DevAI, an expert Roblox Studio AI assistant writing production Luau.
- Put Scripts in ServerScriptService, LocalScripts in StarterPlayerScripts/StarterGui, ModuleScripts in ReplicatedStorage.Modules unless specified.
- Add a top comment -- @location Path.To.Parent.ScriptName so the plugin knows where to insert.
- Use task.spawn not spawn(); wrap DataStore calls in pcall.
- For multi-file systems, first output a short BUILD PLAN as a bullet list, then each script as a separate lua code block with @location.
- Be concise but thorough. Never fabricate Roblox APIs.`;
}
function buildContext(){
  const parts=[];
  const checks=[['ctx1','Current script: '+(state.studio.selectedScript||'(none sent yet)')],
               ['ctx2','Selected instance: '+(state.studio.selected||'(none)')],
               ['ctx3','Project structure: '+(state.studio.explorer?JSON.stringify(state.studio.explorer).slice(0,2000):'(none — run a scan from the plugin)')],
               ['ctx4','Workspace snapshot'],['ctx5','Recent Output errors'],['ctx6','UI Hierarchy'],
               ['ctx7','All scripts (capped)'],['ctx8','Terrain'],['ctx9','NPCs']];
  checks.forEach(([id,label])=>{if(document.getElementById(id)?.checked)parts.push(label);});
  return parts.join('\n');
}

function renderMarkdownWithCode(text){
  const blocks=[];
  const pre=text.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g,(m,lang,code)=>{
    blocks.push({lang:lang||'',code:code.trimEnd()});return `%%CB${blocks.length-1}%%`;
  });
  let html=marked.parse(pre);
  html=html.replace(/%%CB(\d+)%%/g,(_,i)=>{
    const b=blocks[+i];const loc=b.code.match(/^--\s*@location\s+(\S+)/i);
    const shown=b.code.replace(/^--\s*@location\s+\S+\s*\n/i,'');
    let hl=shown;try{hl=hljs.highlight(shown,{language:b.lang==='lua'?'lua':'javascript'}).value;}catch(e){}
    const pathLabel=loc?`<span class="code-path">${loc[1]}</span>`:'';
    const sendBtn=(b.lang==='lua'||loc)?`<button class="code-act send" onclick="sendBlockToStudio(${i},this)">📤 Send to Studio</button>`:'';
    return `<div class="code-block" data-lang="${b.lang}" data-code="${encodeURIComponent(b.code)}" ${loc?`data-path="${loc[1]}"`:''}>
      <div class="code-head"><span class="code-lang">${b.lang||'code'}</span>${pathLabel}
      <div class="code-actions"><button class="code-act" onclick="copyBlock(this)">📋 Copy</button>${sendBtn}</div></div>
      <pre><code>${hl}</code></pre></div>`;
  });
  return html;
}

async function sendBlockToStudio(idx,btn){
  const block=btn.closest('.code-block');const code=decodeURIComponent(block.dataset.code);
  let path=block.dataset.path;
  if(!path)path=guessLocation(code,block.dataset.lang);
  if(document.getElementById('setConfirm')?.checked){if(!confirm('STUDIO ACTION\n\nInsert: '+path+'\n\nOK to send.'))return;}
  const parts=path.split('.');const parent=parts.slice(0,-1).join('.')||guessParent(code);const name=parts[parts.length-1];
  const type=guessType(code,name);
  const payload=`__DEVAIOUT__:${name}|${type}|${parent}|${code}`;
  try{
    await navigator.clipboard.writeText(payload);
    toast(`📋 Copied! Plugin will insert ${name} into ${parent} in ~1s`,'ok');
    addHistory({ts:Date.now(),action:'create',path,type,name});
    pushOut(`✓ Queued: ${path}`,'ok');
  }catch(e){toast('Clipboard blocked. Click the page and try again.','err');}
}
function guessLocation(code,lang){
  if(lang!=='lua')return 'ServerScriptService.Script';
  if(code.includes('LocalScript')||code.includes('UserInputService')||code.includes('PlayerGui'))return 'StarterPlayerScripts.Client';
  if(code.includes('ModuleScript')||/return\s+\{/.test(code))return 'ReplicatedStorage.Modules.Module';
  return 'ServerScriptService.Script';
}
function guessParent(code){
  const m=code.match(/^--\s*@location\s+(\S+)/i);
  if(m)return m[1].split('.').slice(0,-1).join('.');
  if(code.includes('LocalScript')||code.includes('UserInputService'))return 'StarterPlayerScripts';
  if(code.includes('ModuleScript'))return 'ReplicatedStorage.Modules';
  return 'ServerScriptService';
}
function guessType(code,name){
  if(code.includes('LocalScript'))return 'LocalScript';
  if(code.includes('ModuleScript')||/return\s+\{/.test(code))return 'ModuleScript';
  return 'Script';
}
function copyBlock(btn){
  const block=btn.closest('.code-block');navigator.clipboard.writeText(decodeURIComponent(block.dataset.code)).then(()=>toast('📋 Copied','ok'));
}

let clipLast='';
function startClipboardListen(){
  setInterval(async()=>{
    try{
      const t=await navigator.clipboard.readText();if(t===clipLast)return;clipLast=t;
      if(t.startsWith('__DEVAIIN__:'))handleIncoming(t.slice('__DEVAIIN__:'.length));
    }catch(e){}
  },1500);
}
function handleIncoming(payload){
  const bar=payload.indexOf('|');const kind=bar>0?payload.slice(0,bar):payload;const data=bar>0?payload.slice(bar+1):'';
  if(kind==='ack'){
    try{const j=JSON.parse(data);
      if(j.connected){setStudioConn(true);pushOut('✓ Plugin v'+(j.version||'6')+' connected','ok');}
      if(j.path){toast('✓ Inserted '+j.path,'ok');pushOut('✓ '+j.path,'ok');addHistory({ts:Date.now(),action:'inserted',path:j.path});}
    }catch(e){}
  }else if(kind==='explorer'){
    try{const j=JSON.parse(data);
      state.studio.explorer=j.data||j.tree||j;state.studio.scripts=j.scripts||countKind(j.data,'Script');
      state.studio.locals=j.locals||countKind(j.data,'LocalScript');state.studio.modules=j.modules||countKind(j.data,'ModuleScript');
      toast('📥 Explorer received from Studio','ok');renderScan();
    }catch(e){}
  }else if(kind==='script'){
    try{const j=JSON.parse(data);state.studio.selectedScript=j.data||j.source;state.studio.selected=j.path;j.name;toast('📥 Received script: '+j.path,'ok');}catch(e){}
  }else if(kind==='output'){pushOut(data,'warn');}else if(kind==='error'){pushOut(data,'err');}
}
function countKind(tree,kind){let n=0;function walk(o){if(!o)return;if(Array.isArray(o))return o.forEach(walk);if(typeof o==='object'){if(o.class===kind)n++;if(o.children)o.children.forEach(walk);}}walk(tree);return n;}
function setStudioConn(on){
  state.studioConnected=on;
  document.getElementById('connDot').classList.toggle('on',on);
  document.getElementById('connLabel').textContent=on?'Studio: Connected':'Disconnected';
  const big=document.getElementById('studioStatusBig');if(big){big.className='big-status '+(on?'on':'off');big.innerHTML=`<span class="pulse"></span><span>${on?'● Connected to Roblox Studio':'Waiting for Studio…'}</span>`;}
  renderIntegrations();
}

function genPairCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';
  for(let i=0;i<8;i++){c+=chars[Math.floor(Math.random()*chars.length)];if(i===3)c+='-';}
  state.pairCode=c;localStorage.setItem('devai_pair',c);document.getElementById('pairCode').textContent=c;
  setTimeout(()=>navigator.clipboard.writeText('__DEVAIPAIR__:'+c).then(()=>toast('📋 Pairing tag copied — switch to Studio, the plugin will auto-detect','ok')).catch(()=>toast('Click "Copy to Clipboard" then switch to Studio.','warn')),300);
}
function copyPair(){navigator.clipboard.writeText('__DEVAIPAIR__:'+state.pairCode).then(()=>toast('📋 Pairing tag copied','ok'));}

function renderModels(){
  const card=m=>`<div class="model-card ${m.id===state.model?'sel':''}" onclick="selectModel('${m.id}')">
    <h4 style="color:${m.color}">${m.name}</h4><div class="provider">${m.provider}</div>
    <div class="best">${m.best}</div>
    <div class="stars">Coding: ${stars(m.coding)}<br>Reasoning: ${stars(m.reasoning)}<br>Speed: ${stars(m.speed)}<br>Context: ${stars(m.ctx)}<br>${m.vision?'👁 Vision supported':''}</div>
    <div style="margin-top:8px"><button class="code-act ${m.id===state.model?'send':''}" onclick="event.stopPropagation();selectModel('${m.id}')">${m.id===state.model?'✓ Selected':'Select'}</button></div></div>`;
  document.getElementById('modelGrid').innerHTML=MODELS.map(card).join('');
  const pg=document.getElementById('modelsPageGrid');if(pg)pg.innerHTML=MODELS.map(card).join('');
  const dd=document.getElementById('setDefaultModel');if(dd)dd.innerHTML=MODELS.map(m=>`<option value="${m.id}" ${m.id===state.model?'selected':''}>${m.name}</option>`).join('');
}
function stars(n){let s='';for(let i=0;i<5;i++)s+=i<n?'★':'<span class="off">★</span>';return s;}
function selectModel(id){state.model=id;localStorage.setItem('devai_model',id);const m=MODELS.find(x=>x.id===id);document.getElementById('modelPill').textContent=m.name;renderModels();toggleDrawer(false);toast('Model: '+m.name,'ok');}
function toggleDrawer(force){const d=document.getElementById('modelDrawer');if(typeof force==='boolean')d.classList.toggle('open',force);else d.classList.toggle('open');if(d.classList.contains('open'))document.getElementById('ctxPanel').classList.remove('open');}
function toggleCtx(){const d=document.getElementById('ctxPanel');d.classList.toggle('open');if(d.classList.contains('open'))document.getElementById('modelDrawer').classList.remove('open');}
function updateCtxCount(){let n=0;document.querySelectorAll('.ctx-item input').forEach(c=>{if(c.checked)n++;});document.getElementById('ctxCount').textContent=n;}

function renderConvs(){
  const list=document.getElementById('convList');list.innerHTML='';
  state.convs.filter(c=>c.pinned).forEach(c=>list.appendChild(convEl(c,true)));
  state.convs.filter(c=>!c.pinned).forEach(c=>list.appendChild(convEl(c,false)));
}
function convEl(c,pin){
  const d=document.createElement('div');d.className='conv-item'+(c.id===state.convId?' active':'');
  d.innerHTML=`💬 ${escapeHtml(c.title||'New Chat')} ${pin?'<span class="pin">📌</span>':''}`;
  d.onclick=()=>{state.convId=c.id;localStorage.setItem('devai_conv',c.id);renderChat();renderConvs();};return d;
}
function newChat(){
  const id='c'+Date.now();state.convs.unshift({id,title:'New Chat',pinned:false,messages:[]});state.convId=id;
  localStorage.setItem('devai_conv',id);saveConvs();renderConvs();renderChat();showPage('chat');
}
function saveConvs(){localStorage.setItem('devai_convs',JSON.stringify(state.convs));}

function renderProjects(){
  const g=document.getElementById('projGrid');
  g.innerHTML=state.projects.map(p=>`<div class="proj-card" onclick="setProject('${p.id}')">
    <h3>📁 ${escapeHtml(p.name)}</h3><div class="meta"><span>Edited: ${p.lastEdit}</span></div>
    <span class="conn ${p.connected?'on':'off'}">${p.connected?'● Connected':'○ Offline'}</span></div>`).join('');
}
function setProject(id){state.projectId=id;localStorage.setItem('devai_proj',id);const p=state.projects.find(x=>x.id===id);if(p)document.getElementById('projName').textContent=p.name;}
function newProject(){const name=prompt('Project name?');if(!name)return;const p={id:'p'+Date.now(),name,lastEdit:'Just now',connected:false};state.projects.unshift(p);localStorage.setItem('devai_projects',JSON.stringify(state.projects));renderProjects();}

function setMode(m){state.mode=m;document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));toast(m==='design'?'🎨 Design Mode':'🔨 Build Mode','ok');}

function planAndBuild(text){
  const conv=currentConv();const topic=text.replace(/^\/create\s*/i,'').trim()||'system';const steps=inferPlan(topic);const files=estimateFiles(steps);
  conv.messages.push({role:'user',text});renderChat();
  const html=`<div class="plan-card"><h4>📋 BUILD PLAN — ${escapeHtml(topic)}</h4>
    <ol class="plan-steps">${steps.map((s,i)=>`<li data-n="${i+1}.">${s}</li>`).join('')}</ol>
    <div class="plan-meta"><span>📁 ~${files} files</span><span>📦 ~${files+2} instances</span><span>🤖 Auto model</span></div>
    <div class="plan-actions">
      <button class="plan-build" onclick="this.closest('.plan-card').remove();doChat('Build this step-by-step: ${escapeJs(topic)}. Follow the plan and produce each script in a separate lua code block with a -- @location comment at the top.')">▶ Build</button>
      <button class="plan-cancel" onclick="this.closest('.plan-card').remove()">Cancel</button>
    </div></div>`;
  conv.messages.push({role:'ai',html,text:'Plan: '+topic,model:'auto'});saveConvs();renderChat();
}
function inferPlan(topic){
  const t=topic.toLowerCase();
  if(t.includes('inventory'))return ['Create ReplicatedStorage.Remotes (Open, Buy, Use)','Create ReplicatedStorage.Modules.Inventory','Create ReplicatedStorage.Modules.ItemDatabase','Create ServerScriptService.InventoryService','Create ServerScriptService.DataManager (pcall DataStore)','Create StarterGui.InventoryUI (Frame+ScrollingFrame+UIGrid)','Create LocalScript for UI & remotes'];
  if(t.includes('npc'))return ['Create NPC model with Humanoid','Load Idle/Walk/Attack/Death animations','Create ServerScriptService.NPCBehavior (patrol/chase/attack)','Create NPCModule config','Tag with CollectionService'];
  if(t.includes('admin'))return ['Create ServerScriptService.AdminSystem (levels)','Define commands list','Parse PlayerChatted','Create admin RemoteEvent','Create admin UI (admin-only)'];
  if(t.includes('round'))return ['Create ReplicatedStorage Remotes (Start/End/Intermission)','Create ServerScriptService.RoundSystem (state machine)','Create status GUI + timer','Add teleport/spawn logic'];
  return ['Design data model','Create ModuleScripts','Create Remotes in ReplicatedStorage','Write server Script(s)','Write client LocalScript(s)/UI','Add DataStore persistence','Test client↔server'];
}
function estimateFiles(s){return Math.max(3,Math.min(s.length+1,8));}

function runScan(){navigator.clipboard.writeText('__DEVAIOUT__:__scan__|Command|ServerScriptService|scan').then(()=>toast('📤 Requested scan from plugin… click "↑ Send Explorer" in the plugin if it does not auto-send.','ok')).catch(()=>toast('Clipboard blocked','err'));}
function renderScan(){
  const s=state.studio;const grid=document.getElementById('scanGrid');if(!grid)return;
  const vals=[['Scripts',s.scripts],['LocalScripts',s.locals],['ModuleScripts',s.modules],['RemoteEvents',s.re],['RemoteFunctions',s.rf],['Models',s.models],['Parts',s.parts]];
  grid.innerHTML=vals.map(([l,n])=>`<div class="scan-stat"><div class="n">${n||'—'}</div><div class="lbl">${l}</div></div>`).join('');
  const pl=document.getElementById('problemList');const issues=[];
  if(s.explorer){
    if(s.scripts>0)issues.push({t:'ok',m:`✓ ${s.scripts} server Script${s.scripts===1?'':'s'} detected`});
    if(s.modules>0)issues.push({t:'ok',m:`✓ ${s.modules} ModuleScript${s.modules===1?'':'s'} — modular structure`});
    issues.push({t:'ok',m:'✓ Project tree loaded into AI context'});
  }else issues.push({t:'warn',m:'No scan yet. Click "Request Scan" then press ↑ Send Explorer in the plugin.'});
  pl.innerHTML=issues.map(i=>`<div class="problem ${i.t}"><span>${i.t==='ok'?'✓':'⚠'}</span><span class="msg2">${i.m}</span><button class="act" onclick="askAbout('${escapeJs(i.m)}')">Ask AI</button></div>`).join('');
}
function doScan(){doChat('Based on the project context I am sending, summarize my project structure and point out architecture issues.');}
function doFixErrors(text){doChat('These are Roblox Output errors. For each, explain the root cause and give a corrected script with a -- @location comment.\n\n'+text);}
function startOutputStream(){state.outStream=true;navigator.clipboard.writeText('__DEVAIOUT__:__output__|Command|ServerScriptService|output').catch(()=>{});toast('📤 Listening for output (enable in plugin)','ok');}
function pushOut(text,cls){const box=document.getElementById('outBox');if(!box)return;const d=document.createElement('div');d.className='out-line '+(cls||'');d.textContent=`[${new Date().toLocaleTimeString()}] ${text}`;box.appendChild(d);box.scrollTop=box.scrollHeight;}
function fixErrors(){const errs=Array.from(document.querySelectorAll('#outBox .out-line.err')).map(e=>e.textContent);if(!errs.length){toast('No errors captured.','err');return;}document.getElementById('userInput').value='/fix\n'+errs.join('\n');sendMsg();}

function renderIntegrations(){
  const roblox=[{icon:'🎮',name:'Roblox Studio',desc:'Plugin installed and paired',on:state.studioConnected}];
  const ai=MODELS.filter(m=>m.id!=='auto').map(m=>({icon:'🧠',name:m.name,desc:m.provider+' — '+m.best.slice(0,50),on:hasKey(m.id)}));
  const svc=[{icon:'🐙',name:'GitHub',desc:'Sync scripts to a repo',on:false},{icon:'💬',name:'Discord',desc:'Build notifications',on:false},{icon:'🧊',name:'Blender',desc:'3D asset import',on:false}];
  const render=(arr,target)=>{document.getElementById(target).innerHTML=arr.map(i=>`<div class="int-item">
    <div class="int-icon">${i.icon}</div><div class="int-info"><h4>${i.name}</h4><p>${i.desc}</p></div>
    <span class="int-status ${i.on?'on':'off'}">${i.on?'● Connected':'○ Not connected'}</span>
    <button class="int-btn ${i.on?'':'citrus'}" onclick="connectInt('${i.name}')">${i.on?'Manage':'Connect'}</button></div>`).join('');};
  render(roblox,'intRoblox');render(ai,'intAI');render(svc,'intServices');
}
function hasKey(id){const map={'claude-s':'Anthropic','gpt':'OpenAI','gpt-mini':'OpenAI','gemini':'Gemini','deepseek':'DeepSeek','groq-llm':'Groq'};return !!localStorage.getItem('devai_key_'+(map[id]||''));}
function connectInt(name){if(name==='Roblox Studio')showPage('studio');else toast('Add your API key in ⚙️ Settings for '+name);setTimeout(renderIntegrations,200);}

function addHistory(h){state.history.unshift({...h,ver:'v'+(state.history.length+1),ts:h.ts||Date.now()});if(state.history.length>100)state.history.pop();localStorage.setItem('devai_history',JSON.stringify(state.history));renderHistory();}
function renderHistory(){const box=document.getElementById('histList');if(!box)return;if(!state.history.length){box.innerHTML='<p style="color:var(--muted);font-size:12px">History appears after your first Send to Studio.</p>';return;}
  box.innerHTML=state.history.map(h=>`<div class="int-item"><div class="int-icon">📝</div><div class="int-info"><h4>${h.ver} — ${h.action} ${h.path||''}</h4><p>${new Date(h.ts).toLocaleString()} · ${h.type||''} ${h.name||''}</p></div>
  <button class="int-btn" onclick="toast('Rollback requires project storage backend','warn')">View</button></div>`).join('');}

function renderSettings(){
  const keys={OpenAI:'kOpenAI',Anthropic:'kAnthropic',Gemini:'kGemini',DeepSeek:'kDeepSeek',Groq:'kGroq',Meshy:'kMeshy'};
  Object.entries(keys).forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.value=localStorage.getItem('devai_key_'+k)||'';});
}
function loadKeys(){renderSettings();}
function saveKeys(){
  const keys={OpenAI:'kOpenAI',Anthropic:'kAnthropic',Gemini:'kGemini',DeepSeek:'kDeepSeek',Groq:'kGroq',Meshy:'kMeshy'};
  Object.entries(keys).forEach(([k,id])=>{const v=document.getElementById(id).value.trim();if(v)localStorage.setItem('devai_key_'+k,v);else localStorage.removeItem('devai_key_'+k);});
  toast('💾 Keys saved locally','ok');renderIntegrations();
}
function clearKeys(){['OpenAI','Anthropic','Gemini','DeepSeek','Groq','Meshy'].forEach(k=>localStorage.removeItem('devai_key_'+k));renderSettings();toast('Keys cleared','ok');renderIntegrations();}

async function callAI(mdlId,sys,user){
  const mdl=MODELS.find(m=>m.id===mdlId);
  const map={
    'claude-s':{key:localStorage.getItem('devai_key_Anthropic'),ep:'https://api.anthropic.com/v1/messages',model:'claude-sonnet-4-20250514',provider:'anthropic'},
    'gpt':{key:localStorage.getItem('devai_key_OpenAI'),ep:'https://api.openai.com/v1/chat/completions',model:'gpt-4o',provider:'openai'},
    'gpt-mini':{key:localStorage.getItem('devai_key_OpenAI'),ep:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini',provider:'openai'},
    'gemini':{key:localStorage.getItem('devai_key_Gemini'),ep:'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',provider:'google'},
    'deepseek':{key:localStorage.getItem('devai_key_DeepSeek'),ep:'https://api.deepseek.com/v1/chat/completions',model:'deepseek-coder',provider:'openai'},
    'groq-llm':{key:localStorage.getItem('devai_key_Groq'),ep:'https://api.groq.com/openai/v1/chat/completions',model:'llama-3.1-70b-versatile',provider:'openai'},
  };
  const cfg=map[mdlId];if(!cfg||!cfg.key)throw new Error('no key');
  if(cfg.provider==='anthropic'){
    const r=await fetch(cfg.ep,{method:'POST',headers:{'x-api-key':cfg.key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:cfg.model,max_tokens:4096,messages:[{role:'user',content:sys+'\n\n'+user}]})});
    const j=await r.json();if(j.error)throw new Error(j.error.message);return j.content[0].text;
  }
  if(cfg.provider==='google'){
    const r=await fetch(cfg.ep+'?key='+cfg.key,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sys+'\n\n'+user}]}]})});
    const j=await r.json();return j.candidates?.[0]?.content?.parts?.[0]?.text||'(no response)';
  }
  const r=await fetch(cfg.ep,{method:'POST',headers:{'authorization':'Bearer '+cfg.key,'content-type':'application/json'},body:JSON.stringify({model:cfg.model,messages:[{role:'system',content:sys},{role:'user',content:user}],stream:false})});
  const j=await r.json();if(j.error)throw new Error(j.error.message);return j.choices[0].message.content;
}

function simulateResponse(text,mdl,mode){
  const t=text.toLowerCase();const topic=text.replace(/^\/(create|scan|fix)\s*/i,'').trim()||'system';
  const name=topic.split(/\s+/).slice(0,2).map(w=>w[0]?w[0].toUpperCase()+w.slice(1):'').join('').replace(/[^A-Za-z]/g,'')||'Script';
  if(mode==='design')return `## 🎨 Design Plan: ${topic}\n\n### Core Loop\n1. Player joins → lobby\n2. Interacts → earns currency\n3. Spends → upgrades\n4. Progresses → content unlocks\n\n> Switch to 🔨 Build mode to generate code. Add an API key in Settings for real AI.`;
  if(t.includes('error')||t.includes('fix')||t.includes('debug')){
    return `## 🔍 Error Analysis\n\nThe most common cause of \`attempt to index nil\` is accessing an instance that hasn't loaded yet.\n\n### Fix pattern\n\`\`\`lua\n-- @location ServerScriptService.SafeHandler\nlocal Players = game:GetService(\"Players\")\nPlayers.PlayerAdded:Connect(function(player)\n    local leaderstats = Instance.new(\"Folder\")\n    leaderstats.Name = \"leaderstats\"; leaderstats.Parent = player\n    local coins = Instance.new(\"IntValue\")\n    coins.Name = \"Coins\"; coins.Value = 0; coins.Parent = leaderstats\n    player.CharacterAdded:Connect(function(char)\n        local hum = char:WaitForChild(\"Humanoid\", 5)\n        if not hum then return end\n        print(player.Name, \"spawned\")\n    end)\nend)\n\`\`\`\n\nUse \`:WaitForChild(n, timeout)\` and always check for nil. Add an API key in Settings for a fix using your real script.`;
  }
  return `## ⚔ ${name}\n\nHere's a complete starter **${topic}**. Click **📤 Send to Studio** on each block.\n\n### 1. Shared Module\n\`\`\`lua\n-- @location ReplicatedStorage.Modules.${name}\nlocal ${name} = {}\n${name}.Config = { MaxItems = 50, DefaultCurrency = 0, Debug = true }\nfunction ${name}.Log(...)\n    if ${name}.Config.Debug then print(\"[${name}]\", ...) end\nend\nreturn ${name}\n\`\`\`\n\n### 2. Server\n\`\`\`lua\n-- @location ServerScriptService.${name}Service\nlocal RS = game:GetService(\"ReplicatedStorage\")\nlocal PS = game:GetService(\"Players\")\nlocal DSS = game:GetService(\"DataStoreService\")\nlocal Mod = require(RS:WaitForChild(\"Modules\"):WaitForChild(\"${name}\"))\nlocal Remotes = RS:FindFirstChild(\"Remotes\") or Instance.new(\"Folder\")\nRemotes.Name = \"Remotes\"; Remotes.Parent = RS\nlocal getData = Instance.new(\"RemoteFunction\")\ngetData.Name = \"Get${name}Data\"; getData.Parent = Remotes\nlocal updateEv = Instance.new(\"RemoteEvent\")\nupdateEv.Name = \"${name}Updated\"; updateEv.Parent = Remotes\nlocal store = DSS:GetDataStore(\"${name}_v1\"); local cache = {}\nlocal function load(p) local ok,d=pcall(function()return store:GetAsync(\"u_\"..p.UserId)end);return ok and d or {coins=Mod.Config.DefaultCurrency,items={}}; end\nlocal function save(p) local d=cache[p.UserId]; if d then pcall(function()store:SetAsync(\"u_\"..p.UserId,d)end) end end\nPS.PlayerAdded:Connect(function(p) cache[p.UserId]=load(p); Mod.Log(\"Loaded\",p.Name) end)\nPS.PlayerRemoving:Connect(save)\ngame:BindToClose(function()for _,p in PS:GetPlayers()do save(p)end end)\ngetData.OnServerInvoke=function(p)return cache[p.UserId]end\nMod.Log(\"${name}Service started\")\n\`\`\`\n\n### 3. Client\n\`\`\`lua\n-- @location StarterPlayerScripts.${name}Client\nlocal RS = game:GetService(\"ReplicatedStorage\")\nlocal PS = game:GetService(\"Players\")\nlocal Mod = require(RS:WaitForChild(\"Modules\"):WaitForChild(\"${name}\"))\nlocal Remotes = RS:WaitForChild(\"Remotes\")\nlocal data = Remotes:WaitForChild(\"Get${name}Data\"):InvokeServer()\nRemotes:WaitForChild(\"${name}Updated\").OnClientEvent:Connect(function(d) data=d; Mod.Log(\"Updated\") end)\nMod.Log(\"Client ready\", data)\n\`\`\`\n\n> ⚠ Starter template. Add an API key (Settings → API Keys) for code tailored to your project. Free DeepSeek/Groq keys work great.`;
}

function downloadPlugin(){const a=document.createElement('a');a.href='DevAI-v6.zip';a.download='DevAI-v6.zip';a.click();}
function downloadBat(){const a=document.createElement('a');a.href='install-devai.bat';a.download='install-devai.bat';a.click();}

function startPreview(){renderChat();}
function toast(msg,kind){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(kind||'');setTimeout(()=>t.classList.remove('show'),2800);}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeJs(s){return escapeHtml(s).replace(/\n/g,'\\n');}
function showCmds(){document.getElementById('userInput').value='/create ';document.getElementById('userInput').focus();}
function askAbout(q){showPage('chat');document.getElementById('userInput').value=q;document.getElementById('userInput').focus();}
