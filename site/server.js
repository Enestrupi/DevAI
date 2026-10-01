// 🐯 Enes AI Backend v31 — ZERO npm dependencies. Uses only Node built-ins.
// No `npm install` needed. Just `node server.js`.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const {smartMockReply} = require('./_mockreplies.js');

const PORT = 42069;
const DATA_DIR = path.join(__dirname,'data');
const SITE_DIR = path.join(__dirname,'..','site');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});

// No bundled keys — Enes AI works OFFLINE via smart built-in Roblox templates.
// Add free keys in ⚙️ Settings (DeepSeek/Groq give free credits instantly) to unlock full AI.
const DEMO_KEYS = {};

function readJSON(f,def){try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,f),'utf8'));}catch(e){return def;}}
function writeJSON(f,o){fs.writeFileSync(path.join(DATA_DIR,f),JSON.stringify(o,null,2));}

const state = {
  pairCode:null, pairExpiry:0, pluginToken:null, pluginConn:null,
  actionQueue:[], actionIdCounter:1, results:{},
  sockets:new Set(),
  keys:Object.assign({},DEMO_KEYS,readJSON('keys.json',{})),
  history:readJSON('history.json',[]),
};

const MODELS = [
  {id:'enes',name:'🐯 Enes AI',provider:'TigerCoder',best:'🏆 BEST — Your personal Roblox AI. Coding, scripting, debugging, full games',icon:'🐯',flagship:true,configured:true},
  {id:'auto',name:'Auto',provider:'Router',best:'Picks the smartest available model for your task',icon:'🤖',configured:true},
  {id:'claude-sonnet',name:'Claude Sonnet',provider:'Anthropic',best:'Complex Roblox architecture, big-picture game design, debugging',icon:'🟠'},
  {id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',best:'General coding, Roblox systems, clear explanations',icon:'🟢'},
  {id:'gpt-4o-mini',name:'GPT-4o Mini',provider:'OpenAI',best:'Ultra-fast small scripts, quick fixes',icon:'🟢'},
  {id:'gemini-pro',name:'Gemini Pro',provider:'Google',best:'Huge context, whole-project understanding, multimodal',icon:'🔵'},
  {id:'deepseek',name:'DeepSeek Coder',provider:'DeepSeek',best:'Code-specialist, FREE key at platform.deepseek.com',icon:'🟣'},
  {id:'groq-llm',name:'Llama 3.1 70B',provider:'Groq',best:'FASTEST responses, FREE key at console.groq.com',icon:'🔴'},
];
function refreshModelConfig(){
  const map={'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llm':'groq','enes':'deepseek'};
  // Enes always "configured" — routes to deepseek if key present, else smart templates
  MODELS.forEach(m=>{
    if(m.id==='auto'||m.id==='enes'){m.configured=true;return;}
    m.configured=!!state.keys[map[m.id]];
  });
}
refreshModelConfig();

const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.zip':'application/zip','.bat':'application/octet-stream','.lua':'text/plain','.map':'application/json'};

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req,res)=>{
  // CORS for browser API calls
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}


  // Parse body for POST
  if(req.method==='POST'){
    let body='';req.on('data',c=>body+=c);req.on('end',()=>{
      try{
        const data = body?JSON.parse(body):{};
        handlePost(req,res,data);
      }catch(e){sendJSON(res,400,{error:'bad json: '+e.message});}
    });
    return;
  }
  // GET — API or static
  if(req.url==='/api/health')return sendJSON(res,200,{ok:true,version:31,connected:!!state.pluginConn});
  if(req.url==='/api/models')return sendJSON(res,200,{models:MODELS});
  // Static files
  serveStatic(req,res);
});

function sendJSON(res,code,o){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o));}

function serveStatic(req,res){
  let p = req.url.split('?')[0];
  if(p==='/')p='/index.html';
  const fp = path.join(SITE_DIR,p);
  if(!fp.startsWith(SITE_DIR)){res.writeHead(403);return res.end('forbidden');}
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);return res.end('not found');}
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});
    res.end(data);
  });
}

