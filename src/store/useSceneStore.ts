import { create } from 'zustand';
import type { SceneState, Position } from '../types';

interface OrbitRef {
  enabled: boolean;
  enableRotate: boolean;
  enablePan: boolean;
  enableZoom: boolean;
}

interface SceneStore extends SceneState {
  rotationLocked: boolean;
  orbitControlsRef: OrbitRef | null;

  // Belt routing mode
  beltRoutingMode: boolean;
  beltRoutingMaterialTypeId: string | null;
  beltRoutePoints: Position[];

  selectObject: (id: string | null, type: 'cargo' | 'material' | null) => void;
  setDragging: (isDragging: boolean) => void;
  setShowContour: (show: boolean) => void;
  setActiveContour: (id: string | null) => void;
  clearSelection: () => void;
  toggleRotationLock: () => void;
  setOrbitControlsRef: (ref: OrbitRef | null) => void;
  disableOrbit: () => void;
  enableOrbit: () => void;

  startBeltRouting: (materialTypeId: string) => void;
  addBeltRoutePoint: (point: Position) => void;
  cancelBeltRouting: () => void;
  finishBeltRouting: () => Position[] | null;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  selectedObjectId: null,
  selectedObjectType: null,
  isDragging: false,
  showContour: false,
  activeContourId: null,
  rotationLocked: false,
  orbitControlsRef: null,

  beltRoutingMode: false,
  beltRoutingMaterialTypeId: null,
  beltRoutePoints: [],

  selectObject: (id, type) => set({ selectedObjectId: id, selectedObjectType: type }),
  setDragging: (isDragging) => set({ isDragging }),
  setShowContour: (show) => set({ showContour: show }),
  setActiveContour: (id) => set({ activeContourId: id, showContour: id !== null }),
  clearSelection: () => set({ selectedObjectId: null, selectedObjectType: null }),
  toggleRotationLock: () => set((s) => ({ rotationLocked: !s.rotationLocked })),
  setOrbitControlsRef: (ref) => set({ orbitControlsRef: ref }),

  // Disable rotate/pan during drag (zoom stays active)
  disableOrbit: () => {
    const ref = get().orbitControlsRef;
    if (ref) {
      ref.enableRotate = false;
      ref.enablePan = false;
    }
  },
  // Re-enable rotate/pan (respects lock state)
  enableOrbit: () => {
    const { orbitControlsRef, rotationLocked } = get();
    if (orbitControlsRef) {
      orbitControlsRef.enableRotate = !rotationLocked;
      orbitControlsRef.enablePan = !rotationLocked;
    }
  },

  // Belt routing
  startBeltRouting: (materialTypeId) =>
    set({ beltRoutingMode: true, beltRoutingMaterialTypeId: materialTypeId, beltRoutePoints: [] }),
  addBeltRoutePoint: (point) =>
    set((s) => ({ beltRoutePoints: [...s.beltRoutePoints, point] })),
  cancelBeltRouting: () =>
    set({ beltRoutingMode: false, beltRoutingMaterialTypeId: null, beltRoutePoints: [] }),
  finishBeltRouting: () => {
    const { beltRoutePoints } = get();
    if (beltRoutePoints.length < 2) return null;
    const points = [...beltRoutePoints];
    set({ beltRoutingMode: false, beltRoutingMaterialTypeId: null, beltRoutePoints: [] });
    return points;
  },
}));
