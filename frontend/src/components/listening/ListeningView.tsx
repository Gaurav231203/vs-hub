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

const DEFAULT_KEYWORDS: KeywordItem[] = [
  {
    id: 'k-sb-1',
    brandId: 'starlight',
    brandCode: 'SB',
    brandTone: 'coral',
    term: 'Starlight Bakery',
    kind: 'brand',
    weeklyCount: 14,
    sentiment: { pos: 0.85, neu: 0.12, neg: 0.03 },
    sparkPoints: [6, 7, 8, 9, 8, 10, 12, 11, 14, 13, 15, 14, 16, 14],
  },
  {
    id: 'k-sb-2',
    brandId: 'starlight',
    brandCode: 'SB',
    brandTone: 'coral',
    term: '#sourdough',
    kind: 'hashtag',
    weeklyCount: 9,
    sentiment: { pos: 0.8, neu: 0.15, neg: 0.05 },
    sparkPoints: [4, 5, 4, 6, 5, 7, 8, 7, 9, 8, 10, 9, 10, 9],
  },
  {
    id: 'k-sb-3',
    brandId: 'starlight',
    brandCode: 'SB',
    brandTone: 'coral',
    term: 'croissants',
    kind: 'topic',
    weeklyCount: 8,
    sentiment: { pos: 0.9, neu: 0.1, neg: 0.0 },
    sparkPoints: [5, 4, 6, 5, 7, 6, 8, 7, 8, 9, 8, 9, 8, 8],
  },
  {
    id: 'k1',
    brandId: 'ember',
    brandCode: 'EO',
    brandTone: 'coral',
    term: 'Ember & Oak',
    kind: 'brand',
    weeklyCount: 9,
    sentiment: { pos: 0.65, neu: 0.25, neg: 0.1 },
    sparkPoints: [3, 4, 3, 5, 4, 6, 8, 5, 7, 9, 6, 8, 9, 7],
  },
  {
    id: 'k2',
    brandId: 'ember',
    brandCode: 'EO',
    brandTone: 'coral',
    term: '#slowcoffee',
    kind: 'hashtag',
    weeklyCount: 5,
    sentiment: { pos: 0.7, neu: 0.2, neg: 0.1 },
    sparkPoints: [2, 2, 3, 2, 4, 3, 5, 2, 3, 5, 4, 3, 4, 5],
  },
  {
    id: 'k3',
    brandId: 'ember',
    brandCode: 'EO',
    brandTone: 'coral',
    term: 'pour over',
    kind: 'topic',
    weeklyCount: 5,
    sentiment: { pos: 0.8, neu: 0.2, neg: 0.0 },
    sparkPoints: [3, 2, 4, 3, 3, 5, 4, 3, 5, 4, 3, 4, 5, 4],
  },
  {
    id: 'k4',
    brandId: 'ember',
    brandCode: 'EO',
    brandTone: 'coral',
    term: 'Stumptown',
    kind: 'competitor',
    weeklyCount: 5,
    sentiment: { pos: 0.4, neu: 0.4, neg: 0.2 },
    sparkPoints: [4, 3, 5, 4, 3, 5, 4, 2, 4, 5, 3, 5, 4, 3],
  },
  {
    id: 'k5',
    brandId: 'hollow',
    brandCode: 'HH',
    brandTone: 'butter',
    term: 'Hollow Home',
    kind: 'brand',
    weeklyCount: 9,
    sentiment: { pos: 0.6, neu: 0.3, neg: 0.1 },
    sparkPoints: [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 9, 8, 9],
  },
  {
    id: 'k6',
    brandId: 'hollow',
    brandCode: 'HH',
    brandTone: 'butter',
    term: '#scandihome',
    kind: 'hashtag',
    weeklyCount: 5,
    sentiment: { pos: 0.75, neu: 0.2, neg: 0.05 },
    sparkPoints: [2, 3, 2, 4, 3, 4, 3, 5, 4, 5, 3, 4, 5, 4],
  },
  {
    id: 'k7',
    brandId: 'hollow',
    brandCode: 'HH',
    brandTone: 'butter',
    term: 'boucle chair',
    kind: 'topic',
    weeklyCount: 5,
    sentiment: { pos: 0.6, neu: 0.3, neg: 0.1 },
    sparkPoints: [3, 2, 4, 3, 2, 4, 3, 4, 5, 4, 3, 4, 5, 3],
  },
  {
    id: 'k8',
    brandId: 'north',
    brandCode: 'NS',
    brandTone: 'sea',
    term: 'Northlight Studio',
    kind: 'brand',
    weeklyCount: 9,
    sentiment: { pos: 0.7, neu: 0.2, neg: 0.1 },
    sparkPoints: [2, 3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 8, 9],
  },
  {
    id: 'k9',
    brandId: 'vantage',
    brandCode: 'VG',
    brandTone: 'ink',
    term: 'Vantage Garage',
    kind: 'brand',
    weeklyCount: 9,
    sentiment: { pos: 0.8, neu: 0.15, neg: 0.05 },
    sparkPoints: [3, 4, 3, 5, 6, 5, 7, 6, 8, 7, 9, 8, 9, 8],
  },
  {
    id: 'k10',
    brandId: 'vantage',
    brandCode: 'VG',
    brandTone: 'ink',
    term: '#ceramiccoating',
    kind: 'hashtag',
    weeklyCount: 5,
    sentiment: { pos: 0.7, neu: 0.2, neg: 0.1 },
    sparkPoints: [2, 3, 2, 4, 3, 5, 4, 3, 5, 4, 3, 4, 5, 4],
  },
  {
    id: 'k11',
    brandId: 'vantage',
    brandCode: 'VG',
    brandTone: 'ink',
    term: 'paint correction',
    kind: 'topic',
    weeklyCount: 5,
    sentiment: { pos: 0.75, neu: 0.2, neg: 0.05 },
    sparkPoints: [3, 2, 4, 3, 4, 5, 3, 4, 5, 4, 3, 5, 4, 3],
  },
  {
    id: 'k12',
    brandId: 'wild',
    brandCode: 'WB',
    brandTone: 'pine',
    term: 'Wildroot',
    kind: 'brand',
    weeklyCount: 9,
    sentiment: { pos: 0.85, neu: 0.1, neg: 0.05 },
    sparkPoints: [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 9, 8, 9],
  },
  {
    id: 'k13',
    brandId: 'wild',
    brandCode: 'WB',
    brandTone: 'pine',
    term: '#cleanbeauty',
    kind: 'hashtag',
    weeklyCount: 5,
    sentiment: { pos: 0.7, neu: 0.2, neg: 0.1 },
    sparkPoints: [3, 2, 4, 3, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4],
  },
  {
    id: 'k14',
    brandId: 'wild',
    brandCode: 'WB',
    brandTone: 'pine',
    term: 'facial oil',
    kind: 'topic',
    weeklyCount: 5,
    sentiment: { pos: 0.8, neu: 0.2, neg: 0.0 },
    sparkPoints: [2, 3, 2, 4, 3, 4, 5, 4, 3, 5, 4, 3, 4, 5],
  },
];

