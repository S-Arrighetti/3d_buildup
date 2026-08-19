import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { useViewStore } from '../store/useViewStore';
import { useCargoStore, cargoInView } from '../store/useCargoStore';
import { useMaterialStore, materialsInView } from '../store/useMaterialStore';
import { getViewPallet } from '../store/usePalletStore';
import {
  snapPosition,
  findStackHeight,
  findMaterialStackHeight,
  getEffectiveDimensions,
} from './snapping';
import type { PalletType, Position } from '../types';

const SCALE = 0.01; // must match Scene.tsx

// Reused across calls — these run on every pointermove during a drag
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

/**
 * Which pane sits under a screen point, or null when the point is outside them all.
 * Each pane is its own Canvas, so a drag that starts in one pane keeps receiving
 * pointer events from that pane's window listeners — this is how we find out the
 * pointer has travelled somewhere else.
 */
export function viewAtPoint(clientX: number, clientY: number): number | null {
  const { viewViewports } = useSceneStore.getState();
  const visible = useViewStore.getState().viewCount;

  for (const [key, vp] of Object.entries(viewViewports)) {
    const id = Number(key);
    if (!vp || id >= visible) continue;
    const r = vp.el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return id;
    }
  }
  return null;
}

/**
 * Screen point → ground-plane position in cm, unprojected through the target
 * pane's own camera. Returns null if the pane isn't mounted or the ray misses.
 */
export function groundPosInView(
  viewId: number,
  clientX: number,
  clientY: number
): { x: number; z: number } | null {
  const vp = useSceneStore.getState().viewViewports[viewId];
  if (!vp) return null;

  const r = vp.el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;

  pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, vp.camera);

  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
  return { x: hitPoint.x / SCALE, z: hitPoint.z / SCALE };
}

function isInsidePallet(pos: Position, pallet: PalletType): boolean {
  const halfLength = pallet.dimensions.length / 2;
  const halfWidth = pallet.dimensions.width / 2;
  return (
    pos.x > -halfLength && pos.x < halfLength && pos.z > -halfWidth && pos.z < halfWidth
  );
}

/** Where a dragged item would land in a target pane, without moving it yet */
interface DropPlan {
  position: Position;
  /** Cargo only: whether it lands on the pallet and counts as placed */
  valid: boolean;
}

/**
 * Resolve where a cargo item would come to rest in another pane. Stacking and
 * snapping are computed against the target pane's own contents, so the preview
 * and the eventual drop always agree.
 */
export function planCargoDrop(
  cargoId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): DropPlan | null {
  const cargo = useCargoStore.getState().items.find((c) => c.id === cargoId);
  if (!cargo) return null;

  const ground = groundPosInView(targetViewId, clientX, clientY);
  if (!ground) return null;

  const pos: Position = { x: ground.x, y: cargo.position.y, z: ground.z };

  const targetCargo = cargoInView(useCargoStore.getState().items, targetViewId);
  const targetMats = materialsInView(
    useMaterialStore.getState().placedMaterials,
    targetViewId
  );
  const materialTypes = useMaterialStore.getState().materialTypes;
  const pallet = getViewPallet(targetViewId);

  const { h } = getEffectiveDimensions(cargo.dimensions, cargo.rotation);
  pos.y = findStackHeight(pos, cargo, targetCargo, targetMats, materialTypes) + h / 2;

  const position = pallet
    ? snapPosition(pos, cargo, targetCargo, pallet.dimensions)
    : pos;

  return { position, valid: pallet ? isInsidePallet(position, pallet) : false };
}

/** Resolve where a placed material would come to rest in another pane. */
export function planMaterialDrop(
  materialId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): DropPlan | null {
  const material = useMaterialStore
    .getState()
    .placedMaterials.find((m) => m.id === materialId);
  if (!material) return null;

  const matType = useMaterialStore.getState().getMaterialType(material.materialTypeId);
  if (!matType) return null;

  const ground = groundPosInView(targetViewId, clientX, clientY);
  if (!ground) return null;

  const pos: Position = { x: ground.x, y: 0, z: ground.z };

  const stackH = findMaterialStackHeight(
    pos,
    material.id,
    matType,
    cargoInView(useCargoStore.getState().items, targetViewId),
    materialsInView(useMaterialStore.getState().placedMaterials, targetViewId),
    useMaterialStore.getState().materialTypes
  );

  return {
    position: { x: pos.x, y: stackH + matType.dimensions.height / 2, z: pos.z },
    valid: true,
  };
}

/** Show a ghost of where the dragged cargo would land in the pane under the pointer */
export function previewCargoDrop(
  cargoId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): void {
  const cargo = useCargoStore.getState().items.find((c) => c.id === cargoId);
  const plan = planCargoDrop(cargoId, targetViewId, clientX, clientY);
  if (!cargo || !plan) {
    useSceneStore.getState().setDropPreview(null);
    return;
  }

  useSceneStore.getState().setDropPreview({
    viewId: targetViewId,
    position: plan.position,
    dimensions: cargo.dimensions,
    rotation: cargo.rotation,
    color: cargo.color,
    label: cargo.label,
    valid: plan.valid,
  });
}

/** Show a ghost of where the dragged material would land in the pane under the pointer */
export function previewMaterialDrop(
  materialId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): void {
  const material = useMaterialStore
    .getState()
    .placedMaterials.find((m) => m.id === materialId);
  const matType = material
    ? useMaterialStore.getState().getMaterialType(material.materialTypeId)
    : undefined;
  const plan = planMaterialDrop(materialId, targetViewId, clientX, clientY);
  if (!material || !matType || !plan) {
    useSceneStore.getState().setDropPreview(null);
    return;
  }

  useSceneStore.getState().setDropPreview({
    viewId: targetViewId,
    position: plan.position,
    dimensions: matType.dimensions,
    rotation: material.rotation,
    color: matType.color,
    label: matType.name,
    valid: true,
  });
}

/**
 * Move a cargo item into another pane, landing it where the pointer was released
 * — the same spot the preview ghost was showing.
 */
export function dropCargoIntoView(
  cargoId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): void {
  const plan = planCargoDrop(cargoId, targetViewId, clientX, clientY);
  if (!plan) return;

  useCargoStore.getState().updateCargo(cargoId, {
    viewId: targetViewId,
    position: plan.position,
    placed: plan.valid,
  });

  useViewStore.getState().setActiveView(targetViewId);
}

/** Move a placed material into another pane, landing it under the pointer. */
export function dropMaterialIntoView(
  materialId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): void {
  const plan = planMaterialDrop(materialId, targetViewId, clientX, clientY);
  if (!plan) return;

  useMaterialStore.getState().updateMaterial(materialId, {
    viewId: targetViewId,
    position: plan.position,
  });

  useViewStore.getState().setActiveView(targetViewId);
}
