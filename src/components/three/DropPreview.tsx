import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Edges, Html } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { useViewId } from './ViewContext';

const VALID_OUTLINE = '#34d399'; // emerald — lands on the pallet
const INVALID_OUTLINE = '#f87171'; // red — lands off the pallet

/**
 * Ghost of the item being dragged in from another pane, drawn at the spot it
 * would land. Only the pane the pointer is over renders one.
 */
export function DropPreview() {
  const viewId = useViewId();
  const preview = useSceneStore((s) => s.dropPreview);
  const invalidate = useThree((s) => s.invalidate);

  const mine = preview && preview.viewId === viewId ? preview : null;

  // Panes render on demand, so ask for a frame whenever the ghost moves
  useEffect(() => {
    invalidate();
  }, [mine, invalidate]);

  if (!mine) return null;

  const { position, dimensions, rotation, color, label, valid } = mine;
  const outline = valid ? VALID_OUTLINE : INVALID_OUTLINE;

  // Rotate about the item's own axis: the group sits at the landing x/z, so
  // children only carry a local height
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Footprint on the ground, so the x/z landing spot is readable even when
          the ghost is stacked high */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshBasicMaterial
          color={outline}
          transparent
          opacity={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        <Edges color={outline} lineWidth={2} />
      </mesh>

      {/* Vertical drop line from the footprint up to the ghost */}
      <mesh position={[0, position.y / 2, 0]}>
        <boxGeometry args={[1, Math.max(position.y, 0.1), 1]} />
        <meshBasicMaterial color={outline} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {/* The item itself, where it would come to rest */}
      <mesh position={[0, position.y, 0]}>
        <boxGeometry args={[dimensions.length, dimensions.height, dimensions.width]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.4}
          depthWrite={false}
          roughness={0.4}
        />
        <Edges color={outline} lineWidth={2} />
      </mesh>

      <Html position={[0, position.y + dimensions.height / 2 + 12, 0]} center>
        <div
          className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap pointer-events-none text-white"
          style={{ backgroundColor: valid ? 'rgba(5,150,105,0.9)' : 'rgba(185,28,28,0.9)' }}
        >
          {label}
          <span className="ml-1 opacity-80">{valid ? 'drop here' : 'off pallet'}</span>
        </div>
      </Html>
    </group>
  );
}
