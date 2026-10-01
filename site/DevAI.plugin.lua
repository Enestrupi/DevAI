-- =============================================================================
-- ⚔ DevAI v1.2 — Roblox Studio Plugin (ancient-fantasy gold theme)
-- Talks directly to AI providers via HttpService. Uses local bridge at
-- http://127.0.0.1:42069 for Send-to-Studio queuing (website → plugin).
-- Keys stored in plugin:SetSetting — never leave your machine.
-- =============================================================================
local HttpService       = game:GetService("HttpService")
local Selection         = game:GetService("Selection")
local StudioService     = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local LogService        = game:GetService("LogService")
local Players           = game:GetService("Players")
local InsertService     = game:GetService("InsertService")

local BRIDGE = "http://127.0.0.1:42069"
local POLL = 1.0
local HTTP_ENABLED = pcall(function() HttpService:GetAsync(BRIDGE.."/status") end)

-- Ancient-fantasy palette
local C = {
    bg        = Color3.fromHex("#0d0a08"),
    panel     = Color3.fromHex("#1a1410"),
    panel2    = Color3.fromHex("#241b13"),
    border    = Color3.fromHex("#3a2d1d"),
    border2   = Color3.fromHex("#5a4424"),
    gold      = Color3.fromHex("#ebbf5b"),
    goldDim   = Color3.fromHex("#c99a3e"),
    bronze    = Color3.fromHex("#8b6914"),
    red       = Color3.fromHex("#c2513a"),
    green     = Color3.fromHex("#6b9a4e"),
    amber     = Color3.fromHex("#d4a046"),
    text      = Color3.fromHex("#eadfc5"),
    muted     = Color3.fromHex("#a69470"),
    dim       = Color3.fromHex("#6b5d42"),
}

local function mk(parent, class, props)
    local e = Instance.new(class)
    for k,v in pairs(props or {}) do e[k]=v end
    e.Parent = parent
    return e
end

local toolbar = plugin:CreateToolbar("DevAI")
local tbtn = toolbar:CreateButton("DevAI","⚔ DevAI v1.2 — Ancient-fantasy Roblox AI","rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float,true,false,480,620,400,520)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_v12",widgetInfo)
gui.Title = "⚔ DevAI"
tbtn.Click:Connect(function() gui.Enabled = not gui.Enabled end)

local Root = mk(gui,"Frame",{BackgroundColor3=C.bg,Size=UDim2.fromScale(1,1)})
mk(Root,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,8),PaddingRight=UDim.new(0,8)})

-- Header
local header = mk(Root,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,0,38),Position=UDim2.new(0,0,0,0)})
mk(header,"TextLabel",{BackgroundTransparency=1,Text="⚔",TextColor3=C.gold,Font=Enum.Font.GothamBlack,TextSize=24,Size=UDim2.new(0,34,1,0),TextXAlignment=Enum.TextXAlignment.Left})
mk(header,"TextLabel",{BackgroundTransparency=1,Text="DevAI",TextColor3=C.gold,Font=Enum.Font.GothamBlack,TextSize=18,Size=UDim2.new(1,-80,0,22),Position=UDim2.new(0,34,0,0),TextXAlignment=Enum.TextXAlignment.Left,FontFace=Font.fromEnum(Enum.Font.Fantasy)})
local statusLbl = mk(header,"TextLabel",{BackgroundTransparency=1,Text="● Bridge: checking...",TextColor3=C.amber,Font=Enum.Font.GothamBold,TextSize=9,Size=UDim2.new(1,-80,0,14),Position=UDim2.new(0,34,0,22),TextXAlignment=Enum.TextXAlignment.Left})

-- Tab bar
local tabBar = mk(Root,"Frame",{BackgroundColor3=C.panel,BorderColor3=C.border,BorderSizePixel=1,Size=UDim2.new(1,0,0,28),Position=UDim2.new(0,0,0,42)})
mk(tabBar,"UICorner",{CornerRadius=UDim.new(0,6)})
local TABS = {"Chat","3D","Thumbs","Code","GUI","Anim","Debug"}
local TAB_LABELS = {"💬 Chat","🧊 3D","🖼 Thumbs","📜 Code","🎨 GUI","💃 Anim","🔧 Debug"}
local tabBtns = {}
local contentFrame
local activeTab = "Chat"

