import { useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Toolbar } from './components/layout/Toolbar';
import { StatusBar } from './components/layout/StatusBar';
import { Scene } from './components/three/Scene';
import { useHistoryStore } from './store/useHistoryStore';
import { useSceneStore } from './store/useSceneStore';
import { useCargoStore } from './store/useCargoStore';
import { useMaterialStore } from './store/useMaterialStore';
import { findStackHeight } from './utils/snapping';

export default function App() {
  const lastNudgeTime = useRef(0);

  // Global keyboard handler: Ctrl+Z undo + Arrow key nudge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      // Arrow key nudge for selected object
      const arrowKeys: Record<string, { dx: number; dz: number }> = {
        ArrowLeft:  { dx: -1, dz:  0 },
        ArrowRight: { dx:  1, dz:  0 },
        ArrowUp:    { dx:  0, dz: -1 },
        ArrowDown:  { dx:  0, dz:  1 },
      };
      const dir = arrowKeys[e.key];
      if (!dir) return;

      const { selectedObjectId, selectedObjectType } = useSceneStore.getState();
      if (!selectedObjectId) return;

      e.preventDefault();
      const step = e.shiftKey ? 5 : 1; // Shift = 5cm, normal = 1cm

      // Batch undo: push snapshot only if >500ms since last nudge
      const now = Date.now();
      if (now - lastNudgeTime.current > 500) {
        useHistoryStore.getState().pushSnapshot();
      }
      lastNudgeTime.current = now;

      if (selectedObjectType === 'cargo') {
        const cargo = useCargoStore.getState().items.find((c) => c.id === selectedObjectId);
        if (!cargo || !cargo.placed) return;
        const newX = cargo.position.x + dir.dx * step;
        const newZ = cargo.position.z + dir.dz * step;
        // Recalculate stack height at new position
        const otherCargos = useCargoStore.getState().items;
        const placedMats = useMaterialStore.getState().placedMaterials;
        const matTypes = useMaterialStore.getState().materialTypes;
        const stackY = findStackHeight(
          { x: newX, y: cargo.position.y, z: newZ },
          cargo, otherCargos, placedMats, matTypes
        );
        const newY = stackY + cargo.dimensions.height / 2;
        useCargoStore.getState().updateCargoPosition(selectedObjectId, { x: newX, y: newY, z: newZ });
      } else if (selectedObjectType === 'material') {
        const mat = useMaterialStore.getState().placedMaterials.find((m) => m.id === selectedObjectId);
        if (!mat) return;
        useMaterialStore.getState().updateMaterialPosition(selectedObjectId, {
          x: mat.position.x + dir.dx * step,
          y: mat.position.y,
          z: mat.position.z + dir.dz * step,
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative">
          <Scene />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
