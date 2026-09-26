// DevAI Web App — single-file JS, no framework, no build step.
// All state lives in localStorage. All provider calls go directly from the browser.

const $ = (id) => document.getElementById(id);

// Provider preset metadata. The dropdown value in HTML must match url|model here.
// Default preset on first visit.
const DEFAULT_PRESET = 'https://openrouter.ai/api/v1|meta-llama/llama-3.1-8b-instruct:free';
const RECOMMENDED_CODING = 'https://openrouter.ai/api/v1|qwen/qwen3-coder:free';

const PRESETS = {
  // ---- FREE CODING (best for DevAI script generation) ----
  'https://openrouter.ai/api/v1|qwen/qwen3-coder:free': {
    label:'Qwen3 Coder', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Strongest free coding model right now. 1M-token context — can ingest huge scripts. Best for Luau, refactors, debugging.'
  },
  'https://openrouter.ai/api/v1|poolside/laguna-m.1:free': {
    label:'Poolside Laguna M.1', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Agentic coding specialist, 262k context. Good for multi-step BUILD→CODE→DEBUG loops.'
  },
  'https://openrouter.ai/api/v1|cohere/north-mini-code:free': {
    label:'Cohere North Mini Code', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Agentic + terminal coding, 256k context. Solid for generating scripts you plan to tweak.'
  },
  'https://api.groq.com/openai/v1|llama-3.3-70b-versatile': {
    label:'Groq Llama 3.3 70B', signup:'console.groq.com/keys', signupUrl:'https://console.groq.com/keys',
    free:true, note:'⚡ Blazing fast. Great for quick chat answers and short scripts. Generous free tier.'
  },
  // ---- FREE REASONING & LARGE CONTEXT ----
  'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free': {
    label:'NVIDIA Nemotron Ultra 550B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Biggest free model on the list — 550B params, 1M context. Best for architecture planning and debugging large systems.'
  },
  'https://openrouter.ai/api/v1|deepseek/deepseek-v4-flash:free': {
    label:'DeepSeek V4 Flash', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Strong reasoning, 1M context. Excellent for debugging tricky Luau errors and system design.'
  },
  'https://openrouter.ai/api/v1|meta-llama/llama-3.3-70b-instruct:free': {
    label:'Llama 3.3 70B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Solid reliable baseline. 131k context, multilingual. Good all-rounder.'
  },
  'https://openrouter.ai/api/v1|openai/gpt-oss-120b:free': {
    label:'OpenAI gpt-oss-120b', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Open-weight model from OpenAI, 131k context. Apache 2.0 license.'
  },
  // ---- FREE VISION ----
  'https://openrouter.ai/api/v1|google/gemma-4-31b-it:free': {
    label:'Google Gemma 4 31B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Vision + text, 262k context, 140+ languages. Use if you want to paste a screenshot of an error.'
  },
  // ---- FREE UTILITY ----
  'https://openrouter.ai/api/v1|openrouter/free': {
    label:'OpenRouter Free (auto)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'OpenRouter picks whichever free model is available. Handy fallback if a specific model is rate-limited.'
  },
  'https://openrouter.ai/api/v1|meta-llama/llama-3.1-8b-instruct:free': {
    label:'Llama 3.1 8B (default)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Lightweight default — works instantly, rarely rate-limited. Upgrade to Qwen3 Coder for harder scripts.'
  },
  'http://localhost:11434/v1|llama3.1': {
    label:'Ollama (local)', signup:'', signupUrl:'',
    free:true, local:true, note:'100% offline — run Ollama on your machine first. Any key works.'
  },
  // ---- PAID ----
  'https://openrouter.ai/api/v1|openrouter/auto': {
    label:'OpenRouter Auto (paid)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:false, note:'OpenRouter picks the best paid model per request.'
  },
  'https://openrouter.ai/api/v1|anthropic/claude-3.5-sonnet': {
    label:'Claude 3.5 Sonnet (paid)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:false, paid:true, note:'Top-tier for Luau & system design. Pay-as-you-go via OpenRouter.'
  },
  'https://openrouter.ai/api/v1|openai/gpt-4o-mini': {
    label:'GPT-4o-mini via OpenRouter (paid)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:false, paid:true, note:'Fast & cheap. Pay-as-you-go via OpenRouter.'
  },
  'https://api.openai.com/v1|gpt-4o-mini': {
    label:'OpenAI direct — GPT-4o-mini (paid)', signup:'platform.openai.com/api-keys', signupUrl:'https://platform.openai.com/api-keys',
    free:false, paid:true, note:'OpenAI direct. Pay-as-you-go.'
  },
  'https://api.moonshot.cn/v1|kimi-k2.7-code': {
    label:'Moonshot Kimi K2.7 Code (paid)', signup:'platform.kimi.ai', signupUrl:'https://platform.kimi.ai/console',
    free:false, paid:true, note:'Coding model, 256k context. PAID — requires $1 minimum top-up at platform.kimi.ai.'
  },
  'https://api.moonshot.cn/v1|kimi-k3': {
    label:'Moonshot Kimi K3 (paid)', signup:'platform.kimi.ai', signupUrl:'https://platform.kimi.ai/console',
    free:false, paid:true, note:'Flagship reasoning, 1M-token context. PAID — $3/$15 per MTok, $1 min top-up.'
  },
};

