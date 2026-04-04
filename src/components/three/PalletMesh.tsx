import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Text, Line } from '@react-three/drei';
import { usePalletStore } from '../../store/usePalletStore';

const PALLET_THICKNESS = 5; // cm
const WALL_THICKNESS = 2;   // cm
const WALL_COLOR = '#9ab0c6';
const WALL_EDGE_COLOR = '#5a7a9a';
const WALL_OPACITY = 0.25;
const EDGE_LINE_COLOR = '#7ab0d4';

export function PalletMesh() {
  // Subscribe to all reactive deps so component re-renders on change
  const palletTypes = usePalletStore((s) => s.palletTypes);
  const selectedPalletId = usePalletStore((s) => s.selectedPalletId);
  const selectedCompany = usePalletStore((s) => s.selectedCompany);
  const companies = usePalletStore((s) => s.companies);

  const pallet = useMemo(() => {
    const basePallet = palletTypes.find((p) => p.id === selectedPalletId);
    if (!basePallet) return null;

    if (selectedCompany) {
      const company = companies.find((c) => c.companyName === selectedCompany);
      const customPallet = company?.pallets.find(
        (p) => p.palletTypeId === selectedPalletId
      );
      if (customPallet) {
        return {
          ...basePallet,
          dimensions: customPallet.customDimensions ?? basePallet.dimensions,
          innerDimensions: customPallet.customInnerDimensions ?? basePallet.innerDimensions,
          maxWeight: customPallet.customMaxWeight ?? basePallet.maxWeight,
        };
      }
    }
    return basePallet;
  }, [palletTypes, selectedPalletId, selectedCompany, companies]);

  const geometry = useMemo(() => {
    if (!pallet) return null;
    const { length, width } = pallet.dimensions;
    return new THREE.BoxGeometry(length, PALLET_THICKNESS, width);
  }, [pallet]);

  if (!pallet || !geometry) return null;

  const { length, width, height } = pallet.dimensions;
  const inner = pallet.innerDimensions;
  const isContainer = pallet.shape === 'container';
  const isContoured = pallet.shape === 'contoured';

  return (
    <group>
      {/* Pallet base (only for flat pallets — containers have their own floor) */}
      {!isContainer && !isContoured && (
        <mesh
          position={[0, -PALLET_THICKNESS / 2, 0]}
          geometry={geometry}
          receiveShadow
        >
          <meshStandardMaterial
            color="#b8860b"
            roughness={0.8}
            metalness={0.1}
          />
          <Edges color="#8B6914" threshold={15} />
        </mesh>
      )}

      {/* Container walls (rectangular) */}
      {isContainer && (
        <ContainerWalls length={length} width={width} height={height} />
      )}

      {/* Contoured container walls (LD3 etc. with angled corner) */}
      {isContoured && (
        <ContouredWalls
          length={length} width={width} height={height}
          contourStart={pallet.contourStart ?? 64}
          contourDepth={pallet.contourDepth ?? 47}
        />
      )}

      {/* Inner line (rivet line) - yellow dashed rectangle on pallet surface */}
      {inner && (
        <group position={[0, 0.5, 0]}>
          <Line
            points={[
              [-inner.length / 2, 0, -inner.width / 2],
              [inner.length / 2, 0, -inner.width / 2],
              [inner.length / 2, 0, inner.width / 2],
              [-inner.length / 2, 0, inner.width / 2],
              [-inner.length / 2, 0, -inner.width / 2],
            ]}
            color="#ffcc00"
            lineWidth={2}
            dashed
            dashSize={8}
            gapSize={4}
          />
          {/* Inner line label */}
          <Text
            position={[0, 1, -inner.width / 2 - 8]}
            fontSize={7}
            color="#ffcc00"
            anchorX="center"
            anchorY="middle"
          >
            {`Inner ${inner.length}×${inner.width}`}
          </Text>
        </group>
      )}

      {/* Dimension labels */}
      <Text
        position={[0, 1, width / 2 + 15]}
        fontSize={12}
        color="#666"
        anchorX="center"
        anchorY="middle"
      >
        {`${length} cm`}
      </Text>
      <Text
        position={[length / 2 + 15, 1, 0]}
        fontSize={12}
        color="#666"
        anchorX="center"
        anchorY="middle"
        rotation={[0, -Math.PI / 2, 0]}
      >
        {`${width} cm`}
      </Text>
      {/* Height label for containers */}
      {(isContainer || isContoured) && (
        <Text
          position={[length / 2 + 15, height / 2, width / 2 + 15]}
          fontSize={12}
          color="#666"
          anchorX="center"
          anchorY="middle"
        >
          {`H ${height} cm`}
        </Text>
      )}

      {/* Corner markers (outer) */}
      {[
        [-length / 2, 0, -width / 2],
        [length / 2, 0, -width / 2],
        [-length / 2, 0, width / 2],
        [length / 2, 0, width / 2],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <sphereGeometry args={[2, 8, 8]} />
          <meshStandardMaterial color="#ffd700" />
        </mesh>
      ))}

      {/* Inner line corner markers (rivet positions) */}
      {inner && [
        [-inner.length / 2, 0.5, -inner.width / 2],
        [inner.length / 2, 0.5, -inner.width / 2],
        [-inner.length / 2, 0.5, inner.width / 2],
        [inner.length / 2, 0.5, inner.width / 2],
      ].map((pos, i) => (
        <mesh key={`inner-${i}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[1.5, 8, 8]} />
          <meshStandardMaterial color="#ffcc00" />
        </mesh>
      ))}

      {/* Outer edge center points */}
      {[
        { pos: [0, 0.3, -width / 2] as [number, number, number], rot: 0 },
        { pos: [0, 0.3, width / 2] as [number, number, number], rot: 0 },
        { pos: [-length / 2, 0.3, 0] as [number, number, number], rot: Math.PI / 2 },
        { pos: [length / 2, 0.3, 0] as [number, number, number], rot: Math.PI / 2 },
      ].map(({ pos, rot }, i) => (
        <group key={`oc-${i}`} position={pos} rotation={[0, rot, 0]}>
          {/* Diamond shape: rotated box */}
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[3, 0.6, 3]} />
            <meshStandardMaterial color="#00ccff" />
          </mesh>
          {/* Cross lines */}
          <mesh><boxGeometry args={[5, 0.4, 0.5]} /><meshStandardMaterial color="#00ccff" /></mesh>
          <mesh><boxGeometry args={[0.5, 0.4, 5]} /><meshStandardMaterial color="#00ccff" /></mesh>
        </group>
      ))}

      {/* Inner edge center points */}
      {inner && [
        { pos: [0, 0.8, -inner.width / 2] as [number, number, number], rot: 0 },
        { pos: [0, 0.8, inner.width / 2] as [number, number, number], rot: 0 },
        { pos: [-inner.length / 2, 0.8, 0] as [number, number, number], rot: Math.PI / 2 },
        { pos: [inner.length / 2, 0.8, 0] as [number, number, number], rot: Math.PI / 2 },
      ].map(({ pos, rot }, i) => (
        <group key={`ic-${i}`} position={pos} rotation={[0, rot, 0]}>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[2.5, 0.5, 2.5]} />
            <meshStandardMaterial color="#ffcc00" />
          </mesh>
          <mesh><boxGeometry args={[4, 0.3, 0.4]} /><meshStandardMaterial color="#ffcc00" /></mesh>
          <mesh><boxGeometry args={[0.4, 0.3, 4]} /><meshStandardMaterial color="#ffcc00" /></mesh>
        </group>
      ))}
    </group>
  );
}

const wallMaterialProps = {
  color: WALL_COLOR,
  transparent: true,
  opacity: WALL_OPACITY,
  roughness: 0.6,
  metalness: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
} as const;

/** Container walls: 4 semi-transparent panels + top edge wireframe */
function ContainerWalls({ length, width, height }: { length: number; width: number; height: number }) {
  const wallH = height - PALLET_THICKNESS;
  const halfH = wallH / 2;

  const walls: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, halfH, -width / 2 + WALL_THICKNESS / 2], size: [length, wallH, WALL_THICKNESS] },
    { pos: [0, halfH, width / 2 - WALL_THICKNESS / 2], size: [length, wallH, WALL_THICKNESS] },
    { pos: [-length / 2 + WALL_THICKNESS / 2, halfH, 0], size: [WALL_THICKNESS, wallH, width - WALL_THICKNESS * 2] },
    { pos: [length / 2 - WALL_THICKNESS / 2, halfH, 0], size: [WALL_THICKNESS, wallH, width - WALL_THICKNESS * 2] },
  ];

  const topY = wallH;
  const topEdge: [number, number, number][] = [
    [-length / 2, topY, -width / 2],
    [length / 2, topY, -width / 2],
    [length / 2, topY, width / 2],
    [-length / 2, topY, width / 2],
    [-length / 2, topY, -width / 2],
  ];

  return (
    <group>
      {walls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial {...wallMaterialProps} />
          <Edges color={WALL_EDGE_COLOR} threshold={15} />
        </mesh>
      ))}
      <Line points={topEdge} color={EDGE_LINE_COLOR} lineWidth={2} />
      {[
        [-length / 2, -width / 2],
        [length / 2, -width / 2],
        [length / 2, width / 2],
        [-length / 2, width / 2],
      ].map(([x, z], i) => (
        <Line
          key={`vedge-${i}`}
          points={[[x, 0, z], [x, topY, z]]}
          color={EDGE_LINE_COLOR}
          lineWidth={2}
        />
      ))}
    </group>
  );
}

/**
 * Contoured container walls (LD3 etc.)
 *
 * Cross-section viewed from front (+Z looking at −Z):
 *
 *   TL ─────── TR          TL = top-left, TR = top-right
 *   │           │
 *   │           │  ← contourStart height
 *   │          /
 *   │        /    ← angled slope
 *   │      /
 *   BL ── BC         BL = bottom-left, BC = bottom-contour-point
 *
 * The +X side is the angled (fuselage) side.
 */
function ContouredWalls({
  length, width, height, contourStart, contourDepth,
}: {
  length: number; width: number; height: number;
  contourStart: number; contourDepth: number;
}) {
  const wallH = height - PALLET_THICKNESS;
  const hL = length / 2;
  const hW = width / 2;

  // Key Y positions
  const topY = wallH;
  const slopeY = contourStart; // where the slope begins (from base)

  // X positions: right side is contoured
  const xRight = hL;                    // top-right X (full width)
  const xContour = hL - contourDepth;   // bottom-right X (after cut)

  // Build the contoured side wall geometry (+X side, pentagon shape)
  // The wall is in the XY plane, extruded along Z (width)
  const contouredSideGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Pentagon profile (viewed from +Z):
    //   Start at bottom-left of this wall panel (which is xContour, 0)
    //   Go up to slope start, then out to full width, up to top, across top, down
    shape.moveTo(xContour, 0);       // bottom contour point
    shape.lineTo(xRight, slopeY);    // slope up to full width
    shape.lineTo(xRight, topY);      // up to top-right
    shape.lineTo(xRight, topY);      // top-right (same point)
    // We only need the right wall, so this is just the profile

    // Actually, let's build this as a BufferGeometry for the right wall panel
    // The wall panel in XY plane, then we place two copies at z = ±hW
    return null; // we'll use a different approach below
  }, []);

  // For complex shapes, use custom BufferGeometry
  // Right wall: pentagon cross-section extruded along Z
  const rightWallGeo = useMemo(() => {
    // Profile points (X, Y) for the right wall — viewing from outside (+Z)
    //   bottom: from xContour at y=0, slope to xRight at y=slopeY, then straight up to topY
    // We create a thin wall (WALL_THICKNESS) by offsetting inward

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                           // bottom-left (xContour, 0)
    shape.lineTo(contourDepth, slopeY);            // slope point (xRight, slopeY)
    shape.lineTo(contourDepth, topY);              // top-right (xRight, topY)
    shape.lineTo(contourDepth - WALL_THICKNESS, topY);  // inner top
    shape.lineTo(contourDepth - WALL_THICKNESS, slopeY + WALL_THICKNESS);
    shape.lineTo(WALL_THICKNESS, WALL_THICKNESS);  // inner bottom
    shape.lineTo(0, 0);                            // close

    const extrudeSettings = {
      steps: 1,
      depth: width - WALL_THICKNESS * 2,
      bevelEnabled: false,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [width, topY, slopeY, contourDepth]);

  // Front wall (−Z): pentagon shape
  const frontWallGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Viewed from outside (−Z looking in), left-to-right:
    // BL(-hL, 0) → TL(-hL, topY) → TR(+hL, topY) → slope(+hL, slopeY) → BC(xContour-hL.. )
    // Wait, let's think in local coords. The front wall spans the full width of the container.
    // X range: -hL to +hL.  But the +X bottom corner is cut.
    shape.moveTo(-hL, 0);                   // bottom-left
    shape.lineTo(-hL, topY);                // top-left
    shape.lineTo(hL, topY);                 // top-right
    shape.lineTo(hL, slopeY);               // right side down to slope start
    shape.lineTo(hL - contourDepth, 0);     // slope down to contour point
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: WALL_THICKNESS,
      bevelEnabled: false,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [hL, topY, slopeY, contourDepth]);

  // Top edge wireframe (rectangle — top is still rectangular)
  const topEdge: [number, number, number][] = [
    [-hL, topY, -hW],
    [hL, topY, -hW],
    [hL, topY, hW],
    [-hL, topY, hW],
    [-hL, topY, -hW],
  ];

  // Bottom edge wireframe (with contour)
  const bottomEdge: [number, number, number][] = [
    [-hL, 0, -hW],
    [xContour, 0, -hW],
    [xRight, slopeY, -hW],
    [xRight, slopeY, hW],
    [xContour, 0, hW],
    [-hL, 0, hW],
    [-hL, 0, -hW],
  ];

  return (
    <group>
      {/* Left wall (−X side, full rectangular) */}
      <mesh position={[-hL + WALL_THICKNESS / 2, topY / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, topY, width - WALL_THICKNESS * 2]} />
        <meshStandardMaterial {...wallMaterialProps} />
        <Edges color={WALL_EDGE_COLOR} threshold={15} />
      </mesh>

      {/* Right wall (+X side, contoured pentagon) */}
      <mesh position={[hL - contourDepth, 0, -hW + WALL_THICKNESS]}>
        <primitive object={rightWallGeo} attach="geometry" />
        <meshStandardMaterial {...wallMaterialProps} />
        <Edges color={WALL_EDGE_COLOR} threshold={15} />
      </mesh>

      {/* Front wall (−Z, pentagon) */}
      <mesh position={[0, 0, -hW]}>
        <primitive object={frontWallGeo} attach="geometry" />
        <meshStandardMaterial {...wallMaterialProps} />
        <Edges color={WALL_EDGE_COLOR} threshold={15} />
      </mesh>

      {/* Back wall (+Z, pentagon — same shape, shifted) */}
      <mesh position={[0, 0, hW - WALL_THICKNESS]}>
        <primitive object={frontWallGeo} attach="geometry" />
        <meshStandardMaterial {...wallMaterialProps} />
        <Edges color={WALL_EDGE_COLOR} threshold={15} />
      </mesh>

      {/* Wireframe edges */}
      <Line points={topEdge} color={EDGE_LINE_COLOR} lineWidth={2} />
      <Line points={bottomEdge} color={EDGE_LINE_COLOR} lineWidth={2} />

      {/* Vertical corner edges */}
      {/* Left-front */}
      <Line points={[[-hL, 0, -hW], [-hL, topY, -hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
      {/* Left-back */}
      <Line points={[[-hL, 0, hW], [-hL, topY, hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
      {/* Right-front (full height from slopeY) */}
      <Line points={[[xRight, slopeY, -hW], [xRight, topY, -hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
      {/* Right-back */}
      <Line points={[[xRight, slopeY, hW], [xRight, topY, hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
      {/* Slope edges front & back */}
      <Line points={[[xContour, 0, -hW], [xRight, slopeY, -hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
      <Line points={[[xContour, 0, hW], [xRight, slopeY, hW]]} color={EDGE_LINE_COLOR} lineWidth={2} />
    </group>
  );
}
