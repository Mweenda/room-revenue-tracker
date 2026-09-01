/** Scroll distance over which the large title fully tucks under the pinned bar. */
export const STUDENT_HEADER_COLLAPSE_RANGE_PX = 72;

export function headerCollapseProgress(scrollTop: number, range = STUDENT_HEADER_COLLAPSE_RANGE_PX): number {
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) return 0;
  if (scrollTop >= range) return 1;
  return scrollTop / range;
}

export function compactTitleVisible(progress: number, threshold = 0.55): boolean {
  return progress >= threshold;
}
