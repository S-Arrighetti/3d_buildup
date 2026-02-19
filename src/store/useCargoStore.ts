import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CargoItem, Dimensions, Position } from '../types';

const CARGO_COLORS = [
  '#4FC3F7', '#81C784', '#FFB74D', '#E57373',
  '#BA68C8', '#4DD0E1', '#AED581', '#FF8A65',
  '#F06292', '#7986CB', '#A1887F', '#90A4AE',
];

interface CargoStore {
  items: CargoItem[];
  addCargo: (dimensions: Dimensions, weight: number, quantity: number, label?: string) => void;
  removeCargo: (id: string) => void;
  updateCargoPosition: (id: string, position: Position) => void;
  updateCargoRotation: (id: string, rotation: number) => void;
  setCargoPlaced: (id: string, placed: boolean) => void;
  updateCargo: (id: string, updates: Partial<CargoItem>) => void;
  clearAll: () => void;
  getTotalWeight: () => number;
  getTotalVolume: () => number;
}

let colorIndex = 0;

export const useCargoStore = create<CargoStore>((set, get) => ({
  items: [],

  addCargo: (dimensions, weight, quantity, label) => {
    const newItems: CargoItem[] = [];
    for (let i = 0; i < quantity; i++) {
      const color = CARGO_COLORS[colorIndex % CARGO_COLORS.length];
      colorIndex++;
      newItems.push({
        id: uuidv4(),
        label: label || `Cargo ${get().items.length + newItems.length + 1}`,
        dimensions,
        weight,
        quantity: 1,
        color,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        placed: false,
      });
    }
    set((s) => ({ items: [...s.items, ...newItems] }));
  },

  removeCargo: (id) =>
    set((s) => ({ items: s.items.filter((c) => c.id !== id) })),

  updateCargoPosition: (id, position) =>
    set((s) => ({
      items: s.items.map((c) => (c.id === id ? { ...c, position } : c)),
    })),

  updateCargoRotation: (id, rotation) =>
    set((s) => ({
      items: s.items.map((c) => (c.id === id ? { ...c, rotation } : c)),
    })),

  setCargoPlaced: (id, placed) =>
    set((s) => ({
      items: s.items.map((c) => (c.id === id ? { ...c, placed } : c)),
    })),

  updateCargo: (id, updates) =>
    set((s) => ({
      items: s.items.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  clearAll: () => {
    colorIndex = 0;
    set({ items: [] });
  },

  getTotalWeight: () => get().items.filter((c) => c.placed).reduce((sum, c) => sum + c.weight, 0),

  getTotalVolume: () =>
    get()
      .items.filter((c) => c.placed)
      .reduce(
        (sum, c) =>
          sum + (c.dimensions.length * c.dimensions.width * c.dimensions.height) / 1_000_000,
        0
      ),
}));
