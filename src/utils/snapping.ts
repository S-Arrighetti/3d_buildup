import type { CargoItem, Position, Dimensions, PlacedMaterial, MaterialType, MeshShape } from '../types';

const SNAP_THRESHOLD = 5; // cm - snap distance

interface AABB {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export function getCargoAABB(cargo: CargoItem): AABB {
  const { position, dimensions, rotation } = cargo;
  const { w, d, h } = getEffectiveDimensions(dimensions, rotation);
  const hw = w / 2;
  const hd = d / 2;
  const hh = h / 2;

  return {
    minX: position.x - hw,
    maxX: position.x + hw,
    minY: position.y - hh,
    maxY: position.y + hh,
    minZ: position.z - hd,
    maxZ: position.z + hd,
  };
}

/** Returns AABB footprint for a box rotated by arbitrary angle around Y axis */
export function getEffectiveDimensions(dimensions: Dimensions, rotation: number): { w: number; d: number; h: number } {
  const rad = (rotation * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));
  return {
    w: dimensions.length * cosA + dimensions.width * sinA,
    d: dimensions.length * sinA + dimensions.width * cosA,
    h: dimensions.height,
  };
}

export function snapPosition(
  pos: Position,
  movingCargo: CargoItem,
  otherCargos: CargoItem[],
  palletDimensions: Dimensions
): Position {
  let snapped = { ...pos };
  const { w, d, h } = getEffectiveDimensions(movingCargo.dimensions, movingCargo.rotation);
  const halfW = w / 2;
  const halfD = d / 2;

  // Snap to pallet edges
  const palletHalfW = palletDimensions.length / 2;
  const palletHalfD = palletDimensions.width / 2;

  // Left edge
  if (Math.abs((snapped.x - halfW) - (-palletHalfW)) < SNAP_THRESHOLD) {
    snapped.x = -palletHalfW + halfW;
  }
  // Right edge
  if (Math.abs((snapped.x + halfW) - palletHalfW) < SNAP_THRESHOLD) {
    snapped.x = palletHalfW - halfW;
  }
  // Front edge
  if (Math.abs((snapped.z - halfD) - (-palletHalfD)) < SNAP_THRESHOLD) {
    snapped.z = -palletHalfD + halfD;
  }
  // Back edge
  if (Math.abs((snapped.z + halfD) - palletHalfD) < SNAP_THRESHOLD) {
    snapped.z = palletHalfD - halfD;
  }

  // Snap to other cargo
  for (const other of otherCargos) {
    if (other.id === movingCargo.id || !other.placed) continue;
    const otherAABB = getCargoAABB(other);

    // Snap X axis
    // Right edge of moving → Left edge of other
    if (Math.abs((snapped.x + halfW) - otherAABB.minX) < SNAP_THRESHOLD) {
      snapped.x = otherAABB.minX - halfW;
    }
    // Left edge of moving → Right edge of other
    if (Math.abs((snapped.x - halfW) - otherAABB.maxX) < SNAP_THRESHOLD) {
      snapped.x = otherAABB.maxX + halfW;
    }

    // Snap Z axis
    if (Math.abs((snapped.z + halfD) - otherAABB.minZ) < SNAP_THRESHOLD) {
      snapped.z = otherAABB.minZ - halfD;
    }
    if (Math.abs((snapped.z - halfD) - otherAABB.maxZ) < SNAP_THRESHOLD) {
      snapped.z = otherAABB.maxZ + halfD;
    }
  }

  // Keep Y on pallet surface or stacked
  if (snapped.y < h / 2) {
    snapped.y = h / 2;
  }

  return snapped;
}

export function getMaterialAABB(pm: PlacedMaterial, mt: MaterialType): AABB {
  const isRotated = pm.rotation === 90 || pm.rotation === 270;
  const halfL = (isRotated ? mt.dimensions.width : mt.dimensions.length) / 2;
  const halfW = (isRotated ? mt.dimensions.length : mt.dimensions.width) / 2;
  const halfH = mt.dimensions.height / 2;

  return {
    minX: pm.position.x - halfL,
    maxX: pm.position.x + halfL,
    minY: pm.position.y - halfH,
    maxY: pm.position.y + halfH,
    minZ: pm.position.z - halfW,
    maxZ: pm.position.z + halfW,
  };
}

/**
 * Get the actual top-surface Y of a wedge material at a given XZ query point.
 *
 * Wedge cross-section (Z = width axis, Y = height axis, X = length/extrusion):
 *   A(−hW, +hH) ──── B(+hW, +hH)   ← flat top
 *                       |
 *                     / |
 *                   /   |   height (Y)
 *                 /     |
 *   C(+hW, −hH) ─┘     width (Z)
 *
 * At local Z: the wedge exists from Z=−hW (top only, thin edge) to Z=+hW (full height, thick edge).
 * The slope goes from A(−hW, +hH) to C(+hW, −hH).
 * At any local Z, the wedge bottom Y = lerp(+hH, −hH, t) where t = (localZ + hW) / width.
 * The shelf top is always at +hH (flat). Cargo sits there if the wedge has material beneath.
 */
