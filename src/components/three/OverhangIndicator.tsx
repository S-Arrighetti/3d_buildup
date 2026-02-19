import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useCargoStore } from '../../store/useCargoStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useActivePallet } from '../../store/usePalletStore';
import {
  checkAllOverhangs, checkAllInnerOverhangs,
  checkAllMaterialOverhangs, checkAllMaterialInnerOverhangs,
} from '../../utils/collision';
import { getCargoAABB, getMaterialAABB } from '../../utils/snapping';

interface OverhangLine {
  points: [number, number, number][];
  objectId: string;
  type: 'outer' | 'inner';
  amount: number; // cm overhang
  side: 'left' | 'right' | 'front' | 'back';
}

/** Helper to generate 4-side overhang lines with amounts */
function pushOverhangLines(
  lines: OverhangLine[],
  objectId: string,
  type: 'outer' | 'inner',
  result: { left: boolean; right: boolean; front: boolean; back: boolean },
  aabb: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  halfL: number,
  halfW: number
) {
  if (result.left) {
    lines.push({ objectId, type, side: 'left', amount: Math.round(-halfL - aabb.minX), points: [
      [-halfL, aabb.minY, aabb.minZ], [-halfL, aabb.maxY, aabb.minZ],
      [-halfL, aabb.maxY, aabb.maxZ], [-halfL, aabb.minY, aabb.maxZ],
      [-halfL, aabb.minY, aabb.minZ],
    ]});
  }
  if (result.right) {
    lines.push({ objectId, type, side: 'right', amount: Math.round(aabb.maxX - halfL), points: [
      [halfL, aabb.minY, aabb.minZ], [halfL, aabb.maxY, aabb.minZ],
      [halfL, aabb.maxY, aabb.maxZ], [halfL, aabb.minY, aabb.maxZ],
      [halfL, aabb.minY, aabb.minZ],
    ]});
  }
  if (result.front) {
    lines.push({ objectId, type, side: 'front', amount: Math.round(-halfW - aabb.minZ), points: [
      [aabb.minX, aabb.minY, -halfW], [aabb.maxX, aabb.minY, -halfW],
      [aabb.maxX, aabb.maxY, -halfW], [aabb.minX, aabb.maxY, -halfW],
      [aabb.minX, aabb.minY, -halfW],
    ]});
  }
  if (result.back) {
    lines.push({ objectId, type, side: 'back', amount: Math.round(aabb.maxZ - halfW), points: [
      [aabb.minX, aabb.minY, halfW], [aabb.maxX, aabb.minY, halfW],
      [aabb.maxX, aabb.maxY, halfW], [aabb.minX, aabb.maxY, halfW],
      [aabb.minX, aabb.minY, halfW],
    ]});
  }
}