local function switchTab(name)
    activeTab=name
    for i,t in ipairs(TABS)do tabBtns[t].BackgroundColor3 = t==name and C.panel2 or C.panel; tabBtns[t].TextColor3 = t==name and C.gold or C.muted end
    for _,c in ipairs(contentFrame:GetChildren())do if c:IsA("Frame")then c.Visible = c.Name==name end end
end

for i,t in ipairs(TABS)do
    local b = mk(tabBar,"TextButton",{BackgroundColor3=C.panel,Text=TAB_LABELS[i],TextColor3=C.muted,Font=Enum.Font.GothamBold,TextSize=9,Size=UDim2.new(1/#TABS,-2,1,-4),Position=UDim2.new((i-1)/#TABS,1,0,2),BorderSizePixel=0,AutoButtonColor=false})
    mk(b,"UICorner",{CornerRadius=UDim.new(0,4)})
    b.MouseButton1Click:Connect(function()switchTab(t)end)
    tabBtns[t]=b
end

-- Content area
contentFrame = mk(Root,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,1,-74),Position=UDim2.new(0,0,0,74)})

local function makeTab(name)
    local f = mk(contentFrame,"ScrollingFrame",{Name=name,BackgroundColor3=C.bg,Size=UDim2.fromScale(1,1),BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=4,ScrollBarImageColor3=C.dim})
    mk(f,"UIListLayout",{Padding=UDim.new(0,8),SortOrder=Enum.SortOrder.LayoutOrder})
    mk(f,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,4),PaddingRight=UDim.new(0,4)})
    f.Visible = name=="Chat"
    return f
end
local tabChat = makeTab("Chat")
local tab3D = makeTab("3D")
local tabThumbs = makeTab("Thumbs")
local tabCode = makeTab("Code")
local tabGUI = makeTab("GUI")
local tabAnim = makeTab("Anim")
local tabDebug = makeTab("Debug")

-- Reusable UI helpers
local function section(parent,title)
    local f = mk(parent,"Frame",{BackgroundColor3=C.panel,Size=UDim2.new(1,-8,0,0),AutomaticSize=Enum.AutomaticSize.Y,BorderSizePixel=0,Position=UDim2.new(0,4,0,0)})
    mk(f,"UICorner",{CornerRadius=UDim.new(0,8)});mk(f,"UIStroke",{Color=C.border,Thickness=1})
    mk(f,"UIPadding",{PaddingTop=UDim.new(0,10),PaddingBottom=UDim.new(0,10),PaddingLeft=UDim.new(0,12),PaddingRight=UDim.new(0,12)})
    mk(f,"UIListLayout",{Padding=UDim.new(0,6)})
    if title then mk(f,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.gold,Font=Enum.Font.GothamBlack,TextSize=13,Size=UDim2.new(1,0,0,20),TextXAlignment=Enum.TextXAlignment.Left,FontFace=Font.fromEnum(Enum.Font.Fantasy)}) end
    return f
end
local function lbl(parent,txt,size)mk(parent,"TextLabel",{BackgroundTransparency=1,Text=txt,TextColor3=C.muted,Font=Enum.Font.Gotham,TextSize=size or 10,Size=UDim2.new(1,0,0,16),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})end
local function btn(parent,txt,cb,primary)
    local b = mk(parent,"TextButton",{BackgroundColor3=primary and C.gold or C.panel2,Text=txt,TextColor3=primary and Color3.new(0,0,0) or C.text,Font=Enum.Font.GothamBold,TextSize=10,Size=UDim2.new(1,0,0,30),BorderSizePixel=0,AutoButtonColor=false})
    mk(b,"UICorner",{CornerRadius=UDim.new(0,6)});mk(b,"UIStroke",{Color=primary and C.goldDim or C.border,Thickness=1})
    b.MouseEnter:Connect(function()b.BackgroundColor3=primary and C.goldDim or C.panel end)
    b.MouseLeave:Connect(function()b.BackgroundColor3=primary and C.gold or C.panel2 end)
    if cb then b.MouseButton1Click:Connect(cb) end
    return b
