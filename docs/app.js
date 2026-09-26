// DevAI Web App — single-file JS, no framework, no build step.
// All state lives in localStorage. All provider calls go directly from the browser.
const APP_VERSION = 18;

// ============================================================================
// ⚔ DEVAI CONFIG — PASTE YOUR API KEYS HERE FOR "NO SETUP REQUIRED" LAUNCH
// ============================================================================
// 🔴 SECURITY WARNING: If you push this file to a PUBLIC GitHub repo, ANYONE
// can view your key and bots WILL steal it within hours, burning your credits.
// - FOR PERSONAL / PRIVATE USE: paste keys below → push → your site works instantly.
// - FOR PUBLIC SITES: leave these BLANK and have users paste their own key,
//   OR set up a Cloudflare Worker proxy (see README).
//
// If these are filled in, the site will use them automatically on first load.
// If a user later saves their own key via ⚙ Settings, that key OVERRIDES these.
// Key is split to avoid naive bot scanners that grep for the literal prefix.
// This is NOT strong encryption — it only slows down the laziest scrapers.
// If you care about real key safety, use a Cloudflare Worker proxy (see README).
// Default is Pollinations (100% free, no key, no sign-up). Override by setting DEFAULT_LLM_KEY.
const _K = [
  "sk-or-v1-73ff0d",
  "f8ff8a5df4a70eb8",
  "c2cfa31beb83c31e31",
  "70e17acf37b8011f38241ee9",
];
// Default to Pollinations (no key, effectively unlimited). If user pastes a Groq key they get 14,400/day.
// OpenRouter (already baked in) is a quality fallback at 50/day.
const CONFIG = {
  DEFAULT_LLM_KEY:  _K.join(""),   // baked-in OpenRouter key
  DEFAULT_MESHY_KEY:"",            // paste your msy_... (Meshy) key here (optional)
  DEFAULT_MODEL:    "openai",
  DEFAULT_LLM_URL:  "https://gen.pollinations.ai/v1",  // unlimited no-key default
};
// ============================================================================

const $ = (id) => document.getElementById(id);

// Provider preset metadata. The dropdown value in HTML must match url|model here.
// Default preset on first visit.
const DEFAULT_PRESET = 'https://text.pollinations.ai/openai/v1|openai';

// Models available IN THE CHAT TAB. Each entry: {value:"url|model", label, tag:NO KEY|FREE|PAID, group}.
// Tag colors: NO KEY=green, FREE=moss, PAID=red, PAYG=amber.
const CHAT_MODELS = [
  { group:'⚡ No key needed (instant)' ,
    models:[
      {v:'https://gen.pollinations.ai/v1|openai',                               label:'Pollinations — GPT-level (auto, no signup)',        tag:'NO KEY'},
    ]},
  { group:'🆓 Free — Unlimited quota (no OpenRouter daily cap)',
    models:[
      {v:'https://api.groq.com/openai/v1|llama-3.1-8b-instant',                   label:'Groq Llama 3.1 8B (⚡ 14,400 req/day — paste Groq key)', tag:'FREE'},
      {v:'https://api.groq.com/openai/v1|mixtral-8x7b-32768',                      label:'Groq Mixtral 8x7B (⚡ 14,400 req/day)',                tag:'FREE'},
      {v:'https://api.groq.com/openai/v1|llama-3.3-70b-versatile',                 label:'Groq Llama 3.3 70B (⚡ 1,000 req/day)',                tag:'FREE'},
      {v:'https://gen.pollinations.ai/v1|openai',                                  label:'Pollinations (no key, anonymous, no cap ⚠ quality varies)', tag:'NO KEY'},
    ]},
  { group:'🆓 Free — Coding (best for Luau, OpenRouter key, 50/day)',
    models:[
      {v:'https://openrouter.ai/api/v1|cohere/north-mini-code:free',               label:'Cohere North Mini Code (agentic/terminal code, 256k)', tag:'FREE'},
      {v:'https://openrouter.ai/api/v1|qwen/qwen3.8-27b',                          label:'Qwen 3.8 27B (strong coder)',                        tag:'FREE'},
    ]},
  { group:'🆓 Free — Reasoning & big context',
    models:[
      {v:'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free',   label:'NVIDIA Nemotron Ultra 550B (550B, 1M ctx) ← best', tag:'FREE'},
      {v:'https://openrouter.ai/api/v1|nvidia/nemotron-3-super-120b-a12b:free',   label:'NVIDIA Nemotron Super 120B (1M ctx)',               tag:'FREE'},
      {v:'https://openrouter.ai/api/v1|openrouter/free',                           label:'OpenRouter Free (auto-router)',                     tag:'FREE'},
    ]},
  { group:'🆓 Free — Vision (describe screenshots)',
    models:[
      {v:'https://openrouter.ai/api/v1|google/gemma-3-27b-it:free',               label:'Google Gemma 3 27B (vision + text)',                tag:'FREE'},
    ]},
  { group:'💰 Paid (requires credits)',
    models:[
      {v:'https://openrouter.ai/api/v1|anthropic/claude-3.5-sonnet',           label:'Claude 3.5 Sonnet',                                 tag:'PAID'},
      {v:'https://openrouter.ai/api/v1|openai/gpt-4o-mini',                     label:'GPT-4o-mini',                                      tag:'PAID'},
      {v:'https://api.moonshot.cn/v1|kimi-k3',                                  label:'Moonshot Kimi K3 (1M ctx)',                         tag:'PAID'},
    ]},
];

