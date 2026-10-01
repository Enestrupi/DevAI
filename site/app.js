// ⚔ DevAI v3.0 — static web app, zero backend required.
// Calls AI providers directly from browser. Uses bridge (127.0.0.1:42069) for Studio sync if running.
const APP_VERSION = '3.0';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  tab: 'chat',
  messages: [],
  streaming: false,
  bridgeOn: false,
  settings: loadSettings(),
  syncCode: null,
};

// ── Settings ──────────────────────────────────────────────────────────────
function loadSettings(){
  try{return Object.assign({
    preset:'openrouter-free',
    openrouter:'',anthropic:'',openai:'',groq:'',meshy:'',
    customUrl:'',customModel:'',customKey:'',
    project:{name:'',currency:'Gold',ui:'Ancient fantasy gold/bronze',admins:'',extra:''},
  },JSON.parse(localStorage.devai_settings||'{}'));}catch(e){return{};}
}
function saveSettings(){
  state.settings.preset=$('#key-preset').value;
  state.settings.openrouter=$('#key-openrouter').value;
  state.settings.anthropic=$('#key-anthropic').value;
  state.settings.openai=$('#key-openai').value;
  state.settings.groq=$('#key-groq').value;
  state.settings.meshy=$('#key-meshy').value;
  state.settings.customUrl=$('#key-custom').value;
  state.settings.customModel=$('#key-custom-model').value;
  state.settings.customKey=$('#key-custom-key').value;
  state.settings.project={
    name:$('#proj-name').value,
    currency:$('#proj-currency').value,
    ui:$('#proj-ui').value,
    admins:$('#proj-admins').value,
    extra:$('#proj-extra').value,
  };
  localStorage.devai_settings=JSON.stringify(state.settings);
  closeModal('settingsModal');toast('⚔ Settings saved','ok');
}
function populateSettings(){
  $('#key-preset').value=state.settings.preset||'openrouter-free';
  $('#key-openrouter').value=state.settings.openrouter||'';
  $('#key-anthropic').value=state.settings.anthropic||'';
  $('#key-openai').value=state.settings.openai||'';
  $('#key-groq').value=state.settings.groq||'';
  $('#key-meshy').value=state.settings.meshy||'';
  $('#key-custom').value=state.settings.customUrl||'';
  $('#key-custom-model').value=state.settings.customModel||'';
  $('#key-custom-key').value=state.settings.customKey||'';
  $('#proj-name').value=state.settings.project?.name||'';
  $('#proj-currency').value=state.settings.project?.currency||'Gold';
  $('#proj-ui').value=state.settings.project?.ui||'Ancient fantasy gold/bronze';
  $('#proj-admins').value=state.settings.project?.admins||'';
  $('#proj-extra').value=state.settings.project?.extra||'';
}

// ── Tabs ──────────────────────────────────────────────────────────────────
$$('.tab').forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
function switchTab(t){
  state.tab=t;
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
  $$('.tab-pane').forEach(x=>x.classList.toggle('active',x.id==='tab-'+t));
}

// ── Bridge / Studio sync polling ──────────────────────────────────────────
async function checkBridge(){
  try{
    const r = await fetch('http://127.0.0.1:42069/status',{cache:'no-store'});
    const j = await r.json();
    state.bridgeOn = !!j.ok;
    setBridge(j.paired);
    // poll web queue (plugin -> website)
    if(j.ok){
      const w = await (await fetch('http://127.0.0.1:42069/poll-web')).json();
      for(const m of (w.messages||[]))handleIncoming(m);
    }
  }catch(e){state.bridgeOn=false;setBridge(false);}
}
function setBridge(on){
  const p=$('#bridgePill');p.classList.toggle('on',on);
  p.querySelector('.dot').style.background=on?'var(--gold)':'var(--red)';
}
async function sendToStudio(msg){
  if(!state.bridgeOn){openModal('syncModal');toast('Start start-devai.bat first','err');return false;}
  try{await fetch('http://127.0.0.1:42069/send-studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(msg)});toast('📜 Sent to Studio','ok');return true;}
  catch(e){toast('Bridge error','err');return false;}
}
function generateCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<6;i++)c+=chars[Math.floor(Math.random()*chars.length)];
  state.syncCode=c;
  $('#syncCode').textContent=c;
  if(navigator.clipboard)navigator.clipboard.writeText(c).catch(()=>{});
}
function handleIncoming(m){
  // Handle messages from plugin (explorer, script, selection, output)
  toast('📥 Studio: '+(m.kind||'message'),'ok');
}

