import type { ContourProfile, CargoItem } from '../types';
import { getCargoAABB } from './snapping';

export interface ContourViolation {
  cargoId: string;
  exceedAmount: number; // cm over the contour
  atX: number;
  atY: number;
}

/**
 * Check if any cargo exceeds the contour profile.
 * Contour points define a half-profile from center (x=0) outward.
 * The profile is mirrored for the other side.
 */
export function checkContourViolations(
  cargos: CargoItem[],
  contour: ContourProfile
): ContourViolation[] {
  const violations: ContourViolation[] = [];

  for (const cargo of cargos) {
    if (!cargo.placed) continue;
    const aabb = getCargoAABB(cargo);

    // Check both sides of the cargo (left and right edges)
    const edgeX = Math.max(Math.abs(aabb.minX), Math.abs(aabb.maxX));
    const topY = aabb.maxY;

    const maxAllowedHeight = getContourHeightAtX(contour, edgeX);

    if (topY > maxAllowedHeight) {
      violations.push({
        cargoId: cargo.id,
        exceedAmount: topY - maxAllowedHeight,
        atX: edgeX,
        atY: topY,
      });
    }
  }

  return violations;
}

/**
 * Get the maximum allowed height at a given X distance from center.
 * Interpolates between contour points.
 */
export function getContourHeightAtX(contour: ContourProfile, x: number): number {
  const points = contour.points;
  if (points.length === 0) return Infinity;

  // If x is before first point, return first point height
  if (x <= points[0].x) return points[0].y;

  // If x is beyond last point, return 0 (outside fuselage)
  if (x >= points[points.length - 1].x) return 0;

  // Interpolate
  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i].x && x <= points[i + 1].x) {
      const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
      return points[i].y + t * (points[i + 1].y - points[i].y);
    }
  }

  return 0;
}

/**
 * Generate contour line points for 3D rendering.
 * Returns an array of [x, y] points for the full cross-section profile.
 */
export function generateContourLinePoints(
  contour: ContourProfile,
  steps: number = 50
): [number, number][] {
  const points = contour.points;
  if (points.length === 0) return [];

  const maxX = points[points.length - 1].x;
  const result: [number, number][] = [];

  // Right side (positive X)
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * maxX;
    const y = getContourHeightAtX(contour, x);
    result.push([x, y]);
  }

  // Left side (negative X) - mirror
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * maxX;
    const y = getContourHeightAtX(contour, x);
    result.push([-x, y]);
  }

  return result;
}
