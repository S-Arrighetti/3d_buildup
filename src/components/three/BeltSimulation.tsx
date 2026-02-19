import { useMemo } from 'react';
import * as THREE from 'three';
import { useCargoStore } from '../../store/useCargoStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { getCargoAABB } from '../../utils/snapping';

const STRAP_WIDTH = 5;       // 5cm wide
const STRAP_THICKNESS = 0.4; // 4mm thick

/** Create a flat rectangular cross-section for the strap */
function createStrapShape(): THREE.Shape {
  const hw = STRAP_WIDTH / 2;
  const ht = STRAP_THICKNESS / 2;
  const r = 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -ht);
  shape.lineTo(hw - r, -ht);
  shape.quadraticCurveTo(hw, -ht, hw, -ht + r);
  shape.lineTo(hw, ht - r);
  shape.quadraticCurveTo(hw, ht, hw - r, ht);
  shape.lineTo(-hw + r, ht);
  shape.quadraticCurveTo(-hw, ht, -hw, ht - r);
  shape.lineTo(-hw, -ht + r);
  shape.quadraticCurveTo(-hw, -ht, -hw + r, -ht);
  return shape;
}

interface BeltRenderData {
  id: string;
  curve: THREE.CatmullRomCurve3;
  color: string;
  // Ratchet buckle placement
  ratchetPos: [number, number, number];
  ratchetQuat: THREE.Quaternion;
  // Hook at the other end
  hookPos: [number, number, number];
  hookQuat: THREE.Quaternion;
}

/** Compute a quaternion that rotates from +Y to the given tangent direction */
function tangentToQuaternion(tangent: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  q.setFromUnitVectors(up, tangent.clone().normalize());
  return q;
}

export function BeltSimulation() {
  const items = useCargoStore((s) => s.items);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);

  const strapShape = useMemo(() => createStrapShape(), []);

  const beltData = useMemo(() => {
    const belts: BeltRenderData[] = [];

    for (const pm of placedMaterials) {
      const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
      if (!mt || mt.category !== 'belt') continue;

      let curvePoints: THREE.Vector3[] | null = null;

      // Route-based belts (interactive routing)
      if (pm.routePoints && pm.routePoints.length >= 2) {
        curvePoints = pm.routePoints.map(
          (p) => new THREE.Vector3(p.x, p.y, p.z)
        );

        // Ensure start and end go down to pallet surface (y=0)
        if (curvePoints[0].y > 5) {
          curvePoints.unshift(new THREE.Vector3(curvePoints[0].x, 0, curvePoints[0].z));
        }
        if (curvePoints[curvePoints.length - 1].y > 5) {
          curvePoints.push(new THREE.Vector3(
            curvePoints[curvePoints.length - 1].x, 0, curvePoints[curvePoints.length - 1].z
          ));
        }
      }

      // Legacy auto-wrap belts (attached cargo)
      if (!curvePoints && pm.attachedCargoIds?.length) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let centerZ = 0;
        let count = 0;

        for (const cargoId of pm.attachedCargoIds) {
          const cargo = items.find((c) => c.id === cargoId);
          if (!cargo || !cargo.placed) continue;
          const aabb = getCargoAABB(cargo);
          minX = Math.min(minX, aabb.minX);
          maxX = Math.max(maxX, aabb.maxX);
          minY = Math.min(minY, aabb.minY);
          maxY = Math.max(maxY, aabb.maxY);
          centerZ += (aabb.minZ + aabb.maxZ) / 2;
          count++;
        }

        if (count === 0) continue;
        centerZ /= count;

        const midX = (minX + maxX) / 2;
        const padding = 3;
        curvePoints = [
          new THREE.Vector3(minX - padding, 0, centerZ),
          new THREE.Vector3(minX - padding, maxY + padding, centerZ),
          new THREE.Vector3(midX, maxY + padding + 5, centerZ),
          new THREE.Vector3(maxX + padding, maxY + padding, centerZ),
          new THREE.Vector3(maxX + padding, 0, centerZ),
        ];
      }

      if (!curvePoints || curvePoints.length < 2) continue;

      const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.3);

      // Ratchet buckle: at ~15% along the curve from start (lower portion)
      const ratchetT = 0.12;
      const rPos = curve.getPointAt(ratchetT);
      const rTan = curve.getTangentAt(ratchetT);
      const rQuat = tangentToQuaternion(rTan);

      // Hook: at ~85% along the curve from start (other lower portion)
      const hookT = 0.88;
      const hPos = curve.getPointAt(hookT);
      const hTan = curve.getTangentAt(hookT);
      const hQuat = tangentToQuaternion(hTan);

      belts.push({
        id: pm.id,
        curve,
        color: mt.color,
        ratchetPos: [rPos.x, rPos.y, rPos.z],
        ratchetQuat: rQuat,
        hookPos: [hPos.x, hPos.y, hPos.z],
        hookQuat: hQuat,
      });
    }

    return belts;
  }, [items, placedMaterials, materialTypes]);

  return (
    <group>
      {beltData.map((belt) => (
        <group key={belt.id}>
          {/* Flat strap body */}
          <mesh>
            <extrudeGeometry args={[strapShape, {
              steps: 80,
              extrudePath: belt.curve,
            }]} />
            <meshStandardMaterial
              color={belt.color}
              roughness={0.75}
              metalness={0.05}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Strap edge stitching lines (thin darker edges) */}
          <mesh>
            <tubeGeometry args={[belt.curve, 80, STRAP_WIDTH / 2 + 0.15, 4, false]} />
            <meshStandardMaterial
              color="#CC5500"
              roughness={0.8}
              metalness={0}
              transparent
              opacity={0.4}
              wireframe
            />
          </mesh>

          {/* Ratchet buckle */}
          <group position={belt.ratchetPos} quaternion={belt.ratchetQuat}>
            {/* Buckle body (metal frame) */}
            <mesh>
              <boxGeometry args={[7, 3.5, 3.5]} />
              <meshStandardMaterial color="#707070" roughness={0.15} metalness={0.9} />
            </mesh>
            {/* Buckle slot (dark gap) */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[5.5, 2, 3.6]} />
              <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Ratchet handle (lever) */}
            <mesh position={[0, 2.8, 0]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[6, 3.5, 1.2]} />
              <meshStandardMaterial color="#606060" roughness={0.15} metalness={0.9} />
            </mesh>
            {/* Handle grip bar */}
            <mesh position={[0, 4.2, -0.8]} rotation={[0.3, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 6.5, 8]} />
              <meshStandardMaterial color="#555555" roughness={0.2} metalness={0.85} />
            </mesh>
            {/* Axle pin */}
            <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.5, 0.5, 8, 8]} />
              <meshStandardMaterial color="#888888" roughness={0.1} metalness={0.95} />
            </mesh>
          </group>

          {/* Hook at the other end */}
          <group position={belt.hookPos} quaternion={belt.hookQuat}>
            {/* Hook base plate */}
            <mesh>
              <boxGeometry args={[6, 1.5, 2.5]} />
              <meshStandardMaterial color="#707070" roughness={0.15} metalness={0.9} />
            </mesh>
            {/* Hook J-shape */}
            <mesh position={[0, -1.5, 0]}>
              <boxGeometry args={[4, 2, 2]} />
              <meshStandardMaterial color="#666666" roughness={0.15} metalness={0.9} />
            </mesh>
            <mesh position={[0, -2.8, 0.8]}>
              <boxGeometry args={[4, 1, 2]} />
              <meshStandardMaterial color="#666666" roughness={0.15} metalness={0.9} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