// ── POST endpoints ───────────────────────────────────────────────────────────
function handlePost(req,res,data){
  if(req.url==='/api/plugin/pair'){
    const {code}=data;
    if(!code||code!==state.pairCode||Date.now()>state.pairExpiry)return sendJSON(res,200,{ok:false,error:'Invalid or expired code'});
    const token=crypto.randomBytes(16).toString('hex');
    state.pluginToken=token;state.pluginConn={id:token,lastSeen:Date.now(),info:{pairedAt:Date.now()}};
    state.pairCode=null;broadcast({type:'studio_status',connected:true});
    return sendJSON(res,200,{ok:true,token});
  }
  if(req.url==='/api/plugin/poll'){
    if(data.token!==state.pluginToken)return sendJSON(res,200,{ok:false,error:'auth'});
    if(state.pluginConn)state.pluginConn.lastSeen=Date.now();
    const actions = state.actionQueue.filter(a=>a.status==='queued');
    actions.forEach(a=>a.status='sent');
    return sendJSON(res,200,{ok:true,actions});
  }
  if(req.url==='/api/plugin/result'){
    if(data.token!==state.pluginToken)return sendJSON(res,200,{ok:false});
    const {actionId,success,path,error}=data;
    const a=state.actionQueue.find(x=>x.id===actionId);if(a){a.status=success?'done':'failed';a.result={success,path,error};}
    state.history.unshift({ts:Date.now(),actionId,op:a&&a.op,success,path,error});
    if(state.history.length>200)state.history.pop();writeJSON('history.json',state.history);
    broadcast({type:'action_result',actionId,success,path,error});
    return sendJSON(res,200,{ok:true});
  }
  if(req.url==='/api/plugin/event'){
    if(data.token!==state.pluginToken)return sendJSON(res,200,{ok:false});
    const ev={type:data.event,...(data.data||{})};
    broadcast(ev);
    if(data.event==='output'){/* store */}
    return sendJSON(res,200,{ok:true});
  }
  sendJSON(res,404,{error:'not found'});
}

// ── WebSocket ────────────────────────────────────────────────────────────────
// Lightweight WS handshake + frame parser (sufficient for local comms)
server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/ws'){socket.destroy();return;}
  handleWS(req,socket,head);
});
function handleWS(req,sock,head){
  const key = req.headers['sec-websocket-key'];
  if(!key){sock.destroy();return;}
  const accept = crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  let buf=head&&head.length?Buffer.from(head):Buffer.alloc(0);
  state.sockets.add(sock);
  sock.send=(obj)=>sendWS(sock,obj);
  sendWS(sock,{type:'hello',version:31});
  broadcastConnStatus();
  // Send initial models
  sendWS(sock,{type:'models',models:MODELS});
  sendWS(sock,{type:'history',history:state.history});
  sock.on('data',chunk=>{
    buf=Buffer.concat([buf,chunk]);
    try{
      while(buf.length>=2){
        const fin=(buf[0]&0x80)!==0,op=buf[0]&0x0f;
        const masked=(buf[1]&0x80)!==0;
        let len=buf[1]&0x7f,off=2;
        if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4;}
        else if(len===127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10;}
        const maskKey=masked?buf.slice(off,off+4):null;
        const hdr=off+(masked?4:0);
        if(buf.length<hdr+len)return;
        let payload=buf.slice(hdr,hdr+len);
        if(maskKey){for(let i=0;i<len;i++)payload[i]^=maskKey[i%4];}
        buf=buf.slice(hdr+len);
        if(op===8){sock.destroy();return;}
        if(op===1){try{const msg=JSON.parse(payload.toString());onClientMsg(sock,msg);}catch(e){}}
      }
    }catch(e){sock.destroy();}
  });
  sock.on('close',()=>{state.sockets.delete(sock);broadcastConnStatus();});
  sock.on('error',()=>{state.sockets.delete(sock);});
}
function sendWS(sock,obj){
  if(sock.destroyed)return;
  const str=JSON.stringify(obj);const data=Buffer.from(str,'utf8');
  let hdr;
  if(data.length<126)hdr=Buffer.from([0x81,data.length]);
  else if(data.length<65536){hdr=Buffer.alloc(4);hdr[0]=0x81;hdr[1]=126;hdr.writeUInt16BE(data.length,2);}
  else{hdr=Buffer.alloc(10);hdr[0]=0x81;hdr[1]=127;hdr.writeBigUInt64BE(BigInt(data.length),2);}
  try{sock.write(Buffer.concat([hdr,data]));}catch(e){}
}
function broadcast(obj){state.sockets.forEach(s=>sendWS(s,obj));}
function broadcastConnStatus(){broadcast({type:'studio_status',connected:!!state.pluginConn});}

