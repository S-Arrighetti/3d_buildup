import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { Edges, Text, Html } from '@react-three/drei';
import { useCargoStore, cargoInView } from '../../store/useCargoStore';
import { useMaterialStore, materialsInView } from '../../store/useMaterialStore';
import { useViewPallet } from '../../store/usePalletStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { useViewId, useViewCargoItems, useViewPlacedMaterials } from './ViewContext';
import { snapPosition, findStackHeight, getEffectiveDimensions } from '../../utils/snapping';
import { viewAtPoint, dropCargoIntoView, previewCargoDrop } from '../../utils/viewDrop';
import type { CargoItem } from '../../types';

const SCALE = 0.01; // must match Scene.tsx

export function CargoMeshGroup() {
  const viewId = useViewId();
  const items = useViewCargoItems(viewId);
  return (
    <>
      {items.map((cargo) => (
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

  const viewId = useViewId();
  const updateCargoPosition = useCargoStore((s) => s.updateCargoPosition);
  const items = useViewCargoItems(viewId);
  const placedMaterials = useViewPlacedMaterials(viewId);
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const pallet = useViewPallet(viewId);

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

      // Highlight only a *different* pane, so the ring means "drop here to move"
      const over = viewAtPoint(e.clientX, e.clientY);
      const crossView = over !== null && over !== viewId;
      useSceneStore.getState().setDragOverView(crossView ? over : null);

      if (crossView) {
        // Show where it would land in the other pane, and leave this pane's copy
        // where it is until the drop actually happens
        previewCargoDrop(cargo.id, over, e.clientX, e.clientY);
        return;
      }
      useSceneStore.getState().setDropPreview(null);

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

    const onUp = (e: PointerEvent) => {
      useSceneStore.getState().setDragOverView(null);
      useSceneStore.getState().setDropPreview(null);

      // Released over a different pane → hand the cargo over to that view
      const dropViewId = didDrag.current ? viewAtPoint(e.clientX, e.clientY) : null;
      if (dropViewId !== null && dropViewId !== viewId) {
        dropCargoIntoView(cargo.id, dropViewId, e.clientX, e.clientY);
        setDragging(false);
        setDraggingState(false);
        useSceneStore.getState().enableOrbit();
        document.body.style.cursor = 'auto';
        return;
      }

      const currentCargo = useCargoStore.getState().items.find((c) => c.id === cargo.id);
      if (currentCargo && !currentCargo.placed && pallet) {
        const halfWidth = pallet.dimensions.width / 2;
        const halfLength = pallet.dimensions.length / 2;
        const x = currentCargo.position.x;
        const z = currentCargo.position.z;
        const insidePallet =
          x > -halfLength && x < halfLength && z > -halfWidth && z < halfWidth;
        if (insidePallet) {
          const updatedCargo = { ...currentCargo };
          const stackY = findStackHeight(
            { x: updatedCargo.position.x, y: updatedCargo.position.y, z: updatedCargo.position.z },
            updatedCargo,
            cargoInView(useCargoStore.getState().items, viewId),
            materialsInView(useMaterialStore.getState().placedMaterials, viewId),
            useMaterialStore.getState().materialTypes
          );
          useCargoStore.getState().updateCargoPosition(currentCargo.id, {
            x: updatedCargo.position.x,
            y: stackY + h / 2,
            z: updatedCargo.position.z,
          });
          useCargoStore.getState().setCargoPlaced(currentCargo.id, true);
        }
      }
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
  }, [dragging, cargo, items, pallet, h, placedMaterials, materialTypes, viewId, getWorldPosFromMouse, updateCargoPosition, setDraggingState]);

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
