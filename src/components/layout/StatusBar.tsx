import { useMemo } from 'react';
import { useCargoStore } from '../../store/useCargoStore';
import { useActivePallet } from '../../store/usePalletStore';
import { useMaterialStore } from '../../store/useMaterialStore';
import { useContourStore } from '../../store/useContourStore';
import {
  getMaxStackHeightWithMaterials, checkAllOverhangs, checkAllInnerOverhangs,
  checkAllMaterialOverhangs, checkAllMaterialInnerOverhangs,
} from '../../utils/collision';
import { checkContourViolations } from '../../utils/contourCheck';

export function StatusBar() {
  const items = useCargoStore((s) => s.items);
  const getTotalWeight = useCargoStore((s) => s.getTotalWeight);
  const getTotalVolume = useCargoStore((s) => s.getTotalVolume);
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  const materialTypes = useMaterialStore((s) => s.materialTypes);
  const contours = useContourStore((s) => s.contours);
  const activeContourId = useContourStore((s) => s.activeContourId);

  const pallet = useActivePallet();
  const contour = contours.find((c) => c.id === activeContourId) ?? null;

  const stats = useMemo(() => {
    const placedCount = items.filter((c) => c.placed).length;
    const totalWeight = getTotalWeight();
    const totalVolume = getTotalVolume();
    const maxHeight = getMaxStackHeightWithMaterials(items, placedMaterials, materialTypes);

    let palletVolume = 0;
    let weightPercent = 0;
    let volumePercent = 0;
    let hasOverhang = false;
    let hasInnerOverhang = false;
    let contourViolations = 0;

    if (pallet) {
      palletVolume =
        (pallet.dimensions.length * pallet.dimensions.width * pallet.dimensions.height) /
        1_000_000;
      weightPercent = pallet.maxWeight > 0 ? (totalWeight / pallet.maxWeight) * 100 : 0;
      volumePercent = palletVolume > 0 ? (totalVolume / palletVolume) * 100 : 0;

      // Cargo overhang
      const overhangs = checkAllOverhangs(items, pallet.dimensions);
      hasOverhang = Array.from(overhangs.values()).some((r) => r.hasOverhang);

      // Material overhang (outer)
      const matOverhangs = checkAllMaterialOverhangs(placedMaterials, materialTypes, pallet.dimensions);
      if (!hasOverhang) {
        hasOverhang = Array.from(matOverhangs.values()).some((r) => r.hasOverhang);
      }

      if (pallet.innerDimensions) {
        // Cargo inner line
        const innerOverhangs = checkAllInnerOverhangs(
          items, pallet.innerDimensions, placedMaterials, materialTypes
        );
        hasInnerOverhang = Array.from(innerOverhangs.values()).some((r) => r.hasInnerOverhang);

        // Material inner line
        if (!hasInnerOverhang) {
          const matInnerOverhangs = checkAllMaterialInnerOverhangs(
            placedMaterials, materialTypes, pallet.innerDimensions
          );
          hasInnerOverhang = Array.from(matInnerOverhangs.values()).some((r) => r.hasInnerOverhang);
        }
      }
    }

    if (contour) {
      contourViolations = checkContourViolations(items, contour).length;
    }

    return {
      placedCount,
      totalCount: items.length,
      totalWeight,
      totalVolume: totalVolume.toFixed(3),
      maxHeight: Math.round(maxHeight),
      weightPercent: weightPercent.toFixed(1),
      volumePercent: volumePercent.toFixed(1),
      maxWeight: pallet?.maxWeight ?? 0,
      hasOverhang,
      hasInnerOverhang,
      contourViolations,
      materialCount: placedMaterials.length,
    };
  }, [items, pallet, placedMaterials, materialTypes, contour, getTotalWeight, getTotalVolume]);

  return (
    <div className="h-8 bg-gray-800 border-t border-gray-700 flex items-center px-3 gap-4 text-xs">
      <span className="text-gray-400">
        Cargo: <span className="text-white">{stats.placedCount}/{stats.totalCount}</span>
      </span>

      <span className="text-gray-400">
        Materials: <span className="text-white">{stats.materialCount}</span>
      </span>

      <div className="h-4 w-px bg-gray-600" />

      <span className="text-gray-400">
        Weight:{' '}
        <span
          className={
            parseFloat(stats.weightPercent) > 100 ? 'text-red-400' : 'text-white'
          }
        >
          {stats.totalWeight} kg ({stats.weightPercent}%)
        </span>
      </span>

      <span className="text-gray-400">
        Volume:{' '}
        <span className="text-white">
          {stats.totalVolume} m³ ({stats.volumePercent}%)
        </span>
      </span>

      <span className="text-gray-400">
        Height:{' '}
        <span className="text-white">{stats.maxHeight} cm</span>
      </span>

      <div className="flex-1" />

      {stats.hasInnerOverhang && (
        <span className="text-orange-400 font-medium animate-pulse">
          ⚠ INNER LINE
        </span>
      )}

      {stats.hasOverhang && (
        <span className="text-red-400 font-medium animate-pulse">
          ⚠ OVERHANG
        </span>
      )}

      {stats.contourViolations > 0 && (
        <span className="text-red-400 font-medium animate-pulse">
          ⚠ CONTOUR ({stats.contourViolations})
        </span>
      )}

      {!stats.hasOverhang && !stats.hasInnerOverhang && stats.contourViolations === 0 && stats.placedCount > 0 && (
        <span className="text-green-400">✓ OK</span>
      )}
    </div>
  );
}
