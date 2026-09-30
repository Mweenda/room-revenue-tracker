/** Delay before the hover rail shrinks, so the cursor can leave a gap without flicker. */
export const LANDLORD_RAIL_COLLAPSE_MS = 180;

export const LANDLORD_RAIL_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

/** Icon rail on desktop only when the pointer can hover; touch / always-on layouts stay expanded. */
export function landlordRailCompact(pointerCanHover: boolean, hoverExpanded: boolean): boolean {
  return pointerCanHover && !hoverExpanded;
}

/** Keep the main column offset in sync with the rail so tiles stay clickable. */
export function landlordRailSpacerClass(compact: boolean): string {
  return compact ? "w-[4.5rem]" : "w-64";
}
