import { useCargoStore } from './useCargoStore';
import { useMaterialStore } from './useMaterialStore';
import { usePalletStore, defaultViewSelections } from './usePalletStore';
import type { ViewPalletSelection } from './usePalletStore';
import { useSceneStore } from './useSceneStore';
import { useViewStore, MAX_VIEWS } from './useViewStore';

/** A pane above the removed one slides down a slot; the rest keep their id */
function reindex(viewId: number | undefined, removed: number): number {
  const id = viewId ?? 0;
  return id > removed ? id - 1 : id;
}

/** How many cargo items and materials live in a pane */
export function viewContentCount(viewId: number): number {
  const cargo = useCargoStore
    .getState()
    .items.filter((c) => (c.viewId ?? 0) === viewId).length;
  const materials = useMaterialStore
    .getState()
    .placedMaterials.filter((m) => (m.viewId ?? 0) === viewId).length;
  return cargo + materials;
}

/**
 * Remove a pane. Its cargo and materials are discarded, and every pane above it
 * shifts down one slot so ids stay contiguous from 0 — otherwise the remaining
 * panes would point at gaps.
 */
export function deleteView(removed: number): void {
  const { viewCount } = useViewStore.getState();
  if (viewCount <= 1 || removed < 0 || removed >= viewCount) return;

  useCargoStore.setState((s) => ({
    items: s.items
      .filter((c) => (c.viewId ?? 0) !== removed)
      .map((c) => ({ ...c, viewId: reindex(c.viewId, removed) })),
  }));

  useMaterialStore.setState((s) => ({
    placedMaterials: s.placedMaterials
      .filter((m) => (m.viewId ?? 0) !== removed)
      .map((m) => ({ ...m, viewId: reindex(m.viewId, removed) })),
  }));

  usePalletStore.setState((s) => {
    const fallback = defaultViewSelections();
    const next: Record<number, ViewPalletSelection> = {};
    for (let i = 0; i < MAX_VIEWS; i++) {
      const source = i < removed ? i : i + 1;
      next[i] = s.viewSelections[source] ?? fallback[i];
    }
    return { viewSelections: next };
  });

  useSceneStore.getState().clearSelection();
  useViewStore.getState().removeView(removed);
}