function onClientMsg(sock,msg){
  try{
    switch(msg.type){
      case 'generate_pair':{
        const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';
        for(let i=0;i<8;i++){c+=chars[crypto.randomInt(chars.length)];if(i===3)c+='-';}
        state.pairCode=c;state.pairExpiry=Date.now()+5*60*1000;
        sendWS(sock,{type:'pair_code',code:c});break;
      }
      case 'get_models': sendWS(sock,{type:'models',models:MODELS});break;
      case 'get_keys': sendWS(sock,{type:'keys',providers:Object.fromEntries(Object.keys(state.keys).map(k=>[k,true]))});break;
      case 'get_history': sendWS(sock,{type:'history',history:state.history});break;
      case 'save_keys':{
        state.keys=msg.keys||{};writeJSON('keys.json',state.keys);refreshModelConfig();
        sendWS(sock,{type:'keys_saved'});broadcast({type:'models',models:MODELS});break;
      }
      case 'send_to_studio':{
        const a=msg.action;
        if(!ALLOWED_OPS.has(a.op)){sendWS(sock,{type:'error',error:'Unknown op: '+a.op});return;}
        const id=state.actionIdCounter++;
        const rec={id,op:a.op,params:a.params||{},status:'pending',ts:Date.now()};
        state.actionQueue.push(rec);state.results[id]={status:'queued'};
        broadcast({type:'action_queued',action:rec});break;
      }
      case 'approve_action':{
        const a=state.actionQueue.find(x=>x.id===msg.actionId);if(!a)break;
        a.status=msg.approved?'queued':'cancelled';if(msg.alteredSource)a.params.source=msg.alteredSource;
        broadcast({type:'action_updated',actionId:msg.actionId,status:a.status});break;
      }
      case 'cancel_action':{
        const a=state.actionQueue.find(x=>x.id===msg.actionId);if(!a)break;
        a.status='cancelled';broadcast({type:'action_updated',actionId:msg.actionId,status:'cancelled'});break;
      }
      case 'chat': handleChat(sock,msg);break;
      case 'clear_output': broadcast({type:'output_cleared'});break;
      case 'start_output_stream': queueAction(null,{op:'get_output',subscribe:true},'system');break;
    }
  }catch(e){sendWS(sock,{type:'error',error:String(e)});}
}

const ALLOWED_OPS = new Set(['get_project_tree','get_selection','get_script','get_output','create_instance','update_script','rename_instance','move_instance','delete_instance','scan_project']);
function queueAction(ws,action,source){
  if(!action||!ALLOWED_OPS.has(action.op))return null;
  const id=state.actionIdCounter++;
  const rec={id,op:action.op,params:action.params||{},source,status:'pending',ts:Date.now()};
  state.actionQueue.push(rec);broadcast({type:'action_queued',action:rec});return id;
}