/** Single overhang face with hover tooltip */
function OverhangFace({ line }: { line: OverhangLine }) {
  const [hovered, setHovered] = useState(false);

  // Calculate center and size of the face for invisible hover plane
  const { center, planeW, planeH, rotation } = useMemo(() => {
    const pts = line.points;
    // pts[0..3] are the 4 corners, pts[4] == pts[0] (closed loop)
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    const cz = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;

    // Determine face orientation from side
    let pw = 0, ph = 0;
    const rot = new THREE.Euler(0, 0, 0);
    if (line.side === 'left' || line.side === 'right') {
      // YZ plane
      pw = Math.abs(pts[2][2] - pts[0][2]); // Z span
      ph = Math.abs(pts[1][1] - pts[0][1]); // Y span
      rot.set(0, Math.PI / 2, 0);
    } else {
      // XY plane
      pw = Math.abs(pts[1][0] - pts[0][0]); // X span
      ph = Math.abs(pts[2][1] - pts[0][1]); // Y span
    }

    return { center: [cx, cy, cz] as [number, number, number], planeW: pw, planeH: ph, rotation: rot };
  }, [line.points, line.side]);

  return (
    <group>
      <Line
        points={line.points}
        color={line.type === 'outer' ? '#ff0000' : '#ff6600'}
        lineWidth={line.type === 'outer' ? 3 : 2}
        dashed={line.type === 'inner'}
        dashSize={line.type === 'inner' ? 6 : undefined}
        gapSize={line.type === 'inner' ? 3 : undefined}
      />

      {/* Invisible hover plane */}
      {planeW > 0 && planeH > 0 && (
        <mesh
          position={center}
          rotation={rotation}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[planeW, planeH]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Tooltip on hover */}
      {hovered && (
        <Html position={center} center style={{ pointerEvents: 'none' }}>
          <div
            className="px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap"
            style={{
              background: line.type === 'outer' ? 'rgba(220,38,38,0.9)' : 'rgba(234,88,12,0.9)',
              color: 'white',
            }}
          >
            +{line.amount} cm
          </div>
        </Html>
      )}
    </group>
  );
}

export function OverhangIndicator() {
  const items = useCargoStore((s) => s.items);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const pallet = useActivePallet();

  const allLines = useMemo(() => {
    if (!pallet) return [];
    const lines: OverhangLine[] = [];
    const halfPL = pallet.dimensions.length / 2;
    const halfPW = pallet.dimensions.width / 2;

    // --- Cargo: outer overhang (red solid) ---
    const outerResults = checkAllOverhangs(items, pallet.dimensions);
    outerResults.forEach((result, cargoId) => {
      if (!result.hasOverhang) return;
      const cargo = items.find((c) => c.id === cargoId);
      if (!cargo) return;
      pushOverhangLines(lines, cargoId, 'outer', result, getCargoAABB(cargo), halfPL, halfPW);
    });

    // --- Material: outer overhang (red solid) ---
    const matOuterResults = checkAllMaterialOverhangs(placedMaterials, materialTypes, pallet.dimensions);
    matOuterResults.forEach((result, matId) => {
      if (!result.hasOverhang) return;
      const pm = placedMaterials.find((m) => m.id === matId);
      const mt = pm ? materialTypes.find((m) => m.id === pm.materialTypeId) : null;
      if (!pm || !mt) return;
      pushOverhangLines(lines, matId, 'outer', result, getMaterialAABB(pm, mt), halfPL, halfPW);
    });

    // --- Cargo: inner overhang (orange dashed) ---
    if (pallet.innerDimensions) {
      const halfIL = pallet.innerDimensions.length / 2;
      const halfIW = pallet.innerDimensions.width / 2;

      const innerResults = checkAllInnerOverhangs(
        items, pallet.innerDimensions, placedMaterials, materialTypes
      );
      innerResults.forEach((result, cargoId) => {
        if (!result.hasInnerOverhang) return;
        const cargo = items.find((c) => c.id === cargoId);
        if (!cargo) return;
        pushOverhangLines(lines, cargoId, 'inner', result, getCargoAABB(cargo), halfIL, halfIW);
      });

      // --- Material: inner overhang (orange dashed) ---
      const matInnerResults = checkAllMaterialInnerOverhangs(
        placedMaterials, materialTypes, pallet.innerDimensions
      );
      matInnerResults.forEach((result, matId) => {
        if (!result.hasInnerOverhang) return;
        const pm = placedMaterials.find((m) => m.id === matId);
        const mt = pm ? materialTypes.find((m) => m.id === pm.materialTypeId) : null;
        if (!pm || !mt) return;
        pushOverhangLines(lines, matId, 'inner', result, getMaterialAABB(pm, mt), halfIL, halfIW);
      });
    }

    return lines;
  }, [items, pallet, placedMaterials, materialTypes]);

  if (allLines.length === 0) return null;

  return (
    <group>
      {allLines.map((line, i) => (
        <OverhangFace key={`${line.objectId}-${line.type}-${line.side}-${i}`} line={line} />
      ))}
    </group>
  );
}
