import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePalletStore } from '../../store/usePalletStore';
import { useContourStore } from '../../store/useContourStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import type { CompanyPallet, ContourProfile, ContourPoint, MaterialType, MaterialCategory } from '../../types';

type DBTab = 'companies' | 'contours' | 'materials';

export function DatabasePanel() {
  const [activeTab, setActiveTab] = useState<DBTab>('companies');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Database
      </h3>

      <div className="flex gap-1">
        {(['companies', 'contours', 'materials'] as DBTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs px-2 py-1 rounded capitalize transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'companies' && <CompanyDB />}
      {activeTab === 'contours' && <ContourDB />}
      {activeTab === 'materials' && <MaterialDB />}
    </div>
  );
}

function CompanyDB() {
  const companies = usePalletStore((s) => s.companies);
  const palletTypes = usePalletStore((s) => s.palletTypes);
  const addCompany = usePalletStore((s) => s.addCompany);
  const deleteCompany = usePalletStore((s) => s.deleteCompany);
  const updateCompany = usePalletStore((s) => s.updateCompany);

  const [newName, setNewName] = useState('');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  // editingIndex: null = adding new, number = editing existing pallet at that index
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    palletTypeId: string;
    length: number;
    width: number;
    height: number;
    innerLength: number;
    innerWidth: number;
    maxWeight: number;
  }>({ palletTypeId: 'pmc', length: 318, width: 244, height: 163, innerLength: 0, innerWidth: 0, maxWeight: 4500 });

  const handleAddCompany = () => {
    if (!newName.trim()) return;
    addCompany({ companyName: newName.trim(), pallets: [] });
    setNewName('');
  };

  const openAddForm = (companyName: string) => {
    setEditingCompany(companyName);
    setEditingIndex(null);
    const pt = palletTypes[0];
    if (pt) {
      setEditForm({
        palletTypeId: pt.id,
        length: pt.dimensions.length,
        width: pt.dimensions.width,
        height: pt.dimensions.height,
        innerLength: pt.innerDimensions?.length ?? 0,
        innerWidth: pt.innerDimensions?.width ?? 0,
        maxWeight: pt.maxWeight,
      });
    }
  };

  const openEditForm = (companyName: string, index: number) => {
    const company = companies.find((c) => c.companyName === companyName);
    if (!company) return;
    const cp = company.pallets[index];
    if (!cp) return;
    const pt = palletTypes.find((p) => p.id === cp.palletTypeId);

    setEditingCompany(companyName);
    setEditingIndex(index);
    setEditForm({
      palletTypeId: cp.palletTypeId,
      length: cp.customDimensions?.length ?? pt?.dimensions.length ?? 300,
      width: cp.customDimensions?.width ?? pt?.dimensions.width ?? 200,
      height: cp.customDimensions?.height ?? pt?.dimensions.height ?? 160,
      innerLength: cp.customInnerDimensions?.length ?? pt?.innerDimensions?.length ?? 0,
      innerWidth: cp.customInnerDimensions?.width ?? pt?.innerDimensions?.width ?? 0,
      maxWeight: cp.customMaxWeight ?? pt?.maxWeight ?? 5000,
    });
  };

  const handleSave = (companyName: string) => {
    const company = companies.find((c) => c.companyName === companyName);
    if (!company) return;

    const palletEntry = {
      palletTypeId: editForm.palletTypeId,
      customDimensions: {
        length: editForm.length,
        width: editForm.width,
        height: editForm.height,
      },
      customInnerDimensions: editForm.innerLength > 0 && editForm.innerWidth > 0
        ? { length: editForm.innerLength, width: editForm.innerWidth }
        : undefined,
      customMaxWeight: editForm.maxWeight,
    };

    let newPallets;
    if (editingIndex !== null) {
      // Update existing
      newPallets = company.pallets.map((p, i) => (i === editingIndex ? palletEntry : p));
    } else {
      // Add new
      newPallets = [...company.pallets, palletEntry];
    }

    updateCompany(companyName, { ...company, pallets: newPallets });
    setEditingCompany(null);
    setEditingIndex(null);
  };

  const handleDeletePallet = (companyName: string, index: number) => {
    const company = companies.find((c) => c.companyName === companyName);
    if (!company) return;
    const newPallets = company.pallets.filter((_, i) => i !== index);
    updateCompany(companyName, { ...company, pallets: newPallets });
  };

  const inputCls = "bg-gray-700 border border-gray-500 rounded px-1 py-0.5 text-xs text-white";

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input
          type="text"
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          placeholder="Company name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCompany()}
        />
        <button
          onClick={handleAddCompany}
          className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 rounded"
        >
          +
        </button>
      </div>

      <div className="space-y-1 max-h-80 overflow-y-auto">
        {companies.map((company) => (
          <div key={company.companyName} className="bg-gray-700 p-2 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white font-medium">
                {company.companyName}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => openAddForm(company.companyName)}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                >
                  + Pallet
                </button>
                {company.companyName !== 'Default' && (
                  <button
                    onClick={() => deleteCompany(company.companyName)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {company.pallets.length > 0 && (
              <div className="space-y-1">
                {company.pallets.map((cp, i) => {
                  const pt = palletTypes.find((p) => p.id === cp.palletTypeId);
                  const dim = cp.customDimensions;
                  const inner = cp.customInnerDimensions ?? pt?.innerDimensions;
                  return (
                    <div
                      key={i}
                      className="text-xs bg-gray-600/50 rounded px-1.5 py-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-gray-200">{pt?.name ?? cp.palletTypeId}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditForm(company.companyName, i)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePallet(company.companyName, i)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="text-gray-400">
                        {dim
                          ? `${dim.length}×${dim.width}×${dim.height} cm | ${cp.customMaxWeight ?? pt?.maxWeight} kg`
                          : 'Default size'}
                      </div>
                      {inner && (
                        <div className="text-yellow-500">
                          Inner: {inner.length}×{inner.width}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {editingCompany === company.companyName && (
              <div className="mt-2 bg-gray-600 p-2 rounded space-y-1">
                <div className="text-xs text-gray-300 font-medium">
                  {editingIndex !== null ? 'Edit Pallet' : 'Add Pallet'}
                </div>
                <select
                  className="w-full bg-gray-700 border border-gray-500 rounded px-1 py-1 text-xs text-white"
                  value={editForm.palletTypeId}
                  onChange={(e) => {
                    const pt = palletTypes.find(
                      (p) => p.id === e.target.value
                    );
                    if (pt) {
                      setEditForm({
                        palletTypeId: pt.id,
                        length: pt.dimensions.length,
                        width: pt.dimensions.width,
                        height: pt.dimensions.height,
                        innerLength: pt.innerDimensions?.length ?? 0,
                        innerWidth: pt.innerDimensions?.width ?? 0,
                        maxWeight: pt.maxWeight,
                      });
                    }
                  }}
                >
                  {palletTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
                <label className="text-xs text-gray-400">Outer (L×W×H) + MaxWeight</label>
                <div className="grid grid-cols-4 gap-1">
                  <input type="number" className={inputCls} placeholder="L" value={editForm.length} onChange={(e) => setEditForm({ ...editForm, length: +e.target.value })} />
                  <input type="number" className={inputCls} placeholder="W" value={editForm.width} onChange={(e) => setEditForm({ ...editForm, width: +e.target.value })} />
                  <input type="number" className={inputCls} placeholder="H" value={editForm.height} onChange={(e) => setEditForm({ ...editForm, height: +e.target.value })} />
                  <input type="number" className={inputCls} placeholder="kg" value={editForm.maxWeight} onChange={(e) => setEditForm({ ...editForm, maxWeight: +e.target.value })} />
                </div>
                <label className="text-xs text-yellow-400">Inner Line (L×W) - 0 = none</label>
                <div className="grid grid-cols-2 gap-1">
                  <input type="number" className={inputCls} placeholder="Inner L" value={editForm.innerLength} onChange={(e) => setEditForm({ ...editForm, innerLength: +e.target.value })} />
                  <input type="number" className={inputCls} placeholder="Inner W" value={editForm.innerWidth} onChange={(e) => setEditForm({ ...editForm, innerWidth: +e.target.value })} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSave(company.companyName)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 rounded"
                  >
                    {editingIndex !== null ? 'Update' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setEditingCompany(null); setEditingIndex(null); }}
                    className="px-2 bg-gray-500 hover:bg-gray-400 text-white text-xs py-1 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContourDB() {
  const contours = useContourStore((s) => s.contours);
  const activeContourId = useContourStore((s) => s.activeContourId);
  const setActiveContour = useContourStore((s) => s.setActiveContour);
  const addContour = useContourStore((s) => s.addContour);
  const deleteContour = useContourStore((s) => s.deleteContour);

  const [showAdd, setShowAdd] = useState(false);
  const [newContour, setNewContour] = useState({
    airline: '',
    aircraftType: '',
    position: 'main-deck',
    pointsText: '',
  });

  const handleAdd = () => {
    if (!newContour.airline || !newContour.aircraftType) return;

    // Parse points from text: "x1,y1; x2,y2; ..."
    const points: ContourPoint[] = newContour.pointsText
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [x, y] = s.split(',').map(Number);
        return { x: x || 0, y: y || 0 };
      });

    const contour: ContourProfile = {
      id: uuidv4(),
      airline: newContour.airline,
      aircraftType: newContour.aircraftType,
      position: newContour.position,
      points,
    };

    addContour(contour);
    setShowAdd(false);
    setNewContour({ airline: '', aircraftType: '', position: 'main-deck', pointsText: '' });
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full bg-green-600 hover:bg-green-500 text-white text-xs py-1 rounded"
      >
        + Add Contour
      </button>

      {showAdd && (
        <div className="bg-gray-700 p-2 rounded space-y-1">
          <input
            type="text"
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white"
            placeholder="Airline (e.g. KE, OZ)"
            value={newContour.airline}
            onChange={(e) =>
              setNewContour({ ...newContour, airline: e.target.value })
            }
          />
          <input
            type="text"
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white"
            placeholder="Aircraft (e.g. B747F)"
            value={newContour.aircraftType}
            onChange={(e) =>
              setNewContour({ ...newContour, aircraftType: e.target.value })
            }
          />
          <select
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white"
            value={newContour.position}
            onChange={(e) =>
              setNewContour({ ...newContour, position: e.target.value })
            }
          >
            <option value="main-deck">Main Deck</option>
            <option value="lower-deck">Lower Deck</option>
          </select>
          <div>
            <label className="text-xs text-gray-400">
              Points (x,y; x,y; ...)
            </label>
            <textarea
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white h-16"
              placeholder="0,300; 50,300; 100,298; 122,295; 155,275"
              value={newContour.pointsText}
              onChange={(e) =>
                setNewContour({ ...newContour, pointsText: e.target.value })
              }
            />
          </div>
          <button
            onClick={handleAdd}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 rounded"
          >
            Save
          </button>
        </div>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {contours.map((c) => (
          <div
            key={c.id}
            className={`bg-gray-700 p-2 rounded cursor-pointer transition-colors ${
              activeContourId === c.id ? 'ring-1 ring-blue-400' : ''
            }`}
            onClick={() =>
              setActiveContour(activeContourId === c.id ? null : c.id)
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">
                  {c.airline} - {c.aircraftType}
                </div>
                <div className="text-xs text-gray-400">
                  {c.position} | {c.points.length} points
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteContour(c.id);
                }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialDB() {
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const addMaterialType = useMaterialStore((s) => s.addMaterialType);
  const deleteMaterialType = useMaterialStore((s) => s.deleteMaterialType);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'other' as MaterialCategory,
    length: 100,
    width: 100,
    height: 10,
    color: '#888888',
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const mat: MaterialType = {
      id: uuidv4(),
      name: form.name.trim(),
      category: form.category,
      dimensions: { length: form.length, width: form.width, height: form.height },
      color: form.color,
    };
    addMaterialType(mat);
    setShowAdd(false);
    setForm({ name: '', category: 'other', length: 100, width: 100, height: 10, color: '#888888' });
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full bg-green-600 hover:bg-green-500 text-white text-xs py-1 rounded"
      >
        + Add Material Type
      </button>

      {showAdd && (
        <div className="bg-gray-700 p-2 rounded space-y-1">
          <input
            type="text"
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white"
            placeholder="Material name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as MaterialCategory })
            }
          >
            <option value="skid">Skid</option>
            <option value="lumber">Lumber</option>
            <option value="spacer">SPB / Spacer</option>
            <option value="belt">Belt / Strap</option>
            <option value="net">Net</option>
            <option value="other">Other</option>
          </select>
          <div className="grid grid-cols-3 gap-1">
            <input type="number" className="bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-xs text-white" placeholder="L" value={form.length} onChange={(e) => setForm({ ...form, length: +e.target.value })} />
            <input type="number" className="bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-xs text-white" placeholder="W" value={form.width} onChange={(e) => setForm({ ...form, width: +e.target.value })} />
            <input type="number" className="bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-xs text-white" placeholder="H" value={form.height} onChange={(e) => setForm({ ...form, height: +e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Color:</label>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer"
            />
          </div>
          <button
            onClick={handleAdd}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 rounded"
          >
            Save
          </button>
        </div>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {materialTypes.map((mt) => (
          <div key={mt.id} className="bg-gray-700 p-1.5 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: mt.color }} />
              <div>
                <div className="text-xs text-white">{mt.name}</div>
                <div className="text-xs text-gray-500">
                  {mt.category} | {mt.dimensions.length}×{mt.dimensions.width}×{mt.dimensions.height}
                </div>
              </div>
            </div>
            <button
              onClick={() => deleteMaterialType(mt.id)}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
