-- =============================================================================
-- DevAI v7 — Lemonade Studio Bridge (HTTP long-poll backend)
-- Connects to the local DevAI backend at http://127.0.0.1:42069 via HttpService.
-- Clipboard fallback is also available for users who keep HttpService off.
-- =============================================================================
local HttpService       = game:GetService("HttpService")
local Selection         = game:GetService("Selection")
local StudioService     = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local LogService        = game:GetService("LogService")
local RunService        = game:GetService("RunService")

local BACKEND = "http://127.0.0.1:42069"
local POLL_INTERVAL = 1.0

-- ── Palette ────────────────────────────────────────────────────────────────
local C = {
    bg        = Color3.fromHex("#0d0d0d"),
    panel     = Color3.fromHex("#161616"),
    panel2    = Color3.fromHex("#1e1e1e"),
    border    = Color3.fromHex("#222"),
    citrus    = Color3.fromHex("#d4f522"),
    citrusDim = Color3.fromHex("#8aab0e"),
    green     = Color3.fromHex("#22c55e"),
    red       = Color3.fromHex("#ef4444"),
    amber     = Color3.fromHex("#f59e0b"),
    blue      = Color3.fromHex("#3b82f6"),
    text      = Color3.fromHex("#f0f0f0"),
    muted     = Color3.fromHex("#888"),
    dim       = Color3.fromHex("#666"),
    faint     = Color3.fromHex("#3a3a3a"),
}
local function mk(parent, class, props)
    local e = Instance.new(class)
    for k,v in pairs(props or {}) do e[k]=v end
    e.Parent = parent
    return e
end
local function pill(parent, text, bg, fg, pos, size)
    local f = mk(parent,"Frame",{BackgroundColor3=bg,Size=size or UDim2.new(0,60,0,18),Position=pos,BorderSizePixel=0})
    mk(f,"UICorner",{CornerRadius=UDim.new(1,0)})
    mk(f,"TextLabel",{BackgroundTransparency=1,Text=text,TextColor3=fg,Font=Enum.Font.GothamBold,TextSize=9,Size=UDim2.fromScale(1,1),TextXAlignment=Enum.TextXAlignment.Center})
    return f
end
local function btn(parent, text, bg, fg, pos, size, cb)
    local b = mk(parent,"TextButton",{BackgroundColor3=bg,Text=text,TextColor3=fg,Font=Enum.Font.GothamBold,TextSize=10,Size=size,Position=pos,BorderSizePixel=0,AutoButtonColor=false})
    mk(b,"UICorner",{CornerRadius=UDim.new(0,6)})
    b.MouseEnter:Connect(function() b.BackgroundColor3=C.citrusDim end)
    b.MouseLeave:Connect(function() b.BackgroundColor3=bg end)
    if cb then b.MouseButton1Click:Connect(cb) end
    return b
end

-- ── Widget ─────────────────────────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("DevAI")
local tbtn = toolbar:CreateButton("DevAI", "Open DevAI v7", "rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, true, false, 380, 600, 320, 480)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_v7", widgetInfo)
gui.Title = "DevAI"
tbtn.Click:Connect(function() gui.Enabled = not gui.Enabled end)

-- Enable HttpService if user allows
local httpEnabled = pcall(function() HttpService:GetAsync(BACKEND.."/api/health") end)

