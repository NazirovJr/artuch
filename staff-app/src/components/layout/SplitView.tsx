/**
 * SplitView — adaptive master-detail layout.
 *
 * On phones (<600dp): renders only one pane at a time. The parent decides
 * whether the user is looking at the list or the detail (typically by
 * tracking a `selectedId` in local state) and passes that pane in via
 * `mode`. The hidden pane simply isn't rendered.
 *
 * On tablet+ (>=600dp): renders both panes side-by-side. The list gets a
 * fixed sidebar width (`listWidth`), the detail flexes to fill the rest.
 * A vertical divider keeps the boundary visible. If the user hasn't
 * selected anything yet, the detail slot can show an `emptyDetail`
 * placeholder — otherwise we'd just render an empty area.
 *
 * Why a wrapper instead of two routes: the existing `RoomGridScreen` and
 * `RoomDetailScreen` already accept their data via plain props (no
 * `navigation.navigate` inside) — perfect fit for a split layout. We keep
 * the per-platform navigation behaviour in the parent so this component
 * stays purely presentational.
 */
import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { contentMaxWidth } from '../../theme/breakpoints';

export interface SplitViewProps {
  /** Master pane — typically a list/grid screen. */
  list: ReactNode;
  /**
   * Detail pane — typically a detail screen. Pass `null`/`undefined` when
   * nothing is selected; the empty placeholder will be shown on tablet+
   * (or no pane at all on phone, see `mode`).
   */
  detail?: ReactNode;
  /**
   * Phone-only — which pane to render. Tablet+ ignores this and shows both.
   * Default is `'list'` so a fresh navigation lands on the master pane.
   */
  mode?: 'list' | 'detail';
  /** Tablet+ sidebar width in dp. Defaults to 380 — wide enough for grid cards. */
  listWidth?: number;
  /** Shown in the right pane when `detail` is empty (tablet+ only). */
  emptyDetail?: ReactNode;
}

export default function SplitView({
  list,
  detail,
  mode = 'list',
  listWidth = 380,
  emptyDetail,
}: SplitViewProps) {
  const { isTabletOrWider } = useBreakpoint();
  const theme = useTheme();

  if (!isTabletOrWider) {
    // Phone: single-pane stack semantics.
    return <View style={styles.full}>{mode === 'detail' && detail ? detail : list}</View>;
  }

  // Tablet+: side-by-side. List on the left with a divider, detail flexes.
  // On ultra-wide screens (>1400dp) clamp the row so the detail pane doesn't
  // sprawl into a 1500px-wide form. The list stays at `listWidth` either way.
  return (
    <View style={styles.outer}>
      <View style={[styles.row, { maxWidth: contentMaxWidth.grid }]}>
        <View
          style={[
            styles.listPane,
            {
              width: listWidth,
              borderRightColor: theme.colors.outlineVariant,
            },
          ]}
        >
          {list}
        </View>
        <View style={styles.detailPane}>{detail ?? emptyDetail}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  outer: { flex: 1, alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', width: '100%' },
  listPane: { borderRightWidth: 1 },
  detailPane: { flex: 1 },
});