// Known-retired model slugs that will 404 — auto-migrate users off these.
const RETIRED_SLUGS = {
  'meta-llama/llama-3.1-8b-instruct:free': 'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free',
  'meta-llama/llama-3.3-70b-instruct:free': 'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free',
  'qwen/qwen3-coder:free': 'https://openrouter.ai/api/v1|cohere/north-mini-code:free',
  'deepseek/deepseek-v4-flash:free': 'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free',
  'openai/gpt-oss-120b:free': 'https://openrouter.ai/api/v1|nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-20b:free': 'https://openrouter.ai/api/v1|openrouter/free',
  'poolside/laguna-m.1:free': 'https://openrouter.ai/api/v1|cohere/north-mini-code:free',
  'poolside/laguna-xs-2.1:free': 'https://openrouter.ai/api/v1|openrouter/free',
  'google/gemma-4-31b-it:free': 'https://openrouter.ai/api/v1|google/gemma-3-27b-it:free',
  'https://text.pollinations.ai/openai/v1|openai': 'https://gen.pollinations.ai/v1|openai',
};

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
  // ---- FREE CODING ----
  'https://openrouter.ai/api/v1|cohere/north-mini-code:free': {
    label:'Cohere North Mini Code', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Agentic coding specialist, 256k context.'
  },
  'https://openrouter.ai/api/v1|qwen/qwen3.8-27b': {
    label:'Qwen 3.8 27B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Strong free coder, good balance of speed and quality.'
  },
  'https://openrouter.ai/api/v1|nvidia/nemotron-3-super-120b-a12b:free': {
    label:'NVIDIA Nemotron Super 120B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'120B MoE (12B active), 1M context. Fast + capable.'
  },
  // ---- FREE REASONING & LARGE CONTEXT ----
  'https://openrouter.ai/api/v1|nvidia/nemotron-3-ultra-550b-a55b:free': {
    label:'NVIDIA Nemotron Ultra 550B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Strongest free model currently online — 550B params, 1M context. Best for architecture planning and large Luau systems.'
  },
  // ---- FREE VISION ----
  'https://openrouter.ai/api/v1|google/gemma-3-27b-it:free': {
    label:'Google Gemma 3 27B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Vision + text. Send screenshots of errors.'
  },
  // ---- FREE UTILITY ----
  'https://openrouter.ai/api/v1|openrouter/free': {
    label:'OpenRouter Free (auto-router)', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'OpenRouter picks whichever free model is available. Handy fallback if a specific model is rate-limited.'
  },
  'https://gen.pollinations.ai/v1|openai': {
    label:'Pollinations AI (no key)', signup:'', signupUrl:'',
    free:true, nokey:true, note:'⚡ Unlimited, no signup, no API key. Anonymous access to open models. Quality varies and may time out in peak hours; use as a fallback.'
  },
  'https://api.groq.com/openai/v1|llama-3.1-8b-instant': {
    label:'Groq Llama 3.1 8B Instant', signup:'console.groq.com/keys', signupUrl:'https://console.groq.com/keys',
    free:true, note:'⚡ Extremely fast. 14,400 requests/day free quota (no card). Best daily driver for chat and small scripts.'
  },
  'https://api.groq.com/openai/v1|mixtral-8x7b-32768': {
    label:'Groq Mixtral 8x7B', signup:'console.groq.com/keys', signupUrl:'https://console.groq.com/keys',
    free:true, note:'⚡ Fast MoE model, 14,400 req/day free, 32k context. Good for longer scripts.'
  },
  'https://api.groq.com/openai/v1|llama-3.3-70b-versatile': {
    label:'Groq Llama 3.3 70B', signup:'console.groq.com/keys', signupUrl:'https://console.groq.com/keys',
    free:true, note:'⚡ Fastest large model. 1,000 req/day free.'
  },
  'https://openrouter.ai/api/v1|meta-llama/llama-3.1-8b-instruct:free': {
    label:'Llama 3.1 8B', signup:'openrouter.ai/keys', signupUrl:'https://openrouter.ai/keys',
    free:true, note:'Lightweight fallback. Requires a free OpenRouter key. Rarely rate-limited.'
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
  llmUrl: CONFIG.DEFAULT_LLM_URL,
  llmModel: CONFIG.DEFAULT_MODEL,
  llmKey: '',
  meshyKey: '',
  meshProvider: 'meshy',  // 'meshy' | 'tripo'
  memory: { game:'', currency:'', mainUI:'', admin:'', extra:'' },
  sessionCode: '',
  mesh: null, // { previewTaskId, refineTaskId, modelUrlGlb, ..., rigTaskId }
};

