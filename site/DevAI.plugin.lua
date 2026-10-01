-- =============================================================================
-- Enes AI v8 — Tiger Studio Bridge
-- Clipboard + HTTP backend. Zero Python. Orange/tiger theme.
-- =============================================================================
local HttpService       = game:GetService("HttpService")
local Selection         = game:GetService("Selection")
local StudioService     = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local LogService        = game:GetService("LogService")

local BACKEND = "http://127.0.0.1:42069"
local POLL = 1.0
local PREFIX_OUT = "__ENESOUT__:"
local PREFIX_IN  = "__ENESIN__:"
local PREFIX_PAIR = "__ENESPAIR__:"
local USE_HTTP = pcall(function() HttpService:GetAsync(BACKEND.."/api/health") end)

-- Palette — tiger orange
local C = {
    bg        = Color3.fromHex("#0a0810"),
    panel     = Color3.fromHex("#14101e"),
    panel2    = Color3.fromHex("#1e1830"),
    border    = Color3.fromHex("#2a2240"),
    tiger     = Color3.fromHex("#ff8c00"),
    tigerDim  = Color3.fromHex("#cc6f00"),
    green     = Color3.fromHex("#22c55e"),
    red       = Color3.fromHex("#ef4444"),
    amber     = Color3.fromHex("#f59e0b"),
    purple    = Color3.fromHex("#a855f7"),
    text      = Color3.fromHex("#f5f3ff"),
    muted     = Color3.fromHex("#a39bb8"),
    dim       = Color3.fromHex("#6b6480"),
}

local function mk(parent, class, props)
    local e = Instance.new(class)
    for k,v in pairs(props or {}) do e[k]=v end
    e.Parent = parent
    return e
end

