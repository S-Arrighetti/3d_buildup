import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
      {/* Material mesh - click to select, drag to move */}
      <mesh
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!dragging) { setHovered(false); document.body.style.cursor = 'auto'; } }}
      >
        {matType.meshShape === 'wedge' ? (
          <WedgeGeometry length={length} width={width} height={height} />
        ) : (
          <boxGeometry args={[length, height, width]} />
        )}
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

/**
 * Triangular prism (wedge) geometry for LD3 Shelf.
 * Axes match boxGeometry convention: X = length, Y = height, Z = width.
 *
 * Cross-section (viewed from +X, Z = width, Y = height):
 *
 *  A ─────────── B     ← flat top surface (cargo goes here)
 *                |
 *              / |     height = contourStart (64cm, Y axis)
 *            /   |     width  = contourDepth (47cm, Z axis)
 *          /     |     length = shelf length (150cm, X axis = extrusion)
 *        /       |
 *      /         |
 *    C ──────────┘
 *
 * A = (−hW, +hH)  thin edge top
 * B = (+hW, +hH)  thick edge top (against container wall)
 * C = (+hW, −hH)  thick edge bottom
 *
 * Flat top (A→B) is the shelf surface for cargo.
 * +Z side (B→C) is vertical, leans against the container wall.
 * Slope (C→A) rests on the LD3 contour angle.
 */
function WedgeGeometry({ length, width, height }: { length: number; width: number; height: number }) {
  const geo = useMemo(() => {
    const hL = length / 2;  // X: extrusion direction (along container length)
    const hW = width / 2;   // Z: triangle base (contour depth)
    const hH = height / 2;  // Y: triangle height

    // 6 vertices: right face (x=+hL) + left face (x=-hL)
    const vertices = new Float32Array([
      // Right face (x = +hL)
       hL,  hH, -hW,   //  0: A right (top, thin edge)
       hL,  hH,  hW,   //  1: B right (top, thick edge)
       hL, -hH,  hW,   //  2: C right (bottom, thick edge)
      // Left face (x = -hL)
      -hL,  hH, -hW,   //  3: A left  (top, thin edge)
      -hL,  hH,  hW,   //  4: B left  (top, thick edge)
      -hL, -hH,  hW,   //  5: C left  (bottom, thick edge)
    ]);

    const indices = [
      // Right triangle (+X face, CCW from outside)
      0, 2, 1,
      // Left triangle (−X face, CCW from outside)
      3, 4, 5,
      // Top quad (flat shelf surface, horizontal)
      0, 1, 4,  0, 4, 3,
      // Back quad (vertical wall, +Z side)
      1, 2, 5,  1, 5, 4,
      // Slope quad (hypotenuse, from thin bottom to thick top)
      2, 0, 3,  2, 3, 5,
    ];

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [length, width, height]);

  return <primitive object={geo} attach="geometry" />;
}