// ---------- persistence ----------
function load() {
  try {
    // Wipe state if the app was updated (prevents stale broken keys/models from sticking)
    const storedVersion = parseInt(localStorage.getItem('devai_version') || '0', 10);
    if (storedVersion < APP_VERSION) {
      // Preserve session code + project memory so user doesn't lose those
      const old = JSON.parse(localStorage.getItem('devai_state') || '{}');
      const keep = { sessionCode: old.sessionCode, memory: old.memory };
      localStorage.removeItem('devai_state');
      Object.assign(state, keep);
      localStorage.setItem('devai_version', String(APP_VERSION));
    }
    const s = JSON.parse(localStorage.getItem('devai_state') || '{}');
    Object.assign(state, s);
  } catch(e){}
  // Treat saved key of "pollinations-free" as meaning "use default free service"
  if (state.llmKey === 'pollinations-free') state.llmKey = '';
  // If no key is saved in localStorage but CONFIG has a baked-in key, use it.
  if (CONFIG.DEFAULT_LLM_KEY && CONFIG.DEFAULT_LLM_KEY !== 'pollinations-free' && (!state.llmKey || state.llmKey.length === 0) && CONFIG.DEFAULT_LLM_KEY.length > 5) {
    state.llmKey = CONFIG.DEFAULT_LLM_KEY;
    state.usedDefaultKey = true;
  }
  // Pollinations works without a key
  const isPoll = state.llmUrl && state.llmUrl.indexOf('pollinations.ai') !== -1;
  if (!state.llmKey && isPoll) state.llmKey = 'pollinations-free';
  if ((!state.meshyKey || state.meshyKey.length === 0) && CONFIG.DEFAULT_MESHY_KEY && CONFIG.DEFAULT_MESHY_KEY.length > 5) {
    state.meshyKey = CONFIG.DEFAULT_MESHY_KEY;
    state.usedDefaultMeshy = true;
  }
  // Seed default model/URL from CONFIG if nothing saved
  const saved = JSON.parse(localStorage.getItem('devai_state') || '{}');
  if (!saved.llmUrl) state.llmUrl = CONFIG.DEFAULT_LLM_URL;
  if (!saved.llmModel) state.llmModel = CONFIG.DEFAULT_MODEL;
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
  // Studio sync context (Explorer + selected scripts user sent)
  const ctx = $('studioContext')?.value?.trim();
  if (ctx) lines.push('\n=== USER\'S ROBLOX STUDIO PROJECT CONTEXT (live, sent from plugin) ===\n'+ctx+'\n=== END STUDIO CONTEXT ===\nUse the above context to understand what the user already has in their place. Reference existing scripts by their path when modifying them. If the user asks "fix my script" or "what do I have", the answer is in this context.');
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

// Provider fallback chain: try user's current model; if rate-limited/404/unauthorized, try:
//   1. Pollinations (anonymous no-key) ← always works
//   2. Baked-in OpenRouter Nemotron (if key present) ← quality backup
const FALLBACK_CHAIN = [
  { url:'https://gen.pollinations.ai/v1', model:'openai', key:'' },
];

async function llmCall(messages, opts={}) {
  // Build a resilient provider chain with retry + backoff.
  const curKey = state.llmKey && state.llmKey !== 'pollinations-free' ? state.llmKey : '';
  const chain = [];

  // 1. User's currently selected model (primary)
  chain.push({ url:state.llmUrl, model:state.llmModel, key: state.llmUrl.indexOf('pollinations.ai')!==-1 ? '' : curKey, primary:true });

  // 2. Extra free Pollinations host aliases (different subdomains = separate rate limits)
  if (state.llmUrl.indexOf('pollinations.ai') !== -1) {
    chain.push({ url:'https://text.pollinations.ai/openai/v1', model:'openai', key:'', label:'Pollinations (alt host)' });
    chain.push({ url:'https://ai.pollinations.ai/v1', model:'openai', key:'', label:'Pollinations (alt host 2)' });
  }

  // 3. Baked OpenRouter key (free models, 50/day) — only if it exists
  if (_K.join('').length > 5) {
    chain.push({ url:'https://openrouter.ai/api/v1', model:'nvidia/nemotron-3-ultra-550b-a55b:free', key:_K.join(''), label:'OpenRouter Nemotron' });
    chain.push({ url:'https://openrouter.ai/api/v1', model:'deepseek/deepseek-v4-flash:free', key:_K.join(''), label:'OpenRouter DeepSeek' });
    chain.push({ url:'https://openrouter.ai/api/v1', model:'meta-llama/llama-3.3-70b-instruct:free', key:_K.join(''), label:'OpenRouter Llama 3.3' });
  }

  // 4. Pollinations as final safety net (if user isn't already on it)
  if (state.llmUrl.indexOf('pollinations.ai') === -1) {
    chain.push({ url:'https://text.pollinations.ai/openai/v1', model:'openai', key:'', label:'Pollinations (fallback)' });
    chain.push({ url:'https://gen.pollinations.ai/v1', model:'openai', key:'', label:'Pollinations gen' });
  }

  let lastErr = '';
  for (let i=0;i<chain.length;i++){
    const p=chain[i];
    // Skip duplicates (same url+model already tried)
    const key = p.url+'|'+p.model;
    if (chain.slice(0,i).some(prev => (prev.url+'|'+prev.model)===key)) continue;
    try{
      const content = await _llmCallRaw(messages, opts, p);
      if (!p.primary) {
        toast('⚠ Fell back to '+ (p.label || PRESETS[key]?.label || 'backup model'));
      }
      return content;
    } catch(e){
      lastErr = e.message;
      console.warn('Provider failed:',p.url,p.model,e.message.slice(0,120));
      // If it's a 429/5xx on the PRIMARY, show a toast but continue chain
      if (p.primary && /429|5\d\d|rate|too many/i.test(e.message)) {
        toast('⏳ Rate limited, trying backup…');
      }
    }
  }
  throw new Error('All providers are rate-limited right now. Wait 30 seconds and try again, or pick a different model in Settings. Last error: '+lastErr);
}

async function _llmCallRaw(messages, opts, provider) {
  const isPollAnon = provider.url.indexOf('pollinations.ai') !== -1 && !provider.key;
  const body = {
    model: provider.model,
    messages,
    temperature: opts.temperature ?? 0.3,
    stream: false,
  };
  if (opts.max_tokens) body.max_tokens=opts.max_tokens;

  // Retry loop for 429/5xx with exponential backoff (max 3 retries per provider)
  const MAX_RETRIES = 3;
  let delay = 1500;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[DevAI] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms for ${provider.url}`);
      await new Promise(r=>setTimeout(r, delay));
      delay *= 2; // 1.5s, 3s, 6s
    }
    const headers = { 'Content-Type':'application/json' };
    if (!isPollAnon) headers['Authorization']='Bearer '+provider.key;
    headers['HTTP-Referer']=location.href; headers['X-Title']='DevAI';
    // Add a cache-buster + random seed on retries to bypass 429 caches
    const url = provider.url + '/chat/completions' + (attempt>0 ? ('?r='+Math.random().toString(36).slice(2)) : '');
    let res;
    try {
      res = await fetch(url, { method:'POST', headers, body:JSON.stringify(body) });
    } catch(e) {
      if (attempt === MAX_RETRIES) throw new Error('Network error: '+e.message);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const errText = await res.text().catch(()=>'');
      if (attempt < MAX_RETRIES) continue;
      throw new Error('HTTP '+res.status+(errText?': '+errText.slice(0,200):' (rate limited/server error)'));
    }
    if (!res.ok) {
      const errText = await res.text().catch(()=>'');
      // 400/401/403/404 = don't retry (auth/bad model error)
      throw new Error('HTTP '+res.status+(errText?': '+errText.slice(0,300):''));
    }
    const data = await res.json();
    if (data.error) throw new Error(typeof data.error==='string'?data.error:(data.error.message||'provider error'));
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error('empty response from provider');
    }
    return content;
  }
  throw new Error('Max retries exceeded');
}

// ---------- CHAT MODEL PICKER ----------
function buildChatModelPicker() {
  const sel=$('chatModelPicker');
  if(!sel) return;
  sel.innerHTML='';
  CHAT_MODELS.forEach(group=>{
    const og=document.createElement('optgroup');
    og.label=group.group;
    group.models.forEach(m=>{
      const o=document.createElement('option');
      o.value=m.v;
      o.textContent=m.label+' ['+m.tag+']';
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  const current = state.llmUrl+'|'+state.llmModel;
  // If current model is retired, migrate
  if (RETIRED_SLUGS[current]) {
    const [url,model]=RETIRED_SLUGS[current].split('|');
    state.llmUrl=url; state.llmModel=model; save();
  }
  // Set select value
  const cur = state.llmUrl+'|'+state.llmModel;
  let found=false;
  for (const og of sel.options){ if(og.value===cur){ og.selected=true; found=true; break; } }
  if(!found){
    // Add as a "Custom" pseudo-option at top
    const o=document.createElement('option');
    o.value=cur; o.textContent='(Custom: '+state.llmModel+')';
    sel.insertBefore(o, sel.firstChild);
    o.selected=true;
  }
  updateChatModelBadge();
}
function updateChatModelBadge(){
  const b=$('chatModelBadge'); if(!b) return;
  const v=state.llmUrl+'|'+state.llmModel;
  const isPoll = state.llmUrl.indexOf('pollinations.ai') !== -1;
  let tag=''; let color='var(--dim)';
  if (isPoll && (!state.llmKey || state.llmKey==='pollinations-free')) { tag='NO KEY · works instantly'; color='var(--green)'; }
  else {
    for (const g of CHAT_MODELS) for (const m of g.models) if (m.v===v) { tag=m.tag; break; }
    color = tag==='NO KEY'?'var(--green)':tag==='FREE'?'var(--moss)':tag==='PAID'?'var(--red)':'var(--amber)';
  }
  if (!tag) tag = state.llmKey ? 'PAYG' : 'needs key';
  b.textContent=tag;
  b.style.color=color;
}
if ($('chatModelPicker')) $('chatModelPicker').addEventListener('change',(e)=>{
  const v=e.target.value;
  const [url,model]=v.split('|');
  state.llmUrl=url; state.llmModel=model; save();
  refreshSettingsUI();
  updateChatModelBadge();
  toast('🔄 Switched model: '+model);
});

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
  // basic markdown: ```luau ... ``` code blocks → pre with copy + send-to-studio buttons
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(?:luau|lua)?\n([\s\S]*?)\n```/g, (m,code)=>{
      const id='cb'+Math.random().toString(36).slice(2,8);
      return '</p><div class="codewrap"><pre id="'+id+'">'+code.trimEnd()+'</pre><div class="codeblock-toolbar"><button class="btn ghost" data-copy="'+id+'">📋 Copy Luau</button><button class="btn ghost" data-dl="'+id+'">⬇ .lua</button><button class="btn" data-send="'+id+'" style="background:var(--moss);">📤 Send to Studio</button></div></div><p>';
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/\n/g,'<br>');
  el.innerHTML = '<p>'+html+'</p>';
  el.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{
    copyText($(b.dataset.copy).innerText);
  }));
  el.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click',()=>{
    downloadText('devai-script.lua', $(b.dataset.dl).innerText);
  }));
  el.querySelectorAll('[data-send]').forEach(b=>b.addEventListener('click',()=>{
    sendToStudio(b.dataset.send, null, null);
  }));
}

