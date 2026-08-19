import { create } from 'zustand';
import type * as THREE from 'three';
import type { SceneState, Position, Dimensions } from '../types';

interface OrbitRef {
  enabled: boolean;
  enableRotate: boolean;
  enablePan: boolean;
  enableZoom: boolean;
}

/** A pane's camera and canvas, needed to hit-test and unproject across panes */
export interface ViewViewport {
  camera: THREE.Camera;
  el: HTMLCanvasElement;
}

/** Ghost shown in the target pane while dragging an item across views */
export interface DropPreview {
  viewId: number;
  position: Position;
  dimensions: Dimensions;
  rotation: number;
  color: string;
  label: string;
  /** false when the landing spot is off the pallet */
  valid: boolean;
}

interface SceneStore extends SceneState {
  rotationLocked: boolean;
  /** OrbitControls refs per split view (keyed by viewId) */
  orbitControlsRefs: Record<number, OrbitRef | null>;
  /** Camera + canvas per split view, registered from inside each Canvas */
  viewViewports: Record<number, ViewViewport | null>;
  /** Pane the pointer is currently over mid-drag, for the drop highlight */
  dragOverViewId: number | null;
  /** Where the dragged item would land in that pane */
  dropPreview: DropPreview | null;

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
  setOrbitControlsRef: (viewId: number, ref: OrbitRef | null) => void;
  setViewViewport: (viewId: number, viewport: ViewViewport | null) => void;
  setDragOverView: (viewId: number | null) => void;
  setDropPreview: (preview: DropPreview | null) => void;
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
  orbitControlsRefs: {},
  viewViewports: {},
  dragOverViewId: null,
  dropPreview: null,

  beltRoutingMode: false,
  beltRoutingMaterialTypeId: null,
  beltRoutePoints: [],

  selectObject: (id, type) => set({ selectedObjectId: id, selectedObjectType: type }),
  setDragging: (isDragging) => set({ isDragging }),
  setShowContour: (show) => set({ showContour: show }),
  setActiveContour: (id) => set({ activeContourId: id, showContour: id !== null }),
  clearSelection: () => set({ selectedObjectId: null, selectedObjectType: null }),
  toggleRotationLock: () => set((s) => ({ rotationLocked: !s.rotationLocked })),
  setOrbitControlsRef: (viewId, ref) =>
    set((s) => ({ orbitControlsRefs: { ...s.orbitControlsRefs, [viewId]: ref } })),

  setViewViewport: (viewId, viewport) =>
    set((s) => ({ viewViewports: { ...s.viewViewports, [viewId]: viewport } })),

  // Called on every pointermove during a drag — skip the set when unchanged so
  // panes don't re-render on each frame
  setDragOverView: (viewId) => {
    if (get().dragOverViewId !== viewId) set({ dragOverViewId: viewId });
  },

  setDropPreview: (preview) => {
    // Skip no-op sets so the ghost doesn't re-render every frame while the
    // pointer sits still
    const prev = get().dropPreview;
    if (
      prev === preview ||
      (prev &&
        preview &&
        prev.viewId === preview.viewId &&
        prev.valid === preview.valid &&
        prev.position.x === preview.position.x &&
        prev.position.y === preview.position.y &&
        prev.position.z === preview.position.z)
    ) {
      return;
    }
    set({ dropPreview: preview });
  },

  // Disable rotate/pan during drag (zoom stays active) — applies to all views
  disableOrbit: () => {
    for (const ref of Object.values(get().orbitControlsRefs)) {
      if (ref) {
        ref.enableRotate = false;
        ref.enablePan = false;
      }
    }
  },
  // Re-enable rotate/pan (respects lock state)
  enableOrbit: () => {
    const { orbitControlsRefs, rotationLocked } = get();
    for (const ref of Object.values(orbitControlsRefs)) {
      if (ref) {
        ref.enableRotate = !rotationLocked;
        ref.enablePan = !rotationLocked;
      }
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
