# ⚔ DevAI — Roblox Studio AI Co-Developer

A ForgeGUI-style AI assistant that lives **inside Roblox Studio** as a single-file plugin. Dark gold/bronze fantasy-dev theme, full IDE-style UI, one-click **Send to Studio**, a game scanner, script/builder generators, an **AI 3D mesh generator** (actual GLB/OBJ/FBX files), 12 testing labs, error explainer, project memory, and role-based permissions.

DevAI connects to:
- **Any OpenAI-compatible chat model** for Luau coding (OpenRouter-Free for $0, OpenAI, Groq, Ollama, Custom).
- **Meshy AI** for actual 3D mesh generation (free tier — 200 credits/month, no credit card).

**No middleman server required.** All calls go straight from Studio to the provider you choose.

---

## Install

1. Download [DevAI.plugin.lua](https://raw.githubusercontent.com/Enestrupi/DevAI/main/DevAI.plugin.lua) (right-click, Save As).
2. Drop it into your Roblox Studio Plugins folder:
   - Windows: `%LOCALAPPDATA%\Roblox\Plugins\`
   - Mac: `~/Documents/Roblox/Plugins/`
3. Restart Roblox Studio.
4. Click **⚔ DevAI** on the Plugins tab → open **Settings**.
5. **For chat/scripting (free):** pick preset **OpenRouter-Free**, paste a key from openrouter.ai/keys.
6. **For 3D models (free):** get a key from meshy.ai/settings/api and paste it into the Meshy API Key field.
7. Click both **🔌 Test Connection** buttons; green = ready.
8. Turn on File → Settings → Security → **Enable Studio Access to API Services**.

---

## Features

| Tab | What it does |
|---|---|
| 🏠 Home | Quick actions + project memory (game name, currency, admin, UI, folders, notes). |
| 💬 AI Chat | Luau expert chat. Every fenced code block gets a yellow **⬆ SEND TO STUDIO** button. |
| 🧊 3D Models | **Generate real 3D meshes from text** (Meshy). Preview ~20s, optional PBR refine ~1min, exports GLB/FBX/OBJ. Links copy to clipboard. |
| 🔍 Game Scanner | Walks services, counts assets, flags broken scripts, infinite loops, LocalScripts in Workspace, floating parts. 🔴 Critical · 🟠 Warning · 🟡 Optimization · 🟢 Good. |
| 📜 Scripts | Pick Script / LocalScript / ModuleScript + target + description → complete Luau → Send to Studio. |
| 🏗 Builder | Natural-language build requests → Part/Model assembly scripts executed in Studio. |
| 📁 Explorer | Live DataModel tree; click to select; right-click to ask the AI about an object. |
| 🧪 Testing | 12 isolated test generators (NPC, Combat, Obby, Physics, Vehicle, Animation, UI, Sound, Lighting, Perf, Remote, DataStore). |
| 🐞 Errors | Paste an error → 5-point explanation with fixed code. |
| 🖥 Console | Internal DevAI log (SYS/OK/WARN/ERR/AI) color-coded. |
| ⚙ Settings | LLM provider, Meshy key, model override, temperature, Owner whitelist, extra system prompt, test buttons. |

---

## 🧊 3D Model Generation

The **3D Models** tab generates actual textured 3D meshes (not just Part assemblies):

1. Describe what you want (e.g. *"Weathered golden-brown stone sword with bronze hilt and glowing amber runes, fantasy game asset"*).
2. Pick an art style: **realistic**, **cartoon**, **low-poly**, or **sculpture**.
3. Click **✨ GENERATE 3D MODEL** (~20 seconds for a preview).
4. A thumbnail appears. Click **🌟 REFINE** to add full PBR textures (~1 minute, extra credit).
5. Click **⬇ Download GLB** — the URL copies to your clipboard and prints in the Output window. Paste it in your browser to download.
6. In Studio, right-click **Meshes** → **Insert Mesh** → select the GLB, or use Asset Manager → Bulk Import. Drag into Workspace as a MeshPart.

Credit cost: ~1 credit for a preview, ~3 credits for a refined PBR model. The free tier gives 200 credits/month (≈50 preview models or ~50 refined models).

---

## Provider presets

| Preset | Key | Default model | Notes |
|---|---|---|---|
| **OpenRouter-Free** | required | llama-3.1-8b-instruct:free | **100% free** chat. |
| **OpenRouter** | required | anthropic/claude-3.5-sonnet | Pay-as-you-go, 100+ models. |
| **OpenAI** | required | gpt-4o-mini | Direct OpenAI. |
| **Groq** | required | llama-3.3-70b-versatile | Very fast, generous free tier. |
| **Ollama (local)** | not needed | llama3.1 | 100% offline. |
| **Custom** | as needed | (you set) | Any OpenAI-compatible endpoint. |

**Meshy (3D meshes)** uses a separate free key from meshy.ai.

---

## ⬆ Send to Studio (preview-before-apply)

Every code insert/creation shows a gold-rimmed confirmation modal:

```
⚠  SEND TO STUDIO — Confirmation
ACTION:  createScript → ServerScriptService.Systems.Combat.CombatSystem
[ VIEW CHANGES ]   [ ✓ CONFIRM ]   [ CANCEL ]
```

Supported actions: Script/LocalScript/ModuleScript (create+replace), Folder, RemoteEvent/Function, Part, Model, ScreenGui, any object by ClassName. All mutations wrapped in `ChangeHistoryService:SetWaypoint(...)` so **Ctrl+Z** undoes them instantly.

---

## Project Memory

Saved between sessions: game name, currency, admin system, main UI, important folders (auto-detected on every scan), freeform notes. Injected as system context on every AI request.

## Permissions

- **OWNER** (UserIds listed in Settings) → full access
- **DEVELOPER/BUILDER** → generate and create, not replace/delete
- **MODERATOR/TESTER** → chat/read only
- Studio-only plugin — never ships with your game.

The AI prefers server-authoritative patterns, validates RemoteEvent arguments server-side, and never invents objects not found in your place.

## License
MIT.
