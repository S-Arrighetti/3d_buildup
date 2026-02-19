import { useState } from 'react';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useCargoStore } from '../../store/useCargoStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { useActivePallet } from '../../store/usePalletStore';
import type { MaterialCategory, MaterialType } from '../../types';

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  skid: 'Skid',
  lumber: 'Lumber',
  spacer: 'SPB / Spacer',
  belt: 'Belt / Strap',
  net: 'Net',
  other: 'Other',
};

const CATEGORY_ORDER: MaterialCategory[] = ['skid', 'lumber', 'spacer', 'belt', 'net', 'other'];

export function MaterialPanel() {
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const placeMaterial = useMaterialStore((s) => s.placeMaterial);
  const removePlacedMaterial = useMaterialStore((s) => s.removePlacedMaterial);
  const attachBeltToCargo = useMaterialStore((s) => s.attachBeltToCargo);
  const clearAllPlaced = useMaterialStore((s) => s.clearAllPlaced);

  const cargoItems = useCargoStore((s) => s.items);
  const selectObject = useSceneStore((s) => s.selectObject);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);

  const pallet = useActivePallet();

  const [activeCategory, setActiveCategory] = useState<MaterialCategory>('skid');
  const [beltAttachMode, setBeltAttachMode] = useState<string | null>(null);
  const [selectedCargoIds, setSelectedCargoIds] = useState<string[]>([]);
  const [autoRows, setAutoRows] = useState(2);

  const filteredTypes = materialTypes.filter((m) => m.category === activeCategory);

  const startBeltRouting = useSceneStore((s) => s.startBeltRouting);

  /** Auto-layout: place skids/lumber evenly across the pallet */
  const handleAutoLayout = (mt: MaterialType) => {
    if (!pallet) return;
    useHistoryStore.getState().pushSnapshot();

    const palletL = pallet.dimensions.length;
    const palletW = pallet.dimensions.width;
    const skidL = mt.dimensions.length; // along X
    const skidW = mt.dimensions.width;  // along Z
    const skidH = mt.dimensions.height;

    // How many skids fit along the pallet length (X axis)
    const colsAlongX = Math.max(1, Math.floor(palletL / skidL));
    // Gap between skids along X: distribute remaining space evenly (edges + between)
    const totalSkidX = colsAlongX * skidL;
    const gapX = (palletL - totalSkidX) / (colsAlongX + 1);

    // Rows along Z (user-selectable count)
    const rows = Math.min(autoRows, Math.floor(palletW / skidW));
    // Gap between skids along Z: distribute remaining space evenly (edges + between)
    const totalSkidZ = rows * skidW;
    const gapZ = (palletW - totalSkidZ) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      const z = -palletW / 2 + gapZ + skidW / 2 + r * (skidW + gapZ);
      for (let c = 0; c < colsAlongX; c++) {
        const x = -palletL / 2 + gapX + skidL / 2 + c * (skidL + gapX);
        placeMaterial(mt.id, { x, y: skidH / 2, z });
      }
    }
  };

  const handlePlace = (materialTypeId: string) => {
    const mt = materialTypes.find((m) => m.id === materialTypeId);
    if (!mt) return;

    // Belt: enter interactive routing mode (click boundary → cargo → boundary)
    if (mt.category === 'belt') {
      startBeltRouting(materialTypeId);
      return;
    }

    useHistoryStore.getState().pushSnapshot();
    placeMaterial(materialTypeId, {
      x: 0,
      y: mt.dimensions.height / 2,
      z: 0,
    });
  };

  const handleBeltAttach = () => {
    if (beltAttachMode && selectedCargoIds.length > 0) {
      attachBeltToCargo(beltAttachMode, selectedCargoIds);
    }
    setBeltAttachMode(null);
    setSelectedCargoIds([]);
  };

  const toggleCargoForBelt = (cargoId: string) => {
    setSelectedCargoIds((prev) =>
      prev.includes(cargoId)
        ? prev.filter((id) => id !== cargoId)
        : [...prev, cargoId]
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Materials
      </h3>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Material types in selected category */}
      <div className="space-y-1">
        {filteredTypes.map((mt) => (
          <div
            key={mt.id}
            className="bg-gray-700 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: mt.color }}
              />
              <div>
                <div className="text-sm text-white">{mt.name}</div>
                <div className="text-xs text-gray-400">
                  {mt.dimensions.length}×{mt.dimensions.width}×{mt.dimensions.height} cm
                </div>
              </div>
            </div>
            <button
              onClick={() => handlePlace(mt.id)}
              className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded"
            >
              + Place
            </button>
          </div>
        ))}
        {filteredTypes.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">
            No materials in this category
          </div>
        )}
      </div>

      {/* Auto Layout for skid/lumber */}
      {(activeCategory === 'skid' || activeCategory === 'lumber') && filteredTypes.length > 0 && pallet && (
        <div className="bg-gray-700/50 p-2 rounded space-y-2">
          <div className="text-xs text-gray-300 font-medium">Auto Layout</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Rows:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={autoRows}
              onChange={(e) => setAutoRows(Math.max(1, +e.target.value))}
              className="w-14 bg-gray-600 border border-gray-500 rounded px-1.5 py-0.5 text-xs text-white"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {filteredTypes.map((mt) => (
              <button
                key={`auto-${mt.id}`}
                onClick={() => handleAutoLayout(mt)}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-2 py-1 rounded"
              >
                Auto: {mt.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Belt attach mode */}
      {beltAttachMode && (
        <div className="bg-orange-900/50 border border-orange-600 p-2 rounded space-y-2">
          <div className="text-xs text-orange-300 font-medium">
            Select cargo to secure with belt:
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {cargoItems
              .filter((c) => c.placed)
              .map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCargoIds.includes(c.id)}
                    onChange={() => toggleCargoForBelt(c.id)}
                    className="rounded"
                  />
                  <span
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.label}
                </label>
              ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleBeltAttach}
              disabled={selectedCargoIds.length === 0}
              className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:text-gray-400 text-white text-xs py-1 rounded"
            >
              Attach Belt
            </button>
            <button
              onClick={() => {
                setBeltAttachMode(null);
                setSelectedCargoIds([]);
              }}
              className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Placed materials list */}
      {placedMaterials.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-1">
            Placed ({placedMaterials.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {placedMaterials.map((pm) => {
              const mt = materialTypes.find((m) => m.id === pm.materialTypeId);
              if (!mt) return null;
              return (
                <div
                  key={pm.id}
                  className={`bg-gray-700 p-1.5 rounded flex items-center justify-between text-xs cursor-pointer ${
                    selectedObjectId === pm.id ? 'ring-1 ring-blue-400' : ''
                  }`}
                  onClick={() => selectObject(pm.id, 'material')}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded"
                      style={{ backgroundColor: mt.color }}
                    />
                    <span className="text-gray-300">{mt.name}</span>
                    {pm.attachedCargoIds && pm.attachedCargoIds.length > 0 && (
                      <span className="text-orange-400">
                        (securing {pm.attachedCargoIds.length})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useHistoryStore.getState().pushSnapshot();
                      removePlacedMaterial(pm.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { useHistoryStore.getState().pushSnapshot(); clearAllPlaced(); }}
            className="w-full mt-1 bg-red-800/60 hover:bg-red-700 text-red-200 text-xs py-1 rounded"
          >
            Clear All Materials
          </button>
        </div>
      )}
    </div>
  );
}