// ── Chat / AI ──────────────────────────────────────────────────────────────
function projectMemory(){
  const p=state.settings.project||{};
  let s='';
  if(p.name)s+=`Game: ${p.name}\n`;
  if(p.currency)s+=`Currency: ${p.currency}\n`;
  if(p.ui)s+=`UI theme: ${p.ui}\n`;
  if(p.admins)s+=`Admins (user names with all permissions): ${p.admins}\n`;
  if(p.extra)s+=`Extra instructions: ${p.extra}\n`;
  return s;
}
const SYSTEM_PROMPT = `You are DevAI, an expert Roblox Studio AI assistant in an ancient-fantasy gold/bronze themed kingdom-builder tool.

RULES:
1. When producing Luau code:
   - Start the VERY FIRST line of every lua block with a comment: -- @location Path.To.Parent.ScriptName
     (e.g. -- @location ServerScriptService.CoinService, -- @location StarterPlayerScripts.Combat, -- @location ReplicatedStorage.Modules.Inventory)
   - Server Scripts belong in ServerScriptService or ServerStorage. LocalScripts in StarterPlayerScripts / StarterGui. Modules in ReplicatedStorage.Modules.
   - Use modern Luau: task.spawn/task.wait, pcall for DataStore/HttpService, WaitForChild with timeout.
   - For multi-file systems: start with a BULLETED BUILD PLAN (list each script, its location, what it does), then output EACH script as its OWN SEPARATE lua code block.
   - Use CollectionService for tagged entities, TweenService for polish, RemoteEvent/RemoteFunction for client<->server. Never trust client input.
   - Write COMPLETE runnable code — no "TODO" or "your code here" placeholders.
2. Be friendly but concise. Speak like a seasoned castle smith — warm, craft-focused.
3. If the user asks to explain something, do so clearly with short examples.
4. Never fabricate Roblox APIs.
5. Use the project memory below to tailor responses to the user's game.`;

async function chatStream(userMsg){
  if(state.streaming)return;
  state.streaming=true;
  addMsg('user',userMsg);
  $('#chat-send').disabled=true;
  const mem=projectMemory();
  const sys=SYSTEM_PROMPT+'\n\n[PROJECT MEMORY]\n'+mem;
  const msgs=[{role:'system',content:sys},...state.messages.map(m=>({role:m.role,content:m.text}))];
  const bubble=startAiMsg();
  let full='';
  try{
    const cfg = await pickProvider();
    if(!cfg){
      // Smart fallback templates (work even without any keys)
      full = fallbackReply(userMsg);
      appendDelta(bubble,full);
    }else{
      full = await callAI(cfg,msgs,d=>appendDelta(bubble,d));
    }
  }catch(e){
    appendDelta(bubble,'\n\n❌ Error: '+e.message+'\n\nCheck your API keys in ⚙ Settings, or use OpenRouter Free preset (no key needed but limited).');
  }
  state.messages.push({role:'assistant',text:full});
  finishAiMsg(bubble,full);
  state.streaming=false;$('#chat-send').disabled=false;
}

async function pickProvider(){
  const p=state.settings.preset||'openrouter-free';
  const keys=state.settings;
  if(p==='claude' && keys.anthropic)return{provider:'anthropic',key:keys.anthropic,model:'claude-3-5-sonnet-20241022'};
  if(p==='gpt4o' && keys.openai)return{provider:'openai',key:keys.openai,model:'gpt-4o',endpoint:'https://api.openai.com/v1/chat/completions'};
  if(p==='gpt4o-mini' && keys.openai)return{provider:'openai',key:keys.openai,model:'gpt-4o-mini',endpoint:'https://api.openai.com/v1/chat/completions'};
  if(p==='groq' && keys.groq)return{provider:'openai',key:keys.groq,model:'llama-3.1-70b-versatile',endpoint:'https://api.groq.com/openai/v1/chat/completions'};
  if(p==='custom' && keys.customUrl && keys.customKey)return{provider:'openai',key:keys.customKey,model:keys.customModel||'gpt-4o-mini',endpoint:keys.customUrl};
  if(p==='ollama')return{provider:'ollama',model:'llama3',endpoint:'http://localhost:11434/api/chat'};
  if(keys.openrouter)return{provider:'openai',key:keys.openrouter,model:'meta-llama/llama-3.1-8b-instruct:free',endpoint:'https://openrouter.ai/api/v1/chat/completions'};
  // Try groq as default free-ish option if set
  if(keys.groq)return{provider:'openai',key:keys.groq,model:'llama-3.1-70b-versatile',endpoint:'https://api.groq.com/openai/v1/chat/completions'};
  return null;
}

