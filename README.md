# ⚔ DevAI

Ancient-fantasy themed AI co-developer for **Roblox Studio**. Two parts, one brand:

1. **`site/`** — standalone browser web app (chat, 3D models, thumbnails, GUI, Luau code, animations, Studio Sync). Static, no backend.
2. **`DevAI.plugin.lua`** — the Roblox Studio plugin you install once. Talks to the same providers and adds in-Studio convenience (Output-log scanning, one-click script insertion, quick Meshy 3D previews, future relay support).

![theme](https://img.shields.io/badge/theme-ancient%20fantasy-gold) ![version](https://img.shields.io/badge/version-v1.2-gold)

---

## 🌐 Web app (recommended entry point)

The browser app is the easiest way to use DevAI. No install, no Roblox Studio required (though you can paste everything you make into Studio).

- **💬 Chat** — Roblox-specialized AI assistant (Luau, services, Remotes, DataStores).
- **🧊 3D Models** — text → GLB/FBX via Meshy, live `<model-viewer>` preview, refine to PBR, auto-rig humanoids with walk/run animations.
- **🖼 Thumbnails** — free image generation via Pollinations (no key needed).
- **🎨 GUI Generator** — describe a menu/HUD/shop → working gold-brown themed Luau LocalScript.
- **📜 Luau Code** — targeted Script / LocalScript / ModuleScript generation for a specific service path.
- **💃 Animations** — AnimationController/LocalScript generator; use rigged Meshy characters + walk/run FBX with Roblox Animation Editor.
- **🔌 Studio Sync** — 6-character session code for future auto-pairing with the plugin.
- **⚙ Settings** — pick a provider preset (OpenRouter-Free, Claude, GPT-4o-mini, Groq, Ollama, custom), paste keys, store project memory. Keys stay in `localStorage` only — no backend.

### Run locally
```bash
cd docs
python3 -m http.server 8080
# open http://localhost:8080
```

### Deploy to GitHub Pages (free)
1. Push this repo to GitHub.
2. Repo **Settings → Pages** → Source = `main` branch, folder = `/docs`.
3. Live at `https://<your-username>.github.io/DevAI/`.

Free-tier defaults work out of the box once you add one free API key:
- **Chat / Code / GUI**: [OpenRouter free Llama 3.1 8B](https://openrouter.ai/keys) (100% free).
- **Thumbnails**: Pollinations (no key, no cost).
- **3D Models**: [Meshy](https://www.meshy.ai/settings/api) (200 free credits/month, no card).

---

## 🧩 Roblox Studio plugin

**Install**:
1. In Roblox Studio, open the Plugins tab → Plugins Folder button. That opens `%LOCALAPPDATA%\Roblox\Plugins` (Windows) / `~/Documents/Roblox/Plugins` (Mac).
2. Create a subfolder named `DevAI` and drop `DevAI.plugin.lua` inside it (or just drop the `.lua` file directly).
3. Restart Studio (or re-save the file for auto-reload).
4. Click the **⚔ DevAI** toolbar button to open the dock widget.

**What the plugin gives you** (all inside Studio):
- **Chat** tab — same Roblox-specialized assistant. Code blocks have *Copy* / *Download* / one-click *Insert into Explorer*.
- **3D Models** tab — Meshy text → preview → refine → rig, with GLB/FBX download links copied to clipboard.
- **Thumbnails** tab — image prompt → URL, copy into an ImageLabel/Decal.
- **Focused Code** tab — generate Script/LocalScript/ModuleScript directly into a chosen service.
- **GUI** tab — describe a menu, get a LocalScript that builds it (DevAI gold-brown theme).
- **Animations** tab — rigged Meshy models + AnimationController script.
- **Debug** — scans the Output window for the last error/Exception and feeds it to the LLM with project context.
- **Settings** — API keys, model preset picker, project memory (game name, currency, UI, admin, extra instructions). Keys live in `plugin:SetSetting/GetSetting` only.

### Plugin v1.2 changes (vs v1.1)
- Added **🦴 Rig Character** flow on the 3D tab: auto-skeletons a Meshy model and exposes walk/run FBX downloads.
- Result card resized to show rigged GLB/FBX plus walk/run links.
- New Meshy API helpers: `Meshy.rigFromTask`, `Meshy.getRigTask`, `Meshy.pollRig`.

---

## 🛠 Development pipeline (the DevAI loop)

`BUILD → CODE → DEBUG → TEST → OPTIMIZE → DEPLOY`

Every response respects this loop. Ask DevAI to scaffold, implement, hunt errors, suggest optimizations, or write deployment checks before publishing.

## 🏰 Default aesthetic

Ancient fantasy rainforest castle — gold, bronze, amber, mossy stone accents. Tell the AI explicitly if you want sci-fi/modern.

## ⚠ Notes

- Keys never leave your machine: web app uses `localStorage`, plugin uses Roblox `plugin:SetSetting`. Calls go straight to the provider APIs from your browser/Studio (no DevAI backend).
- Roblox Studio's HttpEnabled must be ON (the plugin prompts you when it isn't).
- Studio plugins cannot write directly to disk, so download buttons copy URLs to the clipboard and print them in the Output window — paste in a browser to save.
