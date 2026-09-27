import React, { useState } from 'react';
import { KeyRound, X, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useHousehold } from '../../contexts/HouseholdContext';

interface JoinHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const JoinHouseholdModal: React.FC<JoinHouseholdModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { joinHousehold } = useHousehold();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim();
    if (!clean) {
      setError('Please enter your 5-6 character invite code (e.g. PF-402).');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await joinHousehold(clean);
      if (result.success) {
        setSuccessMessage('Join request sent! The room host must approve your request before you join.');
        setTimeout(() => {
          setCode('');
          setSuccessMessage(null);
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setError(result.error || 'No household found with that code. Please check with your host.');
      }
    } catch (err: any) {
      console.error('Failed to join household:', err);
      setError(err?.message || 'Failed to join household. Please verify the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden"
        id="join-household-modal"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-3 border border-white/20">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-black">Join a Household Group</h2>
          <p className="text-blue-100 text-xs mt-1">
            Connect your account with your roommates using an invite code
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Household Invite Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="e.g. PF-402"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-mono font-black text-slate-800 tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition uppercase placeholder:text-slate-400"
              disabled={loading}
              autoFocus
            />
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Ask your Host or Roommate for their 5 or 6-character code (shown at the top of their dashboard or in Group Settings).
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Join Household</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
