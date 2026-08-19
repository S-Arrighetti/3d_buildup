import { useCargoStore } from './useCargoStore';
import { useMaterialStore } from './useMaterialStore';
import { useSceneStore } from './useSceneStore';
import { useHistoryStore } from './useHistoryStore';

/**
 * Remove whatever is selected, cargo or material, and drop the selection.
 * Shared by the toolbar button and the Delete key so both undo the same way.
 * Returns false when there was nothing to delete.
 */
export function deleteSelectedObject(): boolean {
  const { selectedObjectId, selectedObjectType } = useSceneStore.getState();
  if (!selectedObjectId) return false;
  if (selectedObjectType !== 'cargo' && selectedObjectType !== 'material') return false;

  useHistoryStore.getState().pushSnapshot();

  if (selectedObjectType === 'cargo') {
    useCargoStore.getState().removeCargo(selectedObjectId);
  } else {
    useMaterialStore.getState().removePlacedMaterial(selectedObjectId);
  }

  useSceneStore.getState().clearSelection();
  return true;
}
