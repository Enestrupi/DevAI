# DevAI Web App

Standalone browser UI for DevAI, deployed as a GitHub Pages static site.

- Chat (Roblox-specialized LLM)
- 3D Models via Meshy (text → GLB/FBX/OBJ + auto-rig + walk/run)
- Thumbnails via Pollinations (free, no key)
- GUI generator → Luau LocalScript
- Focused Luau code generator (Script/LocalScript/ModuleScript)
- Animation script generator
- Session code for future Studio plugin auto-sync
- Settings with localStorage-persisted keys

## Deployment

This folder is plain static HTML/JS. To deploy:

1. Push the repo to GitHub.
2. In repo Settings → Pages, set **Source** to `main` branch, folder `/site`.
3. Your app will be live at `https://<username>.github.io/DevAI/`.

## Run locally

```bash
cd site
python3 -m http.server 8080
# visit http://localhost:8080
```

No build step, no dependencies — `index.html` + `app.js`.