const DEFAULT_MENTIONS: MentionItem[] = [
  {
    id: 'mn-sb-1',
    author: 'Clara Dubois',
    handle: 'claradubois',
    initials: 'CD',
    net: 'instagram',
    time: '25 min ago',
    sentiment: 'pos',
    keywordTerm: 'Starlight Bakery',
    keywordKind: 'brand',
    text: 'Hands down the best sourdough in town. Their morning cardamom buns are heaven!',
    highlightTerm: 'Starlight Bakery',
    reach: '42.5K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn-sb-2',
    author: 'Liam Miller',
    handle: 'liam_eats',
    initials: 'LM',
    net: 'tiktok',
    time: '1 h ago',
    sentiment: 'pos',
    keywordTerm: 'croissants',
    keywordKind: 'topic',
    text: 'Listen to this crunch. Freshly baked laminated butter croissants from Starlight Bakery!',
    highlightTerm: 'croissants',
    reach: '89.2K',
    saved: true,
    hidden: false,
  },
  {
    id: 'mn1',
    author: 'Tess Albrecht',
    handle: 'tess_albrecht',
    initials: 'TA',
    net: 'x',
    time: '45 min ago',
    sentiment: 'pos',
    keywordTerm: 'pour over',
    keywordKind: 'topic',
    text: 'Their content is so good lately',
    highlightTerm: 'Pour over',
    reach: '21.1K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn2',
    author: 'Hiro Tanabe',
    handle: 'hiro_tanabe',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/hiro-tanabe.webp',
    initials: 'HT',
    net: 'instagram',
    time: '2 h ago',
    sentiment: 'neu',
    keywordTerm: '#cleanbeauty',
    keywordKind: 'hashtag',
    text: 'Their new launch is out apparently',
    highlightTerm: '#cleanbeauty',
    reach: '34.9K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn3',
    author: 'Ananya Rao',
    handle: 'ananya_rao',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/ananya-rao.webp',
    initials: 'AR',
    net: 'threads',
    time: '2 h ago',
    sentiment: 'neu',
    keywordTerm: 'Northlight Studio',
    keywordKind: 'brand',
    text: 'Is it worth the price vs the big brands?',
    highlightTerm: 'Northlight Studio',
    reach: '36.4K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn4',
    author: 'Zara Iqbal',
    handle: 'zara_iqbal',
    initials: 'ZI',
    net: 'tiktok',
    time: '2 h ago',
    sentiment: 'pos',
    keywordTerm: 'facial oil',
    keywordKind: 'topic',
    text: 'Their content is so good lately',
    highlightTerm: 'Facial oil',
    reach: '39K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn5',
    author: 'Elena Márquez',
    handle: 'elena_m_rquez',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/elena-marquez.webp',
    initials: 'EM',
    net: 'facebook',
    time: '3 h ago',
    sentiment: 'pos',
    keywordTerm: 'Ember & Oak',
    keywordKind: 'brand',
    text: 'Honestly the best thing I bought this year.',
    highlightTerm: 'Ember & Oak',
    reach: '20.1K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn6',
    author: 'Owen Fletcher',
    handle: 'owen_fletcher',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/owen-fletcher.webp',
    initials: 'OF',
    net: 'instagram',
    time: '3 h ago',
    sentiment: 'neg',
    keywordTerm: 'Hollow Home',
    keywordKind: 'brand',
    text: 'Bit overpriced for what it is',
    highlightTerm: 'Hollow Home',
    reach: '47.3K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn_hh1',
    author: 'Ananya Rao',
    handle: 'ananya_rao',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/ananya-rao.webp',
    initials: 'AR',
    net: 'threads',
    time: '53 min ago',
    sentiment: 'neg',
    keywordTerm: 'boucle chair',
    keywordKind: 'topic',
    text: 'Boucle chair — Not a fan of the new packaging',
    highlightTerm: 'Boucle chair',
    reach: '6.4K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn_hh2',
    author: 'Karin Holm',
    handle: 'karin_holm',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/karin-holm.webp',
    initials: 'KH',
    net: 'instagram',
    time: '53 min ago',
    sentiment: 'neu',
    keywordTerm: '#scandihome',
    keywordKind: 'hashtag',
    text: 'Saw their stand at the market today #scandihome',
    highlightTerm: '#scandihome',
    reach: '20.2K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn_hh3',
    author: 'Samir Khoury',
    handle: 'samir_khoury',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/samir-khoury.webp',
    initials: 'SK',
    net: 'x',
    time: '57 min ago',
    sentiment: 'pos',
    keywordTerm: 'Hollow Home',
    keywordKind: 'brand',
    text: 'Hollow Home — Honestly the best thing I bought this year',
    highlightTerm: 'Hollow Home',
    reach: '20.2K',
    saved: false,
    hidden: false,
  },
  {
    id: 'mn7',
    author: 'Rajiv Menon',
    handle: 'rajiv_menon',
    avatar: 'https://demo.codeandchill.store/murmura/photos/murmura/rajiv-menon.webp',
    initials: 'RM',
    net: 'x',
    time: '4 h ago',
    sentiment: 'neu',
    keywordTerm: 'Wildroot',
    keywordKind: 'brand',
    text: 'Saw their stand at the market today',
    highlightTerm: 'Wildroot',
    reach: '31.8K',
    saved: false,
    hidden: false,
  },
];

