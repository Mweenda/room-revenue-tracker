export type StudentViewport = {
  width: number;
  height: number;
  /** Width divided by height. Portrait phones are typically below 0.7. */
  aspect: number;
  short: boolean;
  wide: boolean;
  /** Landscape phones and squat windows: shrink chrome so content stays reachable. */
  compactChrome: boolean;
  /** Wide-and-short screens: move the tab bar to a side rail. */
  sideNav: boolean;
};

export function studentViewportFromSize(width: number, height: number): StudentViewport {
  const w = Math.max(0, width);
  const h = Math.max(1, height);
  const aspect = w / h;
  const short = h < 560 || aspect >= 1.2;
  const wide = w >= 768 && h >= 600;
  const compactChrome = short && !wide;
  return {
    width: w,
    height: h,
    aspect,
    short,
    wide,
    compactChrome,
    sideNav: compactChrome && aspect >= 1.2,
  };
}

export function readStudentViewportSize(
  win: Pick<Window, "innerWidth" | "innerHeight" | "visualViewport"> | null = typeof window === "undefined" ? null : window,
): { width: number; height: number } {
  if (!win) return { width: 390, height: 844 };
  const viewport = win.visualViewport;
  return {
    width: viewport?.width || win.innerWidth,
    height: viewport?.height || win.innerHeight,
  };
}