local toolbar = plugin:CreateToolbar("Enes AI")
local tbtn = toolbar:CreateButton("Enes AI","🐯 Enes AI v8","rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float,true,false,380,640,320,480)
local gui = plugin:CreateDockWidgetPluginGui("EnesAI_v8",widgetInfo)
gui.Title = "🐯 Enes AI"
tbtn.Click:Connect(function() gui.Enabled = not gui.Enabled end)

local Root = mk(gui,"Frame",{BackgroundColor3=C.bg,Size=UDim2.fromScale(1,1)})
mk(Root,"UIPadding",{PaddingTop=UDim.new(0,16),PaddingBottom=UDim.new(0,16),PaddingLeft=UDim.new(0,16),PaddingRight=UDim.new(0,16)})
local y = 0

-- Header
local header = mk(Root,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,0,44),Position=UDim2.new(0,0,0,y)})
mk(header,"TextLabel",{BackgroundTransparency=1,Text="🐅",TextColor3=C.tiger,Font=Enum.Font.GothamBlack,TextSize=28,Size=UDim2.new(0,40,1,0),TextXAlignment=Enum.TextXAlignment.Left})
local titleLbl = mk(header,"TextLabel",{BackgroundTransparency=1,Text="Enes AI",TextColor3=C.tiger,Font=Enum.Font.GothamBlack,TextSize=22,Size=UDim2.new(1,-100,0,26),Position=UDim2.new(0,44,0,0),TextXAlignment=Enum.TextXAlignment.Left})
local verLbl = mk(header,"TextLabel",{BackgroundTransparency=1,Text="v8",TextColor3=C.muted,Font=Enum.Font.GothamBold,TextSize=10,Size=UDim2.new(1,-100,0,16),Position=UDim2.new(0,44,0,26),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 50

-- Status
local statusLbl = mk(Root,"TextLabel",{BackgroundTransparency=1,Text="● Not connected — start start-devai.bat then pair",TextColor3=C.red,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,-20,0,20),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 24

-- Project
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="📁 Place: "..game.Name,TextColor3=C.muted,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,0,0,16),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 24

-- Connect box (only if HTTP)
local token = nil
local autoInsert = true

if USE_HTTP then
    local pairBox = mk(Root,"TextBox",{BackgroundColor3=C.panel,Text="",PlaceholderText="Paste pairing code here",TextColor3=C.text,PlaceholderColor3=C.dim,Font=Enum.Font.Gotham,TextSize=12,Size=UDim2.new(1,-110,0,32),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,ClearTextOnFocus=false})
    mk(pairBox,"UICorner",{CornerRadius=UDim.new(0,8)})
    mk(pairBox,"UIPadding",{PaddingLeft=UDim.new(0,12),PaddingRight=UDim.new(0,12)})
    mk(pairBox,"UIStroke",{Color=C.border,Thickness=1})
    local connectBtn = mk(Root,"TextButton",{BackgroundColor3=C.tiger,Text="Connect",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBlack,TextSize=12,Size=UDim2.new(0,100,0,32),Position=UDim2.new(1,-100,0,y),BorderSizePixel=0,AutoButtonColor=false})
    mk(connectBtn,"UICorner",{CornerRadius=UDim.new(0,8)})
    connectBtn.MouseEnter:Connect(function() connectBtn.BackgroundColor3=C.tigerDim end)
    connectBtn.MouseLeave:Connect(function() connectBtn.BackgroundColor3=C.tiger end)
    y = y + 40

    local function doConnect()
        local code = pairBox.Text:gsub("%s",""):upper()
        if #code < 6 then statusLbl.Text="Enter pairing code"; statusLbl.TextColor3=C.red; return end
        local ok,r = pcall(function() return HttpService:RequestAsync({Url=BACKEND.."/api/plugin/pair",Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode({code=code})}) end)
        if not ok then statusLbl.Text="HTTP failed — make sure server is running"; statusLbl.TextColor3=C.red; return end
        local j = HttpService:JSONDecode(r.Body)
        if not j.ok then statusLbl.Text="Pair failed: "..(j.error or "unknown"); statusLbl.TextColor3=C.red; return end
        token = j.token
        statusLbl.Text="● Connected — waiting for AI actions"; statusLbl.TextColor3=C.green
        addLog("ok","Connected","Paired with backend")
        startPollLoop()
    end
    connectBtn.MouseButton1Click:Connect(doConnect)
    pairBox.FocusLost:Connect(function(enter) if enter then doConnect() end end)
else
    local info = mk(Root,"TextLabel",{BackgroundTransparency=1,Text="⚠ Enable HttpService in Studio (Plugin Settings → Allow HTTP Requests) or use clipboard mode (copy from website, plugin auto-reads).",TextColor3=C.amber,Font=Enum.Font.Gotham,TextSize=9,Size=UDim2.new(1,0,0,40),Position=UDim2.new(0,0,0,y),TextWrapped=true,TextXAlignment=Enum.TextXAlignment.Left})
    y = y + 44
end

-- Action buttons (wider, bolder, tiger themed)
local function bigBtn(text, color, fg, x, y_, w, cb)
    local b = mk(Root,"TextButton",{BackgroundColor3=color,Text=text,TextColor3=fg,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(0,w,0,34),Position=UDim2.new(x,0,0,y_),BorderSizePixel=0,AutoButtonColor=false})
    mk(b,"UICorner",{CornerRadius=UDim.new(0,8)})
    mk(b,"UIStroke",{Color=C.border,Thickness=1})
    b.MouseEnter:Connect(function() b.BackgroundColor3=C.tigerDim end)
    b.MouseLeave:Connect(function() b.BackgroundColor3=color end)
    b.MouseButton1Click:Connect(cb)
    return b
end
bigBtn("⇅ Sync Project",C.panel,C.text,0,y,110,sendProjectTree)
bigBtn("↑ Selected",C.panel,C.text,118,y,94,sendSelection)
bigBtn("↑ Script",C.panel,C.text,220,y,80,sendSelectedScript)
y = y + 40
bigBtn("📊 Scan Project",C.panel,C.text,0,y,154,sendScan)
bigBtn("📟 Output: OFF",C.panel,C.muted,162,y,138,toggleOutput)
y = y + 44

-- Auto-insert toggle
local toggleRow = mk(Root,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,0,22),Position=UDim2.new(0,0,0,y)})
local toggleBtn = mk(toggleRow,"TextButton",{Text="●",TextColor3=C.tiger,Font=Enum.Font.GothamBold,TextSize=14,BackgroundColor3=C.panel,Size=UDim2.new(0,22,0,22),BorderSizePixel=0,AutoButtonColor=false})
mk(toggleBtn,"UICorner",{CornerRadius=UDim.new(0,4)});mk(toggleBtn,"UIStroke",{Color=C.dim,Thickness=1})
mk(toggleRow,"TextLabel",{BackgroundTransparency=1,Text="Auto-insert scripts (no click needed)",TextColor3=C.muted,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-30,1,0),Position=UDim2.new(0,28,0,0),TextXAlignment=Enum.TextXAlignment.Left})
toggleBtn.MouseButton1Click:Connect(function() autoInsert=not autoInsert; toggleBtn.Text=autoInsert and "●" or "○"; toggleBtn.TextColor3=autoInsert and C.tiger or C.dim; end)
y = y + 30

