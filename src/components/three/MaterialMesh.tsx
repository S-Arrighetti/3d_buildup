import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { Edges, Html } from '@react-three/drei';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useCargoStore } from '../../store/useCargoStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { findMaterialStackHeight } from '../../utils/snapping';
import type { PlacedMaterial, MaterialType } from '../../types';

const SCALE = 0.01;

export function MaterialMeshGroup() {
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);

  return (
    <>
      {placedMaterials.map((pm) => {
        const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
        if (!mt) return null;
        return <SingleMaterialMesh key={pm.id} placed={pm} matType={mt} />;
      })}
    </>
  );
}

function SingleMaterialMesh({
  placed,
  matType,
}: {
  placed: PlacedMaterial;
  matType: MaterialType;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef(new THREE.Vector3());
  const dragPlaneY = useRef(0);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const selectObject = useSceneStore((s) => s.selectObject);
  const setDraggingState = useSceneStore((s) => s.setDragging);
  const updateMaterialPosition = useMaterialStore((s) => s.updateMaterialPosition);
  const allPlacedMaterials = useMaterialStore((s) => s.placedMaterials);
  const allMaterialTypes = useMaterialStore((s) => s.materialTypes);
  const cargoItems = useCargoStore((s) => s.items);

  const isSelected = selectedObjectId === placed.id;
  const { length, width, height } = matType.dimensions;

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

      selectObject(placed.id, 'material');

      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      didDrag.current = false;

      dragPlaneY.current = placed.position.y * SCALE;

      const worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      if (!worldPos) return;

      dragOffset.current.set(
        placed.position.x - worldPos.x / SCALE,
        0,
        placed.position.z - worldPos.z / SCALE
      );

      setDragging(true);
      setDraggingState(true);
    },
    [placed, selectObject, setDraggingState, getWorldPosFromMouse]
  );

  useEffect(() => {
    if (!dragging) return;

    const DRAG_THRESHOLD = 3;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (!didDrag.current && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      didDrag.current = true;

      const worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      if (!worldPos) return;

      const rawX = worldPos.x / SCALE + dragOffset.current.x;
      const rawZ = worldPos.z / SCALE + dragOffset.current.z;

      // Find stack height (consider cargo + other materials)
      const stackH = findMaterialStackHeight(
        { x: rawX, y: 0, z: rawZ },
        placed.id,
        matType,
        cargoItems,
        allPlacedMaterials,
        allMaterialTypes
      );

      updateMaterialPosition(placed.id, {
        x: rawX,
        y: stackH + height / 2,
        z: rawZ,
      });
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
  }, [dragging, placed, matType, height, cargoItems, allPlacedMaterials, allMaterialTypes, getWorldPosFromMouse, updateMaterialPosition, setDraggingState]);

  return (
    <group
      position={[placed.position.x, placed.position.y, placed.position.z]}
      rotation={[0, (placed.rotation * Math.PI) / 180, 0]}
    >
      {/* Material box - click to select, drag to move */}
      <mesh
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!dragging) { setHovered(false); document.body.style.cursor = 'auto'; } }}
      >
        <boxGeometry args={[length, height, width]} />
        <meshStandardMaterial
          color={matType.color}
          transparent
          opacity={dragging ? 0.5 : 0.85}
          roughness={0.6}
        />
        <Edges
          color={isSelected ? '#ffffff' : hovered ? '#ffff00' : '#555555'}
          lineWidth={isSelected ? 2 : 1}
          threshold={15}
        />
      </mesh>

      {(hovered || isSelected) && !dragging && (
        <Html position={[0, height / 2 + 15, 0]} center>
          <div className="bg-gray-900/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
            <div className="font-bold">{matType.name}</div>
            <div>{length}x{width}x{height} cm</div>
          </div>
        </Html>
      )}
    </group>
  );
}
