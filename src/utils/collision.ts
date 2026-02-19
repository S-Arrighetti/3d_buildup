import type { CargoItem, Dimensions, PlacedMaterial, MaterialType } from '../types';
import { getCargoAABB, getMaterialAABB } from './snapping';

export interface OverhangResult {
  left: boolean;
  right: boolean;
  front: boolean;
  back: boolean;
  hasOverhang: boolean;
  overhangs: { side: string; amount: number }[];
}

export function checkOverhang(
  cargo: CargoItem,
  palletDimensions: Dimensions
): OverhangResult {
  const aabb = getCargoAABB(cargo);
  const halfPL = palletDimensions.length / 2;
  const halfPW = palletDimensions.width / 2;

  const left = aabb.minX < -halfPL;
  const right = aabb.maxX > halfPL;
  const front = aabb.minZ < -halfPW;
  const back = aabb.maxZ > halfPW;

  const overhangs: { side: string; amount: number }[] = [];
  if (left) overhangs.push({ side: 'left', amount: -halfPL - aabb.minX });
  if (right) overhangs.push({ side: 'right', amount: aabb.maxX - halfPL });
  if (front) overhangs.push({ side: 'front', amount: -halfPW - aabb.minZ });
  if (back) overhangs.push({ side: 'back', amount: aabb.maxZ - halfPW });

  return {
    left,
    right,
    front,
    back,
    hasOverhang: left || right || front || back,
    overhangs,
  };
}

export function checkAllOverhangs(
  cargos: CargoItem[],
  palletDimensions: Dimensions
): Map<string, OverhangResult> {
  const results = new Map<string, OverhangResult>();
  for (const cargo of cargos) {
    if (!cargo.placed) continue;
    results.set(cargo.id, checkOverhang(cargo, palletDimensions));
  }
  return results;
}

/**
 * Check if cargo exceeds inner line (rivet line) without material support underneath.
 * Returns per-side flags for which inner edges are violated.
 */
export interface InnerOverhangResult {
  left: boolean;
  right: boolean;
  front: boolean;
  back: boolean;
  hasInnerOverhang: boolean;
}

export function checkInnerOverhang(
  cargo: CargoItem,
  innerDimensions: { length: number; width: number },
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[]
): InnerOverhangResult {
  const aabb = getCargoAABB(cargo);
  const halfIL = innerDimensions.length / 2;
  const halfIW = innerDimensions.width / 2;

  // Check which sides exceed inner line
  const leftExceeds = aabb.minX < -halfIL;
  const rightExceeds = aabb.maxX > halfIL;
  const frontExceeds = aabb.minZ < -halfIW;
  const backExceeds = aabb.maxZ > halfIW;

  if (!leftExceeds && !rightExceeds && !frontExceeds && !backExceeds) {
    return { left: false, right: false, front: false, back: false, hasInnerOverhang: false };
  }

  // Check if there's supporting material (skid, lumber, spacer) underneath this cargo
  const hasMaterialSupport = placedMaterials.some((pm) => {
    const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
    if (!mt) return false;
    // Only skid/lumber/spacer count as support
    if (mt.category !== 'skid' && mt.category !== 'lumber' && mt.category !== 'spacer') return false;

    // Check if material is underneath the cargo (XZ overlap + material top near cargo bottom)
    const isRotated = pm.rotation === 90 || pm.rotation === 270;
    const mHalfL = (isRotated ? mt.dimensions.width : mt.dimensions.length) / 2;
    const mHalfW = (isRotated ? mt.dimensions.length : mt.dimensions.width) / 2;
    const mTopY = pm.position.y + mt.dimensions.height / 2;

    const overlapX = pm.position.x - mHalfL < aabb.maxX && pm.position.x + mHalfL > aabb.minX;
    const overlapZ = pm.position.z - mHalfW < aabb.maxZ && pm.position.z + mHalfW > aabb.minZ;
    const isBelow = Math.abs(mTopY - aabb.minY) < 5; // within 5cm tolerance

    return overlapX && overlapZ && isBelow;
  });

  // If material supports the cargo, no inner overhang warning
  if (hasMaterialSupport) {
    return { left: false, right: false, front: false, back: false, hasInnerOverhang: false };
  }

  return {
    left: leftExceeds,
    right: rightExceeds,
    front: frontExceeds,
    back: backExceeds,
    hasInnerOverhang: leftExceeds || rightExceeds || frontExceeds || backExceeds,
  };
}

