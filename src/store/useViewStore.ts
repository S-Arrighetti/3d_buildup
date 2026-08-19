import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Hard ceiling on how many panes can be split out */
export const MAX_VIEWS = 4;

interface ViewStore {
  /** Number of visible panes (1..MAX_VIEWS). Starts at 1 — the user splits on demand. */
  viewCount: number;
  /** The single active view — all Place/Add actions target this view only */
  activeViewId: number;
  setActiveView: (id: number) => void;
  /** Split out one more pane and make it active. Returns its id, or null at max. */
  addView: () => number | null;
  /** Drop the last pane. Callers must remap contents first — see viewActions.deleteView. */
  removeView: (id: number) => void;
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set, get) => ({
      viewCount: 1,
      activeViewId: 0,

      setActiveView: (id) => {
        if (id >= 0 && id < get().viewCount) set({ activeViewId: id });
      },

      addView: () => {
        const { viewCount } = get();
        if (viewCount >= MAX_VIEWS) return null;
        const newId = viewCount;
        set({ viewCount: viewCount + 1, activeViewId: newId });
        return newId;
      },

      removeView: (id) => {
        const { viewCount, activeViewId } = get();
        if (viewCount <= 1) return;
        const nextCount = viewCount - 1;
        // Panes above the removed one shift down, so the active id follows suit
        const shifted = activeViewId > id ? activeViewId - 1 : activeViewId;
        set({ viewCount: nextCount, activeViewId: Math.min(shifted, nextCount - 1) });
      },
    }),
    {
      name: 'buildup-view-store',
      version: 2,
      migrate: (persisted) => {
        // v1 stored layout: 'single' | 'quad'. Keep quad users on 4 panes so the
        // cargo they already have in views 2-4 stays reachable.
        const s = persisted as { activeViewId?: number; layout?: string } | undefined;
        const viewCount = s?.layout === 'quad' ? MAX_VIEWS : 1;
        return {
          viewCount,
          activeViewId: Math.min(Math.max(s?.activeViewId ?? 0, 0), viewCount - 1),
        };
      },
    }
  )
);

/** Ids of the currently visible panes, e.g. [0, 1, 2] when viewCount is 3 */
export function visibleViewIds(viewCount: number): number[] {
  return Array.from({ length: viewCount }, (_, i) => i);
}
