-- =============================================================================
-- DevAI v4.0 — Lemonade-style Studio Plugin via localhost bridge
-- Requires DevAI Bridge (bridge.py) running on http://127.0.0.1:42069/
-- (Started by install-devai.bat — just double-click start-devai.bat)
-- =============================================================================

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local StudioService = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local BRIDGE_URL = "http://127.0.0.1:42069"

-- Plugin toolbar
local toolbar = plugin:CreateToolbar("DevAI")
local button = toolbar:CreateButton("DevAI", "Open DevAI AI Co-Developer", "rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, true, false, 420, 500, 320, 380)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_v4", widgetInfo)
gui.Title = "DevAI v4.0"

button.Click:Connect(function() gui.Enabled = not gui.Enabled end)

-- Colors
local C = {
	bg=Color3.fromHex("#14100c"); panel=Color3.fromHex("#231a12");
	border=Color3.fromHex("#4a3520"); gold=Color3.fromHex("#c99a3e"); goldLight=Color3.fromHex("#ebbf5b");
	moss=Color3.fromHex("#4d7a35"); red=Color3.fromHex("#c0392b"); amber=Color3.fromHex("#ff9f2c");
	text=Color3.fromHex("#eadfc5"); dim=Color3.fromHex("#a69470"); faint=Color3.fromHex("#726144");
}

local function mk(parent, class, props)
	local el = Instance.new(class)
	for k,v in pairs(props or {}) do el[k]=v end
	el.Parent = parent
	return el
end

local Root = mk(gui, "Frame", {BackgroundColor3=C.bg, Size=UDim2.fromScale(1,1)})
mk(Root,"UIPadding",{PaddingTop=UDim.new(0,12),PaddingBottom=UDim.new(0,12),PaddingLeft=UDim.new(0,12),PaddingRight=UDim.new(0,12)})

local y=0
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="\226\156\148 DevAI",TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack,TextSize=22,Size=UDim2.new(1,0,0,30),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+32
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="AI Co-Developer for Roblox Studio",TextColor3=C.dim,
	Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,16),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+24

-- Status card
local statusCard = mk(Root,"Frame",{BackgroundColor3=C.panel,Size=UDim2.new(1,0,0,72),Position=UDim2.new(0,0,0,y),BorderSizePixel=0})
mk(statusCard,"UICorner",{CornerRadius=UDim.new(0,8)})
mk(statusCard,"UIStroke",{Color=C.border,Thickness=1})
local statusLbl = mk(statusCard,"TextLabel",{BackgroundTransparency=1,Text="Connecting to DevAI Bridge...",TextColor3=C.amber,
	Font=Enum.Font.GothamBold,TextSize=12,Size=UDim2.new(1,-24,0,22),Position=UDim2.new(0,12,0,10),TextXAlignment=Enum.TextXAlignment.Left})
local statusSub = mk(statusCard,"TextLabel",{BackgroundTransparency=1,Text="Make sure start-devai.bat is running (it opens automatically).",
	TextColor3=C.dim,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-24,0,36),Position=UDim2.new(0,12,0,32),
	TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true})
local openSiteBtn = mk(statusCard,"TextButton",{Text="Open DevAI website",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBold,
	TextSize=10,Size=UDim2.new(0,120,0,22),Position=UDim2.new(1,-132,0,44),
	BackgroundColor3=C.gold,AutoButtonColor=true,BorderSizePixel=0})
mk(openSiteBtn,"UICorner",{CornerRadius=UDim.new(0,4)})
y=y+82

-- Action buttons
local btnRow = mk(Root,"Frame",{BackgroundTransparency=1,Size=UDim2.new(1,0,0,34),Position=UDim2.new(0,0,0,y)})
local sendExpl = mk(btnRow,"TextButton",{Text="\239\176\130 Send Explorer",TextColor3=C.text,Font=Enum.Font.GothamBold,
	TextSize=10,Size=UDim2.new(0.5,-4,0,30),Position=UDim2.new(0,0,0,0),BackgroundColor3=C.panel,AutoButtonColor=true,BorderSizePixel=0})
mk(sendExpl,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(sendExpl,"UIStroke",{Color=C.border,Thickness=1})
local sendSel = mk(btnRow,"TextButton",{Text="\239\176\130 Send Selected Script",TextColor3=C.text,Font=Enum.Font.GothamBold,
	TextSize=10,Size=UDim2.new(0.5,-4,0,30),Position=UDim2.new(0.5,4,0,0),BackgroundColor3=C.panel,AutoButtonColor=true,BorderSizePixel=0})
mk(sendSel,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(sendSel,"UIStroke",{Color=C.border,Thickness=1})
y=y+42

-- Auto-insert toggle
local autoInsert = true
local autoCb = mk(Root,"TextButton",{Text="\226\156\147",TextColor3=C.moss,Font=Enum.Font.GothamBold,TextSize=12,
	BackgroundColor3=C.panel,Size=UDim2.new(0,20,0,20),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,AutoButtonColor=true})
mk(autoCb,"UICorner",{CornerRadius=UDim.new(0,4)}); mk(autoCb,"UIStroke",{Color=C.border,Thickness=1})
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Auto-insert scripts into Explorer when received",
	TextColor3=C.dim,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-30,0,20),Position=UDim2.new(0,26,0,y),TextXAlignment=Enum.TextXAlignment.Left})
