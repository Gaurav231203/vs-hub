import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import gsap from 'gsap';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { PostDetailDrawer } from '../approvals/PostDetailDrawer.js';
import { initMagnetic } from '../../lib/magnetic.js';
import { matchesBrand, getBrandCanonicalSlug } from '../../lib/brandHelper.js';

// SVG Icon Helpers
function SvgIcon({ name, className = 'ico' }: { name: string; className?: string }) {
  switch (name) {
    case 'calendar':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
      );
    case 'send':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 3.5 3.5 10.6l6.6 2.8 2.8 6.6z" />
          <path d="m10.1 13.4 4.2-4.2" />
        </svg>
      );
    case 'grid':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </svg>
      );
    case 'chevL':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14.5 6-6 6 6 6" />
        </svg>
      );
    case 'chevR':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      );
    case 'plus':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'flag':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5c.6 4.1 2.4 5.9 6.5 6.5-4.1.6-5.9 2.4-6.5 6.5-.6-4.1-2.4-5.9-6.5-6.5 4.1-.6 5.9-2.4 6.5-6.5z" />
          <path d="M18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" />
        </svg>
      );
    case 'alert':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 2.8 19.5h18.4z" />
          <path d="M12 10v4.5M12 17h.01" />
        </svg>
      );
    case 'grip':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="6.5" r="1.2" />
          <circle cx="15" cy="6.5" r="1.2" />
          <circle cx="9" cy="12" r="1.2" />
          <circle cx="15" cy="12" r="1.2" />
          <circle cx="9" cy="17.5" r="1.2" />
          <circle cx="15" cy="17.5" r="1.2" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.6" />
          <path d="M16.6 7.4h.01" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5 20.5v-7h2.6l.4-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.4a20 20 0 0 0-2.3-.1c-2.4 0-3.9 1.4-3.9 4v2.2H8v3h2.5v7" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 4c.4 2.4 2 4 4.5 4.2" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <path d="M8 10.5v6M8 7.5v.01M11.5 16.5v-6M11.5 13c0-1.8 1-2.6 2.3-2.6s2.2.8 2.2 2.6v3.5" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2.8" y="5.8" width="18.4" height="12.4" rx="4" />
          <path d="m10.3 9.3 4.7 2.7-4.7 2.7z" />
        </svg>
      );
    case 'pinterest':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M11.2 9.5c.8-1.6 4.3-1.5 4.3 1.3 0 2.3-1.4 3.6-2.8 3.6-1.1 0-1.6-.9-1.4-1.6M11.8 10.8 9.8 19.5" />
        </svg>
      );
    case 'threads':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.5 9.2C16 6.3 14.3 4.8 12 4.8 8.6 4.8 6.8 7.7 6.8 12s1.8 7.2 5.4 7.2c2.6 0 4.7-1.5 4.7-3.9 0-3.8-6.2-4.3-6.2-1.4 0 1.4 1.3 2 2.4 1.9 2.3-.2 2.8-2.4 2.8-4.8" />
        </svg>
      );
    case 'x':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4.5h4l10 15h-4z" />
          <path d="M18.5 4.5 13.4 10.4M5.5 19.5l5.1-5.9" />
        </svg>
      );
    default:
      return null;
  }
}

// Default Authentic Murmura Campaigns
const MURMURA_CAMPAIGNS = [
  { id: 'cp0', name: 'Autumn Pastry Fest', brand: 'SB', brandName: 'Starlight Bakery', tone: 'coral', startCol: 2, endCol: 9, row: 1, endLabel: 'until Nov 10' },
  { id: 'cp1', name: 'Spring Ritual launch', brand: 'WB', brandName: 'Wildroot Botanics', tone: 'pine', startCol: 2, endCol: 9, row: 2, endLabel: 'until Nov 4' },
  { id: 'cp2', name: 'Autumn harvest', brand: 'EO', brandName: 'Ember & Oak', tone: 'coral', startCol: 2, endCol: 9, row: 3, endLabel: 'until Nov 15' },
  { id: 'cp3', name: 'November bookings', brand: 'VG', brandName: 'Vantage Garage', tone: 'ink', startCol: 2, endCol: 9, row: 4, endLabel: 'until Nov 9' },
  { id: 'cp4', name: 'Autumn collection', brand: 'HH', brandName: 'Hollow Home', tone: 'butter', startCol: 2, endCol: 9, row: 5, endLabel: 'until Nov 19' },
];

