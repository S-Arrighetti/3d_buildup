import { useCallback, useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useSceneStore } from '../../store/useSceneStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useCargoStore } from '../../store/useCargoStore';
import { useActivePallet } from '../../store/usePalletStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { getCargoAABB } from '../../utils/snapping';

const EDGE_THICKNESS = 8; // visual thickness of clickable edge zones

/**
 * BeltRouter - Interactive belt routing in the 3D scene.
 * Active only when beltRoutingMode === true.
 *
 * Flow:
 * 1. Click a pallet boundary edge to start
 * 2. Click cargo top edges to route over
 * 3. Click a pallet boundary edge to finish
 */
export function BeltRouter() {
  const beltRoutingMode = useSceneStore((s) => s.beltRoutingMode);
  const beltRoutePoints = useSceneStore((s) => s.beltRoutePoints);
  const beltMaterialTypeId = useSceneStore((s) => s.beltRoutingMaterialTypeId);
  const addBeltRoutePoint = useSceneStore((s) => s.addBeltRoutePoint);
  const cancelBeltRouting = useSceneStore((s) => s.cancelBeltRouting);

  const items = useCargoStore((s) => s.items);
  const pallet = useActivePallet();

  // Boundary edge click zones - positioned OUTSIDE the boundary so they don't overlap cargo
  const edgeZones = useMemo(() => {
    if (!pallet || !beltRoutingMode) return [];

    const useInner = !!pallet.innerDimensions;
    const halfL = useInner ? pallet.innerDimensions!.length / 2 : pallet.dimensions.length / 2;
    const halfW = useInner ? pallet.innerDimensions!.width / 2 : pallet.dimensions.width / 2;
    const maxH = 200;

    // Position edge zones outside the boundary (offset by half thickness)
    return [
      { side: 'left' as const, pos: [-halfL - EDGE_THICKNESS / 2, maxH / 2, 0] as [number, number, number], size: [EDGE_THICKNESS, maxH, halfW * 2 + EDGE_THICKNESS * 2] as [number, number, number] },
      { side: 'right' as const, pos: [halfL + EDGE_THICKNESS / 2, maxH / 2, 0] as [number, number, number], size: [EDGE_THICKNESS, maxH, halfW * 2 + EDGE_THICKNESS * 2] as [number, number, number] },
      { side: 'front' as const, pos: [0, maxH / 2, -halfW - EDGE_THICKNESS / 2] as [number, number, number], size: [halfL * 2 + EDGE_THICKNESS * 2, maxH, EDGE_THICKNESS] as [number, number, number] },
      { side: 'back' as const, pos: [0, maxH / 2, halfW + EDGE_THICKNESS / 2] as [number, number, number], size: [halfL * 2 + EDGE_THICKNESS * 2, maxH, EDGE_THICKNESS] as [number, number, number] },
    ];
  }, [pallet, beltRoutingMode]);

  // Handle edge zone click - start or finish belt
  const handleEdgeClick = useCallback(
    (e: ThreeEvent<PointerEvent>, side: string) => {
      e.stopPropagation();
      if (!pallet) return;

      // Get the click position in local (scene group) coords
      const point = e.point.clone();
      // Convert from world to scene group coords (divide by SCALE=0.01)
      const pos = { x: point.x / 0.01, y: point.y / 0.01, z: point.z / 0.01 };

      if (beltRoutePoints.length === 0) {
        // Start belt
        addBeltRoutePoint(pos);
      } else {
        // Finish belt - need at least one waypoint (start + end minimum)
        addBeltRoutePoint(pos);

        // Small delay to let state update, then finish
        setTimeout(() => {
          const points = useSceneStore.getState().finishBeltRouting();
          if (points && beltMaterialTypeId) {
            useHistoryStore.getState().pushSnapshot();
            // Create the placed material with route points
            const center = {
              x: (points[0].x + points[points.length - 1].x) / 2,
              y: 0,
              z: (points[0].z + points[points.length - 1].z) / 2,
            };
            const id = useMaterialStore.getState().placeMaterial(beltMaterialTypeId, center);
            // Update with route points
            useMaterialStore.setState((s) => ({
              placedMaterials: s.placedMaterials.map((pm) =>
                pm.id === id ? { ...pm, routePoints: points } : pm
              ),
            }));
          }
        }, 0);
      }
    },
    [pallet, beltRoutePoints, addBeltRoutePoint, beltMaterialTypeId]
  );

  // Handle cargo click - add waypoint over cargo top
  const handleCargoClick = useCallback(
    (e: ThreeEvent<PointerEvent>, cargoId: string) => {
      e.stopPropagation();
      if (beltRoutePoints.length === 0) return; // Must start from edge first

      const cargo = items.find((c) => c.id === cargoId);
      if (!cargo) return;

      const aabb = getCargoAABB(cargo);
      // Add waypoint at the point where the cargo was clicked (converted to cm)
      const clickPos = {
        x: e.point.x / 0.01,
        y: aabb.maxY + 3, // slightly above cargo top
        z: e.point.z / 0.01,
      };
      addBeltRoutePoint(clickPos);
    },
    [beltRoutePoints, items, addBeltRoutePoint]
  );

  // In-progress belt line preview
  const previewLine = useMemo(() => {
    if (beltRoutePoints.length < 1) return null;
    return beltRoutePoints.map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [beltRoutePoints]);

  if (!beltRoutingMode || !pallet) return null;

  const placedCargo = items.filter((c) => c.placed);

  return (
    <group>
      {/* Edge click zones (glowing boundary indicators) */}
      {edgeZones.map((zone) => (
        <mesh
          key={zone.side}
          position={zone.pos}
          onPointerDown={(e) => handleEdgeClick(e, zone.side)}
        >
          <boxGeometry args={zone.size} />
          <meshBasicMaterial
            color={beltRoutePoints.length === 0 ? '#00ff88' : '#ff8800'}
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}

      {/* Cargo click targets (highlight placed cargo) */}
      {beltRoutePoints.length > 0 && placedCargo.map((cargo) => {
        const aabb = getCargoAABB(cargo);
        const w = aabb.maxX - aabb.minX;
        const h = aabb.maxY - aabb.minY;
        const d = aabb.maxZ - aabb.minZ;
        const cx = (aabb.minX + aabb.maxX) / 2;
        const cy = (aabb.minY + aabb.maxY) / 2;
        const cz = (aabb.minZ + aabb.maxZ) / 2;
        return (
          <mesh
            key={`belt-target-${cargo.id}`}
            position={[cx, cy, cz]}
            onPointerDown={(e) => handleCargoClick(e, cargo.id)}
          >
            <boxGeometry args={[w + 6, h + 6, d + 6]} />
            <meshBasicMaterial color="#ffaa00" transparent opacity={0.12} />
          </mesh>
        );
      })}

      {/* Preview line of current belt route */}
      {previewLine && previewLine.length >= 1 && (
        <Line
          points={previewLine}
          color="#ffaa00"
          lineWidth={3}
          dashed
          dashSize={8}
          gapSize={4}
        />
      )}

      {/* Status label */}
      <Html position={[0, pallet.dimensions.height + 50, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="bg-orange-600/90 text-white px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap">
          {beltRoutePoints.length === 0
            ? 'Click boundary edge to START belt'
            : `${beltRoutePoints.length} point(s) - Click cargo or boundary to continue`
          }
          <span
            className="ml-2 underline cursor-pointer pointer-events-auto"
            onClick={() => cancelBeltRouting()}
          >
            Cancel
          </span>
        </div>
      </Html>
    </group>
  );
}
