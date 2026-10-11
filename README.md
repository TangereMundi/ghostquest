# GhostQuest!

Exploration and ghost-hunting game: random destinations inside a distance you choose, shown on an open map, plus a simulated ghost-hunting mode and a shared collection.

## What is in here
- `src/index.template.html` the whole game screen, styling and interface
- `src/logic.js` the game rules (coordinates, XP, rarity, quests). Pure code, tested
- `assets/` your artwork (world, name, emblem)
- `app-extra/` install settings, offline helper (`sw.js`), icons, hosting notes
- `test/logic.test.js` automated checks for the rules
- `build.py` assembles everything
- `docs/` THE FINISHED APP. This is the folder you put online

## Rebuild and check (needs Python 3 and Node on a computer, or ask Claude to do it)
```
python3 build.py
node test/logic.test.js
```

## Put it online with GitHub Pages (free, https)
1. Create a free GitHub account and a new repository (public is simplest).
2. Upload everything in this project, keeping the folders.
3. Repository Settings > Pages > Deploy from a branch > main > /docs > Save.
4. After a minute your address appears (https://YOURNAME.github.io/REPONAME/).
5. On the iPad open that address in Safari > Share > Add to Home Screen.
GitHub may change menu names; the idea stays the same.

## Updating later (from the iPad)
Ask Claude for a change. Claude gives you a new project zip. Upload the changed files to the repository (Add file > Upload files, same names), and the site updates itself. Change `VERSION` in `docs/sw.js` (for example `gq-v2`) when you want installed copies to refresh.

## Notes
- Map pictures come from openstreetmap.org's free server. Fine for testing. For a public launch use a provider that allows your traffic.
- Everything a player does is stored on their own device. Nothing is uploaded.