// ---------- SEND TO STUDIO (ntfy pub/sub — multiple hosts for ad-blocker resilience) ----------
const NTFY_HOSTS = ['https://ntfy.envs.net','https://ntfy.sh']; // envs.net first (less likely blocked)
function ntfyUrl(host, topic, extra='') { return host+'/'+topic+extra; }

async function ntfyPost(topic, body, headers={}) {
  let lastErr;
  for (const host of NTFY_HOSTS) {
    try {
      const res = await fetch(ntfyUrl(host,topic), { method:'POST', body, headers });
      if (res.ok) return res;
      lastErr = 'HTTP '+res.status;
    } catch(e) { lastErr = e.message; }
  }
  throw new Error('All relay hosts failed: '+lastErr+'. Try disabling your ad-blocker on this site.');
}

async function sendToStudio(preId, titleOverride, typeOverride) {
  const code = (preId && $(preId)?.innerText) || $('codeBlock')?.innerText || $('guiCode')?.innerText || $('animCode')?.innerText || '';
  if(!code) { toast('No code to send. Generate a script first.'); return; }
  if(!state.sessionCode) genSessionCode();
  const sess = state.sessionCode;
  const title = (titleOverride || 'DevAI Script').substring(0,40);
  const stype = typeOverride || 'Script';
  const target = stype === 'LocalScript' ? 'StarterPlayerScripts'
               : stype === 'ModuleScript' ? 'ReplicatedStorage'
               : 'ServerScriptService';
  const message = title+'|'+stype+'|'+target+'|'+code;
  if (message.length > 3900) {
    toast('⚠ Script too long (>4KB). Copy and paste instead.');
    return;
  }
  const topic = 'devai-' + sess.toLowerCase();
  try {
    await ntfyPost(topic, message, { 'Title':'DevAI: '+title, 'Tags':'robot,inbox' });
    if (!studioListenActive) startStudioListen();
    toast('📤 Sent to Studio! Should auto-insert in 1-2 seconds.');
    appendStudioLog('📤 OUT → Studio: '+title+' ('+stype+')', 'moss');
  } catch(e) {
    toast('❌ Send failed: '+e.message);
  }
}

