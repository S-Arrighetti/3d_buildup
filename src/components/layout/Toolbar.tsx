import { useContourStore } from '../../store/useContourStore';
import { useCargoStore } from '../../store/useCargoStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';

export function Toolbar() {
  const showContour = useContourStore((s) => s.showContour);
  const toggleContour = useContourStore((s) => s.toggleContour);
  const activeContourId = useContourStore((s) => s.activeContourId);
  const contours = useContourStore((s) => s.contours);
  const setActiveContour = useContourStore((s) => s.setActiveContour);

  const clearAllCargo = useCargoStore((s) => s.clearAll);
  const clearAllMaterials = useMaterialStore((s) => s.clearAllPlaced);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const selectedObjectType = useSceneStore((s) => s.selectedObjectType);
  const rotationLocked = useSceneStore((s) => s.rotationLocked);
  const toggleRotationLock = useSceneStore((s) => s.toggleRotationLock);

  const removeCargo = useCargoStore((s) => s.removeCargo);
  const removeMaterial = useMaterialStore((s) => s.removePlacedMaterial);
  const updateCargoRotation = useCargoStore((s) => s.updateCargoRotation);
  const items = useCargoStore((s) => s.items);
  const clearSelection = useSceneStore((s) => s.clearSelection);

  const handleDelete = () => {
    if (!selectedObjectId) return;
    useHistoryStore.getState().pushSnapshot();
    if (selectedObjectType === 'cargo') {
      removeCargo(selectedObjectId);
    } else if (selectedObjectType === 'material') {
      removeMaterial(selectedObjectId);
    }
    clearSelection();
  };

  const handleRotate = (delta: number) => {
    if (!selectedObjectId || selectedObjectType !== 'cargo') return;
    const cargo = items.find((c) => c.id === selectedObjectId);
    if (cargo) {
      useHistoryStore.getState().pushSnapshot();
      updateCargoRotation(selectedObjectId, ((cargo.rotation + delta) % 360 + 360) % 360);
    }
  };

  const handleClearAll = () => {
    useHistoryStore.getState().pushSnapshot();
    clearAllCargo();
    clearAllMaterials();
    clearSelection();
  };

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-2">
      <span className="text-sm font-bold text-white mr-4">3D Build-Up</span>

      <div className="h-5 w-px bg-gray-600" />

      {/* Undo */}
      <button
        onClick={() => useHistoryStore.getState().undo()}
        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>

      {/* Object actions */}
      <button
        onClick={() => handleRotate(-5)}
        disabled={!selectedObjectId || selectedObjectType !== 'cargo'}
        className="text-xs px-1.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Rotate -5°"
      >
        -5°
      </button>
      <button
        onClick={() => handleRotate(5)}
        disabled={!selectedObjectId || selectedObjectType !== 'cargo'}
        className="text-xs px-1.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Rotate +5°"
      >
        +5°
      </button>
      <button
        onClick={() => handleRotate(90)}
        disabled={!selectedObjectId || selectedObjectType !== 'cargo'}
        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Rotate +90°"
      >
        ↻ 90°
      </button>

      {/* Orbit / Camera Lock Toggle */}
      <button
        onClick={toggleRotationLock}
        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
          rotationLocked
            ? 'bg-red-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
        title={rotationLocked ? 'Camera rotation locked' : 'Camera rotation unlocked'}
      >
        {rotationLocked ? '🔒 View Lock' : '🔓 View Lock'}
      </button>

      <button
        onClick={handleDelete}
        disabled={!selectedObjectId}
        className="text-xs px-2 py-1 bg-gray-700 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Delete selected"
      >
        ✕ Delete
      </button>

      {selectedObjectId && (
        <span className="text-xs text-gray-500 ml-1" title="Arrow keys: 1cm nudge, Shift+Arrow: 5cm nudge">
          [Arrow: 1cm | Shift+Arrow: 5cm]
        </span>
      )}

      <div className="h-5 w-px bg-gray-600" />

      {/* Contour */}
      <select
        className="text-xs bg-gray-700 border border-gray-600 text-gray-300 rounded px-1 py-1"
        value={activeContourId ?? ''}
        onChange={(e) => setActiveContour(e.target.value || null)}
      >
        <option value="">No Contour</option>
        {contours.map((c) => (
          <option key={c.id} value={c.id}>
            {c.airline} {c.aircraftType} ({c.position})
          </option>
        ))}
      </select>

      {activeContourId && (
        <button
          onClick={toggleContour}
          className={`text-xs px-2 py-1 rounded ${
            showContour
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {showContour ? 'Contour ON' : 'Contour OFF'}
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={handleClearAll}
        className="text-xs px-2 py-1 bg-red-800/60 hover:bg-red-700 text-red-200 rounded"
      >
        Clear All
      </button>
    </div>
  );
}
