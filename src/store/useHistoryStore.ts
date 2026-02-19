import { create } from 'zustand';
import type { CargoItem, PlacedMaterial } from '../types';
import { useCargoStore } from './useCargoStore';
import { useMaterialStore } from './useMaterialStore';

interface HistorySnapshot {
  cargoItems: CargoItem[];
  placedMaterials: PlacedMaterial[];
}

const MAX_HISTORY = 50;

interface HistoryStore {
  past: HistorySnapshot[];
  pushSnapshot: () => void;
  undo: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],

  pushSnapshot: () => {
    const cargoItems = structuredClone(useCargoStore.getState().items);
    const placedMaterials = structuredClone(useMaterialStore.getState().placedMaterials);

    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), { cargoItems, placedMaterials }],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const snapshot = past[past.length - 1];

    // Restore cargo state
    useCargoStore.setState({ items: snapshot.cargoItems });

    // Restore material state
    useMaterialStore.setState({ placedMaterials: snapshot.placedMaterials });

    // Pop the snapshot
    set((s) => ({ past: s.past.slice(0, -1) }));
  },
}));
