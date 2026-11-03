import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { getActiveBrand } from '../../lib/brandHelper.js';

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

const NETWORK_ACCOUNTS: Record<string, NetworkAccountRow[]> = {
  tiktok: [
    {
      id: 'vg-tt',
      net: 'tiktok',
      brandCode: 'VG',
      brandTone: 'ink',
      name: 'Vantage Garage',
      handle: '@vantagegarage',
      status: 'connected',
      followers: 201500,
      growth: 4.6,
      impressions: 2290000,
      eng: 8.8,
      posts: 6,
      trend: [180, 185, 189, 192, 196, 199, 201.5],
    },
    {
      id: 'eo-tt',
      net: 'tiktok',
      brandCode: 'EO',
      brandTone: 'coral',
      name: 'Ember & Oak',
      handle: '@emberandoak',
      status: 'connected',
      followers: 63900,
      growth: 9.7,
      impressions: 692200,
      eng: 9.3,
      posts: 10,
      trend: [56, 57.5, 59, 60.5, 61.8, 62.9, 63.9],
    },
    {
      id: 'wb-tt',
      net: 'tiktok',
      brandCode: 'WB',
      brandTone: 'pine',
      name: 'Wildroot Botanics',
      handle: '@wildroot',
      status: 'connected',
      followers: 41200,
      growth: 15.2,
      impressions: 454300,
      eng: 8.1,
      posts: 7,
      trend: [34, 35.2, 36.8, 38, 39.4, 40.2, 41.2],
    },
  ],
  instagram: [
    {
      id: 'hh-ig',
      net: 'instagram',
      brandCode: 'HH',
      brandTone: 'butter',
      name: 'Hollow Home',
      handle: '@hollowhome',
      status: 'connected',
      followers: 112400,
      growth: 12.4,
      impressions: 1280000,
      eng: 8.4,
      posts: 15,
      trend: [98, 101, 104, 107, 109, 111, 112.4],
    },
    {
      id: 'vg-ig',
      net: 'instagram',
      brandCode: 'VG',
      brandTone: 'ink',
      name: 'Vantage Garage',
      handle: '@vantagegarage',
      status: 'connected',
      followers: 74300,
      growth: 4.0,
      impressions: 840000,
      eng: 7.6,
      posts: 9,
      trend: [71, 71.8, 72.5, 73.1, 73.8, 74.0, 74.3],
    },
    {
      id: 'wb-ig',
      net: 'instagram',
      brandCode: 'WB',
      brandTone: 'pine',
      name: 'Wildroot Botanics',
      handle: '@wildroot',
      status: 'connected',
      followers: 56800,
      growth: 7.9,
      impressions: 650000,
      eng: 8.0,
      posts: 8,
      trend: [52, 53, 54, 55, 55.8, 56.4, 56.8],
    },
    {
      id: 'eo-ig',
      net: 'instagram',
      brandCode: 'EO',
      brandTone: 'coral',
      name: 'Ember & Oak',
      handle: '@emberandoak',
      status: 'connected',
      followers: 48200,
      growth: 8.2,
      impressions: 500000,
      eng: 7.5,
      posts: 8,
      trend: [44, 44.8, 45.6, 46.5, 47.2, 47.8, 48.2],
    },
  ],
  youtube: [
    {
      id: 'vg-yt',
      net: 'youtube',
      brandCode: 'VG',
      brandTone: 'ink',
      name: 'Vantage Garage',
      handle: 'Vantage Garage',
      status: 'connected',
      followers: 129800,
      growth: 18.9,
      impressions: 1390000,
      eng: 8.3,
      posts: 11,
      trend: [108, 112, 117, 121, 125, 127.5, 129.8],
    },
    {
      id: 'hh-yt',
      net: 'youtube',
      brandCode: 'HH',
      brandTone: 'butter',
      name: 'Hollow Home',
      handle: 'Hollow Home',
      status: 'expiring',
      followers: 18700,
      growth: 16.2,
      impressions: 200000,
      eng: 7.2,
      posts: 2,
      trend: [15.8, 16.3, 16.9, 17.4, 17.9, 18.3, 18.7],
    },
  ],
  pinterest: [
    {
      id: 'hh-pin',
      net: 'pinterest',
      brandCode: 'HH',
      brandTone: 'butter',
      name: 'Hollow Home',
      handle: '@hollowhome',
      status: 'connected',
      followers: 86300,
      growth: 10.3,
      impressions: 930000,
      eng: 7.1,
      posts: 9,
      trend: [77, 79, 81, 82.5, 84, 85.2, 86.3],
    },
    {
      id: 'wb-pin',
      net: 'pinterest',
      brandCode: 'WB',
      brandTone: 'pine',
      name: 'Wildroot Botanics',
      handle: '@wildroot',
      status: 'connected',
      followers: 23900,
      growth: 16.2,
      impressions: 260000,
      eng: 6.8,
      posts: 5,
      trend: [20.2, 20.8, 21.5, 22.2, 22.9, 23.4, 23.9],
    },
  ],
  facebook: [
    {
      id: 'hh-fb',
      net: 'facebook',
      brandCode: 'HH',
      brandTone: 'butter',
      name: 'Hollow Home',
      handle: 'Hollow Home',
      status: 'connected',
      followers: 30950,
      growth: 7.7,
      impressions: 345000,
      eng: 7.5,
      posts: 6,
      trend: [28.2, 28.7, 29.3, 29.8, 30.2, 30.6, 31.0],
    },
    {
      id: 'vg-fb',
      net: 'facebook',
      brandCode: 'VG',
      brandTone: 'ink',
      name: 'Vantage Garage',
      handle: 'Vantage Garage',
      status: 'disconnected',
      followers: 22100,
      growth: 13.5,
      impressions: 248700,
      eng: 8.2,
      posts: 5,
      trend: [19.2, 19.8, 20.5, 21.1, 21.5, 21.8, 22.1],
    },
    {
      id: 'eo-fb',
      net: 'facebook',
      brandCode: 'EO',
      brandTone: 'coral',
      name: 'Ember & Oak',
      handle: 'Ember & Oak',
      status: 'connected',
      followers: 21450,
      growth: 5.0,
      impressions: 235000,
      eng: 7.6,
      posts: 4,
      trend: [20.2, 20.4, 20.7, 20.9, 21.1, 21.3, 21.45],
    },
  ],
  x: [
    {
      id: 'vg-x',
      net: 'x',
      brandCode: 'VG',
      brandTone: 'ink',
      name: 'Vantage Garage',
      handle: '@vantagegarage',
      status: 'connected',
      followers: 15290,
      growth: 10.5,
      impressions: 171300,
      eng: 8.3,
      posts: 9,
      trend: [13.6, 14.0, 14.3, 14.7, 14.9, 15.1, 15.3],
    },
    {
      id: 'ns-x',
      net: 'x',
      brandCode: 'NS',
      brandTone: 'lilac',
      name: 'Northlight Studio',
      handle: '@northlightstudio',
      status: 'connected',
      followers: 4310,
      growth: 6.2,
      impressions: 48000,
      eng: 7.4,
      posts: 4,
      trend: [4.0, 4.05, 4.12, 4.18, 4.23, 4.27, 4.31],
    },
  ],
  threads: [
    {
      id: 'eo-th',
      net: 'threads',
      brandCode: 'EO',
      brandTone: 'coral',
      name: 'Ember & Oak',
      handle: '@emberandoak',
      status: 'connected',
      followers: 9100,
      growth: 7.3,
      impressions: 102000,
      eng: 7.0,
      posts: 8,
      trend: [8.4, 8.5, 8.7, 8.8, 8.9, 9.0, 9.1],
    },
    {
      id: 'wb-th',
      net: 'threads',
      brandCode: 'WB',
      brandTone: 'pine',
      name: 'Wildroot Botanics',
      handle: '@wildroot',
      status: 'connected',
      followers: 7400,
      growth: 8.9,
      impressions: 82700,
      eng: 6.8,
      posts: 6,
      trend: [6.7, 6.8, 7.0, 7.1, 7.2, 7.3, 7.4],
    },
  ],
  linkedin: [
    {
      id: 'ns-li',
      net: 'linkedin',
      brandCode: 'NS',
      brandTone: 'lilac',
      name: 'Northlight Studio',
      handle: 'Northlight Studio',
      status: 'connected',
      followers: 8700,
      growth: 21.5,
      impressions: 97300,
      eng: 8.0,
      posts: 6,
      trend: [7.1, 7.4, 7.7, 8.0, 8.2, 8.5, 8.7],
    },
  ],
};

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

