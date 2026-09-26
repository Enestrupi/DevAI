-- =============================================================================
-- DevAI v3.0 — Full Studio Bridge
-- - Connects to website via ntfy.sh pub/sub (free, no signup)
-- - Website sends scripts -> plugin inserts them directly into Explorer
-- - Plugin can READ your Explorer tree + selected script source and send TO AI
-- =============================================================================

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local StudioService = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

-- Plugin toolbar
local toolbar = plugin:CreateToolbar("DevAI")
local button = toolbar:CreateButton("DevAI", "Open DevAI AI Co-Developer", "rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, true, false, 540, 620, 360, 400)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_v3", widgetInfo)
gui.Title = "DevAI v3.0 — Studio ↔ Website"

button.Click:Connect(function() gui.Enabled = not gui.Enabled end)

-- Colors
local C = {
	bg=Color3.fromHex("#14100c"); bg2=Color3.fromHex("#1c1610"); panel=Color3.fromHex("#231a12");
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

local Root = mk(gui, "Frame", {BackgroundColor3=C.bg, Size=UDim2.fromScale(1,1), ClipsDescendants=true})
mk(Root,"UIPadding",{PaddingTop=UDim.new(0,10),PaddingBottom=UDim.new(0,10),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)})

local y=0
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="⚔ DevAI Studio Bridge",TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack,TextSize=18,Size=UDim2.new(1,0,0,28),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+30
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Paste the 6-char code from the website (Studio Sync tab) and connect.",
	TextColor3=C.dim,Font=Enum.Font.Gotham,TextSize=11,Size=UDim2.new(1,0,0,18),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+24

-- Session row
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Code:",TextColor3=C.text,Font=Enum.Font.GothamBold,
	TextSize=12,Size=UDim2.new(0,45,0,28),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
local codeBox = mk(Root,"TextBox",{
	BackgroundColor3=C.panel,TextColor3=C.goldLight,PlaceholderText="XXXXXX",
	PlaceholderColor3=C.faint,Font=Enum.Font.RobotoMono,TextSize=16,Text=plugin:GetSetting("DevAI_SessionCode") or "",
	Size=UDim2.new(0,130,0,28),Position=UDim2.new(0,45,0,y),ClearTextOnFocus=false,BorderSizePixel=0,
	TextXAlignment=Enum.TextXAlignment.Center,
})
mk(codeBox,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(codeBox,"UIStroke",{Color=C.border,Thickness=1})
local connectBtn = mk(Root,"TextButton",{Text="🔌 Connect",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBlack,
	TextSize=12,Size=UDim2.new(0,100,0,28),Position=UDim2.new(0,185,0,y),BackgroundColor3=C.moss,AutoButtonColor=true,BorderSizePixel=0})
mk(connectBtn,"UICorner",{CornerRadius=UDim.new(0,6)})

-- Send-to-AI buttons (send project context to website)
local sendExplorerBtn = mk(Root,"TextButton",{Text="📂 Send Explorer to AI",TextColor3=C.text,Font=Enum.Font.GothamBold,
	TextSize=10,Size=UDim2.new(0,145,0,28),Position=UDim2.new(1,-305,0,y),BackgroundColor3=C.bg2,AutoButtonColor=true,BorderSizePixel=0})
mk(sendExplorerBtn,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(sendExplorerBtn,"UIStroke",{Color=C.border,Thickness=1})
local sendSelBtn = mk(Root,"TextButton",{Text="📄 Send Selected Script",TextColor3=C.text,Font=Enum.Font.GothamBold,
	TextSize=10,Size=UDim2.new(0,150,0,28),Position=UDim2.new(1,-155,0,y),BackgroundColor3=C.bg2,AutoButtonColor=true,BorderSizePixel=0})
mk(sendSelBtn,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(sendSelBtn,"UIStroke",{Color=C.border,Thickness=1})

y=y+34

-- Status
local statusLbl = mk(Root,"TextLabel",{BackgroundTransparency=1,Text="⚪ Not connected.",TextColor3=C.dim,
	Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,0,0,20),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true})
y=y+26

-- Auto-paste toggle
local autoInsertCb = mk(Root,"TextButton",{Text="☑",TextColor3=C.moss,Font=Enum.Font.GothamBold,TextSize=12,
	BackgroundColor3=C.bg2,Size=UDim2.new(0,20,0,20),Position=UDim2.new(0,0,0,y),BorderSizePixel=0,AutoButtonColor=true})
mk(autoInsertCb,"UICorner",{CornerRadius=UDim.new(0,4)}); mk(autoInsertCb,"UIStroke",{Color=C.border,Thickness=1})
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="Auto-insert scripts when they arrive (and open in editor)",
	TextColor3=C.dim,Font=Enum.Font.Gotham,TextSize=10,Size=UDim2.new(1,-30,0,20),Position=UDim2.new(0,26,0,y),TextXAlignment=Enum.TextXAlignment.Left})
