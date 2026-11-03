import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { NetworkIcon } from './NetworkIcon.js';
import {
  Search,
  ArrowUpRight,
  ChevronRight,
  PenSquare,
  Share2,
  Users,
  Sun,
  Moon,
  Laptop,
  LogOut,
  MessageSquare,
  FileText,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  label: string;
  subtitle: string;
  category: 'PAGES' | 'ACTIONS' | 'POSTS' | 'CONVERSATIONS' | 'CHANNELS';
  action: () => void;
  icon?: any;
  extra?: React.ReactNode;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Theme detection state: adapts to light mode, dark mode, and system preference
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    // If 'system' or unset, check DOM data-theme attribute or OS preference
    const docTheme = document.documentElement.getAttribute('data-theme');
    if (docTheme === 'dark') return true;
    if (docTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen to system theme changes and DOM data-theme / class mutations
  useEffect(() => {
    const checkTheme = () => {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        setIsDark(true);
        return;
      }
      if (saved === 'light') {
        setIsDark(false);
        return;
      }
      // System mode or not set: resolve to OS media query
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    checkTheme();

    // 1. OS system theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme');
      if (!saved || saved === 'system') {
        setIsDark(e.matches);
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    // 2. DOM mutation observer for manual switches via Dock or Settings
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const hasDarkClass = document.documentElement.classList.contains('dark');
      setIsDark(currentTheme === 'dark' || hasDarkClass);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      observer.disconnect();
    };
  }, []);

  // Keyboard shortcut listener: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search query
  const { data: searchResults } = useQuery({
    queryKey: ['command-search', query],
    queryFn: async () => {
      if (!query.trim()) return null;
      return apiFetch<any>(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    enabled: isOpen && query.trim().length > 1,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    const nextTheme = nextIsDark ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(nextIsDark);
  };

  const setSystemTheme = () => {
    localStorage.setItem('theme', 'system');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(prefersDark);
  };

  const staticPages = useMemo(
    () => [
      { label: 'Overview', path: '/overview' },
      { label: 'Compose', path: '/compose' },
      { label: 'Calendar', path: '/calendar' },
      { label: 'Inbox', path: '/inbox' },
      { label: 'Approvals', path: '/approvals' },
      { label: 'Listening', path: '/listening' },
      { label: 'Analytics', path: '/analytics' },
      { label: 'Channels', path: '/channels' },
      { label: 'Library', path: '/library' },
      { label: 'Team', path: '/team' },
      { label: 'Settings', path: '/settings' },
    ],
    []
  );

  const staticActions = useMemo(
    () => [
      {
        id: 'action-compose',
        label: 'Create Post',
        subtitle: 'Open post composer',
        action: () => navigate('/compose'),
        icon: PenSquare,
      },
      {
        id: 'action-channel',
        label: 'Connect Channel',
        subtitle: 'Link social media account',
        action: () => navigate('/channels'),
        icon: Share2,
      },
      {
        id: 'action-team',
        label: 'Invite Teammate',
        subtitle: 'Add user to workspace',
        action: () => navigate('/team'),
        icon: Users,
      },
      {
        id: 'action-theme',
        label: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: isDark ? 'Switch appearance to light mode' : 'Switch appearance to dark mode',
        action: () => toggleTheme(),
        icon: isDark ? Sun : Moon,
      },
      {
        id: 'action-system-theme',
        label: 'Use System Theme',
        subtitle: 'Automatically match device operating system theme',
        action: () => setSystemTheme(),
        icon: Laptop,
      },
      {
        id: 'action-logout',
        label: 'Log Out',
        subtitle: 'Sign out of your session',
        action: () => logout(),
        icon: LogOut,
      },
    ],
    [navigate, logout, isDark]
  );

  const allItems: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];
    const q = query.trim().toLowerCase();

    // 1. Pages
    const matchedPages = staticPages.filter((p) =>
      !q ? true : p.label.toLowerCase().includes(q)
    );
    matchedPages.forEach((p) => {
      list.push({
        id: `page-${p.path}`,
        label: p.label,
        subtitle: 'Go to page',
        category: 'PAGES',
        action: () => navigate(p.path),
      });
    });

    // 2. Search Results: Posts
    if (searchResults?.posts?.length) {
      searchResults.posts.forEach((post: any) => {
        list.push({
          id: `post-${post.id}`,
          label: post.caption || 'Untitled Post',
          subtitle: `Post • ${post.status?.toUpperCase() || 'DRAFT'}`,
          category: 'POSTS',
          action: () => navigate(`/compose/${post.id}`),
          icon: FileText,
          extra: (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 mr-1"
              style={{ backgroundColor: post.brandColor || '#4F46E5' }}
            />
          ),
        });
      });
    }

    // 3. Search Results: Conversations
    if (searchResults?.conversations?.length) {
      searchResults.conversations.forEach((convo: any) => {
        list.push({
          id: `convo-${convo.id}`,
          label: convo.authorName || 'Conversation',
          subtitle: `Inbox • @${convo.channelHandle || 'unknown'}`,
          category: 'CONVERSATIONS',
          action: () => navigate(`/inbox/${convo.id}`),
          icon: MessageSquare,
          extra: convo.network ? (
            <NetworkIcon network={convo.network} className="w-3.5 h-3.5 shrink-0" />
          ) : null,
        });
      });
    }

    // 4. Search Results: Channels
    if (searchResults?.channels?.length) {
      searchResults.channels.forEach((ch: any) => {
        list.push({
          id: `channel-${ch.id}`,
          label: `@${ch.handle}`,
          subtitle: `Channel • ${ch.brandName || ch.network}`,
          category: 'CHANNELS',
          action: () => navigate('/channels'),
          extra: <NetworkIcon network={ch.network} className="w-3.5 h-3.5 shrink-0" />,
        });
      });
    }

    // 5. Actions
    const matchedActions = staticActions.filter((a) =>
      !q ? true : a.label.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );
    matchedActions.forEach((a) => {
      list.push({
        id: a.id,
        label: a.label,
        subtitle: a.subtitle,
        category: 'ACTIONS',
        action: a.action,
        icon: a.icon,
      });
    });

    return list;
  }, [staticPages, staticActions, query, searchResults, navigate]);

  // Group items by category
  const categories = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    allItems.forEach((item) => {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    });
    return Array.from(map.entries());
  }, [allItems]);

  // Arrow key navigation listener
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIndex(0);
  }, [query, isOpen]);

  // Scroll selected item into view if outside container
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex].action);
        }
      }
    };
    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
  }, [isOpen, selectedIndex, allItems]);

  const handleSelect = (action: () => void) => {
    action();
    setIsOpen(false);
    setQuery('');
  };

  // Color variables tailored for Light Mode vs Dark Mode
  const c = useMemo(
    () =>
      isDark
        ? {
            overlayBg: 'rgba(0, 0, 0, 0.6)',
            containerBg: '#1f2024',
            border: 'rgba(255, 255, 255, 0.06)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
            divider: 'rgba(255, 255, 255, 0.06)',
            searchIcon: 'rgba(255, 255, 255, 0.45)',
            inputText: '#ffffff',
            placeholder: 'rgba(255, 255, 255, 0.45)',
            escBg: 'rgba(255, 255, 255, 0.06)',
            escBorder: 'rgba(255, 255, 255, 0.06)',
            escText: 'rgba(255, 255, 255, 0.6)',
            sectionHeader: 'rgba(255, 255, 255, 0.5)',
            rowHover: 'rgba(255, 255, 255, 0.05)',
            rowSelected: 'rgba(255, 255, 255, 0.08)',
            iconCircleBg: 'rgba(255, 255, 255, 0.07)',
            iconCircleColor: 'rgba(255, 255, 255, 0.75)',
            rowTitle: '#ffffff',
            rowSubtitle: 'rgba(255, 255, 255, 0.5)',
            chevronSelected: 'rgba(255, 255, 255, 0.7)',
            chevronUnselected: 'rgba(255, 255, 255, 0.35)',
            scrollbarThumb: 'rgba(255, 255, 255, 0.15)',
            scrollbarThumbHover: 'rgba(255, 255, 255, 0.28)',
            emptyIcon: 'rgba(255, 255, 255, 0.3)',
            emptyTitle: 'rgba(255, 255, 255, 0.8)',
            emptySub: 'rgba(255, 255, 255, 0.4)',
          }
        : {
            overlayBg: 'rgba(16, 18, 20, 0.38)',
            containerBg: '#ffffff',
            border: 'rgba(22, 25, 29, 0.08)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            divider: 'rgba(22, 25, 29, 0.07)',
            searchIcon: 'rgba(22, 25, 29, 0.45)',
            inputText: '#16191d',
            placeholder: 'rgba(22, 25, 29, 0.4)',
            escBg: 'rgba(22, 25, 29, 0.05)',
            escBorder: 'rgba(22, 25, 29, 0.08)',
            escText: 'rgba(22, 25, 29, 0.55)',
            sectionHeader: 'rgba(22, 25, 29, 0.45)',
            rowHover: 'rgba(22, 25, 29, 0.035)',
            rowSelected: 'rgba(22, 25, 29, 0.06)',
            iconCircleBg: 'rgba(22, 25, 29, 0.05)',
            iconCircleColor: 'rgba(22, 25, 29, 0.7)',
            rowTitle: '#16191d',
            rowSubtitle: 'rgba(22, 25, 29, 0.5)',
            chevronSelected: 'rgba(22, 25, 29, 0.75)',
            chevronUnselected: 'rgba(22, 25, 29, 0.35)',
            scrollbarThumb: 'rgba(22, 25, 29, 0.15)',
            scrollbarThumbHover: 'rgba(22, 25, 29, 0.28)',
            emptyIcon: 'rgba(22, 25, 29, 0.3)',
            emptyTitle: 'rgba(22, 25, 29, 0.8)',
            emptySub: 'rgba(22, 25, 29, 0.4)',
          },
    [isDark]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-[14vh] p-3 sm:p-4 transition-all"
      style={{
        backgroundColor: c.overlayBg,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        animation: 'paletteOverlayFade 150ms ease-out forwards',
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-[640px] max-w-[94vw] h-[min(440px,calc(100dvh-32px))] max-h-[calc(100dvh-32px)] overflow-hidden flex flex-col transition-colors duration-150"
        style={{
          backgroundColor: c.containerBg,
          border: `1px solid ${c.border}`,
          borderRadius: 'clamp(18px, 4vw, 28px)',
          boxShadow: c.boxShadow,
          animation: 'paletteModalScale 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Custom scrollbar and animations styling */}
        <style>{`
          @keyframes paletteOverlayFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes paletteModalScale {
            from {
              opacity: 0;
              transform: scale(0.97);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          .command-palette-scroll {
            scrollbar-width: thin;
            scrollbar-color: ${c.scrollbarThumb} transparent;
          }
          .command-palette-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .command-palette-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .command-palette-scroll::-webkit-scrollbar-thumb {
            background: ${c.scrollbarThumb};
            border-radius: 9999px;
          }
          .command-palette-scroll::-webkit-scrollbar-thumb:hover {
            background: ${c.scrollbarThumbHover};
          }
        `}</style>

        {/* Search Header Bar (60px high, 20px padding) */}
        <div
          className="h-[60px] min-h-[60px] px-5 flex items-center space-x-3.5 shrink-0 transition-colors duration-150"
          style={{
            borderBottom: `1px solid ${c.divider}`,
          }}
        >
          <Search
            className="w-[18px] h-[18px] shrink-0"
            style={{ color: c.searchIcon }}
          />
          <input
            type="text"
            autoFocus
            placeholder="Search posts, conversations, people, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[17px] focus:outline-none focus:ring-0 border-none shadow-none font-normal"
            style={{
              color: c.inputText,
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 text-[10px] font-mono rounded-[8px] cursor-pointer transition-opacity hover:opacity-80 shrink-0"
            style={{
              background: c.escBg,
              border: `1px solid ${c.escBorder}`,
              color: c.escText,
            }}
          >
            esc
          </button>
        </div>

        {/* Scrollable Results List (380px height showing 5 items cleanly + ACTIONS peeking) */}
        <div
          ref={listRef}
          className="command-palette-scroll flex-1 overflow-y-auto px-2 py-1.5 transition-colors duration-150"
          style={{
            backgroundColor: c.containerBg,
          }}
        >
          {allItems.length === 0 ? (
            <div className="py-14 text-center">
              <Search
                className="w-8 h-8 mx-auto mb-2.5"
                style={{ color: c.emptyIcon }}
              />
              <p
                className="text-[14px] font-medium"
                style={{ color: c.emptyTitle }}
              >
                No results found for "{query}"
              </p>
              <p
                className="text-[12px] mt-1"
                style={{ color: c.emptySub }}
              >
                Try searching for pages, posts, or actions
              </p>
            </div>
          ) : (
            categories.map(([category, items]) => (
              <div key={category} className="mb-2">
                {/* Section Header */}
                <div
                  className="text-[12px] font-medium uppercase"
                  style={{
                    letterSpacing: '0.08em',
                    color: c.sectionHeader,
                    padding: '16px 14px 8px 18px',
                  }}
                >
                  {category}
                </div>

                {/* Rows with 6px gap, 8px horizontal list margin, 16px border-radius */}
                <div className="flex flex-col space-y-[6px]">
                  {items.map((item) => {
                    const globalIdx = allItems.findIndex((it) => it.id === item.id);
                    const isSelected = selectedIndex === globalIdx;
                    const Icon = item.icon || ArrowUpRight;

                    return (
                      <div
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => handleSelect(item.action)}
                        className="w-full flex items-center justify-between cursor-pointer text-left select-none"
                        style={{
                          minHeight: '58px',
                          height: '58px',
                          padding: '10px 14px',
                          borderRadius: '16px',
                          backgroundColor: isSelected ? c.rowSelected : 'transparent',
                          transition: 'background-color 120ms ease, color 120ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = c.rowHover;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          {/* 40px circle icon */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              backgroundColor: c.iconCircleBg,
                              color: c.iconCircleColor,
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Title 16px font-semibold + Subtitle 13px font-normal */}
                          <div className="flex flex-col min-w-0">
                            <span
                              className="text-[16px] font-semibold truncate leading-tight"
                              style={{ color: c.rowTitle }}
                            >
                              {item.label}
                            </span>
                            <span
                              className="text-[13px] font-normal truncate mt-0.5"
                              style={{ color: c.rowSubtitle }}
                            >
                              {item.subtitle}
                            </span>
                          </div>
                        </div>

                        {/* Right chevron 18px: dynamic contrast */}
                        <div className="flex items-center space-x-2 shrink-0 ml-3">
                          {item.extra}
                          <ChevronRight
                            className="w-[18px] h-[18px]"
                            style={{
                              color: isSelected ? c.chevronSelected : c.chevronUnselected,
                              transition: 'color 120ms ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

