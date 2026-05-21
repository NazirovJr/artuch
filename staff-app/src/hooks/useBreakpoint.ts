/**
 * useBreakpoint — reactive breakpoint resolver.
 *
 * Built on `useWindowDimensions` (not `Dimensions.get`) so the value updates
 * automatically when the user rotates the device, splits the screen on
 * iPad, or resizes the browser window on web. Static `Dimensions.get`
 * captures the size *at module evaluation time* and never changes — this
 * is the bug we hit in KitchenScreen's column-width math.
 *
 * Returns convenience flags so call-sites stay readable:
 *   const { bp, isPhone, isTabletOrWider } = useBreakpoint();
 *   const cols = isPhone ? 2 : 3;
 */
import { useWindowDimensions } from 'react-native';
import { breakpoints, type Breakpoint } from '../theme/breakpoints';

export interface BreakpointState {
  /** Current breakpoint key — derived from window width. */
  bp: Breakpoint;
  /** Live window width in dp. */
  width: number;
  /** Live window height in dp. */
  height: number;
  /** True when width < 600 (phones in any orientation that fits this). */
  isPhone: boolean;
  /** True when width >= 600 — covers tablet portrait and wider. */
  isTabletOrWider: boolean;
  /** True when width >= 840 — covers tablet landscape, desktop, web. */
  isDesktopOrWider: boolean;
  /** True when width >= 1200 — large desktop / FullHD web. */
  isWide: boolean;
  /** True when width > height. Useful for kitchen-style kanban switches. */
  isLandscape: boolean;
}

export function useBreakpoint(): BreakpointState {
  const { width, height } = useWindowDimensions();

  let bp: Breakpoint = 'phone';
  if (width >= breakpoints.wide) bp = 'wide';
  else if (width >= breakpoints.desktop) bp = 'desktop';
  else if (width >= breakpoints.tablet) bp = 'tablet';

  return {
    bp,
    width,
    height,
    isPhone: bp === 'phone',
    isTabletOrWider: width >= breakpoints.tablet,
    isDesktopOrWider: width >= breakpoints.desktop,
    isWide: bp === 'wide',
    isLandscape: width > height,
  };
}
