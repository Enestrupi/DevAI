# ⚔ DevAI v3.0

Ancient-fantasy themed AI co-developer for **Roblox Studio**. Gold/bronze aesthetic. Castle-forge vibes.

## 🏰 Parts

1. **`site/`** — static web app (chat, 3D models, thumbnails, GUI, code, animations, studio sync). Deployable to GitHub Pages as-is, no build step.
2. **`DevAI.plugin.lua`** — Roblox Studio plugin with 7 tabs: Chat, 3D, Thumbs, Code, GUI, Animations, Debug + Settings.
3. **`bridge/bridge.js`** — tiny zero-dependency Node.js local bridge on port 42069 for Send-to-Studio queuing (same protocol as the original bridge.py but no Python required).
4. **`start-devai.bat`** — one-click Windows launcher: installs plugin, starts bridge, opens browser.

## ⚡ Quick start (Windows)

1. Install [Node.js LTS](https://nodejs.org/) (free).
2. Download this repo (or the latest release zip).
3. Double-click **`start-devai.bat`**.
4. Browser opens `http://127.0.0.1:42069/` with the DevAI site.
5. In Roblox Studio, click the **⚔ DevAI** toolbar button. The panel shows "Bridge: connected" when synced.
6. On the website, click any quick-start or type a prompt. Code blocks have a **📤 Send to Studio** button — one click inserts directly into your game.

## 🌐 Without the bridge

You can also use the website standalone (no Node.js, no local server):
- Visit https://enestrupi.github.io/DevAI/
- Code blocks have a Copy button; paste scripts into Studio manually.

## 🔑 API keys

Keys live **only in your browser** (`localStorage`) on the website, and **only in the plugin** (`plugin:SetSetting`) inside Studio. DevAI never sees them — calls go straight to the provider from your machine.

Free options that work out of the box:
- **Chat**: OpenRouter free Llama 3.1 8B (100% free: https://openrouter.ai/keys)
- **Chat**: Groq Llama 3.1 70B (free credits: https://console.groq.com)
- **Thumbnails**: Pollinations (no key, no cost at all)
- **3D Models**: Meshy (200 free credits/month: https://www.meshy.ai/settings/api)

## 🧩 Plugin tabs

- **💬 Chat** — in-Studio Roblox assistant, with ⇅ Sync/↑ Selected/↑ Script quick buttons to send project context.
- **🧊 3D** — Meshy text→GLB generation helper.
- **🖼 Thumbs** — one-click Pollinations thumbnail generation (URL copied to clipboard).
- **📜 Code** — targeted Script/LocalScript/ModuleScript generation sent to a chosen service.
- **🎨 GUI** — gold/bronze themed GUI LocalScript generation.
- **💃 Anim** — AnimationController generation for rigged characters (paste Walk/Idle/Run IDs).
- **🔧 Debug** — captures last Output error, sends it with project context to the AI; Settings panel for API keys.

## 🚀 Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages** → Source = `main` branch, folder = `/docs`.
3. Live at `https://<your-username>.github.io/DevAI/`.

The `docs/` folder is a mirror of `site/` for GitHub Pages.