-- Section: Activity
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Activity",TextColor3=C.text,Font=Enum.Font.GothamBold,TextSize=12,Size=UDim2.new(1,0,0,20),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 24

local logFrame = mk(Root,"ScrollingFrame",{BackgroundColor3=C.panel,Size=UDim2.new(1,0,1,-y),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=4,ScrollBarImageColor3=C.dim})
mk(logFrame,"UICorner",{CornerRadius=UDim.new(0,10)})
mk(logFrame,"UIStroke",{Color=C.border,Thickness=1})
mk(logFrame,"UIListLayout",{Padding=UDim.new(0,8),SortOrder=Enum.SortOrder.LayoutOrder})
mk(logFrame,"UIPadding",{PaddingTop=UDim.new(0,10),PaddingBottom=UDim.new(0,10),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)})

local function addLog(kind,title,detail)
    local accent = kind=="in" and C.tiger or kind=="ok" and C.green or kind=="err" and C.red or C.amber
    local card = mk(logFrame,"Frame",{BackgroundColor3=C.bg,Size=UDim2.new(1,0,0,62),BorderSizePixel=0,AutomaticSize=Enum.AutomaticSize.Y})
    mk(card,"UICorner",{CornerRadius=UDim.new(0,8)})
    mk(card,"UIStroke",{Color=C.border,Thickness=1})
    mk(card,"Frame",{BackgroundColor3=accent,Size=UDim2.new(0,4,1,0),BorderSizePixel=0})
    local pillLbl = kind:upper()
    local pillBg = mk(card,"Frame",{BackgroundColor3=accent,Size=UDim2.new(0,44,0,20),Position=UDim2.new(0,12,0,8),BorderSizePixel=0})
    mk(pillBg,"UICorner",{CornerRadius=UDim.new(1,0)})
    mk(pillBg,"TextLabel",{BackgroundTransparency=1,Text=pillLbl,TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBlack,TextSize=9,Size=UDim2.fromScale(1,1),TextXAlignment=Enum.TextXAlignment.Center})
    local insertBtn
    if kind=="in" then
        insertBtn = mk(card,"TextButton",{Text="Insert",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBlack,TextSize=10,Size=UDim2.new(0,72,0,28),Position=UDim2.new(1,-84,0,6),BackgroundColor3=C.tiger,AutoButtonColor=false,BorderSizePixel=0})
        mk(insertBtn,"UICorner",{CornerRadius=UDim.new(0,6)})
    end
    mk(card,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.text,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,-130,0,20),Position=UDim2.new(0,64,0,8),TextXAlignment=Enum.TextXAlignment.Left,TextTruncate=Enum.TextTruncate.AtEnd})
    mk(card,"TextLabel",{BackgroundTransparency=1,Text=detail and detail:sub(1,220) or "",TextColor3=C.muted,Font=Enum.Font.RobotoMono,TextSize=9,Size=UDim2.new(1,-20,0,26),Position=UDim2.new(0,12,0,30),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})
    if insertBtn then
        insertBtn.MouseButton1Click:Connect(function()
            local code,title_,stype,tgt = insertBtn._code,insertBtn._title,insertBtn._type,insertBtn._target
            local className = stype=="LocalScript" and "LocalScript" or stype=="ModuleScript" and "ModuleScript" or "Script"
            local parent
            if tgt and tgt~="" then
                local cur
                for part in tgt:gmatch("[^%.]+") do
                    if not cur then
                        local ok,svc=pcall(game.GetService,game,part)
                        if ok then cur=svc else
                            local ch=game:FindFirstChild(part); if ch then cur=ch end end
                    else
                        local ch=cur:FindFirstChild(part); if ch then cur=ch end end
                end
                parent=cur
            end
            if not parent then
                if className=="LocalScript" then parent=game:GetService("StarterPlayerScripts")
                elseif className=="ModuleScript" then parent=game:GetService("ReplicatedStorage")
                else parent=game:GetService("ServerScriptService") end
            end
            local s=Instance.new(className); s.Name=(title_ or "EnesAI_Script"):gsub("[^%w_ ]","_"):sub(1,40)
            if s:IsA("LuaSourceContainer") then s.Source=code or "" end
            s.Parent=parent
            ChangeHistoryService:SetWaypoint("EnesAI: "..s.Name); Selection:Set({s}); pcall(function()StudioService:OpenScript(s)end)
            insertBtn.Text="✓ Done"; insertBtn.BackgroundColor3=C.green
            statusLbl.Text="Inserted '"..s.Name.."' → "..parent:GetFullName(); statusLbl.TextColor3=C.green
            if token then pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/result",HttpService:JSONEncode({token=token,actionId=insertBtn._actionId or 0,success=true,path=s:GetFullName()}),Enum.HttpContentType.ApplicationJson) end) end
        end)
        if autoInsert then task.delay(0.4,function() insertBtn:Activate() end) end
    end
    task.wait(0.05)
    logFrame.CanvasSize=UDim2.new(0,0,0,logFrame.UIListLayout.AbsoluteContentSize.Y+20)
    return insertBtn
