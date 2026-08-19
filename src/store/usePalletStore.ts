import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PalletType, CompanyPallet } from '../types';
import defaultPallets from '../data/pallets.json';
import defaultCompanies from '../data/companies.json';
import { useViewStore, MAX_VIEWS } from './useViewStore';

/** Per-view pallet selection */
export interface ViewPalletSelection {
  palletId: string | null;
  company: string | null;
}

const EMPTY_SELECTION: ViewPalletSelection = { palletId: null, company: null };

/** Selections are kept for every possible pane, not just the visible ones */
export function defaultViewSelections(): Record<number, ViewPalletSelection> {
  const sel: Record<number, ViewPalletSelection> = {};
  for (let id = 0; id < MAX_VIEWS; id++) {
    sel[id] = { palletId: 'pmc', company: null };
  }
  return sel;
}

interface PalletStore {
  palletTypes: PalletType[];
  companies: CompanyPallet[];
  /** Pallet selection per split view (keyed by viewId) */
  viewSelections: Record<number, ViewPalletSelection>;

  /** Select pallet/company for the currently active view */
  selectPallet: (id: string) => void;
  selectCompany: (name: string | null) => void;

  addPalletType: (pallet: PalletType) => void;
  updatePalletType: (id: string, updates: Partial<PalletType>) => void;
  deletePalletType: (id: string) => void;
  addCompany: (company: CompanyPallet) => void;
  updateCompany: (name: string, company: CompanyPallet) => void;
  deleteCompany: (name: string) => void;
}

export const usePalletStore = create<PalletStore>()(
  persist(
    (set) => ({
      palletTypes: defaultPallets as PalletType[],
      companies: defaultCompanies as CompanyPallet[],
      viewSelections: defaultViewSelections(),

      selectPallet: (id) =>
        set((s) => {
          const v = useViewStore.getState().activeViewId;
          const prev = s.viewSelections[v] ?? EMPTY_SELECTION;
          return {
            viewSelections: { ...s.viewSelections, [v]: { ...prev, palletId: id } },
          };
        }),
      selectCompany: (name) =>
        set((s) => {
          const v = useViewStore.getState().activeViewId;
          const prev = s.viewSelections[v] ?? EMPTY_SELECTION;
          return {
            viewSelections: { ...s.viewSelections, [v]: { ...prev, company: name } },
          };
        }),

      addPalletType: (pallet) =>
        set((s) => ({ palletTypes: [...s.palletTypes, pallet] })),
      updatePalletType: (id, updates) =>
        set((s) => ({
          palletTypes: s.palletTypes.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      deletePalletType: (id) =>
        set((s) => ({
          palletTypes: s.palletTypes.filter((p) => p.id !== id),
        })),

      addCompany: (company) =>
        set((s) => ({ companies: [...s.companies, company] })),
      updateCompany: (name, company) =>
        set((s) => ({
          companies: s.companies.map((c) =>
            c.companyName === name ? company : c
          ),
        })),
      deleteCompany: (name) =>
        set((s) => ({
          companies: s.companies.filter((c) => c.companyName !== name),
        })),
    }),
    {
      name: 'buildup-pallet-store',
      version: 12,
      // Additive, like the material store: keep everything the user has and
      // fill in defaults they are missing. Earlier versions replaced the whole
      // store, which threw away hand-made pallets and companies on every bump.
      migrate: (persisted) => {
        const s = persisted as Partial<PalletStore> | undefined;
        const defaults = defaultPallets as PalletType[];
        const stored = s?.palletTypes ?? [];
        const storedIds = new Set(stored.map((p) => p.id));

        return {
          palletTypes: [...stored, ...defaults.filter((d) => !storedIds.has(d.id))],
          companies: s?.companies ?? (defaultCompanies as CompanyPallet[]),
          viewSelections: s?.viewSelections ?? defaultViewSelections(),
        };
      },
    }
  )
);

/** Resolve a pallet type from a per-view selection (applies company overrides) */
function resolvePallet(
  palletTypes: PalletType[],
  companies: CompanyPallet[],
  sel: ViewPalletSelection | undefined
): PalletType | null {
  const basePallet = palletTypes.find((p) => p.id === sel?.palletId);
  if (!basePallet || !sel) return basePallet ?? null;

  if (sel.company) {
    const company = companies.find((c) => c.companyName === sel.company);
    const customPallet = company?.pallets.find(
      (p) => p.palletTypeId === sel.palletId
    );
    if (customPallet) {
      return {
        ...basePallet,
        dimensions: customPallet.customDimensions ?? basePallet.dimensions,
        innerDimensions: customPallet.customInnerDimensions ?? basePallet.innerDimensions,
        maxWeight: customPallet.customMaxWeight ?? basePallet.maxWeight,
      };
    }
  }
  return basePallet;
}

/** Non-reactive read: resolved pallet for a view, for use outside React */
export function getViewPallet(viewId: number): PalletType | null {
  const { palletTypes, companies, viewSelections } = usePalletStore.getState();
  return resolvePallet(palletTypes, companies, viewSelections[viewId]);
}

/** Reactive hook: resolved pallet for a specific view */
export function useViewPallet(viewId: number): PalletType | null {
  const palletTypes = usePalletStore((s) => s.palletTypes);
  const companies = usePalletStore((s) => s.companies);
  const sel = usePalletStore((s) => s.viewSelections[viewId]);

  return useMemo(
    () => resolvePallet(palletTypes, companies, sel),
    [palletTypes, companies, sel]
  );
}

/** Reactive hook: resolved pallet for the currently active view */
export function useActivePallet(): PalletType | null {
  const activeViewId = useViewStore((s) => s.activeViewId);
  return useViewPallet(activeViewId);
}

/** Reactive hook: the active view's raw selection (palletId / company) */
export function useActiveViewSelection(): ViewPalletSelection {
  const activeViewId = useViewStore((s) => s.activeViewId);
  const sel = usePalletStore((s) => s.viewSelections[activeViewId]);
  return sel ?? EMPTY_SELECTION;
}
