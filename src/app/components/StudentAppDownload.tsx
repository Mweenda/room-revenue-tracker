import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { SectionCard } from "./primitives";
import { createStudentApkDownload, isStudentNativeShell, type StudentAppDownload } from "../../lib/studentApp";

export function StudentAppDownloadCard() {
  const [status, setStatus] = useState<StudentAppDownload | { available: false; reason: "loading" }>({ available: false, reason: "loading" });
  const native = isStudentNativeShell();

  useEffect(() => {
    let active = true;
    void createStudentApkDownload().then((next) => {
      if (active) setStatus(next);
    });
    return () => { active = false; };
  }, []);

  async function download() {
    const next = await createStudentApkDownload();
    setStatus(next);
    if (!next.available) return;
    const link = document.createElement("a");
    link.href = next.url;
    link.download = next.fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <SectionCard title="Android app">
      <div className="p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Room Revenue Student</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {native
              ? "This device is already running the student app."
              : "Download the official APK for Android. Only signed-in students can fetch it from your boarding-house storage."}
          </p>
          {!native && status.available === false && status.reason === "missing" && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">The APK is not in the student-apps bucket yet. Ask your landlord to publish the latest build.</p>
          )}
          {!native && status.available === false && status.reason === "unauthorized" && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">Sign in again to download the app.</p>
          )}
          {!native && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={!status.available}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              <Download size={15} />
              {status.available ? "Download APK" : status.reason === "loading" ? "Checking…" : "APK unavailable"}
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