end

local function sendToClipboard(kind, data)
    local payload = PREFIX_IN..kind.."|"..HttpService:JSONEncode(data)
    pcall(function() setclipboard(payload) end)
    statusLbl.Text="Copied "..kind.." → website"; statusLbl.TextColor3=C.amber
    addLog("out",kind,(data.name or data.path or "")..(data.data and (" "..tostring(data.data):sub(1,100)) or ""))
end
function sendProjectTree()
    if USE_HTTP and token then
        local seen=0
        local function walk(inst,d) if seen>=500 or d>=6 then return nil end; seen=seen+1;local n={name=inst.Name,class=inst.ClassName,children={}};local kids=inst:GetChildren();table.sort(kids,function(a,b)return a.Name<b.Name end);for _,c in ipairs(kids)do local sub=walk(c,d+1);if sub then table.insert(n.children,sub)end end;return n end
        local tree={}
        for _,svc in ipairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")}) do table.insert(tree,walk(svc,0)) end
        pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/event",HttpService:JSONEncode({token=token,event="project_tree",data=tree}),Enum.HttpContentType.ApplicationJson) end)
        addLog("ok","Sent project tree",seen.." nodes")
        return
    end
    local seen=0
    local function walk(inst,d) if seen>=400 or d>=5 then return nil end; seen=seen+1;local n={name=inst.Name,class=inst.ClassName,children={}};for _,c in ipairs(inst:GetChildren())do local sub=walk(c,d+1);if sub then table.insert(n.children,sub)end end;return n end
    local tree={}
    for _,svc in ipairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")}) do table.insert(tree,walk(svc,0)) end
    sendToClipboard("explorer",{data=tree,time=os.time()})
end
function sendSelection()
    local s=Selection:Get();if #s==0 then addLog("err","No selection","");return end
    if USE_HTTP and token then pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/event",HttpService:JSONEncode({token=token,event="selection",data={path=s[1]:GetFullName(),class=s[1].ClassName}}),Enum.HttpContentType.ApplicationJson) end) end
    addLog("ok","Sent selection",s[1]:GetFullName())
end
function sendSelectedScript()
    local s=Selection:Get();if #s==0 then addLog("err","No selection","");return end
    local t=s[1];if not t:IsA("LuaSourceContainer") then addLog("err","Not a script","");return end
    if USE_HTTP and token then pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/event",HttpService:JSONEncode({token=token,event="script",data={path=t:GetFullName(),class=t.ClassName,source=t.Source}}),Enum.HttpContentType.ApplicationJson) end) end
    sendToClipboard("script",{name=t.Name,class=t.ClassName,path=t:GetFullName(),data="-- Script: "..t:GetFullName().."\n\n"..t.Source,time=os.time()})
end
function sendScan()
    local counts={Script=0,LocalScript=0,ModuleScript=0,RemoteEvent=0,RemoteFunction=0,Folder=0,Model=0,Part=0}
    local function walk(p)for _,c in pairs(p:GetChildren())do if counts[c.ClassName]then counts[c.ClassName]+=1 end;walk(c)end end
    for _,svc in pairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")}) do walk(svc) end
    if USE_HTTP and token then pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/event",HttpService:JSONEncode({token=token,event="scan",data=counts}),Enum.HttpContentType.ApplicationJson) end) end
    addLog("ok","Scan complete",HttpService:JSONEncode(counts))