end
local function input(parent,ph,multi)
    if multi then
        local t = mk(parent,"TextBox",{BackgroundColor3=C.bg,Text="",PlaceholderText=ph,TextColor3=C.text,PlaceholderColor3=C.dim,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,80),BorderSizePixel=0,ClearTextOnFocus=false,MultiLine=true,TextXAlignment=Enum.TextXAlignment.Left,TextYAlignment=Enum.TextYAlignment.Top})
        mk(t,"UICorner",{CornerRadius=UDim.new(0,6)});mk(t,"UIStroke",{Color=C.border,Thickness=1});mk(t,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)});return t
    end
    local t = mk(parent,"TextBox",{BackgroundColor3=C.bg,Text="",PlaceholderText=ph,TextColor3=C.text,PlaceholderColor3=C.dim,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,28),BorderSizePixel=0,ClearTextOnFocus=false})
    mk(t,"UICorner",{CornerRadius=UDim.new(0,6)});mk(t,"UIStroke",{Color=C.border,Thickness=1});mk(t,"UIPadding",{PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)});return t
end
local function dropdown(parent,items)
    local d = mk(parent,"TextBox",{BackgroundColor3=C.bg,Text=items[1],TextColor3=C.text,PlaceholderColor3=C.dim,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,28),BorderSizePixel=0,ClearTextOnFocus=false})
    mk(d,"UICorner",{CornerRadius=UDim.new(0,6)});mk(d,"UIStroke",{Color=C.border,Thickness=1});mk(d,"UIPadding",{PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)});return d
end
local function addCard(parent,title,body,actions)
    local card = mk(parent,"Frame",{BackgroundColor3=C.bg,Size=UDim2.new(1,-16,0,0),AutomaticSize=Enum.AutomaticSize.Y,BorderSizePixel=0,Position=UDim2.new(0,8,0,0)})
    mk(card,"UICorner",{CornerRadius=UDim.new(0,8)});mk(card,"UIStroke",{Color=C.border2,Thickness=1})
    mk(card,"UIPadding",{PaddingTop=UDim.new(0,10),PaddingBottom=UDim.new(0,10),PaddingLeft=UDim.new(0,12),PaddingRight=UDim.new(0,12)})
    mk(card,"UIListLayout",{Padding=UDim.new(0,6)})
    mk(card,"Frame",{BackgroundColor3=C.gold,Size=UDim2.new(0,4,1,0),BorderSizePixel=0})
    mk(card,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.gold,Font=Enum.Font.GothamBlack,TextSize=12,Size=UDim2.new(1,-8,0,18),TextXAlignment=Enum.TextXAlignment.Left})
    if body then
        local box = mk(card,"TextLabel",{BackgroundTransparency=1,Text=body,TextColor3=C.text,Font=Enum.Font.RobotoMono,TextSize=9,Size=UDim2.new(1,-8,0,0),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})
    end
    if actions then for _,a in ipairs(actions)do
        local b = mk(card,"TextButton",{BackgroundColor3=a.primary and C.gold or C.panel2,Text=a.label,TextColor3=a.primary and Color3.new(0,0,0) or C.text,Font=Enum.Font.GothamBold,TextSize=10,Size=UDim2.new(1,0,0,28),BorderSizePixel=0,AutoButtonColor=false})
        mk(b,"UICorner",{CornerRadius=UDim.new(0,6)});b.MouseButton1Click:Connect(a.cb)
    end end
    parent.CanvasSize=UDim2.new(0,0,0,parent.UIListLayout.AbsoluteContentSize.Y+20)
    return card
end

-- ── Chat tab ───────────────────────────────────────────────────────────────
local chatLog = mk(tabChat,"ScrollingFrame",{BackgroundColor3=C.bg,Size=UDim2.new(1,0,0,260),BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=3})
mk(chatLog,"UIListLayout",{Padding=UDim.new(0,6)})
mk(chatLog,"UIPadding",{PaddingTop=UDim.new(0,6),PaddingBottom=UDim.new(0,6),PaddingLeft=UDim.new(0,6),PaddingRight=UDim.new(0,6)})
local function addChatMsg(role,text)
    local b = mk(chatLog,"TextLabel",{BackgroundColor3=role=="user" and C.goldDim or C.panel,Text=text,TextColor3=role=="user" and Color3.new(0,0,0) or C.text,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-12,0,0),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y,BorderSizePixel=0})
    mk(b,"UICorner",{CornerRadius=UDim.new(0,8)});mk(b,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)})
    chatLog.CanvasSize=UDim2.new(0,0,0,chatLog.UIListLayout.AbsoluteContentSize.Y+10);chatLog.CanvasPosition=Vector2.new(0,chatLog.AbsoluteCanvasSize.Y)
    return b