autoCb.MouseButton1Click:Connect(function()
	autoInsert = not autoInsert
	autoCb.Text = autoInsert and "\226\156\147" or "\226\156\155"
	autoCb.TextColor3 = autoInsert and C.moss or C.dim
end)
y=y+28

-- Log
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Activity log:",TextColor3=C.goldLight,
	Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,0,0,18),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+22
local logFrame = mk(Root,"ScrollingFrame",{BackgroundColor3=C.panel,Size=UDim2.new(1,0,1,-y),Position=UDim2.new(0,0,0,y),
	BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=6})
mk(logFrame,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(logFrame,"UIStroke",{Color=C.border,Thickness=1})
local logLayout = mk(logFrame,"UIListLayout",{Padding=UDim.new(0,6),SortOrder=Enum.SortOrder.LayoutOrder})
local logPad = mk(logFrame,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,8),PaddingRight=UDim.new(0,8)})

-- Explorer snapshot
local function buildExplorerSnapshot()
	local lines = {}
	local seen = 0
	local MAX = 300
	local function walk(obj, depth)
		if seen >= MAX then return end
		seen = seen+1
		local indent = string.rep("  ", depth)
		local line = indent.."- "..obj.Name.." ["..obj.ClassName.."]"
		if obj:IsA("BaseScript") or obj:IsA("ModuleScript") then
			line = line.." ("..#obj.Source.." chars)"
		end
		table.insert(lines, line)
		if depth >= 5 then return end
		local ok, children = pcall(obj.GetChildren, obj)
		if ok then
			for _,ch in ipairs(children) do
				walk(ch, depth+1)
				if seen >= MAX then return end
			end
		end
	end
	local topServices = {"Workspace","ReplicatedStorage","ServerScriptService","StarterPlayer",
		"StarterPack","ReplicatedFirst","ServerStorage","StarterGui","SoundService",
		"Lighting","Players","Teams","Chat","TestService"}
	table.insert(lines,"# DevAI Explorer Snapshot")
	table.insert(lines,"# PlaceId = "..tostring(game.PlaceId))
	table.insert(lines,"")
	for _,svcName in ipairs(topServices) do
		local ok,svc = pcall(game.GetService, game, svcName)
		if ok and svc then walk(svc, 0) end
	end
	return table.concat(lines,"\n")
end

local function postBridge(path, data)
	local ok, resp = pcall(function()
		local body = HttpService:JSONEncode(data)
		return HttpService:PostAsync(BRIDGE_URL..path, body, Enum.HttpContentType.ApplicationJson)
	end)
	return ok, resp
end

local function getBridge(path)
	local ok, resp = pcall(function()
		return HttpService:GetAsync(BRIDGE_URL..path, true)
	end)
	if ok and resp then
		local okJ, obj = pcall(HttpService.JSONDecode, HttpService, resp)
		if okJ then return true, obj end
	end
	return false, nil
end

