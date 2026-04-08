import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PalletType, CompanyPallet } from '../types';
import defaultPallets from '../data/pallets.json';
import defaultCompanies from '../data/companies.json';

interface PalletStore {
  palletTypes: PalletType[];
  companies: CompanyPallet[];
  selectedPalletId: string | null;
  selectedCompany: string | null;

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
      selectedPalletId: 'pmc',
      selectedCompany: null,

      selectPallet: (id) => set({ selectedPalletId: id }),
      selectCompany: (name) => set({ selectedCompany: name }),

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
      version: 4,
      migrate: () => {
        // v→4: replace with full defaults (PGA/PLA/ALF/AKH/AAV/P6P/PMC16 added)
        return {
          palletTypes: defaultPallets as PalletType[],
          companies: defaultCompanies as CompanyPallet[],
          selectedPalletId: 'pmc',
          selectedCompany: null,
        };
      },
    }
  )
);

/** Reactive hook that returns the resolved active pallet */
export function useActivePallet(): PalletType | null {
  const palletTypes = usePalletStore((s) => s.palletTypes);
  const selectedPalletId = usePalletStore((s) => s.selectedPalletId);
  const selectedCompany = usePalletStore((s) => s.selectedCompany);
  const companies = usePalletStore((s) => s.companies);

  return useMemo(() => {
    const basePallet = palletTypes.find((p) => p.id === selectedPalletId);
    if (!basePallet) return null;

    if (selectedCompany) {
      const company = companies.find((c) => c.companyName === selectedCompany);
      const customPallet = company?.pallets.find(
        (p) => p.palletTypeId === selectedPalletId
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
  }, [palletTypes, selectedPalletId, selectedCompany, companies]);
}