end
addChatMsg("ai","⚔ DevAI ready. Type a prompt below and I will write Luau for your game.")
local chatInput = input(tabChat,"Describe what to build...",true)
local function sendChat()
    local p=chatInput.Text;if p==""then return end
    addChatMsg("user",p);chatInput.Text=""
    local thinking=addChatMsg("ai","Forgetting... I mean forging ⚔...")
    -- Run in background
    task.spawn(function()
        local reply = callProvider(p)
        thinking:Destroy()
        -- Parse reply into a card with Insert buttons for code blocks
        local card = addCard(tabChat,"DevAI",reply:sub(1,200)..(#reply>200 and "..." or ""))
        -- Extract code blocks
        for code,loc in reply:gmatch("```[lua]*%s*\n(.-)%-%-%s*@location%s+([%w_.]+)[%s%c](.-)```") do
            local fullCode
            -- The regex is tricky; simpler: iterate manually
        end
        -- Simpler: just offer Insert full script if @location found
        for locLine, codeBlock in reply:gmatch("%-%- @location ([%w_.]+)\n(.-)```") do
            btn(card,"📤 Insert → "..locLine,function()insertScript(locLine,codeBlock)end,true)
        end
        -- Also add copy/download buttons
        btn(card,"📋 Copy full response",function()setclipboard(reply)end)
    end)
end
btn(tabChat,"⚔ Forge",sendChat,true)

-- Buttons for project actions
local quickRow = section(tabChat,"Quick actions")
local function horz(parent)local f=mk(parent,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,0,30),AutomaticSize=Enum.AutomaticSize.X});mk(f,"UIListLayout",{FillDirection=Enum.FillDirection.Horizontal,Padding=UDim.new(0,6)});return f end
local qr = horz(quickRow)
btn(qr,"⇅ Sync",function()sendToWeb("project_tree",explorerTree())end,true).Size=UDim2.new(0,70,1,0)
btn(qr,"↑ Selected",function()local s=Selection:Get();if s[1]then sendToWeb("selection",{path=s[1]:GetFullName(),class=s[1].ClassName})end end).Size=UDim2.new(0,80,1,0)
btn(qr,"↑ Script",function()local s=Selection:Get();if s[1]and s[1]:IsA("LuaSourceContainer")then sendToWeb("script",{path=s[1]:GetFullName(),class=s[1].ClassName,source=s[1].Source})end end).Size=UDim2.new(0,70,1,0)

-- ── 3D Models tab ─────────────────────────────────────────────────────────
local s3d = section(tab3D,"🧊 3D Models (Meshy)")
lbl(s3d,"Generate GLB/FBX from text. Requires a Meshy API key in Settings.",9)
local p3d = input(s3d,"ancient bronze broadsword with runes")
btn(s3d,"Generate 3D model",function()toastPlugin("3D generation requires web app (opens in Output)")end,true)
lbl(s3d,"💡 For full 3D preview/rigging, use the website. This panel shows downloaded GLB/FBX URLs from the web queue.",9)

-- ── Thumbnails tab ────────────────────────────────────────────────────────
local st = section(tabThumbs,"🖼 Thumbnails (free via Pollinations)")
lbl(st,"Generate icons/decals. URLs are copied to clipboard — paste into an ImageLabel/Decal in Studio.",9)
local pt = input(st,"ancient fantasy castle, golden hour")
btn(st,"Generate & copy URL",function()
    local prompt=pt.Text:gsub(" ","+")
    local url="https://image.pollinations.ai/prompt/"..prompt.."?width=512&height=512&nologo=true"
    setclipboard(url)
    addCard(tabThumbs,"Thumbnail URL copied","URL copied to clipboard. Paste into an ImageLabel.Image property:\n"..url,{
        {label="Open in browser",cb=function()game:GetService("StudioService"):OpenScript(url)end}
    })
end,true)

