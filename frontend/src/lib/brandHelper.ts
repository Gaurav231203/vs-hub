import { BrandInfo } from '../stores/authStore.js';

/**
 * Normalizes a brand name or identifier into a canonical key.
 * e.g., "Starlight Bakery" -> "starlight", "b_hh" -> "hollow", "Hollow Home" -> "hollow"
 */
export function getBrandCanonicalSlug(nameOrId: string): string {
  const s = (nameOrId || '').toLowerCase().trim();
  if (s.includes('starlight') || s.includes('bakery') || s === 'b_sb') return 'starlight';
  if (s.includes('hollow') || s === 'b_hh') return 'hollow';
  if (s.includes('vantage') || s === 'b_vg') return 'vantage';
  if (s.includes('acme') || s === 'b_acme') return 'acme';
  if (s.includes('nexus') || s === 'b_nt') return 'nexus';
  if (s.includes('zenith') || s === 'b_zf') return 'zenith';
  if (s.includes('ember') || s === 'b_eo') return 'ember';
  if (s.includes('wild') || s.includes('botanics') || s === 'b_wb') return 'wild';
  if (s.includes('north') || s === 'b_ns') return 'north';
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Resolves the currently active brand from selectedBrandId.
 * Returns null if 'all' or empty.
 */
export function getActiveBrand(selectedBrandId: string | undefined | null, brands: BrandInfo[]): BrandInfo | null {
  if (!selectedBrandId || selectedBrandId === 'all') return null;

  // 1. Direct match by id
  const direct = brands.find((b) => b.id === selectedBrandId);
  if (direct) return direct;

  // 2. Canonical slug match
  const selectedSlug = getBrandCanonicalSlug(selectedBrandId);
  const bySlug = brands.find((b) => getBrandCanonicalSlug(b.id) === selectedSlug || getBrandCanonicalSlug(b.name) === selectedSlug);
  if (bySlug) return bySlug;

  // 3. Fallback name includes
  const sLower = selectedBrandId.toLowerCase();
  const byName = brands.find((b) => b.name.toLowerCase().includes(sLower) || sLower.includes(b.name.toLowerCase()));
  if (byName) return byName;

  return null;
}

/**
 * Checks whether an item's brand identifier matches the selectedBrandId.
 * Always returns true if selectedBrandId is 'all' or falsy.
 */
export function matchesBrand(
  itemBrandId: string | undefined | null,
  selectedBrandId: string | undefined | null,
  brands: BrandInfo[] = []
): boolean {
  if (!selectedBrandId || selectedBrandId === 'all') return true;
  if (!itemBrandId) return true;

  // Exact match
  if (itemBrandId === selectedBrandId) return true;

  const itemSlug = getBrandCanonicalSlug(itemBrandId);
  const selectedSlug = getBrandCanonicalSlug(selectedBrandId);

  if (itemSlug && selectedSlug && itemSlug === selectedSlug) {
    return true;
  }

  // Check against active brand if exists
  const active = getActiveBrand(selectedBrandId, brands);
  if (active) {
    if (itemBrandId === active.id) return true;
    const activeSlug = getBrandCanonicalSlug(active.name);
    if (itemSlug === activeSlug) return true;
  }

  return false;
}