const NETWORKS_LIST = [
  { id: 'all', name: 'All networks', count: 19 },
  { id: 'instagram', name: 'Instagram', count: 4 },
  { id: 'facebook', name: 'Facebook', count: 3 },
  { id: 'x', name: 'X', count: 2 },
  { id: 'linkedin', name: 'LinkedIn', count: 1 },
  { id: 'tiktok', name: 'TikTok', count: 3 },
  { id: 'youtube', name: 'YouTube', count: 2 },
  { id: 'pinterest', name: 'Pinterest', count: 2 },
  { id: 'threads', name: 'Threads', count: 2 },
];

const DEFAULT_NETWORKS_TABLE: NetworkRow[] = [
  {
    key: 'tiktok',
    net: 'tiktok',
    name: 'TikTok',
    accounts: 3,
    followers: 306600,
    growth: 7.0,
    impressions: 3420000,
    eng: 9.1,
    posts: 20,
    trend: [280, 285, 290, 295, 298, 302, 306.6],
  },
  {
    key: 'instagram',
    net: 'instagram',
    name: 'Instagram',
    accounts: 4,
    followers: 291700,
    growth: 8.8,
    impressions: 3270000,
    eng: 7.9,
    posts: 40,
    trend: [268, 272, 278, 282, 286, 289, 291.7],
  },
  {
    key: 'youtube',
    net: 'youtube',
    name: 'YouTube',
    accounts: 2,
    followers: 148500,
    growth: 19.3,
    impressions: 1590000,
    eng: 8.1,
    posts: 13,
    trend: [124, 128, 133, 139, 142, 145, 148.5],
  },
  {
    key: 'pinterest',
    net: 'pinterest',
    name: 'Pinterest',
    accounts: 2,
    followers: 110200,
    growth: 11.7,
    impressions: 1190000,
    eng: 7.0,
    posts: 14,
    trend: [98, 101, 103, 106, 108, 109, 110.2],
  },
  {
    key: 'facebook',
    net: 'facebook',
    name: 'Facebook',
    accounts: 3,
    followers: 74500,
    growth: 8.7,
    impressions: 828700,
    eng: 7.8,
    posts: 15,
    trend: [68, 69, 71, 72, 73, 74, 74.5],
  },
  {
    key: 'x',
    net: 'x',
    name: 'X',
    accounts: 2,
    followers: 19600,
    growth: 9.5,
    impressions: 219300,
    eng: 8.1,
    posts: 13,
    trend: [17.8, 18.2, 18.5, 18.9, 19.1, 19.4, 19.6],
  },
  {
    key: 'threads',
    net: 'threads',
    name: 'Threads',
    accounts: 2,
    followers: 16500,
    growth: 8.0,
    impressions: 184700,
    eng: 6.9,
    posts: 14,
    trend: [15.2, 15.5, 15.7, 16.0, 16.2, 16.4, 16.5],
  },
  {
    key: 'linkedin',
    net: 'linkedin',
    name: 'LinkedIn',
    accounts: 1,
    followers: 8700,
    growth: 21.5,
    impressions: 97300,
    eng: 8.0,
    posts: 6,
    trend: [7.1, 7.4, 7.7, 8.0, 8.2, 8.5, 8.7],
  },
];

