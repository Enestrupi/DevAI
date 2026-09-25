-- =============================================================================
-- DevAI — Roblox Studio AI Co-Developer
-- A ForgeGUI-style AI assistant that lives inside Roblox Studio.
--
-- INSTALL:
--   1. Save this file as "DevAI.plugin.lua"
--   2. Put it in your Roblox Studio Plugins folder:
--      Windows: %LOCALAPPDATA%\Roblox\Plugins\
--      Mac:     ~/Documents/Roblox/Plugins/
--   3. Restart Studio. A "DevAI" button appears on the Plugins tab.
--   4. Open DevAI → Settings and paste your OpenAI-compatible API key.
--      (OpenAI, Groq, Together, local Ollama via OpenAI-compat, Anthropic proxies all work.)
--
-- This is a DEVELOPER tool. It never ships with your game. It only runs inside Studio.
-- =============================================================================

-- Services
local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local StudioService = game:GetService("StudioService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local PluginGuiService = game:GetService("PluginGuiService")
local TextChatService = game:GetService("TextChatService")

-- =============================================================================
-- PLUGIN BOOT
-- =============================================================================
local PLUGIN_NAME = "DevAI"
local PLUGIN_VERSION = "1.0.0"
local toolbar = plugin:CreateToolbar("DevAI")
local button = toolbar:CreateButton(
	"DevAI",
	"Open DevAI — AI co-developer for Roblox Studio",
	"rbxassetid://7733993361"  -- generic Roblox icon id; replace with a custom asset id
)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Float,
	true,   -- enabled
	true,   -- override
	900, 650,   -- float size
	600, 450    -- min size
)
local gui = plugin:CreateDockWidgetPluginGui("DevAI_Widget", widgetInfo)
gui.Title = string.format("DevAI v%s — Roblox Studio AI Co-Developer", PLUGIN_VERSION)

button.Click:Connect(function()
	gui.Enabled = not gui.Enabled
end)

-- =============================================================================
-- SETTINGS / PERSISTENT STORAGE  (Plugin:SetSetting / GetSetting)
-- =============================================================================
local DEFAULT_SETTINGS = {
	-- Direct-to-provider mode (no self-hosted server needed).
	-- Pick a preset or paste your own OpenAI-compatible endpoint.
	providerPreset = "OpenRouter-Free",  -- OpenRouter-Free | OpenRouter | OpenAI | Groq | Ollama | Custom
	apiKey = "",                          -- your key for the chosen provider
	customBaseUrl = "",                   -- only used for preset "Custom"
	customModel = "",                     -- only used for preset "Custom"
	model = "",                           -- overridden by preset if empty
	maxTokens = 4096,
	temperature = 0.3,
	-- Meshy (3D mesh generation) key — separate from LLM key.
	-- Get free key at https://www.meshy.ai/settings/api (200 free credits/month, no CC)
	meshyApiKey = "",
	meshyArtStyle = "realistic",          -- realistic | cartoon | low-poly | sculpture
	ownerUserIds = "",
	theme = "dark-gold",
	systemPrompt = "",
	autoScanOnOpen = true,
}
local Settings = {}
for k, v in pairs(DEFAULT_SETTINGS) do
	local saved = plugin:GetSetting("DevAI_" .. k)
	if saved ~= nil then
		Settings[k] = saved
	else
		Settings[k] = v
	end
end
local function saveSetting(k, v)
	Settings[k] = v
	plugin:SetSetting("DevAI_" .. k, v)
end

-- =============================================================================
-- PROJECT MEMORY (remembers architecture across sessions)
-- =============================================================================
local Memory = {
	gameName = "My Roblox Game",
	currency = nil,
	adminSystem = nil,
	mainUI = nil,
	importantFolders = {},
	notes = {},
	systems = {},
}
do
	local saved = plugin:GetSetting("DevAI_Memory")
	if saved then
		local ok, decoded = pcall(HttpService.JSONDecode, HttpService, saved)
		if ok and type(decoded) == "table" then
			for k, v in pairs(decoded) do Memory[k] = v end
		end
	end
end
local function saveMemory()
	plugin:SetSetting("DevAI_Memory", HttpService:JSONEncode(Memory))
end

-- =============================================================================
-- PERMISSIONS
-- =============================================================================
local Roles = { OWNER = 3, DEVELOPER = 2, BUILDER = 2, MODERATOR = 1, TESTER = 1 }
local function getCurrentUserId()
	-- In Studio, the local user is the developer.
	local ok, userId = pcall(function()
		return StudioService:GetUserId()
	end)
	return ok and userId or nil
end
local function getCurrentRole()
	-- In Studio context, if the plugin is running you ARE an authorized developer,
	-- but we still enforce owner list for destructive actions when configured.
	local uid = getCurrentUserId()
	if not uid then return "DEVELOPER" end
	local owners = {}
	for raw in string.gmatch(Settings.ownerUserIds or "", "(%d+)") do
		table.insert(owners, tonumber(raw))
	end
	if #owners == 0 then return "OWNER" end -- no owners configured = you're owner
	for _, o in ipairs(owners) do
		if o == uid then return "OWNER" end
	end
	return "DEVELOPER"
end
local function canDo(action)
	local role = getCurrentRole()
	local lvl = Roles[role] or 0
	local required = {
		read = 0, chat = 0, scan = 0, generate = 1,
		create = 1, replace = 2, delete = 3, settings = 3,
	}
	return lvl >= (required[action] or 3)
end

-- =============================================================================
-- STYLING (dark + golden-brown fantasy-dev palette)
-- =============================================================================
local C = {
	bg         = Color3.fromHex("#14100c"),
	bg2        = Color3.fromHex("#1c1610"),
	panel      = Color3.fromHex("#231a12"),
	panel2     = Color3.fromHex("#2c2015"),
	border     = Color3.fromHex("#4a3520"),
	gold       = Color3.fromHex("#c99a3e"),
	goldLight  = Color3.fromHex("#ebbf5b"),
	bronze     = Color3.fromHex("#8a5f2a"),
	amber      = Color3.fromHex("#ff9f2c"),
	moss       = Color3.fromHex("#4d7a35"),
	red        = Color3.fromHex("#c0392b"),
	orange     = Color3.fromHex("#e67e22"),
	yellow     = Color3.fromHex("#f1c40f"),
	green      = Color3.fromHex("#2ecc71"),
	blue       = Color3.fromHex("#3498db"),
	purple     = Color3.fromHex("#9b59b6"),
	text       = Color3.fromHex("#eadfc5"),
	textDim    = Color3.fromHex("#a69470"),
	textFaint  = Color3.fromHex("#726144"),
}

local function styleButton(btn, kind)
	kind = kind or "bronze"
	local bg = ({ bronze = C.bronze, gold = C.gold, green = C.moss, red = C.red,
		blue = C.blue, ghost = C.panel })[kind] or C.bronze
	btn.BackgroundColor3 = bg
	if kind == "ghost" then
		btn.TextColor3 = C.text
	else
		btn.TextColor3 = Color3.new(0.05,0.03,0.02)
	end
	btn.Font = Enum.Font.GothamBold
	btn.TextSize = 13
	btn.AutoButtonColor = true
	btn.BorderSizePixel = 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 5)
	corner.Parent = btn
	local stroke = Instance.new("UIStroke")
	stroke.Color = C.border
	stroke.Thickness = 1
	stroke.Parent = btn
end

local function stylePanel(p)
	p.BackgroundColor3 = C.panel
	p.BorderSizePixel = 0
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = p
	local stroke = Instance.new("UIStroke")
	stroke.Color = C.border
	stroke.Thickness = 1
	stroke.Parent = p
end

local function make(parent, className, props)
	local el = Instance.new(className)
	for k, v in pairs(props or {}) do
		el[k] = v
	end
	el.Parent = parent
	return el
end

-- =============================================================================
-- UI ROOT
-- =============================================================================
local Root = make(gui, "Frame", {
	Name = "Root",
	BackgroundColor3 = C.bg,
	Size = UDim2.fromScale(1, 1),
})
make(Root, "UIPadding", { PaddingLeft = UDim.new(0,8), PaddingRight = UDim.new(0,8),
                           PaddingTop = UDim.new(0,8), PaddingBottom = UDim.new(0,8) })

-- Top bar
local TopBar = make(Root, "Frame", {
	Name = "TopBar",
	BackgroundColor3 = C.bg2,
	Size = UDim2.new(1, 0, 0, 46),
	Position = UDim2.fromOffset(0, 0),
	BorderSizePixel = 0,
})
do
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0,6); c.Parent = TopBar
	local s = Instance.new("UIStroke"); s.Color = C.border; s.Thickness = 1; s.Parent = TopBar
	local pad = Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingRight=UDim.new(0,10)
	pad.PaddingTop=UDim.new(0,6); pad.PaddingBottom=UDim.new(0,6); pad.Parent=TopBar
end
make(TopBar, "TextLabel", {
	BackgroundTransparency = 1,
	Text = "⚔  DevAI",
	TextColor3 = C.goldLight,
	Font = Enum.Font.GothamBlack,
	TextSize = 20,
	Size = UDim2.new(0, 150, 1, 0),
	Position = UDim2.fromOffset(0, 0),
	TextXAlignment = Enum.TextXAlignment.Left,
})
local roleBadge = make(TopBar, "TextLabel", {
	BackgroundTransparency = 1,
	Text = "ROLE: " .. getCurrentRole(),
	TextColor3 = C.amber,
	Font = Enum.Font.GothamBold,
	TextSize = 11,
	Size = UDim2.new(0, 130, 1, 0),
	Position = UDim2.new(1, -140, 0, 0),
	TextXAlignment = Enum.TextXAlignment.Right,
})
local versionLbl = make(TopBar, "TextLabel", {
	BackgroundTransparency = 1,
	Text = "v" .. PLUGIN_VERSION,
	TextColor3 = C.textFaint,
	Font = Enum.Font.Gotham,
	TextSize = 11,
	Size = UDim2.new(0, 80, 1, 0),
	Position = UDim2.new(1, -60, 0, 0),
	TextXAlignment = Enum.TextXAlignment.Right,
})

-- Sidebar navigation
local Nav = make(Root, "Frame", {
	Name = "Nav",
	BackgroundColor3 = C.bg2,
	Size = UDim2.new(0, 140, 1, -56),
	Position = UDim2.fromOffset(0, 52),
	BorderSizePixel = 0,
})
do
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0,6); c.Parent = Nav
	local s = Instance.new("UIStroke"); s.Color = C.border; s.Thickness = 1; s.Parent = Nav
	local l = Instance.new("UIListLayout"); l.FillDirection = Enum.FillDirection.Vertical
	l.Padding = UDim.new(0,4); l.SortOrder = Enum.SortOrder.LayoutOrder; l.Parent = Nav
	local pad = Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,6); pad.PaddingRight=UDim.new(0,6)
	pad.PaddingTop=UDim.new(0,8); pad.PaddingBottom=UDim.new(0,8); pad.Parent=Nav
end

local NAV_ITEMS = {
	{ id = "HOME",      label = "🏠  Home",       },
	{ id = "CHAT",      label = "💬  AI Chat",    },
	{ id = "MODELS",    label = "🧊  3D Models",  },
	{ id = "SCANNER",   label = "🔍  Game Scanner",},
	{ id = "SCRIPTS",   label = "📜  Scripts",    },
	{ id = "BUILDER",   label = "🏗️  Builder",    },
	{ id = "EXPLORER",  label = "📁  Explorer",   },
	{ id = "TESTING",   label = "🧪  Testing",    },
	{ id = "ERRORS",    label = "🐞  Errors",     },
	{ id = "CONSOLE",   label = "🖥  Console",     },
	{ id = "SETTINGS",  label = "⚙️  Settings",   },
}

-- Main content area
local Content = make(Root, "Frame", {
	Name = "Content",
	BackgroundColor3 = C.bg2,
	Size = UDim2.new(1, -150, 1, -56),
	Position = UDim2.new(0, 148, 0, 52),
	BorderSizePixel = 0,
})
do
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0,6); c.Parent = Content
	local s = Instance.new("UIStroke"); s.Color = C.border; s.Thickness = 1; s.Parent = Content
end

-- Nav pages container
local Pages = {}
local function newPage(name)
	local f = make(Content, "ScrollingFrame", {
		Name = name,
		BackgroundColor3 = C.bg2,
		Size = UDim2.fromScale(1,1),
		CanvasSize = UDim2.fromScale(0,0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 8,
		ScrollBarImageColor3 = C.bronze,
		Visible = false,
		BorderSizePixel = 0,
	})
	local pad = Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,12); pad.PaddingRight=UDim.new(0,12)
	pad.PaddingTop=UDim.new(0,12); pad.PaddingBottom=UDim.new(0,12); pad.Parent = f
	return f
end
for _, n in ipairs(NAV_ITEMS) do Pages[n.id] = newPage(n.id) end

local ActivePage = "HOME"
local function switchPage(id)
	ActivePage = id
	for pid, p in pairs(Pages) do p.Visible = (pid == id) end
	for _, btn in ipairs(navButtons or {}) do
		if btn:GetAttribute("pid") == id then
			btn.BackgroundTransparency = 0.2
		else
			btn.BackgroundTransparency = 1
		end
	end
end
navButtons = {}
for i, n in ipairs(NAV_ITEMS) do
	local b = make(Nav, "TextButton", {
		BackgroundColor3 = C.panel,
		BackgroundColor2 = C.panel,
		Text = n.label,
		TextColor3 = C.text,
		Font = Enum.Font.GothamBold,
		TextSize = 12,
		Size = UDim2.new(1, 0, 0, 34),
		AutoButtonColor = true,
		BorderSizePixel = 0,
		LayoutOrder = i,
	})
	b:SetAttribute("pid", n.id)
	local cr = Instance.new("UICorner"); cr.CornerRadius = UDim.new(0,5); cr.Parent = b
	b.MouseButton1Click:Connect(function() switchPage(n.id) end)
	table.insert(navButtons, b)
end