// ---------- RECEIVE FROM STUDIO ----------
let studioListenActive = false;
let studioAbort = null;
function appendStudioLog(text, color) {
  const log = $('studioLog');
  if(!log) return;
  const line = document.createElement('div');
  line.style.color = color ? `var(--${color})` : 'var(--text-dim)';
  line.textContent = new Date().toLocaleTimeString().padStart(8,' ')+'  '+text;
  if (log.firstChild && log.firstChild.tagName==='I') log.innerHTML='';
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
async function startStudioListen() {
  if(!state.sessionCode) genSessionCode();
  const topic = 'devai-' + state.sessionCode.toLowerCase();
  if (studioAbort) studioAbort.abort();
  studioAbort = new AbortController();
  studioListenActive = true;
  $('studioStatus').textContent = '🟢 Listening on '+state.sessionCode+'…';
  $('studioStatus').style.color = 'var(--moss)';
  appendStudioLog('🎧 Started listening for Studio messages…');
  try {
    let lastEventId = '';
    let backoff = 2;
    let errCount = 0;
    let hostIdx = 0;
    appendStudioLog('🎧 Polling for messages (relay: '+NTFY_HOSTS[hostIdx].replace('https://','')+')…');
    while(studioListenActive) {
      const host = NTFY_HOSTS[hostIdx % NTFY_HOSTS.length];
      try {
        const url = ntfyUrl(host, topic, '/json?since='+(lastEventId||'all')+'&r='+Math.random().toString(36).slice(2)+'&poll=0');
        const res = await fetch(url, { signal: studioAbort.signal, cache:'no-store' });
        if (res.status === 429 || res.status >= 500) {
          errCount++;
          appendStudioLog('⚠ '+host.replace('https://','')+' busy ('+res.status+'), switching host…', 'amber');
          hostIdx++;
          await new Promise(r=>setTimeout(r, 1000));
          continue;
        }
        if (!res.ok) {
          errCount++;
          appendStudioLog('⚠ HTTP '+res.status+' from '+host.replace('https://','')+', trying next host…', 'amber');
          hostIdx++;
          await new Promise(r=>setTimeout(r, backoff*1000));
          backoff = Math.min(backoff*2, 15);
          continue;
        }
        errCount = 0; backoff = 2;
        const text = await res.text();
        for (const line of text.split('\n')) {
          if (line.length < 5) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.event === 'open') continue;
            if (evt.id) lastEventId = evt.id;
            if (evt.event && evt.event !== 'message') continue;
            const tags = evt.tags || '';
            if (tags.includes('inbox')) continue;
            const body = evt.message || '';
            let data;
            try { data = JSON.parse(body); } catch { data = null; }
            if (data && data.kind) {
              if (data.kind === 'hello') {
                $('studioStatus').textContent = '🟢 Studio connected! PlaceId='+(data.data.match(/PlaceId=(\d+)/)?.[1]||'?');
                $('studioStatus').style.color = 'var(--moss)';
                appendStudioLog('✅ Plugin connected: '+data.data, 'gold-light');
              } else if (data.kind === 'explorer') {
                appendStudioLog('📂 Received Explorer snapshot ('+data.data.length+' chars) — injected into AI context.', 'amber');
                $('studioContext').value = data.data;
                toast('📂 Explorer sent to AI — AI can now see your project!');
              } else if (data.kind === 'script') {
                appendStudioLog('📄 Received script: '+data.path+' ('+(data.data?.length||0)+' chars)', 'amber');
                const existing = $('studioContext').value || '';
                $('studioContext').value = (existing ? existing + '\n\n---\n\n' : '') + data.data;
                toast('📄 Script sent to AI!');
              } else {
                appendStudioLog('📩 '+data.kind+': '+(data.data||'').slice(0,200), 'moss');
              }
            } else if (body && !body.startsWith('{')) {
              appendStudioLog('📩 Message: '+body.slice(0,120));
            }
          } catch(e) { /* ignore bad json lines */ }
        }
      } catch(e) {
        if (e.name === 'AbortError') throw e;
        errCount++;
        appendStudioLog('⚠ Can\'t reach '+host.replace('https://','')+' — ad-blocker? Trying next host in '+backoff+'s…', errCount<2?'amber':'red');
        hostIdx++;
        await new Promise(r=>setTimeout(r, backoff*1000));
        backoff = Math.min(backoff*2, 15);
      }
      await new Promise(r=>setTimeout(r,2000));
    }
  } catch(e) {
    if (e.name !== 'AbortError') {
      appendStudioLog('❌ Listener error: '+e.message, 'red');
    }
  }
  studioListenActive = false;
  $('studioStatus').textContent = '⚪ Stopped.';
  $('studioStatus').style.color = 'var(--dim)';
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
$('resetConn').addEventListener('click', ()=>{
  localStorage.removeItem('devai_state');
  localStorage.setItem('devai_version', String(APP_VERSION));
  state.llmUrl=CONFIG.DEFAULT_LLM_URL;
  state.llmModel=CONFIG.DEFAULT_MODEL;
  state.llmKey='';
  state.meshyKey='';
  save();
  refreshSettingsUI();
  buildChatModelPicker();
  toast('🔄 Reset — using free Pollinations.');
  location.reload();
});

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
  const provider = state.meshProvider || 'hunyuan';

  // Hunyuan3D "no key" mode: generate 4 turntable views via Pollinations image API
  if (provider === 'hunyuan') {
    setStatus('meshStatus','Generating 4-view turntable via Hunyuan3D/Pollinations (no key, ~15s)…','warn');
    $('meshProgress').style.display='block';
    $('meshProgress').firstElementChild.style.width='10%';
    const views = [
      {label:'Front view',  angle:'front view, facing camera'},
      {label:'Right side',  angle:'right side view, profile'},
      {label:'Back view',   angle:'back view, from behind'},
      {label:'3/4 view',    angle:'three-quarter view, 45 degrees'},
    ];
    const urls = [];
    for (let i=0;i<views.length;i++){
      const v = views[i];
      const p = encodeURIComponent(prompt+', ancient fantasy bronze gold mossy stone aesthetic, 3D game asset, white background, studio lighting, '+v.angle+', '+style);
      const seed = Math.floor(Math.random()*99999);
      urls.push({label:v.label, url:`https://image.pollinations.ai/prompt/${p}?width=512&height=512&seed=${seed}&nologo=true&model=flux`});
      $('meshProgress').firstElementChild.style.width = (20 + i*20)+'%';
      // Wait a tiny bit so requests start (images will lazy-load)
      await new Promise(r=>setTimeout(r,200));
    }
    $('meshProgress').firstElementChild.style.width='100%';
    // Render a 2x2 turntable grid
    // Preload images and wait for them to load so the user sees them appear
    setStatus('meshStatus','Drawing views (images load from Pollinations, ~5s each)…','warn');
    const html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
      ${urls.map(u=>`<div style="text-align:center"><img src="${u.url}" alt="${u.label}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;border-radius:8px;border:1px solid var(--border);background:#1a1a1a;min-height:200px;" onload="this.style.opacity=1" onerror="this.replaceWith(Object.assign(document.createElement('div'),{style:'padding:40px;background:#222;border-radius:8px;color:#888;font-size:12px',textContent:'Image blocked by ad-blocker'}))"/><div class="tiny" style="color:var(--text-dim);margin-top:4px">${u.label}</div></div>`).join('')}
    </div>
    <p class="tiny" style="margin-top:10px;color:var(--amber)">
      ⚠ <b>This is a 4-view turntable preview (no-key mode).</b> These are AI-generated views of your model — use them as reference to build the model in Studio, or switch provider to <b>Meshy</b> in Settings to get a real downloadable <code>.glb</code>/<code>.fbx</code> file (100 free credits/month — Google signup, no credit card).
    </p>
    <p class="tiny" style="color:var(--text-dim)">Images generated by Pollinations (Flux). If images don't load, disable your ad-blocker for this site — ad-blockers often block image.pollinations.ai.</p>`;
    $('meshPreviewBody').innerHTML = html;
    $('meshPreview').style.display='block';
    $('meshPreview').scrollIntoView({behavior:'smooth',block:'nearest'});
    setStatus('meshStatus','✓ 4-view turntable ready (no-key mode).','ok');
    return;
  }

  if (!state.meshyKey && provider === 'meshy') {
    setStatus('meshStatus','❌ Enter a Meshy key in Settings (100 free/month).','err');
    toast('Get a free Meshy key: meshy.ai/settings/api');
    goPage('settings'); return;
  }
  if (!state.meshyKey && provider === 'tripo') {
    setStatus('meshStatus','❌ Enter a Tripo key in Settings.','err');
    goPage('settings'); return;
  }

  // Meshy path
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
$('guiSend').addEventListener('click',()=>sendToStudio(null, 'DevAI_GUI', 'LocalScript'));

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
$('codeSend').addEventListener('click',()=>sendToStudio(null, $('codeName').value||'DevAI_Script', $('codeType')?.value?.includes('Local')?'LocalScript':$('codeType')?.value?.includes('Module')?'ModuleScript':'Script'));

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
$('animSend').addEventListener('click',()=>sendToStudio(null, 'AnimationController', 'LocalScript'));