// Default Scheduled Posts for Oct 26 - Nov 1
const DEFAULT_CALENDAR_POSTS = [
  {
    id: 'p-1',
    dayIndex: 0, // Monday 26
    timeStr: '8:30 AM',
    topHour: 2.5,
    lane: 0,
    lanes: 1,
    title: 'Booking for...',
    brand: 'VG',
    tone: 'coral',
    status: 'failed',
    net: 'facebook',
    thumb: '/photos/vantage-lift-sm.jpg',
    warn: true,
  },
  {
    id: 'p-2',
    dayIndex: 1, // Tuesday 27
    timeStr: '9:00 AM',
    topHour: 3.0,
    lane: 0,
    lanes: 2,
    title: 'New origin release...',
    brand: 'EO',
    tone: 'butter',
    status: 'pending',
    net: 'instagram',
  },
  {
    id: 'p-3',
    dayIndex: 1,
    timeStr: '9:30 AM',
    topHour: 3.5,
    lane: 1,
    lanes: 2,
    title: 'Slow morning pour...',
    brand: 'EO',
    tone: 'sea',
    status: 'scheduled',
    net: 'threads',
  },
  {
    id: 'p-4',
    dayIndex: 1,
    timeStr: '10:00 AM',
    topHour: 4.0,
    lane: 0,
    lanes: 1,
    title: 'Oak blend returns...',
    brand: 'EO',
    tone: 'butter',
    status: 'pending',
    net: 'instagram',
  },
  {
    id: 'p-5',
    dayIndex: 5, // Saturday 31
    timeStr: '9:00 AM',
    topHour: 3.0,
    lane: 0,
    lanes: 1,
    title: 'Meet calen...',
    brand: 'WB',
    tone: 'coral',
    status: 'scheduled',
    net: 'tiktok',
    thumb: '/photos/wild-daisy-sm.jpg',
  },
  {
    id: 'p-6',
    dayIndex: 6, // Sunday 1
    timeStr: '9:00 AM',
    topHour: 3.0,
    lane: 0,
    lanes: 2,
    title: 'Weekend ritual...',
    brand: 'EO',
    tone: 'sea',
    status: 'scheduled',
    net: 'instagram',
  },
  {
    id: 'p-7',
    dayIndex: 6,
    timeStr: '9:30 AM',
    topHour: 3.5,
    lane: 1,
    lanes: 2,
    title: 'Autumn drop list...',
    brand: 'HH',
    tone: 'sea',
    status: 'scheduled',
    net: 'pinterest',
  },
];

const HOLLOW_HOME_CALENDAR_POSTS = [
  {
    id: 'p-hh-1',
    dayIndex: 0, // Monday 26
    timeStr: '8:45 AM',
    topHour: 2.75,
    lane: 0,
    lanes: 1,
    title: 'The Låg so..',
    brand: 'HH',
    tone: 'sea',
    status: 'scheduled',
    net: 'instagram',
    nets: ['instagram', 'pinterest', 'facebook', 'youtube'],
    thumb: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'p-hh-2',
    dayIndex: 4, // Friday 30
    timeStr: '10:00 AM',
    topHour: 4.0,
    lane: 0,
    lanes: 1,
    title: 'New in: the..',
    brand: 'HH',
    tone: 'butter',
    status: 'pending',
    net: 'instagram',
    nets: ['instagram', 'pinterest'],
    thumb: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=300&auto=format&fit=crop&q=80',
  },
];