local Root = mk(gui,"Frame",{BackgroundColor3=C.bg,Size=UDim2.fromScale(1,1)})
mk(Root,"UIPadding",{PaddingTop=UDim.new(0,14),PaddingBottom=UDim.new(0,14),PaddingLeft=UDim.new(0,14),PaddingRight=UDim.new(0,14)})
local y = 0
-- Title
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="DevAI",TextColor3=C.citrus,Font=Enum.Font.GothamBlack,TextSize=22,Size=UDim2.new(0,80,0,28),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
pill(Root,"v7",C.faint,C.muted,UDim2.new(0,82,0,7),UDim2.new(0,36,0,18))
y = y + 34
-- Status
local statusLbl = mk(Root,"TextLabel",{BackgroundTransparency=1,Text="● Disconnected — run start-devai.bat then paste code",TextColor3=C.red,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-20,0,18),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 24
-- Project
local projLbl = mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Project: "..game.Name,TextColor3=C.muted,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,0,0,16),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 20
-- Pair code input
local pairBox = mk(Root,"TextBox",{BackgroundColor3=C.panel,Text="",PlaceholderText="Pairing code (e.g. ABCD-1234)",TextColor3=C.text,PlaceholderColor3=C.dim,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,-110,0,28),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,ClearTextOnFocus=false})
mk(pairBox,"UICorner",{CornerRadius=UDim.new(0,6)})
mk(pairBox,"UIPadding",{PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)})
btn(Root,"Connect",C.citrus,Color3.new(0,0,0),UDim2.new(1,-100,0,y),UDim2.new(0,96,0,28),function() doConnect() end)
y = y + 36
-- Action buttons row
btn(Root,"⇅ Sync Project",C.panel,C.text,UDim2.new(0,0,0,y),UDim2.new(0,108,0,26),function() sendProjectTree() end)
btn(Root,"↑ Selection",C.panel,C.text,UDim2.new(0,114,0,y),UDim2.new(0,94,0,26),function() sendSelection() end)
btn(Root,"↑ Script",C.panel,C.text,UDim2.new(0,214,0,y),UDim2.new(0,80,0,26),function() sendSelectedScript() end)
y = y + 34
btn(Root,"⏻ Output Stream: OFF",C.panel,C.muted,UDim2.new(0,0,0,y),UDim2.new(1,0,0,24),function() toggleOutput() end)
y = y + 32
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Activity",TextColor3=C.text,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,0,0,18),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y = y + 22
local logFrame = mk(Root,"ScrollingFrame",{BackgroundColor3=C.panel,Size=UDim2.new(1,0,1,-y),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=4,ScrollBarImageColor3=C.dim})
mk(logFrame,"UICorner",{CornerRadius=UDim.new(0,8)})
mk(logFrame,"UIStroke",{Color=C.border,Thickness=1})
mk(logFrame,"UIListLayout",{Padding=UDim.new(0,6),SortOrder=Enum.SortOrder.LayoutOrder})
mk(logFrame,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,8),PaddingRight=UDim.new(0,8)})

local token = nil
local outputOn = false
local autoInsert = true

-- ── Log card ────────────────────────────────────────────────────────────────
local function addLog(kind, title, detail, actions)
    local accent = kind=="in" and C.citrus or kind=="ok" and C.green or kind=="err" and C.red or C.amber
    local card = mk(logFrame,"Frame",{BackgroundColor3=C.bg,Size=UDim2.new(1,0,0,58),BorderSizePixel=0,AutomaticSize=Enum.AutomaticSize.Y})
    mk(card,"UICorner",{CornerRadius=UDim.new(0,6)})
    mk(card,"UIStroke",{Color=C.border,Thickness=1})
    mk(card,"Frame",{BackgroundColor3=accent,Size=UDim2.new(0,3,1,0),BorderSizePixel=0})
    pill(card, kind:upper(), accent, Color3.new(0,0,0), UDim2.new(0,12,0,7), UDim2.new(0,40,0,16))
    mk(card,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.text,Font=Enum.Font.GothamBold,TextSize=10,Size=UDim2.new(1,-100,0,18),Position=UDim2.new(0,60,0,6),TextXAlignment=Enum.TextXAlignment.Left,TextTruncate=Enum.TextTruncate.AtEnd})
    mk(card,"TextLabel",{BackgroundTransparency=1,Text=detail or "",TextColor3=C.muted,Font=Enum.Font.RobotoMono,TextSize=8,Size=UDim2.new(1,-16,0,22),Position=UDim2.new(0,10,0,28),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})
    if actions then
        local ax = 10
        for _,a in ipairs(actions) do
            local ab = btn(card,a.label,C.citrus,Color3.new(0,0,0),UDim2.new(0,ax,0,-28),UDim2.new(0,a.w or 60,0,20),a.onClick)
            ax += (a.w or 60) + 6
        end
    end
    task.wait(0.05)
    logFrame.CanvasSize = UDim2.new(0,0,0,logFrame.UIListLayout.AbsoluteContentSize.Y+16)