local autoInsert = true

autoInsertCb.MouseButton1Click:Connect(function()
	autoInsert = not autoInsert
	autoInsertCb.Text = autoInsert and "☑" or "☐"
	autoInsertCb.TextColor3 = autoInsert and C.moss or C.dim
end)
y=y+28

-- Log
mk(Root,"TextLabel",{BackgroundTransparency=1,Text="📨 Received / sent scripts:",TextColor3=C.goldLight,
	Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,0,0,18),Position=UDim2.new(0,0,0,y),TextXAlignment=Enum.TextXAlignment.Left})
y=y+22
local logFrame = mk(Root,"ScrollingFrame",{BackgroundColor3=C.panel,Size=UDim2.new(1,0,1,-y),Position=UDim2.new(0,0,0,y),
	BorderSizePixel=0,CanvasSize=UDim2.fromScale(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=6})
mk(logFrame,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(logFrame,"UIStroke",{Color=C.border,Thickness=1})
local logLayout = mk(logFrame,"UIListLayout",{Padding=UDim.new(0,6),SortOrder=Enum.SortOrder.LayoutOrder})
local logPad = mk(logFrame,"UIPadding",{PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,8),PaddingRight=UDim.new(0,8)})

-- STATE
local connected = false
local pollTask = nil
local sessionCode = codeBox.Text
local topic = ""
local lastTs = 0

local function setStatus(text, color)
	statusLbl.Text = text
	statusLbl.TextColor3 = color or C.dim
	print("[DevAI] "..text)
end

-- Build Explorer tree summary (bounded to avoid huge payloads)
local function buildExplorerSnapshot()
	local lines = {}
	local seen = 0
	local MAX = 400
	local function walk(obj, depth)
		if seen >= MAX then return end
		seen = seen+1
		local indent = string.rep("  ", depth)
		local class = obj.ClassName
		local line = indent.."- "..obj.Name.." ["..class.."]"
		if obj:IsA("BaseScript") then
			local src = obj.Source
			line = line.." ("..#src.." chars)"
		end
		table.insert(lines, line)
		if depth >= 6 then return end
		-- Only recurse into services/folders/containers
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
	table.insert(lines,"# game.PlaceId = "..tostring(game.PlaceId))
	table.insert(lines,"# game.JobId = "..tostring(game.JobId))
	table.insert(lines,"")
	for _,svcName in ipairs(topServices) do
		local ok,svc = pcall(game.GetService, game, svcName)
		if ok and svc then walk(svc, 0) end
	end
	return table.concat(lines,"\n")
end

-- Send a message to the website (reverse direction)
local function postToWebsite(payload)
	if not connected or topic == "" then setStatus("⚠ Not connected.", C.red); return false end
	local body = HttpService:JSONEncode(payload)
	if #body > 3500 then
		-- Truncate long explorer snapshots
		payload.data = payload.data:sub(1,3200).."\n... (truncated, too long for push)"
		body = HttpService:JSONEncode(payload)
	end
	local ok, err = pcall(function()
		return HttpService:PostAsync("https://ntfy.sh/"..topic, body, Enum.HttpContentType.ApplicationJson, false,
			{["Title"]="DevAI:"..payload.kind, ["Tags"]="robot,outbox"})
	end)
	if ok then setStatus("📤 Sent "..payload.kind.." to website.", C.moss); return true
	else setStatus("❌ Send failed: "..tostring(err), C.red); return false end
end

-- Add a log entry (incoming or outgoing)
local function addLog(direction, title, body, stype, target)
	local card = mk(logFrame,"Frame",{BackgroundColor3=C.bg2,Size=UDim2.new(1,0,0,72),BorderSizePixel=0,AutomaticSize=Enum.AutomaticSize.Y})
	mk(card,"UICorner",{CornerRadius=UDim.new(0,6)}); mk(card,"UIStroke",{Color=C.border,Thickness=1})
	local badgeColor = direction=="in" and C.moss or C.amber
	mk(card,"TextLabel",{BackgroundTransparency=1,Text=(direction=="in" and "📥 IN  " or "📤 OUT ")..title,
		TextColor3=badgeColor,Font=Enum.Font.GothamBold,TextSize=11,Size=UDim2.new(1,-90,0,22),Position=UDim2.new(0,8,0,6),TextXAlignment=Enum.TextXAlignment.Left})
	local insertBtn
	if direction=="in" then
		insertBtn = mk(card,"TextButton",{Text="📥 Paste into Studio",TextColor3=Color3.new(0,0,0),Font=Enum.Font.GothamBold,
			TextSize=10,Size=UDim2.new(0,130,0,22),Position=UDim2.new(1,-138,0,6),BackgroundColor3=C.gold,AutoButtonColor=true,BorderSizePixel=0})
		mk(insertBtn,"UICorner",{CornerRadius=UDim.new(0,4)})
	end
	local preview = body or ""
	mk(card,"TextLabel",{BackgroundTransparency=1,Text=preview:sub(1,200)..(#preview>200 and "\n..." or ""),
		TextColor3=C.text,Font=Enum.Font.RobotoMono,TextSize=9,Size=UDim2.new(1,-16,0,40),Position=UDim2.new(0,8,0,30),
		TextXAlignment=Enum.TextXAlignment.Left,TextWrapped=true,AutomaticSize=Enum.AutomaticSize.Y})

	if direction=="in" and insertBtn then
		insertBtn.MouseButton1Click:Connect(function()
			local parent
			local className = stype=="LocalScript" and "LocalScript" or stype=="ModuleScript" and "ModuleScript" or "Script"
			if target and target~="" then
				local found = false
				for part in string.gmatch(target,"[^%.]+") do
					local ok,svc = pcall(game.GetService, game, part)
					if ok then parent=svc; found=true; break end
				end
				if not found then
					for part in string.gmatch(target,"[^%.]+") do
						local child = parent and parent:FindFirstChild(part) or nil
						if child then parent=child; found=true end
					end
				end
				if not found then parent=nil end
			end
			if not parent then
				if className=="LocalScript" then parent=game:GetService("StarterPlayerScripts")
				elseif className=="ModuleScript" then parent=game:GetService("ReplicatedStorage")
				else parent=game:GetService("ServerScriptService") end
			end
			local s = Instance.new(className)
			s.Name = (title or "DevAI_Script"):gsub("[^%w_ ]","_"):sub(1,40)
			s.Source = body or ""
			s.Parent = parent
			ChangeHistoryService:SetWaypoint("DevAI paste: "..s.Name)
			Selection:Set({s})
			pcall(function() StudioService:OpenScript(s) end)
			insertBtn.Text="✅ Pasted into "..parent.Name
			insertBtn.BackgroundColor3=C.moss
			setStatus("📥 Pasted '"..s.Name.."' into "..parent:GetFullName(), C.moss)
		end)
		-- Auto-insert if enabled
		if autoInsert then
			task.delay(0.3, function() insertBtn:Activate() end)
		end
	end
end

-- Insert a script directly (called from polling)
local function insertScript(title, body, stype, target)
	addLog("in", title, body, stype, target)
	-- Also copy to clipboard as backup
	pcall(function() setclipboard(body or "") end)
end

-- Polling loop
local function stopPolling()
	if pollTask then task.cancel(pollTask); pollTask=nil end
	connected=false
	connectBtn.Text="🔌 Connect"
	connectBtn.BackgroundColor3=C.moss
end

local function startPolling(code)
	stopPolling()
	code = string.upper(string.gsub(code,"%s",""))
	codeBox.Text=code
	sessionCode=code
	plugin:SetSetting("DevAI_SessionCode", code)
	topic = "devai-"..string.lower(code)
	lastTs = math.floor(os.time())
	connected=true
	connectBtn.Text="⏹ Disconnect"
	connectBtn.BackgroundColor3=C.red
	setStatus("🟢 Connected to session "..code..". Waiting for scripts...", C.moss)

	-- Announce plugin is online
	postToWebsite({kind="hello", from="studio", data="Plugin connected. PlaceId="..tostring(game.PlaceId), time=lastTs})

	pollTask = task.spawn(function()
		while connected do
			local url = "https://ntfy.sh/"..topic.."/json?since="..lastTs.."&poll=1"
			local ok, resp = pcall(function()
				return HttpService:GetAsync(url, true)
			end)
			if ok and resp then
				for line in string.gmatch(resp,"[^\n]+") do
					if #line > 10 then
						local okJ, evt = pcall(HttpService.JSONDecode, HttpService, line)
						if okJ and evt and evt.message then
							local evtTime = tonumber(evt.time) or 0
							if evtTime > lastTs then lastTs=evtTime end
							-- Skip our own outgoing messages (we can tell by tags)
							local tags = evt.tags or ""
							if not tags:find("outbox") then
								-- Parse message: TITLE|TYPE|TARGET|BODY
								local parts = {}
								for p in string.gmatch(evt.message,"[^|]+") do table.insert(parts,p) end
								if #parts >= 4 then
									local title = parts[1]
									local stype = parts[2]
									local target = parts[3]
									local body = table.concat(parts,"|",4)
									insertScript(title, body, stype, target)
									setStatus("📨 Received: "..title, C.goldLight)
								else
									insertScript("DevAI Script", evt.message, "Script", "ServerScriptService")
								end
							end
						end
					end
				end
			end
			task.wait(2)
		end
	end)
end

connectBtn.MouseButton1Click:Connect(function()
	if connected then stopPolling(); setStatus("⚪ Disconnected.", C.dim)
	else startPolling(codeBox.Text) end
end)

sendExplorerBtn.MouseButton1Click:Connect(function()
	if not connected then setStatus("⚠ Connect first.", C.red); return end
	postToWebsite({kind="explorer", from="studio", data=buildExplorerSnapshot(), time=os.time()})
	addLog("out","Explorer snapshot sent","(your workspace tree sent to AI so it knows your project)","")
end)

sendSelBtn.MouseButton1Click:Connect(function()
	if not connected then setStatus("⚠ Connect first.", C.red); return end
	local sel = Selection:Get()
	if #sel == 0 then setStatus("⚠ Select a Script/LocalScript/ModuleScript first.", C.red); return end
	local target = sel[1]
	if not (target:IsA("BaseScript") or target:IsA("ModuleScript")) then
		setStatus("⚠ Selection is not a script (got "..target.ClassName..").", C.red); return
	end
	local data = "-- Script: "..target:GetFullName().." ["..target.ClassName.."]\n\n"..target.Source
	postToWebsite({kind="script", from="studio", name=target.Name, class=target.ClassName,
		path=target:GetFullName(), data=data, time=os.time()})
	addLog("out","Sent: "..target.Name,data:sub(1,200),target.ClassName)
end)

print("[DevAI] v3.0 loaded.")
