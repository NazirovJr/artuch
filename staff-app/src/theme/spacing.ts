/** Consistent spacing scale (4px grid) — Mountain Dawn */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  // extended steps for hero sections / wide layouts
  s8: 40,
  s9: 48,
  s10: 64,
  s11: 80,
  s12: 96,
} as const;

/** Border radius tokens */
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
} as const;

/**
 * Elevation/shadow ladder — 5 soft, primary-tinted levels (Mountain Dawn).
 * sm/md/lg kept for back-compat; xl/xxl added for overlays & modals.
 * Shadow color is graphite-blue (#1B2433) to match the warm-snow surfaces.
 */
const SHADOW_INK = '#1B2433';
export const shadows = {
  sm: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
  xl: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.22,
    shadowRadius: 48,
    elevation: 12,
  },
  xxl: {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.28,
    shadowRadius: 64,
    elevation: 24,
  },
} as const;
