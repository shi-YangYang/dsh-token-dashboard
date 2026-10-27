/**
 * Dashboard styles: one calm surface, hairline dividers, and theme tokens only.
 * Artwork colors (sidebar icon) live in the SVG; everything here inherits the
 * host's light/dark theme.
 */

export const CSS = `
.tdb-root,
.tdb-root *,
.tdb-root *::before,
.tdb-root *::after {
  box-sizing: border-box;
}
.tdb-root {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  --tdb-line: var(--dsw-alias-border-l1, #e8eaee);
  --tdb-line-strong: var(--dsw-alias-border-l2, #d9dde3);
  --tdb-ink: var(--dsw-alias-label-primary, #1f2328);
  --tdb-ink-2: var(--dsw-alias-label-secondary, #5c6570);
  --tdb-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --tdb-surface-2: var(--dsw-alias-bg-layer-2, #f5f6f8);
  --tdb-brand: var(--dsw-alias-brand-primary, #4f6ef7);
  --tdb-success: var(--dsw-alias-state-success-primary, #15803d);
  --tdb-warn: var(--dsw-alias-state-warn-primary, #b45309);
  --tdb-error: var(--dsw-alias-state-error-primary, #dc2626);
  --tdb-cat-input: var(--tdb-brand);
  --tdb-cat-output: var(--tdb-success);
  --tdb-cat-cache-read: #a9b8eb;
  --tdb-cat-cache-read: color-mix(in srgb, var(--tdb-brand) 42%, var(--tdb-surface));
  --tdb-cat-cache-write: #b9bec7;
  --tdb-cat-cache-write: color-mix(in srgb, var(--tdb-ink-2) 34%, var(--tdb-surface));
  --tdb-cat-hit: var(--tdb-ink);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--tdb-ink);
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.tdb-scroll {
  flex: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  padding: calc(28px + var(--dsh-frame-top-clearance, 0px)) 0 48px;
}
.tdb-container {
  width: 100%;
  max-width: 1080px;
  min-width: 0;
  margin: 0 auto;
  padding: 0 clamp(16px, 3vw, 32px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tdb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 2px;
}
.tdb-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.tdb-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; margin-left: auto; }

.tdb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--tdb-line-strong);
  background: var(--tdb-surface);
  color: var(--tdb-ink);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.tdb-btn:hover:not(:disabled) { background: var(--tdb-surface-2); }
.tdb-btn:disabled { opacity: 0.5; cursor: default; }
.tdb-btn--ghost { border-color: transparent; background: transparent; }
.tdb-btn--ghost:hover:not(:disabled) { background: var(--tdb-surface-2); }
.tdb-btn--primary {
  background: var(--tdb-brand);
  border-color: var(--tdb-brand);
  color: var(--dsw-alias-bg-base, #ffffff);
}
.tdb-btn--primary:hover:not(:disabled) { background: var(--tdb-brand); filter: brightness(1.04); }
.tdb-btn--icon { width: 30px; padding: 0; }
.tdb-btn svg { display: block; }
.tdb-btn:focus-visible, .tdb-range-btn:focus-visible, .tdb-view-btn:focus-visible,
.tdb-input:focus-visible, .tdb-select:focus-visible, .tdb-row:focus-visible,
.tdb-sort-btn:focus-visible, .tdb-cost-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tdb-brand) 50%, transparent);
  outline-offset: 1px;
}

.tdb-surface {
  background: var(--tdb-surface);
  border: 1px solid var(--tdb-line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px color-mix(in srgb, #000000 4%, transparent);
  min-width: 0;
}
.tdb-rule { height: 1px; background: var(--tdb-line); margin: 0 22px; }

.tdb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.tdb-kpi { padding: 20px 22px; min-width: 0; }
.tdb-kpi + .tdb-kpi { border-left: 1px solid var(--tdb-line); }
.tdb-kpi-label { font-size: 12px; font-weight: 500; color: var(--tdb-ink-2); }
.tdb-kpi-value {
  margin-top: 6px;
  font-size: 30px;
  line-height: 1.1;
  font-weight: 650;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.tdb-kpi-sub { margin-top: 4px; font-size: 12px; color: var(--tdb-ink-2); }

.tdb-section { padding: 20px 22px; min-width: 0; }
.tdb-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.tdb-section-title { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.tdb-section-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; max-width: 100%; }
.tdb-head > *,
.tdb-actions > *,
.tdb-section-head > *,
.tdb-section-actions > *,
.tdb-chart-toolbar > *,
.tdb-filters > *,
.tdb-custom-range > *,
.tdb-cost-row > *,
.tdb-pager > *,
.tdb-drawer-head > *,
.tdb-detail-model-head > *,
.tdb-modal-head > *,
.tdb-modal-foot > * {
  min-width: 0;
}

.tdb-range, .tdb-view { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; max-width: 100%; }
.tdb-range-btn, .tdb-view-btn {
  height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--tdb-ink-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.tdb-range-btn:hover, .tdb-view-btn:hover { color: var(--tdb-ink); background: var(--tdb-surface-2); }
.tdb-range-btn[aria-pressed="true"], .tdb-view-btn[aria-pressed="true"] {
  color: var(--tdb-ink);
  font-weight: 600;
  background: var(--tdb-surface-2);
}

.tdb-chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.tdb-chart-summary { font-size: 12px; color: var(--tdb-ink-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tdb-chart-summary b { color: var(--tdb-ink); font-weight: 600; }

.tdb-custom-range {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0 2px;
}
.tdb-date { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--tdb-ink-2); }

.tdb-input, .tdb-select {
  height: 32px;
  box-sizing: border-box;
  padding: 0 9px;
  border-radius: 8px;
  border: 1px solid var(--tdb-line-strong);
  background: var(--tdb-surface);
  color: var(--tdb-ink);
  font: inherit;
  font-size: 12px;
  min-width: 0;
}
.tdb-input::placeholder { color: var(--tdb-ink-2); opacity: 0.75; }
.tdb-search { position: relative; flex: 1 1 220px; min-width: 160px; }
.tdb-search > svg { position: absolute; left: 10px; top: 9px; color: var(--tdb-ink-2); pointer-events: none; }
.tdb-search .tdb-input { width: 100%; padding-left: 30px; }

.tdb-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.tdb-filters .tdb-select { max-width: 172px; }

.tdb-chart { position: relative; width: 100%; min-width: 0; }
.tdb-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.tdb-axis-text { font-size: 10px; fill: var(--tdb-ink-2); }
.tdb-grid-line { stroke: var(--tdb-line); stroke-width: 1; }
.tdb-axis-line { stroke: var(--tdb-line); stroke-width: 1; }
.tdb-bar--input { fill: var(--tdb-cat-input); }
.tdb-bar--output { fill: var(--tdb-cat-output); }
.tdb-bar--cache-read { fill: var(--tdb-cat-cache-read); }
.tdb-bar--cache-write { fill: var(--tdb-cat-cache-write); }
.tdb-chart--dim .tdb-bar { opacity: 0.38; }
.tdb-chart--dim .tdb-bar--active { opacity: 1; }
.tdb-line-hit { fill: none; stroke: var(--tdb-cat-hit); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.tdb-dot-hit { fill: var(--tdb-cat-hit); stroke: var(--tdb-surface); stroke-width: 1.5; }
.tdb-chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--tdb-ink-2);
  pointer-events: none;
}
.tdb-tooltip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  min-width: 140px;
  max-width: min(230px, calc(100vw - 48px));
  transform: translate(-50%, 0);
  background: var(--dsw-alias-bg-overlay, var(--tdb-surface));
  border: 1px solid var(--tdb-line-strong);
  border-radius: 9px;
  box-shadow: 0 8px 26px color-mix(in srgb, #000000 16%, transparent);
  padding: 8px 10px;
  font-size: 11px;
}
.tdb-tooltip-title { font-weight: 600; margin-bottom: 5px; }
.tdb-tooltip-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 1px 0; color: var(--tdb-ink-2); }
.tdb-tooltip-row b { color: var(--tdb-ink); font-variant-numeric: tabular-nums; font-weight: 600; }
.tdb-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 11px; color: var(--tdb-ink-2); }
.tdb-legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.tdb-legend-dot { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }
.tdb-legend-dot--line { width: 14px; height: 2px; border-radius: 1px; }

.tdb-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; }
.tdb-table { width: 100%; max-width: 100%; border-collapse: collapse; font-size: 12px; }
.tdb-table th {
  padding: 0 12px 8px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--tdb-ink-2);
  border-bottom: 1px solid var(--tdb-line);
  white-space: nowrap;
}
.tdb-table td { padding: 10px 12px; border-bottom: 1px solid var(--tdb-line); vertical-align: middle; overflow-wrap: anywhere; }
.tdb-table tbody tr:last-child td { border-bottom: none; }
.tdb-table tbody tr.tdb-row { cursor: pointer; }
.tdb-table tbody tr.tdb-row:hover { background: var(--tdb-surface-2); }
.tdb-num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tdb-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.tdb-sort-btn:hover { color: var(--tdb-ink); }
.tdb-sort-arrow { font-size: 9px; opacity: 0.7; }
.tdb-num .tdb-sort-btn { margin-left: auto; }

.tdb-model-name { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.tdb-model-provider { font-size: 11px; color: var(--tdb-ink-2); margin-top: 1px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tdb-model-unknown { color: var(--tdb-ink-2); font-style: italic; }

.tdb-share { display: flex; align-items: center; gap: 8px; min-width: 100px; }
.tdb-share-track { flex: 1; height: 4px; border-radius: 2px; background: var(--tdb-surface-2); overflow: hidden; }
.tdb-share-fill { height: 100%; border-radius: 2px; background: var(--tdb-cat-input); }
.tdb-share-text { flex: 0 0 auto; width: 38px; text-align: right; font-size: 11px; color: var(--tdb-ink-2); font-variant-numeric: tabular-nums; }

.tdb-session-cell { min-width: 220px; }
.tdb-session-model { display: block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tdb-nowrap { white-space: nowrap; }
.tdb-session-title { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
.tdb-session-sub { font-size: 11px; color: var(--tdb-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 0 1 auto; max-width: 340px; }
.tdb-session-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.tdb-tag {
  font-size: 10px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--tdb-surface-2);
  color: var(--tdb-ink-2);
  white-space: nowrap;
}
.tdb-tag--live { color: var(--tdb-success); background: color-mix(in srgb, var(--tdb-success) 10%, transparent); }
.tdb-tag--sub { color: var(--tdb-brand); background: color-mix(in srgb, var(--tdb-brand) 10%, transparent); }
.tdb-tag--stale { color: var(--tdb-warn); background: color-mix(in srgb, var(--tdb-warn) 10%, transparent); }

.tdb-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 11px;
  color: var(--tdb-ink-2);
}
.tdb-pager-actions { display: flex; align-items: center; gap: 4px; }

.tdb-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--tdb-surface-2);
  color: var(--tdb-ink-2);
}
.tdb-notice > * { min-width: 0; }
.tdb-notice svg { flex: 0 0 auto; margin-top: 1px; }
.tdb-notice--warn { color: var(--tdb-warn); background: color-mix(in srgb, var(--tdb-warn) 8%, transparent); }
.tdb-notice--error { color: var(--tdb-error); background: color-mix(in srgb, var(--tdb-error) 8%, transparent); }
.tdb-notice-actions { margin-left: auto; }

.tdb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 40px 16px;
  text-align: center;
  color: var(--tdb-ink-2);
  font-size: 13px;
}
.tdb-empty svg { opacity: 0.55; }

.tdb-skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--tdb-surface-2) 25%, var(--tdb-line) 50%, var(--tdb-surface-2) 75%);
  background-size: 200% 100%;
  animation: tdb-shimmer 1.4s linear infinite;
}
.tdb-skeleton--chart { height: 260px; }
.tdb-skeleton--table { height: 180px; }

.tdb-cost { border-top: 1px solid var(--tdb-line); }
.tdb-cost-row {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 4px;
  gap: 10px;
  padding: 14px 22px;
  border: 0;
  background: none;
  color: var(--tdb-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.tdb-cost-row:hover { background: var(--tdb-surface-2); }
.tdb-cost-title { font-size: 13px; font-weight: 600; }
.tdb-cost-hint { font-size: 12px; color: var(--tdb-ink-2); }
.tdb-cost-total { margin-left: auto; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tdb-cost-chevron { color: var(--tdb-ink-2); display: inline-flex; flex: 0 0 auto; }
.tdb-cost-body { padding: 0 22px 18px; display: flex; flex-direction: column; gap: 10px; }
.tdb-cost-note { font-size: 11px; color: var(--tdb-ink-2); }
.tdb-cost-actions { display: flex; justify-content: flex-end; }

.tdb-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, #000000 40%, transparent);
}
.tdb-modal {
  width: min(720px, 100%);
  max-height: min(86vh, 900px);
  display: flex;
  flex-direction: column;
  background: var(--tdb-surface);
  color: var(--tdb-ink);
  border: 1px solid var(--tdb-line-strong);
  border-radius: 16px;
  box-shadow: 0 24px 60px color-mix(in srgb, #000000 30%, transparent);
  overflow: hidden;
}
.tdb-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--tdb-line);
}
.tdb-modal-head > div:first-child { flex: 1 1 auto; min-width: 0; }
.tdb-modal-title { margin: 0; font-size: 16px; font-weight: 640; }
.tdb-modal-sub { margin: 3px 0 0; font-size: 12px; color: var(--tdb-ink-2); overflow-wrap: anywhere; }
.tdb-modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.tdb-modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--tdb-line);
}

.tdb-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  justify-content: flex-end;
  background: color-mix(in srgb, #000000 34%, transparent);
}
.tdb-drawer {
  width: min(460px, 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tdb-surface);
  border-left: 1px solid var(--tdb-line);
  box-shadow: -12px 0 40px color-mix(in srgb, #000000 16%, transparent);
  animation: tdb-slide-in 160ms ease-out;
}
.tdb-drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--tdb-line);
}
.tdb-drawer-title { margin: 0; font-size: 17px; line-height: 1.35; font-weight: 640; overflow-wrap: anywhere; }
.tdb-drawer-sub { margin: 4px 0 0; font-size: 12px; color: var(--tdb-ink-2); overflow-wrap: anywhere; }
.tdb-drawer-body { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 20px; }
.tdb-drawer-foot { padding: 14px 22px; border-top: 1px solid var(--tdb-line); display: flex; justify-content: flex-end; }

.tdb-detail-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tdb-detail-stat { padding: 12px 14px; border-radius: 10px; background: var(--tdb-surface-2); min-width: 0; }
.tdb-detail-stat--total { grid-column: 1 / -1; padding: 16px 18px; }
.tdb-detail-label { font-size: 11px; color: var(--tdb-ink-2); }
.tdb-detail-value { margin-top: 2px; font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.tdb-detail-stat--total .tdb-detail-value { font-size: 28px; }
.tdb-detail-value--small { font-size: 14px; font-weight: 500; }

.tdb-detail-models { display: flex; flex-direction: column; }
.tdb-detail-model { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-bottom: 1px solid var(--tdb-line); }
.tdb-detail-model:last-child { border-bottom: none; padding-bottom: 0; }
.tdb-detail-model-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.tdb-detail-model-total { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tdb-detail-model-meta { font-size: 11px; color: var(--tdb-ink-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

.tdb-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; }
.tdb-field { min-width: 0; }
.tdb-field-label { font-size: 11px; color: var(--tdb-ink-2); }
.tdb-field-value { margin-top: 2px; font-size: 12.5px; word-break: break-word; overflow-wrap: anywhere; }

.tdb-menu-anchor { position: relative; }
.tdb-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  min-width: 170px;
  max-width: calc(100vw - 24px);
  padding: 4px;
  background: var(--dsw-alias-bg-overlay, var(--tdb-surface));
  border: 1px solid var(--tdb-line-strong);
  border-radius: 10px;
  box-shadow: 0 10px 30px color-mix(in srgb, #000000 18%, transparent);
}
.tdb-menu-item {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--tdb-ink);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.tdb-menu-item:hover { background: var(--tdb-surface-2); }

.tdb-pricing-wrap { overflow-x: auto; }
.tdb-pricing-grid {
  display: grid;
  grid-template-columns: 1.6fr 0.7fr repeat(4, minmax(0, 0.6fr));
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.tdb-pricing-head { font-size: 11px; color: var(--tdb-ink-2); font-weight: 500; padding-bottom: 2px; overflow-wrap: anywhere; }
.tdb-pricing-model { min-width: 0; }
.tdb-pricing-input, .tdb-pricing-currency { width: 100%; height: 30px; min-width: 0; }
.tdb-pricing-input.tdb-pricing-row-error { border-color: var(--tdb-error); }
.tdb-error-text { color: var(--tdb-error); font-size: 11px; }
.tdb-hint { font-size: 11px; color: var(--tdb-ink-2); }

.tdb-nav-icon { display: block; color: currentColor; }

@keyframes tdb-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes tdb-spin { to { transform: rotate(360deg); } }
.tdb-spin { display: inline-flex; animation: tdb-spin 900ms linear infinite; }
@keyframes tdb-slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .tdb-skeleton { animation: none; }
  .tdb-drawer { animation: none; }
  .tdb-spin { animation: none; }
  .tdb-btn { transition: none; }
}

@media (max-width: 1020px) {
  .tdb-hide-md { display: none; }
}
@media (max-width: 880px) {
  .tdb-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tdb-kpi:nth-child(odd) { border-left: 0; }
  .tdb-kpi:nth-child(n + 3) { border-top: 1px solid var(--tdb-line); }
  .tdb-kpi:nth-child(4) { border-left: 1px solid var(--tdb-line); }
}
@media (max-width: 860px) {
  .tdb-hide-sm { display: none; }
}
@media (max-width: 760px) {
  .tdb-session-title, .tdb-session-sub { max-width: 240px; }
}
@media (max-width: 620px) {
  .tdb-container { gap: 14px; }
  .tdb-table th, .tdb-table td { padding-left: 8px; padding-right: 8px; }
  .tdb-table .tdb-model-name, .tdb-table .tdb-model-provider { max-width: 120px; }
  .tdb-session-cell { min-width: 140px; }
  .tdb-modal-backdrop { padding: 12px; }
  .tdb-modal-head { padding: 16px 14px 12px; }
  .tdb-modal-body { padding: 14px; }
  .tdb-modal-foot { padding: 12px 14px; }
  .tdb-pricing-input, .tdb-pricing-currency { padding-left: 6px; padding-right: 6px; }
  .tdb-kpis { grid-template-columns: minmax(0, 1fr); }
  .tdb-kpi { border-left: 0 !important; }
  .tdb-kpi + .tdb-kpi { border-top: 1px solid var(--tdb-line); }
  .tdb-kpi { padding: 16px 18px; }
  .tdb-kpi-value { font-size: 26px; }
  .tdb-section { padding: 16px 18px; }
  .tdb-rule { margin: 0 18px; }
  .tdb-head { align-items: flex-start; }
  .tdb-title { font-size: 20px; }
  .tdb-cost-row { padding: 13px 18px; }
  .tdb-cost-body { padding: 0 18px 16px; }
  .tdb-drawer-head, .tdb-drawer-body, .tdb-drawer-foot { padding-left: 18px; padding-right: 18px; }
  .tdb-fields { grid-template-columns: minmax(0, 1fr); }
  .tdb-session-title, .tdb-session-sub { max-width: 140px; }
  .tdb-pricing-grid { min-width: 0; grid-template-columns: 1.5fr 0.7fr repeat(2, minmax(0, 0.6fr)); }
  .tdb-pricing-head--extra, .tdb-pricing-cell--extra { display: none; }
}
@media (max-width: 360px) {
  .tdb-session-cell { min-width: 100px; }
  .tdb-session-title, .tdb-session-sub { max-width: 100px; }
  .tdb-table .tdb-model-name, .tdb-table .tdb-model-provider { max-width: 100px; }
  .tdb-table th, .tdb-table td { padding-left: 6px; padding-right: 6px; }
}
`

/**
 * Sidebar-footer entry styles. This seat lives outside `.tdb-root`, so it uses
 * the host's tokens directly. The `:has` rule lets the footer's full-width
 * Cordis action and this entry stack instead of competing for one row.
 */
export const FOOTER_CSS = `
div:has(> .tdb-footer-action) {
  flex-wrap: wrap;
}
.tdb-footer-action {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  flex: none;
  margin: 8px 0 0;
  padding: 0 10px 0 8px;
  border: none;
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.tdb-footer-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2, #f5f6f8));
}
.tdb-footer-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4f6ef7) 55%, transparent);
  outline-offset: 1px;
}
.tdb-footer-action--rail {
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  justify-content: center;
  gap: 0;
  border-radius: 50%;
}
.tdb-footer-action-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .tdb-footer-action { transition: none; }
}
`
