import { useMemo } from 'react';
import * as THREE from 'three';
import { useContourStore } from '../../store/useContourStore';
import { useActivePallet } from '../../store/usePalletStore';
import { generateContourLinePoints } from '../../utils/contourCheck';

export function ContourLine() {
  const contours = useContourStore((s) => s.contours);
  const activeContourId = useContourStore((s) => s.activeContourId);
  const showContour = useContourStore((s) => s.showContour);

  const contour = contours.find((c) => c.id === activeContourId) ?? null;
  const pallet = useActivePallet();

  const lineGeometry = useMemo(() => {
    if (!contour || !pallet) return null;

    const profilePoints = generateContourLinePoints(contour, 60);
    if (profilePoints.length === 0) return null;

    // Create contour line at front and back of pallet
    const palletHalfD = pallet.dimensions.width / 2;
    const positions: number[] = [];

    // Front contour line
    for (const [x, y] of profilePoints) {
      positions.push(x, y, -palletHalfD);
    }

    const frontGeom = new THREE.BufferGeometry();
    frontGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    return { front: frontGeom, back: createBackGeometry(profilePoints, palletHalfD) };
  }, [contour, pallet]);

  const surfaceGeometry = useMemo(() => {
    if (!contour || !pallet) return null;

    const profilePoints = generateContourLinePoints(contour, 30);
    if (profilePoints.length < 3) return null;

    const palletHalfD = pallet.dimensions.width / 2;
    const shape = new THREE.Shape();

    // Create cross-section shape
    shape.moveTo(profilePoints[0][0], profilePoints[0][1]);
    for (let i = 1; i < profilePoints.length; i++) {
      shape.lineTo(profilePoints[i][0], profilePoints[i][1]);
    }
    shape.closePath();

    // Extrude along Z axis (pallet depth)
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: pallet.dimensions.width,
      bevelEnabled: false,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Position: rotate and move so it sits correctly
    geom.rotateX(Math.PI / 2);
    geom.translate(0, 0, palletHalfD);

    return geom;
  }, [contour, pallet]);

  if (!showContour || !contour || !lineGeometry) return null;

  return (
    <group>
      {/* Semi-transparent contour surface */}
      {surfaceGeometry && (
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial
            color="#4488ff"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Front contour line */}
      <line geometry={lineGeometry.front}>
        <lineBasicMaterial color="#2266ff" linewidth={2} />
      </line>

      {/* Back contour line */}
      <line geometry={lineGeometry.back}>
        <lineBasicMaterial color="#2266ff" linewidth={2} />
      </line>
    </group>
  );
}

function createBackGeometry(
  profilePoints: [number, number][],
  palletHalfD: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const [x, y] of profilePoints) {
    positions.push(x, y, palletHalfD);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}
