import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { SocialOAuthModal, OAuthNetwork } from './SocialOAuthModal.js';

import { matchesBrand, getBrandCanonicalSlug } from '../../lib/brandHelper.js';

interface BrandMeta {
  id: string;
  name: string;
  short: string;
  industry: string;
  tone: 'coral' | 'butter' | 'ink' | 'pine' | 'sea';
  monogram: string;
  cover: string;
}

const BRANDS_DATA: Record<string, BrandMeta> = {
  starlight: {
    id: 'starlight',
    name: 'Starlight Bakery',
    short: 'Starlight',
    industry: 'Artisanal organic bakery & pastries · Paris',
    tone: 'coral',
    monogram: 'SB',
    cover: '/murmura/photos/murmura/posts/ember-roastery.jpg',
  },
  hollow: {
    id: 'hollow',
    name: 'Hollow Home',
    short: 'Hollow',
    industry: 'Furniture & interiors · Copenhagen',
    tone: 'butter',
    monogram: 'HH',
    cover: '/murmura/photos/murmura/posts/hollow-living.jpg',
  },
  vantage: {
    id: 'vantage',
    name: 'Vantage Garage',
    short: 'Vantage',
    industry: 'Performance detailing · Austin',
    tone: 'ink',
    monogram: 'VG',
    cover: '/murmura/photos/murmura/posts/vantage-night.jpg',
  },
  acme: {
    id: 'acme',
    name: 'Acme Corp',
    short: 'Acme',
    industry: 'Enterprise B2B Cloud Solutions · San Francisco',
    tone: 'sea',
    monogram: 'AC',
    cover: '/murmura/photos/murmura/posts/hollow-sofa.jpg',
  },
  nexus: {
    id: 'nexus',
    name: 'Nexus Tech',
    short: 'Nexus',
    industry: 'Next-gen consumer AI electronics · Tokyo',
    tone: 'sea',
    monogram: 'NT',
    cover: '/murmura/photos/murmura/posts/vantage-gauge.jpg',
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith Fitness',
    short: 'Zenith',
    industry: 'Holistic wellness & boutique athletic gym · London',
    tone: 'pine',
    monogram: 'ZF',
    cover: '/murmura/photos/murmura/posts/wild-golden.jpg',
  },
  ember: {
    id: 'ember',
    name: 'Ember & Oak',
    short: 'Ember',
    industry: 'Coffee roasters · Portland',
    tone: 'coral',
    monogram: 'EO',
    cover: '/murmura/photos/murmura/posts/ember-roastery.jpg',
  },
  wild: {
    id: 'wild',
    name: 'Wildroot Botanics',
    short: 'Wildroot',
    industry: 'Botanical skincare · Lisbon',
    tone: 'pine',
    monogram: 'WB',
    cover: '/murmura/photos/murmura/posts/wild-daisy.jpg',
  },
  north: {
    id: 'north',
    name: 'Northlight Studio',
    short: 'Northlight',
    industry: 'Our agency',
    tone: 'sea',
    monogram: 'NS',
    cover: '/murmura/photos/murmura/posts/hollow-sofa.jpg',
  },
};

interface ChannelItem {
  id: string;
  brandId: string;
  net: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'pinterest' | 'threads' | 'x' | 'linkedin';
  handle: string;
  followers: number;
  growthPct: number;
  daysLeft: number;
  totalDays: number;
  lastSync: string;
  connectedBy: string;
  connectedByPhoto?: string;
  status: 'connected' | 'expiring' | 'disconnected';
  postingEnabled: boolean;
}