async function callAI(cfg,messages,onDelta){
  let r;
  if(cfg.provider==='anthropic'){
    const sysMsg=messages.find(m=>m.role==='system');const rest=messages.filter(m=>m.role!=='system');
    r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':cfg.key,'anthropic-version':'2023-06-06','content-type':'application/json'},body:JSON.stringify({model:cfg.model,max_tokens:4096,system:sysMsg?.content||'',messages:rest.slice(-20),stream:true})});
    return streamResponse(r,'anthropic',onDelta);
  }
  if(cfg.provider==='ollama'){
    r=await fetch(cfg.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:cfg.model,messages:messages.slice(-20),stream:true})});
    return streamResponse(r,'ollama',onDelta);
  }
  // openai-compatible
  r=await fetch(cfg.endpoint,{method:'POST',headers:{'authorization':'Bearer '+cfg.key,'content-type':'application/json','http-referer':location.origin},body:JSON.stringify({model:cfg.model,messages:messages.slice(-20),stream:true,max_tokens:4096})});
  return streamResponse(r,'openai',onDelta);
}

async function streamResponse(r,fmt,onDelta){
  if(!r.ok){const t=await r.text();throw new Error('API error '+r.status+': '+t.slice(0,300));}
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='',full='';
  while(true){
    const{done,value}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});
    let nl;
    while((nl=buf.indexOf('\n'))>=0){
      let line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);
      if(fmt==='ollama'){
        // Ollama: JSON lines, no "data:" prefix
        if(!line)continue;
        try{const j=JSON.parse(line);if(j.message?.content){onDelta(j.message.content);full+=j.message.content;}}catch(e){}
      }else{
        line=line.replace(/^data:\s*/,'').trim();if(!line||line==='[DONE]')continue;
        try{const j=JSON.parse(line);let d='';
          if(fmt==='openai')d=j.choices?.[0]?.delta?.content||'';
          else if(fmt==='anthropic'){if(j.type==='content_block_delta')d=j.delta?.text||'';}
          if(d){onDelta(d);full+=d;}
        }catch(e){}
      }
    }
  }
  return full;
}

