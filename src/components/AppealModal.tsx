import React, { useState } from 'react';
import { X, ShieldAlert, Send, FileText } from 'lucide-react';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  blockReason?: string | null;
  onSubmitted: () => void;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  isOpen,
  onClose,
  token,
  blockReason,
  onSubmitted,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Please provide a comprehensive explanation (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appealReason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to file appeal.');
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error communicating with proctor review server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-7 shadow-2xl text-[#111808]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#656858] hover:text-[#111808] hover:bg-[#F0EEE6] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-[#111808]">Disqualification Appeal</h2>
            <p className="text-xs text-[#656858]">Chief Proctor Review Tribunal</p>
          </div>
        </div>

        {blockReason && (
          <div className="p-3.5 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <span className="font-semibold block text-rose-900 mb-0.5">Violation Notice:</span>
            {blockReason}
          </div>
        )}

        {success ? (
          <div className="p-5 rounded-2xl bg-[#FFF0BA] border border-[#111808]/20 text-[#111808] text-center text-xs font-semibold">
            Appeal transmitted to Chief Proctor console. Awaiting administrative review.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-[#111808]" />
                Explanation / Circumstances
              </label>
              <textarea
                rows={4}
                required
                placeholder="Explain the circumstances surrounding the window departure, tab blur, or network fluctuation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-2xl p-3.5 text-xs text-[#111808] placeholder-[#8C9080] outline-none resize-none transition-colors"
              />
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] font-bold text-xs font-mono tracking-wider shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Transmitting Appeal...' : 'Submit Appeal to Proctor'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
