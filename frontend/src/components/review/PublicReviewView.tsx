import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../../lib/api.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { Check, Edit3, Clock, AlertTriangle, Send, Share2, Sparkles } from 'lucide-react';

export function PublicReviewView() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Decision state
  const [decisionState, setDecisionState] = useState<'idle' | 'approved' | 'changes'>('idle');
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesNote, setChangesNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReview() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/public/review/${token}`);
        const json = await res.json();
        if (!res.ok || json.error) {
          setError(json.error?.message || json.message || 'Review link is invalid or expired.');
          setLoading(false);
          return;
        }

        if (!json.valid) {
          setError(json.message || 'This review link is no longer valid.');
          setLoading(false);
          return;
        }

        setData(json);
        if (json.post?.status === 'SCHEDULED' || json.post?.status === 'PUBLISHED') {
          setDecisionState('approved');
        } else if (json.post?.status === 'CHANGES') {
          setDecisionState('changes');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load post review.');
      } finally {
        setLoading(false);
      }
    }

    fetchReview();
  }, [token]);

  const handleApprove = async () => {
    if (!token || isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/review/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Approved by client' }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.message || 'Failed to approve post');
      }
      setDecisionState('approved');
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !changesNote.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/review/${token}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: changesNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.message || 'Failed to submit changes');
      }
      setDecisionState('changes');
      setShowChangesModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to request changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-[#f1f2ef] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-sm text-neutral-400 font-medium">Loading post review...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-[#f1f2ef] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#16191d] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold mb-2">Review Link Unavailable</h2>
          <p className="text-sm text-neutral-400 mb-6">{error || 'This link has expired or has been replaced by a newer version.'}</p>
          <div className="text-xs text-neutral-500">
            Please ask the agency team to send a new review link.
          </div>
        </div>
      </div>
    );
  }

  const post = data.post;
  const brand = post.brand;

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f1f2ef] py-10 px-4 flex flex-col items-center justify-start">
      <div className="max-w-xl w-full">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                style={{ backgroundColor: brand.color || '#f2b740' }}
              >
                {brand.name?.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-white leading-tight">{brand.name}</h1>
              <span className="text-xs text-neutral-400">Post Review & Approval</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-neutral-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {post.scheduledAt
                ? `Scheduled: ${new Date(post.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Draft / Unscheduled'}
            </span>
          </div>
        </div>

        {/* State Banner: Approved */}
        {decisionState === 'approved' && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-semibold text-sm">Post Approved!</div>
              <div className="text-xs text-emerald-400/80">
                This post is locked and scheduled to publish automatically.
              </div>
            </div>
          </div>
        )}

        {/* State Banner: Changes Requested */}
        {decisionState === 'changes' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="font-semibold text-sm">Changes Requested</div>
              <div className="text-xs text-amber-400/80">
                Your feedback has been sent back to the agency team.
              </div>
            </div>
          </div>
        )}

        {/* Post Card Preview */}
        <div className="bg-[#16191d] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-6">
          {/* Channels Header */}
          <div className="p-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {post.networks?.map((n: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/10 text-xs">
                  <NetworkIcon network={n.network} className="w-3.5 h-3.5" />
                  <span className="text-neutral-300 font-medium">{n.handle || n.network}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-neutral-500 font-mono">v{post.version}</span>
          </div>

          {/* Media Content */}
          {post.media && post.media.length > 0 && (
            <div className="relative bg-black flex items-center justify-center overflow-hidden max-h-[500px]">
              {post.media[0].kind === 'VIDEO' ? (
                <video
                  src={post.media[0].url}
                  controls
                  className="w-full max-h-[500px] object-contain"
                  poster={post.media[0].thumbUrl}
                />
              ) : (
                <img
                  src={post.media[0].url}
                  alt={post.media[0].altText || 'Post media'}
                  className="w-full max-h-[500px] object-contain"
                />
              )}
            </div>
          )}

          {/* Caption & Details */}
          <div className="p-5">
            <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
              {post.caption || <span className="text-neutral-500 italic">No caption provided</span>}
            </p>

            {post.firstComment && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">First Comment</span>
                <p className="text-xs text-neutral-300 whitespace-pre-wrap">{post.firstComment}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Error if any */}
        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs text-center">
            {actionError}
          </div>
        )}

        {/* Decision Actions (If still pending) */}
        {decisionState === 'idle' && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full sm:flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              <span>{isSubmitting ? 'Approving...' : 'Approve Post'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowChangesModal(true)}
              disabled={isSubmitting}
              className="w-full sm:flex-1 h-12 bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-400/30 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Edit3 className="w-5 h-5 text-amber-400" />
              <span>Request Changes</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-neutral-500">
          Powered by VS Adda · Client Review Portal
        </div>
      </div>

      {/* Changes Request Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#16191d] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Request Changes</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Explain what you would like modified in the video, image, caption, or schedule.
            </p>

            <form onSubmit={handleRequestChanges}>
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  'Change video music',
                  'Shorten caption',
                  'Update offer text',
                  'Fix hashtags',
                  'Change schedule time',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChangesNote((prev) => (prev ? `${prev}\n• ${chip}` : chip))}
                    className="text-[11px] px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-lg border border-white/10"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                required
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder="E.g., Please change the second clip in the reel and add the 20% discount code..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/50 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !changesNote.trim()}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Sending...' : 'Send Feedback'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