// ── Smart fallback templates (work without any key) ────────────────────────
function fallbackReply(text){
  const t=(text||'').toLowerCase();
  const slug=(text||'').replace(/^\/(create|make|build|code)\s*/i,'').trim()||'system';
  const name=slug.split(/\s+/).slice(0,2).map(w=>(w[0]||'').toUpperCase()+w.slice(1).toLowerCase()).join('').replace(/[^A-Za-z]/g,'')||'System';
  if(/coin|gold|currency|cash/.test(t))return coinTpl();
  if(/sword|weapon|combat|sword/.test(t))return swordTpl();
  if(/pet|follow|companion/.test(t))return petTpl();
  if(/round|arena|battle|match/.test(t))return roundTpl();
  if(/admin|command|ban|kick/.test(t))return adminTpl();
  if(/tycoon|dropper/.test(t))return tycoonTpl();
  return genericTpl(name,slug);
}
function planHeader(steps){return `### BUILD PLAN\n${steps.map(s=>'- '+s).join('\n')}\n\n`;}
function coinTpl(){return planHeader([
  "ServerScriptService.CoinService — leaderstats + touch detection",
  "StarterPlayerScripts.CoinVisuals — spin/bob animation for Coin-tagged parts",
])+`
\`\`\`lua
-- @location ServerScriptService.CoinService
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

Players.PlayerAdded:Connect(function(p)
    local ls = Instance.new("Folder"); ls.Name = "leaderstats"
    local g = Instance.new("IntValue"); g.Name = "Gold"; g.Value = 0; g.Parent = ls
    ls.Parent = p
end)

local function setup(coin)
    local part = coin:IsA("BasePart") and coin or coin:FindFirstChildWhichIsA("BasePart")
    if not part or part:GetAttribute("CoinBound") then return end
    part:SetAttribute("CoinBound", true)
    local db = false
    part.Touched:Connect(function(hit)
        if db then return end
        local pl = Players:GetPlayerFromCharacter(hit.Parent)
        if not pl then return end
        db = true
        local ls = pl:FindFirstChild("leaderstats")
        if ls and ls:FindFirstChild("Gold") then ls.Gold.Value += 1 end
        coin:Destroy()
    end)
end

for _, c in ipairs(CollectionService:GetTagged("Coin")) do task.spawn(setup, c) end
CollectionService:GetInstanceAddedSignal("Coin"):Connect(setup)
\`\`\`

\`\`\`lua
-- @location StarterPlayerScripts.CoinVisuals
local CS = game:GetService("CollectionService")
local TS = game:GetService("TweenService")

local function spin(c)
    local p = c:IsA("BasePart") and c or c:FindFirstChildWhichIsA("BasePart")
    if not p then return end
    p.Anchored = true; p.CanCollide = false
    p.Material = Enum.Material.Neon; p.Color = Color3.new(1, 0.85, 0)
    TS:Create(p, TweenInfo.new(2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {Position = p.Position + Vector3.new(0, 0.6, 0)}):Play()
end

for _, c in CS:GetTagged("Coin") do spin(c) end
CS:GetInstanceAddedSignal("Coin"):Connect(spin)
\`\`\`

Use the Tag Editor (View → Tag Editor) to create a **Coin** tag and apply it to any Part you want to be a collectible coin.`;
}
function swordTpl(){return planHeader(["StarterPack.Sword — Tool with damage, cooldown, knockback, creator tag"])+`
\`\`\`lua
-- @location StarterPack.Sword.SwordScript
local Tool = script.Parent; local Handle = Tool:WaitForChild("Handle")
local DAMAGE = 30; local CD = 0.5; local active = false

Tool.Activated:Connect(function()
    if not active then return end
    active = false
    local char = Tool.Parent; local hum = char:FindFirstChildOfClass("Humanoid")
    if not hum then return end
    local hits = {}
    for _, p in ipairs(Handle:GetTouchingParts()) do
        local h = p.Parent:FindFirstChildOfClass("Humanoid")
        if h and p.Parent ~= char and not hits[h] then
            hits[h] = true
            local tag = h:FindFirstChild("creator") or Instance.new("ObjectValue")
            tag.Name = "creator"; tag.Value = char; tag.Parent = h
            h:TakeDamage(DAMAGE)
            local myRoot = char:FindFirstChild("HumanoidRootPart"); local root = p.Parent:FindFirstChild("HumanoidRootPart")
            if myRoot and root then root.Velocity = (root.Position - myRoot.Position).Unit * 45 + Vector3.new(0, 25, 0) end
            task.delay(1, function() if tag and tag.Parent then tag:Destroy() end end)
        end
    end
    task.wait(CD); active = true
end)
Tool.Equipped:Connect(function() active = true end)
Tool.Unequipped:Connect(function() active = false end)
\`\`\`

Insert a Tool named **Sword** in StarterPack (RequiresHandle=true), add a Part named **Handle** (Shape=Block, Size=1,1,4), and place this Script inside the Tool.`;
}
function petTpl(){return `
\`\`\`lua
-- @location StarterCharacterScripts.PetFollower
local RS = game:GetService("RunService")
local char = script.Parent; local hrp = char:WaitForChild("HumanoidRootPart")
local pet = char:FindFirstChild("Pet")
if not pet then
    local b = Instance.new("Part"); b.Name = "Pet"; b.Size = Vector3.new(2,2,2); b.Shape = Enum.PartType.Ball
    b.Color = Color3.fromRGB(235, 191, 91); b.Material = Enum.Material.Neon; b.Anchored = true; b.CanCollide = false
    b.Parent = char; pet = b
end
local offset = CFrame.new(-3, 2.5, 0); local bob = 0
RS.RenderStepped:Connect(function(dt)
    bob += dt * 4
    local target = hrp.CFrame:ToWorldSpace(offset) * CFrame.new(0, math.sin(bob) * 0.3, 0)
    pet.CFrame = pet.CFrame:Lerp(target, math.min(1, dt * 8))
end)
\`\`\``;
}
function roundTpl(){return planHeader(["ServerScriptService.RoundManager — intermission, teleport, fight loop, winner"])+`
\`\`\`lua
-- @location ServerScriptService.RoundManager
local Players = game:GetService("Players"); local RS = game:GetService("ReplicatedStorage")
local Status = Instance.new("StringValue"); Status.Name = "Status"; Status.Parent = RS
local INT = 10; local ROUND = 90; local MIN = 2
local lobby = workspace:FindFirstChild("Lobby", true); local arena = workspace:FindFirstChild("Arena", true)

while true do
    while #Players:GetPlayers() < MIN do Status.Value = "Need " .. (MIN - #Players:GetPlayers()) .. " more..."; task.wait(1) end
    for i = INT, 1, -1 do Status.Value = "Intermission: " .. i; task.wait(1) end
    local alive = {}
    for _, p in Players:GetPlayers() do
        if p.Character and p.Character:FindFirstChild("HumanoidRootPart") and arena then
            p.Character:PivotTo(arena.CFrame + Vector3.new(math.random(-10,10), 3, math.random(-10,10)))
            table.insert(alive, p)
        end
    end
    for i = ROUND, 1, -1 do
        alive = {}
        for _, p in Players:GetPlayers() do if p.Character and p.Character:FindFirstChildOfClass("Humanoid") and p.Character.Humanoid.Health > 0 then table.insert(alive, p) end end
        if #alive <= 1 then break end
        Status.Value = "⚔ FIGHT! " .. i .. "s — " .. #alive .. " left"; task.wait(1)
    end
    local w = alive[1]; Status.Value = w and (w.DisplayName .. " wins!") or "Draw!"; task.wait(5)
    for _, p in Players:GetPlayers() do
        if p.Character and lobby then p.Character:PivotTo(lobby.CFrame + Vector3.new(math.random(-5,5), 3, math.random(-5,5)))
            local h = p.Character:FindFirstChildOfClass("Humanoid"); if h then h.Health = h.MaxHealth end end
    end
end
\`\`\`

Place SpawnLocations named **Lobby** and **Arena** in Workspace.`;
}
function adminTpl(){return `
\`\`\`lua
-- @location ServerScriptService.AdminCommands
local Players = game:GetService("Players")
local ADMINS = {["YourUsername"] = true} -- replace with your Roblox name

local function findP(q)
    q = q:lower()
    for _, p in Players:GetPlayers() do if p.Name:lower():sub(1, #q) == q then return p end end
end

Players.PlayerAdded:Connect(function(p)
    p.Chatted:Connect(function(msg)
        if not ADMINS[p.Name] then return end
        local cmd, arg = msg:match("^/(%w+)%s*(.*)"); if not cmd then return end
        local t = findP(arg)
        if cmd == "kill" and t and t.Character then t.Character:FindFirstChildOfClass("Humanoid").Health = 0
        elseif cmd == "respawn" and t then t:LoadCharacter()
        elseif cmd == "bring" and t and t.Character and p.Character then t.Character:PivotTo(p.Character:GetPivot() * CFrame.new(0,0,5))
        elseif cmd == "kick" and t then t:Kick("Kicked by admin")
        elseif cmd == "speed" then local n = tonumber(arg) or 50; if p.Character then p.Character:FindFirstChildOfClass("Humanoid").WalkSpeed = n end
        elseif cmd == "ff" then t = t or p; if t and t.Character then local f = Instance.new("ForceField"); f.Parent = t.Character; task.delay(30, function() if f then f:Destroy() end end) end
        end
    end)
end)
\`\`\`

Commands: \`/kill Name\`, \`/respawn Name\`, \`/bring Name\`, \`/kick Name\`, \`/speed 50\`, \`/ff Name\`.`;
}
function tycoonTpl(){return `
\`\`\`lua
-- @location ServerScriptService.TycoonDropper
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(p)
    local ls = Instance.new("Folder"); ls.Name = "leaderstats"
    local c = Instance.new("IntValue"); c.Name = "Cash"; c.Value = 100; c.Parent = ls; ls.Parent = p
end)
local dropper = workspace:WaitForChild("Dropper"); local spawn = dropper:WaitForChild("Spawn"); local collector = workspace:WaitForChild("Collector")
while task.wait(1) do
    local p = Instance.new("Part"); p.Size = Vector3.new(1,1,1); p.Material = Enum.Material.Metal
    p.Color = Color3.fromHSV(math.random(), 0.7, 0.9); p.CFrame = spawn.CFrame; p.Parent = workspace
    local done = false
    p.Touched:Connect(function(h)
        if done then return end
        if h:IsDescendantOf(collector) then
            done = true
            local near, d = nil, 50
            for _, pl in Players:GetPlayers() do
                if pl.Character and pl.Character:FindFirstChild("HumanoidRootPart") then
                    local dd = (pl.Character.HumanoidRootPart.Position - p.Position).Magnitude
                    if dd < d then d = dd; near = pl end
                end
            end
            if near then near.leaderstats.Cash.Value += 5 end
            p:Destroy()
        end
    end)
    task.delay(20, function() if p then p:Destroy() end end)
end
\`\`\`

Create Parts named **Dropper** (high up), **Spawn** (child of Dropper), and **Collector** (ground below).`;
}
function genericTpl(name,slug){return `### Starter System for "${slug}"

\`\`\`lua
-- @location ServerScriptService.${name}
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local remote = RS:FindFirstChild("${name}") or Instance.new("RemoteEvent")
remote.Name = "${name}"; remote.Parent = RS

remote.OnServerEvent:Connect(function(pl, action, ...)
    if type(action) ~= "string" then return end
    print("[${name}]", pl.Name, action, ...)
end)
\`\`\`

\`\`\`lua
-- @location StarterPlayerScripts.${name}Client
local RS = game:GetService("ReplicatedStorage"); local Players = game:GetService("Players")
local remote = RS:WaitForChild("${name}"); local lp = Players.LocalPlayer
print("${name} ready", lp.Name)
\`\`\`

Add a free API key in ⚙ Settings (OpenRouter free tier works) for unlimited AI that writes ANY custom system.`;
}

