import { useEffect, useState } from "react";
import { Mail, Lock, ArrowLeft, User, Key, CheckCircle, AlertCircle, Home, CreditCard, FileText, Eye, EyeOff } from "lucide-react";
import { fetchAuthenticatedStudent, requestOTP, requestStudentPasswordReset, verifyOTP, studentLogin } from "../lib/auth";
import { useStudentViewport } from "../hooks/useStudentViewport";

interface StudentLoginProps {
  onBack: () => void;
  onLoginSuccess: (user: any) => void;
  /** In the student portal / APK shell there is no landlord entry point to return to. */
  hideBack?: boolean;
}

export function StudentLogin({ onBack, onLoginSuccess, hideBack = false }: StudentLoginProps) {
  const viewport = useStudentViewport();
  const [mode, setMode] = useState<"login" | "otp-request" | "otp-verify" | "forgot-password">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [otpForm, setOtpForm] = useState({ email: "", name: "", otp: "" });

  // Preserve a working route for any old Magic Link emails while the Supabase
  // template is switched to an OTP template.
  useEffect(() => {
    let active = true;
    void fetchAuthenticatedStudent()
      .then((student) => {
        if (active && student) onLoginSuccess(student);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await studentLogin(loginForm);
      if (result.success) {
        onLoginSuccess(result.student);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await requestOTP({ email: otpForm.email, name: otpForm.name });
      if (result.success) {
        setSuccess("OTP sent to your email!");
        setMode("otp-verify");
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await requestStudentPasswordReset(loginForm.email);
      if (result.success) setSuccess(result.message);
      else setError(result.message);
    } catch {
      setError("Unable to send password reset instructions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await verifyOTP({ email: otpForm.email, otp: otpForm.otp });
      if (result.success) {
        const student = await fetchAuthenticatedStudent();
        if (!student) {
          setError("Email verified, but no tenant profile is linked to this email. Contact the landlord first.");
          return;
        }
        onLoginSuccess(student);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-dvh h-dvh max-h-dvh overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex justify-center ${viewport.sideNav ? "items-stretch" : "items-center"} p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] relative`}>
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      
      <div className={`bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl w-full my-auto border border-white/20 relative z-10 max-h-[min(100%,100dvh)] overflow-y-auto ${viewport.sideNav ? "max-w-3xl p-4 grid sm:grid-cols-[minmax(0,15rem)_1fr] gap-4 items-start" : viewport.compactChrome ? "max-w-md p-4" : "max-w-md p-6 sm:p-8"}`}>
        <div className={viewport.sideNav ? "min-w-0" : ""}>
        {!hideBack && (
        <button
          onClick={onBack}
          className={`flex items-center gap-2 text-slate-300 hover:text-white transition-colors ${viewport.compactChrome ? "mb-3" : "mb-6"}`}
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back to Main</span>
        </button>
        )}

        <div className={`text-center ${viewport.compactChrome ? "mb-4" : "mb-8"} ${viewport.sideNav ? "sm:text-left" : ""}`}>
          <div className={`${viewport.compactChrome ? "w-12 h-12" : "w-20 h-20"} bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center ${viewport.sideNav ? "sm:mx-0 mx-auto" : "mx-auto"} ${viewport.compactChrome ? "mb-2" : "mb-4"} shadow-lg shadow-blue-500/30`}>
            <User size={viewport.compactChrome ? 24 : 40} className="text-white" />
          </div>
          <h1 className={`${viewport.compactChrome ? "text-xl" : "text-2xl"} font-bold text-white`}>Student Portal</h1>
          <p className={`text-slate-300 ${viewport.compactChrome ? "mt-1 text-sm" : "mt-2"}`}>Access your room and billing information</p>
          <div className={`flex items-center ${viewport.sideNav ? "sm:justify-start justify-center" : "justify-center"} gap-4 ${viewport.compactChrome ? "mt-2" : "mt-4"} text-slate-400 text-xs ${viewport.compactChrome ? "hidden sm:flex" : ""}`}>
            <div className="flex items-center gap-1">
              <Home size={14} className="text-blue-400" />
              <span>Room Details</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard size={14} className="text-indigo-400" />
              <span>Billing</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText size={14} className="text-blue-400" />
              <span>Payments</span>
            </div>
          </div>
        </div>
        </div>

        <div className="min-w-0">
        {error && (
          <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl mb-4 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl mb-4 text-sm">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              mode === "login"
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10"
            }`}
          >
            Existing Login
          </button>
          <button
            onClick={() => setMode("otp-request")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              mode === "otp-request" || mode === "otp-verify"
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10"
            }`}
          >
            OTP Registration
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mb-4">
          New students must be onboarded by the landlord first. Registration only works for emails already assigned to a bed space.
        </p>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="your.email@gmail.com"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
                  required
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <button type="button" onClick={() => { setMode("forgot-password"); setError(null); setSuccess(null); }} className="w-full text-blue-300 hover:text-white py-1 text-sm font-medium transition-colors">
              Forgotten Password?
            </button>
          </form>
        )}

        {mode === "forgot-password" && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-white">Reset your password</h2>
              <p className="text-sm text-slate-300 mt-1">Enter your student email and we’ll send a reset link.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="your.email@gmail.com" className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500" required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {loading ? "Sending reset link..." : "Send reset link"}
            </button>
            <button type="button" onClick={() => setMode("login")} className="w-full text-slate-300 hover:text-white py-1 text-sm font-medium transition-colors">Back to login</button>
          </form>
        )}

        {mode === "otp-request" && (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <p className="text-xs text-slate-400">Use the email your landlord entered when assigning your bed space.</p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={otpForm.name}
                  onChange={(e) => setOtpForm({ ...otpForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={otpForm.email}
                  onChange={(e) => setOtpForm({ ...otpForm, email: e.target.value })}
                  placeholder="your.email@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? "Sending OTP..." : "Send verification code"}
            </button>
          </form>
        )}

        {mode === "otp-verify" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Enter verification code</label>
              <div className="relative">
                <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={otpForm.otp}
                  onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value })}
                  placeholder="123456"
                  maxLength={8}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono text-lg tracking-widest text-white placeholder-slate-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button
              type="button"
              onClick={() => setMode("otp-request")}
              className="w-full text-slate-300 hover:text-white py-2 text-sm font-medium transition-colors"
            >
              Request new OTP
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
