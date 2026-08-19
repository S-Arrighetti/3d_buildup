# 3D Build-Up

Plan air cargo pallet build-ups in 3D. Pick a pallet, stack cargo and dunnage on
it, and check the load against contour and weight limits before anyone touches a
real box.

**Live: https://s-arrighetti.github.io/3d_buildup/**

Everything runs in the browser. There is no server and no account — your work is
saved in the browser you use it from.

## What it does

- **Pallets** — PMC, PAG and PLA out of the box, with per-company dimension
  overrides. Add your own in the DB tab.
- **Cargo** — add boxes by dimension and weight, drag them into place. Snapping
  and stacking are automatic; overhang and overweight are flagged.
- **Materials** — skids, lumber, spacers, shelves, belts and nets, with an
  auto-layout that spreads skids evenly across the pallet.
- **Contour check** — overlay an aircraft contour (B757 main deck, A320 and so
  on) to see what the load fouls.
- **Split views** — start on one pallet and split out up to four. Each pane is
  its own build-up, and dragging a box from one pane to another moves it there.

## Controls

| Action | How |
|---|---|
| Orbit / zoom | Drag / scroll in a pane |
| Select | Click a box |
| Move | Drag a box, or arrow keys (Shift for 5 cm steps) |
| Move to another pane | Drag it over that pane and release |
| Rotate | Toolbar `±5°` / `90°` |
| Delete | `Delete` or the toolbar button |
| Undo | `Ctrl+Z` |
| Add / remove a pane | Toolbar `+` / `−`, or the `×` on a pane |

## Saving

Your pallets, cargo, materials and layout are written to the browser's
localStorage as you work, so a refresh or a closed tab won't lose them.

That also means the data lives in **one browser on one machine** — it does not
follow you to another device, and clearing site data erases it. There is no
export yet.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run lint
```

React 19 + TypeScript + Vite, three.js via @react-three/fiber, Zustand for
state, Tailwind for styling. Pushing to `main` builds and deploys to GitHub
Pages via `.github/workflows/deploy.yml`.

Default pallets, materials and contours live in `src/data/*.json`. Changing them
usually means bumping the matching store's persist `version` in `src/store/`, or
existing users keep the old copy.
