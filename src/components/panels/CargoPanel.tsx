import { useState } from 'react';
import { useCargoStore } from '../../store/useCargoStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';

export function CargoPanel() {
  const items = useCargoStore((s) => s.items);
  const addCargo = useCargoStore((s) => s.addCargo);
  const removeCargo = useCargoStore((s) => s.removeCargo);
  const setCargoPlaced = useCargoStore((s) => s.setCargoPlaced);
  const updateCargoRotation = useCargoStore((s) => s.updateCargoRotation);
  const updateCargoPosition = useCargoStore((s) => s.updateCargoPosition);
  const clearAll = useCargoStore((s) => s.clearAll);
  const selectObject = useSceneStore((s) => s.selectObject);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);

  const [form, setForm] = useState({
    label: '',
    length: 100,
    width: 80,
    height: 60,
    weight: 50,
    quantity: 1,
  });

  const handleAdd = () => {
    useHistoryStore.getState().pushSnapshot();
    addCargo(
      { length: form.length, width: form.width, height: form.height },
      form.weight,
      form.quantity,
      form.label || undefined
    );
    setForm({ ...form, label: '' });
  };

  const handlePlace = (id: string) => {
    const cargo = items.find((c) => c.id === id);
    if (!cargo) return;
    if (!cargo.placed) {
      useHistoryStore.getState().pushSnapshot();
      updateCargoPosition(id, { x: 0, y: cargo.dimensions.height / 2, z: 0 });
      setCargoPlaced(id, true);
    }
  };

  const handleRotate = (id: string, angle?: number) => {
    const cargo = items.find((c) => c.id === id);
    if (!cargo) return;
    useHistoryStore.getState().pushSnapshot();
    if (angle !== undefined) {
      updateCargoRotation(id, ((angle % 360) + 360) % 360);
    } else {
      updateCargoRotation(id, (cargo.rotation + 90) % 360);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Cargo
      </h3>

      {/* Add cargo form */}
      <div className="bg-gray-700 p-2 rounded space-y-2">
        <div>
          <label className="text-xs text-gray-400">Label (optional)</label>
          <input
            type="text"
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
            placeholder="e.g. Box A"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div>
            <label className="text-xs text-gray-400">L (cm)</label>
            <input
              type="number"
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
              value={form.length}
              onChange={(e) => setForm({ ...form, length: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">W (cm)</label>
            <input
              type="number"
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
              value={form.width}
              onChange={(e) => setForm({ ...form, width: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">H (cm)</label>
            <input
              type="number"
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: +e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-xs text-gray-400">Weight (kg)</label>
            <input
              type="number"
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Qty</label>
            <input
              type="number"
              min={1}
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: +e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-green-600 hover:bg-green-500 text-white text-sm py-1.5 rounded font-medium"
        >
          + Add Cargo
        </button>
      </div>

      {/* Cargo list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {items.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">No cargo added</div>
        )}
        {items.map((cargo) => (
          <div
            key={cargo.id}
            className={`bg-gray-700 p-2 rounded text-sm cursor-pointer transition-colors ${
              selectedObjectId === cargo.id ? 'ring-1 ring-blue-400' : ''
            }`}
            onClick={() => selectObject(cargo.id, 'cargo')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: cargo.color }}
                />
                <span className="font-medium text-white">{cargo.label}</span>
              </div>
              <div className="flex gap-1">
                {!cargo.placed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlace(cargo.id);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-0.5 rounded"
                    title="Place on pallet"
                  >
                    Place
                  </button>
                )}
                {cargo.placed && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotate(cargo.id);
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded"
                      title="Rotate +90°"
                    >
                      ↻90
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotate(cargo.id, cargo.rotation + 5);
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded"
                      title="Rotate +5°"
                    >
                      +5°
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotate(cargo.id, cargo.rotation - 5);
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded"
                      title="Rotate -5°"
                    >
                      -5°
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useHistoryStore.getState().pushSnapshot();
                    removeCargo(cargo.id);
                  }}
                  className="bg-red-600/80 hover:bg-red-500 text-white text-xs px-2 py-0.5 rounded"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {cargo.dimensions.length}×{cargo.dimensions.width}×{cargo.dimensions.height} cm |{' '}
              {cargo.weight} kg
              {cargo.placed && (
                <span className="text-green-400 ml-1">● Placed</span>
              )}
              {!cargo.placed && (
                <span className="text-yellow-400 ml-1">○ Not placed</span>
              )}
            </div>
            {cargo.placed && (
              <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-gray-500">Angle:</span>
                <input
                  type="number"
                  min={0}
                  max={359}
                  step={1}
                  value={Math.round(cargo.rotation)}
                  onChange={(e) => handleRotate(cargo.id, +e.target.value)}
                  className="w-14 bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-xs text-white"
                />
                <span className="text-xs text-gray-500">°</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <button
          onClick={() => { useHistoryStore.getState().pushSnapshot(); clearAll(); }}
          className="w-full bg-red-800/60 hover:bg-red-700 text-red-200 text-xs py-1 rounded"
        >
          Clear All Cargo
        </button>
      )}
    </div>
  );
}
