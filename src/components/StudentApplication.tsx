import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  CheckCircle,
  FileText,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { submitStudentApplication } from "../lib/api";
import type { RoomGender } from "../lib/types";

interface StudentApplicationProps {
  onBack: () => void;
  onGoToLogin: () => void;
  /** In the student portal / APK shell there is no landlord entry point to return to. */
  hideBack?: boolean;
}

export function StudentApplication({ onBack, onGoToLogin, hideBack = false }: StudentApplicationProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nrc, setNrc] = useState("");
  const [gender, setGender] = useState<RoomGender | "">("");
  const [preferredMoveInDate, setPreferredMoveInDate] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter the email you want the landlord to reach you on.");
      return;
    }
    setLoading(true);
    try {
      await submitStudentApplication({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        nrc: nrc.trim() || undefined,
        gender: gender || null,
        preferredMoveInDate: preferredMoveInDate || undefined,
        note: note.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your application. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="min-h-dvh h-dvh max-h-dvh overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-3 sm:p-4 relative">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 border border-white/20 relative z-10 my-auto max-h-[min(100%,100dvh)] overflow-y-auto">
        {!hideBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={30} className="text-emerald-300" />
            </div>
            <h1 className="text-2xl font-bold text-white">Application received</h1>
            <p className="text-slate-300 text-sm mt-3 leading-relaxed">
              Thanks, {fullName.trim() || "there"}. The landlord has been notified of your request. If a bed space is
              assigned to you, we'll email <span className="font-semibold text-white">{email.trim()}</span> an invite to
              set your password and complete move-in.
            </p>
            <button
              onClick={onGoToLogin}
              className="mt-6 w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                <BedDouble size={30} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Apply for a bed space</h1>
              <p className="text-slate-300 text-sm mt-2">
                New here? Send the landlord your details. They'll assign you a bed and email you an invite.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl mb-4 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Banda"
                    className={`${fieldClass} pl-10`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    autoComplete="email"
                    className={`${fieldClass} pl-10`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0977 000 000"
                      className={`${fieldClass} pl-10`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">NRC (optional)</label>
                  <input
                    type="text"
                    value={nrc}
                    onChange={(e) => setNrc(e.target.value)}
                    placeholder="000000/00/0"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Male", "Female"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGender(value)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          gender === value
                            ? "bg-blue-500 text-white border-blue-400"
                            : "bg-white/5 text-slate-200 border-white/15 hover:bg-white/10"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Preferred move-in</label>
                  <input
                    type="date"
                    value={preferredMoveInDate}
                    onChange={(e) => setPreferredMoveInDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Anything else? (optional)</label>
                <div className="relative">
                  <FileText size={18} className="absolute left-3 top-3 text-slate-400" />
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="e.g. Which block you prefer, or when you can view a room."
                    className={`${fieldClass} pl-10 resize-none`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
              >
                {loading ? "Sending application…" : "Send application"}
              </button>

              <button
                type="button"
                onClick={onGoToLogin}
                className="w-full text-slate-300 hover:text-white py-1 text-sm font-medium transition-colors"
              >
                Already have an account? Sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default StudentApplication;
