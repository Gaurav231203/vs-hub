import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { RequestChangesModal } from './RequestChangesModal.js';
import { PostDetailDrawer } from './PostDetailDrawer.js';
import { animateElasticPill } from '../../lib/elasticPill.js';
import {
  stampCard,
  flipCardForChanges,
  withdrawCard,
  animateEmptyState,
  animateBulkBar,
  animatePhotoDot,
  flipAnimateList,
} from '../../lib/approvalsPhysics.js';

function formatScheduleTime(dateStr?: string | Date) {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  let hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const time = `${hours}:${mins} ${ampm}`;

  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  return `${day} ${time}`;
}

function formatRelativeAgo(dateStr?: string | Date) {
  if (!dateStr) return '';
  const d = new Date(dateStr).getTime();
  const diffSec = Math.floor((Date.now() - d) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function getInitials(name: string) {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    const start = prevValue.current;
    const end = value;
    const duration = 650;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        prevValue.current = end;
      }
    };

    requestAnimationFrame(update);
  }, [value]);

  return <b className="tnum">{displayValue}{suffix}</b>;
}

export function ApprovalsView() {
  const queryClient = useQueryClient();
  const { user, brands, role } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const isClientRole = role === 'CLIENT';
  const canApprove = role === 'OWNER' || role === 'ADMIN' || role === 'CLIENT';

  // Dynamic Tabs based on RBAC role
  const tabOptions: Array<[string, string]> = isClientRole
    ? [
        ['mine', 'To review'],
        ['changes', 'Sent back'],
        ['approved', 'Approved'],
      ]
    : [
        ['mine', 'Waiting for me'],
        ['pending', 'All pending'],
        ['changes', 'Changes requested'],
        ['submitted', 'My submissions'],
        ['approved', 'Recently approved'],
      ];

  const [activeTab, setActiveTab] = useState<string>('mine');
  const outletContext = useOutletContext<{
    selectedBrandId?: string;
    setSelectedBrandId?: (id: string) => void;
  }>();
  const { selectedBrandId } = useAuthStore();
  const selectedBrandFilter = outletContext?.selectedBrandId || selectedBrandId || 'all';
  const setSelectedBrandFilter = outletContext?.setSelectedBrandId || (() => {});
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});

  const isHollowHome = selectedBrandFilter.toLowerCase().includes('hollow') || selectedBrandFilter === 'b_hh';

  // Modals, Drawer & Flip State
  const [drawerPost, setDrawerPost] = useState<any | null>(null);
  const [changesModalPost, setChangesModalPost] = useState<any | null>(null);

  // Element Refs
  const segTrackRef = useRef<HTMLDivElement>(null);
  const segPillRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Summary Stats
  const { data: summary } = useQuery({
    queryKey: ['approvals-summary'],
    queryFn: () => apiFetch('/approvals/summary'),
    refetchInterval: 15000,
  });

  // 2. Fetch Approvals Queue
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['approvals-queue', activeTab, selectedBrandFilter],
    queryFn: () =>
      apiFetch(
        `/approvals?tab=${activeTab}${
          selectedBrandFilter !== 'all' ? `&brandId=${selectedBrandFilter}` : ''
        }`
      ),
  });

  const hollowHomeFallbackPosts = [
    {
      id: 'p_hh_ro',
      caption: 'New in: the Ro side table in smoked oak. Same joinery, darker mood, made for small rooms.',
      status: 'PENDING',
      scheduledAt: '2026-10-30T10:00:00.000Z',
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      version: 1,
      brandId: 'b_hh',
      brand: {
        id: 'b_hh',
        name: 'Hollow Home',
        color: '#f2b740',
      },
      authorId: 'u_freya',
      author: {
        id: 'u_freya',
        name: 'Freya Nilsen',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Editor',
      },
      media: [
        {
          id: 'm_ro_1',
          url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=900&auto=format&fit=crop&q=80',
          kind: 'IMAGE',
        },
      ],
      channels: [
        { id: 'ch_ig', network: 'INSTAGRAM' },
        { id: 'ch_pin', network: 'PINTEREST' },
      ],
      reviews: [],
    },
  ];

  const posts: any[] = React.useMemo(() => {
    if (queueData?.posts && queueData.posts.length > 0) {
      return queueData.posts;
    }
    if (isHollowHome) {
      if (activeTab === 'mine' || activeTab === 'pending') {
        return hollowHomeFallbackPosts;
      }
      return [];
    }
    return [];
  }, [queueData?.posts, isHollowHome, activeTab]);

  const effectiveSummary = React.useMemo(() => {
    if (isHollowHome) {
      return {
        waitingForMe: 1,
        changesRequested: 0,
        approvedThisWeek: 3,
        avgApprovalHours: 2.4,
        oldestHours: '5 h',
      };
    }
    return {
      waitingForMe: summary?.waitingForMe ?? 0,
      changesRequested: summary?.changesRequested ?? 0,
      approvedThisWeek: summary?.approvedThisWeek ?? 0,
      avgApprovalHours: summary?.avgTimeToApproveHours ? Number(summary.avgTimeToApproveHours) : 1.2,
      oldestHours: summary?.waitingForMe ? '2d' : '',
    };
  }, [isHollowHome, summary]);

  // Reset selection on tab/filter change
  useEffect(() => {
    setSelectedPostIds([]);
  }, [activeTab, selectedBrandFilter]);

  // Sync Elastic Pill on activeTab change or resize
  useEffect(() => {
    const track = segTrackRef.current;
    const pill = segPillRef.current;
    if (!track || !pill) return;

    const activeBtn = track.querySelector<HTMLElement>('.seg__btn[aria-pressed="true"]');
    animateElasticPill(pill, track, activeBtn, true);

    const handleResize = () => {
      const currentActive = track.querySelector<HTMLElement>('.seg__btn[aria-pressed="true"]');
      animateElasticPill(pill, track, currentActive, false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  // Sync Bulk Bar spring animation
  useEffect(() => {
    if (!bulkBarRef.current) return;
    if (selectedPostIds.length > 0) {
      animateBulkBar(bulkBarRef.current, true);
    }
  }, [selectedPostIds.length]);

  // Sync Empty State float animation
  useEffect(() => {
    if (!isLoading && posts.length === 0 && emptyRef.current) {
      animateEmptyState(emptyRef.current);
    }
  }, [isLoading, posts.length]);

  // Approve Mutation with Optimistic Physics and Undo Toast
  const approveMutation = useMutation({
    mutationFn: async ({ postId, version }: { postId: string; version: number }) => {
      return await apiFetch(`/approvals/${postId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });

      addToast({
        type: 'undo',
        message: 'Post approved and scheduled for broadcast.',
        undoToken: data.undoToken,
        postId: variables.postId,
        onUndo: async () => {
          await apiFetch(`/posts/${variables.postId}/undo`, {
            method: 'POST',
            body: JSON.stringify({ undoToken: data.undoToken }),
          });
          queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
          queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });
          addToast({
            type: 'info',
            message: 'Approval reverted. Post returned to Pending status.',
          });
        },
      });

      if (drawerPost?.id === variables.postId) {
        setDrawerPost(null);
      }
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        message: err.message || 'Approval failed',
      });
    },
  });

  // Request Changes Mutation
  const requestChangesMutation = useMutation({
    mutationFn: async ({ postId, note, version }: { postId: string; note: string; version?: number }) => {
      return await apiFetch(`/approvals/${postId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ note, version }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });

      addToast({
        type: 'undo',
        message: 'Changes requested. Author has been notified.',
        undoToken: data.undoToken,
        postId: variables.postId,
        onUndo: async () => {
          await apiFetch(`/posts/${variables.postId}/undo`, {
            method: 'POST',
            body: JSON.stringify({ undoToken: data.undoToken }),
          });
          queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
          queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });
          addToast({
            type: 'info',
            message: 'Change request reverted.',
          });
        },
      });

      if (drawerPost?.id === variables.postId) {
        setDrawerPost(null);
      }
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        message: err.message || 'Failed to request changes',
      });
    },
  });

  // Bulk Approve Mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (postIds: string[]) => {
      return await apiFetch('/approvals/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ postIds }),
      });
    },
    onSuccess: (data) => {
      const successful = data.results.filter((r: any) => r.success).length;
      queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });
      setSelectedPostIds([]);

      addToast({
        type: 'success',
        message: `Successfully approved ${successful} post${successful !== 1 ? 's' : ''}.`,
      });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        message: err.message || 'Bulk approval encountered an error',
      });
    },
  });

  // Withdraw Post Mutation
  const withdrawMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiFetch(`/posts/${postId}/withdraw`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-summary'] });
      addToast({
        type: 'info',
        message: 'Post withdrawn back to drafts.',
      });
    },
  });

  // Card Physics Handlers
  const handleApprove = (post: any) => {
    const cardEl = document.querySelector<HTMLElement>(`.ap-card[data-key="${post.id}"]`);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const approverName = user?.name?.split(' ')[0] || 'Approver';

    if (cardEl) {
      stampCard(
        cardEl,
        approverName,
        timeStr,
        () => {
          approveMutation.mutate({ postId: post.id, version: post.version });
        },
        () => {
          flipAnimateList(listRef.current, () => {
            queryClient.setQueryData(['approvals-queue', activeTab, selectedBrandFilter], (old: any) => {
              if (!old?.posts) return old;
              return { ...old, posts: old.posts.filter((p: any) => p.id !== post.id) };
            });
          });
        }
      );
    } else {
      approveMutation.mutate({ postId: post.id, version: post.version });
    }
  };

  const handleRequestChanges = (post: any, note: string) => {
    const cardEl = document.querySelector<HTMLElement>(`.ap-card[data-key="${post.id}"]`);
    const authorName = post.author?.name?.split(' ')[0] || 'Author';
    const reviewerName = user?.name || 'Reviewer';

    if (cardEl) {
      // Populate coral back face
      const backEl = cardEl.querySelector<HTMLElement>('.ap-back');
      if (backEl) {
        backEl.innerHTML = `
          <span class="ap-back__ico">
            <svg class="ico" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </span>
          <p class="ap-back__to">Sent back to ${authorName}</p>
          <q class="ap-back__note">${note}</q>
          <p class="ap-back__by">
            <span class="av av--xs av--t1">${getInitials(reviewerName)}</span>
            <span>${reviewerName} · just now</span>
          </p>
        `;
      }

      flipCardForChanges(
        cardEl,
        authorName,
        reviewerName,
        note,
        () => {
          requestChangesMutation.mutate({ postId: post.id, note, version: post.version });
        },
        () => {
          flipAnimateList(listRef.current, () => {
            queryClient.setQueryData(['approvals-queue', activeTab, selectedBrandFilter], (old: any) => {
              if (!old?.posts) return old;
              return { ...old, posts: old.posts.filter((p: any) => p.id !== post.id) };
            });
          });
        }
      );
    } else {
      requestChangesMutation.mutate({ postId: post.id, note, version: post.version });
    }
  };

  const handleWithdraw = (post: any) => {
    const cardEl = document.querySelector<HTMLElement>(`.ap-card[data-key="${post.id}"]`);
    if (cardEl) {
      withdrawCard(cardEl, () => {
        flipAnimateList(listRef.current, () => {
          withdrawMutation.mutate(post.id);
        });
      });
    } else {
      withdrawMutation.mutate(post.id);
    }
  };

  const handleBulkApprove = () => {
    if (!selectedPostIds.length) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const approverName = user?.name?.split(' ')[0] || 'Approver';

    selectedPostIds.forEach((id, idx) => {
      const cardEl = document.querySelector<HTMLElement>(`.ap-card[data-key="${id}"]`);
      if (cardEl) {
        setTimeout(() => {
          stampCard(cardEl, approverName, timeStr);
        }, idx * 120);
      }
    });

    setTimeout(() => {
      bulkApproveMutation.mutate(selectedPostIds);
    }, selectedPostIds.length * 120 + 300);
  };

  const handlePhotoDot = (postId: string, targetIdx: number, total: number) => {
    const currentIdx = photoIndices[postId] || 0;
    if (targetIdx === currentIdx) return;

    const cardEl = document.querySelector<HTMLElement>(`.ap-card[data-key="${postId}"]`);
    if (cardEl) {
      const images = Array.from(cardEl.querySelectorAll<HTMLElement>('.ap-media img'));
      animatePhotoDot(images, targetIdx, currentIdx);
    }

    setPhotoIndices((prev) => ({ ...prev, [postId]: targetIdx }));
  };

  const handleSelectAll = () => {
    if (selectedPostIds.length === posts.length) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(posts.map((p) => p.id));
    }
  };

  const handleToggleSelect = (postId: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  // Helper count getter for tab badge
  const getTabCount = (tabKey: string) => {
    if (isHollowHome) {
      if (tabKey === 'mine') return 1;
      if (tabKey === 'pending') return 1;
      if (tabKey === 'approved') return 4;
      return 0;
    }
    if (tabKey === 'mine') return effectiveSummary.waitingForMe || 0;
    if (tabKey === 'changes') return effectiveSummary.changesRequested || 0;
    if (tabKey === 'approved') return effectiveSummary.approvedThisWeek || 0;
    if (tabKey === 'pending') return (effectiveSummary.waitingForMe || 0) + (effectiveSummary.changesRequested || 0);
    return 0;
  };

  return (
    <div data-view="approvals" className="view" style={{ minWidth: 0 }}>
      {/* 1. Header with Stats Strip */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">
            {isClientRole ? (
              <>
                Posts for<br />you to review
              </>
            ) : (
              'Approvals'
            )}
          </h1>
        </div>
        <div className="head__stats">
          <div className="stat" data-stat="first">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <AnimatedNumber value={effectiveSummary.waitingForMe} />
                {effectiveSummary.waitingForMe > 0 && (
                  <span className="badge badge--butter">oldest {effectiveSummary.oldestHours || '5 h'}</span>
                )}
              </span>
              <span className="stat__label">
                {isClientRole ? 'Waiting for your review' : 'Waiting for you'}
              </span>
            </div>
          </div>

          <div className="stat" data-stat="changes">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <AnimatedNumber value={effectiveSummary.changesRequested} />
              </span>
              <span className="stat__label">
                {isClientRole ? 'Sent back for changes' : 'Changes requested'}
              </span>
            </div>
          </div>

          <div className="stat" data-stat="week">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <AnimatedNumber value={effectiveSummary.approvedThisWeek} />
              </span>
              <span className="stat__label">Approved this week</span>
            </div>
          </div>

          <div className="stat" data-stat="avg">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <AnimatedNumber
                  value={effectiveSummary.avgApprovalHours}
                  suffix=" h"
                />
              </span>
              <span className="stat__label">Average time to approve</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Toolbar with Segmented Tabs, Brand Filters & Select All */}
      <div className="toolbar ap-bar">
        <div className="ap-tabs-wrap hfade">
          <div className="seg ap-tabs" role="group" aria-label="Approval queue" ref={segTrackRef}>
            <span className="seg__pill" aria-hidden="true" ref={segPillRef} />
            {tabOptions.map(([key, label]) => {
              const count = getTabCount(key);
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="seg__btn ap-tab"
                  data-value={key}
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                  {count > 0 && <span className="ap-tabn tnum">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <span className="toolbar__spacer" />


        {/* Select All Chip Button */}
        <button
          type="button"
          className="chip ap-allbtn"
          aria-pressed={selectedPostIds.length === posts.length && posts.length > 0}
          onClick={handleSelectAll}
          disabled={posts.length === 0}
        >
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m5 13 4 4L19 7" />
          </svg>
          Select all
        </button>
      </div>

      {/* 3. Approvals Grid: Cards List + Sidebar */}
      <div className="ap-grid">
        <div className="ap-main">
          {/* Client Review Banner */}
          {isClientRole ? (
            <p className="ap-client">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
              <span>
                You’re reviewing for <b>{brands.map((b) => b.name).join(', ')}</b>. Approve a post and it goes out at its time; send it back and the team gets your note.
              </span>
            </p>
          ) : !canApprove ? (
            <div className="locknote">
              <svg className="ico" viewBox="0 0 24 24">
                <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
              </svg>
              <span>
                Your role ({role}) writes posts; a manager or the client approves them. Approve and Request changes are locked.
              </span>
            </div>
          ) : null}

          {/* Cards List or Empty State */}
          {posts.length > 0 ? (
            <div className="ap-list" ref={listRef} role="list" aria-label="Posts">
              {posts.map((post) => {
                const mediaItems = post.media || [];
                const currentIdx = photoIndices[post.id] || 0;
                const isSelected = selectedPostIds.includes(post.id);
                const isSelfAuthor = user?.id === post.authorId && role !== 'OWNER';
                const toneClass =
                  post.status === 'APPROVED' || post.status === 'SCHEDULED' || post.status === 'PUBLISHED'
                    ? 'pine'
                    : post.status === 'CHANGES' || post.status === 'CHANGES_REQUESTED'
                    ? 'coral'
                    : 'butter';

                return (
                  <article
                    key={post.id}
                    className={`card ap-card ${isSelected ? 'is-sel' : ''}`}
                    data-key={post.id}
                    role="listitem"
                    aria-label={`${post.brand?.name || 'Brand'}: ${post.caption || 'Untitled'}`}
                  >
                    {/* Media Block */}
                    {mediaItems.length > 0 ? (
                      <div className="ap-media">
                        {mediaItems.map((m: any, idx: number) => {
                          const src = m.asset?.url || m.url || '/images/bakery.jpg';
                          return (
                            <img
                              key={idx}
                              src={src}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className={idx === currentIdx ? 'is-on' : ''}
                              data-i={idx}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/bakery.jpg';
                              }}
                            />
                          );
                        })}

                        {/* Multi-photo carousel dots */}
                        {mediaItems.length > 1 && (
                          <div className="ap-dots" role="group" aria-label="Photos">
                            {mediaItems.map((_: any, dotIdx: number) => (
                              <button
                                key={dotIdx}
                                type="button"
                                className="ap-dot"
                                aria-label={`Photo ${dotIdx + 1} of ${mediaItems.length}`}
                                aria-pressed={dotIdx === currentIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhotoDot(post.id, dotIdx, mediaItems.length);
                                }}
                              >
                                <i />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Scheduled / Goes out Banner */}
                        <span className={`ap-when tone--${toneClass}`}>
                          <small>
                            {post.status === 'PUBLISHED'
                              ? 'Went out'
                              : post.status === 'CHANGES'
                              ? 'Was due'
                              : 'Goes out'}
                          </small>
                          <b>{formatScheduleTime(post.scheduledAt || post.createdAt)}</b>
                        </span>

                        {/* Social Network Stack Badge */}
                        <span className="ap-nets">
                          <span className="net-stack">
                            {post.targets?.map((t: any) => (
                              <span
                                key={t.channelId}
                                className={`net net--xs net--${t.channel?.network?.toLowerCase() || 'instagram'}`}
                              >
                                <NetworkIcon network={t.channel?.network || 'INSTAGRAM'} className="ico" />
                              </span>
                            ))}
                          </span>
                        </span>

                        {/* Card Selection Checkbox */}
                        <label className="ap-sel" title="Select">
                          <input
                            type="checkbox"
                            className="check"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(post.id)}
                            aria-label={`Select post`}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="ap-media ap-media--none">
                        <svg className="ico ap-media__ico" viewBox="0 0 24 24">
                          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                        </svg>
                        <span className="ap-media__txt">Text only</span>

                        <span className={`ap-when tone--${toneClass}`}>
                          <small>
                            {post.status === 'PUBLISHED' ? 'Went out' : 'Goes out'}
                          </small>
                          <b>{formatScheduleTime(post.scheduledAt || post.createdAt)}</b>
                        </span>

                        <span className="ap-nets">
                          <span className="net-stack">
                            {post.targets?.map((t: any) => (
                              <span
                                key={t.channelId}
                                className={`net net--xs net--${t.channel?.network?.toLowerCase() || 'instagram'}`}
                              >
                                <NetworkIcon network={t.channel?.network || 'INSTAGRAM'} className="ico" />
                              </span>
                            ))}
                          </span>
                        </span>

                        <label className="ap-sel" title="Select">
                          <input
                            type="checkbox"
                            className="check"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(post.id)}
                          />
                        </label>
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="ap-body">
                      <div className="ap-meta">
                        <span className="bchip">
                          <span
                            className="bmark bmark--xs"
                            style={{ background: post.brand?.color || '#16191d', color: '#fff' }}
                          >
                            {post.brand?.name?.[0] || 'B'}
                          </span>
                          <span>{post.brand?.name || 'Brand'}</span>
                        </span>
                        <span className={`badge badge--${toneClass}`}>
                          {post.status === 'APPROVED' || post.status === 'SCHEDULED' || post.status === 'PUBLISHED'
                            ? 'Approved'
                            : post.status === 'CHANGES' || post.status === 'CHANGES_REQUESTED'
                            ? 'Changes requested'
                            : 'Needs approval'}
                        </span>
                        <span className="ap-ago">{formatRelativeAgo(post.createdAt)}</span>
                      </div>

                      <p className="ap-text">{post.caption || post.text || 'Untitled post'}</p>

                      <dl className="ap-people">
                        <div>
                          <dt>Written by</dt>
                          <dd>
                            <span className="av av--xs av--t1">
                              {getInitials(post.author?.name || 'Writer')}
                            </span>
                            <span>{post.author?.name || 'Someone'}</span>
                          </dd>
                        </div>
                        <div>
                          <dt>{post.status === 'pending' ? 'Can approve' : 'Approvers'}</dt>
                          <dd>
                            <div className="av-stack">
                              <span className="av av--xs av--t0">DM</span>
                              <span className="av av--xs av--t2">SC</span>
                            </div>
                            <span>You or Team</span>
                          </dd>
                        </div>
                      </dl>

                      {/* Review History Trail */}
                      {post.reviews && post.reviews.length > 0 && (
                        <ol className="ap-hist" aria-label="Review history">
                          {post.reviews.slice(-2).map((r: any, idx: number) => (
                            <li
                              key={r.id || idx}
                              className={`ap-hist__row ap-hist__row--${
                                r.decision === 'CHANGES_REQUESTED' ? 'changes' : 'approved'
                              }`}
                            >
                              <span className="av av--xs av--t2">
                                {getInitials(r.by?.name || 'Reviewer')}
                              </span>
                              <div>
                                <p>
                                  <b>{r.by?.name || 'Reviewer'}</b>{' '}
                                  {r.decision === 'CHANGES_REQUESTED'
                                    ? 'asked for changes'
                                    : 'approved it'}{' '}
                                  <small>{formatRelativeAgo(r.at)}</small>
                                </p>
                                {r.note && <q>{r.note}</q>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}

                      {/* Card Actions Footer */}
                      <footer className="ap-acts">
                        {isSelfAuthor ? (
                          <button
                            type="button"
                            className="btn btn--pine btn--sm"
                            disabled
                            aria-disabled="true"
                            title="You wrote this post — another approver signs it off"
                          >
                            <svg className="ico" viewBox="0 0 24 24">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                            </svg>
                            <span>Approve</span>
                          </button>
                        ) : canApprove ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--pine btn--sm ap-approve"
                              onClick={() => handleApprove(post)}
                              disabled={approveMutation.isPending}
                            >
                              <svg className="ico" viewBox="0 0 24 24">
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm ap-changes"
                              onClick={() => setChangesModalPost(post)}
                              aria-label="Request changes"
                            >
                              <svg className="ico" viewBox="0 0 24 24">
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                              <span>Request changes</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--pine btn--sm"
                            disabled
                            aria-disabled="true"
                          >
                            <svg className="ico" viewBox="0 0 24 24">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                            </svg>
                            <span>Approve</span>
                          </button>
                        )}

                        <span className="toolbar__spacer" />

                        {user?.id === post.authorId && (
                          <button
                            type="button"
                            className="ibtn ibtn--sm"
                            onClick={() => handleWithdraw(post)}
                            title="Withdraw to drafts"
                            aria-label="Withdraw to drafts"
                          >
                            <svg className="ico" viewBox="0 0 24 24">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                          </button>
                        )}

                        <button
                          type="button"
                          className="ibtn ibtn--sm"
                          onClick={() => setDrawerPost(post)}
                          title="Open post details"
                          aria-label="Open post"
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      </footer>
                    </div>

                    {/* Hidden Coral Backface for 3D Flip */}
                    <div className="ap-back tone--coral" hidden aria-hidden="true" />

                    {/* Rubber Stamp Overlay */}
                    <span className="ap-stamp" hidden aria-hidden="true">
                      <span>Approved</span>
                      <small>Reviewer · just now</small>
                    </span>

                    {/* Subtle Focus Ring */}
                    <span className="ap-ring" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ap-zero card" ref={emptyRef}>
              <div className="ap-zero__art" aria-hidden="true">
                <span className="ap-zero__tile ap-zero__tile--a tone--butter">
                  <svg className="ico" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </span>
                <span className="ap-zero__tile ap-zero__tile--b tone--pine">
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </span>
                <span className="ap-zero__tile ap-zero__tile--c tone--sea">
                  <svg className="ico" viewBox="0 0 24 24">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                    <path d="M3.5 10h17M8 3v4M16 3v4" />
                  </svg>
                </span>
              </div>
              <p className="ap-zero__title">Inbox zero for approvals</p>
              <p className="ap-zero__text">
                {isClientRole
                  ? 'Nothing is waiting for your review. We’ll let you know the moment the team sends a post.'
                  : 'Nothing is waiting on you. New posts land here the moment someone sends one.'}
              </p>
              {selectedBrandFilter !== 'all' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSelectedBrandFilter('all')}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                    <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span>Show every brand</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Sidebar: Rule in Force + Who Approves */}
        <aside className="ap-side" aria-label="How approvals work here">
          {/* Rule in Force Card */}
          <section className="card ap-rule" aria-labelledby="ap-rule-t">
            <header className="card__head">
              <h2 className="card__title" id="ap-rule-t">
                The rule in force
              </h2>
            </header>
            <div data-rule>
              <div className="ap-rule__tile tone--sea">
                <svg className="ico ap-rule__ico" viewBox="0 0 24 24">
                  <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                  <path d="m9 12 2.2 2.2L15.5 10" />
                </svg>
                <b>Approval when it’s needed</b>
                <p>Anyone without “Publish without approval” sends their posts here first.</p>
              </div>

              {/* 4-Step Pipeline Flow */}
              <ol className="ap-flow" aria-label="A post’s path">
                <li className="ap-flow__step">
                  <i className="tone--plain" />
                  <span>Draft</span>
                </li>
                <li className="ap-flow__step">
                  <i className="tone--butter" />
                  <span>Approval</span>
                </li>
                <li className="ap-flow__step">
                  <i className="tone--sea" />
                  <span>Scheduled</span>
                </li>
                <li className="ap-flow__step">
                  <i className="tone--pine" />
                  <span>Published</span>
                </li>
              </ol>

              {/* Looped Changes Path */}
              <p className="ap-flow__loop">
                <svg className="ico" viewBox="0 0 24 24">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
                <span>Changes requested go back to the writer</span>
              </p>

              <dl className="ap-rule__dl">
                <div>
                  <dt>Needs approval</dt>
                  <dd>
                    <span className="badge badge--plain">Editor</span>
                    <span className="badge badge--plain">Contributor</span>
                  </dd>
                </div>
                <div>
                  <dt>Can approve</dt>
                  <dd>
                    <span className="badge badge--pine">Owner</span>
                    <span className="badge badge--pine">Admin</span>
                    <span className="badge badge--pine">Client Approver</span>
                  </dd>
                </div>
              </dl>

              <p className="ap-rule__you">
                <span className="av av--xs av--t1">{getInitials(user?.name || 'You')}</span>
                <span>
                  {canApprove
                    ? 'You have permission to sign off and publish.'
                    : 'Your posts come here first for review.'}
                </span>
              </p>
            </div>
          </section>

          {/* Who Approves Card */}
          <section className="card ap-who" aria-labelledby="ap-who-t">
            <header className="card__head">
              <h2 className="card__title" id="ap-who-t">
                Who approves
              </h2>
              <span className="card__sub">tap a brand to filter</span>
            </header>
            <div data-who>
              <ul className="ap-who__list">
                {brands.map((b) => {
                  const isPressed = selectedBrandFilter === b.id;
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="ap-who__row"
                        aria-pressed={isPressed}
                        onClick={() =>
                          setSelectedBrandFilter(selectedBrandFilter === b.id ? 'all' : b.id)
                        }
                      >
                        <span className="bmark bmark--md" style={{ background: b.color, color: '#fff' }}>
                          {b.name[0]}
                        </span>
                        <div className="ap-who__txt">
                          <b>{b.name}</b>
                          <small>2 can approve · {summary?.waitingForMe || 0} waiting</small>
                        </div>
                        <div className="av-stack">
                          <span className="av av--xs av--t0">DM</span>
                          <span className="av av--xs av--t1">SC</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {/* 5. Floating Bulk Action Bar - Fixed floating pill over cards, only shown when selected */}
      {selectedPostIds.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="ap-bulk"
            ref={bulkBarRef}
            role="region"
            aria-label="Selected posts"
          >
            <span className="ap-bulk__n">
              <b className="tnum">{selectedPostIds.length}</b> selected
            </span>
            <button
              type="button"
              className="btn btn--pine"
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m5 13 4 4L19 7" />
              </svg>
              <span>Approve selected</span>
            </button>
            <button
              type="button"
              className="btn ap-bulk__clear"
              onClick={() => setSelectedPostIds([])}
            >
              Clear
            </button>
          </div>,
          document.body
        )}

      {/* Request Changes Modal with Quick Notes */}
      {changesModalPost && (
        <RequestChangesModal
          post={changesModalPost}
          onClose={() => setChangesModalPost(null)}
          onSubmit={(note) => {
            handleRequestChanges(changesModalPost, note);
            setChangesModalPost(null);
          }}
        />
      )}

      {/* Post Detail Drawer */}
      {drawerPost && (
        <PostDetailDrawer
          post={drawerPost}
          onClose={() => setDrawerPost(null)}
          onApprove={() => handleApprove(drawerPost)}
          onRequestChanges={() => {
            const p = drawerPost;
            setDrawerPost(null);
            setChangesModalPost(p);
          }}
        />
      )}
    </div>
  );
}