// ── UI: messages / chat ───────────────────────────────────────────────────
function addMsg(role,text){
  state.messages.push({role,text});
  const c=$('#chat-messages');
  const b=document.createElement('div');b.className='bubble '+role;
  if(role==='user'){b.textContent=text;}
  else{b.innerHTML=renderMarkdown(text);decorateCodes(b);}
  c.appendChild(b);c.scrollTop=c.scrollHeight;
}
function startAiMsg(){
  const c=$('#chat-messages');
  const b=document.createElement('div');b.className='bubble ai';
  b.innerHTML=`<div class="ai-header"><div class="ava">⚔</div><div class="meta">DevAI</div><div class="thinking">Forging...</div></div><div class="ai-body"></div>`;
  c.appendChild(b);c.scrollTop=c.scrollHeight;
  return b;
}
function appendDelta(bubble,delta){
  const body=bubble.querySelector('.ai-body');
  body._full=(body._full||'')+delta;
  body.innerHTML=renderMarkdown(body._full);
  decorateCodes(body);
  $('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
}
function finishAiMsg(bubble,full){
  bubble.querySelector('.thinking').remove();
  decorateCodes(bubble);
}
function renderMarkdown(text){
  // Escape HTML
  let t=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Code blocks
  t=t.replace(/```(\w*)\n([\s\S]*?)```/g,(_,lang,code)=>{
    const loc = code.split('\n')[0].match(/^--\s*@location\s+(\S+)/);
    const locTag = loc ? `<div class="code-toolbar"><span class="loc">${loc[1]}</span><span class="code-actions"><button class="code-act copy">📋 Copy</button><button class="code-act send" data-code="${encodeURIComponent(code)}" data-loc="${loc?loc[1]:''}" data-lang="${lang}">📤 Send to Studio</button></span></div>` : `<div class="code-toolbar"><span class="loc">${lang||'code'}</span><span class="code-actions"><button class="code-act copy">📋 Copy</button></span></div>`;
    const clean = loc ? code.split('\n').slice(1).join('\n') : code;
    return locTag + `<pre><code class="lang-${lang}">${clean.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</code></pre>`;
  });
  // Inline code
  t=t.replace(/`([^`]+)`/g,'<code class="inline">$1</code>');
  // Headers, bold, lists
  t=t.replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  // Lists
  t=t.replace(/^- (.+)$/gm,'<li>$1</li>');
  t=t.replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>');
  t=t.replace(/<\/ul>\s*<ul>/g,'');
  // Paragraphs
  t=t.split(/\n\n+/).map(p=>{
    if(p.startsWith('<h')||p.startsWith('<pre')||p.startsWith('<ul')||p.startsWith('<div')||p.startsWith('<ol'))return p;
    return `<p>${p.replace(/\n/g,'<br>')}</p>`;
  }).join('\n');
  return t;
}
function decorateCodes(root){
  if(!root)return;
  root.querySelectorAll('.code-act.copy').forEach(btn=>{btn.onclick=()=>{
    const code=btn.closest('.code-toolbar').nextElementSibling?.querySelector('code')?.innerText||'';
    navigator.clipboard&&navigator.clipboard.writeText(code);toast('📋 Copied','ok');
  };});
  root.querySelectorAll('.code-act.send').forEach(btn=>{btn.onclick=()=>{
    const code=decodeURIComponent(btn.dataset.code||'');
    const loc=btn.dataset.loc||'ServerScriptService.Script';
    const parts=loc.split('.');
    const name=parts.pop();
    const parent=parts.join('.');
    const firstLine=code.split('\n')[0];
    let type='Script';
    if(parent.includes('StarterPlayer')||parent.includes('StarterGui')||parent.includes('StarterPack'))type='LocalScript';
    if(name.startsWith('Module')||code.includes('return {}')||code.includes('return function'))type='ModuleScript';
    sendToStudio({title:name,type:type,target:parent,code:code});
  };});
}

// ── 3D Models (Meshy) ─────────────────────────────────────────────────────
async function gen3D(){
  const prompt=$('#m3d-prompt').value.trim();if(!prompt)return toast('Enter a prompt','err');
  const key=state.settings.meshy;
  const results=$('#m3d-results');results.innerHTML='<p class="muted">Forging your model... this takes 30-90 seconds.</p>';
  try{
    let id;
    if(!key){
      // Placeholder: show a message that Meshy key is needed
      results.innerHTML=`<div class="result-card"><p class="muted">Add a <b>Meshy API key</b> in ⚙ Settings to generate 3D models (200 free credits/month at <a href="https://www.meshy.ai/settings/api" target="_blank">meshy.ai</a>).</p></div>`;
      return;
    }
    // Step 1: create preview task
    const r=await fetch('https://api.meshy.ai/v2/text-to-3d',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({mode:'preview',prompt:prompt,negative_prompt:'low quality, blurry, distorted',art_style:'realistic'})});
    const j=await r.json();id=j.result;
    if(!id)throw new Error(j.message||'failed to create task');
    // Poll
    for(let i=0;i<120;i++){
      await new Promise(r=>setTimeout(r,2000));
      const s=await(await fetch('https://api.meshy.ai/v2/text-to-3d/'+id,{headers:{'Authorization':'Bearer '+key}})).json();
      results.innerHTML=`<div class="result-card"><p class="muted">Status: ${s.status} (${Math.round(s.progress||0)}%)</p></div>`;
      if(s.status==='SUCCEEDED'||s.status==='FAILED'){
        if(s.status==='FAILED')throw new Error('Meshy failed');
        results.innerHTML=render3D(prompt,s);
        break;
      }
    }
  }catch(e){results.innerHTML=`<div class="result-card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;}
}
function render3D(prompt,s){
  return `<div class="result-card">
    <h5>${prompt}</h5>
    <model-viewer src="${s.model_urls.glb}" alt="${prompt}" auto-rotate camera-controls shadow-intensity="1" exposure="1"></model-viewer>
    <div class="row" style="margin-top:10px">
      <a class="btn-ghost" href="${s.model_urls.glb}" target="_blank" download style="text-decoration:none">⬇ Download GLB</a>
      ${s.model_urls.fbx?`<a class="btn-ghost" href="${s.model_urls.fbx}" target="_blank" download style="text-decoration:none">⬇ FBX</a>`:''}
      <button class="btn-ghost copy-url" data-url="${s.model_urls.glb}">📋 Copy URL to clipboard</button>
    </div>
    <p class="tiny">Download, then in Studio right-click Workspace → Insert from File. Or paste the URL via the Insert → MeshPart dialog (Roblox supports GLB/FBX import).</p>
  </div>`;
}