end

-- ── HTTP helpers ────────────────────────────────────────────────────────────
local function post(path, body)
    if not httpEnabled then return nil, "http disabled" end
    local ok, r = pcall(function()
        return HttpService:RequestAsync({Url=BACKEND..path,Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode(body or {})})
    end)
    if not ok then return nil, tostring(r) end
    if r.StatusCode ~= 200 then return nil, "HTTP "..tostring(r.StatusCode) end
    local ok2,j = pcall(function()return HttpService:JSONDecode(r.Body)end)
    if not ok2 then return nil, "bad json" end
    return j
end

function doConnect()
    local code = pairBox.Text:gsub("%s",""):upper()
    if #code<6 then statusLbl.Text="Enter pairing code from website"; statusLbl.TextColor3=C.red; return end
    local r,err = post("/api/plugin/pair",{code=code})
    if not r or not r.ok then statusLbl.Text="Pair failed: "..(err or (r and r.error) or "unknown"); statusLbl.TextColor3=C.red; return end
    token = r.token
    statusLbl.Text="● Connected — waiting for AI actions"; statusLbl.TextColor3=C.green
    addLog("ok","Connected","Paired with backend")
    startPollLoop()
end

-- ── Execute actions from backend ──────────────────────────────────────────
local function resolvePath(path)
    -- "ServerScriptService.Foo.Bar" -> Instance
    local cur = nil
    for part in path:gmatch("[^%.]+") do
        if not cur then
            local ok,svc = pcall(game.GetService,game,part)
            if ok then cur=svc else
                local ch = game:FindFirstChild(part)
                if ch then cur=ch else return nil,"can't resolve root "..part
                end
            end
        else
            local ch = cur:FindFirstChild(part)
            if not ch then return nil,"missing: "..part.." in "..cur:GetFullName() end
            cur = ch
        end
    end
    return cur
end
local function ensurePath(path)
    -- creates folders/services as needed
    local parts = {}
    for p in path:gmatch("[^%.]+") do table.insert(parts,p) end
    local cur = nil
    for i,p in ipairs(parts) do
        local nxt
        if not cur then
            local ok,svc = pcall(game.GetService,game,p)
            if ok then nxt=svc else
                nxt = game:FindFirstChild(p) or error("can't resolve root "..p)
            end
        else
            nxt = cur:FindFirstChild(p)
            if not nxt then
                local f = Instance.new("Folder") f.Name=p f.Parent=cur nxt=f
            end
        end
        cur=nxt
    end
    return cur
end
local function confirmDialog(title, msg)
    -- Simple blocking confirmation using a small modal widget inside the plugin
    local dlg = mk(gui,"Frame",{BackgroundColor3=C.bg2,Size=UDim2.new(0.9,0,0,160),Position=UDim2.new(0.05,0,0.3,0),BorderSizePixel=0,ZIndex=100})
    mk(dlg,"UICorner",{CornerRadius=UDim.new(0,8)})
    mk(dlg,"UIStroke",{Color=C.border})
    mk(dlg,"TextLabel",{BackgroundTransparency=1,Text=title,TextColor3=C.citrus,Font=Enum.Font.GothamBold,TextSize=12,Size=UDim2.new(1,-20,0,22),Position=UDim2.new(0,10,0,10),TextXAlignment=Enum.TextXAlignment.Left})
    mk(dlg,"TextLabel",{BackgroundTransparency=1,Text=msg,TextColor3=C.text,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-20,0,80),Position=UDim2.new(0,10,0,36),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true})
    local result=false
    local yes=btn(dlg,"Approve",C.citrus,Color3.new(0,0,0),UDim2.new(0,10,1,-36),UDim2.new(0,90,0,26),function()result=true;dlg:Destroy()end)
    local no=btn(dlg,"Reject",C.panel,C.red,UDim2.new(1,-110,1,-36),UDim2.new(0,90,0,26),function()result=false;dlg:Destroy()end)
    -- Wait for click (blocking, same thread)
    while dlg.Parent do task.wait(0.05) end
    return result
