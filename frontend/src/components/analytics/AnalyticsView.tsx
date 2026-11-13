import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { getActiveBrand } from '../../lib/brandHelper.js';

function formatCompactVal(n: number): string {
  const num = Number(n || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(Math.round(num));
}

const DATES_30D = [
  'Oct 1', 'Oct 2', 'Oct 3', 'Oct 4', 'Oct 5', 'Oct 6', 'Oct 7', 'Oct 8', 'Oct 9', 'Oct 10',
  'Oct 11', 'Oct 12', 'Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19', 'Oct 20',
  'Oct 21', 'Oct 22', 'Oct 23', 'Oct 24', 'Oct 25', 'Oct 26', 'Oct 27', 'Oct 28', 'Oct 29', 'Oct 30'
];

function getPointOnPathAtX(path: SVGPathElement, targetX: number): { x: number; y: number } {
  try {
    const totalLength = path.getTotalLength();
    if (!totalLength || isNaN(totalLength)) return { x: targetX, y: 100 };
    let low = 0;
    let high = totalLength;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const pt = path.getPointAtLength(mid);
      if (pt.x < targetX) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const result = path.getPointAtLength((low + high) / 2);
    return { x: result.x, y: result.y };
  } catch (e) {
    return { x: targetX, y: 100 };
  }
}
import {
  Users,
  TrendingUp,
  Eye,
  Heart,
  Download,
  Mail,
  Layers,
  ArrowUpRight,
  ArrowLeft,
  Calendar,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

interface NetworkAccountRow {
  id: string;
  net: string;
  brandCode: string;
  brandTone: string;
  name: string;
  handle: string;
  status: 'connected' | 'expiring' | 'disconnected';
  followers: number;
  growth: number;
  impressions: number;
  eng: number;
  posts: number;
  trend: number[];
}

const NETWORK_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  linkedin: 'LinkedIn',
};

const NETWORK_ACCOUNTS: Record<string, NetworkAccountRow[]> = {};

function getSparklinePath(trend: number[]): string {
  if (!trend || trend.length === 0) return 'M 4 24 Q 24 20, 48 14 T 92 6';
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = max - min || 1;
  const w = 96;
  const h = 28;
  const padX = 4;
  const padY = 5;

  const pts = trend.map((val, idx) => {
    const x = padX + (idx / (trend.length - 1)) * (w - 2 * padX);
    const y = (h - padY) - ((val - min) / range) * (h - 2 * padY);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
}

interface NetworkRow {
  key: string;
  net: string;
  name: string;
  accounts: number;
  followers: number;
  growth: number;
  impressions: number;
  eng: number;
  posts: number;
  trend: number[];
}

const NETWORKS_LIST = [{ id: 'all', name: 'All networks', count: 0 }];

const DEFAULT_NETWORKS_TABLE: NetworkRow[] = [];

const HOLLOW_HOME_NETWORKS_TABLE: NetworkRow[] = [];

const VANTAGE_GARAGE_NETWORKS_TABLE: NetworkRow[] = [];

const CONTENT_MIX_ITEMS: any[] = [];

const TOP_POSTS_DATA: any[] = [];

const BRANDS_COMPARISON_DATA: any[] = [];

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatHourRange(h: number): string {
  const startH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const startPeriod = h < 12 ? 'AM' : 'PM';
  const nextH = (h + 1) % 24;
  const endH = nextH === 0 ? 12 : nextH > 12 ? nextH - 12 : nextH;
  const endPeriod = nextH < 12 ? 'AM' : 'PM';
  return `${startH} ${startPeriod}–${endH} ${endPeriod}`;
}

export function AnalyticsView() {
  const { brands, selectedBrandId } = useAuthStore();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const urlBrandId = searchParams.get('brand');
  const effectiveBrandId = urlBrandId || selectedBrandId;

  // Active brand resolution
  const activeBrand = useMemo(() => {
    return getActiveBrand(effectiveBrandId, brands);
  }, [brands, effectiveBrandId]);

  const [isSyncingLive, setIsSyncingLive] = useState(false);

  const isHollowHome = !!activeBrand && activeBrand.name.toLowerCase().includes('hollow');
  const isVantageGarage = !!activeBrand && activeBrand.name.toLowerCase().includes('vantage');
  const isStarlightBakery = !!activeBrand && (activeBrand.name.toLowerCase().includes('starlight') || activeBrand.name.toLowerCase().includes('bakery'));

  // States
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [activeNetwork, setActiveNetwork] = useState<string>('all');
  const [impMetric, setImpMetric] = useState<'impressions' | 'engagements' | 'clicks'>('impressions');
  const [topRankBy, setTopRankBy] = useState<'reach' | 'eng' | 'clicks'>('reach');
  const [brandCompareBy, setBrandCompareBy] = useState<'followers' | 'eng' | 'impressions'>('followers');
  const [heatNet, setHeatNet] = useState<string>('all');
  const [hoveredCell, setHoveredCell] = useState<{
    dayIdx: number;
    dayFull: string;
    hour: number;
    hourRange: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [sortCol, setSortCol] = useState<'followers' | 'growth' | 'impressions' | 'eng' | 'posts'>('followers');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Interactive chart hover tracking states
  const [growthHover, setGrowthHover] = useState<{
    x: number;
    y1: number;
    y2: number;
    date: string;
    thisVal: string;
    prevVal: string;
    xPx: number;
    yPx: number;
  } | null>(null);

  const [impHover, setImpHover] = useState<{
    x: number;
    y1: number;
    y2: number;
    date: string;
    thisVal: string;
    prevVal: string;
    xPx: number;
    yPx: number;
  } | null>(null);

  const growthSvgRef = useRef<SVGSVGElement>(null);
  const growthCurPathRef = useRef<SVGPathElement>(null);
  const growthPrevPathRef = useRef<SVGPathElement>(null);

  const impSvgRef = useRef<SVGSVGElement>(null);
  const impCurPathRef = useRef<SVGPathElement>(null);
  const impPrevPathRef = useRef<SVGPathElement>(null);

  const growthRafRef = useRef<number | null>(null);
  const impRafRef = useRef<number | null>(null);

  const handleGrowthMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!growthSvgRef.current || !growthCurPathRef.current || !growthPrevPathRef.current) return;
    const rect = growthSvgRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    if (growthRafRef.current !== null) return;
    growthRafRef.current = requestAnimationFrame(() => {
      if (!growthCurPathRef.current || !growthPrevPathRef.current) {
        growthRafRef.current = null;
        return;
      }
      const svgX = Math.max(50, Math.min(570, (xPx / rect.width) * 600));
      const ptCur = getPointOnPathAtX(growthCurPathRef.current, svgX);
      const ptPrev = getPointOnPathAtX(growthPrevPathRef.current, svgX);

      const t = (svgX - 50) / (570 - 50);
      const dayIdx = Math.min(DATES_30D.length - 1, Math.max(0, Math.round(t * (DATES_30D.length - 1))));
      const dateStr = DATES_30D[dayIdx];

      const maxGrowth = parseFloat(brandData.growthNum.replace(/[^\d.]/g, '')) || 89.6;
      const prevMaxGrowth = maxGrowth * 0.87;
      const thisVal = Math.max(0, (180 - ptCur.y) / (180 - 38) * maxGrowth).toFixed(1) + 'K';
      const prevVal = Math.max(0, (180 - ptPrev.y) / (180 - 55) * prevMaxGrowth).toFixed(1) + 'K';

      setGrowthHover({
        x: svgX,
        y1: ptCur.y,
        y2: ptPrev.y,
        date: dateStr,
        thisVal,
        prevVal,
        xPx,
        yPx,
      });
      growthRafRef.current = null;
    });
  };

  const handleGrowthMouseLeave = () => {
    if (growthRafRef.current !== null) {
      cancelAnimationFrame(growthRafRef.current);
      growthRafRef.current = null;
    }
    setGrowthHover(null);
  };

  const handleImpMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!impSvgRef.current || !impCurPathRef.current || !impPrevPathRef.current) return;
    const rect = impSvgRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    if (impRafRef.current !== null) return;
    impRafRef.current = requestAnimationFrame(() => {
      if (!impCurPathRef.current || !impPrevPathRef.current) {
        impRafRef.current = null;
        return;
      }
      const svgX = Math.max(40, Math.min(480, (xPx / rect.width) * 500));
      const ptCur = getPointOnPathAtX(impCurPathRef.current, svgX);
      const ptPrev = getPointOnPathAtX(impPrevPathRef.current, svgX);

      const t = (svgX - 40) / (480 - 40);
      const dayIdx = Math.min(DATES_30D.length - 1, Math.max(0, Math.round(t * (DATES_30D.length - 1))));
      const dateStr = DATES_30D[dayIdx];

      let thisVal = '342K';
      let prevVal = '318K';

      if (impMetric === 'impressions') {
        thisVal = Math.round(200 + ((180 - ptCur.y) / (180 - 70)) * 260) + 'K';
        prevVal = Math.round(190 + ((180 - ptPrev.y) / (180 - 80)) * 230) + 'K';
      } else if (impMetric === 'engagements') {
        thisVal = (18 + ((180 - ptCur.y) / (180 - 70)) * 24).toFixed(1) + 'K';
        prevVal = (16 + ((180 - ptPrev.y) / (180 - 80)) * 20).toFixed(1) + 'K';
      } else {
        thisVal = (6 + ((180 - ptCur.y) / (180 - 70)) * 11).toFixed(1) + 'K';
        prevVal = (5 + ((180 - ptPrev.y) / (180 - 80)) * 9).toFixed(1) + 'K';
      }

      setImpHover({
        x: svgX,
        y1: ptCur.y,
        y2: ptPrev.y,
        date: dateStr,
        thisVal,
        prevVal,
        xPx,
        yPx,
      });
      impRafRef.current = null;
    });
  };

  const handleImpMouseLeave = () => {
    if (impRafRef.current !== null) {
      cancelAnimationFrame(impRafRef.current);
      impRafRef.current = null;
    }
    setImpHover(null);
  };

  const apiRange = `${range}D`;
  const brandQueryParam = activeBrand?.id ? `&brandId=${encodeURIComponent(activeBrand.id)}` : '';
  const netQueryParam = activeNetwork !== 'all' ? `&network=${encodeURIComponent(activeNetwork.toUpperCase())}` : '';

  const { data: liveChannelsRes } = useQuery<any>({
    queryKey: ['analytics-channels', activeBrand?.id || 'all'],
    queryFn: () =>
      apiFetch(`/channels${activeBrand?.id ? `?brandId=${encodeURIComponent(activeBrand.id)}` : ''}`).catch(() => ({
        channels: [],
      })),
  });

  const { data: summaryRes } = useQuery<any>({
    queryKey: ['analytics-summary', apiRange, activeBrand?.id || 'all', activeNetwork],
    queryFn: () =>
      apiFetch(`/analytics/summary?range=${apiRange}${brandQueryParam}${netQueryParam}`).catch(() => null),
  });

  const { data: byNetworkRes } = useQuery<any>({
    queryKey: ['analytics-by-network', apiRange, activeBrand?.id || 'all'],
    queryFn: () =>
      apiFetch(`/analytics/by-network?range=${apiRange}${brandQueryParam}`).catch(() => ({ networks: [] })),
  });

  const { data: contentMixRes } = useQuery<any>({
    queryKey: ['analytics-content-mix', apiRange, activeBrand?.id || 'all', activeNetwork],
    queryFn: () =>
      apiFetch(`/analytics/content-mix?range=${apiRange}${brandQueryParam}${netQueryParam}`).catch(() => null),
  });

  const { data: topPostsRes } = useQuery<any>({
    queryKey: ['analytics-top-posts', apiRange, activeBrand?.id || 'all', activeNetwork, topRankBy],
    queryFn: () => {
      const sortKey = topRankBy === 'eng' ? 'engagement' : topRankBy;
      return apiFetch(
        `/analytics/top-posts?range=${apiRange}${brandQueryParam}${netQueryParam}&sort=${sortKey}&limit=6`
      ).catch(() => ({ posts: [] }));
    },
  });

  const { data: brandsComparisonRes } = useQuery<any>({
    queryKey: ['analytics-brands-comparison', apiRange],
    queryFn: () => apiFetch(`/analytics/brands-comparison?range=${apiRange}`).catch(() => ({ brands: [] })),
  });

  const handleSyncLiveAnalytics = async () => {
    setIsSyncingLive(true);
    try {
      await apiFetch('/channels/sync-all', {
        method: 'POST',
        body: JSON.stringify(activeBrand?.id ? { brandId: activeBrand.id } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['analytics-channels'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-by-network'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-content-mix'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-top-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-brands-comparison'] });
      addToast({ type: 'success', message: 'Synced latest live metrics and posts from connected accounts.' });
    } catch (err: any) {
      addToast({ type: 'error', message: err?.message || 'Failed to sync live social metrics.' });
    } finally {
      setIsSyncingLive(false);
    }
  };

  const initialSyncDoneRef = useRef<Record<string, boolean>>({});

  // Automatically refresh live metrics from Meta in background when viewing brand analytics
  useEffect(() => {
    const brandKey = activeBrand?.id || 'all';
    if (!initialSyncDoneRef.current[brandKey]) {
      initialSyncDoneRef.current[brandKey] = true;
      apiFetch('/channels/sync-all', {
        method: 'POST',
        body: JSON.stringify(activeBrand?.id ? { brandId: activeBrand.id } : {}),
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['analytics-channels'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-by-network'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-content-mix'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-top-posts'] });
          queryClient.invalidateQueries({ queryKey: ['analytics-brands-comparison'] });
        })
        .catch(() => {});
    }
  }, [activeBrand?.id, queryClient]);

  // Dynamic brand analytics data computation from live backend DB
  const brandData = useMemo(() => {
    const brandName = activeBrand ? activeBrand.name : `${brands.length} brand${brands.length === 1 ? '' : 's'}`;
    const channels: any[] = liveChannelsRes?.channels || [];
    const apiNetworks: any[] = byNetworkRes?.networks || [];

    const netCountMap: Record<string, number> = {};
    channels.forEach((ch: any) => {
      const net = (ch.network || 'facebook').toLowerCase();
      netCountMap[net] = (netCountMap[net] || 0) + 1;
    });

    const networksList = [
      { id: 'all', name: 'All networks', count: channels.length },
      ...Object.entries(netCountMap).map(([net, count]) => ({
        id: net,
        name: NETWORK_NAMES[net] || net,
        count,
      })),
    ];

    const networksTable: NetworkRow[] = apiNetworks.length > 0
      ? apiNetworks.map((row: any) => {
          const net = String(row.network || 'facebook').toLowerCase();
          return {
            key: net,
            net,
            name: NETWORK_NAMES[net] || net,
            accounts: Number(row.channelCount ?? 0),
            followers: Number(row.followers ?? 0),
            growth: Number(row.growthPct ?? 0),
            impressions: Number(row.impressions ?? 0),
            eng: Number(row.engagementRate ?? 0),
            posts: Number(row.posts ?? 0),
            trend: Array.isArray(row.sparkline) && row.sparkline.length > 0 ? row.sparkline : [0, 0, 0, 0, 0, 0, 0],
          };
        })
      : Object.entries(netCountMap).map(([net, count]) => {
          const matching = channels.filter((c) => String(c.network || '').toLowerCase() === net);
          const followersSum = matching.reduce((s, c) => s + Number(c.followers ?? 0), 0);
          return {
            key: net,
            net,
            name: NETWORK_NAMES[net] || net,
            accounts: count,
            followers: followersSum,
            growth: 0,
            impressions: 0,
            eng: 0,
            posts: 0,
            trend: [0, 0, 0, 0, 0, 0, 0],
          };
        });

    const totalAudience = summaryRes?.audience ?? channels.reduce((s, c) => s + Number(c.followers ?? 0), 0);
    const totalImpressions = Number(summaryRes?.impressions ?? 0);
    const newFollowersNum = Number(summaryRes?.newFollowers ?? 0);
    const followerGrowthPct = Number(summaryRes?.followerGrowthPct ?? 0);
    const engRateNum = Number(summaryRes?.engagementRate ?? 0);
    const postsPublishedCount = Number(summaryRes?.postsPublished ?? 0);

    const mixRows = networksTable.map((n) => ({
      net: n.net,
      name: n.name,
      count: n.posts,
      fillRatio: postsPublishedCount > 0 ? Math.max(0.05, n.posts / postsPublishedCount) : n.accounts > 0 ? 1 / networksTable.length : 0,
      pct: postsPublishedCount > 0 ? `${Math.round((n.posts / postsPublishedCount) * 100)}%` : '0%',
    }));

    const topPostsMapped = (topPostsRes?.posts || []).map((p: any, idx: number) => {
      const val =
        topRankBy === 'eng'
          ? `${p.engagementRate ?? 0}%`
          : topRankBy === 'clicks'
            ? formatCompactVal(p.clicks ?? 0)
            : p.reach > 0
              ? formatCompactVal(p.reach)
              : formatCompactVal(p.engagements ?? 0);
      const metric =
        topRankBy === 'eng'
          ? 'eng. rate'
          : topRankBy === 'clicks'
            ? 'clicks'
            : p.reach > 0
              ? `${p.xUsualReach || 1}x usual reach`
              : `${p.engagements ?? 0} engagements`;

      const primaryTarget = p.targets?.[0];
      const network = primaryTarget?.network || (p.permalinkUrl?.includes('instagram.com') ? 'INSTAGRAM' : 'FACEBOOK');
      const handle = primaryTarget?.handle || p.brand?.name || '';
      const dateStr = p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '';

      return {
        id: p.id,
        rank: idx + 1,
        img: p.media?.[0]?.url || '',
        caption: p.caption,
        permalinkUrl: p.permalinkUrl,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        reach: p.reach ?? 0,
        engagements: p.engagements ?? 0,
        network,
        handle,
        dateStr,
        val,
        metric,
      };
    });

    return {
      scopeTitle: `${brandName} · last ${range} days`,
      audience: formatCompactVal(totalAudience),
      audienceLabel: `Audience across ${channels.length} account${channels.length === 1 ? '' : 's'}`,
      newFollowers: formatCompactVal(newFollowersNum),
      followersBadge: `${followerGrowthPct >= 0 ? '+' : ''}${followerGrowthPct}%`,
      impressions: formatCompactVal(totalImpressions),
      impressionsBadge: `${Number(summaryRes?.impressionsGrowthPct ?? 0) >= 0 ? '+' : ''}${Number(summaryRes?.impressionsGrowthPct ?? 0)}%`,
      engRate: `${engRateNum}%`,
      engLabel: `Avg. engagement rate, ${postsPublishedCount} post${postsPublishedCount === 1 ? '' : 's'}`,
      growthNum: formatCompactVal(newFollowersNum),
      growthSub: `followers gained, last ${range} days · ${followerGrowthPct >= 0 ? '+' : ''}${followerGrowthPct}% vs previous period`,
      networksList,
      networksTable,
      contentMix: mixRows,
      postsPublishedCount: contentMixRes?.total ?? postsPublishedCount,
      networkDeliveriesCount: postsPublishedCount,
      topPosts: topPostsMapped,
      y1: formatCompactVal(totalAudience),
      y2: formatCompactVal(Math.round(totalAudience / 2)),
      impY1: formatCompactVal(totalImpressions),
      impY2: formatCompactVal(Math.round(totalImpressions / 2)),
    };
  }, [
    activeBrand,
    brands.length,
    range,
    liveChannelsRes,
    summaryRes,
    byNetworkRes,
    contentMixRes,
    topPostsRes,
    topRankBy,
  ]);

  // Report Modal state
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [reportName, setReportName] = useState<string>(
    activeBrand ? `${activeBrand.name} — performance` : 'All brands — performance'
  );
  const [reportFreq, setReportFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [scheduledReportsCount, setScheduledReportsCount] = useState<number>(0);

  // Heatmap intensity generator (7 days x 24 hours)
  const heatmapData = useMemo(() => {
    const matrix: { [key: number]: number[] } = {};
    for (let day = 0; day < 7; day++) {
      matrix[day] = [];
      for (let hour = 0; hour < 24; hour++) {
        let base = 0.12;
        if (hour < 6) base = 0.05 + (hour / 20) * 0.1;
        else if (hour >= 7 && hour <= 10) base = 0.55 + Math.sin((hour - 7) * 0.5) * 0.35;
        else if (hour > 10 && hour <= 16) base = 0.45 + ((hour % 3) * 0.08);
        else if (hour >= 17 && hour <= 21) base = 0.65 + Math.sin((hour - 17) * 0.4) * 0.32;
        else base = 0.28;

        if (day === 5 && (hour === 8 || hour === 18)) base = 0.98;
        if (day === 6 && hour === 20) base = 0.95;

        matrix[day].push(Math.min(1.0, Math.max(0.04, base)));
      }
    }
    return matrix;
  }, []);

  // Sorted networks table based on brandData
  const sortedNetworks = useMemo(() => {
    return [...brandData.networksTable].sort((a, b) => {
      const vA = a[sortCol];
      const vB = b[sortCol];
      return sortAsc ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });
  }, [brandData.networksTable, sortCol, sortAsc]);

  // Sorted accounts table for drilled-down network (from real DB + by-network endpoint)
  const sortedAccounts = useMemo(() => {
    if (activeNetwork === 'all') return [];
    const apiNetworks: any[] = byNetworkRes?.networks || [];
    const matchedNet = apiNetworks.find((n: any) => String(n.network || '').toLowerCase() === activeNetwork);
    const liveChannels: any[] = liveChannelsRes?.channels || [];

    const accounts: NetworkAccountRow[] =
      matchedNet?.accounts && Array.isArray(matchedNet.accounts)
        ? matchedNet.accounts.map((a: any) => ({
            id: a.id,
            net: activeNetwork,
            brandCode: (a.brandName || 'BR').slice(0, 2).toUpperCase(),
            brandTone: 'pine',
            name: a.brandName || 'Brand',
            handle: a.handle || 'Account',
            status: a.status === 'DISCONNECTED' ? 'disconnected' : a.status === 'EXPIRING' ? 'expiring' : 'connected',
            followers: Number(a.followers ?? 0),
            growth: Number(a.growth ?? 0),
            impressions: Number(a.impressions ?? 0),
            eng: Number(a.engagementRate ?? 0),
            posts: Number(a.posts ?? 0),
            trend: Array.isArray(a.sparkline) ? a.sparkline : [],
          }))
        : liveChannels
            .filter((ch: any) => String(ch.network || '').toLowerCase() === activeNetwork)
            .map((ch: any) => ({
              id: ch.id,
              net: activeNetwork,
              brandCode: (ch.brand?.name || 'BR').slice(0, 2).toUpperCase(),
              brandTone: 'pine',
              name: ch.brand?.name || 'Brand',
              handle: ch.handle || 'Account',
              status: ch.status === 'DISCONNECTED' ? 'disconnected' : ch.status === 'EXPIRING' ? 'expiring' : 'connected',
              followers: Number(ch.followers ?? 0),
              growth: Number(ch.growthPct ?? 0),
              impressions: 0,
              eng: 0,
              posts: 0,
              trend: [],
            }));

    return [...accounts].sort((a, b) => {
      let vA: any = a[sortCol as keyof NetworkAccountRow] ?? 0;
      let vB: any = b[sortCol as keyof NetworkAccountRow] ?? 0;
      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortAsc ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });
  }, [activeNetwork, byNetworkRes, liveChannelsRes, sortCol, sortAsc]);

  // Handlers
  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        `Murmura Analytics Report - Last ${range} Days`,
        `Scope,${brandData.scopeTitle}`,
        'Generated,' + new Date().toLocaleString(),
        '',
        'Summary',
        `Audience,${brandData.audience}`,
        `New Followers,${brandData.newFollowers}`,
        `Growth,${brandData.followersBadge}`,
        `Impressions,${brandData.impressions}`,
        `Avg Engagement Rate,${brandData.engRate}`,
        `Posts Published,${brandData.postsPublishedCount}`,
        '',
        'Network,Accounts,Followers,Growth,Impressions,Eng Rate,Posts',
        ...sortedNetworks.map(
          (n) => `${n.name},${n.accounts},${n.followers},+${n.growth}%,${n.impressions},${n.eng}%,${n.posts}`
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `murmura-analytics-${activeBrand ? activeBrand.name.toLowerCase().replace(/\s+/g, '-') : 'all-brands'}-${range}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', message: `Report for ${brandData.scopeTitle} exported` });
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduledReportsCount((prev) => prev + 1);
    setShowScheduleModal(false);
    addToast({
      type: 'success',
      message: `${reportFreq === 'weekly' ? 'Weekly' : 'Monthly'} report scheduled for ${brandData.scopeTitle}`,
    });
  };

  return (
    <div className="view" data-view="analytics">
      {/* Header with Title, Stats & Actions */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Analytics</h1>
        </div>

        {/* 4 Stats Cards matching Murmura */}
        <div className="head__stats">
          {/* Stat 1: Audience */}
          <div className="stat" data-stat="first">
            <span className="stat__ico">
              <Users className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandData.audience}</b>
              </span>
              <span className="stat__label">{brandData.audienceLabel}</span>
            </div>
          </div>

          {/* Stat 2: New Followers */}
          <div className="stat" data-stat="changes">
            <span className="stat__ico">
              <TrendingUp className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandData.newFollowers}</b>
                <span className="badge badge--pine">{brandData.followersBadge}</span>
              </span>
              <span className="stat__label">New followers, last {range} days</span>
            </div>
          </div>

          {/* Stat 3: Impressions */}
          <div className="stat" data-stat="week">
            <span className="stat__ico">
              <Eye className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandData.impressions}</b>
              </span>
              <span className="stat__label">Impressions, last {range} days</span>
            </div>
          </div>

          {/* Stat 4: Engagement Rate */}
          <div className="stat" data-stat="avg">
            <span className="stat__ico">
              <Heart className="ico" />
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brandData.engRate}</b>
              </span>
              <span className="stat__label">{brandData.engLabel}</span>
            </div>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="head__actions">
          {/* Range segmented pill */}
          <div className="seg" role="group" aria-label="Date range">
            <button
              type="button"
              className="seg__btn"
              aria-pressed={range === '7'}
              onClick={() => setRange('7')}
            >
              7D
            </button>
            <button
              type="button"
              className="seg__btn"
              aria-pressed={range === '30'}
              onClick={() => setRange('30')}
            >
              30D
            </button>
            <button
              type="button"
              className="seg__btn"
              aria-pressed={range === '90'}
              onClick={() => setRange('90')}
            >
              90D
            </button>
          </div>

          <button
            type="button"
            className="btn btn--ghost magnetic"
            onClick={handleSyncLiveAnalytics}
            disabled={isSyncingLive}
            title="Fetch fresh followers & posts from connected accounts"
          >
            {isSyncingLive ? 'Syncing...' : '↻ Sync live data'}
          </button>

          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={handleExportCSV}
          >
            <Download className="ico" />
            Export CSV
          </button>

          <button
            type="button"
            className="btn btn--ghost magnetic"
            onClick={() => setShowScheduleModal(true)}
          >
            <Mail className="ico" />
            Schedule a report
            {scheduledReportsCount > 0 && (
              <span className="an-count">{scheduledReportsCount}</span>
            )}
          </button>
        </div>
      </header>

      {/* Network Filters Navigation Bar */}
      <nav className="an-nets" aria-label="Filter by network">
        {brandData.networksList.map((net) => {
          const isSelected = activeNetwork === net.id;
          return (
            <button
              key={net.id}
              type="button"
              className={`chip an-chip ${isSelected ? 'active' : ''}`}
              aria-current={isSelected}
              aria-pressed={isSelected}
              onClick={() => setActiveNetwork(net.id)}
            >
              {net.id === 'all' ? (
                <Layers className="ico" />
              ) : (
                <span className={`net net--xs net--${net.id}`}>
                  <NetworkIcon network={net.id} className="ico" />
                </span>
              )}
              {net.name}
              <span className="an-chip__n">{net.count}</span>
            </button>
          );
        })}
        <span className="an-nets__note">{brandData.scopeTitle}</span>
      </nav>

      {/* Main Analytics Grid */}
      <div className="an-grid an-grid--brands">
        {/* 1. Audience Growth Card */}
        <article className="card an-grow" id="an-grow">
          <div className="card__head">
            <h2 className="card__title">Audience growth</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <p className="an-fig">
            <b className="num tnum">{brandData.growthNum}</b>
            <span className="card__sub">{brandData.growthSub}</span>
          </p>

          <div className="legend an-legend">
            <span>
              <i className="tone--pine" />
              Followers gained, this period
            </span>
            <span>
              <i className="an-dash" aria-hidden="true" />
              Previous period
            </span>
          </div>

          {/* SVG Line Chart with Interactive Hover Tracking */}
          <div
            className="an-chart"
            style={{ height: '240px', position: 'relative', cursor: 'crosshair' }}
            onMouseMove={handleGrowthMouseMove}
            onMouseLeave={handleGrowthMouseLeave}
          >
            <svg
              ref={growthSvgRef}
              viewBox="0 0 600 220"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="growGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pine)" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="var(--pine)" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="var(--pine)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="30" x2="580" y2="30" stroke="var(--line)" strokeDasharray="3 4" />
              <text x="32" y="34" fill="var(--muted)" fontSize="11" textAnchor="end">
                {brandData.y1}
              </text>

              <line x1="40" y1="105" x2="580" y2="105" stroke="var(--line)" strokeDasharray="3 4" />
              <text x="32" y="109" fill="var(--muted)" fontSize="11" textAnchor="end">
                {brandData.y2}
              </text>

              <line x1="40" y1="180" x2="580" y2="180" stroke="var(--line)" />
              <text x="32" y="184" fill="var(--muted)" fontSize="11" textAnchor="end">
                0
              </text>

              {/* Previous Period Line (dashed gray) */}
              <path
                ref={growthPrevPathRef}
                d="M 50 180 Q 180 145, 300 120 T 570 55"
                fill="none"
                stroke="var(--faint)"
                strokeWidth="2"
                strokeDasharray="5 5"
                pathLength="1"
                className="chart__line chart__line--draw"
                style={{ animationDelay: '0.38s' }}
              />

              {/* Area Fill */}
              <path
                d="M 50 180 Q 180 135, 300 105 T 570 38 L 570 180 Z"
                fill="url(#growGradient)"
                className="chart__area"
                style={{ animationDelay: '0.40s' }}
              />

              {/* Current Period Line (solid green #11745a) */}
              <path
                ref={growthCurPathRef}
                d="M 50 180 Q 180 135, 300 105 T 570 38"
                fill="none"
                stroke="var(--pine)"
                strokeWidth="2.8"
                strokeLinecap="round"
                pathLength="1"
                className="chart__line chart__line--draw"
                style={{ animationDelay: '0.42s' }}
              />

              {/* Interactive Crosshair & Tracking Dots */}
              {growthHover && (
                <g pointerEvents="none">
                  <line
                    x1={growthHover.x}
                    y1={30}
                    x2={growthHover.x}
                    y2={180}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={growthHover.x}
                    cy={growthHover.y1}
                    r={4.5}
                    fill="var(--pine)"
                    stroke="var(--bg, #101214)"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={growthHover.x}
                    cy={growthHover.y2}
                    r={4.5}
                    fill="var(--faint)"
                    stroke="var(--bg, #101214)"
                    strokeWidth={2.5}
                  />
                </g>
              )}

              {/* X Axis Date Labels matching official Murmura */}
              <text x="50" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 1
              </text>
              <text x="102" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 4
              </text>
              <text x="154" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 7
              </text>
              <text x="206" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 10
              </text>
              <text x="258" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 13
              </text>
              <text x="310" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 16
              </text>
              <text x="362" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 19
              </text>
              <text x="414" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 22
              </text>
              <text x="466" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 25
              </text>
              <text x="518" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 28
              </text>
              <text x="570" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 30
              </text>

              {/* Live Pinpoint Glow Dot at end */}
              {!growthHover && (
                <>
                  <circle cx="570" cy="38" r="8" fill="var(--pine)" opacity="0.3" className="animate-ping" />
                  <circle cx="570" cy="38" r="4.5" fill="var(--pine)" stroke="var(--float, #fff)" strokeWidth="2" />
                </>
              )}
            </svg>

            {/* Floating Interactive Tooltip */}
            {growthHover && (
              <div
                className="chart__tip"
                style={{
                  opacity: 1,
                  left: `${growthHover.xPx > 320 ? growthHover.xPx - 165 : growthHover.xPx + 14}px`,
                  top: `${Math.max(12, Math.min(100, growthHover.yPx - 60))}px`,
                  pointerEvents: 'none',
                  zIndex: 20,
                  position: 'absolute',
                }}
              >
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '12px' }}>
                  {growthHover.date}
                </div>
                <span>
                  <i style={{ background: 'var(--pine)', width: 8, height: 8, borderRadius: '50%', flex: 'none', display: 'inline-block' }} />
                  This period
                  <strong>{growthHover.thisVal}</strong>
                </span>
                <span>
                  <i style={{ background: 'var(--faint)', width: 8, height: 8, borderRadius: '50%', flex: 'none', display: 'inline-block' }} />
                  Previous period
                  <strong>{growthHover.prevVal}</strong>
                </span>
              </div>
            )}
          </div>

        </article>

        {/* 2. Impressions & Engagement Card */}
        <article className="card an-imp" id="an-imp">
          <div className="card__head">
            <h2 className="card__title">Impressions &amp; engagement</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <div className="an-imp__top">
            <p className="an-fig">
              <b className="num tnum">{brandData.impressions}</b>
              <span className="an-delta">
                <span className="badge badge--pine">{brandData.impressionsBadge}</span>
                <span className="card__sub">impressions, last {range} days</span>
              </span>
            </p>

            {/* Metric Switcher */}
            <div className="seg" role="group" aria-label="Metric">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={impMetric === 'impressions'}
                onClick={() => setImpMetric('impressions')}
              >
                Impressions
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={impMetric === 'engagements'}
                onClick={() => setImpMetric('engagements')}
              >
                Engagements
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={impMetric === 'clicks'}
                onClick={() => setImpMetric('clicks')}
              >
                Clicks
              </button>
            </div>
          </div>

          <div className="legend an-legend">
            <span>
              <i className="tone--sea" />
              <span>Impressions, this period</span>
            </span>
            <span>
              <i className="an-dash" aria-hidden="true" />
              Previous period
            </span>
          </div>

          {/* SVG Wave Line Chart with Interactive Hover Tracking */}
          <div
            className="an-chart"
            style={{ height: '240px', position: 'relative', cursor: 'crosshair' }}
            onMouseMove={handleImpMouseMove}
            onMouseLeave={handleImpMouseLeave}
          >
            <svg
              ref={impSvgRef}
              viewBox="0 0 500 220"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--sea)" stopOpacity="0.26" />
                  <stop offset="60%" stopColor="var(--sea)" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="var(--sea)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="36" y1="30" x2="480" y2="30" stroke="var(--line)" strokeDasharray="3 4" />
              <text x="28" y="34" fill="var(--muted)" fontSize="11" textAnchor="end">
                {brandData.impY1}
              </text>

              <line x1="36" y1="105" x2="480" y2="105" stroke="var(--line)" strokeDasharray="3 4" />
              <text x="28" y="109" fill="var(--muted)" fontSize="11" textAnchor="end">
                {brandData.impY2}
              </text>

              <line x1="36" y1="180" x2="480" y2="180" stroke="var(--line)" />
              <text x="28" y="184" fill="var(--muted)" fontSize="11" textAnchor="end">
                0
              </text>

              {/* Previous Period Wave (dashed gray) */}
              <path
                ref={impPrevPathRef}
                d="M 40 85 C 80 80, 110 95, 140 85 C 170 75, 200 90, 230 82 C 260 74, 290 88, 320 80 C 350 72, 380 95, 410 88 C 440 80, 460 100, 480 92"
                fill="none"
                stroke="var(--faint)"
                strokeWidth="2"
                strokeDasharray="5 5"
                pathLength="1"
                className="chart__line chart__line--draw"
                style={{ animationDelay: '0.38s' }}
              />

              {/* Current Period Wave Fill */}
              <path
                d="M 40 78 C 70 82, 90 115, 120 110 C 150 78, 170 85, 200 88 C 230 92, 250 82, 280 88 C 310 95, 330 72, 360 84 C 390 95, 410 75, 440 80 C 460 110, 470 95, 480 82 L 480 180 L 40 180 Z"
                fill="url(#impGradient)"
                className="chart__area"
                style={{ animationDelay: '0.40s' }}
              />

              {/* Current Period Wave Line (blue #1f68a8) */}
              <path
                ref={impCurPathRef}
                d="M 40 78 C 70 82, 90 115, 120 110 C 150 78, 170 85, 200 88 C 230 92, 250 82, 280 88 C 310 95, 330 72, 360 84 C 390 95, 410 75, 440 80 C 460 110, 470 95, 480 82"
                fill="none"
                stroke="var(--sea)"
                strokeWidth="2.8"
                strokeLinecap="round"
                pathLength="1"
                className="chart__line chart__line--draw"
                style={{ animationDelay: '0.42s' }}
              />

              {/* Interactive Crosshair & Tracking Dots */}
              {impHover && (
                <g pointerEvents="none">
                  <line
                    x1={impHover.x}
                    y1={30}
                    x2={impHover.x}
                    y2={180}
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={impHover.x}
                    cy={impHover.y1}
                    r={4.5}
                    fill="var(--sea)"
                    stroke="var(--bg, #101214)"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={impHover.x}
                    cy={impHover.y2}
                    r={4.5}
                    fill="var(--faint)"
                    stroke="var(--bg, #101214)"
                    strokeWidth={2.5}
                  />
                </g>
              )}

              {/* X Axis Date Labels matching official Murmura */}
              <text x="40" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 1
              </text>
              <text x="103" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 5
              </text>
              <text x="166" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 9
              </text>
              <text x="229" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 13
              </text>
              <text x="292" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 17
              </text>
              <text x="355" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 21
              </text>
              <text x="418" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 25
              </text>
              <text x="480" y="202" fill="var(--muted)" fontSize="11" textAnchor="middle">
                Oct 30
              </text>

              {/* Live Pinpoint Glow Dot at end */}
              {!impHover && (
                <>
                  <circle cx="480" cy="82" r="8" fill="var(--sea)" opacity="0.3" className="animate-ping" />
                  <circle cx="480" cy="82" r="4" fill="var(--sea)" stroke="var(--float, #fff)" strokeWidth="2" />
                </>
              )}
            </svg>

            {/* Floating Interactive Tooltip */}
            {impHover && (
              <div
                className="chart__tip"
                style={{
                  opacity: 1,
                  left: `${impHover.xPx > 260 ? impHover.xPx - 175 : impHover.xPx + 14}px`,
                  top: `${Math.max(12, Math.min(100, impHover.yPx - 60))}px`,
                  pointerEvents: 'none',
                  zIndex: 20,
                  position: 'absolute',
                }}
              >
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '12px' }}>
                  {impHover.date}
                </div>
                <span>
                  <i style={{ background: 'var(--sea)', width: 8, height: 8, borderRadius: '50%', flex: 'none', display: 'inline-block' }} />
                  {impMetric === 'impressions' ? 'Impressions' : impMetric === 'engagements' ? 'Engagements' : 'Clicks'}, this period
                  <strong>{impHover.thisVal}</strong>
                </span>
                <span>
                  <i style={{ background: 'var(--faint)', width: 8, height: 8, borderRadius: '50%', flex: 'none', display: 'inline-block' }} />
                  Previous period
                  <strong>{impHover.prevVal}</strong>
                </span>
              </div>
            )}
          </div>

        </article>

        {/* 3. Best Time to Post Card */}
        <article className="card an-best" id="an-best">
          <div className="card__head">
            <h2 className="card__title">Best time to post</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <div className="an-best__bar">
            {/* Network switchers */}
            <div className="an-best__seg">
              <div className="seg an-heat__seg" role="group" aria-label="Network">
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={heatNet === 'all'}
                  onClick={() => setHeatNet('all')}
                >
                  All
                </button>
                {['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'].map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      className="seg__btn an-heat__netbtn"
                      aria-pressed={heatNet === n}
                      onClick={() => setHeatNet(n)}
                      title={n}
                    >
                      <NetworkIcon network={n} className="ico" />
                    </button>
                  )
                )}
              </div>
            </div>

            <p className="card__sub an-best__sub">
              Engagement by weekday and hour, your time zone (Europe/Lisbon)
            </p>
          </div>

          {/* Heatmap Grid */}
          <div className="an-heat__scroll" onScroll={() => setHoveredCell(null)}>
            <div className="an-heat" tabIndex={0} role="img" aria-label="Engagement heatmap">
              {/* Day Labels and Row Cells */}
              {DAYS_SHORT.map((dayName, dayIdx) => (
                <React.Fragment key={dayName}>
                  <span className="an-heat__day">{dayName}</span>
                  {Array.from({ length: 24 }).map((_, hourIdx) => {
                    const intensity = heatmapData[dayIdx]?.[hourIdx] ?? 0.1;
                    const isSlot1 = dayIdx === 5 && hourIdx === 8; // Sat 8 AM
                    const isSlot2 = dayIdx === 5 && hourIdx === 18; // Sat 6 PM
                    const isSlot3 = dayIdx === 6 && hourIdx === 20; // Sun 8 PM
                    const isTopSlot = isSlot1 || isSlot2 || isSlot3;
                    const rankNum = isSlot1 ? 1 : isSlot2 ? 2 : isSlot3 ? 3 : 0;
                    const isHovered = hoveredCell?.dayIdx === dayIdx && hoveredCell?.hour === hourIdx;

                    return (
                      <span
                        key={hourIdx}
                        className={`an-cell ${isTopSlot ? 'is-top' : ''} ${isHovered ? 'is-on' : ''}`}
                        data-r={dayIdx}
                        data-h={hourIdx}
                        onMouseEnter={(e) => {
                          const cellEl = e.currentTarget;
                          const cardEl = cellEl.closest('.an-best');
                          if (cardEl) {
                            const cellRect = cellEl.getBoundingClientRect();
                            const cardRect = cardEl.getBoundingClientRect();
                            const rawX = cellRect.left - cardRect.left + cellRect.width / 2;
                            const clampedX = Math.max(90, Math.min(cardRect.width - 90, rawX));
                            const y = cellRect.top - cardRect.top;

                            setHoveredCell({
                              dayIdx,
                              dayFull: DAYS_FULL[dayIdx],
                              hour: hourIdx,
                              hourRange: formatHourRange(hourIdx),
                              index: Math.round(intensity * 100),
                              x: clampedX,
                              y,
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <i style={{ opacity: intensity.toFixed(2) }} />
                        {isTopSlot && <b className="an-ring">{rankNum}</b>}
                      </span>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Bottom Hour Labels */}
              <span />
              {Array.from({ length: 24 }).map((_, h) => (
                <span key={h} className="an-heat__hour">
                  {h % 3 === 0
                    ? h === 0
                      ? '12a'
                      : h === 12
                      ? '12p'
                      : h < 12
                      ? `${h}a`
                      : `${h - 12}p`
                    : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Heatmap Footer Legend & 3 Slots */}
          <div className="an-heat__foot">
            <div className="an-scale" aria-hidden="true">
              <span>Quiet</span>
              <i />
              <span>Busy</span>
            </div>

            <ol className="an-slots" aria-label="Three best slots">
              <li className="an-slot">
                <span className="an-slot__n">1</span>
                <span className="an-slot__t">
                  <b>Sat 8 AM</b>
                  <small>index 100</small>
                </span>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  title="Plan a post for Saturday 8 AM"
                  onClick={() => addToast({ type: 'info', message: 'Slot planned: Sat 8 AM' })}
                >
                  <Calendar className="ico" />
                </button>
              </li>

              <li className="an-slot">
                <span className="an-slot__n">2</span>
                <span className="an-slot__t">
                  <b>Sat 6 PM</b>
                  <small>index 100</small>
                </span>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  title="Plan a post for Saturday 6 PM"
                  onClick={() => addToast({ type: 'info', message: 'Slot planned: Sat 6 PM' })}
                >
                  <Calendar className="ico" />
                </button>
              </li>

              <li className="an-slot">
                <span className="an-slot__n">3</span>
                <span className="an-slot__t">
                  <b>Sun 8 PM</b>
                  <small>index 100</small>
                </span>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  title="Plan a post for Sunday 8 PM"
                  onClick={() => addToast({ type: 'info', message: 'Slot planned: Sun 8 PM' })}
                >
                  <Calendar className="ico" />
                </button>
              </li>
            </ol>
          </div>

          {/* Interactive Floating Cell Hover Tooltip */}
          {hoveredCell && (
            <div
              className="chart__tip an-tip"
              style={{
                position: 'absolute',
                left: `${hoveredCell.x}px`,
                top: `${hoveredCell.y}px`,
                right: 'auto',
                bottom: 'auto',
                transform: 'translate(-50%, -100%) translateY(-10px)',
                opacity: 1,
                pointerEvents: 'none',
                zIndex: 60,
                minWidth: '160px',
                padding: '9px 12px',
              }}
            >
              <b style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '2px', letterSpacing: '-0.01em' }}>
                {hoveredCell.dayFull} · {hoveredCell.hourRange}
              </b>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '12px' }}>
                Engagement index <strong style={{ color: 'var(--text)', fontWeight: 700, marginLeft: 'auto', paddingLeft: '12px' }}>{hoveredCell.index}</strong>
              </span>
            </div>
          )}
        </article>

        {/* 4. Content Mix Card */}
        <article className="card an-mix" id="an-mix">
          <div className="card__head">
            <h2 className="card__title">Content mix</h2>
            <div className="card__tools">
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <p className="an-fig">
            <b className="num tnum">{brandData.postsPublishedCount}</b>
            <span className="card__sub">posts published, {brandData.networkDeliveriesCount} network deliveries</span>
          </p>

          <ul className="an-mix__list">
            {brandData.contentMix.map((item) => (
              <li
                key={item.net}
                className="an-mix__row"
                title={`${item.name}: ${item.count} deliveries`}
              >
                <span className={`net net--sm net--${item.net}`}>
                  <NetworkIcon network={item.net} className="ico" />
                </span>
                <span className="an-mix__name">{item.name}</span>
                <span className="meter an-mix__meter" aria-hidden="true">
                  <span
                    className="meter__fill an-mix__fill"
                    style={{
                      transform: `scaleX(${item.fillRatio})`,
                      transformOrigin: '0 50%',
                    }}
                  />
                </span>
                <b className="num tnum">{item.count}</b>
                <span className="num an-mix__pct">{item.pct}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* 5. By Network Table Card (Full Width) with Drilldown to Accounts */}
        <article className="card an-net" id="an-net">
          <div className="card__head">
            <h2 className="card__title">
              {activeNetwork !== 'all'
                ? `${NETWORK_NAMES[activeNetwork] || activeNetwork} accounts`
                : 'By network'}
            </h2>
            <div className="card__tools" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeNetwork !== 'all' && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setActiveNetwork('all')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                  title="Return to By network table"
                >
                  <ArrowLeft className="ico" style={{ width: '15px', height: '15px' }} />
                  All networks
                </button>
              )}
              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className={`table an-table ${activeNetwork === 'all' ? 'an-table--nets' : ''}`}>
              <caption className="sr">
                {activeNetwork !== 'all'
                  ? `Accounts, status, followers, growth, impressions, engagement rate and posts for ${activeNetwork}`
                  : 'Followers, growth, impressions, engagement rate and posts per network'}
              </caption>
              <thead>
                <tr>
                  <th scope="col" onClick={() => handleSort('name' as any)}>
                    <button type="button">
                      <span>{activeNetwork !== 'all' ? 'Account' : 'Network'}</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className={activeNetwork !== 'all' ? '' : 'r'}
                    onClick={() => activeNetwork === 'all' && handleSort('followers')}
                  >
                    <button type="button">
                      <span>{activeNetwork !== 'all' ? 'Status' : 'Accounts'}</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="r"
                    onClick={() => handleSort('followers')}
                    aria-sort={sortCol === 'followers' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button">
                      <span>Followers</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="r"
                    onClick={() => handleSort('growth')}
                    aria-sort={sortCol === 'growth' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button">
                      <span>Growth</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="r"
                    onClick={() => handleSort('impressions')}
                    aria-sort={sortCol === 'impressions' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button">
                      <span>Impressions</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="r"
                    onClick={() => handleSort('eng')}
                    aria-sort={sortCol === 'eng' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button">
                      <span>Eng. rate</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="r"
                    onClick={() => handleSort('posts')}
                    aria-sort={sortCol === 'posts' ? (sortAsc ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button">
                      <span>Posts</span>
                    </button>
                  </th>
                  <th scope="col" className="an-trend-h">
                    Followers trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeNetwork !== 'all' ? (
                  sortedAccounts.length > 0 ? (
                    sortedAccounts.map((acc, accIdx) => (
                      <tr key={acc.id}>
                        <th scope="row">
                          <div className="cell-person" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              className={`bmark bmark--md tone--${acc.brandTone}`}
                              style={{
                                width: '36px',
                                height: '36px',
                                minWidth: '36px',
                                borderRadius: '10px',
                                display: 'inline-grid',
                                placeItems: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {acc.brandCode}
                            </span>
                            <span style={{ display: 'grid', lineHeight: 1.25 }}>
                              <b style={{ color: 'var(--text)', fontSize: '13px' }}>{acc.name}</b>
                              <small style={{ color: 'var(--muted)', fontSize: '12px' }}>{acc.handle}</small>
                            </span>
                          </div>
                        </th>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--text)',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background:
                                  acc.status === 'connected'
                                    ? 'var(--pine, #22c55e)'
                                    : acc.status === 'expiring'
                                    ? 'var(--butter, #eab308)'
                                    : 'var(--coral, #ef4444)',
                              }}
                            />
                            {acc.status === 'connected'
                              ? 'Connected'
                              : acc.status === 'expiring'
                              ? 'Expiring'
                              : 'Disconnected'}
                          </span>
                        </td>
                        <td className="r num">
                          <b>{formatCompactVal(acc.followers)}</b>
                        </td>
                        <td className="r num">
                          <span className={`an-growth ${acc.growth >= 0 ? 'is-up' : 'is-down'}`}>
                            {acc.growth >= 0 ? '+' : ''}
                            {acc.growth}%
                          </span>
                        </td>
                        <td className="r num">{formatCompactVal(acc.impressions)}</td>
                        <td className="r num">{acc.eng}%</td>
                        <td className="r num">{acc.posts}</td>
                        <td className="an-trend">
                          <svg viewBox="0 0 96 28" className="spark" style={{ width: '96px', height: '28px' }}>
                            <path
                              d={getSparklinePath(acc.trend)}
                              fill="none"
                              stroke="var(--pine, #22c55e)"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              pathLength="1"
                              className="chart__line chart__line--spark"
                              style={{ animationDelay: `${0.2 + accIdx * 0.04}s` }}
                            />
                          </svg>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--muted)' }}>
                        No accounts connected for {NETWORK_NAMES[activeNetwork] || activeNetwork}
                      </td>
                    </tr>
                  )
                ) : (
                  sortedNetworks.map((row, rowIdx) => (
                    <tr
                      key={row.key}
                      className="an-row--go"
                      onClick={() => setActiveNetwork(row.net)}
                      style={{ cursor: 'pointer' }}
                      title={`Click to view all ${row.name} accounts`}
                    >
                      <th scope="row">
                        <div className="cell-person">
                          <span className={`net net--md net--${row.net}`}>
                            <NetworkIcon network={row.net} className="ico" />
                          </span>
                          <span>
                            <b>{row.name}</b>
                            <small>
                              {row.accounts} account{row.accounts === 1 ? '' : 's'}
                            </small>
                          </span>
                        </div>
                      </th>
                      <td className="r num an-acc">{row.accounts}</td>
                      <td className="r num">
                        <b>{formatCompactVal(row.followers)}</b>
                      </td>
                      <td className="r num">
                        <span className={`an-growth ${row.growth >= 0 ? 'is-up' : 'is-down'}`}>
                          {row.growth >= 0 ? '+' : ''}
                          {row.growth}%
                        </span>
                      </td>
                      <td className="r num">{formatCompactVal(row.impressions)}</td>
                      <td className="r num">{row.eng}%</td>
                      <td className="r num">{row.posts}</td>
                      <td className="an-trend">
                        <svg viewBox="0 0 96 28" className="spark" style={{ width: '96px', height: '28px' }}>
                          <path
                            d={getSparklinePath(row.trend)}
                            fill="none"
                            stroke="var(--pine)"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength="1"
                            className="chart__line chart__line--spark"
                            style={{ animationDelay: `${0.40 + rowIdx * 0.04}s` }}
                          />
                        </svg>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* 6. Top Posts Card (Left) */}
        <article className="card an-top" id="an-top">
          <div className="card__head">
            <h2 className="card__title">Top posts</h2>
            <div className="card__tools">
              <div className="seg" role="group" aria-label="Rank by">
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={topRankBy === 'reach'}
                  onClick={() => setTopRankBy('reach')}
                >
                  Reach
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={topRankBy === 'eng'}
                  onClick={() => setTopRankBy('eng')}
                >
                  Eng. rate
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={topRankBy === 'clicks'}
                  onClick={() => setTopRankBy('clicks')}
                >
                  Clicks
                </button>
              </div>

              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          {brandData.topPosts.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', opacity: 0.6 }}>
              <p>No top posts data available yet.</p>
            </div>
          ) : (
            <ol className="an-posts">
              {brandData.topPosts.map((p: any) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="an-post"
                    onClick={() => p.permalinkUrl && window.open(p.permalinkUrl, '_blank', 'noopener,noreferrer')}
                    title={p.permalinkUrl ? 'View post on Instagram' : undefined}
                    style={{ cursor: p.permalinkUrl ? 'pointer' : 'default', textDecoration: 'none' }}
                  >
                    <span className="an-post__img">
                      {p.img ? (
                        <img
                          src={p.img}
                          alt={p.caption || 'Post image'}
                          className="thumb"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span
                          className="thumb"
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            background: 'var(--well)',
                            fontSize: '11px',
                            padding: '6px',
                            color: 'var(--muted)',
                            textAlign: 'center',
                          }}
                        >
                          {(p.caption || 'Post').slice(0, 28)}
                        </span>
                      )}
                      <span className="an-post__rank">{p.rank}</span>
                      {p.network && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                            borderRadius: '999px',
                            padding: '3px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 700,
                          }}
                        >
                          <NetworkIcon network={p.network} className="w-3 h-3" />
                        </span>
                      )}
                    </span>
                    <span className="an-post__body">
                      <b className="an-post__val num tnum">{p.val}</b>
                      <small style={{ color: 'var(--muted)', fontSize: '12px' }}>{p.metric}</small>

                      <div
                        className="an-post__meta"
                        style={{
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11.5px',
                          color: 'var(--muted)',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '120px',
                          }}
                        >
                          {p.handle}
                        </span>
                        {p.dateStr && <span>{p.dateStr}</span>}
                      </div>

                      <div
                        className="an-post__mini"
                        style={{
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          color: 'var(--muted)',
                        }}
                      >
                        {p.reach > 0 && <span>👁 {formatCompactVal(p.reach)}</span>}
                        {p.likes > 0 && <span>♡ {formatCompactVal(p.likes)}</span>}
                        {p.comments > 0 && <span>💬 {formatCompactVal(p.comments)}</span>}
                      </div>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>

        {/* 7. Brand Comparison Card (Right) */}
        <article className="card an-brands" id="an-brands">
          <div className="card__head">
            <h2 className="card__title">Brand comparison</h2>
            <div className="card__tools">
              <div className="seg" role="group" aria-label="Compare by">
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={brandCompareBy === 'followers'}
                  onClick={() => setBrandCompareBy('followers')}
                >
                  Followers
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={brandCompareBy === 'eng'}
                  onClick={() => setBrandCompareBy('eng')}
                >
                  Eng. rate
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={brandCompareBy === 'impressions'}
                  onClick={() => setBrandCompareBy('impressions')}
                >
                  Impressions
                </button>
              </div>

              <button type="button" className="ibtn ibtn--sm" title="Expand">
                <ArrowUpRight className="ico" />
              </button>
            </div>
          </div>

          <ul className="an-bars">
            {(() => {
              const compList: any[] =
                brandsComparisonRes?.brands && brandsComparisonRes.brands.length > 0
                  ? brandsComparisonRes.brands
                  : brands.map((b) => ({
                      id: b.id,
                      name: b.name,
                      accountsCount: 0,
                      followers: 0,
                      engagementRate: 0,
                      impressions: 0,
                    }));

              if (compList.length === 0) {
                return (
                  <li style={{ padding: '2rem 1rem', textAlign: 'center', opacity: 0.6, listStyle: 'none' }}>
                    No brands to compare yet.
                  </li>
                );
              }

              const getMetricVal = (b: any) =>
                brandCompareBy === 'eng'
                  ? Number(b.engagementRate ?? 0)
                  : brandCompareBy === 'impressions'
                    ? Number(b.impressions ?? 0)
                    : Number(b.followers ?? 0);

              const maxVal = Math.max(...compList.map(getMetricVal), 0);

              return compList.map((b) => {
                const rawVal = getMetricVal(b);
                const ratio = maxVal > 0 ? Math.max(0.06, rawVal / maxVal) : 0;
                const displayVal =
                  brandCompareBy === 'eng' ? `${rawVal}%` : formatCompactVal(rawVal);

                return (
                  <li key={b.id} className="an-bar">
                    <span className="bmark bmark--md tone--coral">{b.name.slice(0, 2).toUpperCase()}</span>
                    <span className="an-bar__name">
                      <b>{b.name}</b>
                      <small>
                        {b.accountsCount} account{b.accountsCount === 1 ? '' : 's'}
                      </small>
                    </span>
                    <span className="meter an-bar__meter">
                      <span
                        className="meter__fill"
                        style={{ transform: `scaleX(${ratio})`, transformOrigin: '0 50%' }}
                      />
                    </span>
                    <b className="num tnum">{displayVal}</b>
                  </li>
                );
              });
            })()}
          </ul>
        </article>
      </div>

      {/* Schedule a Report Modal Dialog */}
      {showScheduleModal && (
        <>
          <div
            className="scrim"
            style={{ opacity: 1, visibility: 'visible', zIndex: 60 }}
            onClick={() => setShowScheduleModal(false)}
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
            <form className="mform" onSubmit={handleScheduleSubmit}>
              <div className="mform__head">
                <div>
                  <h3 className="mform__title">Schedule a report</h3>
                  <p className="mform__sub">
                    The All brands report is emailed as a PDF and a CSV, every period, to the people you pick.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setShowScheduleModal(false)}
                >
                  <X className="ico" />
                </button>
              </div>

              <div className="mform__grid">
                <div className="field field--wide">
                  <label className="field__label">Report name</label>
                  <input
                    type="text"
                    required
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                  />
                </div>

                <div className="field field--wide">
                  <label className="field__label">How often</label>
                  <select
                    className="input"
                    value={reportFreq}
                    onChange={(e) => setReportFreq(e.target.value as any)}
                  >
                    <option value="weekly">Weekly, Mondays at 9:00</option>
                    <option value="monthly">Monthly, on the 1st at 9:00</option>
                  </select>
                </div>

                <fieldset className="an-recips mform__extra">
                  <legend className="field__label">Recipients</legend>
                  <div className="an-recips__list">
                    {[
                      { name: 'Camila Ortiz', email: 'owner@example.com' },
                      { name: 'Malik Johnson', email: 'team@example.com' },
                      { name: 'Elise Marchand', email: 'client@example.com' },
                      { name: 'Haruto Sato', email: 'support@example.com' },
                    ].map((person, idx) => (
                      <label key={person.email} className="an-recip">
                        <input type="checkbox" className="check" defaultChecked={idx === 0} />
                        <div className="av av--sm av--t0">{person.name[0]}</div>
                        <span>
                          <b>{person.name}</b>
                          <small>{person.email}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="mform__foot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--pine">
                  Schedule
                </button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </div>
  );
}