end
local outputOn = false
function toggleOutput()
    outputOn=not outputOn
    script.Parent.Parent.Parent -- noop
    addLog(outputOn and "ok" or "out","Output stream",outputOn and "started" or "stopped")
end

LogService.MessageOut:Connect(function(msg,typ)
    if not (USE_HTTP and token and outputOn) then return end
    local level=typ==Enum.MessageType.MessageError and "error" or typ==Enum.MessageType.MessageWarning and "warn" or "info"
    pcall(function() HttpService:PostAsync(BACKEND.."/api/plugin/event",HttpService:JSONEncode({token=token,event="output",data={level=level,message=msg}}),Enum.HttpContentType.ApplicationJson) end)
end)

-- Poll loop (HTTP)
function startPollLoop()
    task.spawn(function()
        while token do
            local ok,r=pcall(function()return HttpService:RequestAsync({Url=BACKEND.."/api/plugin/poll",Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode({token=token})})end)
            if not ok then statusLbl.Text="Poll error";statusLbl.TextColor3=C.red;token=nil;break end
            local j=HttpService:JSONDecode(r.Body)
            for _,a in ipairs(j.actions or {}) do
                local btn = addLog("in",a.op.." #"..a.id,a.params.name or a.params.path or "")
                if btn then btn._code=a.params.source;btn._title=a.params.name;btn._type=a.params.className;btn._target=a.params.parent;btn._actionId=a.id end
                execAction(a)
            end
            task.wait(POLL)
        end
    end)
end

local function confirmDialog(title,msg)
    local dlg=mk(gui,"Frame",{BackgroundColor3=C.panel2,Size=UDim2.new(0.92,0,0,170),Position=UDim2.new(0.04,0,0.25,0),BorderSizePixel=0,ZIndex=100})
    mk(dlg,"UICorner",{CornerRadius=UDim.new(0,10)});mk(dlg,"UIStroke",{Color=C.tiger,Thickness=2})
    mk(dlg,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.tiger,Font=Enum.Font.GothamBlack,TextSize=13,Size=UDim2.new(1,-20,0,28),Position=UDim2.new(0,10,0,12),TextXAlignment=Enum.TextXAlignment.Left})
    mk(dlg,"TextLabel",{BackgroundTransparency=1,Text=msg,TextColor3=C.text,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-20,0,90),Position=UDim2.new(0,10,0,40),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true})
    local res=false
    bigBtn("✅ APPROVE",C.tiger,Color3.new(0,0,0),UDim2.new(0,10),UDim2.new(1,-116),90,function()res=true;dlg:Destroy()end).Parent=dlg
    bigBtn("❌ REJECT",C.panel,C.red,UDim2.new(1,-100),UDim2.new(1,-116),90,function()res=false;dlg:Destroy()end).Parent=dlg
    while dlg.Parent do task.wait(0.05) end
    return res
end