-- =============================================================================
-- CONSOLE (app-wide logging)
-- =============================================================================
local ConsoleLines = {}
local ConsoleList = nil -- built later (CONSOLE page)
local function log(level, msg)
	local entry = {
		t = os.date("%H:%M:%S"),
		level = level,
		msg = msg,
	}
	table.insert(ConsoleLines, entry)
	if #ConsoleLines > 500 then table.remove(ConsoleLines, 1) end
	if ConsoleList then
		local line = make(ConsoleList, "TextLabel", {
			BackgroundTransparency = 1,
			Text = string.format("[%s] [%s] %s", entry.t, entry.level, entry.msg),
			TextColor3 = ({ INFO=C.textDim, OK=C.green, WARN=C.orange,
			                ERR=C.red, AI=C.amber, SYS=C.gold })[level] or C.text,
			Font = Enum.Font.RobotoMono,
			TextSize = 11,
			Size = UDim2.new(1, -8, 0, 18),
			TextXAlignment = Enum.TextXAlignment.Left,
		})
		ConsoleList.CanvasSize = UDim2.new(1,0,0,#ConsoleLines*18)
	end
end

-- =============================================================================
-- GAME EXPLORER / SCANNER
-- =============================================================================
local IMPORTANT_SERVICES = {
	"Workspace","ReplicatedStorage","ServerScriptService","ServerStorage",
	"StarterGui","StarterPlayer","StarterPack","Lighting","SoundService",
	"Teams","ReplicatedFirst","Chat","TextChatService","HttpService",
	"DataStoreService","MemoryStoreService","MessagingService",
}

local scanCache = nil  -- most recent scan
local function fullScan()
	local issues = {}
	local counts = {
		RemoteEvents = 0, RemoteFunctions = 0,
		LocalScripts = 0, ModuleScripts = 0, Scripts = 0,
		GUIs = 0, Parts = 0, Models = 0, Folders = 0,
		Unused = 0,
	}
	local remotes = { RemoteEvent = {}, RemoteFunction = {}, UnreliableRemoteEvent = {} }
	local memoryHints = { folders = {}, modules = {}, remotes = {}, ui = {} }

	local function walk(obj, depth)
		if depth > 30 then return end
		-- classify
		local class = obj.ClassName
		if class == "RemoteEvent" then
			counts.RemoteEvents = counts.RemoteEvents + 1; table.insert(remotes.RemoteEvent, obj:GetFullName())
			table.insert(memoryHints.remotes, obj:GetFullName())
		elseif class == "RemoteFunction" then
			counts.RemoteFunctions = counts.RemoteFunctions + 1; table.insert(remotes.RemoteFunction, obj:GetFullName())
		elseif class == "UnreliableRemoteEvent" then
			table.insert(remotes.UnreliableRemoteEvent, obj:GetFullName())
		elseif class == "LocalScript" then
			counts.LocalScripts = counts.LocalScripts + 1
		elseif class == "Script" then
			counts.Scripts = counts.Scripts + 1
			-- HEURISTIC: infinite loops without wait
			if obj.Source then
				local src = obj.Source
				if src:find("while true do") and not src:find("wait%(") and not src:find("task%.wait") then
					table.insert(issues, {
						severity = "CRITICAL", obj = obj:GetFullName(),
						kind = "infinite_loop",
						msg = "Server script has 'while true do' without wait()/task.wait() — will freeze the server.",
					})
				end
			end
		elseif class == "ModuleScript" then
			counts.ModuleScripts = counts.ModuleScripts + 1
			table.insert(memoryHints.modules, obj:GetFullName())
		elseif class:find("Gui") or class == "ScreenGui" then
			counts.GUIs = counts.GUIs + 1
			if obj.Name:match("UI$") or obj.Name:match("Gui$") then
				table.insert(memoryHints.ui, obj:GetFullName())
			end
		elseif class == "Part" or class == "MeshPart" or class == "UnionOperation" then
			counts.Parts = counts.Parts + 1
			-- HEURISTIC: non-anchored part deep in workspace with no parent model = floating
			if obj:IsA("BasePart") and not obj.Anchored and depth > 3
				and (not obj.Parent or not obj.Parent:IsA("Model")) then
				table.insert(issues, {
					severity = "OPT", obj = obj:GetFullName(),
					kind = "floating_part",
					msg = "Unanchored loose part in Workspace — can cause physics spam.",
				})
			end
		elseif class == "Model" then
			counts.Models = counts.Models + 1
		elseif class == "Folder" then
			counts.Folders = counts.Folders + 1
			if depth <= 4 then table.insert(memoryHints.folders, obj:GetFullName()) end
		end

		-- recurse into containers
		local ok, children = pcall(function() return obj:GetChildren() end)
		if ok then
			for _, ch in ipairs(children) do walk(ch, depth+1) end
		end
	end

	for _, svcName in ipairs(IMPORTANT_SERVICES) do
		local ok, svc = pcall(function() return game:GetService(svcName) end)
		if ok then
			walk(svc, 1)
		else
			table.insert(issues, { severity = "WARN", obj = svcName, kind = "missing_service",
				msg = "Service not accessible." })
		end
	end

	-- Architectural heuristics
	if #remotes.RemoteEvent == 0 then
		table.insert(issues, { severity = "GOOD", obj = "-", kind = "no_remotes",
			msg = "No RemoteEvents yet. That's fine for a new project." })
	end
	-- check if ReplicatedStorage has Remotes folder
	local rs = game:GetService("ReplicatedStorage")
	if not rs:FindFirstChild("Remotes") and #remotes.RemoteEvent > 5 then
		table.insert(issues, { severity = "WARN", obj = "ReplicatedStorage", kind = "no_remotes_folder",
			msg = "RemoteEvents exist but no 'Remotes' folder — consider organizing." })
	end
	if not game:GetService("ServerScriptService"):FindFirstChild("Systems") then
		table.insert(issues, { severity = "OPT", obj = "ServerScriptService", kind = "no_systems_folder",
			msg = "No 'Systems' folder found. A Systems/Services/Modules pattern keeps code clean." })
	end

	-- Security: LocalScript parenting check (never put LocalScripts in Workspace/ServerScriptService at runtime)
	for _, desc in ipairs(game.Workspace:GetDescendants()) do
		if desc:IsA("LocalScript") then
			table.insert(issues, { severity = "CRITICAL", obj = desc:GetFullName(),
				kind = "localscript_in_workspace",
				msg = "LocalScript in Workspace will not run and is a sign of broken architecture." })
			break
		end
	end

	-- Auto-update memory hints
	Memory.importantFolders = memoryHints.folders
	if #memoryHints.ui > 0 and not Memory.mainUI then
		Memory.mainUI = memoryHints.ui[1]:match("[^%.]+$")
	end
	saveMemory()

	local summary = {
		counts = counts,
		issues = issues,
		remotes = remotes,
		generatedAt = os.time(),
	}
	scanCache = summary
	log("OK", string.format("Game scan complete: %d Scripts, %d LocalScripts, %d Modules, %d R/E, %d issues",
		counts.Scripts, counts.LocalScripts, counts.ModuleScripts, counts.RemoteEvents, #issues))
	return summary
end

local function severityColor(s)
	if s == "CRITICAL" then return C.red
	elseif s == "WARN" then return C.orange
	elseif s == "OPT" then return C.yellow
	else return C.green end
end
local function severityIcon(s)
	if s == "CRITICAL" then return "🔴"
	elseif s == "WARN" then return "🟠"
	elseif s == "OPT" then return "🟡"
	else return "🟢" end
end

-- =============================================================================
-- AI BACKEND (OpenAI-compatible HTTP)
-- =============================================================================
local AI = {}
AI.history = {} -- conversation history (chat)

local function buildSystemContext()
	local role = getCurrentRole()
	local lines = {
		"You are DevAI, an expert Roblox Studio co-developer embedded inside Roblox Studio.",
		"You help with Luau, Roblox APIs, Explorer hierarchy, client/server separation, security, optimization, and game architecture.",
		"Be direct. Output complete, paste-ready Luau code when code is requested. No fluff.",
		"Always indicate exactly WHERE each script belongs (e.g. ServerScriptService, ReplicatedStorage, StarterPlayerScripts).",
		"Preserve the developer's existing structure. Never rename existing folders/scripts/remotes unless explicitly asked.",
		"Prefer server-authoritative systems. Validate all RemoteEvent arguments server-side.",
		"Use modern Roblox APIs (task.wait, task.spawn, OverlapParams, ProximityPrompt, Attributes, CollectionService, TextChatService).",
		"Output code in fenced ```luau ... ``` blocks with a short header comment noting the target location.",
		"Current role: " .. role .. ".",
		"Game name: " .. tostring(Memory.gameName),
	}
	if Memory.currency then table.insert(lines, "Currency: " .. Memory.currency) end
	if Memory.adminSystem then table.insert(lines, "Admin system: " .. Memory.adminSystem) end
	if Memory.mainUI then table.insert(lines, "Main UI: " .. Memory.mainUI) end
	if #Memory.importantFolders > 0 then
		table.insert(lines, "Known important folders: " .. table.concat(Memory.importantFolders, ", "))
	end
	if Settings.systemPrompt and #Settings.systemPrompt > 0 then
		table.insert(lines, "Extra developer instructions: " .. Settings.systemPrompt)
	end
	-- Attach latest scan summary if available
	if scanCache then
		table.insert(lines, "\n# Current game structure summary:")
		table.insert(lines, HttpService:JSONEncode({
			counts = scanCache.counts,
			remotes = scanCache.remotes,
		}))
		-- Recent issues (up to 20)
		local recentIssues = {}
		for i = 1, math.min(20, #scanCache.issues) do
			table.insert(recentIssues, scanCache.issues[i])
		end
		if #recentIssues > 0 then
			table.insert(lines, "Recent issues detected:")
			for _, iss in ipairs(recentIssues) do
				table.insert(lines, string.format("- [%s] %s: %s", iss.severity, iss.obj, iss.msg))
			end
		end
	end
	return table.concat(lines, "\n")
end

-------------------------------------------------------------------------------
-- AI PROVIDER PRESETS  (each resolves to baseUrl + default model)
-------------------------------------------------------------------------------
local PRESETS = {
	["OpenRouter-Free"] = {
		baseUrl = "https://openrouter.ai/api/v1",
		model   = "meta-llama/llama-3.1-8b-instruct:free",
		signup  = "openrouter.ai/keys",
		note    = "100% free models — limited rate. Best zero-cost option.",
	},
	["OpenRouter"] = {
		baseUrl = "https://openrouter.ai/api/v1",
		model   = "anthropic/claude-3.5-sonnet",
		signup  = "openrouter.ai/keys",
		note    = "Pay-as-you-go; access to Claude, GPT, Llama, Qwen, Grok, Gemini in one key.",
	},
	["OpenAI"] = {
		baseUrl = "https://api.openai.com/v1",
		model   = "gpt-4o-mini",
		signup  = "platform.openai.com/api-keys",
		note    = "OpenAI direct.",
	},
	["Groq"] = {
		baseUrl = "https://api.groq.com/openai/v1",
		model   = "llama-3.3-70b-versatile",
		signup  = "console.groq.com/keys",
		note    = "Very fast, generous free tier.",
	},
	["Ollama (local)"] = {
		baseUrl = "http://localhost:11434/v1",
		model   = "llama3.1",
		signup  = "",
		note    = "100% offline/local. Start Ollama first; key can be anything.",
	},
	["Custom"] = {
		baseUrl = "",
		model   = "",
		signup  = "",
		note    = "Paste your own base URL and model.",
	},
}

local function resolveProvider()
	local preset = PRESETS[Settings.providerPreset] or PRESETS["OpenRouter-Free"]
	local baseUrl, model
	if Settings.providerPreset == "Custom" then
		baseUrl = (Settings.customBaseUrl or ""):gsub("/$", "")
		model = Settings.customModel or ""
	else
		baseUrl = preset.baseUrl
		model = (Settings.model and #Settings.model > 0) and Settings.model or preset.model
	end
	return { baseUrl = baseUrl, model = model, preset = preset }
end

function AI.chat(userMsg, onChunk, onDone)
	local p = resolveProvider()
	if not p.baseUrl or #p.baseUrl == 0 then
		onDone(false, "No provider base URL. Pick a preset or fill Custom Base URL in Settings.")
		return
	end
	if not p.model or #p.model == 0 then
		onDone(false, "No model set.")
		return
	end
	-- Ollama works without a key; others require it.
	if Settings.providerPreset ~= "Ollama (local)" then
		if not Settings.apiKey or #Settings.apiKey == 0 then
			onDone(false, "No API key set. Get one from " .. (p.preset.signup or "your provider") .. " and paste it in Settings.")
			return
		end
	end

	table.insert(AI.history, { role = "user", content = userMsg })
	local systemContent = buildSystemContext()
	local messages = { { role = "system", content = systemContent } }
	for _, m in ipairs(AI.history) do table.insert(messages, m) end

	local startedAt = os.clock()
	local url = p.baseUrl .. "/chat/completions"
	local body = HttpService:JSONEncode({
		model = p.model,
		messages = messages,
		max_tokens = Settings.maxTokens,
		temperature = Settings.temperature,
		stream = false,
	})

	local headers = { ["Content-Type"] = "application/json" }
	if Settings.apiKey and #Settings.apiKey > 0 then
		headers["Authorization"] = "Bearer " .. Settings.apiKey
	end
	-- OpenRouter likes a referrer header for free-tier apps
	headers["HTTP-Referer"] = "https://roblox.com"
	headers["X-Title"] = "DevAI Roblox Studio Plugin"

	log("SYS", "AI → " .. Settings.providerPreset .. " (" .. p.model .. ")")
	task.spawn(function()
		local okHttp, resp = pcall(function()
			return HttpService:RequestAsync({ Url = url, Method = "POST", Headers = headers, Body = body })
		end)
		if not okHttp then
			onDone(false, "HTTP request failed. If Studio says 'permission denied', turn on 'Enable Studio Access to API Services' in Studio Settings → Security. Details: " .. tostring(resp))
			log("ERR", "AI request failed: " .. tostring(resp))
			return
		end
		if not resp.Success then
			-- Try to extract friendly message
			local okJ, j = pcall(HttpService.JSONDecode, HttpService, resp.Body)
			local msg = resp.Body:sub(1,400)
			if okJ and j and j.error then
				msg = (j.error.message or j.error.code or "provider error") .. "  (" .. resp.StatusCode .. ")"
			end
			onDone(false, "AI error: " .. msg)
			log("ERR", string.format("AI HTTP %d: %s", resp.StatusCode, msg))
			return
		end
		local okJson, data = pcall(HttpService.JSONDecode, HttpService, resp.Body)
		if not okJson then
			onDone(false, "Bad JSON from provider.")
			return
		end
		local content
		if data.choices and data.choices[1] and data.choices[1].message then
			content = data.choices[1].message.content or ""
		else
			onDone(false, "Unexpected response shape from provider.")
			return
		end
		table.insert(AI.history, { role = "assistant", content = content })
		log("AI", string.format("Reply in %.1fs (%d chars)", os.clock()-startedAt, #content))
		onDone(true, content)
	end)
end

-- Quick connection test (does a minimal models-list or short chat; models list is cheapest).
function AI.testServer(cb)
	local p = resolveProvider()
	if not p.baseUrl or #p.baseUrl == 0 then cb(false, "Set a provider first."); return end
	task.spawn(function()
		local url = p.baseUrl .. "/models"
		local headers = {}
		if Settings.apiKey and #Settings.apiKey > 0 then
			headers["Authorization"] = "Bearer " .. Settings.apiKey
		end
		local ok, resp = pcall(function()
			return HttpService:RequestAsync({ Url = url, Method = "GET", Headers = headers })
		end)
		if not ok then cb(false, "Could not reach " .. url); return end
		if resp.StatusCode == 401 or resp.StatusCode == 403 then
			cb(false, "❌ Bad API key (HTTP " .. resp.StatusCode .. ")")
			return
		end
		if not resp.Success then
			cb(false, "❌ HTTP " .. resp.StatusCode)
			return
		end
		cb(true, "✅ Connected to " .. Settings.providerPreset .. " — " .. p.model)
	end)
end

-- =============================================================================
-- MESHY 3D MESH GENERATION
-- Free API: https://developer.meshy.ai  |  Free key: https://www.meshy.ai/settings/api
-- Workflow:
--   1. POST /openapi/v2/text-to-3d  (mode=preview)  → creates a preview task (fast, ~20s)
--   2. Poll GET /openapi/v2/text-to-3d/{id} until status == "SUCCEEDED"
--   3. (optional) POST mode=refine with preview_task_id to get PBR-textured high-quality mesh
--   4. Model downloads come back as glb/obj/fbx URLs.
-- =============================================================================
Meshy = {}
function Meshy.createPreview(prompt, artStyle, cb)
	if not Settings.meshyApiKey or #Settings.meshyApiKey == 0 then
		cb(false, "No Meshy key. Get one free at meshy.ai/settings/api (no credit card, 200 free credits/month) and paste it in Settings.")
		return
	end
	artStyle = artStyle or Settings.meshyArtStyle or "realistic"
	local body = HttpService:JSONEncode({
		mode = "preview",
		prompt = prompt,
		art_style = artStyle,
		should_remesh = true,
		target_formats = {"glb", "obj", "fbx"},
	})
	task.spawn(function()
		local ok, resp = pcall(function()
			return HttpService:RequestAsync({
				Url = "https://api.meshy.ai/openapi/v2/text-to-3d",
				Method = "POST",
				Headers = {
					["Content-Type"] = "application/json",
					["Authorization"] = "Bearer " .. Settings.meshyApiKey,
				},
				Body = body,
			})
		end)
		if not ok then cb(false, "HTTP error: " .. tostring(resp)); return end
		if not resp.Success then
			cb(false, "Meshy error (" .. resp.StatusCode .. "): " .. resp.Body:sub(1,300))
			return
		end
		local okJ, j = pcall(HttpService.JSONDecode, HttpService, resp.Body)
		if not okJ then cb(false, "Bad JSON from Meshy."); return end
		if j.result then
			cb(true, j.result) -- task id
		else
			cb(false, "Unexpected response: " .. resp.Body:sub(1,300))
		end
	end)
end

function Meshy.refinePreview(previewTaskId, cb)
	if not Settings.meshyApiKey or #Settings.meshyApiKey == 0 then
		cb(false, "No Meshy key set."); return
	end
	local body = HttpService:JSONEncode({
		mode = "refine",
		preview_task_id = previewTaskId,
		enable_pbr = true,
		target_formats = {"glb", "fbx", "obj"},
	})
	task.spawn(function()
		local ok, resp = pcall(function()
			return HttpService:RequestAsync({
				Url = "https://api.meshy.ai/openapi/v2/text-to-3d",
				Method = "POST",
				Headers = {
					["Content-Type"] = "application/json",
					["Authorization"] = "Bearer " .. Settings.meshyApiKey,
				},
				Body = body,
			})
		end)
		if not ok then cb(false, "HTTP error: " .. tostring(resp)); return end
		if not resp.Success then
			cb(false, "Refine error (" .. resp.StatusCode .. "): " .. resp.Body:sub(1,300))
			return
		end
		local okJ, j = pcall(HttpService.JSONDecode, HttpService, resp.Body)
		if not okJ then cb(false, "Bad JSON."); return end
		if j.result then cb(true, j.result) else cb(false, "No task id returned.") end
	end)
end

function Meshy.getTask(taskId, cb)
	task.spawn(function()
		local ok, resp = pcall(function()
			return HttpService:RequestAsync({
				Url = "https://api.meshy.ai/openapi/v2/text-to-3d/" .. taskId,
				Method = "GET",
				Headers = { ["Authorization"] = "Bearer " .. Settings.meshyApiKey },
			})
		end)
		if not ok then cb(false, "HTTP error: " .. tostring(resp)); return end
		if not resp.Success then
			cb(false, "Status error " .. resp.StatusCode .. ": " .. resp.Body:sub(1,200))
			return
		end
		local okJ, j = pcall(HttpService.JSONDecode, HttpService, resp.Body)
		if not okJ then cb(false, "Bad JSON."); return end
		cb(true, j)
	end)
end

function Meshy.pollUntilDone(taskId, onProgress, onDone, pollInterval)
	pollInterval = pollInterval or 3
	local function tick()
		Meshy.getTask(taskId, function(ok, data)
			if not ok then onDone(false, data); return end
			local status = data.status or "UNKNOWN"
			local progress = data.progress or 0
			onProgress(status, progress)
			if status == "SUCCEEDED" or status == "FAILED" or status == "EXPIRED" then
				if status == "SUCCEEDED" then onDone(true, data) else onDone(false, status) end
				return
			end
			task.delay(pollInterval, tick)
		end)
	end
	tick()
end

function Meshy.testKey(cb)
	if not Settings.meshyApiKey or #Settings.meshyApiKey == 0 then
		cb(false, "No Meshy key."); return
	end
	task.spawn(function()
		local ok, resp = pcall(function()
			return HttpService:RequestAsync({
				Url = "https://api.meshy.ai/openapi/v2/text-to-3d?limit=1",
				Method = "GET",
				Headers = { ["Authorization"] = "Bearer " .. Settings.meshyApiKey },
			})
		end)
		if not ok then cb(false, "Could not reach Meshy."); return end
		if resp.StatusCode == 401 or resp.StatusCode == 403 then
			cb(false, "❌ Bad Meshy key (HTTP " .. resp.StatusCode .. ")")
			return
		end
		if not resp.Success then cb(false, "HTTP " .. resp.StatusCode); return end
		cb(true, "✅ Meshy connected (free tier ready)")
	end)
end

function AI.resetConversation()
	AI.history = {}
	log("INFO", "AI conversation history cleared.")
end

-- =============================================================================
-- CODE EXTRACTION & SCRIPT INJECTION (Send to Studio)
-- =============================================================================
-- Helper to resolve a dot-path like "ServerScriptService.AdminSystem.Main" to an Instance.
local function resolvePath(pathStr)
	if not pathStr or #pathStr == 0 then return nil, "empty path" end
	local parts = {}
	for p in string.gmatch(pathStr, "[^%.]+") do table.insert(parts, p) end
	if #parts == 0 then return nil, "no parts" end
	local current
	-- First token is either a service name or "game"
	local first = parts[1]
	if first == "game" then table.remove(parts, 1); first = parts[1] end
	local ok, svc = pcall(function() return game:GetService(first) end)
	if ok then
		current = svc
		table.remove(parts, 1)
	else
		-- fallback: maybe it's a child of game
		current = game:FindFirstChild(first)
		if not current then return nil, "could not resolve starting at: " .. first end
		table.remove(parts, 1)
	end
	for _, p in ipairs(parts) do
		local ch = current:FindFirstChild(p)
		if not ch then return nil, "missing child: " .. p .. " in " .. current:GetFullName() end
		current = ch
	end
	return current
end

-- Create parent folders/services as needed, returning the final parent Instance.
local function ensurePath(pathStr, createClass)
	createClass = createClass or "Folder"
	local parts = {}
	for p in string.gmatch(pathStr, "[^%.]+") do table.insert(parts, p) end
	if parts[1] == "game" then table.remove(parts,1) end
	-- service
	local svcName = table.remove(parts,1)
	local current = game:GetService(svcName)
	for _, p in ipairs(parts) do
		local nxt = current:FindFirstChild(p)
		if not nxt then
			nxt = Instance.new(createClass)
			nxt.Name = p
			nxt.Parent = current
		end
		current = nxt
	end
	return current
end

local function extractFirstLuauBlock(text)
	-- grabs the first ```luau or ```lua fenced block
	local block = text:match("```[Ll]uau%s*\n(.-)\n```")
		or text:match("```[Ll]ua%s*\n(.-)\n```")
		or text:match("```[Ll]uau(.-)```")
		or text:match("```[Ll]ua(.-)```")
	if block then return block end
	-- fallback: if text starts with "--" or "local " or "return", assume whole thing is code
	local trimmed = text:match("^%s*(.-)%s*$")
	if trimmed:sub(1,2) == "--" or trimmed:sub(1,6) == "local " or trimmed:sub(1,7) == "return " then
		return trimmed
	end
	return nil
end

-- Pending action queue: every "SEND TO STUDIO" action is queued for preview/confirm
local pendingAction = nil  -- { kind, target, payload, previewText }

function AI.sendToStudio(action)
	-- action: { kind, target, name, className, source? }
	pendingAction = action
	if PreviewPanel then
		PreviewPanel.Visible = true
		PreviewActionLabel.Text = string.format("ACTION:  %s %s",
			action.kind:upper(),
			(action.target and action.target ~= "") and ("→ "..action.target.."."..(action.name or "")) or (action.name or ""))
		-- preview code if it's a script action
		if action.source then
			PreviewCode.Text = action.source:sub(1, 4000) -- truncate for preview
		else
			PreviewCode.Text = "(no code — object creation)"
		end
		log("INFO", "Pending action queued: " .. action.kind)
	end
end

local function applyPendingAction()
	local a = pendingAction
	if not a then return end
	ChangeHistoryService:SetWaypoint("Before DevAI action: " .. a.kind)
	local ok, err = pcall(function()
		if a.kind == "createScript" or a.kind == "replaceScript" then
			local class = a.className or "Script" -- Script | LocalScript | ModuleScript
			local parent = resolvePath(a.target)
			if not parent then error("Target not found: " .. tostring(a.target)) end
			local obj
			if a.kind == "replaceScript" then
				obj = parent:FindFirstChild(a.name)
				if not obj then error("Script to replace not found: " .. a.name) end
			else
				obj = Instance.new(class)
				obj.Name = a.name or "NewScript"
				obj.Parent = parent
			end
			if a.source then obj.Source = a.source end
			log("OK", string.format("%s %s @ %s", a.kind, obj.Name, parent:GetFullName()))
		elseif a.kind == "createFolder" then
			local parent = resolvePath(a.target)
			local f = Instance.new("Folder"); f.Name = a.name or "NewFolder"; f.Parent = parent
			log("OK", "Created folder " .. f:GetFullName())
		elseif a.kind == "createRemote" then
			local class = a.className or "RemoteEvent"
			local parent = ensurePath(a.target)
			local r = Instance.new(class); r.Name = a.name or "NewRemote"; r.Parent = parent
			log("OK", "Created remote " .. r:GetFullName())
		elseif a.kind == "createPart" then
			local p = Instance.new("Part"); p.Name = a.name or "Part"
			p.Anchored = true; p.Size = Vector3.new(4,1,4)
			p.Parent = workspace
			log("OK", "Created Part " .. p:GetFullName())
		elseif a.kind == "createModel" then
			local m = Instance.new("Model"); m.Name = a.name or "Model"
			m.Parent = workspace
			log("OK", "Created Model " .. m:GetFullName())
		elseif a.kind == "createGUI" then
			local sg = Instance.new("ScreenGui"); sg.Name = a.name or "NewUI"
			sg.Parent = game:GetService("StarterGui")
			log("OK", "Created GUI " .. sg:GetFullName())
		elseif a.kind == "createObject" then
			local parent = resolvePath(a.target) or workspace
			local obj = Instance.new(a.className or "Part")
			obj.Name = a.name or a.className
			obj.Parent = parent
			log("OK", "Created "..a.className.." "..obj:GetFullName())
		end
	end)
	ChangeHistoryService:SetWaypoint("After DevAI action: " .. a.kind)
	if PreviewPanel then PreviewPanel.Visible = false end
	pendingAction = nil
	if not ok then
		log("ERR", "Apply failed: " .. tostring(err))
	else
		log("OK", "Action applied. Undo with Ctrl+Z.")
	end
end

local function cancelPendingAction()
	pendingAction = nil
	if PreviewPanel then PreviewPanel.Visible = false end
	log("INFO", "Pending action cancelled.")
end

-- =============================================================================
-- BUILD EACH PAGE
-- =============================================================================

-- Helper: page title
local function pageTitle(page, title, subtitle)
	local t = make(page, "TextLabel", {
		BackgroundTransparency = 1,
		Text = title,
		TextColor3 = C.goldLight,
		Font = Enum.Font.GothamBlack,
		TextSize = 22,
		Size = UDim2.new(1, 0, 0, 30),
		TextXAlignment = Enum.TextXAlignment.Left,
	})
	if subtitle then
		make(page, "TextLabel", {
			BackgroundTransparency = 1,
			Text = subtitle,
			TextColor3 = C.textDim,
			Font = Enum.Font.Gotham,
			TextSize = 12,
			Size = UDim2.new(1, 0, 0, 18),
			Position = UDim2.new(0, 0, 0, 32),
			TextXAlignment = Enum.TextXAlignment.Left,
		})
	end
	local spacer = make(page, "Frame", {
		BackgroundColor3 = C.border, Size = UDim2.new(1,0,0,1),
		Position = UDim2.new(0,0,0,54), BorderSizePixel=0,
	})
	return 60
end

-- ---------- HOME PAGE ----------
local yOff = pageTitle(Pages.HOME, "⚔  DevAI  —  Welcome, Developer",
	"Your AI co-developer for Roblox Studio. Build · Code · Debug · Test · Optimize · Deploy.")

local quickActions = make(Pages.HOME, "Frame", {
	BackgroundTransparency = 1,
	Size = UDim2.new(1, 0, 0, 360),
	Position = UDim2.new(0, 0, 0, yOff+10),
})
do
	local gl = Instance.new("UIGridLayout")
	gl.CellSize = UDim2.new(0.32, -6, 0, 80)
	gl.CellPadding = UDim2.fromOffset(8,8)
	gl.Parent = quickActions
end
local QACTIONS = {
	{ label = "💬  Open AI Chat",    kind = "gold",  go = function() switchPage("CHAT") end },
	{ label = "🔍  Scan Game",       kind = "green", go = function() switchPage("SCANNER"); refreshScanner() end },
	{ label = "📜  Create Script",   kind = "bronze",go = function() switchPage("SCRIPTS") end },
	{ label = "🏗️  Build Model",     kind = "bronze",go = function() switchPage("BUILDER") end },
	{ label = "🧪  Testing Lab",     kind = "blue",  go = function() switchPage("TESTING") end },
	{ label = "🐞  Explain Error",   kind = "red",   go = function() switchPage("ERRORS") end },
	{ label = "📁  Explorer",        kind = "bronze",go = function() switchPage("EXPLORER"); rebuildExplorer() end },
	{ label = "⚙️  Settings",        kind = "ghost", go = function() switchPage("SETTINGS") end },
}
for _, q in ipairs(QACTIONS) do
	local p = make(quickActions, "TextButton", {
		BackgroundColor3 = C.panel,
		Text = q.label,
		TextColor3 = C.text,
		Font = Enum.Font.GothamBold,
		TextSize = 14,
		BorderSizePixel = 0,
	})
	local cr = Instance.new("UICorner"); cr.CornerRadius = UDim.new(0,8); cr.Parent = p
	local s = Instance.new("UIStroke"); s.Color = C.border; s.Thickness=1; s.Parent=p
	styleButton(p, q.kind)
	p.BackgroundColor3 = ({gold=C.gold, green=C.moss, bronze=C.bronze, red=C.red, blue=C.blue, ghost=C.panel2})[q.kind] or C.bronze
	p.MouseButton1Click:Connect(q.go)
end

-- Project memory card on home
local memCard = make(Pages.HOME, "Frame", {
	BackgroundColor3 = C.panel,
	Size = UDim2.new(1,0,0,180),
	Position = UDim2.new(0,0,0,yOff+380),
	BorderSizePixel=0,
})
do
	local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=memCard
	local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=memCard
	local pad=Instance.new("UIPadding"); pad.PaddingTop=UDim.new(0,10); pad.PaddingBottom=UDim.new(0,10)
	pad.PaddingLeft=UDim.new(0,12); pad.PaddingRight=UDim.new(0,12); pad.Parent=memCard
end
make(memCard, "TextLabel", {
	BackgroundTransparency=1, Text="🧠 PROJECT MEMORY", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack, TextSize=14, Size=UDim2.new(1,0,0,20),
	TextXAlignment=Enum.TextXAlignment.Left,
})
local memText = make(memCard, "TextLabel", {
	BackgroundTransparency=1, Text="", TextColor3=C.text,
	Font=Enum.Font.Gotham, TextSize=12, Size=UDim2.new(1,-140,1,-28),
	Position=UDim2.new(0,0,0,24), TextXAlignment=Enum.TextXAlignment.Left,
	TextYAlignment=Enum.TextYAlignment.Top, TextWrapped=true,
})
local function refreshMemText()
	local parts = {}
	table.insert(parts, string.format("Game: %s", Memory.gameName or "-"))
	table.insert(parts, string.format("Currency: %s", Memory.currency or "-"))
	table.insert(parts, string.format("Admin: %s", Memory.adminSystem or "-"))
	table.insert(parts, string.format("Main UI: %s", Memory.mainUI or "-"))
	table.insert(parts, "Folders: " .. (#Memory.importantFolders > 0 and table.concat(Memory.importantFolders, ", ") or "-"))
	memText.Text = table.concat(parts, "\n")
end
refreshMemText()
local editMem = make(memCard, "TextBox", {
	PlaceholderText = "Extra project notes (saved to memory)...",
	BackgroundColor3 = C.bg, TextColor3 = C.text,
	Font = Enum.Font.Gotham, TextSize = 12,
	Size = UDim2.new(0, 130, 1, -28),
	Position = UDim2.new(1, -134, 0, 24),
	Text = table.concat(Memory.notes or {}, "\n"),
	MultiLine = true,
	ClearTextOnFocus = false,
	TextWrapped = true,
	BorderSizePixel = 0,
})
do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=editMem end
editMem.FocusLost:Connect(function()
	Memory.notes = {}
	for line in string.gmatch(editMem.Text .. "\n", "([^\n]-)\n") do
		if #line>0 then table.insert(Memory.notes, line) end
	end
	saveMemory()
	log("INFO", "Project notes saved to memory.")
end)

-- ---------- AI CHAT PAGE ----------
local chatY = pageTitle(Pages.CHAT, "💬 AI Chat", "Ask me anything about your Roblox game. Code is paste-ready; 'Send to Studio' installs it with one click.")

local ChatDisplay = make(Pages.CHAT, "ScrollingFrame", {
	BackgroundColor3 = C.bg,
	Size = UDim2.new(1, 0, 1, -chatY - 90),
	Position = UDim2.new(0,0,0,chatY+6),
	CanvasSize = UDim2.fromScale(0,0),
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	ScrollBarThickness = 8,
	ScrollBarImageColor3 = C.bronze,
	BorderSizePixel = 0,
})
do
	local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=ChatDisplay
	local l=Instance.new("UIListLayout"); l.Padding=UDim.new(0,8); l.SortOrder=Enum.SortOrder.LayoutOrder
	l.Parent = ChatDisplay
	local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingRight=UDim.new(0,10)
	pad.PaddingTop=UDim.new(0,10); pad.PaddingBottom=UDim.new(0,10); pad.Parent=ChatDisplay
end

local function addChatBubble(role, text)
	local isUser = (role == "user")
	local bubble = make(ChatDisplay, "Frame", {
		BackgroundColor3 = isUser and C.panel2 or C.panel,
		Size = UDim2.new(1, -12, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BorderSizePixel = 0,
	})
	do
		local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,8); c.Parent=bubble
		local s=Instance.new("UIStroke"); s.Color=isUser and C.gold or C.border; s.Thickness=1; s.Parent=bubble
	end
	local header = make(bubble, "TextLabel", {
		BackgroundTransparency=1,
		Text = isUser and "YOU" or "⚔  DevAI",
		TextColor3 = isUser and C.goldLight or C.amber,
		Font=Enum.Font.GothamBlack, TextSize=11,
		Size = UDim2.new(1,-16,0,18),
		Position = UDim2.new(0,8,0,4),
		TextXAlignment=Enum.TextXAlignment.Left,
	})
	local body = make(bubble, "TextLabel", {
		BackgroundTransparency=1,
		Text = text,
		TextColor3 = C.text,
		Font = Enum.Font.RobotoMono,
		TextSize = 12,
		TextWrapped = true,
		Size = UDim2.new(1,-16,0,0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Position = UDim2.new(0,8,0,24),
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top,
	})
	-- Action row for assistant messages
	if not isUser then
		local actions = make(bubble, "Frame", {
			BackgroundTransparency = 1,
			Size = UDim2.new(1,-16,0,30),
			Position = UDim2.new(0,8,1,-30),
			AutomaticSize = Enum.AutomaticSize.Y,
		})
		local codeBlock = extractFirstLuauBlock(text)
		if codeBlock then
			-- Detect script type from hint comments or context
			local scriptType = "Script"
			local target = "ServerScriptService"
			local name = "GeneratedScript"
			if text:lower():find("localscript") or text:lower():find("starterplayerscripts")
				or text:lower():find("startergui") then
				scriptType = "LocalScript"
			elseif text:lower():find("modulescript") then
				scriptType = "ModuleScript"
			end
			local mTarget = text:match("Target:%s*([%w%.]+)") or text:match("belongs in%s+([%w%.]+)")
			if mTarget then target = mTarget end
			local mName = text:match("--%s*([%w_/]+)%.lua[ua]?") or text:match("Name:%s*([%w_]+)")
			if mName then name = mName:gsub("[%./]", "_") end

			local sendBtn = make(actions, "TextButton", {
				Text = "⬆  SEND TO STUDIO  ·  " .. scriptType .. " → " .. target .. "." .. name,
				Size = UDim2.new(1,0,0,26),
				Position = UDim2.new(0,0,0,4),
				TextColor3 = Color3.new(0,0,0),
				Font=Enum.Font.GothamBold,
				TextSize=11,
				BackgroundColor3 = C.gold,
				BorderSizePixel = 0,
				AutoButtonColor = true,
			})
			do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=sendBtn end
			sendBtn.MouseButton1Click:Connect(function()
				AI.sendToStudio({
					kind = "createScript",
					target = target,
					name = name,
					className = scriptType,
					source = codeBlock,
				})
			end)
		end
		-- Copy button
		local copyBtn = make(actions, "TextButton", {
			Text = "📋 Copy",
			Size = UDim2.new(0,90,0,26),
			Position = codeBlock and UDim2.new(1,-90,1,-26) or UDim2.new(1,-90,0,4),
			TextColor3 = C.text,
			Font=Enum.Font.GothamBold,
			TextSize=11,
			BackgroundColor3 = C.panel2,
			BorderSizePixel = 0,
			AutoButtonColor = true,
		})
		do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=copyBtn end
		copyBtn.MouseButton1Click:Connect(function()
			setclipboard(text)
			log("OK", "Message copied to clipboard.")
		end)
	end
	ChatDisplay.CanvasSize = UDim2.new(1,0,0, ChatDisplay.UIListLayout.AbsoluteContentSize.Y + 20)
	task.wait()
	ChatDisplay.CanvasPosition = Vector2.new(0, ChatDisplay.CanvasSize.Y.Offset)
end

-- Quick prompt buttons
local quickPrompts = make(Pages.CHAT, "Frame", {
	BackgroundTransparency=1,
	Size=UDim2.new(1,0,0,32),
	Position=UDim2.new(0,0,1,-78),
})
do local l=Instance.new("UIListLayout"); l.FillDirection=Enum.FillDirection.Horizontal; l.Padding=UDim.new(0,6)
	l.Parent=quickPrompts end
local QPROMPTS = {
	"Create an admin system",
	"Fix this script",
	"Make a combat system",
	"Create an NPC",
	"Scan my game for errors",
	"Optimize my game",
}
for _, q in ipairs(QPROMPTS) do
	local b = make(quickPrompts, "TextButton", {
		Text = q, TextColor3=C.text, Font=Enum.Font.Gotham, TextSize=11,
		Size=UDim2.new(0,160,1,0), BackgroundColor3=C.panel, BorderSizePixel=0,
		AutoButtonColor=true,
	})
	do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=b end
	b.MouseButton1Click:Connect(function()
		ChatInput.Text = q
		ChatInput:CaptureFocus()
	end)
end

-- Chat input row
local ChatInput = make(Pages.CHAT, "TextBox", {
	BackgroundColor3 = C.bg,
	TextColor3 = C.text,
	PlaceholderText = "Ask DevAI:  e.g.  “Create a Tokens currency with DataStore saving.”",
	PlaceholderColor3 = C.textFaint,
	Font = Enum.Font.RobotoMono,
	TextSize = 12,
	Size = UDim2.new(1, -120, 0, 40),
	Position = UDim2.new(0, 0, 1, -42),
	Text = "",
	MultiLine = false,
	ClearTextOnFocus = false,
	TextWrapped = true,
	BorderSizePixel = 0,
})
do
	local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,6); cr.Parent=ChatInput
	local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=ChatInput
	local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingRight=UDim.new(0,10)
	pad.PaddingTop=UDim.new(0,8); pad.PaddingBottom=UDim.new(0,8); pad.Parent=ChatInput
end
local SendBtn = make(Pages.CHAT, "TextButton", {
	Text = "SEND ▶",
	TextColor3 = Color3.new(0,0,0),
	Font = Enum.Font.GothamBlack,
	TextSize = 13,
	Size = UDim2.new(0, 110, 0, 40),
	Position = UDim2.new(1, -112, 1, -42),
	BackgroundColor3 = C.gold,
	BorderSizePixel = 0,
	AutoButtonColor = true,
})
do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,6); cr.Parent=SendBtn end
local ResetBtn = make(Pages.CHAT, "TextButton", {
	Text = "🧹 Clear",
	TextColor3 = C.textDim,
	Font = Enum.Font.Gotham,
	TextSize = 10,
	Size = UDim2.new(0, 60, 0, 18),
	Position = UDim2.new(1, -70, 1, -66),
	BackgroundColor3 = C.panel,
	BorderSizePixel = 0,
	AutoButtonColor = true,
})
do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,3); cr.Parent=ResetBtn end
ResetBtn.MouseButton1Click:Connect(function()
	AI.resetConversation()
	for _, ch in ipairs(ChatDisplay:GetChildren()) do
		if ch:IsA("Frame") then ch:Destroy() end
	end
	addChatBubble("assistant", "History cleared. What are we building?")
end)

local function sendChat()
	local msg = ChatInput.Text
	if not msg or #msg == 0 then return end
	if #msg > 6000 then log("WARN", "Prompt too long."); return end
	addChatBubble("user", msg)
	ChatInput.Text = ""
	local thinking = addChatBubble("assistant", "⌛ Thinking…")
	AI.chat(msg, nil, function(ok, reply)
		thinking:Destroy()
		if not ok then
			addChatBubble("assistant", "❌ " .. reply)
		else
			addChatBubble("assistant", reply)
		end
	end)
end
SendBtn.MouseButton1Click:Connect(sendChat)
ChatInput.FocusLost:Connect(function(ep) if ep then sendChat() end end)

-- Welcome message
addChatBubble("assistant",
	"Hey developer. I'm DevAI — your Roblox Studio co-pilot.\n\n"..
	"Try:  •  \"Create a Tokens currency with RemoteEvent + DataStore saving.\"\n"..
	"      •  \"Scan my game for problems.\"\n"..
	"      •  \"Explain this error: attempt to index nil with 'FindFirstChild'.\"\n\n"..
	"Code blocks include a yellow **SEND TO STUDIO** button for one-click install.")

-- ---------- GAME SCANNER PAGE ----------
local scanY = pageTitle(Pages.SCANNER, "🔍 Game Scanner",
	"Inspects Workspace, Remotes, Scripts, GUI, lighting, and architecture to find problems.")
local ScanBtn = make(Pages.SCANNER, "TextButton", {
	Text = "🔍  SCAN GAME NOW",
	TextColor3 = Color3.new(0,0,0),
	Font = Enum.Font.GothamBlack,
	TextSize = 14,
	Size = UDim2.new(0, 220, 0, 38),
	Position = UDim2.new(0,0,0,scanY+8),
	BackgroundColor3 = C.gold,
	BorderSizePixel = 0,
	AutoButtonColor = true,
})
do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,6); cr.Parent=ScanBtn end
local ScanStatsFrame = make(Pages.SCANNER, "Frame", {
	BackgroundTransparency=1,
	Size=UDim2.new(1,-240,0,38),
	Position=UDim2.new(0,230,0,scanY+8),
})
do local l=Instance.new("UIListLayout"); l.FillDirection=Enum.FillDirection.Horizontal; l.Padding=UDim.new(0,8); l.FillDirection=Enum.FillDirection.Horizontal
	l.Parent=ScanStatsFrame end
local statLabels = {}
for _, k in ipairs({"Scripts","LocalScripts","ModuleScripts","RemoteEvents","RemoteFunctions","Parts"}) do
	local s = make(ScanStatsFrame, "Frame", {
		BackgroundColor3=C.panel, Size=UDim2.new(0,100,1,0), BorderSizePixel=0,
	})
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=s end
	make(s, "TextLabel", { BackgroundTransparency=1, Text=k, TextColor3=C.textDim,
		Font=Enum.Font.Gotham, TextSize=10, Size=UDim2.new(1,0,0,14), Position=UDim2.new(0,0,0,2)})
	local v = make(s, "TextLabel", { BackgroundTransparency=1, Text="-", TextColor3=C.goldLight,
		Font=Enum.Font.GothamBlack, TextSize=16, Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,14)})
	statLabels[k] = v
end

local IssuesList = make(Pages.SCANNER, "ScrollingFrame", {
	BackgroundColor3 = C.bg,
	Size = UDim2.new(1, 0, 1, -scanY - 60),
	Position = UDim2.new(0,0,0,scanY+56),
	CanvasSize = UDim2.fromScale(0,0),
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	ScrollBarThickness = 8,
	ScrollBarImageColor3 = C.bronze,
	BorderSizePixel = 0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=IssuesList
	local l=Instance.new("UIListLayout"); l.Padding=UDim.new(0,4); l.SortOrder=Enum.SortOrder.LayoutOrder; l.Parent=IssuesList
	local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.PaddingRight=UDim.new(0,8)
	pad.PaddingTop=UDim.new(0,8); pad.PaddingBottom=UDim.new(0,8); pad.Parent=IssuesList
end

function refreshScanner()
	for _, ch in ipairs(IssuesList:GetChildren()) do if ch:IsA("Frame") then ch:Destroy() end end
	local summary = fullScan()
	for k, v in pairs(summary.counts) do
		if statLabels[k] then statLabels[k].Text = tostring(v) end
	end
	-- Sort: CRITICAL first, then WARN, then OPT, then GOOD
	local order = { CRITICAL=1, WARN=2, OPT=3, GOOD=4 }
	table.sort(summary.issues, function(a,b)
		return (order[a.severity] or 9) < (order[b.severity] or 9)
	end)
	if #summary.issues == 0 then
		make(IssuesList, "TextLabel", { BackgroundTransparency=1,
			Text = "🟢 No issues detected. Clean game!", TextColor3=C.green,
			Font=Enum.Font.GothamBold, TextSize=14, Size=UDim2.new(1,0,0,30) })
	end
	for _, iss in ipairs(summary.issues) do
		local row = make(IssuesList, "Frame", {
			BackgroundColor3 = C.panel,
			Size = UDim2.new(1, -16, 0, 52),
			AutomaticSize = Enum.AutomaticSize.Y,
			BorderSizePixel = 0,
		})
		do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=row
		   local s=Instance.new("UIStroke"); s.Color=severityColor(iss.severity); s.Thickness=1; s.Parent=row end
		make(row, "TextLabel", { BackgroundTransparency=1,
			Text = severityIcon(iss.severity) .. "  [" .. iss.severity .. "]  " .. iss.kind,
			TextColor3 = severityColor(iss.severity),
			Font=Enum.Font.GothamBlack, TextSize=12, Size=UDim2.new(1,-16,0,18),
			Position=UDim2.new(0,8,0,4), TextXAlignment=Enum.TextXAlignment.Left })
		make(row, "TextLabel", { BackgroundTransparency=1,
			Text = iss.obj,
			TextColor3 = C.goldLight,
			Font=Enum.Font.RobotoMono, TextSize=11, Size=UDim2.new(1,-16,0,16),
			Position=UDim2.new(0,8,0,22), TextXAlignment=Enum.TextXAlignment.Left })
		make(row, "TextLabel", { BackgroundTransparency=1,
			Text = iss.msg,
			TextColor3 = C.text,
			Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,-16,0,16),
			Position=UDim2.new(0,8,0,36), TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true })
		-- Open path button
		local openBtn = make(row, "TextButton", {
			Text = "📂 Open", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=10,
			Size=UDim2.new(0,70,0,22), Position=UDim2.new(1,-80,0,4),
			BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
		})
		do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,3); c.Parent=openBtn end
		openBtn.MouseButton1Click:Connect(function()
			local obj = resolvePath(iss.obj)
			if obj then
				Selection:Set({obj})
				log("OK", "Selected: " .. obj:GetFullName())
			else
				log("WARN", "Could not resolve object: " .. iss.obj)
			end
		end)
	end
end
ScanBtn.MouseButton1Click:Connect(refreshScanner)

-- ---------- SCRIPTS PAGE ----------
local scrY = pageTitle(Pages.SCRIPTS, "📜 AI Script Generator",
	"Pick a script type, describe what you want, and DevAI writes complete, documented Luau.")
local scriptType = "Script"
local typeLbl = make(Pages.SCRIPTS, "TextLabel", {
	BackgroundTransparency=1, Text="Script type:", TextColor3=C.textDim,
	Font=Enum.Font.Gotham, TextSize=12, Size=UDim2.new(0,80,0,30),
	Position=UDim2.new(0,0,0,scrY+8),
})
local typeBtns = {}
local TYPES = { "ServerScript (Script)", "LocalScript", "ModuleScript" }
for i, t in ipairs(TYPES) do
	local b = make(Pages.SCRIPTS, "TextButton", {
		Text = t, TextColor3 = C.text,
		Font=Enum.Font.GothamBold, TextSize=11,
		Size=UDim2.new(0,150,0,30),
		Position=UDim2.new(0, 85 + (i-1)*160, 0, scrY+8),
		BackgroundColor3 = C.panel2, BorderSizePixel=0, AutoButtonColor=true,
	})
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=b end
	b.MouseButton1Click:Connect(function()
		scriptType = t:match("^[^%s]+"):gsub("%(.*","")
		if scriptType == "ServerScript" then scriptType = "Script" end
		for _, bb in ipairs(typeBtns) do bb.BackgroundColor3 = C.panel2 end
		b.BackgroundColor3 = C.gold
		b.TextColor3 = Color3.new(0,0,0)
	end)
	table.insert(typeBtns, b)
end
typeBtns[1].BackgroundColor3 = C.gold
typeBtns[1].TextColor3 = Color3.new(0,0,0)

make(Pages.SCRIPTS, "TextLabel", {
	BackgroundTransparency=1, Text="Target path (e.g. ServerScriptService.Systems.Combat):",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=12,
	Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,scrY+46),
	TextXAlignment=Enum.TextXAlignment.Left,
})
local targetBox = make(Pages.SCRIPTS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="ServerScriptService.Systems.Combat",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,0,0,30), Position=UDim2.new(0,0,0,scrY+68),
	Text="ServerScriptService.Systems", ClearTextOnFocus=false, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=targetBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=targetBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.Parent=targetBox end

make(Pages.SCRIPTS, "TextLabel", {
	BackgroundTransparency=1, Text="Script name:",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=12,
	Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,scrY+102),
	TextXAlignment=Enum.TextXAlignment.Left,
})
local nameBox = make(Pages.SCRIPTS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="e.g. CombatSystem",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,0,0,30), Position=UDim2.new(0,0,0,scrY+124),
	Text="", ClearTextOnFocus=false, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=nameBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=nameBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.Parent=nameBox end

make(Pages.SCRIPTS, "TextLabel", {
	BackgroundTransparency=1, Text="Describe the script:",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=12,
	Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,scrY+158),
	TextXAlignment=Enum.TextXAlignment.Left,
})
local descBox = make(Pages.SCRIPTS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	PlaceholderText="Describe what the script should do. Be specific: inputs, outputs, events, security checks, etc.",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,0,0,120), Position=UDim2.new(0,0,0,scrY+180),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=descBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=descBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.PaddingTop=UDim.new(0,8); pad.Parent=descBox end

local genBtn = make(Pages.SCRIPTS, "TextButton", {
	Text = "✨  GENERATE SCRIPT",
	TextColor3 = Color3.new(0,0,0),
	Font=Enum.Font.GothamBlack, TextSize=14,
	Size=UDim2.new(0,220,0,40),
	Position=UDim2.new(0,0,0,scrY+310),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=genBtn end

local scriptOutput = make(Pages.SCRIPTS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.moss,
	Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,0,1,-scrY-370),
	Position=UDim2.new(0,0,0,scrY+360),
	Text="(generated code will appear here)",
	ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=scriptOutput
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=scriptOutput
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,10); pad.Parent=scriptOutput end

genBtn.MouseButton1Click:Connect(function()
	if not canDo("generate") then log("ERR", "Permission denied."); return end
	local target = targetBox.Text
	local sname = nameBox.Text
	local desc = descBox.Text
	if #desc < 4 then log("WARN", "Add a description first."); return end
	if #sname == 0 then sname = "GeneratedScript" end
	scriptOutput.Text = "⏳ Generating..."
	local prompt = string.format(
		"Generate a complete Roblox %s named '%s' that will be placed in %s.\n\nRequirements:\n%s\n\n"..
		"Output a fenced ```luau code block. Start with a comment:\n"..
		"-- Target: %s\n-- Name: %s\n\n"..
		"Include error handling, security checks, and comments. Use modern Luau.",
		scriptType, sname, target, desc, target, sname)
	AI.chat(prompt, nil, function(ok, reply)
		if not ok then scriptOutput.Text = "❌ " .. reply; return end
		scriptOutput.Text = reply
		local code = extractFirstLuauBlock(reply)
		if code then
			AI.sendToStudio({
				kind = "createScript",
				target = target,
				name = sname,
				className = scriptType,
				source = code,
			})
		end
	end)
end)

-- ---------- BUILDER PAGE ----------
local bldY = pageTitle(Pages.BUILDER, "🏗️ AI Game Builder",
	"Describe what you want built — castle, obby, arena, village, forest — and DevAI generates a model-building script.")
local bldPrompt = make(Pages.BUILDER, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	PlaceholderText="e.g.  “Create a medieval fighting arena with 4 team spawns, a center weapon rack, and spectator stands.”",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,0,0,100), Position=UDim2.new(0,0,0,bldY+8),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=bldPrompt
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=bldPrompt
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.Parent=bldPrompt end

local buildBtn = make(Pages.BUILDER, "TextButton", {
	Text = "🏰  BUILD IT",
	TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBlack, TextSize=14,
	Size=UDim2.new(0,200,0,40), Position=UDim2.new(0,0,0,bldY+118),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=buildBtn end

-- Quick build presets
local presetsFrame = make(Pages.BUILDER, "Frame", {
	BackgroundTransparency=1,
	Size=UDim2.new(1,-220,0,40),
	Position=UDim2.new(0,220,0,bldY+118),
})
do local l=Instance.new("UIListLayout"); l.FillDirection=Enum.FillDirection.Horizontal; l.Padding=UDim.new(0,6); l.Parent=presetsFrame end
local PRESETS = {"Castle", "Obby", "Fighting Arena", "NPC Village", "Dev Testing Area", "Rainforest"}
for _, p in ipairs(PRESETS) do
	local b = make(presetsFrame, "TextButton", {
		Text=p, TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=11,
		Size=UDim2.new(0,120,1,0), BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
	})
	do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=b end
	b.MouseButton1Click:Connect(function() bldPrompt.Text = "Create a " .. p .. "." end)
end

local buildOutput = make(Pages.BUILDER, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.moss,
	Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,0,1,-bldY-170),
	Position=UDim2.new(0,0,0,bldY+170),
	Text="(generated build script will appear here — click SEND TO STUDIO to run it as a server Script, or copy into the Command Bar to execute immediately.)",
	ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=buildOutput
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=buildOutput
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,10); pad.Parent=buildOutput end

buildBtn.MouseButton1Click:Connect(function()
	local desc = bldPrompt.Text
	if #desc < 4 then log("WARN", "Describe what to build first."); return end
	buildOutput.Text = "⏳ Designing..."
	local prompt = string.format(
		"Write a complete Luau script that, when run inside Roblox Studio (as a Script in Workspace or via Command Bar), BUILDS the following by creating Parts/Models/Folders in Workspace:\n\n"..
		"%s\n\n"..
		"Organize everything under a Model named after the build (e.g. 'Castle', 'Arena'). Use Anchored parts. Use PBR colors (Color3.fromHex if you want to name hex; else Color3.new). Add named sections with comments. Use task.spawn only if helpful. Keep it optimized.\n\n"..
		"Output ONLY a fenced ```luau block. After the block, briefly describe the hierarchy created.",
		desc)
	AI.chat(prompt, nil, function(ok, reply)
		if not ok then buildOutput.Text = "❌ "..reply; return end
		buildOutput.Text = reply
		local code = extractFirstLuauBlock(reply)
		if code then
			-- Offer to put builder script in ServerScriptService.BuildScripts
			AI.sendToStudio({
				kind = "createScript",
				target = "ServerScriptService",
				name = "Builder_" .. os.date("%H%M%S"),
				className = "Script",
				source = code,
			})
		end
	end)
end)

-- ---------- EXPLORER PAGE ----------
local expY = pageTitle(Pages.EXPLORER, "📁 Explorer Tree",
	"View your DataModel in-tree. Click any object to select it in Studio's Properties.")
local refreshExplorerBtn = make(Pages.EXPLORER, "TextButton", {
	Text="🔄 Refresh", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(0,120,0,30), Position=UDim2.new(1,-120,0,expY+4),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=refreshExplorerBtn end

local ExplorerTree = make(Pages.EXPLORER, "ScrollingFrame", {
	BackgroundColor3=C.bg, Size=UDim2.new(1,0,1,-expY-50),
	Position=UDim2.new(0,0,0,expY+40), CanvasSize=UDim2.fromScale(0,0),
	AutomaticCanvasSize=Enum.AutomaticSize.Y, ScrollBarThickness=8,
	ScrollBarImageColor3=C.bronze, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=ExplorerTree
	local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.PaddingTop=UDim.new(0,8); pad.Parent=ExplorerTree end

function rebuildExplorer()
	for _, ch in ipairs(ExplorerTree:GetChildren()) do if ch:IsA("GuiObject") then ch:Destroy() end end
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Vertical
	layout.Padding = UDim.new(0,1)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = ExplorerTree

	local iconFor = {
		Script = "📜", LocalScript = "📄", ModuleScript = "📦",
		RemoteEvent = "📡", RemoteFunction = "📡", UnreliableRemoteEvent = "📡",
		Folder = "📁", Model = "🧊", Part = "▣", MeshPart = "▣",
		ScreenGui = "🖼", Frame = "▢", TextLabel = "A", TextButton = "🔘",
	}
	local function addNode(obj, depth, order)
		local icon = iconFor[obj.ClassName] or "•"
		local color = C.text
		if obj:IsA("BaseScript") then color = C.moss end
		if obj.ClassName:find("Remote") then color = C.amber end
		if obj:IsA("Folder") or obj:IsA("Model") then color = C.goldLight end
		local btn = make(ExplorerTree, "TextButton", {
			BackgroundColor3 = C.panel2, BackgroundTransparency = 0.85,
			Text = string.rep("  ", depth) .. icon .. " " .. obj.Name .. "  ["..obj.ClassName.."]",
			TextColor3 = color, Font = Enum.Font.RobotoMono, TextSize = 11,
			Size = UDim2.new(1,-16,0,20),
			TextXAlignment = Enum.TextXAlignment.Left,
			BorderSizePixel = 0,
			AutoButtonColor = true,
			LayoutOrder = order,
		})
		do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,3); cr.Parent=btn end
		btn.MouseButton1Click:Connect(function()
			Selection:Set({obj})
			log("OK", "Selected: " .. obj:GetFullName())
		end)
		btn.MouseButton2Click:Connect(function()
			-- Right-click: insert into chat prompt for quick questions
			ChatInput.Text = "Tell me about " .. obj:GetFullName() .. "."
			switchPage("CHAT")
		end)
		local children = obj:GetChildren()
		table.sort(children, function(a,b)
			if a.ClassName ~= b.ClassName then return a.ClassName < b.ClassName end
			return a.Name < b.Name
		end)
		local n = order + 1
		-- Limit depth to avoid huge UI on enormous games
		if depth < 6 then
			for _, ch in ipairs(children) do
				n = addNode(ch, depth+1, n)
			end
		end
		return n
	end
	local n = 0
	for _, svcName in ipairs(IMPORTANT_SERVICES) do
		local ok, svc = pcall(function() return game:GetService(svcName) end)
		if ok then n = addNode(svc, 0, n); n = n + 1 end
	end
end
refreshExplorerBtn.MouseButton1Click:Connect(rebuildExplorer)

-- ---------- 3D MODELS PAGE ----------
local mdlY = pageTitle(Pages.MODELS, "🧊 AI 3D Model Generator",
	"Generate actual 3D meshes (GLB/OBJ/FBX) from text using Meshy's AI. Free tier: 200 credits/month @ meshy.ai.")

-- Info banner
local meshInfo = make(Pages.MODELS, "TextLabel", {
	BackgroundTransparency=1,
	Text="Describe an object and click GENERATE. The preview takes ~20 seconds. When done, click ⬇ DOWNLOAD GLB and drag the file into Workspace or into a MeshPart.MeshId after uploading.",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
	Size=UDim2.new(1,0,0,36), Position=UDim2.new(0,0,0,mdlY),
	TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})
mdlY = mdlY + 44

-- Prompt box
make(Pages.MODELS, "TextLabel", {
	BackgroundTransparency=1, Text="Prompt", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,120,0,22),
	Position=UDim2.new(0,0,0,mdlY), TextXAlignment=Enum.TextXAlignment.Left,
})
local meshPromptBox = make(Pages.MODELS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	PlaceholderText="e.g. A weathered golden-brown stone sword with bronze hilt and glowing amber runes, fantasy game asset, centered, high detail",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,-130,0,70), Position=UDim2.new(0,120,0,mdlY),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=meshPromptBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=meshPromptBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.Parent=meshPromptBox end
mdlY = mdlY + 80

-- Art style selector
make(Pages.MODELS, "TextLabel", {
	BackgroundTransparency=1, Text="Art style", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,120,0,28),
	Position=UDim2.new(0,0,0,mdlY), TextXAlignment=Enum.TextXAlignment.Left,
})
local styleNames = {"realistic","cartoon","low-poly","sculpture"}
local styleIdx = 1
for i,s in ipairs(styleNames) do if s == Settings.meshyArtStyle then styleIdx = i end end
local styleBtn = make(Pages.MODELS, "TextButton", {
	Text = Settings.meshyArtStyle or "realistic",
	TextColor3 = Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(0,180,0,28), Position=UDim2.new(0,120,0,mdlY),
	BackgroundColor3=C.bronze, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=styleBtn end
styleBtn.MouseButton1Click:Connect(function()
	styleIdx = (styleIdx % #styleNames) + 1
	local s = styleNames[styleIdx]
	styleBtn.Text = s
	saveSetting("meshyArtStyle", s)
end)
mdlY = mdlY + 38

-- Generate button
local genMeshBtn = make(Pages.MODELS, "TextButton", {
	Text="✨ GENERATE 3D MODEL", TextColor3=Color3.new(0,0,0),
	Font=Enum.Font.GothamBlack, TextSize=14,
	Size=UDim2.new(0,220,0,40), Position=UDim2.new(0,0,0,mdlY),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=genMeshBtn end

local refineBtn = make(Pages.MODELS, "TextButton", {
	Text="🌟 REFINE (add PBR textures)", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(0,240,0,40), Position=UDim2.new(0,230,0,mdlY),
	BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=refineBtn end
refineBtn.Visible = false

local statusLbl = make(Pages.MODELS, "TextLabel", {
	BackgroundTransparency=1, Text="Ready.", TextColor3=C.textDim,
	Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,-480,0,40),
	Position=UDim2.new(0,480,0,mdlY), TextXAlignment=Enum.TextXAlignment.Left,
	TextWrapped=true,
})
mdlY = mdlY + 50

-- Progress bar
local progressBg = make(Pages.MODELS, "Frame", {
	BackgroundColor3=C.panel2, Size=UDim2.new(1,0,0,10),
	Position=UDim2.new(0,0,0,mdlY), BorderSizePixel=0, Visible=false,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=progressBg end
local progressFill = make(progressBg, "Frame", {
	BackgroundColor3=C.gold, Size=UDim2.new(0,0,1,0), Position=UDim2.fromScale(0,0), BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=progressFill end
mdlY = mdlY + 20

-- Result card
local resultCard = make(Pages.MODELS, "Frame", {
	BackgroundColor3=C.panel, Size=UDim2.new(1,0,0,280),
	Position=UDim2.new(0,0,0,mdlY), BorderSizePixel=0, Visible=false,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,8); c.Parent=resultCard
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=resultCard
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,14); pad.PaddingRight=UDim.new(0,14)
   pad.PaddingTop=UDim.new(0,12); pad.PaddingBottom=UDim.new(0,12); pad.Parent=resultCard end
make(resultCard, "TextLabel", {
	BackgroundTransparency=1, Text="✅ Model Ready", TextColor3=C.moss,
	Font=Enum.Font.GothamBlack, TextSize=16, Size=UDim2.new(1,0,0,24),
	TextXAlignment=Enum.TextXAlignment.Left,
})
local resultInfo = make(resultCard, "TextLabel", {
	BackgroundTransparency=1, Text="", TextColor3=C.text,
	Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,0,0,20),
	Position=UDim2.new(0,0,0,26), TextXAlignment=Enum.TextXAlignment.Left,
})
-- Thumbnail
local thumbImg = make(resultCard, "ImageLabel", {
	BackgroundColor3=C.bg, Size=UDim2.new(0,200,0,200),
	Position=UDim2.new(0,0,0,54), BorderSizePixel=0,
	BackgroundTransparency=0, ScaleType=Enum.ScaleType.Fit,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=thumbImg end
-- Download buttons column
local btnX = 220
local dlGlb = make(resultCard, "TextButton", {
	Text="⬇  Download GLB", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,-230,0,30), Position=UDim2.new(0,btnX,0,54),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=dlGlb end
local dlFbx = make(resultCard, "TextButton", {
	Text="⬇  Download FBX", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,-230,0,30), Position=UDim2.new(0,btnX,0,90),
	BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=dlFbx end
local dlObj = make(resultCard, "TextButton", {
	Text="⬇  Download OBJ", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,-230,0,30), Position=UDim2.new(0,btnX,0,126),
	BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=dlObj end
local copyLinkBtn = make(resultCard, "TextButton", {
	Text="📋 Copy GLB Link", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,-230,0,30), Position=UDim2.new(0,btnX,0,162),
	BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=copyLinkBtn end
local helpLbl = make(resultCard, "TextLabel", {
	BackgroundTransparency=1,
	Text="To use in Roblox: download GLB → in Studio, right-click Meshes → Insert Mesh → select file → drag into Workspace as a MeshPart, or right-click Asset Manager → Bulk Import.",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=10,
	Size=UDim2.new(1,-230,0,60), Position=UDim2.new(0,btnX,0,200),
	TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})

-- State
local currentTaskId = nil
local currentModelUrls = {}

local function showResult(data)
	resultCard.Visible = true
	currentModelUrls = data.model_urls or {}
	-- Populate thumbnail if available
	if data.thumbnail_url then
		thumbImg.Image = data.thumbnail_url
	else
		thumbImg.Image = ""
	end
	resultInfo.Text = string.format("Model: %s  ·  Tris: %s  ·  Texts: %s",
		tostring(data.id or "?"),
		tostring(data.trigger == "preview" and "preview" or "refined"),
		"PBR"
	)
	-- Enable/disable buttons based on available formats
	dlGlb.Visible = not not currentModelUrls.glb
	dlFbx.Visible = not not currentModelUrls.fbx
	dlObj.Visible = not not currentModelUrls.obj
end

genMeshBtn.MouseButton1Click:Connect(function()
	local prompt = meshPromptBox.Text
	if #prompt < 4 then statusLbl.Text = "Enter a prompt first."; statusLbl.TextColor3 = C.red; return end
	if not Settings.meshyApiKey or #Settings.meshyApiKey == 0 then
		statusLbl.Text = "Add a Meshy key in Settings first (free from meshy.ai/settings/api)."
		statusLbl.TextColor3 = C.red
		return
	end
	genMeshBtn.Text = "…generating preview…"
	genMeshBtn.BackgroundColor3 = C.panel2
	genMeshBtn.TextColor3 = C.text
	statusLbl.Text = "Submitting preview task…"
	statusLbl.TextColor3 = C.amber
	progressBg.Visible = true
	progressFill.Size = UDim2.new(0,0,1,0)
	resultCard.Visible = false
	refineBtn.Visible = false
	Meshy.createPreview(prompt, Settings.meshyArtStyle, function(ok, taskId)
		if not ok then
			statusLbl.Text = "❌ " .. tostring(taskId)
			statusLbl.TextColor3 = C.red
			progressBg.Visible = false
			genMeshBtn.Text = "✨ GENERATE 3D MODEL"
			genMeshBtn.BackgroundColor3 = C.gold
			genMeshBtn.TextColor3 = Color3.new(0,0,0)
			log("ERR", "Meshy preview: " .. tostring(taskId))
			return
		end
		currentTaskId = taskId
		log("INFO", "Meshy preview task: " .. taskId)
		statusLbl.Text = "⏳ Meshy is generating your preview (≈20s)…"
		statusLbl.TextColor3 = C.amber
		Meshy.pollUntilDone(taskId,
			function(status, progress)
				progressFill.Size = UDim2.new(math.clamp(progress/100, 0, 1), 0, 1, 0)
				statusLbl.Text = string.format("⏳ %s — %d%%", status, math.floor(progress or 0))
			end,
			function(ok, data)
				genMeshBtn.Text = "✨ GENERATE 3D MODEL"
				genMeshBtn.BackgroundColor3 = C.gold
				genMeshBtn.TextColor3 = Color3.new(0,0,0)
				progressBg.Visible = false
				if not ok then
					statusLbl.Text = "❌ Generation failed: " .. tostring(data)
					statusLbl.TextColor3 = C.red
					return
				end
				statusLbl.Text = "✅ Preview ready! Click REFINE for PBR textures, or download the preview GLB."
				statusLbl.TextColor3 = C.moss
				showResult(data)
				refineBtn.Visible = true
				log("OK", "Meshy preview done.")
			end)
	end)
end)

refineBtn.MouseButton1Click:Connect(function()
	if not currentTaskId then return end
	refineBtn.Text = "…refining (≈1min)…"
	refineBtn.BackgroundColor3 = C.panel2
	refineBtn.TextColor3 = C.text
	statusLbl.Text = "⏳ Refining with PBR textures…"
	statusLbl.TextColor3 = C.amber
	progressBg.Visible = true
	progressFill.Size = UDim2.new(0,0,1,0)
	Meshy.refinePreview(currentTaskId, function(ok, taskId)
		if not ok then
			statusLbl.Text = "❌ Refine failed: " .. tostring(taskId)
			statusLbl.TextColor3 = C.red
			progressBg.Visible = false
			refineBtn.Text = "🌟 REFINE (add PBR textures)"
			refineBtn.BackgroundColor3 = C.gold
			refineBtn.TextColor3 = Color3.new(0,0,0)
			return
		end
		currentTaskId = taskId
		Meshy.pollUntilDone(taskId,
			function(status, progress)
				progressFill.Size = UDim2.new(math.clamp(progress/100,0,1),0,1,0)
				statusLbl.Text = string.format("⏳ %s — %d%%", status, math.floor(progress or 0))
			end,
			function(ok, data)
				progressBg.Visible = false
				refineBtn.Text = "🌟 REFINE (add PBR textures)"
				refineBtn.BackgroundColor3 = C.gold
				refineBtn.TextColor3 = Color3.new(0,0,0)
				if not ok then
					statusLbl.Text = "❌ Refine failed: " .. tostring(data)
					statusLbl.TextColor3 = C.red
					return
				end
				statusLbl.Text = "✅ Refined PBR model ready — download the GLB!"
				statusLbl.TextColor3 = C.moss
				showResult(data)
				log("OK", "Meshy refine done.")
			end)
	end)
end)

-- Download helpers: Studio plugins can't write to disk directly, but we can open URLs in browser
-- and copy links to clipboard for the user to paste.
local function openUrl(url)
	if not url then return end
	-- Best-effort: set clipboard + print instructions to output window
	setclipboard(url)
	print("[DevAI] Download link copied to clipboard: " .. url)
	-- Try to open in browser via StudioService:
	pcall(function() StudioService:OpenScript(url) end)  -- no-op fallback
	-- Some Roblox versions support:
	pcall(function() game:GetService("BrowserService"):OpenBrowserWindow(url) end)
end
dlGlb.MouseButton1Click:Connect(function()
	local url = currentModelUrls.glb
	if url then
		setclipboard(url)
		statusLbl.Text = "📋 GLB link copied to clipboard. Paste into your browser to download (https://...)."
		statusLbl.TextColor3 = C.goldLight
		print("[DevAI] GLB download URL: " .. url)
	end
end)
dlFbx.MouseButton1Click:Connect(function()
	if currentModelUrls.fbx then
		setclipboard(currentModelUrls.fbx)
		statusLbl.Text = "📋 FBX link copied to clipboard."
		statusLbl.TextColor3 = C.goldLight
		print("[DevAI] FBX download URL: " .. currentModelUrls.fbx)
	end
end)
dlObj.MouseButton1Click:Connect(function()
	if currentModelUrls.obj then
		setclipboard(currentModelUrls.obj)
		statusLbl.Text = "📋 OBJ link copied to clipboard."
		statusLbl.TextColor3 = C.goldLight
		print("[DevAI] OBJ download URL: " .. currentModelUrls.obj)
	end
end)
copyLinkBtn.MouseButton1Click:Connect(function()
	if currentModelUrls.glb then
		setclipboard(currentModelUrls.glb)
		statusLbl.Text = "📋 GLB URL copied to clipboard."
		statusLbl.TextColor3 = C.goldLight
	end
end)

-- ---------- TESTING PAGE ----------
local tstY = pageTitle(Pages.TESTING, "🧪 Developer Testing Lab",
	"One-click testers for common Roblox systems. Isolated so they don't interfere with your game.")
local testList = make(Pages.TESTING, "Frame", {
	BackgroundTransparency=1, Size=UDim2.new(1,0,1,-tstY), Position=UDim2.new(0,0,0,tstY),
})
do local gl=Instance.new("UIGridLayout"); gl.CellSize=UDim2.new(0.48,-6,0,110); gl.CellPadding=UDim2.fromOffset(8,8)
	gl.Parent=testList end

local TESTS = {
	{ id="npc", name="🧟 NPC Testing", desc="Spawns a test NPC with Humanoid & simple chat." },
	{ id="combat", name="⚔️ Combat Testing", desc="Creates a sample sword tool + damage handler." },
	{ id="obby", name="🥾 Obby Testing", desc="Spawns a 20-part obby with checkpoints + kill bricks." },
	{ id="physics", name="⚽ Physics Testing", desc="Drops sample parts of varying materials." },
	{ id="vehicle", name="🚗 Vehicle Testing", desc="Spawns a simple chassis vehicle with Seat." },
	{ id="animation", name="💃 Animation Testing", desc="Loads a test Animation on an NPC rig." },
	{ id="ui", name="🖼 UI Testing", desc="Spawns a test ScreenGui with buttons/sliders." },
	{ id="sound", name="🔊 Sound Testing", desc="Plays ambient sound in a test zone." },
	{ id="lighting", name="💡 Lighting Testing", desc="Cycles Lighting presets (sunset, night, fog)." },
	{ id="perf", name="📊 Performance Testing", desc="Spawns 500 test parts to measure FPS." },
	{ id="remote", name="📡 RemoteEvent Testing", desc="Creates a test Remote + client→server ping." },
	{ id="datastore", name="💾 DataStore Testing", desc="Test GetAsync/SetAsync/UpdateAsync cycle." },
}
-- We generate the scripts on demand via AI so they stay high-quality & adapted.
for _, t in ipairs(TESTS) do
	local card = make(testList, "Frame", {
		BackgroundColor3=C.panel, Size=UDim2.new(1,0,0,110), BorderSizePixel=0,
	})
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=card
	   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=card
	   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.PaddingRight=UDim.new(0,10); pad.Parent=card end
	make(card, "TextLabel", { BackgroundTransparency=1, Text=t.name, TextColor3=C.goldLight,
		Font=Enum.Font.GothamBlack, TextSize=14, Size=UDim2.new(1,0,0,22), TextXAlignment=Enum.TextXAlignment.Left })
	make(card, "TextLabel", { BackgroundTransparency=1, Text=t.desc, TextColor3=C.text,
		Font=Enum.Font.Gotham, TextSize=11, Size=UDim2.new(1,0,0,40), Position=UDim2.new(0,0,0,24),
		TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true })
	local runBtn = make(card, "TextButton", {
		Text="▶ Generate & Deploy", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
		Size=UDim2.new(0,160,0,28), Position=UDim2.new(0,0,1,-30),
		BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
	})
	do local cr=Instance.new("UICorner"); cr.CornerRadius=UDim.new(0,4); cr.Parent=runBtn end
	runBtn.MouseButton1Click:Connect(function()
		switchPage("CHAT")
		ChatInput.Text = "Create a self-contained " .. t.name .. " system I can drop into a blank place. Include all remotes, folders, and instructions. Make it isolated so it doesn't conflict with existing systems. Test name prefix: DevAI_" .. t.id .. "_."
		sendChat()
	end)
end

-- ---------- ERRORS PAGE ----------
local errY = pageTitle(Pages.ERRORS, "🐞 Error Explainer & Debugger",
	"Paste an error message. DevAI explains what it means, likely causes, and fixes.")
make(Pages.ERRORS, "TextLabel", {
	BackgroundTransparency=1, Text="Paste error message:", TextColor3=C.textDim,
	Font=Enum.Font.Gotham, TextSize=12, Size=UDim2.new(1,0,0,20),
	Position=UDim2.new(0,0,0,errY+8), TextXAlignment=Enum.TextXAlignment.Left,
})
local errBox = make(Pages.ERRORS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	PlaceholderText="e.g.  Workspace.Script:7: attempt to index nil with 'FindFirstChild'",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=12,
	Size=UDim2.new(1,0,0,80), Position=UDim2.new(0,0,0,errY+30),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=errBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=errBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.Parent=errBox end

local errBtn = make(Pages.ERRORS, "TextButton", {
	Text="🐞 EXPLAIN & FIX", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBlack, TextSize=13,
	Size=UDim2.new(0,180,0,38), Position=UDim2.new(0,0,0,errY+120),
	BackgroundColor3=C.red, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=errBtn end

local errOut = make(Pages.ERRORS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,0,1,-errY-170), Position=UDim2.new(0,0,0,errY+170),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=errOut
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=errOut
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,10); pad.Parent=errOut end

errBtn.MouseButton1Click:Connect(function()
	local err = errBox.Text
	if #err < 4 then log("WARN", "Paste an error first."); return end
	errOut.Text = "⏳ Analyzing..."
	switchPage("CHAT")
	addChatBubble("user", "Debug this Roblox error:\n" .. err .. "\n\nExplain what it means (1), likely cause (2), where to look (3), provide corrected code (4), and tell me exactly where to put it (5).")
	AI.chat("Debug this Roblox error:\n" .. err .. "\n\nExplain what it means, likely cause, where to look, and provide corrected code. Structure your answer with numbered sections 1-5.", nil, function(ok, reply)
		if ok then addChatBubble("assistant", reply) end
	end)
end)

-- ---------- CONSOLE PAGE ----------
local conY = pageTitle(Pages.CONSOLE, "🖥 DevAI Console", "Internal DevAI log output. Scrolls automatically.")
ConsoleList = make(Pages.CONSOLE, "ScrollingFrame", {
	BackgroundColor3=C.bg, Size=UDim2.new(1,0,1,-conY-10),
	Position=UDim2.new(0,0,0,conY+8), CanvasSize=UDim2.fromScale(0,0),
	ScrollBarThickness=8, ScrollBarImageColor3=C.bronze, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=ConsoleList
	local l=Instance.new("UIListLayout"); l.Padding=UDim.new(0,0); l.SortOrder=Enum.SortOrder.LayoutOrder; l.Parent=ConsoleList
	local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.PaddingTop=UDim.new(0,8); pad.Parent=ConsoleList end

-- Replay existing lines into the now-built ConsoleList
for _, e in ipairs(ConsoleLines) do
	make(ConsoleList, "TextLabel", {
		BackgroundTransparency=1,
		Text=string.format("[%s] [%s] %s", e.t, e.level, e.msg),
		TextColor3=({INFO=C.textDim,OK=C.green,WARN=C.orange,ERR=C.red,AI=C.amber,SYS=C.gold})[e.level] or C.text,
		Font=Enum.Font.RobotoMono, TextSize=11, Size=UDim2.new(1,-8,0,18),
		TextXAlignment=Enum.TextXAlignment.Left,
	})
end

-- ---------- SETTINGS PAGE ----------
local setY = pageTitle(Pages.SETTINGS, "⚙️ Settings",
	"Configure DevAI. Your API key stays in this Studio install (Plugin:SetSetting), never in your game.")
local function makeSettingRow(label, kind, key, y, opts)
	opts = opts or {}
	local l = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text=label, TextColor3=C.text,
		Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
		Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
	})
	local input
	if kind == "checkbox" then
		input = make(Pages.SETTINGS, "TextButton", {
			BackgroundColor3 = Settings[key] and C.moss or C.panel2,
			Text = Settings[key] and "✓ ON" or "✗ OFF",
			TextColor3 = Settings[key] and Color3.new(0,0,0) or C.text,
			Font=Enum.Font.GothamBold, TextSize=11,
			Size=UDim2.new(0,80,0,28), Position=UDim2.new(0,220,0,y),
			BorderSizePixel=0, AutoButtonColor=true,
		})
		do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=input end
		input.MouseButton1Click:Connect(function()
			saveSetting(key, not Settings[key])
			input.BackgroundColor3 = Settings[key] and C.moss or C.panel2
			input.Text = Settings[key] and "✓ ON" or "✗ OFF"
			input.TextColor3 = Settings[key] and Color3.new(0,0,0) or C.text
			log("OK", "Toggled " .. key .. " = " .. tostring(Settings[key]))
		end)
		return input
	elseif kind == "text" or kind == "password" or kind == "number" then
		local initialVal = Settings[key] or ""
		input = make(Pages.SETTINGS, "TextBox", {
			BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText=opts.placeholder or "",
			PlaceholderColor3=C.textFaint,
			Font=Enum.Font.RobotoMono, TextSize=11,
			Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
			Text=tostring(initialVal), ClearTextOnFocus=false, BorderSizePixel=0,
		})
	end
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=input
	   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=input
	   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,8); pad.Parent=input end
	input.FocusLost:Connect(function()
		local v = input.Text
		if kind == "number" then v = tonumber(v) or Settings[key] end
		saveSetting(key, v)
		log("OK", "Saved setting: " .. key)
	end)
	return input
end

local y = setY + 10

-- AI Provider header
make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="⚔ AI Provider", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack, TextSize=14, Size=UDim2.new(1,0,0,22),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
y = y + 26
make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1,
	Text="Pick a preset and paste an API key. The plugin calls the provider directly from Studio — no middleman server needed.",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
	Size=UDim2.new(1,0,0,30), Position=UDim2.new(0,0,0,y),
	TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})
y = y + 34

-- Preset dropdown (we use a simple TextButton that cycles presets since Studio has no native dropdown)
local presetNames = {}
for name, _ in pairs(PRESETS) do table.insert(presetNames, name) end
table.sort(presetNames)
local presetLabel = make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="Provider preset", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
local presetBtn = make(Pages.SETTINGS, "TextButton", {
	Text = Settings.providerPreset,
	TextColor3 = Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=presetBtn end
local presetIdx = 1
for i, n in ipairs(presetNames) do if n == Settings.providerPreset then presetIdx = i end end
presetBtn.MouseButton1Click:Connect(function()
	presetIdx = (presetIdx % #presetNames) + 1
	local name = presetNames[presetIdx]
	presetBtn.Text = name
	saveSetting("providerPreset", name)
	-- Show/hide custom URL/model boxes
	local isCustom = (name == "Custom")
	customUrlBox.Visible = isCustom
	customModelBox.Visible = isCustom
	modelOverrideBox.Visible = not isCustom
	-- Update note
	local note = PRESETS[name].note or ""
	presetNote.Text = note .. (PRESETS[name].signup and #PRESETS[name].signup > 0
		and ("  (Get key: " .. PRESETS[name].signup .. ")") or "")
	log("INFO", "Provider preset: " .. name)
end)
y = y + 36

-- Preset help note under the dropdown
local presetNote = make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="", TextColor3=C.textDim,
	Font=Enum.Font.Gotham, TextSize=10, Size=UDim2.new(1,0,0,18),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})
do
	local preset = PRESETS[Settings.providerPreset] or PRESETS["OpenRouter-Free"]
	presetNote.Text = preset.note .. (preset.signup and #preset.signup > 0 and ("  (Get key: " .. preset.signup .. ")") or "")
end
y = y + 22

-- API Key
makeSettingRow("API Key", "password", "apiKey", y, {}); y = y + 36

-- Custom Base URL / Model (only visible when Custom preset selected)
local customUrlLbl = make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="Custom Base URL", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
customUrlBox = make(Pages.SETTINGS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="https://api.your-provider.com/v1",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
	Text=tostring(Settings.customBaseUrl or ""), ClearTextOnFocus=false, BorderSizePixel=0,
})
do local cc=Instance.new("UICorner"); cc.CornerRadius=UDim.new(0,4); cc.Parent=customUrlBox
   local ss=Instance.new("UIStroke"); ss.Color=C.border; ss.Thickness=1; ss.Parent=customUrlBox
   local pp=Instance.new("UIPadding"); pp.PaddingLeft=UDim.new(0,8); pp.Parent=customUrlBox end
customUrlBox.FocusLost:Connect(function() saveSetting("customBaseUrl", customUrlBox.Text) end)
customUrlBox.Visible = (Settings.providerPreset == "Custom")
y = y + 36

local customModelLbl = make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="Custom Model", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
customModelBox = make(Pages.SETTINGS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="e.g. gpt-4o-mini",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
	Text=tostring(Settings.customModel or ""), ClearTextOnFocus=false, BorderSizePixel=0,
})
do local cc=Instance.new("UICorner"); cc.CornerRadius=UDim.new(0,4); cc.Parent=customModelBox
   local ss=Instance.new("UIStroke"); ss.Color=C.border; ss.Thickness=1; ss.Parent=customModelBox
   local pp=Instance.new("UIPadding"); pp.PaddingLeft=UDim.new(0,8); pp.Parent=customModelBox end
customModelBox.FocusLost:Connect(function() saveSetting("customModel", customModelBox.Text) end)
customModelBox.Visible = (Settings.providerPreset == "Custom")
y = y + 36

-- Model override (lets you pick a different model within the preset)
local modelOverrideLbl = make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="Model override (optional)", TextColor3=C.text,
	Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
modelOverrideBox = make(Pages.SETTINGS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="(leave blank for preset default)",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
	Text=tostring(Settings.model or ""), ClearTextOnFocus=false, BorderSizePixel=0,
})
do local cc=Instance.new("UICorner"); cc.CornerRadius=UDim.new(0,4); cc.Parent=modelOverrideBox
   local ss=Instance.new("UIStroke"); ss.Color=C.border; ss.Thickness=1; ss.Parent=modelOverrideBox
   local pp=Instance.new("UIPadding"); pp.PaddingLeft=UDim.new(0,8); pp.Parent=modelOverrideBox end
modelOverrideBox.FocusLost:Connect(function() saveSetting("model", modelOverrideBox.Text) end)
modelOverrideBox.Visible = (Settings.providerPreset ~= "Custom")
y = y + 36

makeSettingRow("Max Tokens", "number", "maxTokens", y, {}); y = y + 36
makeSettingRow("Temperature", "number", "temperature", y, {}); y = y + 36

-- Separator: Meshy 3D section
make(Pages.SETTINGS, "Frame", {
	BackgroundColor3=C.border, Size=UDim2.new(1,0,0,1),
	Position=UDim2.new(0,0,0,y), BorderSizePixel=0,
})
y = y + 12
make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="🧊 3D Models (Meshy)", TextColor3=C.goldLight,
	Font=Enum.Font.GothamBlack, TextSize=14, Size=UDim2.new(1,0,0,22),
	Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
y = y + 26
make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1,
	Text="Generates actual 3D meshes (GLB/FBX/OBJ). Free at meshy.ai (200 credits/month, no credit card). Get a key at meshy.ai/settings/api.",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
	Size=UDim2.new(1,0,0,30), Position=UDim2.new(0,0,0,y),
	TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})
y = y + 36
makeSettingRow("Meshy API Key", "password", "meshyApiKey", y, {}); y = y + 36
-- Meshy test button
do
	local lbl = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text="Test Meshy", TextColor3=C.text,
		Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
		Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
	})
	local mtestBtn = make(Pages.SETTINGS, "TextButton", {
		Text="🔌 Test Meshy Key", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
		Size=UDim2.new(0,170,0,28), Position=UDim2.new(0,220,0,y),
		BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
	})
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=mtestBtn end
	local mtestLbl = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text="", TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
		Size=UDim2.new(1,-410,0,28), Position=UDim2.new(0,400,0,y), TextXAlignment=Enum.TextXAlignment.Left,
		TextWrapped=true,
	})
	mtestBtn.MouseButton1Click:Connect(function()
		mtestBtn.Text = "…testing…"
		mtestBtn.BackgroundColor3 = C.panel2
		mtestBtn.TextColor3 = C.text
		Meshy.testKey(function(ok, msg)
			mtestBtn.Text = "🔌 Test Meshy Key"
			mtestBtn.BackgroundColor3 = ok and C.moss or C.red
			mtestBtn.TextColor3 = Color3.new(0,0,0)
			mtestLbl.Text = msg
			log(ok and "OK" or "ERR", "Meshy test: " .. msg)
		end)
	end)
	y = y + 36
end

-- Separator
make(Pages.SETTINGS, "Frame", {
	BackgroundColor3=C.border, Size=UDim2.new(1,0,0,1),
	Position=UDim2.new(0,0,0,y), BorderSizePixel=0,
})
y = y + 12

makeSettingRow("Owner UserIds (comma-separated)", "text", "ownerUserIds", y, { placeholder = "123456,789012" }); y = y + 36

-- Test connection row
do
	local lbl = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text="Connection test", TextColor3=C.text,
		Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
		Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
	})
	local testBtn = make(Pages.SETTINGS, "TextButton", {
		Text="🔌 Test Connection", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBold, TextSize=12,
		Size=UDim2.new(0,170,0,28), Position=UDim2.new(0,220,0,y),
		BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
	})
	do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,4); c.Parent=testBtn end
	local testLbl = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text="", TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
		Size=UDim2.new(1,-410,0,28), Position=UDim2.new(0,400,0,y), TextXAlignment=Enum.TextXAlignment.Left,
		TextWrapped=true,
	})
	testBtn.MouseButton1Click:Connect(function()
		testBtn.Text = "…testing…"
		testBtn.BackgroundColor3 = C.panel2
		testBtn.TextColor3 = C.text
		AI.testServer(function(ok, msg)
			testBtn.Text = "🔌 Test Connection"
			testBtn.BackgroundColor3 = ok and C.moss or C.red
			testBtn.TextColor3 = Color3.new(0,0,0)
			testLbl.Text = msg
			log(ok and "OK" or "ERR", "Provider test: " .. msg)
		end)
	end)
	y = y + 36
end

-- Game name (stored in Memory, not Settings table)
do
	local l = make(Pages.SETTINGS, "TextLabel", {
		BackgroundTransparency=1, Text="Game Name", TextColor3=C.text,
		Font=Enum.Font.GothamBold, TextSize=12, Size=UDim2.new(0,220,0,28),
		Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
	})
	local input = make(Pages.SETTINGS, "TextBox", {
		BackgroundColor3=C.bg, TextColor3=C.text, PlaceholderText="My Roblox Game",
		PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=11,
		Size=UDim2.new(1,-230,0,28), Position=UDim2.new(0,220,0,y),
		Text=tostring(Memory.gameName or ""), ClearTextOnFocus=false, BorderSizePixel=0,
	})
	do local cc=Instance.new("UICorner"); cc.CornerRadius=UDim.new(0,4); cc.Parent=input
	   local ss=Instance.new("UIStroke"); ss.Color=C.border; ss.Thickness=1; ss.Parent=input
	   local pp=Instance.new("UIPadding"); pp.PaddingLeft=UDim.new(0,8); pp.Parent=input end
	input.FocusLost:Connect(function()
		Memory.gameName = input.Text
		saveMemory()
		refreshMemText()
		log("OK", "Saved game name: " .. input.Text)
	end)
	y = y + 36
end

-- Extra instructions box
make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1, Text="Extra system instructions (appended to every AI prompt):",
	TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(1,0,0,20), Position=UDim2.new(0,0,0,y), TextXAlignment=Enum.TextXAlignment.Left,
})
y = y + 22
local sysBox = make(Pages.SETTINGS, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.text,
	PlaceholderText="e.g. Always use CollectionService tags. Prefer OOP with metatables for modules.",
	PlaceholderColor3=C.textFaint, Font=Enum.Font.RobotoMono, TextSize=11,
	Size=UDim2.new(1,0,0,100), Position=UDim2.new(0,0,0,y),
	Text=Settings.systemPrompt or "", ClearTextOnFocus=false, MultiLine=true, TextWrapped=true, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=sysBox
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=sysBox
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.Parent=sysBox end
sysBox.FocusLost:Connect(function() saveSetting("systemPrompt", sysBox.Text) end)
y = y + 110

local saveAllBtn = make(Pages.SETTINGS, "TextButton", {
	Text="💾 Save All & Reset AI Context", TextColor3=Color3.new(0,0,0),
	Font=Enum.Font.GothamBlack, TextSize=13, Size=UDim2.new(0,260,0,38),
	Position=UDim2.new(0,0,0,y),
	BackgroundColor3=C.gold, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=saveAllBtn end
saveAllBtn.MouseButton1Click:Connect(function()
	AI.resetConversation()
	log("OK", "Settings saved. AI context reset.")
end)
y = y + 50

make(Pages.SETTINGS, "TextLabel", {
	BackgroundTransparency=1,
	Text="DevAI runs ONLY inside Roblox Studio on your machine. It does NOT ship with your game. API calls go directly from your Studio install to your configured endpoint; your key never leaves this plugin's settings store.",
	TextColor3=C.textDim, Font=Enum.Font.Gotham, TextSize=11,
	Size=UDim2.new(1,0,0,60), Position=UDim2.new(0,0,0,y),
	TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
})

-- =============================================================================
-- ACTION PREVIEW MODAL  (overlays current page)
-- =============================================================================
PreviewPanel = make(gui, "Frame", {
	Name = "PreviewModal",
	BackgroundColor3 = Color3.new(0,0,0),
	BackgroundTransparency = 0.45,
	Size = UDim2.fromScale(1,1),
	Visible = false,
	ZIndex = 100,
})
local PreviewCard = make(PreviewPanel, "Frame", {
	BackgroundColor3 = C.panel,
	Size = UDim2.new(0.7,0,0.7,0),
	Position = UDim2.new(0.15,0,0.15,0),
	BorderSizePixel = 0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,8); c.Parent=PreviewCard
   local s=Instance.new("UIStroke"); s.Color=C.gold; s.Thickness=2; s.Parent=PreviewCard
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,14); pad.PaddingRight=UDim.new(0,14)
   pad.PaddingTop=UDim.new(0,12); pad.PaddingBottom=UDim.new(0,12); pad.Parent=PreviewCard end
make(PreviewCard, "TextLabel", {
	BackgroundTransparency=1, Text="⚠  SEND TO STUDIO — Confirmation",
	TextColor3=C.goldLight, Font=Enum.Font.GothamBlack, TextSize=18,
	Size=UDim2.new(1,0,0,28), TextXAlignment=Enum.TextXAlignment.Left,
})
PreviewActionLabel = make(PreviewCard, "TextLabel", {
	BackgroundTransparency=1, Text="ACTION:",
	TextColor3=C.amber, Font=Enum.Font.GothamBold, TextSize=13,
	Size=UDim2.new(1,0,0,22), Position=UDim2.new(0,0,0,30),
	TextXAlignment=Enum.TextXAlignment.Left,
})
PreviewCode = make(PreviewCard, "TextBox", {
	BackgroundColor3=C.bg, TextColor3=C.moss,
	Font=Enum.Font.RobotoMono, TextSize=10,
	Size=UDim2.new(1,0,1,-110),
	Position=UDim2.new(0,0,0,60),
	Text="", ClearTextOnFocus=false, MultiLine=true, TextWrapped=false, BorderSizePixel=0,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=PreviewCode
   local s=Instance.new("UIStroke"); s.Color=C.border; s.Thickness=1; s.Parent=PreviewCode
   local pad=Instance.new("UIPadding"); pad.PaddingLeft=UDim.new(0,10); pad.PaddingTop=UDim.new(0,8); pad.Parent=PreviewCode end
local viewBtn = make(PreviewCard, "TextButton", {
	Text="[ VIEW CHANGES ]", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(0,170,0,32), Position=UDim2.new(0,0,1,-36),
	BackgroundColor3=C.panel2, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=viewBtn end
local confirmBtn = make(PreviewCard, "TextButton", {
	Text="[ ✓ CONFIRM ]", TextColor3=Color3.new(0,0,0), Font=Enum.Font.GothamBlack, TextSize=13,
	Size=UDim2.new(0,150,0,32), Position=UDim2.new(0,180,1,-36),
	BackgroundColor3=C.green, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=confirmBtn end
local cancelBtn = make(PreviewCard, "TextButton", {
	Text="[ CANCEL ]", TextColor3=C.text, Font=Enum.Font.GothamBold, TextSize=12,
	Size=UDim2.new(0,130,0,32), Position=UDim2.new(0,340,1,-36),
	BackgroundColor3=C.red, BorderSizePixel=0, AutoButtonColor=true,
})
do local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,5); c.Parent=cancelBtn end

viewBtn.MouseButton1Click:Connect(function()
	PreviewCode.Visible = not PreviewCode.Visible
end)
confirmBtn.MouseButton1Click:Connect(applyPendingAction)
cancelBtn.MouseButton1Click:Connect(cancelPendingAction)

-- Also close preview on Escape key (best-effort via focused button) — handled via cancelButton visibility.

-- =============================================================================
-- STARTUP
-- =============================================================================
switchPage("HOME")
refreshMemText()
log("SYS", string.format("DevAI v%s loaded. Role: %s. UserId: %s",
	PLUGIN_VERSION, getCurrentRole(), tostring(getCurrentUserId())))
if not Settings.apiKey or #Settings.apiKey == 0 then
	if Settings.providerPreset == "Ollama (local)" then
		log("INFO", "Ollama mode: no API key needed. Make sure Ollama is running on http://localhost:11434.")
	else
		log("WARN", "No API key set. Open Settings and paste a key (free: OpenRouter Free tier at openrouter.ai/keys).")
	end
end
log("INFO", "IMPORTANT: Make sure 'Enable Studio Access to API Services' is ON in File → Settings → Security.")
if Settings.autoScanOnOpen then
	task.delay(0.5, function()
		log("INFO", "Running initial game scan...")
		-- Don't auto-populate UI until user opens Scanner, but fill the cache.
		fullScan()
	end)
end

print("[DevAI] Plugin loaded successfully.")
