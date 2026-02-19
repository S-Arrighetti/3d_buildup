import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContourProfile } from '../types';
import defaultContours from '../data/contours.json';

interface ContourStore {
  contours: ContourProfile[];
  activeContourId: string | null;
  showContour: boolean;

  setActiveContour: (id: string | null) => void;
  toggleContour: () => void;
  addContour: (contour: ContourProfile) => void;
  updateContour: (id: string, updates: Partial<ContourProfile>) => void;
  deleteContour: (id: string) => void;
  getActiveContour: () => ContourProfile | null;
}

export const useContourStore = create<ContourStore>()(
  persist(
    (set, get) => ({
      contours: defaultContours as ContourProfile[],
      activeContourId: null,
      showContour: false,

      setActiveContour: (id) => set({ activeContourId: id, showContour: id !== null }),
      toggleContour: () => set((s) => ({ showContour: !s.showContour })),

      addContour: (contour) =>
        set((s) => ({ contours: [...s.contours, contour] })),

      updateContour: (id, updates) =>
        set((s) => ({
          contours: s.contours.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      deleteContour: (id) =>
        set((s) => ({
          contours: s.contours.filter((c) => c.id !== id),
          activeContourId: s.activeContourId === id ? null : s.activeContourId,
        })),

      getActiveContour: () => {
        const { contours, activeContourId } = get();
        return contours.find((c) => c.id === activeContourId) ?? null;
      },
    }),
    { name: 'buildup-contour-store' }
  )
);
