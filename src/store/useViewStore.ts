import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewLayout = 'single' | 'quad';

/** Fixed 4-screen split: view ids 0..3 */
export const VIEW_IDS = [0, 1, 2, 3] as const;

interface ViewStore {
  /** The single active view — all Place/Add actions target this view only */
  activeViewId: number;
  layout: ViewLayout;
  setActiveView: (id: number) => void;
  setLayout: (layout: ViewLayout) => void;
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      activeViewId: 0,
      layout: 'quad',
      setActiveView: (id) => set({ activeViewId: id }),
      setLayout: (layout) => set({ layout }),
    }),
    { name: 'buildup-view-store', version: 1 }
  )
);