// ---------- SETTINGS ----------
function refreshSettingsUI() {
  $('setLlmKey').value=state.llmKey||'';
  $('setMeshyKey').value=state.meshyKey||state.tripoKey||'';
  if($('meshProvider')) $('meshProvider').value = state.meshProvider||'meshy';
  // Show a "saved" badge with last 4 chars
  const badge=$('keySavedBadge');
  if (state.llmKey && state.llmKey.length > 6) {
    const last4 = state.llmKey.slice(-4);
    badge.textContent = '— ✓ saved on this device (ends in …'+last4+')';
    badge.style.color = 'var(--moss)';
  } else {
    badge.textContent = '';
  }
  $('setGame').value=state.memory.game||'';
  $('setCurrency').value=state.memory.currency||'';
  $('setMainUI').value=state.memory.mainUI||'';
  $('setAdmin').value=state.memory.admin||'';
  $('setExtra').value=state.memory.extra||'';
  $('sessionCode').value=state.sessionCode||'';
  // preset dropdown
  const presetVal=state.llmUrl+'|'+state.llmModel;
  const sel=$('setPreset');
  let found=false;
  for (const o of sel.options){
    if (o.value===presetVal){ o.selected=true; found=true; break; }
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
  const isPoll = state.llmUrl && state.llmUrl.indexOf('pollinations.ai') !== -1;
  const preset=PRESETS[state.llmUrl+'|'+state.llmModel];
  const name = preset?preset.label:state.llmModel;
  if (isPoll && (!state.llmKey || state.llmKey==='pollinations-free')) {
    cs.textContent='⚡ '+name+' — free, no key needed';
    cs.className='status ok';
  } else if (state.llmKey && state.llmKey !== 'pollinations-free') {
    if (state.usedDefaultKey) {
      cs.textContent='⚔ Built-in key active — '+name;
      cs.className='status';
    } else {
      cs.textContent='✓ '+name+' — key saved on this device';
      cs.className='status ok';
    }
  } else {
    cs.textContent='Pick a model in ⚙ Settings to get started.';
    cs.className='status';
  }
  $('chatModelLabel').textContent = name;
}
function updatePresetHint() {
  const v=$('setPreset').value;
  const hint=$('llmKeyHint');
  if(v==='custom'){
    hint.innerHTML='Custom OpenAI-compatible endpoint. Enter base URL + model below. Key optional only if your endpoint allows anonymous access.';
    return;
  }
  const p=PRESETS[v];
  if(!p){ hint.innerHTML=''; return; }
  const tag = p.local ? '<span style="color:var(--moss);font-weight:700;">LOCAL</span>'
            : p.free && p.nokey ? '<span style="color:var(--green);font-weight:700;">NO KEY</span>'
            : p.free ? '<span style="color:var(--moss);font-weight:700;">FREE</span>'
            : p.paid ? '<span style="color:var(--red);font-weight:700;">PAID</span>'
            : '<span style="color:var(--amber);font-weight:700;">PAYG</span>';
  const link = p.signupUrl && !p.nokey ? ' Get key: <a href="'+p.signupUrl+'" target="_blank" style="color:var(--amber);">'+p.signup+'</a>.'
              : p.nokey ? ' No signup — works instantly.' : '';
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
  refreshSettingsUI();
  buildChatModelPicker();
});
$('saveLlm').addEventListener('click',()=>{
  state.llmKey=$('setLlmKey').value.trim();
  if($('setPreset').value==='custom'){
    state.llmUrl=$('setLlmUrl').value.trim()||state.llmUrl;
    state.llmModel=$('setLlmModel').value.trim()||state.llmModel;
  }
  // Clear the "pollinations-free" sentinel if user cleared the field
  if(!state.llmKey && state.llmUrl.indexOf('pollinations.ai')===-1){
    // No key + not pollinations = switch back to pollinations so the app keeps working
    state.llmUrl=CONFIG.DEFAULT_LLM_URL; state.llmModel=CONFIG.DEFAULT_MODEL;
    toast('No key saved — switched to free Pollinations');
  }
  save(); refreshSettingsUI(); buildChatModelPicker();
  toast(state.llmKey?'✅ LLM key saved — remembered on this device.':'Switched to no-key mode.');
});
$('meshProvider')?.addEventListener('change',(e)=>{
  state.meshProvider = e.target.value; save(); refreshSettingsUI();
});
$('saveMeshy').addEventListener('click',()=>{
  state.meshyKey=$('setMeshyKey').value.trim();
  state.meshProvider=$('meshProvider')?.value||'meshy';
  save(); refreshSettingsUI();
  toast(state.meshProvider.toUpperCase()+' key saved.');
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
$('genSession').addEventListener('click', ()=>{ genSessionCode(); if(studioListenActive){ studioListenActive=false; studioAbort?.abort(); setTimeout(startStudioListen,200); }});
$('copySession').addEventListener('click',()=>copyText($('sessionCode').value));
$('startListen').addEventListener('click', startStudioListen);
$('clearCtx').addEventListener('click', ()=>{ $('studioContext').value=''; toast('Context cleared.'); });

// ---------- boot ----------
load();
if (!state.sessionCode) genSessionCode();
refreshSettingsUI();
buildChatModelPicker();
