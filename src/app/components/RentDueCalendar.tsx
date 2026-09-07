import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BILLING_MONTHS, getCurrentBillingMonth, getCurrentYear } from "../../lib/billing";
import { calendarDueEvents, rentDueDateIso } from "../../lib/rentDue";
import type { BillingRecord } from "../../lib/types";

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export default function RentDueCalendar({
  billingRecords,
  selectedDate,
  onSelectDate,
}: {
  billingRecords: BillingRecord[];
  selectedDate?: string | null;
  onSelectDate?: (iso: string | null) => void;
}) {
  const currentMonth = getCurrentBillingMonth();
  const [month, setMonth] = useState(currentMonth);
  const year = getCurrentYear();
  const monthIndex = BILLING_MONTHS.indexOf(month);
  const events = useMemo(() => calendarDueEvents(billingRecords, year), [billingRecords, year]);
  const dueIso = rentDueDateIso(month, year);
  const count = events.filter((event) => event.date === dueIso).length;
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = daysInMonth(year, monthIndex);

  function shift(delta: number) {
    const next = (monthIndex + delta + 12) % 12;
    setMonth(BILLING_MONTHS[next]);
  }

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{month} {year}</p>
          <p className="text-[11px] text-slate-500">Rent due on the 1st · {count} account{count === 1 ? "" : "s"} this cycle</p>
        </div>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-slate-400 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startWeekday }, (_, i) => <span key={`e-${i}`} />)}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1;
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = events.filter((event) => event.date === iso);
          const overdue = dayEvents.some((event) => event.kind === "overdue");
          const grace = dayEvents.some((event) => event.kind === "grace");
          const selected = selectedDate === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(selected ? null : iso)}
              className={`h-9 rounded-lg text-xs font-semibold ${
                selected ? "bg-slate-900 text-white"
                  : overdue ? "bg-red-100 text-red-800"
                  : grace ? "bg-amber-100 text-amber-800"
                  : dayEvents.length ? "bg-emerald-100 text-emerald-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              title={dayEvents.length ? `${dayEvents.length} rent due` : undefined}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