-- ── Focused Code tab ──────────────────────────────────────────────────────
local sc = section(tabCode,"📜 Focused Code Generator")
lbl(sc,"Pick target service/type and describe the script. The web app is used for best results.",9)
local codeTypeSel = mk(sc,"TextLabel",{BackgroundColor3=C.bg,Text="Script",TextColor3=C.text,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,28),BorderSizePixel=0})
mk(codeTypeSel,"UICorner",{CornerRadius=UDim.new(0,6)});mk(codeTypeSel,"UIStroke",{Color=C.border})
local codeParent = input(sc,"ServerScriptService.MySystem")
local codeDesc = input(sc,"What should it do?",true)
btn(sc,"⚔ Generate & Insert (uses web)",function()
    sendToWeb("generate_code",{type="Script",parent=codeParent.Text,desc=codeDesc.Text})
    toastPlugin("Request sent to website")
end,true)

-- ── GUI tab ───────────────────────────────────────────────────────────────
local sg = section(tabGUI,"🎨 GUI Generator")
lbl(sg,"Describe a menu/HUD → gold-themed LocalScript will be queued from the web app.",9)
local guiDesc = input(sg,"Main menu with Play/Settings/Credits")
btn(sg,"Request GUI from web",function()sendToWeb("generate_gui",{desc=guiDesc.Text});toastPlugin("Request sent to website")end,true)

-- ── Animations tab ────────────────────────────────────────────────────────
local sa = section(tabAnim,"💃 Animation Controller")
lbl(sa,"Paste animation IDs and generate a controller LocalScript.",9)
local animWalk=input(sa,"rbxassetid://WALK_ID");animWalk.PlaceholderText="Walk ID (rbxassetid://...)"
local animIdle=input(sa,"rbxassetid://IDLE_ID");animIdle.PlaceholderText="Idle ID"
local animRun=input(sa,"rbxassetid://RUN_ID");animRun.PlaceholderText="Run/Jump ID"
btn(sa,"Generate Controller & Insert",function()
    local code = "-- @location StarterCharacterScripts.AnimController\n"
    .."local h=script.Parent:WaitForChild(\"Humanoid\")\n"
    .."local function l(id)local a=Instance.new(\"Animation\");a.AnimationId=id;return h.Animator:LoadAnimation(a)end\n"
    .."local w="..(animWalk.Text~=""and "l(\""..animWalk.Text.."\")"or "nil").."\n"
    .."local i="..(animIdle.Text~=""and "l(\""..animIdle.Text.."\")"or "nil").."\n"
    .."local r="..(animRun.Text~=""and "l(\""..animRun.Text.."\")"or "nil").."\n"
    .."h.Running:Connect(function(s)\n"
    .."if i then i:Stop()end;if w then w:Stop()end;if r then r:Stop()end\n"
    .."if s<0.1 then if i then i:Play()end elseif s<16 then if w then w:Play()end elseif r then r:Play()end end end)\n"
    insertScript("StarterCharacterScripts.AnimController",code)
end,true)

-- ── Debug tab ─────────────────────────────────────────────────────────────
local sd = section(tabDebug,"🔧 Debug")
lbl(sd,"Captures the last error from Output and feeds it to the AI with project context.",9)
local lastErrorLbl = mk(sd,"TextLabel",{BackgroundTransparency=1,Text="No error captured yet.",TextColor3=C.dim,Font=Enum.Font.RobotoMono,TextSize=9,Size=UDim2.new(1,0,0,40),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true})
local lastError = ""
LogService.MessageOut:Connect(function(msg,typ)
    if typ==Enum.MessageType.MessageError then
        lastError=msg;lastErrorLbl.Text=msg;lastErrorLbl.TextColor3=C.red
    end
end)
btn(sd,"🔍 Send last error + project to AI",function()
    sendToWeb("debug",{error=lastError,tree=explorerTree()})
    toastPlugin("Error sent to website")
end,true)
btn(sd,"📊 Scan project",function()sendToWeb("scan",projectScan());toastPlugin("Scan sent")end)

