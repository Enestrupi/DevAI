// DevAI Backend — Lemonade Studio Bridge
// Runs locally on http://127.0.0.1:42069
// No Python. API keys stay on this server, never exposed to browser or plugin.
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = 42069;
const DATA_DIR = path.join(__dirname,'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});

const app = express();
app.use(cors());
app.use(express.json({limit:'8mb'}));
app.use(express.static(path.join(__dirname,'..','site')));

const server = http.createServer(app);
const wss = new WebSocket.Server({server,path:'/ws'});

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  pairCode: null,
  pairExpiry: 0,
  pluginConn: null,        // token → {id,lastSeen,info}
  pluginToken: null,
  actionQueue: [],         // pending actions for plugin
  actionIdCounter: 1,
  results: {},             // actionId → result
  browserSockets: new Set(),
  keys: loadJSON('keys.json',{}),
  projects: loadJSON('projects.json',{default:{id:'default',name:'My Game',createdAt:Date.now()}}),
  history: loadJSON('history.json',[]),
  outputBuffer: [],
};
function loadJSON(f,def){try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,f),'utf8'));}catch(e){return def;}}
function saveJSON(f,o){fs.writeFileSync(path.join(DATA_DIR,f),JSON.stringify(o,null,2));}

// ─── Browser WebSocket ───────────────────────────────────────────────────────
wss.on('connection',(ws,req)=>{
  const ua = req.headers['user-agent']||'';
  const isPlugin = req.headers['x-devai-plugin']==='1' || ua.includes('Roblox');
  // Plugin connects via HTTP long poll, not WebSocket (Roblox WS is flaky).
  // All /ws connections are browsers.
  state.browserSockets.add(ws);
  ws.send(JSON.stringify({type:'hello',version:26}));
  broadcastConnStatus();
  ws.on('message',raw=>{try{handleBrowserMsg(ws,JSON.parse(raw));}catch(e){ws.send(JSON.stringify({type:'error',error:String(e)}));}});
  ws.on('close',()=>{state.browserSockets.delete(ws);broadcastConnStatus();});
});
function broadcast(obj){
  const s=JSON.stringify(obj);
  state.browserSockets.forEach(ws=>{if(ws.readyState===1)ws.send(s);});
}
function broadcastConnStatus(){
  broadcast({type:'studio_status',connected:!!state.pluginConn,info:state.pluginConn&&state.pluginConn.info});
}

function handleBrowserMsg(ws,msg){
  switch(msg.type){
    case 'generate_pair': {
      const code = crypto.randomBytes(3).toString('hex').toUpperCase().match(/.{1,4}/g).join('-').slice(0,9);
      state.pairCode = code; state.pairExpiry = Date.now()+5*60*1000;
      ws.send(JSON.stringify({type:'pair_code',code}));
      break;
    }
    case 'chat': sendChatToAI(ws,msg); break;
    case 'send_to_studio': queueAction(ws,msg.action,'user'); break;
    case 'approve_action': approveAction(msg.actionId,msg.approved,msg.alteredSource); break;
    case 'cancel_action': cancelAction(msg.actionId); break;
    case 'get_output': ws.send(JSON.stringify({type:'output',lines:state.outputBuffer.slice(-200)})); break;
    case 'clear_output': state.outputBuffer=[]; broadcast({type:'output_cleared'}); break;
    case 'save_keys': state.keys=msg.keys||{}; saveJSON('keys.json',state.keys); ws.send(JSON.stringify({type:'keys_saved'})); break;
    case 'get_keys': ws.send(JSON.stringify({type:'keys',providers:Object.fromEntries(Object.keys(state.keys).map(k=>[k,true]))})); break;
    case 'get_models': ws.send(JSON.stringify({type:'models',models:listModels()})); break;
    case 'get_history': ws.send(JSON.stringify({type:'history',history:state.history})); break;
    case 'start_output_stream': queueAction(null,{op:'get_output',subscribe:true},'system'); break;
  }
}