const INITIAL_CHANNELS: ChannelItem[] = [
  // Ember & Oak (4)
  {
    id: 'ch-ember-ig',
    brandId: 'ember',
    net: 'instagram',
    handle: '@emberandoak',
    followers: 48210,
    growthPct: 8.2,
    daysLeft: 33,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-ember-fb',
    brandId: 'ember',
    net: 'facebook',
    handle: 'Ember & Oak',
    followers: 21480,
    growthPct: 5.0,
    daysLeft: 31,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-ember-tt',
    brandId: 'ember',
    net: 'tiktok',
    handle: '@emberandoak',
    followers: 63900,
    growthPct: 9.3,
    daysLeft: 27,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-ember-th',
    brandId: 'ember',
    net: 'threads',
    handle: '@emberandoak',
    followers: 9120,
    growthPct: 7.3,
    daysLeft: 30,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },

  // Hollow Home (4)
  {
    id: 'ch-hollow-ig',
    brandId: 'hollow',
    net: 'instagram',
    handle: '@hollowhome',
    followers: 112400,
    growthPct: 12.4,
    daysLeft: 54,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-hollow-pin',
    brandId: 'hollow',
    net: 'pinterest',
    handle: '@hollowhome',
    followers: 86300,
    growthPct: 10.3,
    daysLeft: 26,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-hollow-fb',
    brandId: 'hollow',
    net: 'facebook',
    handle: 'Hollow Home',
    followers: 30950,
    growthPct: 7.7,
    daysLeft: 34,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-hollow-yt',
    brandId: 'hollow',
    net: 'youtube',
    handle: 'Hollow Home',
    followers: 18700,
    growthPct: 16.2,
    daysLeft: 2,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'expiring',
    postingEnabled: true,
  },

  // Vantage Garage (5)
  {
    id: 'ch-vantage-ig',
    brandId: 'vantage',
    net: 'instagram',
    handle: '@vantagegarage',
    followers: 74300,
    growthPct: 4.0,
    daysLeft: 28,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-vantage-yt',
    brandId: 'vantage',
    net: 'youtube',
    handle: 'Vantage Garage',
    followers: 129800,
    growthPct: 18.9,
    daysLeft: 34,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-vantage-tt',
    brandId: 'vantage',
    net: 'tiktok',
    handle: '@vantagegarage',
    followers: 201500,
    growthPct: 4.5,
    daysLeft: 43,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-vantage-x',
    brandId: 'vantage',
    net: 'x',
    handle: '@vantagegarage',
    followers: 15240,
    growthPct: 10.5,
    daysLeft: 38,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-vantage-fb',
    brandId: 'vantage',
    net: 'facebook',
    handle: 'Vantage Garage',
    followers: 22100,
    growthPct: 13.5,
    daysLeft: 0,
    totalDays: 60,
    lastSync: 'Stopped 3 d ago',
    connectedBy: 'Malik',
    status: 'disconnected',
    postingEnabled: false,
  },

  // Wildroot Botanics (4)
  {
    id: 'ch-wild-ig',
    brandId: 'wild',
    net: 'instagram',
    handle: '@wildroot',
    followers: 56800,
    growthPct: 7.9,
    daysLeft: 28,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-wild-tt',
    brandId: 'wild',
    net: 'tiktok',
    handle: '@wildroot',
    followers: 41200,
    growthPct: 15.0,
    daysLeft: 22,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-wild-pin',
    brandId: 'wild',
    net: 'pinterest',
    handle: '@wildroot',
    followers: 23900,
    growthPct: 16.2,
    daysLeft: 58,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-wild-th',
    brandId: 'wild',
    net: 'threads',
    handle: '@wildroot',
    followers: 7400,
    growthPct: 8.2,
    daysLeft: 36,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },

  // Northlight Studio (2)
  {
    id: 'ch-north-li',
    brandId: 'north',
    net: 'linkedin',
    handle: 'Northlight Studio',
    followers: 8650,
    growthPct: 5.2,
    daysLeft: 45,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Camila',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-north-x',
    brandId: 'north',
    net: 'x',
    handle: '@northlightstudio',
    followers: 4310,
    growthPct: 3.1,
    daysLeft: 40,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Malik',
    status: 'connected',
    postingEnabled: true,
  },

  // Starlight Bakery (4)
  {
    id: 'ch-sb-tt',
    brandId: 'starlight',
    net: 'tiktok',
    handle: '@starlightbakery',
    followers: 98400,
    growthPct: 12.4,
    daysLeft: 42,
    totalDays: 60,
    lastSync: '2 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-sb-ig',
    brandId: 'starlight',
    net: 'instagram',
    handle: '@starlight_bakes',
    followers: 64200,
    growthPct: 8.8,
    daysLeft: 35,
    totalDays: 60,
    lastSync: '1 h ago',
    connectedBy: 'Sophia',
    connectedByPhoto: '/images/camila.jpg',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-sb-fb',
    brandId: 'starlight',
    net: 'facebook',
    handle: 'Starlight Bakery',
    followers: 23100,
    growthPct: 4.1,
    daysLeft: 51,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-sb-pin',
    brandId: 'starlight',
    net: 'pinterest',
    handle: '@starlightbakery',
    followers: 18200,
    growthPct: 14.6,
    daysLeft: 58,
    totalDays: 60,
    lastSync: '4 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },

  // Acme Corp (3)
  {
    id: 'ch-acme-li',
    brandId: 'acme',
    net: 'linkedin',
    handle: 'Acme Corp Global',
    followers: 42800,
    growthPct: 7.2,
    daysLeft: 45,
    totalDays: 60,
    lastSync: '5 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-acme-x',
    brandId: 'acme',
    net: 'x',
    handle: '@AcmeHQ',
    followers: 28400,
    growthPct: 4.8,
    daysLeft: 52,
    totalDays: 60,
    lastSync: '2 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-acme-ig',
    brandId: 'acme',
    net: 'instagram',
    handle: '@acmecorp_official',
    followers: 18500,
    growthPct: 5.5,
    daysLeft: 38,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },

  // Nexus Tech (3)
  {
    id: 'ch-nexus-yt',
    brandId: 'nexus',
    net: 'youtube',
    handle: 'Nexus Tech Official',
    followers: 210000,
    growthPct: 14.2,
    daysLeft: 40,
    totalDays: 60,
    lastSync: '1 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-nexus-x',
    brandId: 'nexus',
    net: 'x',
    handle: '@NexusTechAI',
    followers: 154000,
    growthPct: 19.5,
    daysLeft: 34,
    totalDays: 60,
    lastSync: '2 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-nexus-li',
    brandId: 'nexus',
    net: 'linkedin',
    handle: 'Nexus Technologies',
    followers: 89000,
    growthPct: 9.1,
    daysLeft: 46,
    totalDays: 60,
    lastSync: '4 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },

  // Zenith Fitness (3)
  {
    id: 'ch-zenith-tt',
    brandId: 'zenith',
    net: 'tiktok',
    handle: '@zenith_workouts',
    followers: 77900,
    growthPct: 16.8,
    daysLeft: 29,
    totalDays: 60,
    lastSync: '3 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-zenith-ig',
    brandId: 'zenith',
    net: 'instagram',
    handle: '@zenith_fitclub',
    followers: 51200,
    growthPct: 11.3,
    daysLeft: 37,
    totalDays: 60,
    lastSync: '2 h ago',
    connectedBy: 'Devon',
    status: 'connected',
    postingEnabled: true,
  },
  {
    id: 'ch-zenith-th',
    brandId: 'zenith',
    net: 'threads',
    handle: '@zenithfit',
    followers: 12400,
    growthPct: 8.0,
    daysLeft: 42,
    totalDays: 60,
    lastSync: '5 h ago',
    connectedBy: 'Sophia',
    status: 'connected',
    postingEnabled: true,
  },
];

const NETWORK_METAS: Record<string, { name: string; what: string; publish: boolean; inbox: boolean; analytics: boolean }> = {
  instagram: {
    name: 'Instagram',
    what: 'Posts, Reels and Stories · first comment',
    publish: true,
    inbox: true,
    analytics: true,
  },
  facebook: {
    name: 'Facebook',
    what: 'Page posts, comments, messages and reviews',
    publish: true,
    inbox: true,
    analytics: true,
  },
  x: {
    name: 'X',
    what: 'Posts and threads · mentions and DMs',
    publish: true,
    inbox: true,
    analytics: true,
  },
  linkedin: {
    name: 'LinkedIn',
    what: 'Company page posts and comments',
    publish: true,
    inbox: false,
    analytics: true,
  },
  tiktok: {
    name: 'TikTok',
    what: 'Videos · comments',
    publish: true,
    inbox: true,
    analytics: true,
  },
  youtube: {
    name: 'YouTube',
    what: 'Videos and Shorts · comments',
    publish: true,
    inbox: false,
    analytics: true,
  },
  pinterest: {
    name: 'Pinterest',
    what: 'Pins and boards',
    publish: true,
    inbox: false,
    analytics: true,
  },
  threads: {
    name: 'Threads',
    what: 'Posts and replies',
    publish: true,
    inbox: true,
    analytics: true,
  },
};

function formatCompactNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function ChannelsView() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const outletCtx = useOutletContext<{ selectedBrandId?: string; setSelectedBrandId?: (id: string) => void }>() || {};

  const [channels, setChannels] = useState<ChannelItem[]>(INITIAL_CHANNELS);
  const [filter, setFilter] = useState<'all' | 'attention' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetBrandForConnect, setTargetBrandForConnect] = useState<string>('ember');
  const [menuOpenForChannel, setMenuOpenForChannel] = useState<string | null>(null);

  // Connect wizard state
  const [wizardBrand, setWizardBrand] = useState<string>('ember');
  const [wizardNet, setWizardNet] = useState<string>('instagram');
  const [wizardHandle, setWizardHandle] = useState<string>('');
  const [activeOAuthNet, setActiveOAuthNet] = useState<OAuthNetwork | null>(null);

  // Handle reconnect
  const handleReconnect = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          return {
            ...c,
            status: 'connected',
            daysLeft: 60,
            lastSync: 'Just now',
          };
        }
        return c;
      })
    );
    const target = channels.find((c) => c.id === channelId);
    const brandName = target ? BRANDS_DATA[target.brandId]?.name : 'Brand';
    addToast({
      type: 'success',
      message: `${brandName} ${target ? NETWORK_METAS[target.net]?.name : ''} reconnected · access token renewed.`,
    });
  };

  // Toggle posting switch
  const handleTogglePosting = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          const next = !c.postingEnabled;
          addToast({
            type: 'info',
            message: next ? `Posting resumed for ${c.handle}` : `Posting paused for ${c.handle}`,
          });
          return { ...c, postingEnabled: next };
        }
        return c;
      })
    );
  };

  // Disconnect channel
  const handleDisconnect = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          return {
            ...c,
            status: 'disconnected',
            daysLeft: 0,
            lastSync: 'Stopped just now',
            postingEnabled: false,
          };
        }
        return c;
      })
    );
    setMenuOpenForChannel(null);
    addToast({ type: 'info', message: 'Channel disconnected from workspace.' });
  };

  const { brands, selectedBrandId: authBrandId } = useAuthStore();
  const activeBrandId = outletCtx.selectedBrandId || authBrandId || 'all';

  // Scoped channels based on active brand selection
  const scopedChannels = useMemo(() => {
    if (!activeBrandId || activeBrandId === 'all') return channels;
    return channels.filter((c) => matchesBrand(c.brandId, activeBrandId, brands));
  }, [channels, activeBrandId, brands]);

  // Filter channels with secondary tab and search query
  const filteredChannels = useMemo(() => {
    return scopedChannels.filter((c) => {
      if (filter === 'attention' && c.status === 'connected') return false;
      if (filter === 'paused' && c.postingEnabled) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const brand = BRANDS_DATA[c.brandId]?.name?.toLowerCase() || '';
        const netName = NETWORK_METAS[c.net]?.name?.toLowerCase() || '';
        return c.handle.toLowerCase().includes(q) || brand.includes(q) || netName.includes(q);
      }
      return true;
    });
  }, [scopedChannels, filter, searchQuery]);

  // Broken channels for attention banner (only within active scope)
  const brokenChannels = useMemo(() => {
    return scopedChannels.filter((c) => c.status !== 'connected');
  }, [scopedChannels]);

  // Stats calculation dynamically scoped to selected brand
  const totalConnected = useMemo(() => {
    return scopedChannels.filter((c) => c.status === 'connected').length;
  }, [scopedChannels]);

  const totalAudience = useMemo(() => {
    return scopedChannels.reduce((sum, c) => sum + c.followers, 0);
  }, [scopedChannels]);

  const networksInUseCount = useMemo(() => {
    return new Set(scopedChannels.map((c) => c.net)).size;
  }, [scopedChannels]);

  // Audience by network breakdown
  const audienceByNetwork = useMemo(() => {
    const map = new Map<string, number>();
    scopedChannels.forEach((c) => {
      map.set(c.net, (map.get(c.net) || 0) + c.followers);
    });
    const list = Array.from(map.entries())
      .map(([net, total]) => ({ net, total }))
      .sort((a, b) => b.total - a.total);
    return list;
  }, [scopedChannels]);

  // Network connection counts
  const networkConnectedCounts = useMemo(() => {
    const map = new Map<string, number>();
    scopedChannels.forEach((c) => {
      if (c.status === 'connected') {
        map.set(c.net, (map.get(c.net) || 0) + 1);
      }
    });
    return map;
  }, [scopedChannels]);

  // Merge static demo brands + any custom brands created by user in authStore
  const allKnownBrands = useMemo(() => {
    const staticList = Object.values(BRANDS_DATA);
    const customList: BrandMeta[] = (brands || [])
      .filter((b) => !staticList.some((sb) => matchesBrand(sb.id, b.id, brands)))
      .map((b) => ({
        id: b.id,
        name: b.name,
        short: b.name.split(' ')[0] || b.name,
        industry: b.description || 'Client brand',
        tone: 'pine' as const,
        monogram: (b.name.slice(0, 2) || 'BR').toUpperCase(),
        cover: b.logoUrl || '/murmura/photos/murmura/posts/ember-roastery.jpg',
      }));
    return [...staticList, ...customList];
  }, [brands]);

  // Group by brand
  const brandList = useMemo(() => {
    if (!activeBrandId || activeBrandId === 'all') return allKnownBrands;
    const matched = allKnownBrands.filter((b) => matchesBrand(b.id, activeBrandId, brands));
    if (matched.length > 0) return matched;
    const authBrand = brands.find((b) => b.id === activeBrandId || b.name.toLowerCase() === activeBrandId.toLowerCase());
    if (authBrand) {
      return [{
        id: authBrand.id,
        name: authBrand.name,
        short: authBrand.name.split(' ')[0] || authBrand.name,
        industry: authBrand.description || 'Client brand',
        tone: 'pine' as const,
        monogram: (authBrand.name.slice(0, 2) || 'BR').toUpperCase(),
        cover: authBrand.logoUrl || '/murmura/photos/murmura/posts/ember-roastery.jpg',
      }];
    }
    return allKnownBrands;
  }, [allKnownBrands, activeBrandId, brands]);

  return (
    <div data-view="channels" className="view" style={{ minWidth: 0 }}>
      {/* 1. Header with Stats Strip & Actions */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Channels</h1>
        </div>

        <div className="head__stats">
          {/* Stat 1: Connected accounts */}
          <div className="stat" data-stat="connected">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{totalConnected}</b>
              </span>
              <span className="stat__label">Connected accounts</span>
            </div>
          </div>

          {/* Stat 2: Need attention */}
          <div className="stat" data-stat="attention">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brokenChannels.length}</b>
                {brokenChannels.length > 0 ? (
                  <span className="badge badge--coral">Fix now</span>
                ) : (
                  <span className="badge badge--pine">All good</span>
                )}
              </span>
              <span className="stat__label">Need attention</span>
            </div>
          </div>

          {/* Stat 3: Total audience */}
          <div className="stat" data-stat="audience">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{formatCompactNumber(totalAudience)}</b>
              </span>
              <span className="stat__label">Total audience</span>
            </div>
          </div>

          {/* Stat 4: Networks in use */}
          <div className="stat" data-stat="nets">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{networksInUseCount}</b>
              </span>
              <span className="stat__label">of 8 networks in use</span>
            </div>
          </div>
        </div>

        <div className="head__actions">
          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => {
              setWizardBrand(activeBrandId !== 'all' ? activeBrandId : (allKnownBrands[0]?.id || 'ember'));
              setShowConnectModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Connect a channel
          </button>
        </div>
      </header>

      {/* 2. Main Layout (Channels Grid + Right Sidebar) */}
      <div className="ch-layout">
        <div className="ch-main">
          {/* Red/Coral Attention Banner if any broken channels */}
          {brokenChannels.length > 0 && (
            <div data-banner-slot>
              <section className="tile tone--coral ch-alert" aria-labelledby="ch-alert-t">
                <div className="ch-alert__lead">
                  <span className="ch-alert__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <div>
                    <h2 id="ch-alert-t">
                      {brokenChannels.length} channel{brokenChannels.length === 1 ? '' : 's'} need attention
                    </h2>
                    <p>
                      1 post failed to publish. Reconnect so nothing else misses its slot.
                    </p>
                    <button
                      type="button"
                      className="ch-alert__link"
                      onClick={() => navigate('/approvals')}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                      Open the failed post
                    </button>
                  </div>
                </div>

                <ul className="ch-alert__list">
                  {brokenChannels.map((c) => {
                    const bm = BRANDS_DATA[c.brandId] || BRANDS_DATA.ember;
                    const isDis = c.status === 'disconnected';
                    return (
                      <li key={`a-${c.id}`}>
                        <span className={`net net--sm net--${c.net}`}>
                          <NetworkIcon network={c.net} className="w-3.5 h-3.5" />
                        </span>
                        <span>
                          <b>
                            {bm.name} · {NETWORK_METAS[c.net]?.name}
                          </b>
                          <small>
                            {isDis ? 'Disconnected 3 d ago' : `Access expires in ${c.daysLeft} d`}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="btn btn--sm ch-alert__btn"
                          onClick={() => handleReconnect(c.id)}
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                          </svg>
                          Reconnect
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {/* Active Brand Scope Notification */}
          {activeBrandId !== 'all' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                marginBottom: '16px',
                background: 'var(--well)',
                borderRadius: '16px',
                border: '1px solid var(--line-2)',
                fontSize: '13px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="dot-badge" style={{ position: 'static', background: 'var(--butter)' }} />
                <span>
                  Showing channels for <strong style={{ color: 'var(--text)' }}>{brandList[0]?.name || activeBrandId}</strong> ({scopedChannels.length} accounts connected)
                </span>
              </div>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  if (outletCtx.setSelectedBrandId) {
                    outletCtx.setSelectedBrandId('all');
                  }
                  useAuthStore.getState().setSelectedBrandId('all');
                  addToast({ type: 'info', message: 'Showing all brands' });
                }}
              >
                Show all brands ({channels.length} accounts)
              </button>
            </div>
          )}

          {/* Tools Bar (Segmented Filters + Search Input) */}
          <div className="ch-tools">
            <div className="seg">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All channels
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'attention'}
                onClick={() => setFilter('attention')}
              >
                Needs attention
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'paused'}
                onClick={() => setFilter('paused')}
              >
                Paused
              </button>
            </div>

            <label className="search ch-search">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search handles and networks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          {/* Brand Sections */}
          <div className="ch-groups" data-groups>
            {brandList.map((brand) => {
              const brandChannels = filteredChannels.filter((c) => matchesBrand(c.brandId, brand.id, brands));
              const brandTotalAudience = brandChannels.reduce((sum, c) => sum + c.followers, 0);

              if (brandChannels.length === 0 && searchQuery.trim()) {
                return null;
              }

              return (
                <section
                  key={`b-${brand.id}`}
                  className="card ch-brand"
                  data-brand={brand.id}
                  aria-labelledby={`ch-b-${brand.id}`}
                >
                  {/* Hero Photographic Banner */}
                  <div className="ch-cover">
                    <img
                      src={brand.cover}
                      width={900}
                      height={600}
                      alt={brand.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/bakery.jpg';
                      }}
                    />
                  </div>

                  {/* Brand Header */}
                  <header className="ch-brand__head">
                    <span className={`bmark bmark--lg tone--${brand.tone}`}>
                      {brand.monogram}
                    </span>
                    <div className="ch-brand__t">
                      <h2 id={`ch-b-${brand.id}`}>{brand.name}</h2>
                      <p>{brand.industry}</p>
                    </div>
                    <p className="ch-brand__sum">
                      <b>{brandChannels.length}</b> channels
                      <span>·</span>
                      <b>{formatCompactNumber(brandTotalAudience)}</b> audience
                    </p>
                  </header>

                  {/* Team Access Row */}
                  <p className="ch-who">
                    <span className="av-stack">
                      <img src="/images/camila.jpg" className="av av--sm" alt="Camila" />
                      <span className="av av--sm av--t0">M</span>
                      <span className="av av--sm av--t1">E</span>
                      <span className="av av--sm av--t2">N</span>
                      <span className="av av--sm av--t3">F</span>
                    </span>
                    <span>
                      <b>5 people can post here</b> · Owner, Admin, Manager publish directly · Editor needs approval
                    </span>
                    <button
                      type="button"
                      className="ch-who__link"
                      onClick={() => navigate('/team')}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Manage access
                    </button>
                  </p>

                  {/* Channels Grid (3 Columns) */}
                  <div className="ch-grid" data-grid>
                    {brandChannels.map((c) => {
                      const isDown = c.status === 'disconnected';
                      const isExpiring = c.status === 'expiring';
                      const isPaused = !c.postingEnabled;

                      return (
                        <article
                          key={c.id}
                          className={`ch-card ${isDown ? 'is-down' : ''} ${isPaused ? 'is-paused' : ''}`}
                          data-lift
                        >
                          {/* Card Header: Network Icon + Handle + Status Badge */}
                          <header className="ch-card__head">
                            <span className={`net net--lg net--${c.net}`}>
                              <NetworkIcon network={c.net} className="w-5 h-5" />
                            </span>
                            <div className="ch-card__id">
                              <b>{c.handle}</b>
                              <small>{NETWORK_METAS[c.net]?.name}</small>
                            </div>
                            <span className="ch-status">
                              {isDown ? (
                                <span className="badge badge--coral">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Disconnected
                                </span>
                              ) : isExpiring ? (
                                <span className="badge badge--coral">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Expires in {c.daysLeft} d
                                </span>
                              ) : isPaused ? (
                                <span className="badge badge--plain">Paused</span>
                              ) : (
                                <span className="badge badge--pine">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Connected
                                </span>
                              )}
                            </span>
                          </header>

                          {/* Audience & Sparkline Trajectory */}
                          <div className="ch-card__aud">
                            <div>
                              <b className="ch-card__num">{formatCompactNumber(c.followers)}</b>
                              <small>
                                followers · <span className="ch-up">+{c.growthPct}%</span> in 30 d
                              </small>
                            </div>
                            <span className="ch-spark">
                              <svg viewBox="0 0 150 40" preserveAspectRatio="none">
                                <path
                                  d="M0,32 C45,30 90,22 150,8"
                                  fill="none"
                                  stroke={isDown ? 'var(--faint)' : 'var(--pine)'}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                          </div>

                          {/* Access Token Meter */}
                          <div className="ch-token">
                            <div className="ch-token__row">
                              <span>
                                <svg className="ico" viewBox="0 0 24 24">
                                  <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9l-1.5-1.5L5 9" />
                                  <circle cx="7.5" cy="15.5" r="5.5" />
                                </svg>
                                Access token
                              </span>
                              <b>
                                {isDown
                                  ? 'Access revoked'
                                  : isExpiring
                                  ? `Expires in ${c.daysLeft} d`
                                  : `${c.daysLeft} of ${c.totalDays} days left`}
                              </b>
                            </div>
                            <span className="meter">
                              <span
                                className={`meter__fill meter__fill--${isDown ? 'coral' : isExpiring ? 'butter' : 'pine'}`}
                                style={{
                                  transform: `scaleX(${isDown ? 0 : c.daysLeft / c.totalDays})`,
                                  transformOrigin: '0 50%',
                                }}
                              />
                            </span>
                          </div>

                          {/* Meta: Last sync & Connected by */}
                          <dl className="ch-meta">
                            <div>
                              <dt>Last sync</dt>
                              <dd>{c.lastSync}</dd>
                            </div>
                            <div>
                              <dt>Connected by</dt>
                              <dd>
                                {c.connectedByPhoto ? (
                                  <img
                                    src={c.connectedByPhoto}
                                    className="av av--xs"
                                    alt={c.connectedBy}
                                    style={{ width: 18, height: 18, borderRadius: '50%' }}
                                  />
                                ) : (
                                  <span className="av av--xs av--t0" style={{ width: 18, height: 18, fontSize: '9px' }}>
                                    {c.connectedBy[0]}
                                  </span>
                                )}
                                <span>{c.connectedBy}</span>
                              </dd>
                            </div>
                          </dl>

                          {/* Actions: Analytics, Posting switch, More */}
                          <footer className="ch-acts">
                            {isDown ? (
                              <button
                                type="button"
                                className="btn btn--ink btn--sm"
                                onClick={() => handleReconnect(c.id)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                </svg>
                                Reconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => navigate(`/analytics?brand=${c.brandId}`)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <line x1="18" y1="20" x2="18" y2="10" />
                                  <line x1="12" y1="20" x2="12" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                                Analytics
                              </button>
                            )}

                            <label className="ch-post" title={isDown ? 'Reconnect first' : undefined}>
                              <span>Posting</span>
                              <button
                                type="button"
                                className="switch"
                                role="switch"
                                aria-checked={c.postingEnabled && !isDown}
                                disabled={isDown}
                                onClick={() => handleTogglePosting(c.id)}
                              />
                            </label>

                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                className="ibtn ibtn--sm ch-more"
                                onClick={() =>
                                  setMenuOpenForChannel((cur) => (cur === c.id ? null : c.id))
                                }
                                aria-label="More options"
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="19" cy="12" r="1.5" />
                                  <circle cx="5" cy="12" r="1.5" />
                                </svg>
                              </button>

                              {menuOpenForChannel === c.id && (
                                <div
                                  className="pop"
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    bottom: '100%',
                                    marginBottom: 8,
                                    zIndex: 50,
                                    minWidth: 180,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="menu__item"
                                    onClick={() => {
                                      handleReconnect(c.id);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                    </svg>
                                    {isDown ? 'Reconnect' : 'Refresh access'}
                                  </button>
                                  <button
                                    type="button"
                                    className="menu__item"
                                    disabled={isDown}
                                    onClick={() => {
                                      handleTogglePosting(c.id);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      {c.postingEnabled ? (
                                        <rect x="6" y="4" width="4" height="16" />
                                      ) : (
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      )}
                                    </svg>
                                    {c.postingEnabled ? 'Pause posting' : 'Resume posting'}
                                  </button>
                                  <button
                                    type="button"
                                    className="menu__item"
                                    onClick={() => {
                                      navigate(`/analytics?brand=${c.brandId}`);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <line x1="18" y1="20" x2="18" y2="10" />
                                      <line x1="12" y1="20" x2="12" y2="4" />
                                      <line x1="6" y1="20" x2="6" y2="14" />
                                    </svg>
                                    View analytics
                                  </button>
                                  <hr />
                                  <button
                                    type="button"
                                    className="menu__item is-danger"
                                    disabled={isDown}
                                    onClick={() => handleDisconnect(c.id)}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                      <line x1="2" y1="2" x2="22" y2="22" />
                                    </svg>
                                    Disconnect
                                  </button>
                                </div>
                              )}
                            </div>
                          </footer>
                        </article>
                      );
                    })}

                    {brandChannels.length === 0 && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          padding: '24px 20px',
                          textAlign: 'center',
                          background: 'var(--glass-2)',
                          borderRadius: 'var(--r-tile)',
                          border: '1px dashed var(--line-2)',
                          color: 'var(--muted)',
                          fontSize: 'var(--fs-sm)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                          No channels connected to {brand.name} yet
                        </div>
                        <p style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                          Click the card below to authorize social accounts to publish, monitor, and analyze.
                        </p>
                      </div>
                    )}

                    {/* Dashed "+ Connect a channel to {Brand}" Card */}
                    <button
                      type="button"
                      className="ch-add"
                      onClick={() => {
                        setWizardBrand(brand.id);
                        setShowConnectModal(true);
                      }}
                    >
                      <span className="ch-add__ico">
                        <svg className="ico" viewBox="0 0 24 24">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                      <b>Connect a channel</b>
                      <small>to {brand.name}</small>
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* 3. Right Sidebar (Audience by network & Supported networks) */}
        <aside className="ch-side" data-side>
          {/* Card 1: Audience by network */}
          <section className="card ch-aud" aria-labelledby="ch-aud-t">
            <header className="card__head">
              <div>
                <h2 className="card__title" id="ch-aud-t">
                  Audience by network
                </h2>
                <p className="card__sub">
                  {formatCompactNumber(totalAudience)} followers across {scopedChannels.length} accounts
                </p>
              </div>
            </header>

            <ul className="ch-bars">
              {audienceByNetwork.map((item) => {
                const pct = Math.round((item.total / totalAudience) * 100);
                const maxVal = audienceByNetwork[0]?.total || 1;
                const fillRatio = item.total / maxVal;
                const netMeta = NETWORK_METAS[item.net];

                return (
                  <li key={item.net}>
                    <span className={`net net--sm net--${item.net}`}>
                      <NetworkIcon network={item.net} className="w-3.5 h-3.5" />
                    </span>
                    <span className="ch-bars__body">
                      <span className="ch-bars__top">
                        <b>{netMeta?.name || item.net}</b>
                        <span>
                          {formatCompactNumber(item.total)} <small>{pct}%</small>
                        </span>
                      </span>
                      <span className="meter">
                        <span
                          className={`meter__fill ch-bars__fill ch-bars__fill--${item.net}`}
                          style={{ transform: `scaleX(${fillRatio})`, transformOrigin: '0 50%' }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Card 2: Supported networks */}
          <section className="card ch-nets" aria-labelledby="ch-nets-t">
            <header className="card__head">
              <div>
                <h2 className="card__title" id="ch-nets-t">
                  Supported networks
                </h2>
                <p className="card__sub">
                  {networksInUseCount} of 8 in use
                </p>
              </div>
            </header>

            <ul className="ch-netlist is-all">
              {Object.entries(NETWORK_METAS).map(([netKey, meta]) => {
                const connectedCount = networkConnectedCounts.get(netKey) || 0;

                return (
                  <li key={netKey} className="ch-net">
                    <span className={`net net--md net--${netKey}`}>
                      <NetworkIcon network={netKey} className="w-4 h-4" />
                    </span>
                    <div className="ch-net__body">
                      <div className="ch-net__top">
                        <b>{meta.name}</b>
                        {connectedCount > 0 ? (
                          <span className="badge badge--pine">{connectedCount} connected</span>
                        ) : (
                          <span className="badge badge--plain">Not connected</span>
                        )}
                        <button
                          type="button"
                          className="ibtn ibtn--sm ch-net__add"
                          title={`Connect ${meta.name}`}
                          onClick={() => {
                            setWizardNet(netKey);
                            setShowConnectModal(true);
                          }}
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>

                      <small>{meta.what}</small>

                      <div className="ch-caps">
                        <span className={`ch-cap ${meta.publish ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.publish ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Publish
                        </span>
                        <span className={`ch-cap ${meta.inbox ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.inbox ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Inbox
                        </span>
                        <span className={`ch-cap ${meta.analytics ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.analytics ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Analytics
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {/* 4. Connect Channel Modal (matching Image 5) */}
      {showConnectModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(16, 18, 20, 0.45)',
                backdropFilter: 'blur(6px)',
              }}
              onClick={() => setShowConnectModal(false)}
            />
            <div
              className="card modal"
              style={{ position: 'relative', zIndex: 10000, maxWidth: '540px', width: '92%' }}
            >
              <form
                className="mform"
                onSubmit={(e) => {
                  e.preventDefault();
                  setActiveOAuthNet(wizardNet as OAuthNetwork);
                }}
              >
                <div className="mform__head">
                  <div>
                    <h3 className="mform__title">Connect a channel</h3>
                    <p className="mform__sub">
                      You’ll sign in to the network and choose which account Murmura may post to.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ibtn ibtn--sm"
                    onClick={() => setShowConnectModal(false)}
                    aria-label="Close"
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* 8 Networks Grid - Each card is directly clickable to open its login page */}
                <div className="cc-nets" role="radiogroup" aria-label="Network">
                  {Object.entries(NETWORK_METAS).map(([key, val]) => {
                    const isSelected = wizardNet === key;
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        className="cc-net"
                        onClick={() => {
                          setWizardNet(key);
                          setActiveOAuthNet(key as OAuthNetwork);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setWizardNet(key);
                            setActiveOAuthNet(key as OAuthNetwork);
                          }
                        }}
                        style={{
                          border: isSelected ? '2px solid var(--text, #eef0ee)' : '1.5px solid var(--line-2, rgba(255,255,255,0.12))',
                          background: isSelected ? 'var(--glass-3, rgba(255,255,255,0.18))' : 'var(--glass-2, rgba(255,255,255,0.06))',
                          boxShadow: isSelected ? '0 0 0 2px var(--butter, #f2b740)' : 'none',
                          transform: isSelected ? 'scale(1.02)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          display: 'grid',
                          justifyItems: 'center',
                          gap: '6px',
                          padding: '14px 6px 12px',
                          borderRadius: '18px',
                          userSelect: 'none',
                        }}
                        title={`Click to open ${val.name} login page`}
                      >
                        <span className={`net net--md net--${key}`}>
                          <NetworkIcon network={key} className="ico" />
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                          {val.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-2px' }}>
                          Log in →
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* For Brand Selection */}
                <div className="field field--wide" style={{ marginTop: '20px' }}>
                  <span className="field__label">For brand</span>
                  <select
                    className="input"
                    value={wizardBrand}
                    onChange={(e) => setWizardBrand(e.target.value)}
                    style={{ color: 'var(--text)' }}
                  >
                    {allKnownBrands.map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        style={{ background: '#1f2226', color: '#eef0ee' }}
                      >
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modal Footer */}
                <div className="mform__foot" style={{ marginTop: '24px' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowConnectModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--ink">
                    Continue to {NETWORK_METAS[wizardNet]?.name || 'Login'} →
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 5. Authentic Social Media OAuth Login Dialog */}
      <SocialOAuthModal
        isOpen={!!activeOAuthNet}
        network={activeOAuthNet || 'instagram'}
        brandName={allKnownBrands.find((b) => b.id === wizardBrand)?.name || 'Brand'}
        brandId={wizardBrand}
        onClose={() => {
          setActiveOAuthNet(null);
        }}
        onBack={() => {
          setActiveOAuthNet(null);
          setShowConnectModal(true);
        }}
        onSuccess={({ handle: newHandle, network: newNet, brandId: bId, followers }) => {
          const bName = allKnownBrands.find((b) => b.id === bId)?.name || 'Brand';
          const netMeta = NETWORK_METAS[newNet];

          const newChannel: ChannelItem = {
            id: `ch-${bId}-${newNet}-${Date.now()}`,
            brandId: bId,
            net: newNet as any,
            handle: newHandle,
            followers: followers || 15400,
            growthPct: Number((Math.random() * 8 + 2).toFixed(1)),
            daysLeft: 60,
            totalDays: 60,
            lastSync: 'Just now',
            connectedBy: 'Devon',
            status: 'connected',
            postingEnabled: true,
          };

          setChannels((prev) => [newChannel, ...prev]);
          setActiveOAuthNet(null);
          setShowConnectModal(false);
          addToast({
            type: 'success',
            message: `Successfully connected ${netMeta?.name || newNet} account (${newHandle}) to ${bName}!`,
          });
        }}
      />
    </div>
  );
}
