import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { Edges, Text, Html } from '@react-three/drei';
import { useCargoStore } from '../../store/useCargoStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useActivePallet } from '../../store/usePalletStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { snapPosition, findStackHeight, getEffectiveDimensions } from '../../utils/snapping';
import type { CargoItem } from '../../types';

const SCALE = 0.01; // must match Scene.tsx

export function CargoMeshGroup() {
  const items = useCargoStore((s) => s.items);
  return (
    <>
      {items.filter((c) => c.placed).map((cargo) => (
        <SingleCargoMesh key={cargo.id} cargo={cargo} />
      ))}
    </>
  );
}

function SingleCargoMesh({ cargo }: { cargo: CargoItem }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef(new THREE.Vector3());
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const selectObject = useSceneStore((s) => s.selectObject);
  const setDraggingState = useSceneStore((s) => s.setDragging);
  const disableOrbit = useSceneStore((s) => s.disableOrbit);
  const enableOrbit = useSceneStore((s) => s.enableOrbit);

  const updateCargoPosition = useCargoStore((s) => s.updateCargoPosition);
  const items = useCargoStore((s) => s.items);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const pallet = useActivePallet();

  const isSelected = selectedObjectId === cargo.id;
  const { h } = getEffectiveDimensions(cargo.dimensions, cargo.rotation);

  // World-space Y of the drag plane (cargo center Y in world coords)
  const dragPlaneY = useRef(0);

  const getWorldPosFromMouse = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragPlaneY.current);
      const intersection = new THREE.Vector3();
      const hit = raycaster.current.ray.intersectPlane(plane, intersection);
      return hit ? intersection : null;
    },
    [camera, gl]
  );

  // Single pointerDown handler on the box mesh: select + start drag
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      // Skip drag if belt routing is active
      if (useSceneStore.getState().beltRoutingMode) return;

      // Immediately disable OrbitControls at the DOM level
      useSceneStore.getState().disableOrbit();

      // Save snapshot for undo before drag starts
      useHistoryStore.getState().pushSnapshot();

      selectObject(cargo.id, 'cargo');

      // Record pointer start to detect click vs drag
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      didDrag.current = false;

      // Drag plane at the cargo's world Y
      dragPlaneY.current = cargo.position.y * SCALE;

      const worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      if (!worldPos) return;

      // Store offset in cm between cargo center and click point
      dragOffset.current.set(
        cargo.position.x - worldPos.x / SCALE,
        0,
        cargo.position.z - worldPos.z / SCALE
      );

      setDragging(true);
      setDraggingState(true);
    },
    [cargo.id, cargo.position, selectObject, setDraggingState, getWorldPosFromMouse]
  );

  // Use window-level mouse events for smooth dragging
  useEffect(() => {
    if (!dragging) return;

    const DRAG_THRESHOLD = 3; // pixels

    const onMove = (e: PointerEvent) => {
      // Check if we've moved enough to count as a drag
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (!didDrag.current && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      didDrag.current = true;

      const worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      if (!worldPos || !pallet) return;

      // Convert world pos to cm
      const rawPos = {
        x: worldPos.x / SCALE + dragOffset.current.x,
        y: cargo.position.y,
        z: worldPos.z / SCALE + dragOffset.current.z,
      };

      const stackH = findStackHeight(rawPos, cargo, items, placedMaterials, materialTypes);
      rawPos.y = stackH + h / 2;

      const snappedPos = snapPosition(rawPos, cargo, items, pallet.dimensions);
      updateCargoPosition(cargo.id, snappedPos);
    };

    const onUp = () => {
      setDragging(false);
      setDraggingState(false);
      useSceneStore.getState().enableOrbit();
      document.body.style.cursor = 'auto';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, cargo, items, pallet, h, placedMaterials, materialTypes, getWorldPosFromMouse, updateCargoPosition, setDraggingState]);

  return (
    <group
      position={[cargo.position.x, cargo.position.y, cargo.position.z]}
      rotation={[0, (cargo.rotation * Math.PI) / 180, 0]}
    >
      {/* Cargo box - click to select, drag to move */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!dragging) { setHovered(false); document.body.style.cursor = 'auto'; } }}
      >
        <boxGeometry args={[cargo.dimensions.length, cargo.dimensions.height, cargo.dimensions.width]} />
        <meshStandardMaterial
          color={cargo.color}
          transparent
          opacity={dragging ? 0.5 : hovered ? 0.85 : 0.9}
          roughness={0.4}
        />
        <Edges
          color={isSelected ? '#ffffff' : hovered ? '#ffff00' : '#333333'}
          lineWidth={isSelected ? 2 : 1}
          threshold={15}
        />
      </mesh>

      {/* Label on top */}
      <Text
        position={[0, cargo.dimensions.height / 2 + 5, 0]}
        fontSize={8}
        color="#333"
        anchorX="center"
        anchorY="bottom"
      >
        {cargo.label}
      </Text>

      {/* Tooltip */}
      {(hovered || isSelected) && !dragging && (
        <Html position={[0, cargo.dimensions.height / 2 + 15, 0]} center>
          <div className="bg-gray-900/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
            <div className="font-bold">{cargo.label}</div>
            <div>{cargo.dimensions.length}x{cargo.dimensions.width}x{cargo.dimensions.height} cm</div>
            <div>{cargo.weight} kg</div>
          </div>
        </Html>
      )}
    </group>
  );
}