const HOLLOW_HOME_NETWORKS_TABLE: NetworkRow[] = [
  {
    key: 'instagram',
    net: 'instagram',
    name: 'Instagram',
    accounts: 1,
    followers: 142500,
    growth: 8.8,
    impressions: 1480000,
    eng: 8.2,
    posts: 6,
    trend: [131, 133, 136, 138, 140, 141, 142.5],
  },
  {
    key: 'facebook',
    net: 'facebook',
    name: 'Facebook',
    accounts: 1,
    followers: 45200,
    growth: 8.7,
    impressions: 480000,
    eng: 7.1,
    posts: 2,
    trend: [41, 42, 43, 43.8, 44.5, 44.9, 45.2],
  },
  {
    key: 'youtube',
    net: 'youtube',
    name: 'YouTube',
    accounts: 1,
    followers: 32100,
    growth: 19.3,
    impressions: 420000,
    eng: 8.4,
    posts: 2,
    trend: [26.5, 27.8, 29.0, 30.1, 31.0, 31.6, 32.1],
  },
  {
    key: 'pinterest',
    net: 'pinterest',
    name: 'Pinterest',
    accounts: 1,
    followers: 28600,
    growth: 11.7,
    impressions: 390000,
    eng: 6.9,
    posts: 1,
    trend: [25.2, 26.0, 26.8, 27.4, 27.9, 28.3, 28.6],
  },
];