const TRENDING_TERMS = [
  { term: 'best', count: 13, size: 4 },
  { term: 'paint correction', count: 5, size: 2 },
  { term: 'good', count: 11, size: 3 },
  { term: 'boucle chair', count: 5, size: 2 },
  { term: 'Hollow Home', count: 10, size: 3 },
  { term: 'Stumptown', count: 5, size: 2 },
  { term: 'Vantage Garage', count: 9, size: 3 },
  { term: '#slowcoffee', count: 5, size: 2 },
  { term: 'Northlight Studio', count: 9, size: 3 },
  { term: 'recommend', count: 7, size: 2 },
  { term: 'customer', count: 8, size: 2 },
  { term: 'service', count: 8, size: 2 },
  { term: 'launch', count: 7, size: 2 },
  { term: 'comparing', count: 8, size: 2 },
  { term: 'shipping', count: 6, size: 2 },
  { term: 'Wildroot', count: 9, size: 3 },
  { term: 'pour over', count: 5, size: 2 },
  { term: 'Ember & Oak', count: 9, size: 3 },
  { term: '#scandihome', count: 5, size: 2 },
  { term: 'obsessed', count: 11, size: 3 },
  { term: '#ceramiccoating', count: 5, size: 2 },
  { term: 'content', count: 11, size: 3 },
];

