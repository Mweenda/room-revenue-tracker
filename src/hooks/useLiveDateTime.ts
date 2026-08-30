import { useEffect, useState } from "react";

export function formatHeaderDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Re-renders every minute so header clocks stay current. */
export function useLiveDateTime(updateMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), updateMs);
    return () => window.clearInterval(id);
  }, [updateMs]);

  return now;
}
