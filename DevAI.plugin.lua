-- =============================================================================
-- DevAI v2.0 — Minimal Roblox Studio bridge for DevAI web app
-- Install: put this file in %LOCALAPPDATA%\Roblox\Plugins\ and restart Studio.
-- =============================================================================

-- Services
local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local StudioService = game:GetService("StudioService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

-- Enable HTTP if off (one-time prompt)
local function enableHttp()
	local ok = pcall(function()
		return HttpService:GetAsync("https://example.com")
	end)
	if not ok then
		warn("[DevAI] 🔴 HttpService is OFF. Enable it in Game Settings → Security → 'Allow HTTP Requests' then restart the plugin.")
	end
end
task.delay(1, enableHttp)

-- Persistent session code
local SESSION_KEY = "DevAI_SessionCode"
local sessionCode = plugin:GetSetting(SESSION_KEY) or ""

-- Plugin toolbar
local toolbar = plugin:CreateToolbar("DevAI")
local button = toolbar:CreateButton("DevAI", "Open DevAI AI Assistant", "rbxassetid://17870407023")
local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, true, false, 500, 500, 300, 300)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_v2", widgetInfo)
gui.Title = "DevAI v2.0 — Studio Bridge"

button.Click:Connect(function() gui.Enabled = not gui.Enabled end)

-- Colors (gold-brown ancient fantasy)
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

local Root = mk(gui, "Frame", {BackgroundColor3=C.bg, Size=UDim2.fromScale(1,1)})
local Pad = mk(Root, "UIPadding", {PaddingTop=UDim.new(0,10),PaddingBottom=UDim.new(0,10),PaddingLeft=UDim.new(0,10),PaddingRight=UDim.new(0,10)})

-- Header
mk(Root, "TextLabel", {BackgroundTransparency=1, Text="⚔ DevAI Studio Bridge", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack, TextSize=18, Size=UDim2.new(1,0,0,30), TextXAlignment=Enum.TextXAlignment.Left})
mk(Root, "TextLabel", {BackgroundTransparency=1, Text="Paste your session code from the DevAI website and click 🔌 Connect.",
	TextColor3=C.dim, Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,32), TextXAlignment=Enum.TextXAlignment.Left})

-- Session code input
local y = 60
mk(Root, "TextLabel", {BackgroundTransparency=1, Text="Session Code", TextColor3=C.text, Font=Enum.Font.GothamBold,
	TextSize=12, Size=UDim2.new(0,120,0,24), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left})
local codeBox = mk(Root, "TextBox", {
	BackgroundColor3=C.panel, TextColor3=C.goldLight, PlaceholderText="e.g. KX7M2P",
	PlaceholderColor3=C.faint, Font=Enum.Font.RobotoMono, TextSize=16,
	Size=UDim2.new(1,-130,0,30), Position=UDim2.new(0,125,0,y), Text=sessionCode,
	ClearTextOnFocus=false, BorderSizePixel=0, TextXAlignment=Enum.TextXAlignment.Center,
})
mk(codeBox, "UICorner", {CornerRadius=UDim.new(0,6)})
mk(codeBox, "UIStroke", {Color=C.border, Thickness=1})
local connectBtn = mk(Root, "TextButton", {Text="🔌 Connect", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBlack,
	TextSize=12, Size=UDim2.new(0,100,0,30), Position=UDim2.new(1,-100,0,y+34),
	BackgroundColor3=C.moss, AutoButtonColor=true, BorderSizePixel=0})
mk(connectBtn, "UICorner", {CornerRadius=UDim.new(0,6)})
y = y + 70

-- Status label
local statusLbl = mk(Root, "TextLabel", {BackgroundTransparency=1, Text="⚪ Not connected.", TextColor3=C.dim,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(1,0,0,24), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left})
y = y + 30