// ─── AI Routing ──────────────────────────────────────────────────────────────
const MODELS = [
  {id:'auto',name:'Auto',provider:'DevAI',best:'Picks the best model for your task'},
  {id:'claude-sonnet',name:'Claude Sonnet',provider:'Anthropic',best:'Complex Roblox coding, architecture, debugging'},
  {id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',best:'General coding, Roblox systems, explanations'},
  {id:'gpt-4o-mini',name:'GPT-4o Mini',provider:'OpenAI',best:'Fast responses, small scripts'},
  {id:'gemini-pro',name:'Gemini Pro',provider:'Google',best:'Large context, multimodal'},
  {id:'deepseek',name:'DeepSeek Coder',provider:'DeepSeek',best:'Coding & technical reasoning (free key)'},
  {id:'groq-llama',name:'Llama 3.1 70B (Groq)',provider:'Groq',best:'Extremely fast responses (free key)'},
];
function listModels(){return MODELS.map(m=>({...m,configured:m.id==='auto'||!!state.keys[providerForModel(m.id)]}));}
function providerForModel(id){return { 'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llama':'groq'}[id];}
function pickModel(text,requested){
  if(requested&&requested!=='auto')return requested;
  const t=text.toLowerCase();
  if(!state.keys.anthropic && !state.keys.openai && !state.keys.google && !state.keys.deepseek && !state.keys.groq) return 'mock';
  if(t.includes('error')||t.includes('debug')||t.includes('architecture')||t.length>2000){
    if(state.keys.anthropic)return 'claude-sonnet';if(state.keys.google)return 'gemini-pro';
  }
  if(t.includes('fast')||t.includes('quick')){if(state.keys.groq)return 'groq-llama';}
  if(t.includes('/create')||t.includes('system')||t.includes('code')||t.includes('script')){if(state.keys.deepseek)return 'deepseek';if(state.keys.openai)return 'gpt-4o';}
  if(state.keys.openai)return 'gpt-4o-mini';if(state.keys.groq)return 'groq-llama';if(state.keys.deepseek)return 'deepseek';
  return Object.keys(state.keys)[0]||'mock';
}

async function sendChatToAI(ws,{messages,model,context,mode}){
  const userText = messages[messages.length-1].content;
  const chosenId = pickModel(userText+(context?'\n'+JSON.stringify.context:''),model);
  const chosen = MODELS.find(m=>m.id===chosenId)||MODELS[0];
  const why = whyModel(chosenId,userText);
  ws.send(JSON.stringify({type:'ai_meta',model:chosen.name,provider:chosen.provider,best:chosen.best,why}));
  let reply;
  if(chosenId==='mock'||!state.keys[providerForModel(chosenId)]){
    reply = mockReply(userText,mode);
    ws.send(JSON.stringify({type:'ai_delta',delta:reply}));
  }else{
    try{reply = await callAI(chosenId,buildSystemPrompt(mode,context),messages,delta=>ws.send(JSON.stringify({type:'ai_delta',delta})));}
    catch(e){ws.send(JSON.stringify({type:'ai_delta',delta:`\n\n⚠ AI error: ${e.message}. Check your API key in Settings.`}));}
  }
  // Parse code blocks and auto-queue approved actions? No — user clicks Send to Studio.
  ws.send(JSON.stringify({type:'ai_done'}));
}

function whyModel(id,text){
  const map={'claude-sonnet':'Your request involves complex reasoning or debugging.','gpt-4o':'General-purpose coding task.','gpt-4o-mini':'Straightforward question, using fast mini model to save cost.','gemini-pro':'Large context / project analysis needed.','deepseek':'Code generation task — DeepSeek Coder is excellent at Luau.','groq-llama':'Simple/fast request, using ultra-low-latency Groq.','mock':'No API key configured. Add a key in Settings for real AI.'};
  return map[id]||'Auto-selected.';
}

function buildSystemPrompt(mode,ctx){
  if(mode==='design')return 'You are DevAI Design Mode. Plan Roblox games. Output structured plans, not code.';
  let p=`You are DevAI, an expert Roblox Studio copilot writing production Luau.
Rules:
- Annotate every code block with -- @location Path.To.Parent.ScriptName on the FIRST line so the plugin knows where to insert.
- Use task.spawn, wrap DataStore in pcall, use WaitForChild with timeout.
- When the user wants to create something that needs multiple scripts, first output a BUILD PLAN as a bullet list, then one lua code block per file.
- After code blocks you may include a short explanation.
- For destructive changes (deletes/overwrites), show a diff and ask confirmation.`;
  if(ctx)p+='\n\n[PROJECT CONTEXT]\n'+JSON.stringify(ctx).slice(0,6000);
  return p;
}

async function callAI(modelId,sys,messages,onDelta){
  const prov = providerForModel(modelId);
  const key = state.keys[prov];
  const body = {model:modelId,messages:[{role:'system',content:sys},...messages],stream:!!onDelta,max_tokens:4096};
  let endpoint,headers;
  if(prov==='anthropic'){
    endpoint='https://api.anthropic.com/v1/messages';
    headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'};
    const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({model:modelId,max_tokens:4096,messages:[{role:'user',content:sys+'\n\n'+messages[messages.length-1].content}],stream:!!onDelta})});
    return await consumeStream(r,onDelta,'anthropic');
  }
  if(prov==='google'){
    endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${key}`;
    headers={'content-type':'application/json'};
    const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({contents:[{parts:[{text:sys+'\n\n'+messages[messages.length-1].content}]}]})});
    return await consumeStream(r,onDelta,'google');
  }
  // openai-compatible
  const ep = {openai:'https://api.openai.com/v1/chat/completions',deepseek:'https://api.deepseek.com/v1/chat/completions',groq:'https://api.groq.com/openai/v1/chat/completions'}[prov];
  headers={'authorization':'Bearer '+key,'content-type':'application/json'};
  const r=await fetch(ep,{method:'POST',headers,body:JSON.stringify(body)});
  return await consumeStream(r,onDelta,'openai');
}
async function consumeStream(r,onDelta,fmt){
  if(!r.ok){const t=await r.text();throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`);}
  if(!onDelta){const j=await r.json();return fmt==='anthropic'?j.content[0].text:j.choices[0].message.content;}
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='',full='';
  while(true){
    const{done,value}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});
    let nl;while((nl=buf.indexOf('\n'))>=0){
      const line=buf.slice(0,nl).replace(/^data:\s*/,'').trim();buf=buf.slice(nl+1);
      if(!line||line==='[DONE]')continue;
      try{
        const j=JSON.parse(line);let d='';
        if(fmt==='openai')d=j.choices?.[0]?.delta?.content||'';
        else if(fmt==='anthropic'){if(j.type==='content_block_delta')d=j.delta?.text||'';}
        if(d){onDelta(d);full+=d;}
      }catch(e){}
    }
  }
  return full;
}

