import { ArrowLeft, Bell, Building2, CheckCircle, ChevronRight, AlertTriangle, Wrench, TrendingUp } from "lucide-react";
import {
  NOTIFICATION_SENDER,
  formatInboxTime,
  formatMessageTimestamp,
  type StudentNotification,
  type StudentNotificationKind,
} from "../../lib/studentNotifications";

const KIND_ICON: Record<StudentNotificationKind, typeof Bell> = {
  welcome: Building2,
  payment_approved: CheckCircle,
  payment_rejected: AlertTriangle,
  rent_due: Bell,
  maintenance_update: Wrench,
  rent_increase: TrendingUp,
  house: Building2,
};

const KIND_TONE: Record<StudentNotificationKind, string> = {
  welcome: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  payment_approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  payment_rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  rent_due: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  maintenance_update: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  rent_increase: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200",
  house: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function StudentNotificationsView({
  items,
  selected,
  loading,
  onOpen,
  onBack,
}: {
  items: StudentNotification[];
  selected: StudentNotification | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  if (selected) {
    const Icon = KIND_ICON[selected.kind];
    return (
      <div className="max-w-2xl mx-auto pb-2">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> Inbox
        </button>
        <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${KIND_TONE[selected.kind]}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{NOTIFICATION_SENDER}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatMessageTimestamp(selected.createdAt)}</p>
            </div>
          </div>
          <div className="px-5 py-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selected.title}</h2>
            <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {selected.body}
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-2">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Loading messages…</p>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Bell size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No messages yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rent reminders, maintenance updates, and house notices will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              const unread = !item.readAt;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors duration-150 ${
                      unread
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${KIND_TONE[item.kind]}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm truncate ${unread ? "font-bold text-slate-900 dark:text-slate-50" : "font-semibold text-slate-800 dark:text-slate-200"}`}>
                          {NOTIFICATION_SENDER}
                        </p>
                        <span className="text-[11px] text-slate-400 shrink-0">{formatInboxTime(item.createdAt)}</span>
                      </div>
                      <p className={`text-sm mt-0.5 truncate ${unread ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.preview}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                      {unread && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-label="Unread" />}
                      <ChevronRight size={15} className="text-slate-300 dark:text-slate-600" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