-- Instructions
mk(Root, "TextLabel", {BackgroundTransparency=1, Text="How it works:", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left})
y = y + 22
local helpText = [[1. Open https://enestrupi.github.io/DevAI/
2. Click 🔌 Studio Sync in the sidebar
3. Copy the 6-character session code
4. Paste it above and click Connect
5. On the website, click any "📤 Send to Studio" button
6. Code appears below and auto-inserts into Explorer]]
mk(Root, "TextLabel", {BackgroundTransparency=1, Text=helpText, TextColor3=C.dim,
	Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,0,0,120), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true})
y = y + 130

-- Received scripts log
mk(Root, "TextLabel", {BackgroundTransparency=1, Text="📨 Received scripts:", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left})
y = y + 24
local logFrame = mk(Root, "ScrollingFrame", {BackgroundColor3=C.panel, Size=UDim2.new(1,0,1,-y), Position=UDim2.new(0,0,0,y),
	BorderSizePixel=0, CanvasSize=UDim2.fromScale(0,0), AutomaticCanvasSize=Enum.AutomaticSize.Y, ScrollBarThickness=6})
mk(logFrame, "UICorner", {CornerRadius=UDim.new(0,6)})
mk(logFrame, "UIStroke", {Color=C.border, Thickness=1})
local logLayout = mk(logFrame, "UIListLayout", {Padding=UDim.new(0,8), SortOrder=Enum.SortOrder.LayoutOrder})
local logPad = mk(logFrame, "UIPadding", {PaddingTop=UDim.new(0,8),PaddingBottom=UDim.new(0,8),PaddingLeft=UDim.new(0,8),PaddingRight=UDim.new(0,8)})

-- State
local connected = false
local pollConn = nil

local function setStatus(text, color)
	statusLbl.Text = text
	statusLbl.TextColor3 = color or C.dim
	print("[DevAI] " .. text)
end

