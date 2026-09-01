import { Smartphone, X } from "lucide-react";
import { isStudentNativeShell, markWelcomeAdSeen } from "../../lib/studentApp";

export function StudentWelcomeAd({
  studentId,
  studentName,
  onDownload,
  onClose,
}: {
  studentId: string;
  studentName: string;
  onDownload?: () => void;
  onClose: () => void;
}) {
  const native = isStudentNativeShell();
  const firstName = studentName.trim().split(/\s+/)[0] || "there";

  function dismiss() {
    markWelcomeAdSeen(studentId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" aria-label="Dismiss ad" onClick={dismiss} />
      <aside className="relative w-full max-w-md max-h-[min(92dvh,40rem)] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="bg-gradient-to-br from-emerald-600 to-slate-900 px-6 pt-6 pb-8 text-white">
          <button type="button" onClick={dismiss} className="absolute top-3 right-3 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">Sponsored · Your boarding house</p>
          <h2 className="mt-3 text-2xl font-bold leading-tight">Welcome back, {firstName}</h2>
          <p className="mt-2 text-sm text-emerald-50/90">Pay on time, report issues the same day, and keep your bed space in good standing — all from your student portal.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Room Revenue Student</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {native
                  ? "You are in the Android app. Rent reminders and maintenance updates stay on this device."
                  : "Install the Android app for a one-tap portal: billing, payments, inbox, and maintenance."}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {!native && (
              <button
                type="button"
                onClick={() => {
                  markWelcomeAdSeen(studentId);
                  onDownload?.();
                  onClose();
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                Get the Android app
              </button>
            )}
            <button type="button" onClick={dismiss} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
              Continue to portal
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