const COMPETITORS_DATA = [
  {
    name: 'Ember & Oak',
    sub: 'You · last 30 days',
    code: 'EO',
    isUs: true,
    followers: '142.7K',
    growth: '+8.5%',
    engagement: '9.2%',
    postsWeek: '2.5',
  },
  {
    name: 'Stumptown',
    sub: '@stumptowncoffee',
    code: 'S',
    isUs: false,
    followers: '412K',
    growth: '+2.1%',
    engagement: '3.4%',
    postsWeek: '3',
  },
  {
    name: 'Coava',
    sub: '@coavacoffee',
    code: 'C',
    isUs: false,
    followers: '96K',
    growth: '+1.9%',
    engagement: '3.0%',
    postsWeek: '10',
  },
  {
    name: 'Heart Roasters',
    sub: '@heartroasters',
    code: 'H',
    isUs: false,
    followers: '71K',
    growth: '+3.6%',
    engagement: '2.3%',
    postsWeek: '6',
  },
];

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

  // Dynamic brand-specific dataset calculation
  const brandListeningData = useMemo(() => {
    if (isHollowHome) {
      return {
        mentionsCount: 22,
        sentiment: '23%',
        sentimentLabel: 'Net sentiment, positive − negative',
        reach: '546.4K',
        reachLabel: 'Potential reach this week',
        sovPct: '29%',
        sovBrandLabel: 'Share of voice, Hollow Home',
        sovBars: [
          { code: 'H', name: 'Hay', pct: '44%', ratio: 1.0, isUs: false, tone: 'default' },
          { code: 'HH', name: 'Hollow Home', sub: 'You', pct: '29%', ratio: 0.66, isUs: true, tone: 'butter' },
          { code: 'F', name: 'Ferm Living', pct: '27%', ratio: 0.61, isUs: false, tone: 'default' },
        ],
        competitors: [
          { name: 'Hollow Home', sub: 'You · last 30 days', code: 'HH', isUs: true, followers: '248.4K', growth: '+11.6%', engagement: '7.7%', postsWeek: '4' },
          { name: 'Hay', sub: '@haydesign', code: 'H', isUs: false, followers: '520K', growth: '+3.2%', engagement: '4.5%', postsWeek: '6' },
          { name: 'Ferm Living', sub: '@fermliving', code: 'F', isUs: false, followers: '380K', growth: '+2.8%', engagement: '3.9%', postsWeek: '5' },
          { name: 'Muuto', sub: '@muutodesign', code: 'M', isUs: false, followers: '290K', growth: '+1.9%', engagement: '3.1%', postsWeek: '4' },
        ],
        trendingTerms: [
          { term: 'boucle chair', count: 6, size: 4 },
          { term: '#scandihome', count: 6, size: 3 },
          { term: 'Hollow Home', count: 10, size: 4 },
          { term: 'autumn collection', count: 4, size: 2 },
          { term: 'oak table', count: 5, size: 3 },
          { term: 'nordic design', count: 7, size: 3 },
          { term: 'packaging', count: 3, size: 2 },
        ],
      };
    } else if (isVantageGarage) {
      return {
        mentionsCount: 31,
        sentiment: '45%',
        sentimentLabel: 'Net sentiment, positive − negative',
        reach: '812.5K',
        reachLabel: 'Potential reach this week',
        sovPct: '38%',
        sovBrandLabel: 'Share of voice, Vantage Garage',
        sovBars: [
          { code: 'VG', name: 'Vantage Garage', sub: 'You', pct: '38%', ratio: 1.0, isUs: true, tone: 'ink' },
          { code: 'P', name: 'Porsche Club', pct: '35%', ratio: 0.92, isUs: false, tone: 'default' },
          { code: 'D', name: 'Detailing World', pct: '27%', ratio: 0.71, isUs: false, tone: 'default' },
        ],
        competitors: [
          { name: 'Vantage Garage', sub: 'You · last 30 days', code: 'VG', isUs: true, followers: '442.9K', growth: '+9.4%', engagement: '8.4%', postsWeek: '5' },
          { name: 'Porsche Club', sub: '@porscheclub', code: 'P', isUs: false, followers: '680K', growth: '+2.4%', engagement: '5.1%', postsWeek: '7' },
          { name: 'Detailing World', sub: '@detailingworld', code: 'D', isUs: false, followers: '310K', growth: '+3.1%', engagement: '4.2%', postsWeek: '4' },
        ],
        trendingTerms: [
          { term: 'paint correction', count: 8, size: 4 },
          { term: '#ceramiccoating', count: 7, size: 3 },
          { term: 'Vantage Garage', count: 9, size: 4 },
          { term: 'motorsport', count: 5, size: 2 },
          { term: 'detailing', count: 6, size: 3 },
        ],
      };
    } else if (isStarlightBakery) {
      return {
        mentionsCount: 28,
        sentiment: '46%',
        sentimentLabel: 'Net sentiment, positive − negative',
        reach: '482.5K',
        reachLabel: 'Potential reach this week',
        sovPct: '34%',
        sovBrandLabel: 'Share of voice, Starlight Bakery',
        sovBars: [
          { code: 'SB', name: 'Starlight Bakery', sub: 'You', pct: '34%', ratio: 1.0, isUs: true, tone: 'coral' },
          { code: 'BP', name: 'Boulangerie Paul', pct: '36%', ratio: 1.05, isUs: false, tone: 'default' },
          { code: 'MM', name: 'Maison Kayser', pct: '30%', ratio: 0.88, isUs: false, tone: 'default' },
        ],
        competitors: [
          { name: 'Starlight Bakery', sub: 'You · last 30 days', code: 'SB', isUs: true, followers: '203.9K', growth: '+12.4%', engagement: '8.8%', postsWeek: '4' },
          { name: 'Boulangerie Paul', sub: '@paul_bakery', code: 'BP', isUs: false, followers: '340K', growth: '+2.8%', engagement: '4.1%', postsWeek: '5' },
        ],
        trendingTerms: [
          { term: 'sourdough', count: 18, size: 4 },
          { term: 'croissant', count: 14, size: 3 },
          { term: 'cardamom', count: 10, size: 2 },
          { term: 'flour', count: 7, size: 1 },
        ],
      };
    } else if (activeBrand) {
      const bName = activeBrand.name;
      return {
        mentionsCount: 20,
        sentiment: '32%',
        sentimentLabel: 'Net sentiment, positive − negative',
        reach: '410K',
        reachLabel: 'Potential reach this week',
        sovPct: '20%',
        sovBrandLabel: `Share of voice, ${bName}`,
        sovBars: [
          { code: 'S', name: 'Competitor A', pct: '40%', ratio: 1.0, isUs: false, tone: 'default' },
          { code: 'US', name: bName, sub: 'You', pct: '20%', ratio: 0.5, isUs: true, tone: 'coral' },
          { code: 'C', name: 'Competitor B', pct: '40%', ratio: 1.0, isUs: false, tone: 'default' },
        ],
        competitors: [
          { name: bName, sub: 'You · last 30 days', code: 'US', isUs: true, followers: '142.7K', growth: '+8.5%', engagement: '9.2%', postsWeek: '3' },
          { name: 'Competitor Market', sub: '@competitor', code: 'CM', isUs: false, followers: '412K', growth: '+2.1%', engagement: '3.4%', postsWeek: '4' },
        ],
        trendingTerms: [
          { term: bName, count: 8, size: 4 },
          { term: 'quality', count: 6, size: 3 },
          { term: 'service', count: 5, size: 2 },
        ],
      };
    } else {
      return {
        mentionsCount: 90,
        sentiment: '39%',
        sentimentLabel: 'Net sentiment, positive − negative',
        reach: '2.27M',
        reachLabel: 'Potential reach this week',
        sovPct: '100%',
        sovBrandLabel: 'Share of voice, All brands',
        sovBars: [
          { code: 'VG', name: 'Vantage Garage', sub: 'You', pct: '38%', ratio: 1.0, isUs: true, tone: 'ink' },
          { code: 'HH', name: 'Hollow Home', sub: 'You', pct: '29%', ratio: 0.76, isUs: true, tone: 'butter' },
          { code: 'EO', name: 'Ember & Oak', sub: 'You', pct: '20%', ratio: 0.52, isUs: true, tone: 'coral' },
          { code: 'WB', name: 'Wildroot', sub: 'You', pct: '13%', ratio: 0.34, isUs: true, tone: 'pine' },
        ],
        competitors: COMPETITORS_DATA,
        trendingTerms: TRENDING_TERMS,
      };
    }
  }, [isHollowHome, isVantageGarage, isStarlightBakery, activeBrand]);

  // Brand-filtered keywords
  const visibleKeywords = useMemo(() => {
    if (isHollowHome) {
      return keywords.filter(
        (k) => k.brandId === 'hollow' || k.term.toLowerCase().includes('hollow') || k.term.toLowerCase().includes('scandi') || k.term.toLowerCase().includes('boucle')
      );
    }
    if (isVantageGarage) {
      return keywords.filter(
        (k) => k.brandId === 'vantage' || k.term.toLowerCase().includes('vantage') || k.term.toLowerCase().includes('coating') || k.term.toLowerCase().includes('paint')
      );
    }
    if (isStarlightBakery) {
      return keywords.filter(
        (k) => k.brandId === 'starlight' || k.term.toLowerCase().includes('starlight') || k.term.toLowerCase().includes('sourdough') || k.term.toLowerCase().includes('croissant')
      );
    }
    if (activeBrand) {
      const bLower = activeBrand.name.toLowerCase();
      const matched = keywords.filter((k) => k.brandId === activeBrand.id || k.term.toLowerCase().includes(bLower));
      return matched.length > 0 ? matched : keywords.slice(0, 3);
    }
    return keywords;
  }, [keywords, isHollowHome, isVantageGarage, isStarlightBakery, activeBrand]);

  // Filtered mentions
  const visibleMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (m.hidden) return false;
      if (savedFilter && !m.saved) return false;
      if (sentimentTab !== 'all' && m.sentiment !== sentimentTab) return false;
      if (filterNet !== 'all' && m.net !== filterNet) return false;

      // Filter by active brand if specified
      if (isHollowHome) {
        const isHHMention =
          m.id.startsWith('mn_hh') ||
          m.keywordTerm.toLowerCase().includes('hollow') ||
          m.keywordTerm.toLowerCase().includes('scandi') ||
          m.keywordTerm.toLowerCase().includes('boucle') ||
          m.text.toLowerCase().includes('hollow') ||
          m.text.toLowerCase().includes('boucle');
        if (!isHHMention) return false;
      } else if (isVantageGarage) {
        const isVGMention =
          m.keywordTerm.toLowerCase().includes('vantage') ||
          m.keywordTerm.toLowerCase().includes('coating') ||
          m.keywordTerm.toLowerCase().includes('paint') ||
          m.text.toLowerCase().includes('vantage');
        if (!isVGMention) return false;
      } else if (isStarlightBakery) {
        const isSBMention =
          m.id.startsWith('mn-sb') ||
          m.keywordTerm.toLowerCase().includes('starlight') ||
          m.keywordTerm.toLowerCase().includes('croissant') ||
          m.keywordTerm.toLowerCase().includes('sourdough') ||
          m.text.toLowerCase().includes('starlight') ||
          m.text.toLowerCase().includes('sourdough') ||
          m.text.toLowerCase().includes('croissant');
        if (!isSBMention) return false;
      } else if (activeBrand) {
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
