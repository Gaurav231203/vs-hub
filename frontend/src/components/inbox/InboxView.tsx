import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import {
  Search,
  SlidersHorizontal,
  CheckCheck,
  Check,
  Flag,
  UserPlus,
  Info,
  MoreHorizontal,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  FileText,
  Send,
  EyeOff,
  X,
  RotateCw,
  MessageCircle,
  Mail,
  AtSign,
  Star,
  Inbox,
  Sparkles,
  Lock,
} from 'lucide-react';

// Default mock conversations matching Murmura 1:1 (Owen Fletcher, Abigail Shaw, etc.)
interface MessageItem {
  id: string;
  from: 'them' | 'us';
  text: string;
  time: string;
  at: number;
  note?: boolean;
  author?: string;
}

interface ThreadItem {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  followers?: string;
  network: string;
  networkName?: string;
  kind: 'comment' | 'dm' | 'mention' | 'review';
  brandId: string;
  brandName: string;
  brandTone: string;
  time: string;
  at: number;
  snippet: string;
  unread: boolean;
  unreadCount: number;
  priority: boolean;
  status: 'open' | 'done';
  sentiment: 'pos' | 'neu' | 'neg';
  assignee?: { id: string; name: string; title: string };
  tags: string[];
  contextSubtext: string;
  postTitle?: string;
  postDate?: string;
  postMedia?: string;
  thread: MessageItem[];
}

const DEFAULT_CONVERSATIONS: ThreadItem[] = [];
const HOLLOW_HOME_THREADS: ThreadItem[] = [];

