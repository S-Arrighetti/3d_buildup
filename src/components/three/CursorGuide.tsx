import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { useActivePallet } from '../../store/usePalletStore';
import { useSceneStore } from '../../store/useSceneStore';

const SCALE = 0.01; // must match Scene.tsx
const SNAP_THRESHOLD = 2; // 2cm — "on the line" snap zone

export function CursorGuide() {
  const pallet = useActivePallet();
  const isDragging = useSceneStore((s) => s.isDragging);
  const beltRoutingMode = useSceneStore((s) => s.beltRoutingMode);
  const { camera, gl, invalidate } = useThree();

  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hitRef = useRef(new THREE.Vector3());
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!pallet) return;

    // Horizontal plane at pallet surface (Y=0 in world space)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const outerHalfL = pallet.dimensions.length / 2;
    const outerHalfW = pallet.dimensions.width / 2;
    const margin = 60; // show guide within 60cm outside pallet

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastUpdate.current < 50) return;
      lastUpdate.current = now;

      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      if (raycasterRef.current.ray.intersectPlane(plane, hitRef.current)) {
        const x = hitRef.current.x / SCALE;
        const z = hitRef.current.z / SCALE;

        if (Math.abs(x) <= outerHalfL + margin && Math.abs(z) <= outerHalfW + margin) {
          setCursor({ x, z });
        } else {
          setCursor(null);
        }
        invalidate();
      }
    };

    const onLeave = () => {
      setCursor(null);
      invalidate();
    };

    gl.domElement.addEventListener('pointermove', onMove);
    gl.domElement.addEventListener('pointerleave', onLeave);
    return () => {
      gl.domElement.removeEventListener('pointermove', onMove);
      gl.domElement.removeEventListener('pointerleave', onLeave);
    };
  }, [pallet, camera, gl, invalidate]);

  if (!pallet || !cursor || isDragging || beltRoutingMode) return null;

  const oHL = pallet.dimensions.length / 2;
  const oHW = pallet.dimensions.width / 2;
  const iHL = pallet.innerDimensions ? pallet.innerDimensions.length / 2 : oHL;
  const iHW = pallet.innerDimensions ? pallet.innerDimensions.width / 2 : oHW;
  const hasInner = !!pallet.innerDimensions;

  const guideY = 0.5; // slightly above pallet surface
  const { x, z } = cursor;

  // 4 sides: each has distToInner (positive=inside) and distToOuter (positive=inside)
  const sides: {
    name: string;
    distToInner: number;
    distToOuter: number;
    from: [number, number, number];
    toInner: [number, number, number];
    toOuter: [number, number, number];
  }[] = [
    {
      name: 'L',
      distToInner: x + iHL,
      distToOuter: x + oHL,
      from: [x, guideY, z],
      toInner: [-iHL, guideY, z],
      toOuter: [-oHL, guideY, z],
    },
    {
      name: 'R',
      distToInner: iHL - x,
      distToOuter: oHL - x,
      from: [x, guideY, z],
      toInner: [iHL, guideY, z],
      toOuter: [oHL, guideY, z],
    },
    {
      name: 'F',
      distToInner: z + iHW,
      distToOuter: z + oHW,
      from: [x, guideY, z],
      toInner: [x, guideY, -iHW],
      toOuter: [x, guideY, -oHW],
    },
    {
      name: 'B',
      distToInner: iHW - z,
      distToOuter: oHW - z,
      from: [x, guideY, z],
      toInner: [x, guideY, iHW],
      toOuter: [x, guideY, oHW],
    },
  ];

  return (
    <group>
      {sides.map((side) => {
        let color: string;
        let target: [number, number, number];
        let dist: number;

        if (Math.abs(side.distToOuter) <= SNAP_THRESHOLD) {
          // On outer line
          color = '#00ff00';
          dist = side.distToOuter;
          target = side.toOuter;
        } else if (side.distToOuter < -SNAP_THRESHOLD) {
          // Past outer line
          color = '#ff2222';
          dist = side.distToOuter;
          target = side.toOuter;
        } else if (hasInner && Math.abs(side.distToInner) <= SNAP_THRESHOLD) {
          // On inner line
          color = '#00ff00';
          dist = side.distToInner;
          target = side.toInner;
        } else if (hasInner && side.distToInner < -SNAP_THRESHOLD) {
          // Past inner line but inside outer
          color = '#ff8800';
          dist = side.distToInner;
          target = side.toInner;
        } else {
          // Inside inner (or inside outer if no inner)
          color = '#66aaff';
          dist = hasInner ? side.distToInner : side.distToOuter;
          target = hasInner ? side.toInner : side.toOuter;
        }

        const mid: [number, number, number] = [
          (side.from[0] + target[0]) / 2,
          (side.from[1] + target[1]) / 2 + 3,
          (side.from[2] + target[2]) / 2,
        ];

        const absDist = Math.abs(Math.round(dist));

        return (
          <group key={side.name}>
            <Line
              points={[side.from, target]}
              color={color}
              lineWidth={1.5}
              dashed
              dashSize={4}
              gapSize={3}
            />
            <Html position={mid} center style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  color,
                  fontSize: '10px',
                  fontWeight: 700,
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {absDist} cm
              </div>
            </Html>
          </group>
        );
      })}

      {/* Cursor dot */}
      <mesh position={[x, guideY + 0.1, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