const VANTAGE_GARAGE_NETWORKS_TABLE: NetworkRow[] = [
  {
    key: 'tiktok',
    net: 'tiktok',
    name: 'TikTok',
    accounts: 1,
    followers: 185000,
    growth: 7.0,
    impressions: 2100000,
    eng: 9.1,
    posts: 4,
    trend: [170, 173, 176, 179, 181, 183, 185],
  },
  {
    key: 'instagram',
    net: 'instagram',
    name: 'Instagram',
    accounts: 1,
    followers: 149200,
    growth: 8.8,
    impressions: 1650000,
    eng: 8.5,
    posts: 3,
    trend: [136, 139, 142, 144, 146, 148, 149.2],
  },
  {
    key: 'youtube',
    net: 'youtube',
    name: 'YouTube',
    accounts: 1,
    followers: 62000,
    growth: 14.2,
    impressions: 620000,
    eng: 8.0,
    posts: 1,
    trend: [54, 56, 58, 59, 60, 61, 62],
  },
  {
    key: 'x',
    net: 'x',
    name: 'X',
    accounts: 1,
    followers: 19600,
    growth: 9.5,
    impressions: 219300,
    eng: 8.1,
    posts: 1,
    trend: [17.8, 18.2, 18.5, 18.9, 19.1, 19.4, 19.6],
  },
  {
    key: 'facebook',
    net: 'facebook',
    name: 'Facebook',
    accounts: 1,
    followers: 27100,
    growth: 6.2,
    impressions: 230700,
    eng: 7.4,
    posts: 1,
    trend: [25.1, 25.6, 26.0, 26.4, 26.7, 26.9, 27.1],
  },
];

const CONTENT_MIX_ITEMS = [
  { net: 'instagram', name: 'Instagram', count: 40, pct: '30%', fillRatio: 1.0 },
  { net: 'tiktok', name: 'TikTok', count: 20, pct: '15%', fillRatio: 0.5 },
  { net: 'facebook', name: 'Facebook', count: 15, pct: '11%', fillRatio: 0.38 },
  { net: 'pinterest', name: 'Pinterest', count: 14, pct: '10%', fillRatio: 0.35 },
  { net: 'threads', name: 'Threads', count: 14, pct: '10%', fillRatio: 0.35 },
  { net: 'x', name: 'X', count: 13, pct: '10%', fillRatio: 0.33 },
  { net: 'youtube', name: 'YouTube', count: 13, pct: '10%', fillRatio: 0.33 },
  { net: 'linkedin', name: 'LinkedIn', count: 6, pct: '4%', fillRatio: 0.15 },
];

const TOP_POSTS_DATA = [
  {
    id: 'tp1',
    rank: 1,
    img: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=500&auto=format&fit=crop&q=80',
    val: '346.9K',
    metric: 'reach',
    brandCode: 'VG',
    brandName: 'Vantage Garage',
    brandTone: 'ink',
    date: 'Oct 18',
    networks: ['instagram', 'tiktok', 'x'],
    impressions: '525.9K',
    likes: '80.4K',
  },
  {
    id: 'tp2',
    rank: 2,
    img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=500&auto=format&fit=crop&q=80',
    val: '168K',
    metric: 'reach',
    brandCode: 'VG',
    brandName: 'Vantage Garage',
    brandTone: 'ink',
    date: 'Oct 22',
    networks: ['instagram', 'x'],
    impressions: '234.4K',
    likes: '8.4K',
  },
  {
    id: 'tp3',
    rank: 3,
    img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop&q=80',
    val: '154.2K',
    metric: 'reach',
    brandCode: 'HH',
    brandName: 'Hollow Home',
    brandTone: 'butter',
    date: 'Oct 7',
    networks: ['instagram', 'pinterest', 'facebook', 'youtube'],
    impressions: '215.3K',
    likes: '10.5K',
  },
  {
    id: 'tp4',
    rank: 4,
    img: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80',
    val: '146.6K',
    metric: 'reach',
    brandCode: 'HH',
    brandName: 'Hollow Home',
    brandTone: 'butter',
    date: 'Sep 29',
    networks: ['instagram', 'pinterest'],
    impressions: '198.2K',
    likes: '7.8K',
  },
  {
    id: 'tp5',
    rank: 5,
    img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&auto=format&fit=crop&q=80',
    val: '130.4K',
    metric: 'reach',
    brandCode: 'HH',
    brandName: 'Hollow Home',
    brandTone: 'butter',
    date: 'Oct 12',
    networks: ['instagram', 'facebook'],
    impressions: '175.0K',
    likes: '6.9K',
  },
  {
    id: 'tp6',
    rank: 6,
    img: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80',
    val: '112.5K',
    metric: 'reach',
    brandCode: 'VG',
    brandName: 'Vantage Garage',
    brandTone: 'ink',
    date: 'Oct 7',
    networks: ['instagram', 'tiktok', 'x'],
    impressions: '162.1K',
    likes: '5.2K',
  },
];

