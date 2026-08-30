import { Building2, User, LogIn, Shield } from "lucide-react";
import { getCurrentYear } from "../lib/billing";

interface LandingPageProps {
  onStudentLogin: () => void;
  onLandlordLogin: () => void;
}

export function LandingPage({ onStudentLogin, onLandlordLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      
      <div className="max-w-5xl w-full relative z-10">
        <div className="text-center mb-16">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/30">
            <Building2 size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">Room Revenue Tracker</h1>
          <p className="text-slate-300 text-xl">Property Management System</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <button
            onClick={onStudentLogin}
            className="group bg-white/10 backdrop-blur-lg rounded-3xl p-10 hover:bg-white/15 transition-all duration-300 hover:scale-[1.03] border border-white/20 shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                <User size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Student Portal</h2>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed max-w-xs">Access your room details, view billing information, submit payment proofs, and report maintenance issues</p>
              <div className="flex items-center justify-center text-blue-400 text-sm font-semibold group-hover:text-blue-300 transition-colors">
                <LogIn size={18} className="mr-2" />
                Login as Student
              </div>
            </div>
          </button>

          <button
            onClick={onLandlordLogin}
            className="group bg-white/10 backdrop-blur-lg rounded-3xl p-10 hover:bg-white/15 transition-all duration-300 hover:scale-[1.03] border border-white/20 shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/30">
                <Building2 size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Landlord Portal</h2>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed max-w-xs">Manage properties, onboard tenants, verify payments, track revenue, and handle maintenance requests</p>
              <div className="flex items-center justify-center text-emerald-400 text-sm font-semibold group-hover:text-emerald-300 transition-colors">
                <LogIn size={18} className="mr-2" />
                Login as Landlord
              </div>
            </div>
          </button>
        </div>

        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-4">
            <Shield size={16} className="text-emerald-400" />
            <span>Secure & Reliable</span>
          </div>
          <p className="text-slate-500 text-sm">© {getCurrentYear()} Room Revenue Tracker. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
