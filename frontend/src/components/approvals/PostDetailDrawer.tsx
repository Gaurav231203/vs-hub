import React, { useState } from 'react';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { Smartphone, Share2 } from 'lucide-react';
import { ManualPublishModal } from '../common/ManualPublishModal.js';
import { apiFetch } from '../../lib/api.js';
import { useToastStore } from '../../stores/toastStore.js';

interface PostDetailDrawerProps {
  post: any | null;
  isOpen?: boolean;
  onClose: () => void;
  onApprove: (post?: any) => void | Promise<void>;
  onRequestChanges: (post?: any) => void;
  canApprove?: boolean;
}

export function PostDetailDrawer({
  post,
  isOpen,
  onClose,
  onApprove,
  onRequestChanges,
}: PostDetailDrawerProps) {
  if (isOpen === false || !post) return null;

  const [showManualModal, setShowManualModal] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const networks = post.targets?.map((t: any) => t.channel?.network) || ['INSTAGRAM'];
  const [activeNetwork, setActiveNetwork] = useState<string>(networks[0] || 'INSTAGRAM');

  const handleCopyReviewLink = async () => {
    if (!post?.id) return;
    setIsCopying(true);
    try {
      const res = await apiFetch(`/posts/${post.id}/review-link`, { method: 'POST' });
      if (res?.reviewUrl) {
        await navigator.clipboard.writeText(res.reviewUrl);
        addToast({ type: 'success', message: 'Client review link copied to clipboard!' });
      } else {
        throw new Error('No review link received');
      }
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to copy review link' });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <div
        className="scrim"
        style={{ opacity: 1, visibility: 'visible', zIndex: 60 }}
        onClick={onClose}
      />
      <dialog className="drawer" open style={{ zIndex: 65 }}>
        <div className="drawer__inner">
          <button
            type="button"
            className="ibtn ibtn--sm drawer__close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="pd-head">
            <span className="bchip">
              <span
                className="bmark bmark--sm"
                style={{ background: post.brand?.color || '#16191d', color: '#fff' }}
              >
                {post.brand?.name?.[0] || 'B'}
              </span>
              <b>{post.brand?.name}</b>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className={`badge badge--${
                  post.publishMode === 'MANUAL' ? 'butter' : 'sea'
                }`}
                style={{ fontSize: '11.5px', padding: '2px 8px', fontWeight: 700 }}
              >
                {post.publishMode === 'MANUAL' ? '📱 Manual' : '⚡ Auto-API'}
              </span>
              <span
                className={`badge badge--${
                  post.status === 'APPROVED' ? 'pine' : post.status === 'CHANGES_REQUESTED' ? 'coral' : 'butter'
                }`}
              >
                {post.status}
              </span>
            </div>
          </div>

          <div className="pd-when">
            <svg className="ico" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>
              {post.scheduledAt
                ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`
                : `Created ${new Date(post.createdAt).toLocaleDateString()}`}
            </span>
          </div>

          {/* Network tabs */}
          {networks.length > 1 && (
            <div className="seg pd-nets" role="group">
              {networks.map((net: string) => (
                <button
                  key={net}
                  type="button"
                  className={`seg__btn ${activeNetwork === net ? 'is-active' : ''}`}
                  aria-pressed={activeNetwork === net}
                  onClick={() => setActiveNetwork(net)}
                >
                  <span style={{ width: 14, height: 14, marginRight: 6, display: 'inline-flex' }}>
                    <NetworkIcon network={net} className="ico" />
                  </span>
                  <span>{net}</span>
                </button>
              ))}
            </div>
          )}

          {/* Live Preview Box */}
          <div className="pd-preview">
            {post.media && post.media.length > 0 && (
              <div
                style={{
                  width: '100%',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                  maxHeight: '260px',
                }}
              >
                <img
                  src={post.media[0]?.asset?.url || post.media[0]?.url || '/images/bakery.jpg'}
                  alt="Post preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/bakery.jpg';
                  }}
                />
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, width: '100%' }}>
              {post.caption || post.text || 'No caption'}
            </p>
          </div>

          {/* Metrics */}
          <div className="pd-metrics">
            <div>
              <dt>Channels</dt>
              <dd>{post.targets?.length || 1}</dd>
            </div>
            <div>
              <dt>Word Count</dt>
              <dd>{(post.caption || post.text || '').split(/\s+/).filter(Boolean).length}</dd>
            </div>
            <div>
              <dt>Media Items</dt>
              <dd>{post.media?.length || 0}</dd>
            </div>
          </div>

          {/* Revisions History */}
          {post.revisions && post.revisions.length > 0 && (
            <div className="pd-revs">
              <h3 className="pd-h3">Revision History</h3>
              {post.revisions.map((rev: any) => (
                <div key={rev.id} className="pd-rev">
                  <div className="av av--xs av--t0">
                    {rev.author?.name?.[0] || 'R'}
                  </div>
                  <div>
                    <p>
                      <b>{rev.author?.name || 'Reviewer'}</b> requested changes
                    </p>
                    <small>{new Date(rev.createdAt).toLocaleString()}</small>
                    <q>{rev.note}</q>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Footer */}
          <div className="pd-actions">
            <button
              type="button"
              className="btn btn--pine"
              onClick={() => onApprove(post)}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m5 13 4 4L19 7" />
              </svg>
              <span>Approve & Schedule</span>
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onRequestChanges(post)}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>Request Changes</span>
            </button>
            <button
              type="button"
              className="btn btn--ink magnetic"
              onClick={handleCopyReviewLink}
              disabled={isCopying}
              title="Copy 1-click review link to send to client via WhatsApp or Email"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Share2 style={{ width: 15, height: 15 }} />
              <span>{isCopying ? 'Copying...' : 'Copy Client Review Link'}</span>
            </button>
            {post.publishMode === 'MANUAL' && (
              <button
                type="button"
                className="btn btn--ink magnetic"
                onClick={() => setShowManualModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Smartphone style={{ width: 15, height: 15 }} />
                <span>Open Manual Publisher</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>

      <ManualPublishModal
        isOpen={showManualModal}
        post={post}
        onClose={() => setShowManualModal(false)}
        onPublished={() => {
          setShowManualModal(false);
          onClose();
        }}
      />
    </>
  );
}