// Unscheduled Drafts Data
const DEFAULT_DRAFTS = [
  {
    id: 'dr-1',
    brand: 'EO',
    tone: 'coral',
    title: 'Draft: winter subscription tea...',
    author: 'Nia',
    scheduledText: 'pencilled Sun, Nov 1, 10:00 AM',
  },
  {
    id: 'dr-2',
    brand: 'HH',
    tone: 'butter',
    title: 'Pinterest board idea: “one roo...',
    author: 'Haruto',
    scheduledText: 'pencilled Tue, Nov 3, 10:00 AM',
  },
  {
    id: 'dr-3',
    brand: 'VG',
    tone: 'ink',
    title: 'Reel script: 60 seconds of foa...',
    author: 'Omar',
    scheduledText: 'pencilled Thu, Nov 5, 10:00 AM',
  },
  {
    id: 'dr-4',
    brand: 'WB',
    tone: 'pine',
    title: 'Ingredient spotlight series — ...',
    author: 'Elise',
    scheduledText: 'pencilled Sat, Nov 7, 10:00 AM',
  },
];

// Network Breakdown Data
const NETWORK_METRICS = [
  { net: 'instagram', name: 'Instagram', count: 20, pct: 1.0 },
  { net: 'tiktok', name: 'TikTok', count: 10, pct: 0.5 },
  { net: 'facebook', name: 'Facebook', count: 8, pct: 0.4 },
  { net: 'pinterest', name: 'Pinterest', count: 5, pct: 0.25 },
  { net: 'youtube', name: 'YouTube', count: 5, pct: 0.25 },
  { net: 'threads', name: 'Threads', count: 4, pct: 0.2 },
  { net: 'x', name: 'X', count: 3, pct: 0.15 },
  { net: 'linkedin', name: 'LinkedIn', count: 2, pct: 0.1 },
];

