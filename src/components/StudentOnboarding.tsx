import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Shield, User, BedDouble, FileText, KeyRound, CheckCircle } from "lucide-react";
import { completeStudentOnboarding, listVacantBedsForOnboarding } from "../lib/api/tenants";
import { fetchAuthenticatedStudent, linkTenantToAuthUser } from "../lib/auth";
import { getSupabase } from "../lib/supabase";
import { studentShellLocation } from "../lib/studentApp";
import { formatBedOption } from "../lib/students";
import {
  nextOnboardingStep,
  validateStudentOnboarding,
  type OnboardingStep,
} from "../lib/studentOnboarding";
import type { BedSpace, RoomGender } from "../lib/types";

const STEPS: { id: Exclude<OnboardingStep, "done">; label: string; icon: typeof User }[] = [
  { id: "gender", label: "Gender", icon: User },
  { id: "bed", label: "Bed space", icon: BedDouble },
  { id: "profile", label: "Details", icon: FileText },
  { id: "password", label: "Password", icon: KeyRound },
];

export default function StudentOnboarding({
  onLoginSuccess,
  assignedBedId,
}: {
  onLoginSuccess: (user: Awaited<ReturnType<typeof fetchAuthenticatedStudent>>) => void;
  assignedBedId?: string | null;
}) {
  const [step, setStep] = useState<OnboardingStep>("gender");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<RoomGender | null>(null);
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [bedId, setBedId] = useState(assignedBedId ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nrc, setNrc] = useState("");
  const [moveInDate, setMoveInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setError("Account verification is unavailable because Supabase is not configured.");
      return;
    }

    const client = sb;
    let active = true;

    async function establishSession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const tokenHash = params.get("token_hash") ?? hashParams.get("token_hash");
      const otpType = (params.get("type") ?? hashParams.get("type") ?? "invite") as
        | "invite"
        | "recovery"
        | "email"
        | "magiclink"
        | "signup";

      if (tokenHash) {
        const { error: otpError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
        if (otpError) {
          if (active) setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
          return;
        }
      } else {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            if (active) setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
            return;
          }
          window.history.replaceState({}, "", studentShellLocation(window.location.pathname, window.location.search, { auth: "student-confirm" }));
        }
      }

      const { data, error: userError } = await client.auth.getUser();
      if (!active) return;
      if (userError || !data.user?.email) {
        setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
        return;
      }
      setEmail(data.user.email);
      const metaName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "";
      if (metaName) setName(metaName);
      const linked = await fetchAuthenticatedStudent().catch(() => null);
      if (linked) {
        setName(linked.name || metaName);
        setPhone(linked.phone && linked.phone !== "-" ? linked.phone : "");
        setNrc(linked.nrc && linked.nrc !== "-" ? linked.nrc : "");
        if (linked.moveInDate && linked.moveInDate !== "-") setMoveInDate(linked.moveInDate);
        if (linked.bedSpaceId) setBedId(linked.bedSpaceId);
      }
    }

    void establishSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!gender) return;
    let active = true;
    setLoadingBeds(true);
    void listVacantBedsForOnboarding(gender)
      .then((rows) => {
        if (!active) return;
        setBeds(rows);
        setBedId((current) => {
          if (current && rows.some((bed) => bed.id === current)) return current;
          return rows[0]?.id ?? "";
        });
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load vacant beds");
      })
      .finally(() => {
        if (active) setLoadingBeds(false);
      });
    return () => { active = false; };
  }, [gender]);

  const selectedBed = useMemo(() => beds.find((bed) => bed.id === bedId), [beds, bedId]);

  async function goNext(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    const result = validateStudentOnboarding({
      step,
      gender,
      bedId,
      beds,
      assignedBedId: assignedBedId ?? bedId,
      name,
      phone,
      nrc,
      moveInDate,
      password,
      confirmPassword,
    });
    if (!result.ok) {
      setError(result.error ?? "Please complete this step.");
      return;
    }

    const next = nextOnboardingStep(step);
    if (next !== "done") {
      setStep(next);
      return;
    }

    const sb = getSupabase();
    if (!sb || !gender) return;
    setSaving(true);
    try {
      const { error: updateError } = await sb.auth.updateUser({ password });
      if (updateError) throw updateError;
      await completeStudentOnboarding({
        gender,
        bedId,
        name,
        phone,
        nrc: nrc || "-",
        moveInDate,
      });
      const linked = await fetchAuthenticatedStudent() ?? await linkTenantToAuthUser(email);
      if (!linked) throw new Error("Account created, but your tenant profile could not be loaded. Sign in again.");
      window.history.replaceState({}, "", studentShellLocation(window.location.pathname, window.location.search, { auth: null }, true));
      onLoginSuccess(linked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 border border-white/20">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set up your student account</h1>
          <p className="text-slate-300 text-sm mt-2">
            {email ? `Signed in as ${email}` : "Confirming your invite link…"}
          </p>
        </div>

        <ol className="grid grid-cols-4 gap-2 mb-6">
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = STEPS.findIndex((row) => row.id === step) > STEPS.findIndex((row) => row.id === item.id);
            return (
              <li key={item.id} className={`rounded-xl px-2 py-2 text-center text-[11px] font-semibold ${active ? "bg-blue-500 text-white" : done ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-slate-400"}`}>
                <item.icon size={14} className="mx-auto mb-1" />
                {item.label}
              </li>
            );
          })}
        </ol>

        {error && <p className="bg-red-500/20 border border-red-500/30 text-red-100 rounded-xl px-4 py-3 text-sm mb-4">{error}</p>}

        <form onSubmit={(e) => void goNext(e)} className="space-y-4">
          {step === "gender" && (
            <div className="grid grid-cols-2 gap-3">
              {(["Male", "Female"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`rounded-2xl border px-4 py-6 font-semibold transition-colors ${gender === value ? "bg-blue-500 text-white border-blue-400" : "bg-white/5 text-slate-200 border-white/15 hover:bg-white/10"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          {step === "bed" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">Vacant {gender?.toLowerCase()} bed spaces on this property.</p>
              {loadingBeds && <p className="text-sm text-slate-400">Loading beds…</p>}
              {!loadingBeds && beds.length === 0 && (
                <p className="text-sm text-amber-100 bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-3">
                  No vacant {gender?.toLowerCase()} beds are available. Ask your landlord to free a bed or send a new invite.
                </p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {beds.map((bed) => (
                  <label key={bed.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer ${bedId === bed.id ? "border-blue-400 bg-blue-500/20" : "border-white/15 bg-white/5"}`}>
                    <span>
                      <span className="block text-white font-semibold">{formatBedOption(bed)}</span>
                      <span className="text-xs text-slate-400">{bed.roomGender} · K{bed.rentAmount}</span>
                    </span>
                    <input type="radio" name="bed" checked={bedId === bed.id} onChange={() => setBedId(bed.id)} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === "profile" && (
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                Full name
                <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" placeholder="0977 000 000" />
              </label>
              <label className="block text-sm text-slate-300">
                NRC
                <input value={nrc} onChange={(e) => setNrc(e.target.value)} className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                Move-in date
                <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} required className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" />
              </label>
              {selectedBed && (
                <p className="text-xs text-slate-400">Assigned bed: {formatBedOption(selectedBed)} · K{selectedBed.rentAmount}</p>
              )}
            </div>
          )}

          {step === "password" && (
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                Create password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                Confirm password
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} autoComplete="new-password" required className="mt-1.5 w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white" />
              </label>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle size={12} /> After this you will open your dashboard to pay rent, submit maintenance photos, and change your profile picture.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step !== "gender" && (
              <button
                type="button"
                onClick={() => setStep(STEPS[Math.max(0, STEPS.findIndex((row) => row.id === step) - 1)].id)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-slate-200 font-semibold"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !email || (step === "bed" && !bedId)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : step === "password" ? "Finish and open dashboard" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