const BRANDS_COMPARISON_DATA = [
  {
    code: 'VG',
    name: 'Vantage Garage',
    tone: 'ink',
    accounts: 5,
    posts: 10,
    val: '442.9K',
    fillRatio: 1.0,
  },
  {
    code: 'HH',
    name: 'Hollow Home',
    tone: 'butter',
    accounts: 4,
    posts: 10,
    val: '248.4K',
    fillRatio: 0.56,
  },
  {
    code: 'EO',
    name: 'Ember & Oak',
    tone: 'coral',
    accounts: 4,
    posts: 10,
    val: '142.7K',
    fillRatio: 0.32,
  },
  {
    code: 'WB',
    name: 'Wildroot Botanics',
    tone: 'pine',
    accounts: 4,
    posts: 10,
    val: '129.3K',
    fillRatio: 0.29,
  },
  {
    code: 'NS',
    name: 'Northlight Studio',
    tone: 'sea',
    accounts: 2,
    posts: 6,
    val: '13K',
    fillRatio: 0.03,
  },
];

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
  const addToast = useToastStore((state) => state.addToast);

  // Active brand resolution
  const activeBrand = useMemo(() => {
    return getActiveBrand(selectedBrandId, brands);
  }, [brands, selectedBrandId]);

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

  // Dynamic brand analytics data computation
  const brandData = useMemo(() => {
    if (isHollowHome) {
      return {
        scopeTitle: `Hollow Home · last ${range} days`,
        audience: '248.4K',
        audienceLabel: 'Audience across 4 accounts',
        newFollowers: '25.8K',
        followersBadge: '+11.6%',
        impressions: '2.77M',
        impressionsBadge: '+4.8%',
        engRate: '7.7%',
        engLabel: 'Avg. engagement rate, 11 posts',
        growthNum: '+25.8K',
        growthSub: `followers gained, last ${range} days · +25.1% vs the ${range} days before`,
        networksList: [
          { id: 'all', name: 'All networks', count: 4 },
          { id: 'instagram', name: 'Instagram', count: 1 },
          { id: 'facebook', name: 'Facebook', count: 1 },
          { id: 'youtube', name: 'YouTube', count: 1 },
          { id: 'pinterest', name: 'Pinterest', count: 1 },
        ],
        networksTable: HOLLOW_HOME_NETWORKS_TABLE,
        contentMix: [
          { net: 'instagram', name: 'Instagram', count: 6, pct: '55%', fillRatio: 1.0 },
          { net: 'facebook', name: 'Facebook', count: 2, pct: '18%', fillRatio: 0.33 },
          { net: 'youtube', name: 'YouTube', count: 2, pct: '18%', fillRatio: 0.33 },
          { net: 'pinterest', name: 'Pinterest', count: 1, pct: '9%', fillRatio: 0.16 },
        ],
        postsPublishedCount: 11,
        networkDeliveriesCount: 32,
        topPosts: TOP_POSTS_DATA.filter((p) => p.brandCode === 'HH' || p.brandName.includes('Hollow')),
        y1: '50K',
        y2: '25K',
        impY1: '200K',
        impY2: '100K',
      };
    } else if (isVantageGarage) {
      return {
        scopeTitle: `Vantage Garage · last ${range} days`,
        audience: '442.9K',
        audienceLabel: 'Audience across 5 accounts',
        newFollowers: '41.2K',
        followersBadge: '+9.4%',
        impressions: '4.82M',
        impressionsBadge: '+6.2%',
        engRate: '8.4%',
        engLabel: 'Avg. engagement rate, 10 posts',
        growthNum: '+41.2K',
        growthSub: `followers gained, last ${range} days · +18.2% vs the ${range} days before`,
        networksList: [
          { id: 'all', name: 'All networks', count: 5 },
          { id: 'tiktok', name: 'TikTok', count: 1 },
          { id: 'instagram', name: 'Instagram', count: 1 },
          { id: 'youtube', name: 'YouTube', count: 1 },
          { id: 'x', name: 'X', count: 1 },
          { id: 'facebook', name: 'Facebook', count: 1 },
        ],
        networksTable: VANTAGE_GARAGE_NETWORKS_TABLE,
        contentMix: [
          { net: 'tiktok', name: 'TikTok', count: 4, pct: '40%', fillRatio: 1.0 },
          { net: 'instagram', name: 'Instagram', count: 3, pct: '30%', fillRatio: 0.75 },
          { net: 'youtube', name: 'YouTube', count: 1, pct: '10%', fillRatio: 0.25 },
          { net: 'x', name: 'X', count: 1, pct: '10%', fillRatio: 0.25 },
          { net: 'facebook', name: 'Facebook', count: 1, pct: '10%', fillRatio: 0.25 },
        ],
        postsPublishedCount: 10,
        networkDeliveriesCount: 42,
        topPosts: TOP_POSTS_DATA.filter((p) => p.brandCode === 'VG' || p.brandName.includes('Vantage')),
        y1: '60K',
        y2: '30K',
        impY1: '300K',
        impY2: '150K',
      };
    } else if (isStarlightBakery) {
      return {
        scopeTitle: `Starlight Bakery · last ${range} days`,
        audience: '203.9K',
        audienceLabel: 'Audience across 4 accounts',
        newFollowers: '21.4K',
        followersBadge: '+12.4%',
        impressions: '2.15M',
        impressionsBadge: '+7.8%',
        engRate: '8.8%',
        engLabel: 'Avg. engagement rate, 12 posts',
        growthNum: '+21.4K',
        growthSub: `followers gained, last ${range} days · +19.2% vs the ${range} days before`,
        networksList: [
          { id: 'all', name: 'All networks', count: 4 },
          { id: 'tiktok', name: 'TikTok', count: 1 },
          { id: 'instagram', name: 'Instagram', count: 1 },
          { id: 'facebook', name: 'Facebook', count: 1 },
          { id: 'pinterest', name: 'Pinterest', count: 1 },
        ],
        networksTable: [
          { key: 'tiktok', net: 'tiktok', name: 'TikTok', accounts: 1, followers: 98400, growth: 12.4, impressions: 980000, eng: 9.8, posts: 5, trend: [82, 85, 88, 91, 94, 96, 98.4] },
          { key: 'instagram', net: 'instagram', name: 'Instagram', accounts: 1, followers: 64200, growth: 8.8, impressions: 720000, eng: 8.4, posts: 4, trend: [58, 60, 61, 62, 63, 63.8, 64.2] },
          { key: 'facebook', net: 'facebook', name: 'Facebook', accounts: 1, followers: 23100, growth: 4.1, impressions: 260000, eng: 5.2, posts: 2, trend: [21, 21.5, 22, 22.3, 22.7, 23, 23.1] },
          { key: 'pinterest', net: 'pinterest', name: 'Pinterest', accounts: 1, followers: 18200, growth: 14.6, impressions: 190000, eng: 7.1, posts: 1, trend: [14, 15, 15.5, 16.2, 17, 17.8, 18.2] },
        ],
        contentMix: [
          { net: 'tiktok', name: 'TikTok', count: 5, pct: '42%', fillRatio: 1.0 },
          { net: 'instagram', name: 'Instagram', count: 4, pct: '33%', fillRatio: 0.8 },
          { net: 'facebook', name: 'Facebook', count: 2, pct: '17%', fillRatio: 0.4 },
          { net: 'pinterest', name: 'Pinterest', count: 1, pct: '8%', fillRatio: 0.2 },
        ],
        postsPublishedCount: 12,
        networkDeliveriesCount: 36,
        topPosts: [
          {
            id: 'tp-sb-1',
            rank: 1,
            img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80',
            val: '88.4K',
            metric: 'reach',
            brandCode: 'SB',
            brandName: 'Starlight Bakery',
            brandTone: 'coral',
            date: 'Oct 21',
            networks: ['tiktok', 'instagram'],
            impressions: '124.0K',
            likes: '8.4K',
          },
          {
            id: 'tp-sb-2',
            rank: 2,
            img: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=500&auto=format&fit=crop&q=80',
            val: '64.2K',
            metric: 'reach',
            brandCode: 'SB',
            brandName: 'Starlight Bakery',
            brandTone: 'coral',
            date: 'Oct 18',
            networks: ['instagram', 'facebook'],
            impressions: '92.5K',
            likes: '6.1K',
          },
        ],
        y1: '40K',
        y2: '20K',
        impY1: '180K',
        impY2: '90K',
      };
    } else if (activeBrand) {
      const bName = activeBrand.name;
      return {
        scopeTitle: `${bName} · last ${range} days`,
        audience: '142.7K',
        audienceLabel: 'Audience across 4 accounts',
        newFollowers: '14.2K',
        followersBadge: '+8.2%',
        impressions: '1.68M',
        impressionsBadge: '+5.1%',
        engRate: '8.1%',
        engLabel: 'Avg. engagement rate, 8 posts',
        growthNum: '+14.2K',
        growthSub: `followers gained, last ${range} days · +16.4% vs the ${range} days before`,
        networksList: [
          { id: 'all', name: 'All networks', count: 4 },
          { id: 'instagram', name: 'Instagram', count: 1 },
          { id: 'facebook', name: 'Facebook', count: 1 },
          { id: 'x', name: 'X', count: 1 },
          { id: 'linkedin', name: 'LinkedIn', count: 1 },
        ],
        networksTable: DEFAULT_NETWORKS_TABLE.slice(1, 5).map((n) => ({ ...n, accounts: 1 })),
        contentMix: CONTENT_MIX_ITEMS.slice(0, 4),
        postsPublishedCount: 8,
        networkDeliveriesCount: 24,
        topPosts: TOP_POSTS_DATA.slice(0, 3).map((p) => ({ ...p, brandName: bName })),
        y1: '30K',
        y2: '15K',
        impY1: '100K',
        impY2: '50K',
      };
    } else {
      return {
        scopeTitle: `5 brands · last ${range} days`,
        audience: '976.3K',
        audienceLabel: 'Audience across 19 accounts',
        newFollowers: '89.6K',
        followersBadge: '+10.1%',
        impressions: '10.81M',
        impressionsBadge: '+3.6%',
        engRate: '7.9%',
        engLabel: 'Avg. engagement rate, 46 posts',
        growthNum: '+89.6K',
        growthSub: `followers gained, last ${range} days · +14.5% vs the ${range} days before`,
        networksList: NETWORKS_LIST,
        networksTable: DEFAULT_NETWORKS_TABLE,
        contentMix: CONTENT_MIX_ITEMS,
        postsPublishedCount: 46,
        networkDeliveriesCount: 135,
        topPosts: TOP_POSTS_DATA,
        y1: '100K',
        y2: '50K',
        impY1: '500K',
        impY2: '250K',
      };
    }
  }, [isHollowHome, isVantageGarage, isStarlightBakery, activeBrand, range]);

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

  // Sorted accounts table for drilled-down network
  const sortedAccounts = useMemo(() => {
    if (activeNetwork === 'all') return [];
    const accounts = NETWORK_ACCOUNTS[activeNetwork] || [];
    const filtered = activeBrand
      ? accounts.filter((acc) => {
          if (isHollowHome) return acc.brandCode === 'HH' || acc.name.toLowerCase().includes('hollow');
          if (isVantageGarage) return acc.brandCode === 'VG' || acc.name.toLowerCase().includes('vantage');
          if (isStarlightBakery) return acc.brandCode === 'SB' || acc.name.toLowerCase().includes('starlight');
          return acc.name.toLowerCase().includes(activeBrand.name.toLowerCase());
        })
      : accounts;

    return [...filtered].sort((a, b) => {
      let vA: any = a[sortCol as keyof NetworkAccountRow] ?? 0;
      let vB: any = b[sortCol as keyof NetworkAccountRow] ?? 0;
      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortAsc ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });
  }, [activeNetwork, activeBrand, isHollowHome, isVantageGarage, isStarlightBakery, sortCol, sortAsc]);

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
                          <b>
                            {acc.followers >= 1000000
                              ? `${(acc.followers / 1000000).toFixed(2)}M`
                              : `${(acc.followers / 1000).toFixed(1)}K`}
                          </b>
                        </td>
                        <td className="r num">
                          <span className={`an-growth ${acc.growth >= 0 ? 'is-up' : 'is-down'}`}>
                            +{acc.growth}%
                          </span>
                        </td>
                        <td className="r num">
                          {acc.impressions >= 1000000
                            ? `${(acc.impressions / 1000000).toFixed(2)}M`
                            : `${(acc.impressions / 1000).toFixed(1)}K`}
                        </td>
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
                        <b>
                          {row.followers >= 1000000
                            ? `${(row.followers / 1000000).toFixed(2)}M`
                            : `${(row.followers / 1000).toFixed(1)}K`}
                        </b>
                      </td>
                      <td className="r num">
                        <span className={`an-growth ${row.growth >= 0 ? 'is-up' : 'is-down'}`}>
                          +{row.growth}%
                        </span>
                      </td>
                      <td className="r num">
                        {row.impressions >= 1000000
                          ? `${(row.impressions / 1000000).toFixed(2)}M`
                          : `${(row.impressions / 1000).toFixed(1)}K`}
                      </td>
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

          <ol className="an-posts">
            {brandData.topPosts.map((p) => (
              <li key={p.id}>
                <button type="button" className="an-post">
                  <span className="an-post__img">
                    <img src={p.img} alt="" className="thumb" />
                    <span className="an-post__rank">{p.rank}</span>
                    <span className="net-stack">
                      {p.networks.map((n) => (
                        <span key={n} className={`net net--xs net--${n}`}>
                          <NetworkIcon network={n} className="ico" />
                        </span>
                      ))}
                    </span>
                  </span>

                  <span className="an-post__body">
                    <b className="an-post__val num tnum">{p.val}</b>
                    <small>{p.metric}</small>
                    <span className="an-post__meta">
                      <span className="bchip">
                        <span className={`bmark bmark--xs tone--${p.brandTone}`}>{p.brandCode}</span>
                        <span>{p.brandName}</span>
                      </span>
                      <span>{p.date}</span>
                    </span>
                    <span className="an-post__mini">
                      <span>
                        <Eye className="ico" />
                        {p.impressions}
                      </span>
                      <span>
                        <Heart className="ico" />
                        {p.likes}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
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
            {BRANDS_COMPARISON_DATA.map((b) => {
              const isHighlighted =
                (isHollowHome && b.code === 'HH') ||
                (isVantageGarage && b.code === 'VG') ||
                (activeBrand && b.name.toLowerCase().includes(activeBrand.name.toLowerCase()));
              return (
                <li
                  key={b.code}
                  className={`an-bar ${isHighlighted ? 'is-selected-brand' : ''}`}
                  style={isHighlighted ? { background: 'rgba(242, 183, 64, 0.12)', borderRadius: '12px', padding: '6px 10px' } : undefined}
                >
                  <span className={`bmark bmark--md tone--${b.tone}`}>{b.code}</span>
                  <span className="an-bar__name">
                    <b>
                      {b.name}
                      {isHighlighted && (
                        <span
                          className="badge badge--pine"
                          style={{ marginLeft: 6, fontSize: '10px', padding: '2px 6px' }}
                        >
                          Selected
                        </span>
                      )}
                    </b>
                    <small>
                      {b.accounts} accounts · {b.posts} posts
                    </small>
                  </span>
                  <span className="an-bar__track" aria-hidden="true">
                    <span
                      className="an-bar__fill"
                      style={{
                        transform: `scaleX(${b.fillRatio})`,
                        transformOrigin: '0 50%',
                      }}
                    />
                  </span>
                  <b className="num an-bar__v tnum">{b.val}</b>
                </li>
              );
            })}
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
                      { name: 'Camila Ortiz', email: 'camila@northlight.studio' },
                      { name: 'Malik Johnson', email: 'malik@northlight.studio' },
                      { name: 'Elise Marchand', email: 'elise@northlight.studio' },
                      { name: 'Haruto Sato', email: 'haruto@northlight.studio' },
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
