import { createContext, useContext, useMemo } from 'react';
import { useCargoStore, cargoInView } from '../../store/useCargoStore';
import { useMaterialStore, materialsInView } from '../../store/useMaterialStore';
import type { CargoItem, PlacedMaterial } from '../../types';

/**
 * Provides the viewId of the split-view pane each Canvas belongs to.
 * Must be provided INSIDE the <Canvas> so it lives in the R3F React tree.
 */
export const ViewIdContext = createContext<number>(0);

export function useViewId(): number {
  return useContext(ViewIdContext);
}

/** Cargo items belonging to the given view */
export function useViewCargoItems(viewId: number): CargoItem[] {
  const items = useCargoStore((s) => s.items);
  return useMemo(() => cargoInView(items, viewId), [items, viewId]);
}

/** Placed materials belonging to the given view */
export function useViewPlacedMaterials(viewId: number): PlacedMaterial[] {
  const placedMaterials = useMaterialStore((s) => s.placedMaterials);
  return useMemo(() => materialsInView(placedMaterials, viewId), [placedMaterials, viewId]);
}