function getMaterialTopY(
  queryX: number, queryZ: number,
  pm: PlacedMaterial, mt: MaterialType
): number | null {
  const aabb = getMaterialAABB(pm, mt);

  // Quick AABB check
  if (queryX < aabb.minX || queryX > aabb.maxX) return null;
  if (queryZ < aabb.minZ || queryZ > aabb.maxZ) return null;

  // For box shapes, just return maxY
  if (!mt.meshShape || mt.meshShape === 'box') {
    return aabb.maxY;
  }

  // For wedge: transform query to local Z to check if within triangle
  const rad = (pm.rotation * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const dx = queryX - pm.position.x;
  const dz = queryZ - pm.position.z;
  // Local Z (width axis = triangle base direction)
  const localZ = -dx * sinA + dz * cosA;

  const halfW = mt.dimensions.width / 2;
  // t: 0 at thin edge (localZ = −hW), 1 at thick edge (localZ = +hW)
  const t = (localZ + halfW) / (2 * halfW);
  if (t < 0.01) return null; // too thin, no real surface

  // The flat top surface IS at maxY across the entire width
  return aabb.maxY;
}

export function findStackHeight(
  pos: Position,
  movingCargo: CargoItem,
  otherCargos: CargoItem[],
  placedMaterials?: PlacedMaterial[],
  materialTypes?: MaterialType[]
): number {
  const { w, d } = getEffectiveDimensions(movingCargo.dimensions, movingCargo.rotation);
  const halfW = w / 2;
  const halfD = d / 2;

  let maxY = 0;

  // Check other cargo
  for (const other of otherCargos) {
    if (other.id === movingCargo.id || !other.placed) continue;
    const otherAABB = getCargoAABB(other);

    const overlapX = pos.x - halfW < otherAABB.maxX && pos.x + halfW > otherAABB.minX;
    const overlapZ = pos.z - halfD < otherAABB.maxZ && pos.z + halfD > otherAABB.minZ;

    if (overlapX && overlapZ) {
      maxY = Math.max(maxY, otherAABB.maxY);
    }
  }

  // Check placed materials (skid, lumber, shelf, etc.)
  if (placedMaterials && materialTypes) {
    for (const pm of placedMaterials) {
      const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
      if (!mt) continue;

      if (mt.meshShape === 'wedge') {
        // For wedge: check corners of cargo footprint against the wedge surface
        const corners = [
          [pos.x - halfW, pos.z - halfD],
          [pos.x + halfW, pos.z - halfD],
          [pos.x - halfW, pos.z + halfD],
          [pos.x + halfW, pos.z + halfD],
        ];
        for (const [cx, cz] of corners) {
          const topY = getMaterialTopY(cx, cz, pm, mt);
          if (topY !== null) {
            maxY = Math.max(maxY, topY);
            break; // one corner on the shelf is enough
          }
        }
      } else {
        const mAABB = getMaterialAABB(pm, mt);
        const overlapX = pos.x - halfW < mAABB.maxX && pos.x + halfW > mAABB.minX;
        const overlapZ = pos.z - halfD < mAABB.maxZ && pos.z + halfD > mAABB.minZ;
        if (overlapX && overlapZ) {
          maxY = Math.max(maxY, mAABB.maxY);
        }
      }
    }
  }

  return maxY;
}

/** Find stack height for a material being dragged (checks cargo + other materials) */
export function findMaterialStackHeight(
  pos: Position,
  movingMaterialId: string,
  matType: MaterialType,
  cargos: CargoItem[],
  placedMaterials: PlacedMaterial[],
  materialTypes: MaterialType[]
): number {
  const isRotated = false; // materials start at rotation 0 during initial placement
  const halfL = (isRotated ? matType.dimensions.width : matType.dimensions.length) / 2;
  const halfW = (isRotated ? matType.dimensions.length : matType.dimensions.width) / 2;

  let maxY = 0;

  // Check cargo
  for (const cargo of cargos) {
    if (!cargo.placed) continue;
    const cAABB = getCargoAABB(cargo);

    const overlapX = pos.x - halfL < cAABB.maxX && pos.x + halfL > cAABB.minX;
    const overlapZ = pos.z - halfW < cAABB.maxZ && pos.z + halfW > cAABB.minZ;

    if (overlapX && overlapZ) {
      maxY = Math.max(maxY, cAABB.maxY);
    }
  }

  // Check other materials
  for (const pm of placedMaterials) {
    if (pm.id === movingMaterialId) continue;
    const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
    if (!mt) continue;
    const mAABB = getMaterialAABB(pm, mt);

    const overlapX = pos.x - halfL < mAABB.maxX && pos.x + halfL > mAABB.minX;
    const overlapZ = pos.z - halfW < mAABB.maxZ && pos.z + halfW > mAABB.minZ;

    if (overlapX && overlapZ) {
      maxY = Math.max(maxY, mAABB.maxY);
    }
  }

  return maxY;
}
