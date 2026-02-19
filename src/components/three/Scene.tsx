import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { PalletMesh } from './PalletMesh';
import { CargoMeshGroup } from './CargoMesh';
import { MaterialMeshGroup } from './MaterialMesh';
import { ContourLine } from './ContourLine';
import { OverhangIndicator } from './OverhangIndicator';
import { HeightRuler } from './HeightRuler';
import { BeltSimulation } from './BeltSimulation';
import { BeltRouter } from './BeltRouter';
import { CursorGuide } from './CursorGuide';
import { useSceneStore } from '../../store/useSceneStore';

const SCALE = 0.01;

function SceneContent() {
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const isDragging = useSceneStore((s) => s.isDragging);
  const orbitLocked = useSceneStore((s) => s.rotationLocked);
  const setOrbitControlsRef = useSceneStore((s) => s.setOrbitControlsRef);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const invalidate = useThree((s) => s.invalidate);

  // Register OrbitControls ref in store for direct manipulation
  useEffect(() => {
    if (controlsRef.current) {
      setOrbitControlsRef(controlsRef.current);
    }
  }, [setOrbitControlsRef]);

  // Invalidate frame when relevant state changes (demand mode)
  useEffect(() => {
    invalidate();
  });

  // When orbit is locked or dragging, disable rotation but keep zoom working
  const orbitEnabled = !isDragging && !orbitLocked;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      <group scale={[SCALE, SCALE, SCALE]} onPointerMissed={clearSelection}>
        <PalletMesh />
        <CargoMeshGroup />
        <MaterialMeshGroup />
        <ContourLine />
        <OverhangIndicator />
        <HeightRuler />
        <BeltSimulation />
        <BeltRouter />
        <CursorGuide />
      </group>

      <Grid
        args={[20, 20]}
        position={[0, -0.001, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={20}
        infiniteGrid
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={orbitEnabled}
        enablePan={orbitEnabled}
        enableZoom={true}
        zoomSpeed={1.2}
        minDistance={0.5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport />
      </GizmoHelper>

      <Environment preset="warehouse" />
    </>
  );
}

export function Scene() {
  const clearSelection = useSceneStore((s) => s.clearSelection);

  return (
    <Canvas
      camera={{ position: [5, 4, 5], fov: 50 }}
      onPointerMissed={clearSelection}
      shadows
      frameloop="demand"
    >
      <SceneContent />
    </Canvas>
  );
}
