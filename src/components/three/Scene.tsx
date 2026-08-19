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
import { ViewIdContext } from './ViewContext';
import { useSceneStore } from '../../store/useSceneStore';
import { useViewStore, VIEW_IDS } from '../../store/useViewStore';
import { useViewPallet } from '../../store/usePalletStore';

const SCALE = 0.01;

function SceneContent({ viewId, active }: { viewId: number; active: boolean }) {
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const isDragging = useSceneStore((s) => s.isDragging);
  const orbitLocked = useSceneStore((s) => s.rotationLocked);
  const setOrbitControlsRef = useSceneStore((s) => s.setOrbitControlsRef);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const invalidate = useThree((s) => s.invalidate);

  // Register this view's OrbitControls ref in store for direct manipulation
  useEffect(() => {
    if (controlsRef.current) {
      setOrbitControlsRef(viewId, controlsRef.current);
    }
    return () => setOrbitControlsRef(viewId, null);
  }, [setOrbitControlsRef, viewId]);

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
        {/* Interactive helpers only in the active view */}
        {active && <BeltRouter />}
        {active && <CursorGuide />}
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

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>

      <Environment preset="warehouse" />
    </>
  );
}

function ViewPane({ viewId, active }: { viewId: number; active: boolean }) {
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const setActiveView = useViewStore((s) => s.setActiveView);
  const pallet = useViewPallet(viewId);

  return (
    <div
      className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded transition-shadow ${
        active
          ? 'ring-2 ring-blue-500'
          : 'ring-1 ring-gray-700 opacity-95 hover:opacity-100'
      }`}
      onPointerDown={() => setActiveView(viewId)}
    >
      {/* View label */}
      <div
        className={`absolute top-1.5 left-2 z-10 pointer-events-none text-xs font-medium px-1.5 py-0.5 rounded ${
          active ? 'bg-blue-600/90 text-white' : 'bg-gray-800/80 text-gray-400'
        }`}
      >
        {viewId + 1} · {pallet?.name ?? '—'}
        {active && ' ●'}
      </div>

      <Canvas
        camera={{ position: [5, 4, 5], fov: 50 }}
        onPointerMissed={clearSelection}
        shadows
        frameloop="demand"
      >
        <ViewIdContext.Provider value={viewId}>
          <SceneContent viewId={viewId} active={active} />
        </ViewIdContext.Provider>
      </Canvas>
    </div>
  );
}

export function Scene() {
  const layout = useViewStore((s) => s.layout);
  const activeViewId = useViewStore((s) => s.activeViewId);

  if (layout === 'single') {
    return (
      <div className="h-full w-full bg-gray-950 p-1">
        <ViewPane key={activeViewId} viewId={activeViewId} active />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full w-full bg-gray-950 p-1">
      {VIEW_IDS.map((id) => (
        <ViewPane key={id} viewId={id} active={id === activeViewId} />
      ))}
    </div>
  );
}