function mockReply(text,mode){
  const topic = text.replace(/^\/(create|scan|fix|explain)\s*/i,'').trim()||'system';
  const name = topic.split(/\s+/).slice(0,2).map(w=>(w[0]||'').toUpperCase()+w.slice(1)).join('').replace(/[^A-Za-z]/g,'')||'Script';
  return `## ${mode==='design'?'🎨 Design':'⚔ Build'}: ${topic}\n\nNo API key configured — add one in ⚙️ Settings for real AI responses. Here's a starter template:\n\n\`\`\`lua\n-- @location ServerScriptService.${name}Service\nlocal PS=game:GetService(\"Players\")\nlocal RS=game:GetService(\"ReplicatedStorage\")\nPS.PlayerAdded:Connect(function(p)\n\tprint(\"Welcome\",p.Name)\nend)\n\`\`\`\n\n\`\`\`lua\n-- @location StarterPlayerScripts.${name}Client\nlocal lp=game:GetService(\"Players\").LocalPlayer\nprint(\"Client ready for\",lp.Name)\n\`\`\`\n\nClick 📤 Send to Studio on each block to insert.`;
}

// ─── Action Queue → Plugin ──────────────────────────────────────────────────
const ALLOWED_OPS = new Set(['get_project_tree','get_selection','get_script','get_output','create_instance','update_script','rename_instance','move_instance','delete_instance','scan_project']);