const state = {
  llmUrl: 'https://openrouter.ai/api/v1',
  llmModel: 'meta-llama/llama-3.1-8b-instruct:free', // upgraded from Qwen recommendation via UI if desired
  llmKey: '',
  meshyKey: '',
  memory: { game:'', currency:'', mainUI:'', admin:'', extra:'' },
  sessionCode: '',
  mesh: null, // { previewTaskId, refineTaskId, modelUrlGlb, ..., rigTaskId }
};

// ---------- persistence ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem('devai_state') || '{}');
    Object.assign(state, s);
  } catch(e){}
}
function save() {
  localStorage.setItem('devai_state', JSON.stringify({
    llmUrl:state.llmUrl, llmModel:state.llmModel, llmKey:state.llmKey,
    meshyKey:state.meshyKey, memory:state.memory, sessionCode:state.sessionCode,
  }));
}

// ---------- helpers ----------
function toast(msg) {
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2400);
}
function setStatus(el, msg, kind) {
  if (typeof el === 'string') el = $(el);
  if (!el) return;
  el.textContent = msg||'';
  el.className = 'tiny ' + (kind?'status-'+kind:'');
}
function copyText(text) {
  navigator.clipboard.writeText(text).then(()=>toast('📋 Copied')).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    toast('📋 Copied');
  });
}
function downloadText(name, text) {
  const blob = new Blob([text], {type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function genSessionCode() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
  let s='';
  for(let i=0;i<6;i++) s+=alphabet[Math.floor(Math.random()*alphabet.length)];
  state.sessionCode=s; save(); $('sessionCode').value=s;
}

// ---------- system prompt ----------
function buildSystemContext() {
  const m=state.memory||{};
  const lines=[
    'You are DevAI, an expert-level Roblox Luau scripting assistant inside an ancient-fantasy gold-brown themed developer tool called DevAI.',
    'Follow the Roblox development pipeline: BUILD → CODE → DEBUG → TEST → OPTIMIZE → DEPLOY.',
    'Prefer modern typed Luau where reasonable. Use proper services (ReplicatedStorage for remotes, ServerScriptService for server code, StarterPlayerScripts for client, CollectionService for tags, etc.).',
    'For code requests, output a fenced luau code block (```luau ... ```). Precede it with one line indicating where to put it, e.g. "-- Place in: ServerScriptService.Systems.Combat".',
    'Never include modern/city/sci-fi aesthetics unless the user explicitly asks; default aesthetic is ancient fantasy rainforest castles, bronze/gold/amber accents, mossy stone.',
    'Be concise but production-ready: include error handling, type annotations where they add clarity, and security checks (server-side validation of RemoteEvents, sanity checks on inputs, never trust the client).',
  ];
  if (m.game) lines.push('Project game name: '+m.game);
  if (m.currency) lines.push('In-game currency: '+m.currency);
  if (m.mainUI) lines.push('Main UI module: '+m.mainUI);
  if (m.admin) lines.push('Admin system: '+m.admin);
  if (m.extra) lines.push('Extra instructions: '+m.extra);
  return lines.join('\n');
}

// ---------- navigation ----------
function goPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  const pg=$('page-'+name); if(pg) pg.classList.add('active');
}
document.querySelectorAll('nav button[data-page]').forEach(btn=>{
  btn.addEventListener('click', ()=>goPage(btn.dataset.page));
});

// ---------- LLM call ----------
async function llmCall(messages, opts={}) {
  if (!state.llmKey) throw new Error('No LLM API key configured. Add one in Settings.');
  const body = {
    model: state.llmModel,
    messages: messages,
    temperature: opts.temperature ?? 0.3,
    stream: false,
  };
  if (opts.max_tokens) body.max_tokens=opts.max_tokens;
  const res = await fetch(state.llmUrl + '/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+state.llmKey,
      'HTTP-Referer': location.href,
      'X-Title':'DevAI',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('LLM error '+res.status+': '+errText.slice(0,400));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(empty response)';
}

// ---------- CHAT ----------
const chatList = $('chatList');
function addMsg(who, text, isUser) {
  const div=document.createElement('div');
  div.className='msg '+(isUser?'user':'ai');
  div.innerHTML = '<div class="who">'+who+'</div><div class="body"></div>';
  const body=div.querySelector('.body');
  renderMarkdownInto(body, text);
  chatList.appendChild(div);
  chatList.scrollTop = chatList.scrollHeight;
  return div;
}
function renderMarkdownInto(el, text) {
  // basic markdown: ```luau ... ``` code blocks → pre with copy button, `inline` → code, **bold**, newlines → <br>
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(?:luau|lua)?\n([\s\S]*?)\n```/g, (m,code)=>{
      const id='cb'+Math.random().toString(36).slice(2,8);
      return '</p><div class="codewrap"><pre id="'+id+'">'+code.trimEnd()+'</pre><div class="codeblock-toolbar"><button class="btn ghost" data-copy="'+id+'">📋 Copy Luau</button><button class="btn ghost" data-dl="'+id+'">⬇ .lua</button></div></div><p>';
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/\n/g,'<br>');
  // wrap in paragraph
  el.innerHTML = '<p>'+html+'</p>';
  el.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{
    copyText($(b.dataset.copy).innerText);
  }));
  el.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click',()=>{
    downloadText('devai-script.lua', $(b.dataset.dl).innerText);
  }));
}
async function sendChat() {
  const txt=$('chatInput').value.trim();
  if(!txt) return;
  $('chatInput').value='';
  addMsg('You', txt, true);
  const wait=addMsg('DevAI','<i>Thinking…</i>', false);
  try {
    const messages=[
      {role:'system', content:buildSystemContext()},
    ];
    // send last 20 messages from DOM
    chatList.querySelectorAll('.msg:not(.thinking)').forEach(m=>{
      // skip the wait placeholder
      if (m===wait) return;
      messages.push({role: m.classList.contains('user')?'user':'assistant', content: m.querySelector('.body').innerText});
    });
    const reply=await llmCall(messages);
    wait.querySelector('.body').innerText='';
    renderMarkdownInto(wait.querySelector('.body'), reply);
    chatList.scrollTop = chatList.scrollHeight;
  } catch(e) {
    wait.querySelector('.body').innerHTML = '<span style="color:var(--red)">❌ '+e.message+'</span>';
  }
}
$('sendChat').addEventListener('click', sendChat);
$('chatInput').addEventListener('keydown', (e)=>{
  if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendChat(); }
});
$('clearChat').addEventListener('click', ()=>{ chatList.innerHTML=''; });

// ---------- 3D MODELS (Meshy) ----------
const MESHY_BASE='https://api.meshy.ai';
async function meshyRequest(path, opts={}) {
  if (!state.meshyKey) throw new Error('No Meshy API key. Add one in Settings (free: meshy.ai/settings/api).');
  const res = await fetch(MESHY_BASE+path, {
    method: opts.method||'GET',
    headers:{
      'Authorization':'Bearer '+state.meshyKey,
      'Content-Type':'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if(!res.ok) throw new Error('Meshy '+res.status+': '+await res.text());
  return res.json();
}
async function meshyPoll(taskId, onProgress) {
  while(true){
    const t = await meshyRequest('/openapi/v2/text-to-3d/'+taskId);
    if (t.status==='SUCCEEDED') return t;
    if (t.status==='FAILED'||t.status==='EXPIRED') throw new Error('Meshy task '+t.status+': '+(t.error||''));
    if (onProgress) onProgress(t.progress||0, t);
    await new Promise(r=>setTimeout(r, 3500));
  }
}
function showMeshResult(model) {
  const r=$('meshResult'); r.style.display='block';
  $('meshResultTitle').textContent='✅ '+ (model.name||'Model ready');
  const thumb=model.thumbnail_url||(model.model_urls?.glb||'');
  $('meshThumb').src=thumb||'';
  $('dlGlb').href=model.model_urls?.glb||'#';
  $('dlFbx').href=model.model_urls?.fbx||'#';
  $('dlObj').href=model.model_urls?.obj||'#';
  const v=$('meshViewer');
  v.src=model.model_urls?.glb||'';
  v.alt=model.name||'3D model';
  state.mesh = Object.assign(state.mesh||{}, { model_urls: model.model_urls, name:model.name });
}
$('meshGenerate').addEventListener('click', async ()=>{
  const prompt=$('meshPrompt').value.trim();
  if(!prompt) return toast('Enter a prompt first');
  const style=$('meshStyle').value;
  $('meshGenerate').disabled=true;
  setStatus('meshStatus','Requesting preview…','warn');
  $('meshProgress').style.display='block';
  $('meshProgress').firstElementChild.style.width='5%';
  try{
    const created = await meshyRequest('/openapi/v2/text-to-3d',{
      method:'POST',
      body:{
        mode:'preview',
        prompt:prompt,
        art_style:style,
        negative_prompt:'low quality, blurry, extra limbs, distorted, watermark',
      },
    });
    const tid=created.result;
    setStatus('meshStatus','Generating preview… (≈30–60s)','warn');
    const finished=await meshyPoll(tid,(p)=>{
      $('meshProgress').firstElementChild.style.width=Math.round(p*100)+'%';
      setStatus('meshStatus','Preview '+Math.round(p*100)+'%','warn');
    });
    $('meshProgress').firstElementChild.style.width='100%';
    showMeshResult({ name:'Preview: '+prompt.slice(0,40)+'…', model_urls: finished.model_urls, thumbnail_url: finished.thumbnail_url });
    state.mesh.previewTaskId=tid;
    state.mesh.model_urls=finished.model_urls;
    state.mesh.thumbnail_url=finished.thumbnail_url;
    $('meshRefine').disabled=false;
    $('meshRig').disabled=false;
    setStatus('meshStatus','Preview ready ✓','ok');
  } catch(e){
    setStatus('meshStatus','❌ '+e.message,'err');
  } finally{
    $('meshGenerate').disabled=false;
  }
});
$('meshRefine').addEventListener('click', async ()=>{
  if (!state.mesh?.previewTaskId) return toast('Generate a preview first');
  $('meshRefine').disabled=true;
  setStatus('meshStatus','Starting high-poly refine…','warn');
  $('meshProgress').style.display='block';
  $('meshProgress').firstElementChild.style.width='10%';
  try{
    const created=await meshyRequest('/openapi/v2/text-to-3d',{method:'POST',body:{
      mode:'refine', preview_task_id:state.mesh.previewTaskId, enable_pbr:true,
    }});
    const finished=await meshyPoll(created.result,(p)=>{
      $('meshProgress').firstElementChild.style.width=Math.round(p*100)+'%';
      setStatus('meshStatus','Refine '+Math.round(p*100)+'%','warn');
    });
    showMeshResult({ name:'Refined (PBR) model', model_urls:finished.model_urls, thumbnail_url:finished.thumbnail_url });
    state.mesh.refineTaskId=finished.id;
    state.mesh.model_urls=finished.model_urls;
    setStatus('meshStatus','Refined PBR model ready ✓','ok');
  } catch(e){ setStatus('meshStatus','❌ '+e.message,'err'); }
  finally{ $('meshRefine').disabled=false; }
});
// Meshy v1 rig endpoint
async function meshyRig(taskId) {
  const height=parseFloat($('meshHeight').value)||1.7;
  const created=await meshyRequest('/openapi/v1/rigging',{method:'POST',body:{
    input_task_id:taskId,
    height_meters:height,
  }});
  const rigId=created.result;
  while(true){
    await new Promise(r=>setTimeout(r,4000));
    const t=await meshyRequest('/openapi/v1/rigging/'+rigId);
    if(t.status==='SUCCEEDED') return t;
    if(t.status==='FAILED'||t.status==='EXPIRED') throw new Error('Rig failed: '+(t.error||''));
    setStatus('meshStatus','Rigging… '+Math.round((t.progress||0)*100)+'%','warn');
  }
}
$('meshRig').addEventListener('click', async ()=>{
  // rig either the refined model or the preview
  const taskId = state.mesh?.refineTaskId || state.mesh?.previewTaskId;
  if(!taskId) return toast('Generate a model first');
  $('meshRig').disabled=true;
  setStatus('meshStatus','Rigging character + generating walk/run animations (~90s)…','warn');
  $('rigLinks').style.display='none';
  try{
    const rig=await meshyRig(taskId);
    // rig.model_urls includes rigged glb/fbx and animation loops
    state.mesh.rig=rig;
    $('dlRigGlb').href=rig.model_urls?.glb||rig.glb||rig.rigged_glb||'#';
    $('dlRigFbx').href=rig.model_urls?.fbx||rig.fbx||rig.rigged_fbx||'#';
    // Meshy v1 rig response: animations.walk / animations.run
    const walk = rig.animations?.walk?.fbx || rig.walk?.fbx || rig.walk_fbx || rig.model_urls?.walk_fbx;
    const run  = rig.animations?.run?.fbx  || rig.run?.fbx  || rig.run_fbx  || rig.model_urls?.run_fbx;
    // If walk/run not present directly, Meshy rig API returns them as separate downloadable links — fall back to showing the rigged files.
    if (walk) $('dlWalk').href=walk; else $('dlWalk').style.display='none';
    if (run)  $('dlRun').href=run;  else $('dlRun').style.display='none';
    $('dlWalk').style.display=walk?'':'none';
    $('dlRun').style.display=run?'':'none';
    $('rigLinks').style.display='grid';
    setStatus('meshStatus','Rigged ✓ Download GLB/FBX plus walk/run','ok');
    // Update viewer to the rigged glb
    const rigGlb = rig.model_urls?.glb || rig.glb;
    if (rigGlb) $('meshViewer').src=rigGlb;
  } catch(e){ setStatus('meshStatus','❌ '+e.message,'err'); }
  finally{ $('meshRig').disabled=false; }
});
$('copyGlb').addEventListener('click',()=>{
  const url=$('dlGlb').href;
  if(!url||url==='') return toast('Generate a model first');
  copyText(url); toast('GLB URL copied — paste into DevAI plugin in Studio to auto-import.');
});

// ---------- THUMBNAILS ----------
$('thumbGenerate').addEventListener('click', async ()=>{
  const prompt=$('thumbPrompt').value.trim();
  const style=$('thumbStyle').value;
  const endpoint=$('thumbEndpoint').value;
  if(!prompt) return toast('Enter a prompt');
  setStatus('thumbStatus','Generating thumbnail…','warn');
  $('thumbResult').style.display='none';
  try{
    let url='';
    if(endpoint==='pollinations'){
      const sizes = { cinematic:'1920x1080', 'cartoon':'1920x1080', 'icon':'512x512' };
      const size=sizes[style]||'1920x1080';
      const styleAdd = style==='cinematic' ? ' cinematic lighting, dramatic god rays, ancient fantasy, gold and bronze tones, mossy stone castle, rainforest'
        : style==='cartoon' ? ' cartoon, bright saturated colors, high-contrast Roblox thumbnail, readable from small size'
        : ' game icon, circular crop safe, simple silhouette, gold-brown ancient fantasy theme';
      url='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt + styleAdd)+'?width='+size.split('x')[0]+'&height='+size.split('x')[1]+'&nologo=true&seed='+Math.floor(Math.random()*1e6);
    } else {
      // OpenRouter /chat/completions image generation not standard; fall back to pollinations with a toast
      toast('OpenRouter image gen requires a vision/FLUX-capable model — using Pollinations instead.');
      url='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt)+'?width=1920&height=1080&nologo=true';
    }
    // preload
    setStatus('thumbStatus','Downloading…','warn');
    await new Promise((res,rej)=>{
      const img=new Image();
      img.onload=()=>res();
      img.onerror=()=>rej(new Error('Image generation failed'));
      img.src=url;
    });
    $('thumbImg').src=url;
    $('thumbLink').href=url;
    $('thumbDl').href=url;
    $('thumbResult').style.display='block';
    setStatus('thumbStatus','Thumbnail ready ✓','ok');
  } catch(e){ setStatus('thumbStatus','❌ '+e.message,'err'); }
});
$('thumbCopy').addEventListener('click',()=>{
  copyText($('thumbLink').href);
});

// ---------- GUI Generator ----------
$('guiGenerate').addEventListener('click', async ()=>{
  const desc=$('guiPrompt').value.trim();
  if(!desc) return toast('Describe your GUI');
  setStatus('guiStatus','Generating UI script…','warn');
  $('guiResult').style.display='none';
  try{
    const sys = buildSystemContext() + '\nGenerate a single LocalScript that creates a Roblox GUI from the user\'s description. Parent the GUI to PlayerGui. Use matching gold-brown/bronze/amber DevAI ancient-fantasy theme unless the user specifies another style. Use UDim2, UICorner, UIStroke, TweenService for hover effects. Output ONLY a fenced luau code block.';
    const reply=await llmCall([
      {role:'system',content:sys},
      {role:'user',content:desc},
    ],{max_tokens:4000});
    const code=(reply.match(/```(?:luau|lua)?\s*\n?([\s\S]*?)\n?```/)||[,''])[1].trim() || reply;
    $('guiCode').textContent=code;
    $('guiResult').style.display='block';
    setStatus('guiStatus','Done ✓','ok');
  } catch(e){ setStatus('guiStatus','❌ '+e.message,'err'); }
});
$('guiCopy').addEventListener('click',()=>copyText($('guiCode').textContent));
$('guiDownload').addEventListener('click',()=>downloadText('DevAI_GUI_LocalScript.lua',$('guiCode').textContent));

// ---------- Focused Code ----------
$('codeGenerate').addEventListener('click', async ()=>{
  const name=$('codeName').value.trim()||'Script';
  const type=$('codeType').value;
  const target=$('codeTarget').value.trim()||'ServerScriptService';
  const desc=$('codePrompt').value.trim();
  if(!desc) return toast('Describe what the script should do');
  setStatus('codeStatus','Generating '+type+'…','warn');
  $('codeResult').style.display='none';
  try{
    const fence='```';
    const sys = buildSystemContext() + '\nGenerate a complete Roblox '+type+' named "'+name+'" intended for placement in '+target+'. Output ONLY a fenced '+fence+'luau block with proper services, error handling, security checks, and comments. Begin the code with a comment line like "-- Place in: '+target+'.'+name+'". The code must be production-ready.';
    const reply=await llmCall([
      {role:'system',content:sys},
      {role:'user',content:desc},
    ],{max_tokens:4000});
    const code=(reply.match(/```(?:luau|lua)?\s*\n?([\s\S]*?)\n?```/)||[,''])[1].trim() || reply;
    $('codeTitle').textContent=type+': '+name;
    $('codeBlock').textContent=code;
    $('codeResult').style.display='block';
    setStatus('codeStatus','Done ✓','ok');
  } catch(e){ setStatus('codeStatus','❌ '+e.message,'err'); }
});
$('codeCopy').addEventListener('click',()=>copyText($('codeBlock').textContent));
$('codeDownload').addEventListener('click',()=>downloadText(
  ($('codeName').value||'script').replace(/[^a-zA-Z0-9_]/g,'_')+'.lua',
  $('codeBlock').textContent
));