// ── Thumbnails (Pollinations — free, no key) ──────────────────────────────
function genThumb(){
  const p=$('#thumb-prompt').value.trim();if(!p)return;
  const seed=$('#thumb-seed').value||Math.floor(Math.random()*99999);
  const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(p+' ancient fantasy gold bronze medieval game icon, detailed')}?width=512&height=512&seed=${seed}&nologo=true`;
  const grid=$('#thumb-results');
  const card=document.createElement('div');card.innerHTML=`<img src="${url}" alt="${p}" loading="lazy"><p class="tiny" style="margin-top:4px">Right-click → Save image as...<br><button class="code-act copy-url" data-url="${url}" style="margin-top:4px">📋 Copy URL</button></p>`;
  grid.prepend(card);
  card.querySelector('.copy-url').onclick=()=>{navigator.clipboard.writeText(url);toast('URL copied','ok');};
}

// ── Targeted Code ─────────────────────────────────────────────────────────
async function genCode(){
  const type=$('#code-type').value;const parent=$('#code-parent').value.trim()||'ServerScriptService';const desc=$('#code-desc').value.trim();
  if(!desc)return toast('Describe what the script should do','err');
  // Use AI for code gen
  addMsg('user',`Write a ${type} at ${parent}.${type==='ModuleScript'?'.Name':''} that does: ${desc}. Make it complete, production-quality Luau.`);
  switchTab('chat');
  await chatStream(`Write a ${type} at ${parent} that does: ${desc}. Make it complete production-quality Luau. Follow the @location rule.`);
}

// ── GUI generator ─────────────────────────────────────────────────────────
async function genGui(){
  const desc=$('#gui-desc').value.trim();if(!desc)return;
  switchTab('chat');
  await chatStream(`Create a Roblox GUI LocalScript at StarterGui.${desc.replace(/\s/g,'').slice(0,20)||'CustomGui'} that builds a ${desc}. Use the DevAI ancient-fantasy gold/bronze theme: dark brown/black background (#14100c), gold text (#ebbf5b), bronze borders (#5a4424), serif font (Font.Ubuntu or SourceSans). Create all Instances with Instance.new(), build the UI programmatically. Add hover effects on buttons.`);
}