local function execAction(a)
    local function fail(msg) addLog("err",a.op.." failed",msg);if token then pcall(function()HttpService:PostAsync(BACKEND.."/api/plugin/result",HttpService:JSONEncode({token=token,actionId=a.id,success=false,error=msg}),Enum.HttpContentType.ApplicationJson)end)end end
    local function ok(inst) local p=inst and inst:GetFullName() or "";addLog("ok",a.op.." complete",p);if token then pcall(function()HttpService:PostAsync(BACKEND.."/api/plugin/result",HttpService:JSONEncode({token=token,actionId=a.id,success=true,path=p}),Enum.HttpContentType.ApplicationJson)end)end end
    local op=a.op
    if op=="delete_instance" or op=="update_script" or op=="move_instance" or op=="rename_instance" then
        local approved=confirmDialog("⚠ "..op:upper(),(a.params.path or "").."\n\nThis modifies an existing instance. Approve to execute.")
        if not approved then addLog("err",a.op.." rejected",a.params.path or "");if token then pcall(function()HttpService:PostAsync(BACKEND.."/api/plugin/result",HttpService:JSONEncode({token=token,actionId=a.id,success=false,error="rejected by user"}),Enum.HttpContentType.ApplicationJson)end)end return end
    end
    ChangeHistoryService:SetWaypoint("EnesAI: "..op)
    if op=="create_instance" then
        local function resolve(parent)
            local cur;for part in parent:gmatch("[^%.]+")do if not cur then local ok,svc=pcall(game.GetService,game,part);cur=ok and svc or game:FindFirstChild(part) else local ch=cur:FindFirstChild(part);if not ch then local f=Instance.new("Folder");f.Name=part;f.Parent=cur;ch=f end;cur=ch end end;return cur
        end
        local parent=resolve(a.params.parent or "ServerScriptService");if not parent then return fail("parent not found") end
        local name=a.params.name or "EnesAI_Script";
        local existing=parent:FindFirstChild(name)
        if existing and a.params.source and existing:IsA("LuaSourceContainer") and existing.ClassName==(a.params.className or "Script") then existing.Source=a.params.source;Selection:Set{existing};pcall(function()StudioService:OpenScript(existing)end);addLog("ok","Updated",existing:GetFullName());return ok(existing) end
        local inst=Instance.new(a.params.className or "Script");inst.Name=name
        if a.params.source and inst:IsA("LuaSourceContainer") then inst.Source=a.params.source end
        inst.Parent=parent;Selection:Set{inst};pcall(function()StudioService:OpenScript(inst)end);return ok(inst)
    elseif op=="update_script" then
        local cur=nil;for part in a.params.path:gmatch("[^%.]+")do if not cur then local ok,svc=pcall(game.GetService,game,part);cur=ok and svc or game:FindFirstChild(part) else local ch=cur:FindFirstChild(part);cur=ch end end
        if not cur or not cur:IsA("LuaSourceContainer") then return fail("script not found") end
        cur.Source=a.params.source or "";Selection:Set{cur};return ok(cur)
    elseif op=="delete_instance" then local cur=nil;for part in a.params.path:gmatch("[^%.]+")do if not cur then local ok,svc=pcall(game.GetService,game,part);cur=ok and svc or game:FindFirstChild(part) else cur=cur:FindFirstChild(part) end end;if not cur then return fail("not found") end;cur:Destroy();return ok()
    elseif op=="get_project_tree" then sendProjectTree();ok()
    elseif op=="get_selection" then sendSelection();ok()
    elseif op=="get_script" then sendSelectedScript();ok()
    elseif op=="get_output" then outputOn=true;addLog("ok","Output stream","enabled");ok()
    elseif op=="scan_project" then sendScan();ok()
    else return fail("unknown op: "..tostring(op)) end
end

-- Clipboard fallback (always works even without HTTP)
local lastClip=""
task.spawn(function()
    while true do
        local cb="" pcall(function()cb=getclipboard() or ""end)
        if cb~=lastClip then
            lastClip=cb
            if cb:sub(1,#PREFIX_PAIR)==PREFIX_PAIR then
                local code=cb:sub(#PREFIX_PAIR+1)
                if USE_HTTP then
                    local ok,r=pcall(function()return HttpService:RequestAsync({Url=BACKEND.."/api/plugin/pair",Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode({code=code})})end)
                    if ok then
                        local j=HttpService:JSONDecode(r.Body)
                        if j.ok then token=j.token;statusLbl.Text="● Paired via clipboard!";statusLbl.TextColor3=C.green;addLog("ok","Paired",code);startPollLoop() end
                    end
                else
                    statusLbl.Text="● Pairing code detected (clipboard mode)";statusLbl.TextColor3=C.green;addLog("ok","Pair code",code)
                end
            elseif cb:sub(1,#PREFIX_OUT)==PREFIX_OUT then
                local rest=cb:sub(#PREFIX_OUT+1);local parts={}
                for p in rest:gmatch("[^|]+")do table.insert(parts,p)end
                if #parts>=4 then
                    local title,stype,tgt=parts[1],parts[2],parts[3];local source=table.concat(parts,"|",4)
                    local btn=addLog("in",title.." ["..stype.."]",source:sub(1,180))
                    if btn then btn._code=source;btn._title=title;btn._type=stype;btn._target=tgt end
                    statusLbl.Text="Received: "..title;statusLbl.TextColor3=C.tiger
                end
            end
        end
        task.wait(1)
    end
end)

-- Send connect handshake on start
task.wait(0.5)
if USE_HTTP then pcall(function()setclipboard(PREFIX_IN.."ack|"..HttpService:JSONEncode({connected=true,version="v8"}))end) end
print("[🐯 Enes AI] v8 loaded. Tiger mode activated.")
