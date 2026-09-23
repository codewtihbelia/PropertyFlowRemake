import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { resetToDefaultSeed } from '../../services/store';
import { Shield, User, Users, RefreshCw, CheckCircle2 } from 'lucide-react';

export const DemoBar: React.FC = () => {
  const { currentUser, switchUser, allUsers } = useAuth();

  const handleReset = () => {
    if (window.confirm('Reset data to initial 7-resident demo state (1 Host, 4 Payors, 3 Non-Payors)?')) {
      resetToDefaultSeed();
      window.location.reload();
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white text-xs px-4 py-2 border-b border-blue-800 shadow-sm flex flex-wrap items-center justify-between gap-2 z-50">
      <div className="flex items-center gap-2">
        <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px]">
          Demo Mode
        </span>
        <span className="text-slate-300 hidden sm:inline">
          Active: <strong className="text-white">{currentUser.displayName}</strong> ({currentUser.role})
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-400 mr-1 text-[11px] hidden md:inline">Switch Persona:</span>

        {/* Host */}
        <button
          onClick={() => switchUser('u_host')}
          className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_host'
              ? 'bg-blue-500 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Host: Alex Chen (Manage bills, verify payments, redistribute)"
        >
          <User className="w-3 h-3" /> Host (Alex)
        </button>

        {/* Payor Bea */}
        <button
          onClick={() => switchUser('u_p1')}
          className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_p1'
              ? 'bg-amber-500 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Payor 1: Bea Alonzo (Has ₱2,219.50 bill, paid ₱2,000, ₱219.50 remaining)"
        >
          <Users className="w-3 h-3" /> Payor (Bea)
        </button>

        {/* Payor Carlos */}
        <button
          onClick={() => switchUser('u_p2')}
          className={`px-2 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_p2'
              ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Payor 2: Carlos Santos (Recipient of redistributed balance)"
        >
          Carlos
        </button>

        {/* Payor Diana */}
        <button
          onClick={() => switchUser('u_p3')}
          className={`px-2 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_p3'
              ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Payor 3: Diana Prince"
        >
          Diana
        </button>

        {/* Non-Payor Fiona */}
        <button
          onClick={() => switchUser('u_np1')}
          className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_np1'
              ? 'bg-purple-500 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Non-Payor: Fiona Gallagher"
        >
          Non-Payor (Fiona)
        </button>

        {/* Super Admin */}
        <button
          onClick={() => switchUser('u_admin')}
          className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
            currentUser.uid === 'u_admin'
              ? 'bg-rose-600 text-white shadow-sm ring-1 ring-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Super Admin: Platform management, app versions, audit logs"
        >
          <Shield className="w-3 h-3" /> Super Admin
        </button>

        <button
          onClick={handleReset}
          className="ml-2 px-2 py-1 bg-slate-700 hover:bg-rose-700 text-slate-300 hover:text-white rounded-md transition flex items-center gap-1 text-[11px]"
          title="Reset database to fresh 7-resident configuration"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>
    </div>
  );
};