export function checkAllInnerOverhangs(
  cargos: CargoItem[],
  innerDimensions: { length: number; width: number },
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[]
): Map<string, InnerOverhangResult> {
  const results = new Map<string, InnerOverhangResult>();
  for (const cargo of cargos) {
    if (!cargo.placed) continue;
    results.set(cargo.id, checkInnerOverhang(cargo, innerDimensions, placedMaterials, materialTypes));
  }
  return results;
}

export function getMaxStackHeight(cargos: CargoItem[]): number {
  let maxH = 0;
  for (const cargo of cargos) {
    if (!cargo.placed) continue;
    const aabb = getCargoAABB(cargo);
    maxH = Math.max(maxH, aabb.maxY);
  }
  return maxH;
}

export function getMaxStackHeightWithMaterials(
  cargos: CargoItem[],
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[]
): number {
  let maxH = getMaxStackHeight(cargos);

  for (const pm of placedMaterials) {
    const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
    if (!mt) continue;
    const topY = pm.position.y + mt.dimensions.height / 2;
    maxH = Math.max(maxH, topY);
  }

  return maxH;
}

// --- Material overhang checks ---

/** Check if a placed material exceeds the outer pallet boundary */
export function checkMaterialOverhang(
  pm: PlacedMaterial,
  mt: MaterialType,
  palletDimensions: Dimensions
): OverhangResult {
  const aabb = getMaterialAABB(pm, mt);
  const halfPL = palletDimensions.length / 2;
  const halfPW = palletDimensions.width / 2;

  const left = aabb.minX < -halfPL;
  const right = aabb.maxX > halfPL;
  const front = aabb.minZ < -halfPW;
  const back = aabb.maxZ > halfPW;

  const overhangs: { side: string; amount: number }[] = [];
  if (left) overhangs.push({ side: 'left', amount: -halfPL - aabb.minX });
  if (right) overhangs.push({ side: 'right', amount: aabb.maxX - halfPL });
  if (front) overhangs.push({ side: 'front', amount: -halfPW - aabb.minZ });
  if (back) overhangs.push({ side: 'back', amount: aabb.maxZ - halfPW });

  return { left, right, front, back, hasOverhang: left || right || front || back, overhangs };
}

export function checkAllMaterialOverhangs(
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[],
  palletDimensions: Dimensions
): Map<string, OverhangResult> {
  const results = new Map<string, OverhangResult>();
  for (const pm of placedMaterials) {
    const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
    if (!mt) continue;
    results.set(pm.id, checkMaterialOverhang(pm, mt, palletDimensions));
  }
  return results;
}

/** Check if a placed material exceeds the inner line */
export function checkMaterialInnerOverhang(
  pm: PlacedMaterial,
  mt: MaterialType,
  innerDimensions: { length: number; width: number }
): InnerOverhangResult {
  const aabb = getMaterialAABB(pm, mt);
  const halfIL = innerDimensions.length / 2;
  const halfIW = innerDimensions.width / 2;

  const left = aabb.minX < -halfIL;
  const right = aabb.maxX > halfIL;
  const front = aabb.minZ < -halfIW;
  const back = aabb.maxZ > halfIW;

  return {
    left,
    right,
    front,
    back,
    hasInnerOverhang: left || right || front || back,
  };
}

export function checkAllMaterialInnerOverhangs(
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[],
  innerDimensions: { length: number; width: number }
): Map<string, InnerOverhangResult> {
  const results = new Map<string, InnerOverhangResult>();
  for (const pm of placedMaterials) {
    const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
    if (!mt) continue;
    results.set(pm.id, checkMaterialInnerOverhang(pm, mt, innerDimensions));
  }
  return results;
}
