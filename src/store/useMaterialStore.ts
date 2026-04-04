import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { MaterialType, PlacedMaterial, Position } from '../types';
import defaultMaterials from '../data/materials.json';

interface MaterialStore {
  materialTypes: MaterialType[];
  placedMaterials: PlacedMaterial[];

  // Placing materials
  placeMaterial: (materialTypeId: string, position: Position) => string;
  removePlacedMaterial: (id: string) => void;
  updateMaterialPosition: (id: string, position: Position) => void;
  updateMaterialRotation: (id: string, rotation: number) => void;
  attachBeltToCargo: (materialId: string, cargoIds: string[]) => void;
  clearAllPlaced: () => void;

  // DB management
  addMaterialType: (mat: MaterialType) => void;
  updateMaterialType: (id: string, updates: Partial<MaterialType>) => void;
  deleteMaterialType: (id: string) => void;
  getMaterialType: (id: string) => MaterialType | undefined;
}

export const useMaterialStore = create<MaterialStore>()(
  persist(
    (set, get) => ({
      materialTypes: defaultMaterials as MaterialType[],
      placedMaterials: [],

      placeMaterial: (materialTypeId, position) => {
        const id = uuidv4();
        set((s) => ({
          placedMaterials: [
            ...s.placedMaterials,
            { id, materialTypeId, position, rotation: 0 },
          ],
        }));
        return id;
      },

      removePlacedMaterial: (id) =>
        set((s) => ({
          placedMaterials: s.placedMaterials.filter((m) => m.id !== id),
        })),

      updateMaterialPosition: (id, position) =>
        set((s) => ({
          placedMaterials: s.placedMaterials.map((m) =>
            m.id === id ? { ...m, position } : m
          ),
        })),

      updateMaterialRotation: (id, rotation) =>
        set((s) => ({
          placedMaterials: s.placedMaterials.map((m) =>
            m.id === id ? { ...m, rotation } : m
          ),
        })),

      attachBeltToCargo: (materialId, cargoIds) =>
        set((s) => ({
          placedMaterials: s.placedMaterials.map((m) =>
            m.id === materialId ? { ...m, attachedCargoIds: cargoIds } : m
          ),
        })),

      clearAllPlaced: () => set({ placedMaterials: [] }),

      addMaterialType: (mat) =>
        set((s) => ({ materialTypes: [...s.materialTypes, mat] })),

      updateMaterialType: (id, updates) =>
        set((s) => ({
          materialTypes: s.materialTypes.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      deleteMaterialType: (id) =>
        set((s) => ({
          materialTypes: s.materialTypes.filter((m) => m.id !== id),
        })),

      getMaterialType: (id) => get().materialTypes.find((m) => m.id === id),
    }),
    {
      name: 'buildup-material-store',
      version: 1,
      partialize: (state) => ({ materialTypes: state.materialTypes }),
      migrate: (_persisted) => {
        const state = _persisted as Pick<MaterialStore, 'materialTypes'>;
        const defaults = defaultMaterials as MaterialType[];
        // Add any new default materials that aren't in the stored list
        const storedIds = new Set(state.materialTypes.map((m) => m.id));
        const newTypes = defaults.filter((d) => !storedIds.has(d.id));
        // Merge meshShape from defaults into existing types
        const merged = state.materialTypes.map((m) => {
          const def = defaults.find((d) => d.id === m.id);
          return def?.meshShape ? { ...m, meshShape: def.meshShape } : m;
        });
        return { materialTypes: [...merged, ...newTypes] };
      },
    }
  )
);