// ---------- Animations ----------
$('animGen').addEventListener('click', async ()=>{
  const ids=$('animIds').value.trim();
  const parent=$('animParent').value.trim();
  const key=$('animKey').value.trim();
  const desc=$('animIds').value+' @ '+parent+' on key '+key;
  setStatus('animStatus' in window?null:null,'',''); // no-op; reuse guiStatus slot unused here
  $('animResultCard').style.display='none';
  try{
    const sys = buildSystemContext() + '\nGenerate a LocalScript that loads Animation objects, plays them on a Humanoid when the specified key is pressed. Use UserInputService. Output ONLY a fenced luau block.';
    const userMsg = 'Animation IDs (comma-separated): '+ids+'\nHumanoid path: '+parent+'\nTrigger key: '+key+'\nGenerate a LocalScript that loads these animations, plays the first one on key press, stops on release (or toggles), and uses AnimationTrack with proper cleanup.';
    const reply=await llmCall([{role:'system',content:sys},{role:'user',content:userMsg}],{max_tokens:3000});
    const code=(reply.match(/```(?:luau|lua)?\s*\n?([\s\S]*?)\n?```/)||[,''])[1].trim() || reply;
    $('animCode').textContent=code;
    $('animResultCard').style.display='block';
  } catch(e){ toast('❌ '+e.message); }
});
$('animCopy').addEventListener('click',()=>copyText($('animCode').textContent));
$('animDownload').addEventListener('click',()=>downloadText('AnimationScript.lua',$('animCode').textContent));