// ── Animation controller ──────────────────────────────────────────────────
function genAnim(){
  const path=$('#anim-path').value||'StarterPlayerScripts.AnimationController';
  const walk=$('#anim-walk').value;const idle=$('#anim-idle').value;const run=$('#anim-run').value;
  const name=path.split('.').pop();
  const code=`-- @location ${path}
local char = script.Parent
local hum = char:WaitForChild("Humanoid")
local function load(id) local a = Instance.new("Animation"); a.AnimationId = id; return hum.Animator:LoadAnimation(a) end
local idleAnim = idle and load("${idle||''}")
local walkAnim = walk and load("${walk||''}")
local runAnim = run and load("${run||''}")
hum.Running:Connect(function(speed)
    if idleAnim then idleAnim:Stop() end; if walkAnim then walkAnim:Stop() end; if runAnim then runAnim:Stop() end
    if speed < 0.1 then if idleAnim then idleAnim:Play() end
    elseif speed < 16 then if walkAnim then walkAnim:Play() end
    else if runAnim then runAnim:Play() end end
end)
`;
  const res=$('#anim-results');res.innerHTML=`<div class="code-toolbar"><span class="loc">${path}</span><span class="code-actions"><button class="code-act copy">📋 Copy</button><button class="code-act send" data-code="${encodeURIComponent(code)}" data-loc="${path}" data-lang="lua">📤 Send to Studio</button></span></div><pre><code>${code.replace(/</g,'&lt;')}</code></pre>`;
  decorateCodes(res);
  toast('Animation controller generated','ok');
}