-- Settings area
local ss = section(tabDebug,"⚙ Settings (stored locally in plugin)")
lbl(ss,"API keys are saved via plugin:SetSetting and never leave Studio. Calls go directly to the provider.",9)
local openrouterKeyIn=input(ss,"OpenRouter key (sk-or-...)");openrouterKeyIn.Text=plugin:GetSetting("key_openrouter")or""
local anthropicKeyIn=input(ss,"Anthropic key (sk-ant-...)");anthropicKeyIn.Text=plugin:GetSetting("key_anthropic")or""
local openaiKeyIn=input(ss,"OpenAI key (sk-...)");openaiKeyIn.Text=plugin:GetSetting("key_openai")or""
local groqKeyIn=input(ss,"Groq key (gsk_...)");groqKeyIn.Text=plugin:GetSetting("key_groq")or""
local meshyKeyIn=input(ss,"Meshy key (msy_...)");meshyKeyIn.Text=plugin:GetSetting("key_meshy")or""
btn(ss,"💾 Save Keys",function()
    plugin:SetSetting("key_openrouter",openrouterKeyIn.Text)
    plugin:SetSetting("key_anthropic",anthropicKeyIn.Text)
    plugin:SetSetting("key_openai",openaiKeyIn.Text)
    plugin:SetSetting("key_groq",groqKeyIn.Text)
    plugin:SetSetting("key_meshy",meshyKeyIn.Text)
    toastPlugin("Keys saved")
end,true)

-- ── Plugin logic ──────────────────────────────────────────────────────────
function toastPlugin(msg)
    addChatMsg("ai",msg)
end

function sendToWeb(kind,data)
    if not HTTP_ENABLED then toastPlugin("HTTP not enabled — enable in Plugin Settings (Studio → Plugin Security → Allow HTTP Requests)");setclipboard("__ENESIN__:"..kind.."|"..HttpService:JSONEncode({kind=kind,data=data}));return end
    pcall(function()HttpService:PostAsync(BRIDGE.."/send-web",HttpService:JSONEncode({kind=kind,data=data}),Enum.HttpContentType.ApplicationJson)end)
end

function explorerTree()
    local seen=0;local function walk(i,d)if seen>400 or d>5 then return nil end;seen=seen+1
        local n={name=i.Name,class=i.ClassName,children={}}
        local kids=i:GetChildren();table.sort(kids,function(a,b)return a.Name<b.Name end)
        for _,c in ipairs(kids)do local s=walk(c,d+1);if s then table.insert(n.children,s)end end
        return n
    end
    local tree={}
    for _,svc in ipairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")})do table.insert(tree,walk(svc,0))end
    return tree
end

function projectScan()
    local counts={Script=0,LocalScript=0,ModuleScript=0,RemoteEvent=0,RemoteFunction=0,Folder=0,Model=0,Part=0}
    local function walk(p)for _,c in pairs(p:GetChildren())do if counts[c.ClassName]then counts[c.ClassName]+=1 end;walk(c)end end
    for _,svc in pairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")})do walk(svc)end
    return counts
end

function insertScript(loc,code)
    local parent,className,name=game,nil,nil
    local parts={}
    for part in loc:gmatch("[^%.]+")do table.insert(parts,part)end
    name=table.remove(parts)
    for _,part in ipairs(parts)do
        local ch=parent:FindFirstChild(part)
        if not ch then
            local ok,svc=pcall(game.GetService,game,part)
            if ok and parent==game then ch=svc else
                local f=Instance.new("Folder");f.Name=part;f.Parent=parent;ch=f end
        end
        parent=ch
    end
    -- Detect class
    if code:find("return%s+")or name:match("^Module")or parent:IsA("ReplicatedStorage")then className="ModuleScript"
    elseif parent:IsA("StarterGui")or parent:IsA("StarterPlayerScripts")or parent:IsA("StarterPack")then className="LocalScript"
    else className="Script"end
    -- Update existing if found
    local existing=parent:FindFirstChild(name)
    if existing and existing:IsA("LuaSourceContainer")and existing.ClassName==className then
        existing.Source=code;Selection:Set{existing};pcall(function()StudioService:OpenScript(existing)end)
        toastPlugin("Updated: "..existing:GetFullName());return
    end
    local s=Instance.new(className);s.Name=name;
    if s:IsA("LuaSourceContainer")then s.Source=code end
    s.Parent=parent;Selection:Set{s};pcall(function()StudioService:OpenScript(s)end)
    ChangeHistoryService:SetWaypoint("DevAI: "..s.Name)
    addCard(tabChat,"📜 Inserted",s:GetFullName(),{
        {label="Open in Editor",cb=function()pcall(function()StudioService:OpenScript(s)end)end}
    })
    toastPlugin("Inserted: "..s:GetFullName())