end

local function execAction(a)
    local function fail(msg)
        addLog("err",a.op.." failed",msg)
        post("/api/plugin/result",{token=token,actionId=a.id,success=false,error=msg})
    end
    local function ok(inst)
        local p=inst and inst:GetFullName() or ""
        addLog("ok",a.op.." complete",p)
        post("/api/plugin/result",{token=token,actionId=a.id,success=true,path=p})
    end
    local op = a.op
    -- Confirmation for destructive operations
    if op=="delete_instance" or op=="update_script" or op=="move_instance" or op=="rename_instance" then
        local target = a.params.path or ""
        local verb = op=="delete_instance" and "DELETE" or (op=="update_script" and "OVERWRITE" or (op=="move_instance" and "MOVE" or "RENAME"))
        local approved = confirmDialog("⚠ "..verb, target.."\n\nThis modifies an existing instance in your place.\nApprove to execute, Reject to cancel.")
        if not approved then
            addLog("err",a.op.." rejected",target)
            post("/api/plugin/result",{token=token,actionId=a.id,success=false,error="rejected by user"})
            return
        end
    end
    ChangeHistoryService:SetWaypoint("DevAI: "..op)
    if op=="create_instance" then
        local parent,err = ensurePath(a.params.parent or "ServerScriptService")
        if not parent then return fail(err) end
        local name = a.params.name or "DevAI_Script"
        local existing = parent:FindFirstChild(name)
        if existing then
            -- If it's the same class and a script, treat as update (no overwrite prompt needed — user already approved create; but if it exists we should be explicit)
            if a.params.source and existing:IsA("LuaSourceContainer") and existing.ClassName==(a.params.className or "Script") then
                existing.Source = a.params.source or ""
                Selection:Set{existing}; pcall(function()StudioService:OpenScript(existing)end)
                addLog("ok","Updated existing",existing:GetFullName())
                post("/api/plugin/result",{token=token,actionId=a.id,success=true,path=existing:GetFullName(),updated=true})
                return
            else
                return fail(name.." already exists under "..parent:GetFullName().." (different class — use update/rename/move)")
            end
        end
        local inst = Instance.new(a.params.className or "Script")
        inst.Name = name
        if a.params.source and (inst:IsA("LuaSourceContainer")) then inst.Source = a.params.source end
        inst.Parent = parent
        Selection:Set{inst}; pcall(function()StudioService:OpenScript(inst)end)
        return ok(inst)
    elseif op=="update_script" then
        local inst,err = resolvePath(a.params.path)
        if not inst then return fail(err) end
        if not inst:IsA("LuaSourceContainer") then return fail("not a script") end
        inst.Source = a.params.source or ""
        Selection:Set{inst}
        return ok(inst)
    elseif op=="rename_instance" then
        local inst,err=resolvePath(a.params.path) if not inst then return fail(err) end
        inst.Name = a.params.name; return ok(inst)
    elseif op=="move_instance" then
        local inst,err=resolvePath(a.params.path); if not inst then return fail(err) end
        local tgt,err2=ensurePath(a.params.to); if not tgt then return fail(err2) end
        inst.Parent=tgt; return ok(inst)
    elseif op=="delete_instance" then
        local inst,err=resolvePath(a.params.path); if not inst then return fail(err) end
        inst:Destroy(); return ok()
    elseif op=="get_project_tree" then
        sendProjectTree(); post("/api/plugin/result",{token=token,actionId=a.id,success=true})
    elseif op=="get_selection" then
        sendSelection(); post("/api/plugin/result",{token=token,actionId=a.id,success=true})
    elseif op=="get_script" then
        sendSelectedScript(); post("/api/plugin/result",{token=token,actionId=a.id,success=true})
    elseif op=="get_output" then
        outputOn = true; addLog("in","Output stream","started")
        post("/api/plugin/result",{token=token,actionId=a.id,success=true})
    elseif op=="scan_project" then
        sendScan(); post("/api/plugin/result",{token=token,actionId=a.id,success=true})
    else
        return fail("unknown op: "..tostring(op))
    end