local function addLog(dir, title, body)
	local card = mk(logFrame,"Frame",{BackgroundColor3=C.bg,Size=UDim2.new(1,0,0,60),BorderSizePixel=0,AutomaticSize=Enum.AutomaticSize.Y})
	mk(card,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(card,"UIStroke",{Color=C.border,Thickness=1})
	local badgeColor = dir=="in" and C.moss or C.amber
	mk(card,"TextLabel",{BackgroundTransparency=1,Text=(dir=="in" and "\239\153\133 IN  " or "\239\153\133 OUT ")..title,
		TextColor3=badgeColor,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,-90,0,22),Position=UDim2.new(0,8,0,6),TextXAlignment=Enum.TextXAlignment.Left})
	local insertBtn
	if dir=="in" then
		insertBtn = mk(card,"TextButton",{Text="\239\156\145 Insert into Studio",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBold,
			TextSize=10,Size=UDim2.new(0,130,0,22),Position=UDim2.new(1,-138,0,6),BackgroundColor3=C.gold,AutoButtonColor=true,BorderSizePixel=0})
		mk(insertBtn,"UICorner",{CornerRadius=UDim.new(0,4)})
	end
	local preview = body or ""
	mk(card,"TextLabel",{BackgroundTransparency=1,Text=preview:sub(1,180)..(#preview>180 and "\n..." or ""),
		TextColor3=C.text,Font=Enum.Font.RobotoMono,TextSize=9,Size=UDim2.new(1,-16,0,30),Position=UDim2.new(0,8,0,30),
		TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})
	if dir=="in" and insertBtn then
		insertBtn.MouseButton1Click:Connect(function()
			local parts = {}
			for p in string.gmatch(title or "", "[^|]+") do table.insert(parts, p) end
			local stype = parts[2] or "Script"
			local target = parts[3]
			local code = body
			local className = stype=="LocalScript" and "LocalScript" or stype=="ModuleScript" and "ModuleScript" or "Script"
			local parent
			if target then
				for part in string.gmatch(target,"[^%.]+") do
					local okS,svc = pcall(game.GetService, game, part)
					if okS and not parent then parent=svc
					elseif parent then local c=parent:FindFirstChild(part); if c then parent=c end end
				end
			end
			if not parent then
				if className=="LocalScript" then parent=game:GetService("StarterPlayerScripts")
				elseif className=="ModuleScript" then parent=game:GetService("ReplicatedStorage")
				else parent=game:GetService("ServerScriptService") end
			end
			local s = Instance.new(className)
			s.Name = (parts[1] or "DevAI_Script"):gsub("[^%w_ ]","_"):sub(1,40)
			s.Source = code
			s.Parent = parent
			ChangeHistoryService:SetWaypoint("DevAI: "..s.Name)
			Selection:Set({s})
			pcall(function() StudioService:OpenScript(s) end)
			insertBtn.Text="\226\156\147 Inserted in "..parent.Name
			insertBtn.BackgroundColor3=C.moss
			statusLbl.Text="\239\156\147 Inserted '"..s.Name.."' into "..parent:GetFullName()
			statusLbl.TextColor3=C.moss
		end)
		if autoInsert then task.delay(0.3, function() insertBtn:Activate() end) end
	end
end

openSiteBtn.MouseButton1Click:Connect(function()
	-- Open website via StudioService:OpenScript can't open URLs, so we open it via shell - plugin can't do that.
	-- Best we can do: tell user the bridge URL; post hello to bridge which triggers auto-open via Python
	postBridge("/send-web", {kind="ping", from="studio", data="Plugin is ready. Waiting for you to open the DevAI website.", time=os.time()})
	statusLbl.Text = "Open https://enestrupi.github.io/DevAI in your browser"
	statusLbl.TextColor3 = C.goldLight
end)

sendExpl.MouseButton1Click:Connect(function()
	postBridge("/send-web", {kind="explorer", data=buildExplorerSnapshot(), time=os.time()})
	addLog("out","Explorer snapshot","(project tree sent)")
end)

sendSel.MouseButton1Click:Connect(function()
	local sel = Selection:Get()
	if #sel==0 then statusLbl.Text="Select a script first"; statusLbl.TextColor3=C.red; return end
	local t = sel[1]
	if not (t:IsA("BaseScript") or t:IsA("ModuleScript")) then
		statusLbl.Text="Selection is not a script"; statusLbl.TextColor3=C.red; return
	end
	postBridge("/send-web", {kind="script", name=t.Name, class=t.ClassName, path=t:GetFullName(),
		data="-- Script: "..t:GetFullName().." ["..t.ClassName.."]\n\n"..t.Source, time=os.time()})
	addLog("out","Sent: "..t.Name, t.Source:sub(1,100))
end)

-- Polling loop
task.spawn(function()
	local connected = false
	while true do
		local ok, resp = getBridge("/status")
		if ok and resp.ok then
			if not connected then
				statusLbl.Text = "\226\156\148 Connected to DevAI Bridge"
				statusLbl.TextColor3 = C.moss
				statusSub.Text = "Send scripts from website, they auto-insert here. Use buttons above to send project data to AI."
				connected = true
				-- Announce
				postBridge("/send-web", {kind="hello", data="Plugin connected. PlaceId="..tostring(game.PlaceId), time=os.time()})
			end
			-- Poll for incoming scripts
			local okP, poll = getBridge("/poll-studio")
			if okP and poll.messages then
				for _,m in ipairs(poll.messages) do
					if m.code then
						local titleKey = (m.title or "DevAI Script").."|"..(m.type or "Script").."|"..(m.target or "")
						addLog("in", titleKey, m.code)
					end
				end
			end
		else
			if connected then
				statusLbl.Text = "\226\156\152 Bridge not running"
				statusLbl.TextColor3 = C.red
				statusSub.Text = "Double-click start-devai.bat to start the bridge, then reload the website."
				connected = false
			end
		end
		task.wait(1)
	end
end)

print("[DevAI] v4.0 loaded.")