export function InboxView() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, brands, selectedBrandId } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const isHollowHome = selectedBrandId.toLowerCase().includes('hollow') || selectedBrandId === 'b_hh';

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mine' | 'unassigned' | 'priority' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('cmvosckc46');
  const [showInfo, setShowInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedReplies, setShowSavedReplies] = useState(false);

  // Dynamic filter popover positioning for tablet & desktop
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [filterPopPos, setFilterPopPos] = useState<{ top: number; left: number }>({ top: 120, left: 24 });

  const updateFilterPosition = () => {
    if (!filterBtnRef.current) return;
    const rect = filterBtnRef.current.getBoundingClientRect();
    const popWidth = 288;
    const padding = 14;
    // Align popover's right edge with button's right edge
    let left = rect.right - popWidth;
    // Clamping: ensure it doesn't overflow screen on left
    if (left < padding) {
      left = Math.max(padding, rect.left);
    }
    // Clamping: ensure it doesn't overflow screen on right
    if (left + popWidth > window.innerWidth - padding) {
      left = window.innerWidth - popWidth - padding;
    }
    setFilterPopPos({
      top: Math.round(rect.bottom + 8),
      left: Math.round(left),
    });
  };

  useEffect(() => {
    if (!showFilters) return;
    updateFilterPosition();

    const handleResizeOrScroll = () => {
      updateFilterPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFilters]);

  // Active filter checks in popover
  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [selectedNets, setSelectedNets] = useState<string[]>([]);
  const [selectedSents, setSelectedSents] = useState<string[]>([]);

  // Composer states
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [composerText, setComposerText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Local state for threads so interactions work instantly
  const [threads, setThreads] = useState<ThreadItem[]>(DEFAULT_CONVERSATIONS);

  // Sync route param
  useEffect(() => {
    if (conversationId && conversationId !== selectedId) {
      setSelectedId(conversationId);
    }
  }, [conversationId]);

  // Fetch API conversations if available and merge
  const { data: convosData } = useQuery({
    queryKey: ['inbox-list'],
    queryFn: async () => {
      return apiFetch<any>('/inbox/conversations?limit=50').catch(() => null);
    },
    refetchInterval: 15000,
  });

  // Fetch Saved Replies
  const { data: savedRepliesData } = useQuery({
    queryKey: ['saved-replies'],
    queryFn: async () => {
      return apiFetch<{ replies: any[] }>('/inbox/saved-replies').catch(() => ({ replies: [] }));
    },
  });

  // Merge API conversations into list if any returned
  useEffect(() => {
    if (convosData?.items && convosData.items.length > 0) {
      const mapped: ThreadItem[] = convosData.items.map((c: any) => ({
        id: c.id,
        name: c.authorName || 'User',
        handle: c.authorHandle || 'customer',
        avatar: c.authorAvatar || undefined,
        followers: '1,200',
        network: c.channel?.network || 'INSTAGRAM',
        networkName: c.channel?.network || 'Instagram',
        kind: (c.type?.toLowerCase() || 'comment') as any,
        brandId: c.channel?.brandId || 'ember',
        brandName: c.channel?.brand?.name || 'Brand',
        brandTone: 'coral',
        time: 'Just now',
        at: new Date(c.lastMessageAt || Date.now()).getTime(),
        snippet: c.lastMessage?.body || 'New message',
        unread: !!c.unread,
        unreadCount: c.unread ? 1 : 0,
        priority: !!c.priority,
        status: c.status === 'CLOSED' ? 'done' : 'open',
        sentiment: c.sentiment === 'POSITIVE' ? 'pos' : c.sentiment === 'NEGATIVE' ? 'neg' : 'neu',
        tags: c.tags || [],
        contextSubtext: `Comment on ${c.channel?.brand?.name || 'Brand'}'s post`,
        postTitle: 'Latest community update',
        postDate: 'Oct 24',
        postMedia: '/images/bakery.jpg',
        thread: (c.messages || []).map((m: any) => ({
          id: m.id,
          from: m.direction === 'IN' ? 'them' : 'us',
          text: m.body,
          time: new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          at: new Date(m.sentAt).getTime(),
          note: m.direction === 'NOTE',
          author: m.authorUser?.name,
        })),
      }));

      setThreads((prev) => {
        const merged = [...mapped];
        // add defaults that aren't already represented
        for (const d of DEFAULT_CONVERSATIONS) {
          if (!merged.some((m) => m.id === d.id)) {
            merged.push(d);
          }
        }
        return merged;
      });
    }
  }, [convosData]);

  // Brand-filtered base threads
  const brandFilteredThreads = useMemo(() => {
    if (!selectedBrandId || selectedBrandId === 'all') return threads;
    const brandNorm = selectedBrandId.toLowerCase();
    return threads.filter((t) => {
      const tBrandIdNorm = (t.brandId || '').toLowerCase();
      const tBrandNameNorm = (t.brandName || '').toLowerCase();
      if (brandNorm === 'b_hh' || brandNorm.includes('hollow')) {
        return tBrandIdNorm.includes('hollow') || tBrandIdNorm === 'b_hh' || tBrandNameNorm.includes('hollow');
      }
      if (brandNorm === 'b_vg' || brandNorm.includes('vantage')) {
        return tBrandIdNorm.includes('vantage') || tBrandIdNorm === 'b_vg' || tBrandNameNorm.includes('vantage');
      }
      if (brandNorm === 'b_eo' || brandNorm.includes('ember')) {
        return tBrandIdNorm.includes('ember') || tBrandIdNorm === 'b_eo' || tBrandNameNorm.includes('ember');
      }
      if (brandNorm === 'b_wb' || brandNorm.includes('wildroot')) {
        return tBrandIdNorm.includes('wildroot') || tBrandIdNorm === 'b_wb' || tBrandNameNorm.includes('wildroot');
      }
      if (brandNorm === 'b_ns' || brandNorm.includes('northlight')) {
        return tBrandIdNorm.includes('northlight') || tBrandIdNorm === 'b_ns' || tBrandNameNorm.includes('northlight');
      }
      return t.brandId === selectedBrandId || tBrandNameNorm.includes(brandNorm);
    });
  }, [threads, selectedBrandId]);

  // Sync selected conversation when brand changes
  useEffect(() => {
    if (brandFilteredThreads.length > 0 && !brandFilteredThreads.some((t) => t.id === selectedId)) {
      setSelectedId(brandFilteredThreads[0].id);
    }
  }, [brandFilteredThreads, selectedId]);

  // Active Selected Conversation
  const activeConvo = useMemo(() => {
    return brandFilteredThreads.find((t) => t.id === selectedId) || brandFilteredThreads[0] || null;
  }, [brandFilteredThreads, selectedId]);

  // Derived filter counts
  const counts = useMemo(() => {
    const openItems = brandFilteredThreads.filter((t) => t.status === 'open');
    return {
      all: openItems.length,
      unread: openItems.filter((t) => t.unread).length,
      mine: openItems.filter((t) => t.assignee?.id === user?.id).length,
      unassigned: openItems.filter((t) => !t.assignee).length,
      priority: openItems.filter((t) => t.priority).length,
      done: brandFilteredThreads.filter((t) => t.status === 'done').length,
    };
  }, [brandFilteredThreads, user]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return brandFilteredThreads.filter((t) => {
      // 1. Tab filter
      if (activeTab === 'done') {
        if (t.status !== 'done') return false;
      } else {
        if (t.status !== 'open') return false;
        if (activeTab === 'unread' && !t.unread) return false;
        if (activeTab === 'mine' && t.assignee?.id !== user?.id) return false;
        if (activeTab === 'unassigned' && !!t.assignee) return false;
        if (activeTab === 'priority' && !t.priority) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.name.toLowerCase().includes(q) ||
          t.handle.toLowerCase().includes(q) ||
          t.snippet.toLowerCase().includes(q) ||
          t.thread.some((m) => m.text.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // 3. Kind filter
      if (selectedKinds.length > 0 && !selectedKinds.includes(t.kind)) return false;

      // 4. Network filter
      if (selectedNets.length > 0 && !selectedNets.includes(t.network.toLowerCase())) return false;

      // 5. Sentiment filter
      if (selectedSents.length > 0 && !selectedSents.includes(t.sentiment)) return false;

      return true;
    });
  }, [brandFilteredThreads, activeTab, searchQuery, selectedKinds, selectedNets, selectedSents, user]);

  // Auto scroll chat to bottom when active conversation changes or new message sent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvo?.thread]);

  // Handlers
  const handleSelectConvo = (id: string) => {
    setSelectedId(id);
    navigate(`/inbox/${id}`, { replace: true });
    // Mark as read locally
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false, unreadCount: 0 } : t))
    );
  };

  const handleMarkAllRead = () => {
    setThreads((prev) => prev.map((t) => ({ ...t, unread: false, unreadCount: 0 })));
    addToast({ type: 'success', message: 'All conversations marked as read' });
  };

  const togglePriority = () => {
    if (!activeConvo) return;
    const nextPriority = !activeConvo.priority;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeConvo.id ? { ...t, priority: nextPriority } : t))
    );
    addToast({
      type: 'info',
      message: nextPriority ? 'Marked as priority' : 'Priority removed',
    });
    // Try sending API PATCH
    apiFetch(`/inbox/conversations/${activeConvo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priority: nextPriority }),
    }).catch(() => {});
  };

  const toggleDone = () => {
    if (!activeConvo) return;
    const nextStatus = activeConvo.status === 'open' ? 'done' : 'open';
    setThreads((prev) =>
      prev.map((t) => (t.id === activeConvo.id ? { ...t, status: nextStatus, unread: false } : t))
    );
    addToast({
      type: 'success',
      message: nextStatus === 'done' ? 'Conversation closed' : 'Conversation reopened',
    });
    apiFetch(`/inbox/conversations/${activeConvo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus === 'done' ? 'CLOSED' : 'OPEN' }),
    }).catch(() => {});
  };

  const setSentiment = (sentiment: 'pos' | 'neu' | 'neg') => {
    if (!activeConvo) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeConvo.id ? { ...t, sentiment } : t))
    );
    const apiVal = sentiment === 'pos' ? 'POSITIVE' : sentiment === 'neg' ? 'NEGATIVE' : 'NEUTRAL';
    apiFetch(`/inbox/conversations/${activeConvo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sentiment: apiVal }),
    }).catch(() => {});
  };

  const handleSend = () => {
    if (!composerText.trim() || !activeConvo) return;
    const text = composerText.trim();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: MessageItem = {
      id: 'm_' + Date.now(),
      from: 'us',
      text,
      time: timeStr,
      at: now.getTime(),
      note: composerMode === 'note',
      author: user?.name || 'You',
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeConvo.id) {
          return {
            ...t,
            snippet: composerMode === 'note' ? `Note: ${text}` : `You: ${text}`,
            time: 'Just now',
            thread: [...t.thread, newMsg],
          };
        }
        return t;
      })
    );

    setComposerText('');

    if (composerMode === 'reply') {
      apiFetch(`/inbox/conversations/${activeConvo.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      }).catch(() => {});
      addToast({ type: 'success', message: 'Reply sent' });
    } else {
      apiFetch(`/inbox/conversations/${activeConvo.id}/note`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      }).catch(() => {});
      addToast({ type: 'info', message: 'Internal note saved' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const firstName = activeConvo?.name ? activeConvo.name.split(' ')[0] : 'customer';
  const filterCount = selectedKinds.length + selectedNets.length + selectedSents.length;

  return (
    <div className="view" data-view="inbox">
      <h1 className="head__title ib-h1" tabIndex={-1}>
        Inbox
      </h1>

      <div className={`card ib-app ${showInfo ? 'is-info' : ''}`}>
        {/* Left Pane: Conversations List */}
        <aside className="ib-side" aria-label="Conversations">
          {/* Header */}
          <header className="ib-side__head">
            <div className="ib-side__title">
              <h2>
                Inbox <span className="ib-side__n">{counts.all}</span>
              </h2>
              <p className="ib-side__sub">
                <b>{counts.unread}</b> unread · <b>22m</b> median first reply
              </p>
            </div>
            <div className="ib-side__tools">
              <button
                ref={filterBtnRef}
                type="button"
                className="ib-ic ib-filters"
                aria-label="Filters"
                title="Filters"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="ico" />
                {filterCount > 0 && <span className="ib-fbadge">{filterCount}</span>}
              </button>
              <button
                type="button"
                className="ib-ic"
                aria-label="Mark all read"
                title="Mark all read"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="ico" />
              </button>
            </div>
          </header>

          {/* Search bar with / keyboard shortcut */}
          <label className="search ib-search">
            <Search className="ico" />
            <input
              type="search"
              placeholder="Search or filter chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
              autoComplete="off"
            />
            <kbd className="ib-search__kbd">/</kbd>
          </label>

          {/* Filter Chips Bar */}
          <div className="ib-chips" role="group" aria-label="Views">
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
            >
              All <b className="ib-chip__n">{counts.all}</b>
            </button>
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'unread'}
              onClick={() => setActiveTab('unread')}
            >
              Unread <b className="ib-chip__n">{counts.unread}</b>
            </button>
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'mine'}
              onClick={() => setActiveTab('mine')}
            >
              Mine {counts.mine > 0 && <b className="ib-chip__n">{counts.mine}</b>}
            </button>
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'unassigned'}
              onClick={() => setActiveTab('unassigned')}
            >
              Unassigned <b className="ib-chip__n">{counts.unassigned}</b>
            </button>
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'priority'}
              onClick={() => setActiveTab('priority')}
            >
              Priority <b className="ib-chip__n">{counts.priority}</b>
            </button>
            <button
              type="button"
              className="ib-chip"
              aria-pressed={activeTab === 'done'}
              onClick={() => setActiveTab('done')}
            >
              Done {counts.done > 0 && <b className="ib-chip__n">{counts.done}</b>}
            </button>
          </div>

          {/* Threads List */}
          <div className="ib-rows" role="list" aria-label="Conversations">
            {filteredThreads.length === 0 ? (
              <div className="empty">
                <Inbox className="ico" />
                <p className="empty__title">Nothing matches</p>
                <p className="empty__text">No conversation fits these filters.</p>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setActiveTab('all');
                    setSearchQuery('');
                    setSelectedKinds([]);
                    setSelectedNets([]);
                    setSelectedSents([]);
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredThreads.map((item) => {
                const isSelected = item.id === activeConvo?.id;
                return (
                  <div className="ib-rw" role="listitem" key={item.id} data-key={item.id}>
                    <button
                      type="button"
                      className={`ib-row ${item.unread ? 'is-unread' : ''}`}
                      aria-current={isSelected}
                      onClick={() => handleSelectConvo(item.id)}
                    >
                      {/* Avatar with network badge */}
                      <span className="ib-face">
                        <div className="av av--lg">
                          {item.avatar ? (
                            <img src={item.avatar} alt={item.name} className="thumb" />
                          ) : (
                            item.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="ib-netb">
                          <span className={`net net--xs net--${item.network.toLowerCase()}`}>
                            <NetworkIcon network={item.network} className="ico" />
                          </span>
                        </span>
                      </span>

                      {/* Main text & snippet */}
                      <span className="ib-row__main">
                        <span className="ib-row__l1">
                          <b className="ib-row__name">{item.name}</b>
                          <i
                            className={`ib-bdot tone--${item.brandTone || 'coral'}`}
                            title={item.brandName}
                          />
                          <time className="ib-row__time">{item.time}</time>
                        </span>
                        <span className="ib-row__l2">
                          <span className="ib-row__kind" title={item.kind}>
                            {item.kind === 'comment' ? (
                              <MessageCircle className="ico" />
                            ) : item.kind === 'dm' ? (
                              <Mail className="ico" />
                            ) : item.kind === 'mention' ? (
                              <AtSign className="ico" />
                            ) : (
                              <Star className="ico" />
                            )}
                          </span>
                          <span className="ib-row__snip">{item.snippet}</span>
                          <span className="ib-row__end">
                            {item.status === 'done' && (
                              <span className="ib-row__done" title="Done">
                                <Check className="ico" />
                              </span>
                            )}
                            {item.priority && (
                              <span className="ib-row__flag" title="Priority">
                                <Flag className="ico" />
                              </span>
                            )}
                            {item.unread && item.unreadCount > 0 && (
                              <b className="ib-count">{item.unreadCount}</b>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Active Chat Section */}
        <section className="ib-chat" aria-label="Conversation">
          {!activeConvo ? (
            <div className="ib-th ib-th--empty">
              <div className="ib-hello">
                <span className="ib-hello__ico">
                  <Inbox className="ico" />
                </span>
                <h2>Pick a conversation</h2>
                <p>Every comment, message, mention and review from all your networks lands in one list.</p>
                <dl className="ib-keys">
                  <div>
                    <dt>
                      <kbd>J</kbd>
                      <kbd>K</kbd>
                    </dt>
                    <dd>Next / previous</dd>
                  </div>
                  <div>
                    <dt>
                      <kbd>E</kbd>
                    </dt>
                    <dd>Mark done</dd>
                  </div>
                  <div>
                    <dt>
                      <kbd>R</kbd>
                    </dt>
                    <dd>Reply</dd>
                  </div>
                  <div>
                    <dt>
                      <kbd>/</kbd>
                    </dt>
                    <dd>Search</dd>
                  </div>
                  <div>
                    <dt>
                      <kbd>Enter</kbd>
                    </dt>
                    <dd>Send</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <div className="ib-th" data-id={activeConvo.id}>
              {/* Header */}
              <header className="ib-ch">
                <button
                  type="button"
                  className="ib-ic ib-back"
                  aria-label="Back to chats"
                  onClick={() => setSelectedId('')}
                >
                  <ArrowLeft className="ico" />
                </button>

                <button
                  type="button"
                  className="ib-ch__who"
                  onClick={() => setShowInfo(!showInfo)}
                  aria-label={`Contact info for ${activeConvo.name}`}
                >
                  <span className="ib-face ib-face--sm">
                    <div className="av av--md">
                      {activeConvo.avatar ? (
                        <img src={activeConvo.avatar} alt={activeConvo.name} className="thumb" />
                      ) : (
                        activeConvo.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="ib-netb">
                      <span className={`net net--xs net--${activeConvo.network.toLowerCase()}`}>
                        <NetworkIcon network={activeConvo.network} className="ico" />
                      </span>
                    </span>
                  </span>
                  <span className="ib-ch__txt">
                    <b>{activeConvo.name}</b>
                    <small>
                      {activeConvo.networkName || activeConvo.network} · {activeConvo.contextSubtext}
                    </small>
                  </span>
                </button>

                <div className="ib-ch__tools">
                  <button
                    type="button"
                    className="ib-ic ib-assign"
                    aria-label="Assign"
                    title={activeConvo.assignee ? `Assigned to ${activeConvo.assignee.name}` : 'Assign'}
                    onClick={() => {
                      addToast({ type: 'info', message: 'Assigned to you' });
                    }}
                  >
                    <UserPlus className="ico" />
                  </button>
                  <button
                    type="button"
                    className="ib-ic ib-pri"
                    aria-label="Mark priority"
                    aria-pressed={activeConvo.priority}
                    title={activeConvo.priority ? 'Remove priority' : 'Mark as priority'}
                    onClick={togglePriority}
                  >
                    <Flag className="ico" />
                  </button>
                  <button
                    type="button"
                    className={`ib-ic ib-done ${activeConvo.status === 'done' ? 'is-done' : ''}`}
                    aria-label="Mark done"
                    title={activeConvo.status === 'open' ? 'Mark done (E)' : 'Reopen (E)'}
                    onClick={toggleDone}
                  >
                    <Check className="ico" />
                  </button>
                  <button
                    type="button"
                    className={`ib-ic ib-infobtn ${showInfo ? 'is-active' : ''}`}
                    aria-pressed={showInfo}
                    aria-label="Contact info"
                    title="Contact info"
                    onClick={() => setShowInfo(!showInfo)}
                  >
                    <Info className="ico" />
                  </button>
                  <button
                    type="button"
                    className="ib-ic"
                    aria-label="More actions"
                    title="More actions"
                    onClick={() => setShowInfo(!showInfo)}
                  >
                    <MoreHorizontal className="ico" />
                  </button>
                </div>
              </header>

              {/* Post context pin banner */}
              {activeConvo.postTitle && (
                <button
                  type="button"
                  className="ib-pin"
                  aria-label={`Open the post: ${activeConvo.postTitle}`}
                >
                  <span className="ib-pin__img">
                    {activeConvo.postMedia ? (
                      <img src={activeConvo.postMedia} alt="" className="thumb" />
                    ) : (
                      <Star className="ico" />
                    )}
                  </span>
                  <span className="ib-pin__txt">
                    <small>
                      On {activeConvo.brandName}’s post · {activeConvo.postDate || 'Oct 24'}
                    </small>
                    <b>{activeConvo.postTitle}</b>
                  </span>
                  <ArrowUpRight className="ico ib-pin__go" />
                </button>
              )}

              {/* Chat scroll container with subtle dot pattern */}
              <div className="ib-scroll">
                <div className="ib-msgs" role="log" aria-label={`Conversation with ${activeConvo.name}`}>
                  <section className="ib-dg">
                    <div className="ib-day">
                      <span>Mon, Oct 26</span>
                    </div>

                    {activeConvo.thread.map((msg, idx) => {
                      const isFirst = idx === 0 || activeConvo.thread[idx - 1]?.from !== msg.from;

                      if (msg.note) {
                        return (
                          <div className="ib-m ib-m--note is-first" key={msg.id}>
                            <div className="ib-note">
                              <span className="ib-note__label">
                                <EyeOff className="ico" />
                                Note · only your team sees this
                              </span>
                              <p className="ib-note__text">{msg.text}</p>
                              <span className="ib-note__meta">
                                {msg.author || 'Team'} · {msg.time}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      const isThem = msg.from === 'them';

                      return (
                        <div
                          key={msg.id}
                          className={`ib-m ib-m--${isThem ? 'them' : 'us'} ${isFirst ? 'is-first' : ''}`}
                        >
                          <div className={`ib-bub ib-bub--${isThem ? 'them' : 'us'} ${isFirst ? 'has-tail' : ''}`}>
                            <span className="ib-bub__text">{msg.text}</span>
                            <span className="ib-bub__sp" aria-hidden="true" />
                            <span className="ib-bub__meta">
                              <time>{msg.time}</time>
                              {!isThem && (
                                <span className="ib-tick is-read" aria-label="Read">
                                  <CheckCheck className="ico" />
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </section>
                </div>
              </div>

              {/* Bottom Reply Bar */}
              <form
                className={`ib-bar ${composerMode === 'note' ? 'is-note' : ''}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <button
                  type="button"
                  className="ib-ic ib-attach"
                  title="Saved replies"
                  onClick={() => setShowSavedReplies(!showSavedReplies)}
                >
                  <Plus className="ico" />
                </button>

                <button
                  type="button"
                  className="ib-ic ib-notebtn"
                  aria-pressed={composerMode === 'note'}
                  title={composerMode === 'note' ? 'Switch to reply' : 'Internal note'}
                  onClick={() => setComposerMode((prev) => (prev === 'reply' ? 'note' : 'reply'))}
                >
                  <FileText className="ico" />
                </button>

                <div className="ib-input">
                  <label className="sr" htmlFor="ib-ta">
                    {composerMode === 'note' ? 'Internal note' : `Reply to ${activeConvo.name}`}
                  </label>
                  <textarea
                    id="ib-ta"
                    rows={1}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      composerMode === 'note'
                        ? 'Note for the team…'
                        : `Reply to ${firstName}`
                    }
                    enterKeyHint="send"
                  />
                </div>

                <button
                  type="submit"
                  className="ib-send"
                  disabled={!composerText.trim()}
                  aria-label={composerMode === 'note' ? 'Add note' : 'Send'}
                  title={composerMode === 'note' ? 'Add note (Enter)' : 'Send (Enter)'}
                >
                  {composerMode === 'note' ? <FileText className="ico" /> : <Send className="ico" />}
                </button>
              </form>

              {/* Quick Saved Replies Dropdown */}
              {showSavedReplies && (
                <div
                  className="pop pop--wide"
                  style={{
                    position: 'absolute',
                    bottom: '68px',
                    left: '12px',
                    zIndex: 40,
                  }}
                >
                  <div className="pop__head">
                    <span className="pop__title">Saved replies</span>
                    <button
                      type="button"
                      className="ib-ic"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => setShowSavedReplies(false)}
                    >
                      <X className="ico" />
                    </button>
                  </div>
                  <div className="pop__list">
                    {[
                      {
                        id: 'r1',
                        title: 'Thanks!',
                        text: 'Thank you so much — that means a lot to the whole team 🧡',
                      },
                      {
                        id: 'r2',
                        title: 'Shipping',
                        text: 'We ship worldwide! Orders leave within 2 working days and you’ll get tracking by email.',
                      },
                      {
                        id: 'r3',
                        title: 'Sorry + DM',
                        text: 'We’re really sorry about this. Could you send us your order number in a DM? We’ll sort it today.',
                      },
                    ].map((rep) => (
                      <button
                        key={rep.id}
                        type="button"
                        className="pop__row ib-rep"
                        onClick={() => {
                          setComposerText((prev) => (prev ? `${prev} ${rep.text}` : rep.text));
                          setShowSavedReplies(false);
                        }}
                      >
                        <span className="ibtn ibtn--sm">
                          <Sparkles className="ico" />
                        </span>
                        <span className="ib-rep__txt">
                          <b>{rep.title}</b>
                          <small>{rep.text}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Contact Info Side Drawer */}
        {activeConvo && (
          <aside className="ib-info" aria-label="Contact info">
            <header className="ib-info__head">
              <button
                type="button"
                className="ib-ic"
                aria-label="Close contact info"
                onClick={() => setShowInfo(false)}
              >
                <X className="ico" />
              </button>
              <h3>Contact info</h3>
            </header>

            <div className="ib-info__body">
              {/* Hero */}
              <div className="ib-info__hero">
                <span className="ib-face ib-face--xl">
                  <div className="av av--lg">
                    {activeConvo.avatar ? (
                      <img src={activeConvo.avatar} alt={activeConvo.name} className="thumb" />
                    ) : (
                      activeConvo.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                </span>
                <h2>{activeConvo.name}</h2>
                <p>@{activeConvo.handle}</p>
                <p className="ib-info__meta">
                  <span className={`net net--xs net--${activeConvo.network.toLowerCase()}`}>
                    <NetworkIcon network={activeConvo.network} className="ico" />
                  </span>
                  {activeConvo.networkName || activeConvo.network} · {activeConvo.followers || '3,180'} followers
                </p>
              </div>

              {/* Conversation Section */}
              <section className="ib-sec">
                <h4>Conversation</h4>
                <dl className="ib-kv">
                  <div>
                    <dt>Kind</dt>
                    <dd>
                      <span className="ib-kind">
                        {activeConvo.kind === 'comment' ? (
                          <MessageCircle className="ico" />
                        ) : activeConvo.kind === 'dm' ? (
                          <Mail className="ico" />
                        ) : activeConvo.kind === 'mention' ? (
                          <AtSign className="ico" />
                        ) : (
                          <Star className="ico" />
                        )}
                        {activeConvo.kind.charAt(0).toUpperCase() + activeConvo.kind.slice(1)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={`ib-status ib-status--${activeConvo.status}`}>
                        {activeConvo.status === 'open' ? 'Open' : 'Done'}
                      </span>
                    </dd>
                  </div>
                  <div className="ib-kv--stack">
                    <dt>Sentiment</dt>
                    <dd>
                      <div className="ib-segs" role="group" aria-label="Sentiment">
                        {(['pos', 'neu', 'neg'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="ib-seg"
                            aria-pressed={activeConvo.sentiment === s}
                            onClick={() => setSentiment(s)}
                          >
                            <i className={`ib-sdot ib-sdot--${s}`} />
                            {s === 'pos' ? 'Positive' : s === 'neu' ? 'Neutral' : 'Negative'}
                          </button>
                        ))}
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt id="ib-pri-l">Priority</dt>
                    <dd>
                      <button
                        type="button"
                        className="switch"
                        role="switch"
                        aria-checked={activeConvo.priority}
                        aria-labelledby="ib-pri-l"
                        onClick={togglePriority}
                      />
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Assignee Section */}
              <section className="ib-sec">
                <h4>Assignee</h4>
                <button
                  type="button"
                  className="ib-assignee"
                  onClick={() => addToast({ type: 'info', message: 'Assigned to you' })}
                >
                  <span className="ib-assignee__none">
                    <UserPlus className="ico" />
                  </span>
                  <span>
                    <b>{activeConvo.assignee?.name || 'Unassigned'}</b>
                    <small>
                      {activeConvo.assignee ? activeConvo.assignee.title : 'Hand this to a teammate'}
                    </small>
                  </span>
                </button>
              </section>

              {/* Tags Section */}
              <section className="ib-sec">
                <h4>Tags</h4>
                <div className="ib-tags">
                  {activeConvo.tags.map((tag) => (
                    <span className="ib-tag" key={tag}>
                      #{tag}
                      <button
                        type="button"
                        className="ib-tag__x"
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => {
                          setThreads((prev) =>
                            prev.map((t) =>
                              t.id === activeConvo.id
                                ? { ...t, tags: t.tags.filter((x) => x !== tag) }
                                : t
                            )
                          );
                        }}
                      >
                        <X className="ico" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="chip ib-addtag"
                    onClick={() => {
                      const tag = prompt('Enter new tag:');
                      if (tag && tag.trim()) {
                        const clean = tag.trim().toLowerCase().replace(/^#/, '');
                        setThreads((prev) =>
                          prev.map((t) =>
                            t.id === activeConvo.id
                              ? { ...t, tags: [...new Set([...t.tags, clean])] }
                              : t
                          )
                        );
                      }
                    }}
                  >
                    <Plus className="ico" />
                    Tag
                  </button>
                </div>
              </section>

              {/* Activity Section */}
              <section className="ib-sec">
                <h4>Activity</h4>
                <dl className="ib-kv">
                  <div>
                    <dt>Messages</dt>
                    <dd>
                      {activeConvo.thread.length} <small>· {activeConvo.thread.length} in · 0 out</small>
                    </dd>
                  </div>
                  <div>
                    <dt>First contact</dt>
                    <dd>Oct 24 · 10:27 AM</dd>
                  </div>
                  <div>
                    <dt>Last message</dt>
                    <dd>{activeConvo.time}</dd>
                  </div>
                </dl>
              </section>

              {/* Foot Action */}
              <div className="ib-info__foot">
                <button
                  type="button"
                  className={`btn ${activeConvo.status === 'open' ? 'btn--pine' : 'btn--ghost'}`}
                  onClick={toggleDone}
                >
                  {activeConvo.status === 'open' ? (
                    <>
                      <Check className="ico" />
                      Mark done
                    </>
                  ) : (
                    <>
                      <RotateCw className="ico" />
                      Reopen
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Popover for Filters Modal */}
      {showFilters && (
        <>
          <div
            className="ib-fpop-scrim"
            onClick={() => setShowFilters(false)}
            aria-hidden="true"
          />
          <div
            className="pop ib-fpop"
            style={{
              position: 'fixed',
              top: `${filterPopPos.top}px`,
              left: `${filterPopPos.left}px`,
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Filter conversations"
          >
            <div
              className="pop__head"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pop__title" style={{ fontSize: '15px', fontWeight: 700 }}>
                  Filters
                </span>
                {filterCount > 0 && (
                  <span
                    className="badge badge--sea"
                    style={{ fontSize: '11px', padding: '1px 7px', fontWeight: 700 }}
                  >
                    {filterCount}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  style={{ height: '28px', padding: '0 9px', fontSize: '11.5px', borderRadius: '8px' }}
                  disabled={filterCount === 0}
                  onClick={() => {
                    setSelectedKinds([]);
                    setSelectedNets([]);
                    setSelectedSents([]);
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="ib-ic"
                  style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                  aria-label="Close filters"
                  title="Close"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="ico" style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>
            <div className="ib-fpop__body">
              <p className="ib-fpop__h">Kind</p>
              {[
                { id: 'comment', label: 'Comments', icon: <MessageCircle className="ico" /> },
                { id: 'dm', label: 'Messages', icon: <Mail className="ico" /> },
                { id: 'mention', label: 'Mentions', icon: <AtSign className="ico" /> },
                { id: 'review', label: 'Reviews', icon: <Star className="ico" /> },
              ].map((k) => (
                <label className="ib-fchk" key={k.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={selectedKinds.includes(k.id)}
                    onChange={(e) => {
                      setSelectedKinds((prev) =>
                        e.target.checked ? [...prev, k.id] : prev.filter((x) => x !== k.id)
                      );
                    }}
                  />
                  {k.icon}
                  <span className="ib-fchk__lab">{k.label}</span>
                </label>
              ))}

              <p className="ib-fpop__h">Network</p>
              {[
                { id: 'instagram', label: 'Instagram' },
                { id: 'facebook', label: 'Facebook' },
                { id: 'threads', label: 'Threads' },
                { id: 'pinterest', label: 'Pinterest' },
                { id: 'tiktok', label: 'TikTok' },
              ].map((n) => (
                <label className="ib-fchk" key={n.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={selectedNets.includes(n.id)}
                    onChange={(e) => {
                      setSelectedNets((prev) =>
                        e.target.checked ? [...prev, n.id] : prev.filter((x) => x !== n.id)
                      );
                    }}
                  />
                  <span className={`net net--xs net--${n.id}`}>
                    <NetworkIcon network={n.id} className="ico" />
                  </span>
                  <span className="ib-fchk__lab">{n.label}</span>
                </label>
              ))}

              <p className="ib-fpop__h">Sentiment</p>
              {[
                { id: 'pos', label: 'Positive', dot: 'pos' },
                { id: 'neu', label: 'Neutral', dot: 'plain' },
                { id: 'neg', label: 'Negative', dot: 'neg' },
              ].map((s) => (
                <label className="ib-fchk" key={s.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={selectedSents.includes(s.id)}
                    onChange={(e) => {
                      setSelectedSents((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                      );
                    }}
                  />
                  <i className={`ib-sdot ib-sdot--${s.dot}`} />
                  <span className="ib-fchk__lab">{s.label}</span>
                </label>
              ))}
            </div>
            <div
              className="ib-fpop__foot"
              style={{
                padding: '8px 10px 6px',
                borderTop: '1px solid var(--line)',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="btn btn--ink"
                style={{
                  width: '100%',
                  height: '36px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '12px',
                }}
                onClick={() => setShowFilters(false)}
              >
                {filterCount > 0 ? `Apply Filters (${filterCount})` : 'Done'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