// ── AI Router (no SDKs, use built-in fetch) ──────────────────────────────────
async function handleChat(sock,msg){
  const messages=msg.messages||[];const userText=messages[messages.length-1]?.content||'';
  const modelId=pickModel(userText,msg.model);const model=MODELS.find(m=>m.id===modelId);
  const why=whyModel(modelId,userText);
  sendWS(sock,{type:'ai_meta',model:model.name,why});
  const sys=buildSysPrompt(msg.mode,msg.context);
  let reply='';
  try{
    if(!state.keys[provFor(modelId)])throw new Error('no key');
    reply = await callAI(modelId,sys,userText,messages,delta=>sendWS(sock,{type:'ai_delta',delta}));
  }catch(e){
    reply = mockReply(userText);
    sendWS(sock,{type:'ai_delta',delta:reply});
  }
  sendWS(sock,{type:'ai_done'});
}
function provFor(id){return{'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llm':'groq','enes':'deepseek','auto':'deepseek'}[id]||'deepseek';}
function pickModel(text,req){
  if(req&&req!=='auto'&&req!=='enes')return req;
  // Default: Enes AI (routes to best available key; falls back to smart templates)
  if(state.keys.deepseek)return 'enes';
  if(state.keys.groq)return 'enes';
  return 'enes';
}
function whyModel(id,t){
  const map={
    'enes':'🐯 Your personal Enes AI — Roblox specialist',
    'claude-sonnet':'Complex reasoning, architecture, debugging',
    'gpt-4o':'General-purpose coding',
    'gpt-4o-mini':'Fast response',
    'gemini-pro':'Large context window',
    'deepseek':'Code-specialist LLM',
    'groq-llm':'Ultra-low latency (fastest)',
    'auto':'Auto-selected best available model',
  };
  return map[id]||'Selected';
}
function buildSysPrompt(mode,ctx){
  if(mode==='design')return "You are 🐯 ENES AI, Enes' personal Roblox design partner. Plan games: core loops, maps, progression, monetization, art direction. Output structured plans with named sections. Be specific, enthusiastic, and practical — Enes wants games players will LOVE.";
  let p=`You are 🐯 ENES AI — Enes' personal Roblox Studio expert. You write production-quality Luau for Roblox games. You are his coding partner: friendly, powerful, precise.

RULES:
- EVERY lua code block MUST start with a comment line: -- @location Path.To.Parent.ScriptName (e.g. -- @location ServerScriptService.CoinSystem, -- @location StarterPlayerScripts.CameraShake, -- @location ReplicatedStorage.Modules.Inventory).
- Use modern Luau: type hints where helpful, task.spawn/task.wait, pcall around DataStore/HttpService, WaitForChild with timeout for runtime objects.
- For multi-script systems, output a BULLETED BUILD PLAN first, then each script as a SEPARATE lua code block with its own @location.
- Use RemoteEvent/RemoteFunction in ReplicatedStorage for client<->server — never trust client input.
- Use CollectionService for tagged interactions, TweenService for polish, UserInputService/ContextActionService for controls.
- Write COMPLETE, runnable scripts — no "TODO" or "your code here". Fill in full logic.
- Be concise but complete. Never fabricate Roblox APIs. If unsure, say so.
- Talk like a friend and pro: "Here's the system..." not "Certainly! Here you go..."
- End with a short note on how to wire it up in Studio.`;
  if(ctx)p+='\n\n[ENES PROJECT CONTEXT]\n'+JSON.stringify(ctx).slice(0,8000);
  return p;
}
async function callAI(modelId,sys,user,messages,onDelta){
  const prov=provFor(modelId);const key=state.keys[prov];if(!key)throw new Error('no key');
  const conv=[];
  if(Array.isArray(messages)&&messages.length){
    for(const m of messages){
      if(m.role==='system')continue;
      conv.push({role:m.role==='user'?'user':'assistant',content:String(m.content||'')});
    }
  }else{
    conv.push({role:'user',content:String(user||'')});
  }
  if(prov==='anthropic'){
    // Anthropic: system as param, messages no system
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-06','content-type':'application/json'},body:JSON.stringify({model:'claude-3-5-sonnet-20241022',max_tokens:4096,system:sys,messages:conv.slice(-20),stream:!!onDelta})});
    return await consumeStream(r,'anthropic',onDelta);
  }
  if(prov==='google'){
    const contents=conv.slice(-20).map(m=>({role:m.role==='user'?'user':'model',parts:[{text:m.content}]}));
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${key}&alt=sse`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents})});
    return await consumeStream(r,'google',onDelta);
  }
  const ep={openai:'https://api.openai.com/v1/chat/completions',deepseek:'https://api.deepseek.com/v1/chat/completions',groq:'https://api.groq.com/openai/v1/chat/completions'}[prov];
  const modelName={'gpt-4o':'gpt-4o','gpt-4o-mini':'gpt-4o-mini','deepseek':'deepseek-coder','groq-llm':'llama-3.1-70b-versatile','enes':'deepseek-coder'}[modelId];
  const msgs=[{role:'system',content:sys},...conv.slice(-20)];
  const r=await fetch(ep,{method:'POST',headers:{'authorization':'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:modelName,messages:msgs,stream:!!onDelta,max_tokens:4096})});
  return await consumeStream(r,'openai',onDelta);
}
async function consumeStream(r,fmt,onDelta){
  if(!r.ok){const t=await r.text();throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`);}
  if(!onDelta){const j=await r.json();return fmt==='anthropic'?j.content[0].text:j.choices[0].message.content;}
  // simplified streaming: collect all text and send deltas on newlines
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='',full='';
  while(true){
    const{done,value}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});let nl;
    while((nl=buf.indexOf('\n'))>=0){
      const line=buf.slice(0,nl).replace(/^data:\s*/,'').trim();buf=buf.slice(nl+1);
      if(!line||line==='[DONE]')continue;
      try{const j=JSON.parse(line);let d='';
        if(fmt==='openai')d=j.choices?.[0]?.delta?.content||'';
        else if(fmt==='anthropic'){if(j.type==='content_block_delta')d=j.delta?.text||'';}
        if(d){onDelta(d);full+=d;}
      }catch(e){}
    }
  }
  return full;
}
function mockReply(text){return smartMockReply(text);}

server.listen(PORT,'127.0.0.1',()=>{
  console.log(`🐯 Enes AI backend v31 running on http://127.0.0.1:${PORT}`);
  console.log(`  Website:  http://127.0.0.1:${PORT}/`);
  console.log(`  Zero dependencies — no 'npm install' needed.`);
});