function queueAction(ws,action,source){
  if(!action||!action.op||!ALLOWED_OPS.has(action.op)){
    const err='Unknown or disallowed op: '+(action&&action.op);
    if(ws)ws.send(JSON.stringify({type:'error',error:err}));else console.log('Rejected:',err);
    return null;
  }
  const id = state.actionIdCounter++;
  const rec = {id,op:action.op,params:action.params||{},source,status:'pending',ts:Date.now()};
  state.actionQueue.push(rec);
  state.results[id]={status:'queued'};
  broadcast({type:'action_queued',action:rec});
  // For destructive operations the browser must approve first — handled client-side before queuing.
  if(ws)ws.send(JSON.stringify({type:'action_queued',actionId:id}));
  return id;
}
function approveAction(id,approved,altered){
  const a = state.actionQueue.find(x=>x.id===id);if(!a)return;
  a.status = approved?'queued':'cancelled';
  if(altered)a.params.source=altered;
  broadcast({type:'action_updated',actionId:id,status:a.status});
}
function cancelAction(id){
  const a=state.actionQueue.find(x=>x.id===id);if(!a)return;
  a.status='cancelled';broadcast({type:'action_updated',actionId:id,status:'cancelled'});
}

// ─── Plugin HTTP API (long-poll) ────────────────────────────────────────────
// Roblox HttpService does not support WebSocket reliably; long-poll works.
app.post('/api/plugin/pair',(req,res)=>{
  const {code} = req.body||{};
  if(!code||code!==state.pairCode||Date.now()>state.pairExpiry){return res.json({ok:false,error:'Invalid or expired code'});}
  const token = crypto.randomBytes(16).toString('hex');
  state.pluginToken = token;
  state.pluginConn = {id:token,lastSeen:Date.now(),info:{pairedAt:Date.now(),place:'unknown'}};
  state.pairCode=null;
  broadcastConnStatus();
  res.json({ok:true,token});
});
app.post('/api/plugin/poll',(req,res)=>{
  const {token} = req.body||{};
  if(!token||token!==state.pluginToken)return res.json({ok:false,error:'auth'});
  state.pluginConn.lastSeen=Date.now();
  // drain new actions
  const actions = state.actionQueue.filter(a=>a.status==='queued');
  actions.forEach(a=>a.status='sent');
  res.json({ok:true,actions,serverTime:Date.now()});
});
app.post('/api/plugin/result',(req,res)=>{
  const {token,actionId,success,path,error,info} = req.body||{};
  if(!token||token!==state.pluginToken)return res.json({ok:false});
  state.results[actionId]={success,path,error,info,ts:Date.now()};
  const a=state.actionQueue.find(x=>x.id===actionId);if(a){a.status=success?'done':'failed';a.result={success,path,error};}
  state.history.unshift({id:actionId,ts:Date.now(),op:a&&a.op,path,success,error});
  if(state.history.length>200)state.history.pop();saveJSON('history.json',state.history);
  broadcast({type:'action_result',actionId,success,path,error,info});
  res.json({ok:true});
});
app.post('/api/plugin/event',(req,res)=>{
  const {token,event,data} = req.body||{};
  if(!token||token!==state.pluginToken)return res.json({ok:false});
  if(event==='project_tree'){broadcast({type:'project_tree',tree:data});}
  else if(event==='script'){broadcast({type:'script',data});}
  else if(event==='output'){state.outputBuffer.push({ts:Date.now(),level:data.level||'info',message:data.message});if(state.outputBuffer.length>500)state.outputBuffer.shift();broadcast({type:'output_line',line:state.outputBuffer[state.outputBuffer.length-1]});}
  else if(event==='selection'){broadcast({type:'selection',data});}
  else if(event==='scan'){broadcast({type:'scan',data});}
  res.json({ok:true});
});
app.get('/api/health',(_,res)=>res.json({ok:true,version:27,connected:!!state.pluginConn}));
app.get('/api/models',(_,res)=>res.json({models:listModels()}));

// ─── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT,'127.0.0.1',()=>{
  console.log(`⚔ DevAI backend v27 running on http://127.0.0.1:${PORT}`);
  console.log(`  Website:  http://127.0.0.1:${PORT}/`);
  console.log(`  Plugin long-poll:  /api/plugin/*`);
});
