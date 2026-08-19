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
import { DropPreview } from './DropPreview';
import { ViewIdContext } from './ViewContext';
import { useSceneStore } from '../../store/useSceneStore';
import { useViewStore, MAX_VIEWS, visibleViewIds } from '../../store/useViewStore';
import { deleteView, viewContentCount } from '../../store/viewActions';
import { useViewPallet } from '../../store/usePalletStore';

const SCALE = 0.01;

function SceneContent({ viewId, active }: { viewId: number; active: boolean }) {
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const isDragging = useSceneStore((s) => s.isDragging);
  const orbitLocked = useSceneStore((s) => s.rotationLocked);
  const setOrbitControlsRef = useSceneStore((s) => s.setOrbitControlsRef);
  const setViewViewport = useSceneStore((s) => s.setViewViewport);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Register this view's OrbitControls ref in store for direct manipulation
  useEffect(() => {
    if (controlsRef.current) {
      setOrbitControlsRef(viewId, controlsRef.current);
    }
    return () => setOrbitControlsRef(viewId, null);
  }, [setOrbitControlsRef, viewId]);

  // Publish this pane's camera + canvas so a drag started elsewhere can hit-test
  // it and unproject the drop point through the right camera
  useEffect(() => {
    setViewViewport(viewId, { camera, el: gl.domElement });
    return () => setViewViewport(viewId, null);
  }, [setViewViewport, viewId, camera, gl]);

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
        {/* Ghost for an item being dragged in from another pane */}
        <DropPreview />
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

function ViewPane({
  viewId,
  active,
  showClose,
}: {
  viewId: number;
  active: boolean;
  showClose: boolean;
}) {
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const setActiveView = useViewStore((s) => s.setActiveView);
  const isDragging = useSceneStore((s) => s.isDragging);
  const dragOverViewId = useSceneStore((s) => s.dragOverViewId);
  const pallet = useViewPallet(viewId);

  const isDropTarget = isDragging && dragOverViewId === viewId;

  const ring = isDropTarget
    ? 'ring-2 ring-emerald-400'
    : active
      ? 'ring-2 ring-blue-500'
      : 'ring-1 ring-gray-700 opacity-95 hover:opacity-100';

  const handleClose = () => {
    const count = viewContentCount(viewId);
    if (
      count > 0 &&
      !window.confirm(
        `View ${viewId + 1} still holds ${count} item(s). Remove the view and discard them?`
      )
    ) {
      return;
    }
    deleteView(viewId);
  };

  return (
    <div
      className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded transition-shadow ${ring}`}
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

      {showClose && (
        <button
          onClick={handleClose}
          className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded bg-gray-800/80 text-gray-400 hover:bg-red-700 hover:text-white text-xs leading-none"
          title={`Remove view ${viewId + 1}`}
        >
          ×
        </button>
      )}

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

/** Fills the leftover grid cell at 3 panes, so splitting further is one click away */
function AddViewTile() {
  const addView = useViewStore((s) => s.addView);
  return (
    <button
      onClick={() => addView()}
      className="h-full w-full min-h-0 min-w-0 rounded border-2 border-dashed border-gray-700 text-gray-500 hover:border-blue-500 hover:text-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
      title="Split out another view"
    >
      <span className="text-2xl leading-none">+</span>
      <span className="text-xs">Add view</span>
    </button>
  );
}

/** Full class strings so Tailwind picks them up at build time */
const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

export function Scene() {
  const viewCount = useViewStore((s) => s.viewCount);
  const activeViewId = useViewStore((s) => s.activeViewId);

  return (
    <div
      className={`grid gap-1 h-full w-full bg-gray-950 p-1 ${GRID_CLASS[viewCount] ?? GRID_CLASS[1]}`}
    >
      {visibleViewIds(viewCount).map((id) => (
        <ViewPane
          key={id}
          viewId={id}
          active={id === activeViewId}
          showClose={viewCount > 1}
        />
      ))}
      {/* 3 panes leave one cell of the 2x2 grid free */}
      {viewCount === 3 && MAX_VIEWS >= 4 && <AddViewTile />}
    </div>
  );
}