// ── Modal helpers ─────────────────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');if(id==='settingsModal')populateSettings();}
function closeModal(id){document.getElementById(id).classList.remove('open');}
window.closeModal=closeModal;

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg,kind){const t=$('#toast');t.textContent=msg;t.className='toast show '+(kind||'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3000);}

// ── Event wiring ──────────────────────────────────────────────────────────
$('#chat-send').onclick=()=>{const v=$('#chat-input').value.trim();if(v){$('#chat-input').value='';chatStream(v);}};
$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-send').click();}});
$$('.quick').forEach(q=>q.onclick=()=>chatStream(q.dataset.prompt));
$('#settingsBtn').onclick=()=>openModal('settingsModal');
$('#saveSettings').onclick=saveSettings;
$('#syncBtn').onclick=()=>{openModal('syncModal');generateCode();};
$('#syncGen').onclick=generateCode;
$('#m3d-gen').onclick=gen3D;
$('#thumb-gen').onclick=genThumb;
$('#code-gen').onclick=genCode;
$('#gui-gen').onclick=genGui;
$('#anim-gen').onclick=genAnim;
document.addEventListener('click',e=>{if(e.target.classList.contains('copy-url')){navigator.clipboard.writeText(e.target.dataset.url);toast('URL copied','ok');}});
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));

// Init
populateSettings();
checkBridge();setInterval(checkBridge,2000);
// Welcome message
$('#chat-messages').innerHTML=`<div class="bubble ai"><div class="ai-header"><div class="ava">⚔</div><div class="meta">DevAI</div></div><div class="ai-body">
<p>Welcome, builder. 🏰 I am DevAI, your Roblox co-forge. I can write Luau, design systems, generate 3D models, craft thumbnails, build GUIs, and send finished scripts straight into Roblox Studio.</p>
<p style="margin-top:8px;color:var(--muted);font-style:italic">Click a quick-start below, or speak your command. To connect Studio: start <code class="inline">start-devai.bat</code>, then click 🔗 to pair.</p>
</div></div>`;

// If ?connected=local, show toast
if(new URLSearchParams(location.search).get('connected')==='local'){setTimeout(()=>toast('Bridge connected','ok'),500);}