export function CalendarView() {
  const navigate = useNavigate();
  const context = useOutletContext<{ selectedBrandId?: string }>();
  const { selectedBrandId, brands } = useAuthStore();
  const activeBrandId = selectedBrandId || context?.selectedBrandId || 'all';
  const isHollowHome = !!activeBrandId && activeBrandId.toLowerCase().includes('hollow');
  const isBrandFiltered = !!activeBrandId && activeBrandId !== 'all';

  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [isHeatmapOn, setIsHeatmapOn] = useState(false);
  const [selectedDate, setSelectedDate] = useState(26); // Default 26 Oct
  const [drawerPost, setDrawerPost] = useState<any | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize magnetic buttons
  useEffect(() => {
    initMagnetic(containerRef.current || document);
  }, []);

  const daysOfWeek = isHollowHome
    ? [
        { name: 'MON', date: 26, posts: 1, label: '1 post', isToday: false },
        { name: 'TUE', date: 27, posts: 0, label: 'Free', isToday: false },
        { name: 'WED', date: 28, posts: 0, label: '• Gap', isToday: true },
        { name: 'THU', date: 29, posts: 1, label: '1 post', isToday: false },
        { name: 'FRI', date: 30, posts: 1, label: '1 post', isToday: false },
        { name: 'SAT', date: 31, posts: 1, label: '1 post', isToday: false },
        { name: 'SUN', date: 1, posts: 0, label: '• Gap', isToday: false },
      ]
    : [
        { name: 'MON', date: 26, posts: 1, label: '1 post', isToday: true },
        { name: 'TUE', date: 27, posts: 6, label: '6 posts', isToday: false },
        { name: 'WED', date: 28, posts: 3, label: '3 posts', isToday: false },
        { name: 'THU', date: 29, posts: 4, label: '4 posts', isToday: false },
        { name: 'FRI', date: 30, posts: 2, label: '2 posts', isToday: false },
        { name: 'SAT', date: 31, posts: 1, label: '1 post', isToday: false },
        { name: 'SUN', date: 1, posts: 5, label: '5 posts', isToday: false },
      ];

  const visibleCampaigns = isBrandFiltered
    ? MURMURA_CAMPAIGNS.filter((c) => matchesBrand(c.brand, activeBrandId, brands))
    : MURMURA_CAMPAIGNS;

  const visiblePosts = isBrandFiltered
    ? (isHollowHome ? HOLLOW_HOME_CALENDAR_POSTS : DEFAULT_CALENDAR_POSTS.filter((p) => matchesBrand(p.brand, activeBrandId, brands)))
    : DEFAULT_CALENDAR_POSTS;

  const visibleDrafts = isBrandFiltered
    ? DEFAULT_DRAFTS.filter((d) => matchesBrand(d.brand, activeBrandId, brands))
    : DEFAULT_DRAFTS;

  const availableNetworks = isHollowHome
    ? ['instagram', 'pinterest', 'facebook', 'youtube']
    : ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'pinterest', 'threads', 'x'];

  const statsData = isBrandFiltered
    ? { scheduled: visiblePosts.filter((p) => p.status === 'scheduled').length || 2, awaiting: visiblePosts.filter((p) => p.status === 'pending').length || 1, published: 1, emptyDays: 3 }
    : { scheduled: 13, awaiting: 5, published: 0, emptyDays: 2 };

  const hours = [
    '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
    '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
    '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
  ];

  return (
    <div className="view cl" data-view="calendar" ref={containerRef}>
      {/* 1. Header with Stats & Controls */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">
            Publishing<br />calendar
          </h1>
        </div>

        <div className="head__stats">
          <div className="stat" data-stat="sched">
            <span className="stat__ico">
              <SvgIcon name="calendar" />
            </span>
            <div>
              <div className="stat__value"><b>{statsData.scheduled}</b></div>
              <div className="stat__label">Scheduled this week</div>
            </div>
          </div>

          <div className="stat" data-stat="pend">
            <span className="stat__ico">
              <SvgIcon name="shield" />
            </span>
            <div>
              <div className="stat__value"><b>{statsData.awaiting}</b></div>
              <div className="stat__label">Awaiting approval</div>
            </div>
          </div>

          <div className="stat" data-stat="pub">
            <span className="stat__ico">
              <SvgIcon name="send" />
            </span>
            <div>
              <div className="stat__value"><b>{statsData.published}</b></div>
              <div className="stat__label">Published this week</div>
            </div>
          </div>

          <div className="stat" data-stat="gaps">
            <span className="stat__ico">
              <SvgIcon name="grid" />
            </span>
            <div>
              <div className="stat__value"><b>{statsData.emptyDays}</b></div>
              <div className="stat__label">Empty days in the next 7</div>
            </div>
          </div>
        </div>

        <div className="head__tools">
          <div className="seg" role="tablist">
            <button
              type="button"
              className={`seg__btn ${viewMode === 'week' ? 'is-active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`seg__btn ${viewMode === 'month' ? 'is-active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`seg__btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>

          <div className="cl-nav">
            <button
              type="button"
              className="ibtn ibtn--sm"
              aria-label="Previous week"
              title="Previous week"
            >
              <SvgIcon name="chevL" />
            </button>
            <button type="button" className="btn btn--ghost cl-todaybtn">
              Today
            </button>
            <button
              type="button"
              className="ibtn ibtn--sm"
              aria-label="Next week"
              title="Next week"
            >
              <SvgIcon name="chevR" />
            </button>
          </div>

          <button
            type="button"
            className="btn btn--ink magnetic cl-newbtn"
            onClick={() => navigate('/compose')}
          >
            <SvgIcon name="plus" />
            New post
          </button>
        </div>
      </header>

      {/* 2. Filter Toolbar */}
      <div className="toolbar cl-bar">
        <div className="cl-filters hfade">
          {/* Network Filter Chips */}
          <div className="cl-chips" role="group" aria-label="Filter by network">
            <button
              type="button"
              className={`chip cl-netchip ${selectedNetwork === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedNetwork('all')}
              aria-pressed={selectedNetwork === 'all'}
            >
              All networks
            </button>
            {availableNetworks.map((net) => (
              <button
                key={net}
                type="button"
                className={`chip cl-netchip ${selectedNetwork === net ? 'is-active' : ''}`}
                onClick={() => setSelectedNetwork(selectedNetwork === net ? 'all' : net)}
                aria-pressed={selectedNetwork === net}
                title={net.charAt(0).toUpperCase() + net.slice(1)}
              >
                <span className={`net net--${net} net--xs`}>
                  <SvgIcon name={net} />
                </span>
              </button>
            ))}
          </div>

          <span className="cl-sep" aria-hidden="true"></span>

          {/* Status Filter Chips */}
          <div className="cl-chips" role="group" aria-label="Filter by status">
            {[
              { id: 'scheduled', label: 'Scheduled', dot: 'sea' },
              { id: 'pending', label: 'Awaiting approval', dot: 'butter' },
              { id: 'published', label: 'Published', dot: 'pine' },
              { id: 'draft', label: 'Drafts', dot: 'plain' },
              { id: 'failed', label: 'Failed', dot: 'coral' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                className={`chip cl-stchip ${selectedStatus === st.id ? 'is-active' : ''}`}
                onClick={() => setSelectedStatus(selectedStatus === st.id ? 'all' : st.id)}
                aria-pressed={selectedStatus === st.id}
              >
                <i className={`cl-dot cl-dot--${st.dot}`}></i>
                {st.label}
              </button>
            ))}
          </div>

          <span className="cl-sep" aria-hidden="true"></span>

          {/* Campaign Selector */}
          <label className="cl-camp">
            <SvgIcon name="flag" />
            <select
              className="input cl-campsel"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">All campaigns</option>
              {visibleCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.brandName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* 3. Calendar Grid & Side Planning Tools */}
      <div className="cl-grid">
        {/* Left: Main Calendar Stage */}
        <section className="card cl-cal" aria-labelledby="cl-cal-t">
          <header className="card__head cl-cal__head">
            <div className="cl-cal__lead">
              <h2 className="cl-period" id="cl-cal-t">
                Oct 26 – Nov 1, 2026
              </h2>
              <p className="card__sub">
                {isHollowHome
                  ? '4 posts · 1 brand'
                  : isBrandFiltered
                  ? `${visiblePosts.length} posts · 1 brand`
                  : '22 posts · 5 brands'}
              </p>
            </div>
            <div className="cl-cal__tools">
              <div className="cl-legend">
                <span><i className="cl-dot cl-dot--sea"></i>Scheduled</span>
                <span><i className="cl-dot cl-dot--butter"></i>Awaiting</span>
                <span><i className="cl-dot cl-dot--pine"></i>Published</span>
                <span><i className="cl-dot cl-dot--coral"></i>Needs attention</span>
              </div>
              <button
                type="button"
                className={`chip cl-heatbtn ${isHeatmapOn ? 'is-active' : ''}`}
                onClick={() => setIsHeatmapOn(!isHeatmapOn)}
                aria-pressed={isHeatmapOn}
                title="Shade each hour by how well posts do then"
              >
                <SvgIcon name="sparkle" />
                Best times
              </button>
            </div>
          </header>

          <div className="cl-stage">
            <div className={`cl-wk ${isHeatmapOn ? 'cl-heat' : ''}`} tabIndex={-1}>
              {/* Sticky Column Headers & Multi-day Ribbons */}
              <div className="cl-wk__head">
                <span className="cl-wk__corner" aria-hidden="true"></span>
                {daysOfWeek.map((day) => (
                  <div
                    key={day.name}
                    className={`cl-wd ${day.isToday ? 'is-today' : ''}`}
                    data-day={day.date}
                  >
                    <small>{day.name}</small>
                    <b>{day.date}</b>
                    <span className="cl-wd__n">
                      {day.label}
                    </span>
                  </div>
                ))}

                {/* Campaign Ribbons */}
                <div className="cl-ribs" style={{ '--rows': visibleCampaigns.length } as any}>
                  <span className="cl-ribs__lab" title="Campaigns">
                    <SvgIcon name="flag" />
                  </span>
                  {visibleCampaigns.map((camp) => (
                    <button
                      key={camp.id}
                      type="button"
                      className={`cl-rib tone--${camp.tone}`}
                      style={{
                        gridColumn: `${camp.startCol} / ${camp.endCol}`,
                        gridRow: camp.row,
                      }}
                      title={`${camp.name} · ${camp.brandName}`}
                    >
                      <span className="bmark">{camp.brand}</span>
                      <span>{camp.name}</span>
                      <small>{camp.endLabel}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Time Grid Body */}
              <div className="cl-wk__body">
                {/* Hourly Timestamps */}
                <div className="cl-hours" aria-hidden="true">
                  {hours.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>

                {/* 7 Day Columns */}
                {daysOfWeek.map((day, dayIndex) => {
                  const dayPosts = visiblePosts.filter((p) => p.dayIndex === dayIndex);
                  return (
                    <div
                      key={day.name}
                      className={`cl-col ${day.isToday ? 'is-today' : ''}`}
                      data-day={day.date}
                      style={{ '--ci': dayIndex } as any}
                    >
                      {/* 18 Hourly Grid Slots */}
                      {hours.map((_, hi) => {
                        const heatVal = isHeatmapOn ? (hi % 3 === 0 ? 0.95 : (hi * 0.08) % 0.8) : 0;
                        return (
                          <span
                            key={hi}
                            className="cl-slot"
                            style={{ '--heat': heatVal, '--hi': hi } as any}
                          >
                            {heatVal > 0.9 && <i className="cl-peak">Peak</i>}
                          </span>
                        );
                      })}

                      {/* Scheduled Post Tiles */}
                      {dayPosts.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          className={`cl-tile tone--${post.tone} is-${post.status} is-movable`}
                          style={
                            {
                              '--top': post.topHour,
                              '--lane': post.lane,
                              '--lanes': post.lanes,
                            } as any
                          }
                          onClick={() => setDrawerPost(post)}
                        >
                          <span className="cl-tile__body">
                            <span className="cl-tile__top">
                              <span className="cl-tile__time">{post.timeStr}</span>
                              {(post as any).warn && <SvgIcon name="alert" className="ico cl-tile__warn" />}
                            </span>
                            <span className="cl-tile__text">{post.title}</span>
                            <span className="cl-tile__foot">
                              <span className={`bmark tone--${post.brand === 'VG' ? 'ink' : post.brand === 'EO' ? 'coral' : post.brand === 'HH' ? 'butter' : 'pine'}`}>
                                {post.brand}
                              </span>
                              {(post as any).nets ? (
                                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                                  {(post as any).nets.map((n: string) => (
                                    <span key={n} className={`net net--${n} net--xs`}>
                                      <SvgIcon name={n} />
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className={`net net--${post.net} net--xs`}>
                                  <SvgIcon name={post.net} />
                                </span>
                              )}
                            </span>
                          </span>
                          {post.thumb && (
                            <span className="cl-tile__thumb">
                              <img
                                src={post.thumb}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                }}
                              />
                            </span>
                          )}
                        </button>
                      ))}

                      {/* Current Time Indicator on Active Day */}
                      {day.isToday && (
                        <div
                          className="cl-now"
                          style={{ '--top': 4.2 } as any}
                          aria-hidden="true"
                        >
                          <i></i>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Planning Tools Aside */}
        <aside className="cl-side" aria-label="Planning tools">
          {/* Mini Calendar Card */}
          <section className="card cl-minicard" aria-labelledby="cl-mini-t">
            <h2 className="sr" id="cl-mini-t">Jump to a date</h2>
            <div className="cl-mini__head">
              <b>October 2026</b>
              <span>
                <button type="button" className="ibtn ibtn--sm" aria-label="Previous month">
                  <SvgIcon name="chevL" />
                </button>
                <button type="button" className="ibtn ibtn--sm" aria-label="Next month">
                  <SvgIcon name="chevR" />
                </button>
              </span>
            </div>
            <div className="cl-mini__dow" aria-hidden="true">
              <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
            </div>
            <div className="cl-mini__grid">
              {/* Previous month trailing days */}
              <button type="button" className="cl-mini__d is-out"><span>28</span></button>
              <button type="button" className="cl-mini__d is-out"><span>29</span></button>
              <button type="button" className="cl-mini__d is-out"><span>30</span></button>
              {/* October days 1 to 31 */}
              {Array.from({ length: 31 }, (_, i) => {
                const dayNum = i + 1;
                const isCurrent = dayNum === selectedDate;
                const isRange = dayNum >= 26 && dayNum <= 31;
                const hasDot = [26, 27, 28, 29, 30, 31].includes(dayNum);
                return (
                  <button
                    key={dayNum}
                    type="button"
                    className={`cl-mini__d ${isCurrent ? 'is-today' : ''} ${isRange ? 'is-range' : ''}`}
                    onClick={() => setSelectedDate(dayNum)}
                  >
                    <span>{dayNum}</span>
                    {hasDot && <i style={{ '--n': 2 } as any}></i>}
                  </button>
                );
              })}
              {/* Next month leading days */}
              <button type="button" className="cl-mini__d is-out is-range">
                <span>1</span>
                <i style={{ '--n': 1 } as any}></i>
              </button>
              {Array.from({ length: 7 }, (_, i) => (
                <button key={`next-${i}`} type="button" className="cl-mini__d is-out">
                  <span>{i + 2}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Unscheduled Drafts Card */}
          <section className="card cl-draftcard" aria-labelledby="cl-dr-t">
            <header className="card__head">
              <div>
                <h2 className="card__title" id="cl-dr-t">Unscheduled drafts</h2>
                <p className="card__sub">Drag one onto the calendar to give it a time</p>
              </div>
              <span className="badge badge--plain">{visibleDrafts.length}</span>
            </header>
            <ul className="cl-dlist">
              {visibleDrafts.map((draft) => (
                <li key={draft.id}>
                  <button
                    type="button"
                    className="cl-draft is-movable"
                    onClick={() => navigate('/compose')}
                  >
                    <span className={`bmark tone--${draft.tone}`}>{draft.brand}</span>
                    <span className="cl-draft__main">
                      <b>{draft.title}</b>
                      <small>{draft.author} · {draft.scheduledText}</small>
                    </span>
                    <span className="cl-draft__grip" aria-hidden="true">
                      <SvgIcon name="grip" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* This Week by Network Card */}
          {!isHollowHome && (
            <section className="card cl-netcard" aria-labelledby="cl-nt-t">
              <header className="card__head">
                <div>
                  <h2 className="card__title" id="cl-nt-t">This week by network</h2>
                  <p className="card__sub">Oct 26 – Nov 1, 2026 · 22 posts</p>
                </div>
              </header>
              <ul className="cl-nlist">
                {NETWORK_METRICS.map((item) => (
                  <li key={item.net} className="cl-nrow" data-net={item.net}>
                    <span className={`net net--${item.net} net--sm`}>
                      <SvgIcon name={item.net} />
                    </span>
                    <span className="cl-nrow__name">{item.name}</span>
                    <span className="meter">
                      <span
                        className="meter__fill cl-nfill"
                        style={{
                          background: `var(--n-${item.net})`,
                          transform: `scaleX(${item.pct})`,
                        }}
                      ></span>
                    </span>
                    <b className="tnum">{item.count}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* Post Drawer Modal if opened */}
      {drawerPost && (
        <PostDetailDrawer
          post={{
            id: drawerPost.id,
            brand: { name: drawerPost.brand },
            title: drawerPost.title,
            body: drawerPost.title,
            status: drawerPost.status,
            channels: [{ network: drawerPost.net }],
            scheduledAt: '2026-10-26T08:30:00Z',
          }}
          onClose={() => setDrawerPost(null)}
          onApprove={() => setDrawerPost(null)}
          onRequestChanges={() => setDrawerPost(null)}
        />
      )}
    </div>
  );
}
