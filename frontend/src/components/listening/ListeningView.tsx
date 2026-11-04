import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { getActiveBrand, matchesBrand } from '../../lib/brandHelper.js';
import {
  MessageSquare,
  Smile,
  Eye,
  PieChart,
  Plus,
  ArrowUpRight,
  Star,
  EyeOff,
  CornerDownRight,
  X,
  ChevronDown,
  Globe,
  Radio,
} from 'lucide-react';
import CleanWireframeAnalytics from '@/components/ui/line-graph-statistics';

interface KeywordItem {
  id: string;
  brandId: string;
  brandCode: string;
  brandTone: string;
  term: string;
  kind: 'brand' | 'hashtag' | 'topic' | 'competitor';
  weeklyCount: number;
  sentiment: { pos: number; neu: number; neg: number };
  sparkPoints: number[];
}

interface MentionItem {
  id: string;
  author: string;
  handle: string;
  avatar?: string;
  initials: string;
  net: string;
  time: string;
  sentiment: 'pos' | 'neu' | 'neg';
  keywordTerm: string;
  keywordKind: 'brand' | 'hashtag' | 'topic' | 'competitor';
  text: string;
  highlightTerm: string;
  reach: string;
  saved: boolean;
  hidden: boolean;
}

function getSparklinePath(points: number[], width = 92, height = 30): string {
  if (!points || points.length < 2) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padX = 4;
  const padY = 5;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = points.map((val, idx) => ({
    x: padX + (idx / (points.length - 1)) * innerW,
    y: height - padY - ((val - min) / range) * innerH,
  }));

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const DEFAULT_KEYWORDS: KeywordItem[] = [];
const DEFAULT_MENTIONS: MentionItem[] = [];
const TRENDING_TERMS: any[] = [];
const COMPETITORS_DATA: any[] = [];

export function ListeningView() {
  const navigate = useNavigate();
  const { brands, selectedBrandId } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  // Active brand resolution
  const activeBrand = useMemo(() => {
    return getActiveBrand(selectedBrandId, brands);
  }, [brands, selectedBrandId]);

  const isHollowHome = !!activeBrand && activeBrand.name.toLowerCase().includes('hollow');
  const isVantageGarage = !!activeBrand && activeBrand.name.toLowerCase().includes('vantage');
  const isStarlightBakery = !!activeBrand && (activeBrand.name.toLowerCase().includes('starlight') || activeBrand.name.toLowerCase().includes('bakery'));

  // States
  const [selectedKwId, setSelectedKwId] = useState<string | null>(null);
  const [sentimentTab, setSentimentTab] = useState<'all' | 'pos' | 'neu' | 'neg'>('all');
  const [filterNet, setFilterNet] = useState<string>('all');
  const [savedFilter, setSavedFilter] = useState<boolean>(false);
  const [activeSearchTerm, setActiveSearchTerm] = useState<string | null>(null);
  const [isLiveStream, setIsLiveStream] = useState<boolean>(true);

  // Modal State for adding new keyword
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTerm, setNewTerm] = useState<string>('');
  const [newKind, setNewKind] = useState<'brand' | 'hashtag' | 'topic' | 'competitor'>('topic');
  const [newBrandId, setNewBrandId] = useState<string>(activeBrand?.id || brands[0]?.id || 'ember');

  // Local state for interactive keywords and mentions
  const [keywords, setKeywords] = useState<KeywordItem[]>(DEFAULT_KEYWORDS);
  const [mentions, setMentions] = useState<MentionItem[]>(DEFAULT_MENTIONS);

  // Clean brand listening data
  const brandListeningData = useMemo(() => {
    return {
      mentionsCount: 0,
      sentiment: '0%',
      sentimentLabel: 'Net sentiment, positive − negative',
      reach: '0',
      reachLabel: 'Potential reach this week',
      sovPct: '0%',
      sovBrandLabel: 'Share of voice',
      sovBars: [] as any[],
      competitors: [] as any[],
      trendingTerms: [] as any[],
    };
  }, []);

  // Brand-filtered keywords
  const visibleKeywords = useMemo(() => {
    if (activeBrand) {
      const bLower = activeBrand.name.toLowerCase();
      const matched = keywords.filter((k) => k.brandId === activeBrand.id || k.term.toLowerCase().includes(bLower));
      return matched;
    }
    return keywords;
  }, [keywords, activeBrand]);

  // Filtered mentions
  const visibleMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (m.hidden) return false;
      if (savedFilter && !m.saved) return false;
      if (sentimentTab !== 'all' && m.sentiment !== sentimentTab) return false;
      if (filterNet !== 'all' && m.net !== filterNet) return false;

      // Filter by active brand if specified
      if (activeBrand) {
        const bLower = activeBrand.name.toLowerCase();
        if (!m.keywordTerm.toLowerCase().includes(bLower) && !m.text.toLowerCase().includes(bLower)) {
          return false;
        }
      }

      if (selectedKwId) {
        const kw = visibleKeywords.find((k) => k.id === selectedKwId);
        if (kw && !m.keywordTerm.toLowerCase().includes(kw.term.toLowerCase())) return false;
      }
      if (activeSearchTerm) {
        const q = activeSearchTerm.toLowerCase();
        if (!m.text.toLowerCase().includes(q) && !m.highlightTerm.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [mentions, savedFilter, sentimentTab, filterNet, isHollowHome, isVantageGarage, activeBrand, selectedKwId, activeSearchTerm, visibleKeywords]);

  const savedCount = useMemo(() => mentions.filter((m) => m.saved).length, [mentions]);

  // Handlers
  const handleToggleSave = (id: string) => {
    setMentions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, saved: !m.saved } : m))
    );
    const m = mentions.find((item) => item.id === id);
    addToast({
      type: 'info',
      message: m?.saved ? 'Removed from saved' : 'Saved · find it under Saved',
    });
  };

  const handleHideMention = (id: string) => {
    setMentions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, hidden: true } : m))
    );
    addToast({ type: 'info', message: 'Mention hidden from stream' });
  };

  const handleRemoveKeyword = (id: string) => {
    const kw = keywords.find((k) => k.id === id);
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    if (selectedKwId === id) setSelectedKwId(null);
    addToast({ type: 'info', message: `Stopped tracking “${kw?.term || 'keyword'}”` });
  };

  const handleAddKeywordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    const termClean = newKind === 'hashtag' && !newTerm.startsWith('#') ? `#${newTerm}` : newTerm.trim();
    const brand = brands.find((b) => b.id === newBrandId) || brands[0];

    const newItem: KeywordItem = {
      id: 'k_' + Date.now(),
      brandId: newBrandId,
      brandCode: brand?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2) || 'BR',
      brandTone: (brand?.color ? 'coral' : 'ink') as any,
      term: termClean,
      kind: newKind,
      weeklyCount: 3,
      sentiment: { pos: 0.6, neu: 0.3, neg: 0.1 },
      sparkPoints: [1, 2, 2, 3, 4, 3, 4, 3, 5, 4, 3, 4, 5, 3],
    };

    setKeywords((prev) => [newItem, ...prev]);
    setShowAddModal(false);
    setNewTerm('');
    addToast({ type: 'success', message: `Tracking “${termClean}” · 3 mentions backfilled` });
  };

  return (
    <div className="view" data-view="listening">
      {/* Top Header */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Listening</h1>
        </div>

        {/* 4 KPI Stats matching Murmura */}
        <div className="head__stats">
          {/* Stat 1: Mentions */}
          <div className="stat" data-stat="first">
            <span className="stat__ico">
              <MessageSquare className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandListeningData.mentionsCount}</b>
              </span>
              <span className="stat__label">Mentions this week</span>
            </div>
          </div>

          {/* Stat 2: Net Sentiment */}
          <div className="stat" data-stat="changes">
            <span className="stat__ico">
              <Smile className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandListeningData.sentiment}</b>
              </span>
              <span className="stat__label">{brandListeningData.sentimentLabel}</span>
            </div>
          </div>

          {/* Stat 3: Potential Reach */}
          <div className="stat" data-stat="week">
            <span className="stat__ico">
              <Eye className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandListeningData.reach}</b>
              </span>
              <span className="stat__label">{brandListeningData.reachLabel}</span>
            </div>
          </div>

          {/* Stat 4: Share of Voice */}
          <div className="stat" data-stat="avg">
            <span className="stat__ico">
              <PieChart className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandListeningData.sovPct}</b>
              </span>
              <span className="stat__label">{brandListeningData.sovBrandLabel}</span>
            </div>
          </div>
        </div>

        {/* Action button: Track a keyword */}
        <div className="head__actions">
          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="ico" />
            <span>Track a keyword</span>
          </button>
        </div>
      </header>

      {/* Main 12-Column Grid */}
      <div className="ls-grid">
        {/* 1. Tracked Keywords (Left Column) */}
        <article className="card ls-kw" id="ls-kw">
          <div className="card__head">
            <h2 className="card__title">Tracked keywords</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <p className="card__sub ls-kw__hint">
            Pick a keyword to filter the stream. Lines show 14 days of volume.
          </p>

          <ul className="ls-kws">
            {visibleKeywords.map((kw, kwIdx) => {
              const isSelected = selectedKwId === kw.id;
              const badgeClass =
                kw.kind === 'brand'
                  ? 'badge--ink'
                  : kw.kind === 'hashtag'
                  ? 'badge--sea'
                  : kw.kind === 'topic'
                  ? 'badge--pine'
                  : 'badge--coral';

              return (
                <li key={kw.id} className={`ls-k ${isSelected ? 'is-on' : ''}`}>
                  <button
                    type="button"
                    className="ls-k__main"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedKwId(isSelected ? null : kw.id)}
                  >
                    <span className={`badge ${badgeClass} ls-k__kind`}>
                      {kw.kind.charAt(0).toUpperCase() + kw.kind.slice(1)}
                    </span>

                    <span className="ls-k__term">
                      <b>{kw.term}</b>
                      <small>
                        <span className={`bmark bmark--xs tone--${kw.brandTone}`}>{kw.brandCode}</span>
                        <span>{kw.weeklyCount} this week</span>
                      </small>
                    </span>

                    {/* 14-day Sparkline SVG with Drawing Animation */}
                    <span className="ls-k__spark">
                      <svg viewBox="0 0 92 30" className="spark" style={{ width: '92px', height: '30px', overflow: 'visible' }}>
                        <path
                          d={getSparklinePath(kw.sparkPoints)}
                          fill="none"
                          stroke="var(--sea)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pathLength="1"
                          className="chart__line chart__line--spark"
                          style={{ animationDelay: `${0.40 + kwIdx * 0.04}s` }}
                        />
                      </svg>
                    </span>
                  </button>

                  {/* Sentiment Split Bar with Fill Animation */}
                  <span
                    className="ls-split"
                    role="img"
                    aria-label="Sentiment split"
                    style={{ animationDelay: `${0.40 + kwIdx * 0.04}s` }}
                  >
                    <i className="ls-split--pos" style={{ flexGrow: kw.sentiment.pos }} />
                    <i className="ls-split--neu" style={{ flexGrow: kw.sentiment.neu }} />
                    <i className="ls-split--neg" style={{ flexGrow: kw.sentiment.neg }} />
                  </span>

                  {/* Delete / Stop Tracking Button */}
                  <button
                    type="button"
                    className="ibtn ibtn--sm ls-k__rm"
                    title={`Stop tracking ${kw.term}`}
                    onClick={() => handleRemoveKeyword(kw.id)}
                  >
                    <X className="ico" />
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        {/* 2. Mentions Stream (Middle Column) */}
        <article className="card ls-stream" id="ls-stream">
          <div className="card__head">
            <h2 className="card__title">Mentions</h2>
            <div className="card__tools">
              {/* Live indicator button */}
              <button
                type="button"
                className={`ls-live ${isLiveStream ? 'is-on' : ''}`}
                onClick={() => setIsLiveStream(!isLiveStream)}
                title={isLiveStream ? 'Pause live stream' : 'Resume live stream'}
              >
                <i aria-hidden="true" />
                <span>{isLiveStream ? 'Live' : 'Paused'}</span>
              </button>
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          {/* Mentions Filters Toolbar */}
          <div className="ls-filters">
            {/* Sentiment Switcher */}
            <div className="seg" role="group" aria-label="Sentiment">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={sentimentTab === 'all'}
                onClick={() => setSentimentTab('all')}
              >
                All
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={sentimentTab === 'pos'}
                onClick={() => setSentimentTab('pos')}
              >
                Positive
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={sentimentTab === 'neu'}
                onClick={() => setSentimentTab('neu')}
              >
                Neutral
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={sentimentTab === 'neg'}
                onClick={() => setSentimentTab('neg')}
              >
                Negative
              </button>
            </div>

            {/* Network Selector Chip */}
            <button
              type="button"
              className="chip ls-fchip"
              onClick={() => {
                const nets = ['all', 'instagram', 'x', 'tiktok', 'facebook', 'threads'];
                const nextIdx = (nets.indexOf(filterNet) + 1) % nets.length;
                setFilterNet(nets[nextIdx]);
              }}
            >
              <Globe className="ico" />
              <span>{filterNet === 'all' ? 'All networks' : filterNet.toUpperCase()}</span>
              <ChevronDown className="ico" />
            </button>

            {/* Saved Filter Chip */}
            <button
              type="button"
              className="chip ls-fchip"
              aria-pressed={savedFilter}
              onClick={() => setSavedFilter(!savedFilter)}
            >
              <Star className="ico" />
              <span>Saved</span>
              <span className="ls-n">{savedCount}</span>
            </button>
          </div>

          {/* Active Filter Chips (if search term or keyword active) */}
          {(selectedKwId || activeSearchTerm) && (
            <div className="ls-active">
              {selectedKwId && (
                <button
                  type="button"
                  className="chip ls-x"
                  onClick={() => setSelectedKwId(null)}
                >
                  <span>{keywords.find((k) => k.id === selectedKwId)?.term}</span>
                  <X className="ico" />
                </button>
              )}
              {activeSearchTerm && (
                <button
                  type="button"
                  className="chip ls-x"
                  onClick={() => setActiveSearchTerm(null)}
                >
                  <span>“{activeSearchTerm}”</span>
                  <X className="ico" />
                </button>
              )}
            </div>
          )}

          {/* Mentions List */}
          <ol className="ls-list" aria-live="polite">
            {visibleMentions.map((m) => {
              const spillTone =
                m.sentiment === 'pos' ? 'spill--pine' : m.sentiment === 'neg' ? 'spill--coral' : 'spill--plain';
              const dotTone =
                m.keywordKind === 'brand'
                  ? 'ls-dot--ink'
                  : m.keywordKind === 'hashtag'
                  ? 'ls-dot--sea'
                  : m.keywordKind === 'topic'
                  ? 'ls-dot--pine'
                  : 'ls-dot--coral';

              return (
                <li key={m.id} className="ls-m">
                  {/* Face with network badge */}
                  <span className="ls-m__face">
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt={m.author}
                        className="av av--md"
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'grid';
                        }}
                      />
                    ) : null}
                    <div
                      className="av av--md"
                      style={{
                        display: m.avatar ? 'none' : 'grid',
                        background: m.initials === 'TA' ? '#fae3d9' : '#e0f2fe',
                        color: m.initials === 'TA' ? '#873600' : '#0369a1',
                        fontWeight: 700,
                        placeItems: 'center',
                      }}
                    >
                      {m.initials}
                    </div>
                    <span className={`net net--xs net--${m.net}`}>
                      <NetworkIcon network={m.net} className="ico" />
                    </span>
                  </span>

                  <div className="ls-m__body">
                    <header className="ls-m__head">
                      <b>{m.author}</b>
                      <small>
                        @{m.handle} · {m.time}
                      </small>
                      <span className={`spill ${spillTone}`}>
                        <i />
                        {m.sentiment === 'pos'
                          ? 'Positive'
                          : m.sentiment === 'neg'
                          ? 'Negative'
                          : 'Neutral'}
                      </span>
                    </header>

                    {/* Mention Text with Highlight */}
                    <p className="ls-m__text">
                      <mark>{m.highlightTerm}</mark> — {m.text}
                    </p>

                    <footer className="ls-m__foot">
                      <span className="ls-m__kw">
                        <i className={`ls-dot ${dotTone}`} />
                        <span>{m.keywordTerm}</span>
                      </span>

                      <span className="ls-m__reach">
                        <Eye className="ico" />
                        <span>{m.reach} reach</span>
                      </span>

                      <span className="ls-m__acts">
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => navigate('/inbox')}
                        >
                          <CornerDownRight className="ico" />
                          <span>Reply in inbox</span>
                        </button>

                        <button
                          type="button"
                          className="ibtn ibtn--sm"
                          aria-pressed={m.saved}
                          title={m.saved ? 'Saved' : 'Save'}
                          onClick={() => handleToggleSave(m.id)}
                        >
                          <Star className="ico" />
                        </button>

                        <button
                          type="button"
                          className="ibtn ibtn--sm"
                          title="Hide"
                          onClick={() => handleHideMention(m.id)}
                        >
                          <EyeOff className="ico" />
                        </button>
                      </span>
                    </footer>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Load More Button */}
          <div className="ls-more">
            <button
              type="button"
              className="btn btn--ghost ls-more__btn"
              onClick={() => addToast({ type: 'info', message: 'All 84 mentions loaded' })}
            >
              <span>Show 8 more</span>
              <span className="ls-n">84</span>
            </button>
          </div>
        </article>

        {/* 3. Share of Voice Card (Right Column Top) */}
        <article className="card ls-sov" id="ls-sov">
          <div className="card__head">
            <h2 className="card__title">Share of voice</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          {/* Brand picker chip */}
          <button type="button" className="chip ls-fchip ls-sov__pick">
            <span
              className="bmark bmark--xs"
              style={{
                background: activeBrand?.color || '#f2b740',
                color: isHollowHome ? '#1c1b18' : '#fff',
                fontWeight: 700,
              }}
            >
              {activeBrand ? activeBrand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'All'}
            </span>
            <span>{activeBrand ? activeBrand.name : 'All Brands'}</span>
            <ChevronDown className="ico" />
          </button>

          <p className="ls-fig">
            <b className="num tnum">{brandListeningData.sovPct}</b>
            <span className="card__sub">of the conversation, this week</span>
          </p>

          <ul className="ls-bars">
            {brandListeningData.sovBars.map((bar) => (
              <li key={bar.name} className={`ls-bar ${bar.isUs ? 'is-us' : ''}`}>
                {bar.isUs ? (
                  <span
                    className={`bmark bmark--sm ${bar.tone ? `tone--${bar.tone}` : ''}`}
                    style={bar.tone === 'butter' ? { background: '#f2b740', color: '#1c1b18', fontWeight: 700 } : undefined}
                  >
                    {bar.code}
                  </span>
                ) : (
                  <span className="ls-cmark">{bar.code}</span>
                )}
                <span className="ls-bar__name">
                  {bar.name}
                  {bar.isUs && <small>You</small>}
                </span>
                <span className="ls-bar__track" aria-hidden="true">
                  <span
                    className="ls-bar__fill"
                    style={{ transform: `scaleX(${bar.ratio})`, transformOrigin: '0 50%' }}
                  />
                </span>
                <b className="num tnum">{bar.pct}</b>
              </li>
            ))}
          </ul>
        </article>

        {/* 4. Trending Terms Card (Right Column Bottom) */}
        <article className="card ls-trend" id="ls-trend">
          <div className="card__head">
            <h2 className="card__title">Trending terms</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <p className="card__sub">
            This week, in the mentions you track. Pick one to search the stream.
          </p>

          <div className="ls-cloud">
            {brandListeningData.trendingTerms.map((t) => {
              const isSelected = activeSearchTerm?.toLowerCase() === t.term.toLowerCase();
              return (
                <button
                  key={t.term}
                  type="button"
                  className={`ls-term ls-term--${t.size}`}
                  aria-pressed={isSelected}
                  onClick={() => setActiveSearchTerm(isSelected ? null : t.term)}
                >
                  <span>{t.term}</span>
                  <span className="ls-term__n">{t.count}</span>
                </button>
              );
            })}
          </div>
        </article>

        {/* 5. Sentiment Over Time Card (Bottom Left) */}
        <CleanWireframeAnalytics
          variant="sentiment"
          id="ls-sent"
          onExpand={() => {}}
        />

        {/* 6. Competitors Card (Bottom Right) */}
        <article className="card ls-comp" id="ls-comp">
          <div className="card__head">
            <h2 className="card__title">Competitors</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table ls-table">
              <caption className="sr">Competitor statistics</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col" className="r">
                    Followers
                  </th>
                  <th scope="col" className="r">
                    Growth
                  </th>
                  <th scope="col" className="r">
                    Engagement
                  </th>
                  <th scope="col" className="r">
                    Posts / wk
                  </th>
                </tr>
              </thead>
              <tbody>
                {brandListeningData.competitors.map((c) => (
                  <tr key={c.name} className={c.isUs ? 'is-us' : ''}>
                    <th scope="row">
                      <div className="cell-person">
                        {c.isUs ? (
                          <span
                            className="bmark bmark--md"
                            style={isHollowHome ? { background: '#f2b740', color: '#1c1b18', fontWeight: 700 } : undefined}
                          >
                            {c.code}
                          </span>
                        ) : (
                          <span className="ls-cmark ls-cmark--md">{c.code}</span>
                        )}
                        <span>
                          <b>{c.name}</b>
                          <small>{c.sub}</small>
                        </span>
                      </div>
                    </th>
                    <td className="r num" data-label="Followers">
                      <b>{c.followers}</b>
                    </td>
                    <td className="r num" data-label="Growth">
                      <span className="ls-g is-up">{c.growth}</span>
                    </td>
                    <td className="r num" data-label="Engagement">{c.engagement}</td>
                    <td className="r num" data-label="Posts / wk">{c.postsWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {/* Add Keyword Modal Dialog */}
      {showAddModal && (
        <>
          <div
            className="scrim"
            style={{ opacity: 1, visibility: 'visible', zIndex: 60 }}
            onClick={() => setShowAddModal(false)}
          />
          <dialog
            className="modal"
            open
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 70,
              margin: 0,
            }}
          >
            <form className="mform" onSubmit={handleAddKeywordSubmit}>
              <div className="mform__head">
                <div>
                  <h3 className="mform__title">Track a keyword</h3>
                  <p className="mform__sub">
                    Murmura listens on every connected network and backfills the last few days.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="ico" />
                </button>
              </div>

              <div className="mform__grid">
                <div className="field field--wide">
                  <label className="field__label">Keyword, hashtag or name</label>
                  <input
                    type="text"
                    required
                    placeholder="#flatwhite, “cold brew”, a competitor…"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label className="field__label">Kind</label>
                  <select
                    className="input"
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as any)}
                  >
                    <option value="topic">Topic</option>
                    <option value="brand">Brand</option>
                    <option value="hashtag">Hashtag</option>
                    <option value="competitor">Competitor</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field__label">For brand</label>
                  <select
                    className="input"
                    value={newBrandId}
                    onChange={(e) => setNewBrandId(e.target.value)}
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mform__foot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--ink">
                  Start tracking
                </button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </div>
  );
}
