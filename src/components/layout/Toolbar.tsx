import { useContourStore } from '../../store/useContourStore';
import { useCargoStore } from '../../store/useCargoStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { useViewStore, MAX_VIEWS, visibleViewIds } from '../../store/useViewStore';
import { deleteView, viewContentCount } from '../../store/viewActions';
import { deleteSelectedObject } from '../../store/objectActions';

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

  const updateCargoRotation = useCargoStore((s) => s.updateCargoRotation);
  const updateMaterialRotation = useMaterialStore((s) => s.updateMaterialRotation);
  const items = useCargoStore((s) => s.items);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const clearSelection = useSceneStore((s) => s.clearSelection);

  const activeViewId = useViewStore((s) => s.activeViewId);
  const setActiveView = useViewStore((s) => s.setActiveView);
  const viewCount = useViewStore((s) => s.viewCount);
  const addView = useViewStore((s) => s.addView);

  const handleRemoveView = () => {
    const count = viewContentCount(activeViewId);
    if (
      count > 0 &&
      !window.confirm(
        `View ${activeViewId + 1} still holds ${count} item(s). Remove the view and discard them?`
      )
    ) {
      return;
    }
    deleteView(activeViewId);
  };

  const handleDelete = () => deleteSelectedObject();

  const handleRotate = (delta: number) => {
    if (!selectedObjectId) return;
    useHistoryStore.getState().pushSnapshot();
    if (selectedObjectType === 'cargo') {
      const cargo = items.find((c) => c.id === selectedObjectId);
      if (cargo) {
        updateCargoRotation(selectedObjectId, ((cargo.rotation + delta) % 360 + 360) % 360);
      }
    } else if (selectedObjectType === 'material') {
      const mat = placedMaterials.find((m) => m.id === selectedObjectId);
      if (mat) {
        updateMaterialRotation(selectedObjectId, ((mat.rotation + delta) % 360 + 360) % 360);
      }
    }
  };

  const handleClearAll = () => {
    useHistoryStore.getState().pushSnapshot();
    clearAllCargo(activeViewId);
    clearAllMaterials(activeViewId);
    clearSelection();
  };

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-2">
      <span className="text-sm font-bold text-white mr-4">3D Build-Up</span>

      {/* View selector — panes are split out on demand, one active target */}
      <div className="flex items-center gap-0.5">
        {visibleViewIds(viewCount).map((id) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`text-xs w-6 py-1 rounded font-medium transition-colors ${
              activeViewId === id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            title={`Activate view ${id + 1}`}
          >
            {id + 1}
          </button>
        ))}

        <button
          onClick={() => addView()}
          disabled={viewCount >= MAX_VIEWS}
          className="text-xs w-6 py-1 ml-1 rounded bg-gray-700 text-gray-300 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-700 disabled:hover:text-gray-300 transition-colors"
          title={viewCount >= MAX_VIEWS ? `Maximum ${MAX_VIEWS} views` : 'Split out another view'}
        >
          +
        </button>
        <button
          onClick={handleRemoveView}
          disabled={viewCount <= 1}
          className="text-xs w-6 py-1 rounded bg-gray-700 text-gray-300 hover:bg-red-700 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-700 disabled:hover:text-gray-300 transition-colors"
          title={viewCount <= 1 ? 'Only one view left' : `Remove view ${activeViewId + 1}`}
        >
          −
        </button>
      </div>

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
        disabled={!selectedObjectId || (selectedObjectType !== 'cargo' && selectedObjectType !== 'material')}
        className="text-xs px-1.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Rotate -5°"
      >
        -5°
      </button>
      <button
        onClick={() => handleRotate(5)}
        disabled={!selectedObjectId || (selectedObjectType !== 'cargo' && selectedObjectType !== 'material')}
        className="text-xs px-1.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 rounded"
        title="Rotate +5°"
      >
        +5°
      </button>
      <button
        onClick={() => handleRotate(90)}
        disabled={!selectedObjectId || (selectedObjectType !== 'cargo' && selectedObjectType !== 'material')}
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
        title="Delete selected (Del)"
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
        title={`Clear cargo & materials in view ${activeViewId + 1}`}
      >
        Clear View {activeViewId + 1}
      </button>
    </div>
  );
}
