// DevAI Backend v29 — ZERO npm dependencies. Uses only Node built-ins.
// No `npm install` needed. Just `node server.js`.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

const PORT = 42069;
const DATA_DIR = path.join(__dirname,'data');
const SITE_DIR = path.join(__dirname,'..','site');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});

function readJSON(f,def){try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,f),'utf8'));}catch(e){return def;}}
function writeJSON(f,o){fs.writeFileSync(path.join(DATA_DIR,f),JSON.stringify(o,null,2));}

const state = {
  pairCode:null, pairExpiry:0, pluginToken:null, pluginConn:null,
  actionQueue:[], actionIdCounter:1, results:{},
  sockets:new Set(),
  keys:readJSON('keys.json',{}),
  history:readJSON('history.json',[]),
};

const MODELS = [
  {id:'auto',name:'Auto',provider:'DevAI',best:'Picks the best model for your task',configured:true},
  {id:'claude-sonnet',name:'Claude Sonnet',provider:'Anthropic',best:'Complex Roblox coding, architecture, debugging'},
  {id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',best:'General coding, Roblox systems, explanations'},
  {id:'gpt-4o-mini',name:'GPT-4o Mini',provider:'OpenAI',best:'Fast responses, small scripts'},
  {id:'gemini-pro',name:'Gemini Pro',provider:'Google',best:'Large context, multimodal, project understanding'},
  {id:'deepseek',name:'DeepSeek Coder',provider:'DeepSeek',best:'Coding & technical reasoning (free key)'},
  {id:'groq-llm',name:'Llama 3.1 70B (Groq)',provider:'Groq',best:'Extremely fast responses (free key)'},
];
function refreshModelConfig(){
  const map={'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llama':'groq'};
  MODELS.forEach(m=>{if(m.id==='auto'){m.configured=true;return;}m.configured=!!state.keys[map[m.id]];});
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

  if(req.url==='/ws'){return handleWS(req,res);}

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
  if(req.url==='/api/health')return sendJSON(res,200,{ok:true,version:29,connected:!!state.pluginConn});
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
function handleWS(req,res){
  const key = req.headers['sec-websocket-key'];
  if(!key){res.writeHead(400);return res.end();}
  const accept = crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  res.writeHead(101,{'Upgrade':'websocket','Connection':'Upgrade','Sec-WebSocket-Accept':accept});
  const sock = res.socket;
  state.sockets.add(sock);
  sock.send=(obj)=>sendWS(sock,obj);
  sendWS(sock,{type:'hello',version:29});
  broadcastConnStatus();
  // Send initial models
  sendWS(sock,{type:'models',models:MODELS});
  sendWS(sock,{type:'history',history:state.history});
  let buf=Buffer.alloc(0);
  sock.on('data',chunk=>{
    buf=Buffer.concat([buf,chunk]);
    try{
      while(buf.length>=2){
        const fin=(buf[0]&0x80)!==0,op=buf[0]&0x0f;
        let len=buf[1]&0x7f,off=2;
        if(len===126){len=buf.readUInt16BE(2);off=4;}else if(len===127){len=Number(buf.readBigUInt64BE(2));off=10;}
        const mask=buf[off]&0x80?true:false;const maskKey=buf.slice(off+1,off+5);
        const hdr=off+(mask?4:0);
        if(buf.length<hdr+len)return;
        let payload=buf.slice(hdr,hdr+len);
        if(mask){for(let i=0;i<len;i++)payload[i]^=maskKey[i%4];}
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
  const messages=msg.messages||[];const userText=messages[messages.length-1].content;
  const modelId=pickModel(userText,msg.model);const model=MODELS.find(m=>m.id===modelId);
  const why=whyModel(modelId,userText);
  sendWS(sock,{type:'ai_meta',model:model.name,why});
  const sys=buildSysPrompt(msg.mode,msg.context);
  let reply='';
  try{
    if(modelId==='mock'||!state.keys[provFor(modelId)])throw new Error('no key');
    reply = await callAI(modelId,sys,userText,delta=>sendWS(sock,{type:'ai_delta',delta}));
  }catch(e){
    reply = mockReply(userText);
    // send mock reply as one delta to keep simple
    sendWS(sock,{type:'ai_delta',delta:reply});
  }
  sendWS(sock,{type:'ai_done'});
}
function provFor(id){return{'claude-sonnet':'anthropic','gpt-4o':'openai','gpt-4o-mini':'openai','gemini-pro':'google','deepseek':'deepseek','groq-llm':'groq'}[id];}
function pickModel(text,req){
  if(req&&req!=='auto')return req;
  const t=text.toLowerCase();
  if(!Object.keys(state.keys).length)return 'mock';
  if(t.includes('error')||t.includes('debug')||t.includes('architecture')){if(state.keys.anthropic)return 'claude-sonnet';if(state.keys.google)return 'gemini-pro';}
  if(t.includes('fast')||t.includes('quick')){if(state.keys.groq)return 'groq-llm';}
  if(t.includes('/create')||t.includes('code')||t.includes('script')){if(state.keys.deepseek)return 'deepseek';if(state.keys.openai)return 'gpt-4o';}
  if(state.keys.openai)return 'gpt-4o-mini';if(state.keys.groq)return 'groq-llm';if(state.keys.deepseek)return 'deepseek';
  return Object.keys(state.keys)[0];
}
function whyModel(id,t){
  const map={'claude-sonnet':'Complex reasoning/debugging','gpt-4o':'General-purpose coding','gpt-4o-mini':'Fast response','gemini-pro':'Large context','deepseek':'Code specialist','groq-llm':'Ultra-low latency','mock':'No API key configured — add one in Settings for real AI'};
  return map[id]||'Auto-selected';
}
function buildSysPrompt(mode,ctx){
  if(mode==='design')return 'You are DevAI Design Mode. Plan Roblox games: concepts, loops, maps, progression. Output structured plans, not full code unless asked.';
  let p=`You are DevAI, an expert Roblox Studio AI writing production Luau.
- Annotate every code block with -- @location Path.To.Parent.ScriptName on the first line.
- Use task.spawn, wrap DataStore in pcall, use WaitForChild with timeout.
- For multi-file systems, first output a BUILD PLAN as a bullet list, then each script as a separate lua code block with @location.
- Be concise. Never fabricate Roblox APIs.`;
  if(ctx)p+='\n\n[PROJECT CONTEXT]\n'+JSON.stringify(ctx).slice(0,5000);
  return p;
}
async function callAI(modelId,sys,user,onDelta){
  const prov=provFor(modelId);const key=state.keys[prov];if(!key)throw new Error('no key');
  if(prov==='anthropic'){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:modelId,max_tokens:4096,messages:[{role:'user',content:sys+'\n\n'+user}],stream:!!onDelta})});
    return await consumeStream(r,'anthropic',onDelta);
  }
  if(prov==='google'){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${key}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sys+'\n\n'+user}]}]})});
    const j=await r.json();return j.candidates?.[0]?.content?.parts?.[0]?.text||'';
  }
  const ep={openai:'https://api.openai.com/v1/chat/completions',deepseek:'https://api.deepseek.com/v1/chat/completions',groq:'https://api.groq.com/openai/v1/chat/completions'}[prov];
  const modelName={'gpt-4o':'gpt-4o','gpt-4o-mini':'gpt-4o-mini','deepseek':'deepseek-coder','groq-llm':'llama-3.1-70b-versatile'}[modelId];
  const r=await fetch(ep,{method:'POST',headers:{'authorization':'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:modelName,messages:[{role:'system',content:sys},{role:'user',content:user}],stream:!!onDelta})});
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
function mockReply(text){
  const topic=text.replace(/^\/(create|scan|fix|explain)\s*/i,'').trim()||'system';
  const name=topic.split(/\s+/).slice(0,2).map(w=>(w[0]||'').toUpperCase()+w.slice(1)).join('').replace(/[^A-Za-z]/g,'')||'Script';
  return `## ⚔ ${name}\n\nAdd an API key in ⚙️ Settings for real AI responses (free DeepSeek/Groq keys work instantly).\n\nHere's a starter **${topic}**:\n\n\`\`\`lua\n-- @location ServerScriptService.${name}Service\nlocal Players = game:GetService(\"Players\")\nPlayers.PlayerAdded:Connect(function(player)\n\tprint(\"Welcome\", player.Name)\nend)\n\`\`\`\n\n\`\`\`lua\n-- @location StarterPlayerScripts.${name}Client\nlocal Players = game:GetService(\"Players\")\nlocal lp = Players.LocalPlayer\nprint(\"Client ready for\", lp.Name)\n\`\`\`\n\nClick 📤 Send to Studio under each block to insert.`;
}

server.listen(PORT,'127.0.0.1',()=>{
  console.log(`⚔ DevAI backend v29 running on http://127.0.0.1:${PORT}`);
  console.log(`  Website:  http://127.0.0.1:${PORT}/`);
  console.log(`  Zero dependencies — no 'npm install' needed.`);
});