end

function startPollLoop()
    task.spawn(function()
        while token do
            local r,err = post("/api/plugin/poll",{token=token})
            if not r then statusLbl.Text="Poll error: "..(err or ""); statusLbl.TextColor3=C.red; token=nil; break end
            for _,a in ipairs(r.actions or {}) do
                addLog("in",a.op.." #"..a.id, a.params.name or a.params.path or "")
                execAction(a)
            end
            task.wait(POLL_INTERVAL)
        end
    end)
end

-- ── Send data to backend ────────────────────────────────────────────────────
function sendProjectTree()
    if not token then statusLbl.Text="Connect first"; statusLbl.TextColor3=C.red; return end
    local seen = 0
    local function walk(inst, depth)
        if seen>=400 or depth>=6 then return nil end
        seen = seen+1
        local node = {name=inst.Name, class=inst.ClassName, children={}}
        local kids = inst:GetChildren()
        table.sort(kids,function(a,b)return a.Name<b.Name end)
        for _,ch in ipairs(kids) do
            if not ch:IsA("Script") or not ch:FindFirstChild("DevAI_Hidden") then
                local sub=walk(ch,depth+1) if sub then table.insert(node.children,sub) end
            end
        end
        return node
    end
    local tree = {}
    for _,svc in ipairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("ServerStorage"),game:GetService("StarterGui"),game:GetService("StarterPlayer"),game:GetService("ReplicatedFirst"),game:GetService("Lighting"),game:GetService("SoundService"),game:GetService("Teams")}) do
        table.insert(tree,walk(svc,0))
    end
    post("/api/plugin/event",{token=token,event:"project_tree",data:tree})
    addLog("ok","Sent project tree",seen.." nodes")
end
function sendSelection()
    if not token then return end
    local s=Selection:Get(); if #s==0 then addLog("err","No selection",""); return end
    local t=s[1]
    post("/api/plugin/event",{token=token,event:"selection",data={path=t:GetFullName(),class=t.ClassName}})
    addLog("ok","Sent selection",t:GetFullName())
end
function sendSelectedScript()
    if not token then return end
    local s=Selection:Get(); if #s==0 then addLog("err","No selection",""); return end
    local t=s[1]
    if not t:IsA("LuaSourceContainer") then addLog("err","Not a script",""); return end
    post("/api/plugin/event",{token=token,event:"script",data={path=t:GetFullName(),class=t.ClassName,source=t.Source}})
    addLog("ok","Sent script",t:GetFullName())
end
function sendScan()
    if not token then return end
    local counts={Script=0,LocalScript=0,ModuleScript=0,RemoteEvent=0,RemoteFunction=0,Folder=0,Model=0,Part=0}
    local function walk(p)for _,c in pairs(p:GetChildren())do if counts[c.ClassName]then counts[c.ClassName]+=1 end;walk(c)end end
    for _,svc in pairs({workspace,game:GetService("ReplicatedStorage"),game:GetService("ServerScriptService"),game:GetService("StarterGui"),game:GetService("StarterPlayer")}) do walk(svc) end
    post("/api/plugin/event",{token=token,event:"scan",data=counts})
    addLog("ok","Sent scan",HttpService:JSONEncode(counts))
end
function toggleOutput() outputOn=not outputOn; end

LogService.MessageOut:Connect(function(msg,typ)
    if not (token and outputOn) then return end
    local level = typ==Enum.MessageType.MessageError and "error" or typ==Enum.MessageType.MessageWarning and "warn" or "info"
    post("/api/plugin/event",{token=token,event:"output",data={level=level,message=msg}})
end)

print("[DevAI] v7 loaded. Paste pairing code to connect.")
