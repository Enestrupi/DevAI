# ⚔ DevAI — Roblox Studio AI Co-Developer

A ForgeGUI-style AI assistant that lives **inside Roblox Studio** as a single-file plugin. Dark gold/bronze fantasy-dev theme, full IDE-style UI, one-click **Send to Studio**, a game scanner, script/builder generators, 12 isolated testing labs, error explainer, project memory, and role-based permissions.

DevAI talks directly from Studio to any **OpenAI-compatible** chat-completions endpoint — OpenRouter (recommended, has free models), OpenAI, Groq, or a local Ollama server. **No middleman server required.**

---

## 📦 Install (30 seconds)

1. Download the latest [`DevAI.plugin.lua`](DevAI.plugin.lua?raw=1) from this repo (click the link → right-click → Save As).
2. Drop it into your Roblox Studio Plugins folder:
   - **Windows:** `%LOCALAPPDATA%\Roblox\Plugins\`
   - **Mac:** `~/Documents/Roblox/Plugins/`
3. Restart Roblox Studio.
4. Click the **⚔ DevAI** button on the **Plugins** tab.
5. Open **Settings**:
   - Pick a **Provider preset** (start with **OpenRouter-Free** for $0)
   - Paste an **API key** (free from [openrouter.ai/keys](https://openrouter.ai/keys))
   - Click **🔌 Test Connection** — green means it works.
6. Make sure **File → Settings → Security → Enable Studio Access to API Services** is turned ON.

That's it — no signup on this website, no middleman, your API key stays in the plugin's private settings store on your machine.

---

## ⚡ Provider presets

| Preset | Key | Default model | Notes |
|---|---|---|---|
| **OpenRouter-Free** | required | `meta-llama/llama-3.1-8b-instruct:free` | **100% free.** Rate-limited. Fastest way to try DevAI. |
| **OpenRouter** | required | `anthropic/claude-3.5-sonnet` | Pay-as-you-go. 100+ models (Claude, GPT, Llama, Qwen, Grok, Gemini) with one key. |
| **OpenAI** | required | `gpt-4o-mini` | Direct OpenAI. |
| **Groq** | required | `llama-3.3-70b-versatile` | Very fast; generous free tier. |
| **Ollama (local)** | not needed | `llama3.1` | 100% offline. Requires [Ollama](https://ollama.ai) running at `http://localhost:11434`. |
| **Custom** | as needed | (you set) | Any OpenAI-compatible endpoint (Together, LM Studio, vLLM, etc). |

The optional **Model override** field lets you swap models without changing preset.

---

## 🧭 Features

| Tab | What it does |
|---|---|
| **🏠 Home** | Quick-action grid + project memory (game name, currency, admin, UI, folders, notes). |
| **💬 AI Chat** | Natural-language chat with automatic code-block detection — every fenced Luau block gets a yellow **⬆ SEND TO STUDIO** button. Quick-prompt chips, copy button, conversation reset. |
| **🔍 Game Scanner** | Walks all major services, counts Scripts/LocalScripts/Modules/Remotes/Parts, flags broken scripts, infinite loops without wait, LocalScripts in Workspace, unanchored floating parts, missing organization folders. Severity: 🔴 Critical · 🟠 Warning · 🟡 Optimization · 🟢 Good. Click 📂 Open to select the object in Studio. |
| **📜 Scripts** | Pick Script / LocalScript / ModuleScript + target path + name + description → writes complete documented, secure Luau → queues it for Send-to-Studio. |
| **🏗 Builder** | Describe anything (castle, obby, arena, village, rainforest, dev testing area) → DevAI generates a Studio-executable build script that creates Parts/Models/Folders in Workspace. Quick-start preset chips included. |
| **📁 Explorer** | Live tree of your DataModel. Click to select in Studio; right-click to ask the AI about an object. |
| **🧪 Testing** | 12 isolated test generators (NPC, Combat, Obby, Physics, Vehicle, Animation, UI, Sound, Lighting, Performance, RemoteEvent, DataStore). Each creates `DevAI_<id>_`-prefixed systems so nothing collides with your real code. |
| **🐞 Errors** | Paste an error → 5-point answer: (1) what it means, (2) likely cause, (3) where to look, (4) corrected code, (5) where to put it. |
| **🖥 Console** | Internal DevAI log (SYS/OK/WARN/ERR/AI) with color-coded lines. |
| **⚙ Settings** | Provider preset, API key, model override, max tokens, temperature, Owner UserIds whitelist, extra system instructions, test connection. |

---

## ⬆ Send to Studio (preview-before-apply)

Every destructive/insert action pops a gold-rimmed confirmation modal:

```
⚠  SEND TO STUDIO — Confirmation
ACTION:  createScript → ServerScriptService.Systems.Combat.CombatSystem
[ VIEW CHANGES ]   [ ✓ CONFIRM ]   [ CANCEL ]
```

Supported actions:
- Create / Replace **Script**, **LocalScript**, **ModuleScript**
- Create **Folder**, **RemoteEvent**, **RemoteFunction**, **UnreliableRemoteEvent**
- Create **Part**, **Model**, **ScreenGui**, or any object by ClassName

All mutations are wrapped with `ChangeHistoryService:SetWaypoint(...)` so **Ctrl+Z** undoes them instantly.

---

## 🧠 Project Memory

DevAI remembers across Studio sessions:
- Game name
- Currency name
- Admin system (auto-detected / you note it)
- Main UI (auto-detected)
- Important folders (auto-detected on every scan)
- Freeform notes you type on the Home page

Memory is persisted with `Plugin:SetSetting` and injected as system-context on every AI request, so you don't have to repeat yourself.

---

## 🔐 Permissions

- **OWNER** (UserIds listed in Settings, comma-separated) → full access including destructive actions & Settings
- **DEVELOPER/BUILDER** → can generate and create but not replace/delete
- **MODERATOR/TESTER** → read/chat only
- This is a **Studio plugin only** — it never ships with your game. Normal players never see it.

The AI is instructed to always prefer server-authoritative patterns, validate RemoteEvent arguments server-side, and never invent objects that weren't found during a scan.

---

## 🎨 Theme
Dark charcoal panels · Golden-brown accents · Bronze buttons · Amber highlights · Moss-green success · Red errors. Built to match the aesthetic of a golden-brown fantasy-rainforest dev castle.

---

## 📄 License
MIT. Do whatever you want with it. Fork, modify, resell — just don't blame me if your game breaks.

```
Build → Code → Debug → Test → Optimize → Deploy  ⚔
```