// ---------- SETTINGS ----------
function refreshSettingsUI() {
  $('setLlmKey').value=state.llmKey||'';
  $('setMeshyKey').value=state.meshyKey||'';
  $('setGame').value=state.memory.game||'';
  $('setCurrency').value=state.memory.currency||'';
  $('setMainUI').value=state.memory.mainUI||'';
  $('setAdmin').value=state.memory.admin||'';
  $('setExtra').value=state.memory.extra||'';
  $('sessionCode').value=state.sessionCode||'';
  // preset dropdown
  const preset=state.llmUrl+'|'+state.llmModel;
  const sel=$('setPreset');
  let found=false;
  for (const o of sel.options){
    if (o.value===preset){ o.selected=true; found=true; break; }
  }
  if (!found){
    sel.value='custom';
    $('customLlm').style.display='block';
    $('setLlmUrl').value=state.llmUrl;
    $('setLlmModel').value=state.llmModel;
  } else {
    $('customLlm').style.display='none';
  }
  updatePresetHint();
  // conn status
  const cs=$('connStatus');
  if (state.llmKey){
    cs.textContent='LLM: '+state.llmModel+' ✓';
    cs.className='status ok';
  } else {
    cs.textContent='Add an API key in ⚙ Settings to get started.';
    cs.className='status';
  }
  $('chatModelLabel').textContent=state.llmKey ? state.llmModel : 'no key';
}
function updatePresetHint() {
  const v=$('setPreset').value;
  const hint=$('llmKeyHint');
  if(v==='custom'){
    hint.innerHTML='Custom OpenAI-compatible endpoint. Enter base URL + model below.';
    return;
  }
  const p=PRESETS[v];
  if(!p){ hint.innerHTML=''; return; }
  const tag = p.free ? '<span style="color:var(--moss);font-weight:700;">FREE</span>'
            : p.paid ? '<span style="color:var(--red);font-weight:700;">PAID</span>'
            : '<span style="color:var(--amber);font-weight:700;">PAYG</span>';
  const link = p.signupUrl ? ' Get key: <a href="'+p.signupUrl+'" target="_blank" style="color:var(--amber);">'+p.signup+'</a>.' : '';
  hint.innerHTML = tag + ' — ' + p.note + link;
}
$('setPreset').addEventListener('change',()=>{
  const v=$('setPreset').value;
  if(v==='custom'){
    $('customLlm').style.display='block';
  } else {
    $('customLlm').style.display='none';
    const [url,model]=v.split('|');
    state.llmUrl=url; state.llmModel=model; save();
  }
  updatePresetHint();
});
$('saveLlm').addEventListener('click',()=>{
  state.llmKey=$('setLlmKey').value.trim();
  if($('setPreset').value==='custom'){
    state.llmUrl=$('setLlmUrl').value.trim()||state.llmUrl;
    state.llmModel=$('setLlmModel').value.trim()||state.llmModel;
  }
  save(); refreshSettingsUI();
  toast('💾 LLM settings saved');
});
$('saveMeshy').addEventListener('click',()=>{
  state.meshyKey=$('setMeshyKey').value.trim();
  save(); refreshSettingsUI();
  toast('💾 Meshy key saved');
});
$('saveMemory').addEventListener('click',()=>{
  state.memory={
    game:$('setGame').value.trim(),
    currency:$('setCurrency').value.trim(),
    mainUI:$('setMainUI').value.trim(),
    admin:$('setAdmin').value.trim(),
    extra:$('setExtra').value,
  };
  save(); toast('💾 Project memory saved');
});
$('testLlm').addEventListener('click', async ()=>{
  setStatus('llmStatus','Testing…','warn');
  try{
    const reply=await llmCall([{role:'user',content:'Reply with exactly "DevAI online."'}],{max_tokens:50});
    setStatus('llmStatus','✓ Connected: '+reply.slice(0,80),'ok');
  } catch(e){ setStatus('llmStatus','❌ '+e.message,'err'); }
});
$('testMeshy').addEventListener('click', async ()=>{
  setStatus('meshyStatus','Testing…','warn');
  try{
    // Meshy: GET /openapi/v2/me returns balance
    const me=await fetch(MESHY_BASE+'/openapi/v2/me',{headers:{'Authorization':'Bearer '+state.meshyKey}});
    if(!me.ok) throw new Error('Invalid key: '+await me.text());
    const data=await me.json();
    setStatus('meshyStatus','✓ Connected. Credits: '+(data.credit_balance??data.credits??'?'),'ok');
  } catch(e){ setStatus('meshyStatus','❌ '+e.message,'err'); }
});
$('resetAll').addEventListener('click',()=>{
  if(!confirm('Clear all saved keys and memory? This cannot be undone.')) return;
  localStorage.removeItem('devai_state');
  state.llmKey=''; state.meshyKey=''; state.memory={}; state.sessionCode='';
  state.llmUrl='https://openrouter.ai/api/v1';
  state.llmModel='meta-llama/llama-3.1-8b-instruct:free';
  genSessionCode(); refreshSettingsUI(); toast('🗑 Cleared');
});

// ---------- STUDIO SYNC ----------
$('genSession').addEventListener('click', genSessionCode);
$('copySession').addEventListener('click',()=>copyText($('sessionCode').value));

// ---------- boot ----------
load();
if (!state.sessionCode) genSessionCode();
refreshSettingsUI();
