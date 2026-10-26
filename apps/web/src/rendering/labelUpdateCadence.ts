const DEFAULT_LABEL_UPDATE_INTERVAL_MS = 1000 / 30;

export type LabelUpdateView = {
  camera: unknown;
  firstPersonActive: boolean;
  viewportWidth: number;
  viewportHeight: number;
};

/** Caps projection work while immediately accepting view-mode and viewport changes. */
export function createLabelUpdateGate(intervalMs = DEFAULT_LABEL_UPDATE_INTERVAL_MS) {
  let lastUpdateAt = Number.NEGATIVE_INFINITY;
  let lastView: LabelUpdateView | null = null;

  return (now: number, view: LabelUpdateView): boolean => {
    const viewChanged = !lastView
      || view.camera !== lastView.camera
      || view.firstPersonActive !== lastView.firstPersonActive
      || view.viewportWidth !== lastView.viewportWidth
      || view.viewportHeight !== lastView.viewportHeight;
    if (!viewChanged && now >= lastUpdateAt && now - lastUpdateAt < intervalMs) return false;
    lastUpdateAt = now;
    lastView = { ...view };
    return true;
  };
}