end

function callProvider(prompt)
    -- Try configured keys in priority order; else return template
    local keys={openrouter=plugin:GetSetting("key_openrouter"),anthropic=plugin:GetSetting("key_anthropic"),openai=plugin:GetSetting("key_openai"),groq=plugin:GetSetting("key_groq")}
    local sys = "You are DevAI, an expert Roblox Studio AI writing production Luau. Start EVERY lua block with -- @location Path.To.Parent.ScriptName. Use modern Luau, task.spawn, pcall for DataStore, WaitForChild. For multi-file systems, output a BUILD PLAN first then each script as a SEPARATE code block. Code must be complete, no TODO. Ancient-fantasy gold theme for any UI."
    local function doCall(endpoint,model,key)
        if not key or key==""then return nil end
        local ok,r=pcall(function()return HttpService:RequestAsync({Url=endpoint,Method="POST",Headers={["Content-Type"]="application/json",["Authorization"]="Bearer "..key},Body=HttpService:JSONEncode({model=model,messages={{role="system",content=sys},{role="user",content=prompt}},max_tokens=4096})})end)
        if ok and r.Success then
            local j=HttpService:JSONDecode(r.Body);return j.choices and j.choices[1].message.content or "[no response]"
        end
        return nil
    end
    -- Groq fastest
    local r=doCall("https://api.groq.com/openai/v1/chat/completions","llama-3.1-70b-versatile",keys.groq)if r then return r end
    r=doCall("https://openrouter.ai/api/v1/chat/completions","meta-llama/llama-3.1-8b-instruct:free",keys.openrouter)if r then return r end
    r=doCall("https://api.openai.com/v1/chat/completions","gpt-4o-mini",keys.openai)if r then return r end
    return "⚔ No API key configured (or all calls failed). Add a key in the Debug → Settings panel below. Free options:\n- Groq (console.groq.com): free, very fast\n- OpenRouter (openrouter.ai): free Llama 3.1 tier\n\nQuick starter for: "..prompt.."\n\n```lua\n-- @location ServerScriptService.Starter\nlocal Players=game:GetService(\"Players\")\nPlayers.PlayerAdded:Connect(function(p)print(\"Welcome\",p.Name)end)\n```"
end

-- Poll bridge for Send-to-Studio actions
task.spawn(function()
    while true do
        task.wait(POLL)
        if not HTTP_ENABLED then
            -- Clipboard fallback
            local cb=""pcall(function()cb=getclipboard()or""end)
            if cb:sub(1,12)=="__ENESOUT__:"then
                local rest=cb:sub(13);local title,typ,tgt,src=rest:match("([^|]+)|([^|]+)|([^|]+)|(.*)")
                if title and src then insertScript(tgt~=""and tgt.."."..title or "ServerScriptService."..title,src)end
            end
        else
            local ok,r=pcall(function()return HttpService:GetAsync(BRIDGE.."/poll-studio")end)
            if ok then
                statusLbl.Text="● Bridge: connected";statusLbl.TextColor3=C.green
                local j=HttpService:JSONDecode(r)
                for _,m in ipairs(j.messages or {})do
                    if m.code and m.title then
                        local tgt=m.target or(m.type=="LocalScript" and "StarterPlayerScripts" or "ServerScriptService")
                        insertScript(tgt.."."..m.title,m.code)
                    end
                end
            else
                statusLbl.Text="● Bridge: not running (start start-devai.bat)";statusLbl.TextColor3=C.red
            end
        end
    end
end)

-- Auto-reload-friendly
print("[⚔ DevAI] v1.2 loaded. Ancient-fantasy Roblox AI is ready.")
