import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useCargoStore } from '../../store/useCargoStore';
import { useActivePallet } from '../../store/usePalletStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { getMaxStackHeightWithMaterials } from '../../utils/collision';

const RULER_STEP = 50; // cm

export function HeightRuler() {
  const items = useCargoStore((s) => s.items);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const pallet = useActivePallet();

  const maxHeight = useMemo(
    () => getMaxStackHeightWithMaterials(items, placedMaterials, materialTypes),
    [items, placedMaterials, materialTypes]
  );

  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    const maxMark = Math.max(maxHeight + 50, 200);
    for (let h = 0; h <= maxMark; h += RULER_STEP) {
      marks.push(h);
    }
    return marks;
  }, [maxHeight]);

  if (!pallet) return null;

  const rulerX = -pallet.dimensions.length / 2 - 30;
  const rulerZ = -pallet.dimensions.width / 2 - 10;

  return (
    <group>
      {/* Vertical ruler line */}
      <line
        geometry={
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX, 0, rulerZ),
            new THREE.Vector3(rulerX, Math.max(maxHeight + 50, 200), rulerZ),
          ])
        }
      >
        <lineBasicMaterial color="#888888" />
      </line>

      {/* Tick marks and labels */}
      {rulerMarks.map((h) => (
        <group key={h}>
          <line
            geometry={
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX - 5, h, rulerZ),
                new THREE.Vector3(rulerX + 5, h, rulerZ),
              ])
            }
          >
            <lineBasicMaterial color="#888888" />
          </line>
          <Text
            position={[rulerX - 15, h, rulerZ]}
            fontSize={7}
            color="#666"
            anchorX="right"
            anchorY="middle"
          >
            {`${h}`}
          </Text>
        </group>
      ))}

      {/* Current max height indicator */}
      {maxHeight > 0 && (
        <group>
          <line
            geometry={
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX - 5, maxHeight, rulerZ),
                new THREE.Vector3(
                  pallet.dimensions.length / 2 + 10,
                  maxHeight,
                  rulerZ
                ),
              ])
            }
          >
            <lineBasicMaterial color="#ff6600" />
          </line>
          <Text
            position={[rulerX - 20, maxHeight, rulerZ]}
            fontSize={9}
            color="#ff6600"
            anchorX="right"
            anchorY="middle"
            fontWeight="bold"
          >
            {`${Math.round(maxHeight)} cm`}
          </Text>
        </group>
      )}
    </group>
  );
}
