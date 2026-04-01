export interface Dimensions {
  length: number; // cm (X axis)
  width: number;  // cm (Z axis)
  height: number; // cm (Y axis)
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

// --- Pallet / ULD ---

export type PalletShape = 'pallet' | 'container';

export interface PalletType {
  id: string;
  name: string;        // e.g. "PMC", "AKE", "PAG"
  shape?: PalletShape; // default: 'pallet' (flat base only), 'container' = walls
  dimensions: Dimensions;
  innerDimensions?: { length: number; width: number }; // 내선 (rivet inner line)
  maxWeight: number;   // kg
  description?: string;
}

export interface CompanyPallet {
  companyName: string;
  pallets: {
    palletTypeId: string;
    customDimensions?: Dimensions;
    customInnerDimensions?: { length: number; width: number };
    customMaxWeight?: number;
  }[];
}

// --- Cargo ---

export interface CargoItem {
  id: string;
  label: string;
  dimensions: Dimensions;
  weight: number;      // kg
  quantity: number;
  color: string;
  position: Position;
  rotation: number;    // Y-axis rotation in degrees (0, 90, 180, 270)
  placed: boolean;     // whether placed on pallet
}

// --- Material ---

export type MaterialCategory = 'skid' | 'lumber' | 'spacer' | 'belt' | 'net' | 'other';

export interface MaterialType {
  id: string;
  name: string;
  category: MaterialCategory;
  dimensions: Dimensions;
  color: string;
  description?: string;
}

export interface PlacedMaterial {
  id: string;
  materialTypeId: string;
  position: Position;
  rotation: number;
  attachedCargoIds?: string[]; // for belts: which cargo items it secures
  routePoints?: Position[];    // for belts: ordered 3D points forming the belt path
}

// --- Contour ---

export interface ContourPoint {
  x: number; // distance from center (cm)
  y: number; // height (cm)
}

export interface ContourProfile {
  id: string;
  airline: string;
  aircraftType: string;
  position: string;         // "main-deck" | "lower-deck"
  points: ContourPoint[];   // half-profile (mirrored)
  description?: string;
}

// --- UI State ---

export type SidebarTab = 'pallet' | 'cargo' | 'material' | 'database';

export interface SceneState {
  selectedObjectId: string | null;
  selectedObjectType: 'cargo' | 'material' | null;
  isDragging: boolean;
  showContour: boolean;
  activeContourId: string | null;
}
