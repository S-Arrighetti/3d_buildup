# 3D Build-Up — working notes

Browser-only 3D planner for air cargo pallet build-ups. React 19 + TypeScript +
Vite, three.js through @react-three/fiber, Zustand stores, Tailwind v4.

Live at https://s-arrighetti.github.io/3d_buildup/ — released publicly on
2026-08-19. User-facing docs are in [README.md](README.md); this file is for
whoever works on the code next.

## Commands

```bash
npm run dev            # dev server
npm run build          # tsc -b && vite build — the real typecheck
npm run lint           # currently clean; keep it that way
```

`npx tsc --noEmit -p tsconfig.json` silently does nothing — tsconfig.json is
solution-style with project references. Use `npm run build` to typecheck.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. There is no manual step. To confirm a deploy landed
rather than assuming it did:

```powershell
# newest run for the workflow, then poll it
(Invoke-RestMethod "https://api.github.com/repos/S-Arrighetti/3d_buildup/actions/workflows/deploy.yml/runs?per_page=1" -Headers @{'User-Agent'='claude'}).workflow_runs[0]
```

Then fetch the site and grep the hashed bundle for a string you just added. The
`gh` CLI is **not** installed on this machine; use the REST API. GitHub's
`/pages` API endpoint 404s unauthenticated — request the site URL directly.

A `gh-pages` git worktree sits at `gh-pages-temp/`. Nothing in the current flow
uses it; the workflow publishes the artifact directly.

## Architecture

State lives in Zustand stores under `src/store/`. Components read them directly;
there is no prop drilling of app state.

| Store | Persisted | Holds |
|---|---|---|
| `useCargoStore` | ✅ | cargo items |
| `useMaterialStore` | ✅ (partialize) | material catalogue + placed materials |
| `usePalletStore` | ✅ | pallet types, companies, per-view selection |
| `useViewStore` | ✅ | split-view count and active view |
| `useContourStore` | ✅ | contour profiles |
| `useSceneStore` | ❌ | selection, drag state, per-view cameras — transient |
| `useHistoryStore` | ❌ | undo snapshots |

`viewActions.ts` and `objectActions.ts` hold cross-store operations that don't
belong to any single store (removing a pane, deleting the selection).

### Split views

Up to `MAX_VIEWS` (4) panes, each an independent build-up. Starts at 1; the user
splits out more with the toolbar `+`.

- Cargo and materials carry a `viewId`. Items written before this existed have no
  `viewId`, so **always read it as `viewId ?? 0`** — `cargoInView` and
  `materialsInView` do this for you.
- Add/Place actions read `useViewStore.getState().activeViewId`. Exactly one view
  is the target at a time; this was an explicit product decision.
- `ViewIdContext` supplies the pane's id inside each `<Canvas>`. It must be
  provided *inside* the Canvas to live in the R3F tree.
- Removing a pane shifts higher ids down so they stay contiguous from 0.
  `deleteView` remaps cargo, materials and pallet selections together — never
  change `viewCount` without going through it.

### Cross-pane drag

Each pane is its own `<Canvas>`, so the pane where a drag starts keeps receiving
the pointer events. `src/utils/viewDrop.ts` bridges the gap:

- `viewAtPoint(x, y)` hit-tests the screen point against every pane's canvas rect.
- `groundPosInView` unprojects through **that pane's own camera**, registered into
  `useSceneStore.viewViewports` from inside each `SceneContent`.
- `planCargoDrop` / `planMaterialDrop` compute the landing spot. The preview ghost
  and the actual drop both call these, so they cannot drift apart — if you change
  landing behaviour, change it there and both follow.

During a drag the item stays rendered in its original pane; only the ghost shows
in the target. Moving the live mesh across canvases is not possible without
re-parenting into a different React root.

### Undo

`useHistoryStore` snapshots **all** views at once, on purpose. The four panes are
one shipment distributed across pallets, so a cross-view move has to undo as a
single step. Do not split history per view.

## Gotchas

**Persist versions.** Every persisted store has a `version` and a `migrate`.
Changing anything in `src/data/*.json` without bumping the matching store's
version means existing users keep their stale copy — their localStorage wins.

Migrations must be **additive**: keep what the user has, add defaults they are
missing. `usePalletStore` used to replace the whole store on every bump, which
silently destroyed hand-made pallets and companies. That is fixed; don't
reintroduce the pattern.

**`isRetiredCkSkid` in `useMaterialStore`** is a one-off cleanup for a duplicate
material one user created by hand. It only runs through the v3 migrate. Safe to
delete along with the migrate branch once no browser is still below v3.

**Storage is per-browser.** No server, no accounts, no export. Users lose their
work if they clear site data or switch machines. This is the most likely source
of incoming complaints — a JSON export/import is the natural next feature.

**Data files couple to stores.** `src/data/pallets.json`, `materials.json`,
`contours.json`, `companies.json` seed the corresponding stores.

## Known gaps

- No export/import; no `beforeunload` warning.
- No tests and no ErrorBoundary anywhere.
- Bundle is ~1.4 MB (404 KB gzipped), no code splitting — three.js dominates.
- Four canvases will be heavy on mobile; untested there.
- Toolbar overflows horizontally on narrow windows since the view controls were
  added — reported, not yet fixed.

## Conventions

- Comments explain *why*, not *what*. Match the density of surrounding code.
- The user works in Korean; code, comments and commit messages stay in English.
- Generated artefacts (`3D_BuildUp_Model_*.pptx`, `*.html`) are gitignored and
  live in the project root by convention. A Japanese user manual deck is at
  `3D_BuildUp_Model_マニュアル_JP.pptx`, generated by a python-pptx script
  (python 3.11 + python-pptx 1.0.2 are installed).
- Verify before reporting. Build, lint, and for anything deployed, check the live
  bundle actually contains the change.
