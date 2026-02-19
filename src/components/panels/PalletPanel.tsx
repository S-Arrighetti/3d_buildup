import { useState, useEffect } from 'react';
import { usePalletStore, useActivePallet } from '../../store/usePalletStore';

interface EditForm {
  length: number;
  width: number;
  height: number;
  innerLength: number;
  innerWidth: number;
  maxWeight: number;
}

export function PalletPanel() {
  const palletTypes = usePalletStore((s) => s.palletTypes);
  const companies = usePalletStore((s) => s.companies);
  const selectedPalletId = usePalletStore((s) => s.selectedPalletId);
  const selectedCompany = usePalletStore((s) => s.selectedCompany);
  const selectPallet = usePalletStore((s) => s.selectPallet);
  const selectCompany = usePalletStore((s) => s.selectCompany);
  const updatePalletType = usePalletStore((s) => s.updatePalletType);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    length: 0, width: 0, height: 0, innerLength: 0, innerWidth: 0, maxWeight: 0,
  });

  const activePallet = useActivePallet();

  // When selected pallet changes, close edit form
  useEffect(() => {
    setEditing(false);
  }, [selectedPalletId]);

  const startEdit = () => {
    if (!activePallet) return;
    setEditForm({
      length: activePallet.dimensions.length,
      width: activePallet.dimensions.width,
      height: activePallet.dimensions.height,
      innerLength: activePallet.innerDimensions?.length ?? 0,
      innerWidth: activePallet.innerDimensions?.width ?? 0,
      maxWeight: activePallet.maxWeight,
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!selectedPalletId) return;
    updatePalletType(selectedPalletId, {
      dimensions: { length: editForm.length, width: editForm.width, height: editForm.height },
      innerDimensions:
        editForm.innerLength > 0 && editForm.innerWidth > 0
          ? { length: editForm.innerLength, width: editForm.innerWidth }
          : undefined,
      maxWeight: editForm.maxWeight,
    });
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Pallet / Container
      </h3>

      {/* Company selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Company</label>
        <select
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
          value={selectedCompany ?? ''}
          onChange={(e) => selectCompany(e.target.value || null)}
        >
          <option value="">Default</option>
          {companies
            .filter((c) => c.companyName !== 'Default')
            .map((c) => (
              <option key={c.companyName} value={c.companyName}>
                {c.companyName}
              </option>
            ))}
        </select>
      </div>

      {/* Pallet type selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Pallet Type</label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {palletTypes.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPallet(p.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                selectedPalletId === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs opacity-75">
                {p.dimensions.length}×{p.dimensions.width}×{p.dimensions.height} cm | Max {p.maxWeight} kg
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active pallet info + Edit */}
      {activePallet && !editing && (
        <div className="bg-gray-700/50 p-2 rounded text-xs text-gray-300">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white">Active: {activePallet.name}</span>
            <button
              onClick={startEdit}
              className="text-blue-400 hover:text-blue-300 text-xs px-1.5 py-0.5 rounded bg-gray-600 hover:bg-gray-500"
            >
              Edit
            </button>
          </div>
          <div>
            Outer: {activePallet.dimensions.length}×{activePallet.dimensions.width}×
            {activePallet.dimensions.height} cm
          </div>
          {activePallet.innerDimensions && (
            <div className="text-yellow-400">
              Inner: {activePallet.innerDimensions.length}×{activePallet.innerDimensions.width} cm
            </div>
          )}
          <div>Max Weight: {activePallet.maxWeight} kg</div>
        </div>
      )}

      {/* Edit form for any pallet type */}
      {activePallet && editing && (
        <div className="bg-gray-700 p-2 rounded space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">Edit: {activePallet.name}</span>
            <button
              onClick={() => setEditing(false)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>

          {/* Outer dimensions */}
          <div className="text-xs text-gray-400 mt-1">Outer (cm)</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400">L</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.length}
                onChange={(e) => setEditForm({ ...editForm, length: +e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">W</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.width}
                onChange={(e) => setEditForm({ ...editForm, width: +e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">H</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.height}
                onChange={(e) => setEditForm({ ...editForm, height: +e.target.value })}
              />
            </div>
          </div>

          {/* Inner dimensions */}
          <div className="text-xs text-yellow-400 mt-1">Inner Line (cm) — 0 = none</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">L</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.innerLength}
                onChange={(e) => setEditForm({ ...editForm, innerLength: +e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">W</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.innerWidth}
                onChange={(e) => setEditForm({ ...editForm, innerWidth: +e.target.value })}
              />
            </div>
          </div>

          {/* Max weight */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">Max Weight (kg)</label>
              <input
                type="number"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                value={editForm.maxWeight}
                onChange={(e) => setEditForm({ ...editForm, maxWeight: +e.target.value })}
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-1.5 rounded font-medium"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
