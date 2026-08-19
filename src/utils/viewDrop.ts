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

/**
 * Move a cargo item into another pane, landing it where the pointer was released.
 * Stacking and snapping are resolved against the target pane's own contents.
 */
export function dropCargoIntoView(
  cargoId: string,
  targetViewId: number,
  clientX: number,
  clientY: number
): void {
  const cargo = useCargoStore.getState().items.find((c) => c.id === cargoId);
  if (!cargo) return;

  const ground = groundPosInView(targetViewId, clientX, clientY);
  const pos: Position = { x: ground?.x ?? 0, y: cargo.position.y, z: ground?.z ?? 0 };

  const targetCargo = cargoInView(useCargoStore.getState().items, targetViewId);
  const targetMats = materialsInView(
    useMaterialStore.getState().placedMaterials,
    targetViewId
  );
  const materialTypes = useMaterialStore.getState().materialTypes;
  const pallet = getViewPallet(targetViewId);

  const { h } = getEffectiveDimensions(cargo.dimensions, cargo.rotation);
  pos.y = findStackHeight(pos, cargo, targetCargo, targetMats, materialTypes) + h / 2;

  const finalPos = pallet
    ? snapPosition(pos, cargo, targetCargo, pallet.dimensions)
    : pos;

  useCargoStore.getState().updateCargo(cargoId, {
    viewId: targetViewId,
    position: finalPos,
    placed: pallet ? isInsidePallet(finalPos, pallet) : false,
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
  const material = useMaterialStore
    .getState()
    .placedMaterials.find((m) => m.id === materialId);
  if (!material) return;

  const matType = useMaterialStore.getState().getMaterialType(material.materialTypeId);
  if (!matType) return;

  const ground = groundPosInView(targetViewId, clientX, clientY);
  const pos: Position = { x: ground?.x ?? 0, y: 0, z: ground?.z ?? 0 };

  const targetCargo = cargoInView(useCargoStore.getState().items, targetViewId);
  const targetMats = materialsInView(
    useMaterialStore.getState().placedMaterials,
    targetViewId
  );
  const materialTypes = useMaterialStore.getState().materialTypes;

  const stackH = findMaterialStackHeight(
    pos,
    material.id,
    matType,
    targetCargo,
    targetMats,
    materialTypes
  );

  useMaterialStore.getState().updateMaterial(materialId, {
    viewId: targetViewId,
    position: { x: pos.x, y: stackH + matType.dimensions.height / 2, z: pos.z },
  });

  useViewStore.getState().setActiveView(targetViewId);
}
