import React, { useState } from 'react';

const QUICK_CHIPS = [
  'Swap the photo',
  'Shorten the caption',
  'Check the price',
  'Add the link',
  'Fix the hashtags',
  'Move the time',
];

interface RequestChangesModalProps {
  post: any;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export function RequestChangesModal({ post, onClose, onSubmit }: RequestChangesModalProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChipClick = (chip: string) => {
    if (!note) {
      setNote(chip + ': ');
    } else {
      setNote((prev) => `${prev.trim()}\n• ${chip}: `);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Please provide feedback explaining what changes are needed.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(note.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to submit change request');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="scrim"
        style={{ opacity: 1, visibility: 'visible', zIndex: 60 }}
        onClick={onClose}
      />
      <dialog
        className="modal"
        open
        style={{ zIndex: 65, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0 }}
      >
        <form className="mform" onSubmit={handleSubmit}>
          <div className="mform__head">
            <div>
              <h3 className="mform__title">Request changes</h3>
              <p className="mform__sub">Sent back to the author with your notes</p>
            </div>
            <button
              type="button"
              className="ibtn ibtn--sm"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && <div className="mform__err">{error}</div>}

          <div className="field">
            <label className="field__label">Quick notes</label>
            <div className="ap-quick" role="group" aria-label="Quick notes">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => handleChipClick(chip)}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: '14px' }}>
            <label className="field__label">Note for the writer *</label>
            <textarea
              required
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell them specifically what to tweak before this post can be approved..."
              style={{
                width: '100%',
                borderRadius: '16px',
                padding: '12px 14px',
                border: '1px solid var(--line-2)',
                background: 'var(--glass-2)',
                color: 'inherit',
                resize: 'none',
              }}
            />
          </div>

          <div className="mform__foot">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--danger"
              disabled={isSubmitting || !note.trim()}
            >
              {isSubmitting ? 'Sending...' : 'Send back'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
