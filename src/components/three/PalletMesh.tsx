import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Text, Line } from '@react-three/drei';
import { usePalletStore } from '../../store/usePalletStore';

const PALLET_THICKNESS = 5; // cm

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

  const { length, width } = pallet.dimensions;
  const inner = pallet.innerDimensions;

  return (
    <group>
      {/* Pallet base */}
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