local function addLogEntry(title, body, scriptType, target)
	local card = mk(logFrame, "Frame", {BackgroundColor3=C.bg2, Size=UDim2.new(1,0,0,90), BorderSizePixel=0, AutomaticSize=Enum.AutomaticSize.Y})
	mk(card, "UICorner", {CornerRadius=UDim.new(0,6)})
	mk(card, "UIStroke", {Color=C.border, Thickness=1})
	mk(card, "TextLabel", {BackgroundTransparency=1, Text="✅ "..title, TextColor3=C.moss, Font=Enum.Font.GothamBold,
		TextSize=12, Size=UDim2.new(1,-80,0,22), Position=UDim2.new(0,8,0,6), TextXAlignment=Enum.TextXAlignment.Left})
	local insertBtn = mk(card, "TextButton", {Text="📥 Insert into Explorer", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold,
		TextSize=10, Size=UDim2.new(0,130,0,22), Position=UDim2.new(1,-138,0,6), BackgroundColor3=C.gold, AutoButtonColor=true, BorderSizePixel=0})
	mk(insertBtn, "UICorner", {CornerRadius=UDim.new(0,4)})
	local bodyLbl = mk(card, "TextLabel", {BackgroundTransparency=1, Text=body:sub(1,200)..(#body>200 and "\n... (click Insert for full script)" or ""),
		TextColor3=C.text, Font=Enum.Font.RobotoMono, TextSize=9, Size=UDim2.new(1,-16,0,50), Position=UDim2.new(0,8,0,30),
		TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true, AutomaticSize=Enum.AutomaticSize.Y})
	
	local fullCode = body
	insertBtn.MouseButton1Click:Connect(function()
		-- Create the script in the target location
		local target = target or "ServerScriptService"
		local className = scriptType == "LocalScript" and "LocalScript"
			or scriptType == "ModuleScript" and "ModuleScript"
			or "Script"
		local parent = game
		local ok = true
		for part in string.gmatch(target, "[^%.]+") do
			local svc = pcall(game.GetService, game, part) and game:GetService(part) or nil
			if svc then
				parent = svc
			else
				local child = parent:FindFirstChild(part)
				if child then parent = child else ok = false; break end
			end
		end
		if not ok then
			-- Fallback to ServerScriptService or StarterPlayerScripts
			if className == "LocalScript" then parent = game:GetService("StarterPlayerScripts")
			elseif className == "ModuleScript" then parent = game:GetService("ReplicatedStorage")
			else parent = game:GetService("ServerScriptService") end
		end
		local s = Instance.new(className)
		s.Name = title:gsub("[^%w_]","_"):sub(1,40) or "DevAIScript"
		s.Source = fullCode
		s.Parent = parent
		ChangeHistoryService:SetWaypoint("DevAI inserted "..s.Name)
		Selection:Set({s})
		setStatus("📥 Inserted '"..s.Name.."' into "..parent:GetFullName(), C.moss)
		insertBtn.Text = "✅ Inserted"
		insertBtn.BackgroundColor3 = C.moss
		-- Open script in editor
		pcall(function() StudioService:OpenScript(s) end)
	end)
end

-- Polling loop using ntfy.sh (free, no-signup pub/sub)
local lastPollId = ""
local function stopPolling()
	if pollConn then task.cancel(pollConn); pollConn=nil end
	connected=false
end

local function startPolling(code)
	stopPolling()
	sessionCode = code
	plugin:SetSetting(SESSION_KEY, code)
	local topic = "devai-"..string.lower(code)
	connected = true
	setStatus("🟢 Connected. Session: "..code..". Waiting for scripts from the website...", C.moss)

	pollConn = task.spawn(function()
		local lastTs = 0
		while connected do
			local ok, resp = pcall(function()
				return HttpService:GetAsync("https://ntfy.sh/"..topic.."/json?since="..lastTs.."&poll=1", true)
			end)
			if ok and resp then
				-- ntfy returns NDJSON (one JSON per line)
				for line in string.gmatch(resp, "[^\n]+") do
					if #line > 5 then
						local okJ, evt = pcall(HttpService.JSONDecode, HttpService, line)
						if okJ and evt and evt.message and tonumber(evt.time or 0) > lastTs then
							lastTs = tonumber(evt.time)
							-- Message format: TITLE|TYPE|TARGET|SOURCE
							local parts = {}
							for p in string.gmatch(evt.message, "[^|]+") do table.insert(parts, p) end
							local title = parts[1] or "Script"
							local stype = parts[2] or "Script"
							local target = parts[3] or "ServerScriptService"
							-- The full source is fetched from a second URL in evt.attachment? No, let's just put source in message (truncated safe for <4096 bytes)
							-- Fallback: message IS the code if only one field
							local code_text = #parts>=4 and table.concat(parts, "|", 4) or evt.message
							-- Clipboard too as a backup
							pcall(function() setclipboard(code_text) end)
							addLogEntry(title, code_text, stype, target)
							setStatus("📨 Received script: "..title, C.goldLight)
						end
					end
				end
			end
			task.wait(2)
		end
	end)
end

connectBtn.MouseButton1Click:Connect(function()
	local code = string.upper(string.gsub(codeBox.Text, "%s", ""))
	codeBox.Text = code
	if #code < 4 then
		setStatus("⚠ Enter a session code (4+ chars) from the website.", C.red)
		return
	end
	if connected then
		stopPolling()
		connectBtn.Text = "🔌 Connect"
		connectBtn.BackgroundColor3 = C.moss
		setStatus("⚪ Disconnected.", C.dim)
	else
		connectBtn.Text = "⏹ Disconnect"
		connectBtn.BackgroundColor3 = C.red
		startPolling(code)
	end
end)

-- Auto-reconnect if session code was saved
if #sessionCode >= 4 then
	codeBox.Text = sessionCode
end

print("[DevAI] v2.0 loaded. Click the DevAI button on the Plugins tab.")
