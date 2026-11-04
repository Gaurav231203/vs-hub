import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { ManualPublishModal } from '../common/ManualPublishModal.js';
import {
  Calendar,
  Clock,
  Send,
  Save,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  MessageCircle,
  Hash,
  ChevronDown,
  Layers,
  ArrowRight,
  Plus,
  X,
  Heart,
  Bookmark,
  Share2,
  Settings,
  FileText,
  ShieldCheck,
  Globe,
  Smartphone,
  Layout,
  ThumbsUp,
  ThumbsDown,
  BarChart2,
  Repeat,
  Play,
  Music,
  Video,
} from 'lucide-react';

const NETWORK_TIPS: Record<string, string> = {
  instagram: 'The first 125 characters show before “more”. Photos crop to a square.',
  facebook: 'Long posts fold after about 240 characters.',
  x: 'Links count as 23 characters, however long they are.',
  linkedin: 'About 210 characters show before “see more”.',
  tiktok: 'Vertical 9:16 — the caption sits over the video.',
  youtube: 'Shorts are vertical; the caption sits over the video.',
  pinterest: 'The first sentence becomes the pin’s title.',
  threads: '500 characters. Links unfurl into a card.',
};

interface ChannelItem {
  id: string;
  network: string;
  networkTitle?: string;
  handle: string;
  followers?: number;
  status?: string;
  postingEnabled?: boolean;
}

const DEFAULT_CHANNELS: ChannelItem[] = [];


const NETWORK_LIMITS: Record<string, number> = {
  INSTAGRAM: 2200,
  FACEBOOK: 63206,
  TIKTOK: 2200,
  THREADS: 500,
  X: 280,
  LINKEDIN: 3000,
  PINTEREST: 500,
  YOUTUBE: 5000,
};

export function ComposeView() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { postId } = useParams<{ postId?: string }>();
  const { user, workspace, brands, role, hasPermission, selectedBrandId: globalBrandId, setSelectedBrandId: setGlobalBrandId } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  // Initialize selected brand from global store
  const initialBrandId = useMemo(() => {
    if (globalBrandId && globalBrandId !== 'all') {
      const match = brands.find((b) => b.id === globalBrandId || b.id.toLowerCase() === globalBrandId.toLowerCase() || b.name.toLowerCase() === globalBrandId.toLowerCase());
      if (match) return match.id;
      if (globalBrandId.toLowerCase().includes('hollow')) return 'b_hh';
      if (globalBrandId.toLowerCase().includes('vantage')) return 'b_vg';
    }
    return brands[0]?.id || 'b_hh';
  }, [globalBrandId, brands]);

  // Form State
  const [selectedBrandId, setSelectedBrandId] = useState<string>(initialBrandId);
  const [showBrandMenu, setShowBrandMenu] = useState(false);

  // Sync when globalBrandId changes externally
  useEffect(() => {
    if (globalBrandId && globalBrandId !== 'all') {
      const match = brands.find((b) => b.id === globalBrandId || b.id.toLowerCase() === globalBrandId.toLowerCase() || b.name.toLowerCase() === globalBrandId.toLowerCase());
      if (match && match.id !== selectedBrandId) {
        setSelectedBrandId(match.id);
      } else if (globalBrandId.toLowerCase().includes('hollow') && selectedBrandId !== 'b_hh') {
        setSelectedBrandId('b_hh');
      }
    }
  }, [globalBrandId, brands]);

  const activeBrand = brands.find((b) => b.id === selectedBrandId) || brands[0] || {
    id: 'default-brand',
    name: 'Acme Corp',
    color: '#4F46E5',
  };

  const brandNameLower = (activeBrand?.name || '').toLowerCase();
  const isHollowHome = brandNameLower.includes('hollow') || selectedBrandId === 'b_hh';
  const defaultBrandChannels: ChannelItem[] = useMemo(() => [], []);

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(defaultBrandChannels.map((c) => c.id));
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [campaignTag, setCampaignTag] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [publishMode, setPublishMode] = useState<'AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
  const [showManualModal, setShowManualModal] = useState(false);
  
  // Ingest incoming media or brand selection from Library or navigation
  useEffect(() => {
    const navState = location.state as {
      media?: string[];
      brandId?: string;
    } | null;

    if (navState) {
      if (Array.isArray(navState.media) && navState.media.length > 0) {
        setMediaUrls(navState.media);
      }
      if (navState.brandId) {
        const matchingBrand = brands.find(
          (b) =>
            b.id === navState.brandId ||
            b.id.toLowerCase() === navState.brandId?.toLowerCase() ||
            b.name.toLowerCase().includes(navState.brandId?.toLowerCase() || '')
        );
        if (matchingBrand) {
          setSelectedBrandId(matchingBrand.id);
        } else if (navState.brandId === 'hollow' || navState.brandId === 'b_hh') {
          setSelectedBrandId('b_hh');
        } else if (navState.brandId === 'vantage' || navState.brandId === 'b_vg') {
          setSelectedBrandId('b_vg');
        }
      }
      // Clear navigation state to avoid re-applying on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, brands]);
  
  // Default date
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (isHollowHome) {
      return '2026-10-31T13:00';
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${da}T${hr}:${mi}`;
  });

  const [activePreviewNetwork, setActivePreviewNetwork] = useState<string>('INSTAGRAM');
  const [igPreviewType, setIgPreviewType] = useState<'feed' | 'reel'>('feed');
  const [currentPostId, setCurrentPostId] = useState<string | null>(postId || null);
  const [autosaveStatus, setAutosaveStatus] = useState<string>('Saved');
  const [previewDeviceMode, setPreviewDeviceMode] = useState<'card' | 'iphone'>('card');
  const [simLiked, setSimLiked] = useState(false);
  const [simLikes, setSimLikes] = useState(0);
  const [simSaved, setSimSaved] = useState(false);

  // Can this user publish directly without approval?
  const canPublish = hasPermission('post.publish') && workspace?.approvalMode !== 'EVERY_POST';

  // 1. Fetch Channels for selected brand
  const { data: channelsData } = useQuery({
    queryKey: ['compose-channels', selectedBrandId],
    queryFn: () => apiFetch(`/channels?brandId=${selectedBrandId}`).catch(() => null),
    enabled: !!selectedBrandId,
  });

  const fetchedChannels: ChannelItem[] = channelsData?.channels || [];
  const displayChannels: ChannelItem[] = fetchedChannels.length > 0 ? fetchedChannels : defaultBrandChannels;

  // Sync channels on brand change or channelsData update
  useEffect(() => {
    const targetChannels = fetchedChannels.length > 0 ? fetchedChannels : defaultBrandChannels;
    setSelectedChannelIds(targetChannels.map((c) => c.id));
    if (targetChannels.length > 0) {
      if (!targetChannels.some((c) => c.network === activePreviewNetwork)) {
        setActivePreviewNetwork(targetChannels[0].network);
      }
    }
  }, [selectedBrandId, channelsData, defaultBrandChannels]);

  // Update active preview network if current preview network is deselected
  useEffect(() => {
    const selectedChannels = displayChannels.filter((c) => selectedChannelIds.includes(c.id));
    if (selectedChannels.length > 0) {
      if (!selectedChannels.some((c) => c.network === activePreviewNetwork)) {
        setActivePreviewNetwork(selectedChannels[0].network);
      }
    }
  }, [selectedChannelIds, displayChannels, activePreviewNetwork]);

  // 2. Fetch Existing Post (if editing)
  const { data: existingPostData } = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: () => apiFetch(`/posts/${postId}`),
    enabled: !!postId,
  });

  useEffect(() => {
    if (existingPostData?.post) {
      const p = existingPostData.post;
      setSelectedBrandId(p.brandId);
      setCaption(p.caption || '');
      setFirstComment(p.firstComment || '');
      if (p.firstComment) setShowExtras(true);
      if (p.scheduledAt) {
        const d = new Date(p.scheduledAt);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const hr = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        setScheduledDate(`${yr}-${mo}-${da}T${hr}:${mi}`);
      }
      if (p.mediaUrls) setMediaUrls(p.mediaUrls);
      if (p.targets?.length) {
        setSelectedChannelIds(p.targets.map((t: any) => t.channelId));
      }
      if (p.publishMode) {
        setPublishMode(p.publishMode);
      }
      setCurrentPostId(p.id);
    }
  }, [existingPostData]);

  // 3. Validation
  const { data: validationData } = useQuery({
    queryKey: ['compose-validate', caption, selectedChannelIds, scheduledDate, mediaUrls],
    queryFn: () =>
      apiFetch('/validate-post', {
        method: 'POST',
        body: JSON.stringify({
          brandId: selectedBrandId,
          caption,
          firstComment,
          channelIds: selectedChannelIds,
          mediaUrls,
          scheduledAt: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        }),
      }),
    enabled: selectedChannelIds.length > 0,
  });

  const issues: any[] = validationData?.issues || [];
  const blockingErrors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Helper: Save current post draft directly without toast
  const saveCurrentPost = async () => {
    const payload = {
      brandId: selectedBrandId || brands[0]?.id,
      caption,
      firstComment: firstComment || null,
      mediaUrls,
      channelIds: selectedChannelIds,
      scheduledAt: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      publishMode,
    };

    let res: any;
    if (currentPostId) {
      res = await apiFetch(`/posts/${currentPostId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const savedPost = res.post;
    if (savedPost?.id) {
      setCurrentPostId(savedPost.id);
    }
    return res;
  };

  // 4. Save Draft Mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return await saveCurrentPost();
    },
    onSuccess: (data) => {
      const savedPost = data.post;
      setCurrentPostId(savedPost.id);
      setAutosaveStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      addToast({ type: 'success', message: 'Draft saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['drafts-list'] });
    },
    onError: (err: any) => {
      addToast({ type: 'error', message: err.message || 'Failed to save draft' });
    },
  });

  // 5. Submit for Approval Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const saveRes = await saveCurrentPost();
      const targetId = saveRes.post.id;
      return await apiFetch(`/posts/${targetId}/submit`, { method: 'POST' });
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        message: 'Post submitted for approval. Approvers have been notified.',
      });
      navigate('/approvals');
    },
    onError: (err: any) => {
      addToast({ type: 'error', message: err.message || 'Submission failed' });
    },
  });

  // 6. Direct Schedule Mutation
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const saveRes = await saveCurrentPost();
      const targetId = saveRes.post.id;
      return await apiFetch(`/posts/${targetId}/schedule`, { method: 'POST' });
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        message: 'Post successfully scheduled to calendar!',
      });
      navigate('/calendar');
    },
    onError: (err: any) => {
      addToast({ type: 'error', message: err.message || 'Scheduling failed' });
    },
  });

  // 7. Publish Now Mutation
  const publishNowMutation = useMutation({
    mutationFn: async () => {
      const saveRes = await saveCurrentPost();
      const targetId = saveRes.post.id;
      return await apiFetch(`/posts/${targetId}/publish-now`, { method: 'POST' });
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        message: 'Post broadcast live to social networks!',
      });
      navigate('/overview');
    },
    onError: (err: any) => {
      addToast({ type: 'error', message: err.message || 'Publishing failed' });
    },
  });

  // 8. Fetch Drafts List for this Brand
  const { data: draftsData } = useQuery({
    queryKey: ['drafts-list', selectedBrandId],
    queryFn: () => apiFetch(`/approvals?tab=submitted&brandId=${selectedBrandId}`),
    enabled: !!selectedBrandId,
  });
  const drafts: any[] = draftsData?.posts || [];

  const handleToggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const handleResetPost = () => {
    setCurrentPostId(null);
    setCaption('');
    setFirstComment('');
    setMediaUrls([]);
    setCampaignTag('');
    setLinkUrl('');
    setPublishMode('AUTOMATIC');
    setSelectedChannelIds(displayChannels.map((c) => c.id));
    addToast({ type: 'info', message: 'Started fresh composer session' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      urls.push(URL.createObjectURL(files[i]));
    }
    setMediaUrls((prev) => [...prev, ...urls]);
  };

  const removeMedia = (idx: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAiAssist = () => {
    const suggestions = [
      "Crafted with precision, delivered with intent. Discover what's new at your brand.",
      "A season of bold vision and timeless design. Explore our latest pieces in-store and online.",
      "Details that matter. Form that endures. Experience the new collection today.",
    ];
    const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
    setCaption(picked);
    addToast({ type: 'success', message: '✦ Murmura AI generated a high-converting caption' });
  };

  const applySuggestedSlot = (daysAhead: number, hour: number, minute: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, minute, 0, 0);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    setScheduledDate(`${yr}-${mo}-${da}T${hr}:${mi}`);
    addToast({ type: 'info', message: `Slot set to ${d.toLocaleDateString([], { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
  };

  const activeChannel = displayChannels.find((c) => c.network === activePreviewNetwork) || displayChannels[0];
  const activeChannelHandle = activeChannel?.handle?.replace('@', '') || (activeBrand?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'brand');

  // Format Helper functions
  const dateObj = useMemo(() => new Date(scheduledDate), [scheduledDate]);

  const formatDateBig = (dStr: string) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTimeBig = (dStr: string) => {
    const d = new Date(dStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatTimeUntil = (dStr: string) => {
    const target = new Date(dStr).getTime();
    const now = Date.now();
    const diffHours = Math.round((target - now) / (1000 * 60 * 60));
    if (diffHours <= 0) return 'Publishing immediately';
    if (diffHours < 24) return `Goes out in ${diffHours} h`;
    const days = Math.round(diffHours / 24);
    return `Goes out in ${days} day${days > 1 ? 's' : ''}`;
  };

  const formatShortSchedule = (dStr: string) => {
    const d = new Date(dStr);
    const isTomorrow = Math.abs(d.getDate() - new Date().getDate()) === 1;
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })} ${timeStr}`;
  };

  const getDayPercentage = (dStr: string) => {
    const d = new Date(dStr);
    const minutes = d.getHours() * 60 + d.getMinutes();
    return Math.min(100, Math.max(0, (minutes / 1440) * 100));
  };

  const formatCharCount = (remaining: number, max: number) => {
    if (remaining < 0) return `-${Math.abs(remaining)}`;
    if (max >= 10000) return `${(max / 1000).toFixed(1)}K`;
    return max.toLocaleString();
  };

  const formatNetworkTitle = (net: string) => {
    switch (net?.toUpperCase()) {
      case 'INSTAGRAM': return 'Instagram';
      case 'FACEBOOK': return 'Facebook';
      case 'TIKTOK': return 'TikTok';
      case 'THREADS': return 'Threads';
      case 'X': return 'X';
      case 'LINKEDIN': return 'LinkedIn';
      case 'YOUTUBE': return 'YouTube';
      case 'PINTEREST': return 'Pinterest';
      default: return net;
    }
  };

  const selectedNetworks = useMemo(() => {
    return Array.from(new Set(displayChannels.filter((c) => selectedChannelIds.includes(c.id)).map((c) => c.network)));
  }, [displayChannels, selectedChannelIds]);

  const previewNetworks = useMemo(() => {
    if (selectedNetworks.length > 0) return selectedNetworks;
    return Array.from(new Set(displayChannels.map((c) => c.network)));
  }, [displayChannels, selectedNetworks]);

  const ringNetworks = useMemo(() => {
    const nets = selectedNetworks.length > 0 ? selectedNetworks : ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'THREADS'];
    return nets.map((n) => ({
      network: n,
      max: NETWORK_LIMITS[n] || 2200,
    }));
  }, [selectedNetworks]);

  const renderSocialPreview = () => {
    const brandName = activeBrand?.name || 'Brand';
    const rawHandle = activeChannelHandle;
    const handleWithAt = activeChannel?.handle?.startsWith('@') ? activeChannel.handle : `@${activeChannelHandle}`;
    const brandInitials = brandName
      .replace(/&/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'EO';
    const brandColor = activeBrand?.color || 'var(--coral)';

    const formattedTime = scheduledDate
      ? new Date(scheduledDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '12:00 PM';
    const formattedDateShort = scheduledDate
      ? new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'short' })
      : 'Sun';

    // 1. YouTube Shorts (Always Shorts format for YouTube as requested)
    if (activePreviewNetwork === 'YOUTUBE') {
      return (
        <article className="pv pv--youtube pv--video" aria-label="YouTube Shorts preview" style={{ maxWidth: previewDeviceMode === 'iphone' ? '100%' : '300px', margin: '0 auto' }}>
          <div className="pv-frame">
            {mediaUrls.length > 0 ? (
              <img src={mediaUrls[0]} alt="Shorts visual" />
            ) : (
              <div className="pv-missing">
                <Video className="ico" />
                <span>Add a video for Shorts</span>
              </div>
            )}
            <span className="pv-play">
              <Play className="ico fill-white stroke-none" />
            </span>
            <span className="pv-shorts flex items-center gap-1 font-bold">
              <NetworkIcon network="YOUTUBE" className="w-3 h-3 text-white fill-current" />
              Shorts
            </span>

            {/* Floating Right Actions */}
            <div className="pv-side">
              <span
                onClick={() => {
                  setSimLiked((prev) => !prev);
                  setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
                }}
                className="cursor-pointer"
              >
                <ThumbsUp className={`ico ${simLiked ? 'text-rose-500 fill-rose-500' : ''}`} />
                <small>{simLikes > 0 ? simLikes : '14K'}</small>
              </span>
              <span>
                <ThumbsDown className="ico" />
                <small>Dislike</small>
              </span>
              <span>
                <MessageCircle className="ico" />
                <small>820</small>
              </span>
              <span>
                <Share2 className="ico" />
                <small>Share</small>
              </span>
              <span>
                <Repeat className="ico" />
                <small>Remix</small>
              </span>
              <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/20 flex items-center justify-center overflow-hidden">
                {mediaUrls[0] ? <img src={mediaUrls[0]} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-white" />}
              </div>
            </div>

            {/* Bottom Overlay Info */}
            <div className="pv-over">
              <div className="flex items-center gap-2 mb-2">
                <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff', width: 28, height: 28, fontSize: 11 }}>
                  {brandInitials}
                </span>
                <b className="text-white text-xs">{handleWithAt}</b>
                <button type="button" className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] tracking-wide">
                  Subscribe
                </button>
              </div>
              <p className="line-clamp-2 text-xs leading-snug">
                {caption || `What's new at ${brandName}? #shorts #trending`}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-80">
                <Music className="w-3 h-3 animate-pulse" />
                <span className="truncate">Original audio - {brandName}</span>
              </div>
            </div>
          </div>
        </article>
      );
    }

    // 2. TikTok
    if (activePreviewNetwork === 'TIKTOK') {
      return (
        <article className="pv pv--tiktok pv--video" aria-label="TikTok preview" style={{ maxWidth: previewDeviceMode === 'iphone' ? '100%' : '300px', margin: '0 auto' }}>
          <div className="pv-frame">
            {mediaUrls.length > 0 ? (
              <img src={mediaUrls[0]} alt="TikTok visual" />
            ) : (
              <div className="pv-missing">
                <Video className="ico" />
                <span>Add a video</span>
              </div>
            )}
            <span className="pv-play">
              <Play className="ico fill-white stroke-none" />
            </span>

            {/* Floating Right Actions */}
            <div className="pv-side">
              <div className="relative mb-2">
                <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff', width: 36, height: 36, fontSize: 13 }}>
                  {brandInitials}
                </span>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#fe2c55] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  +
                </span>
              </div>
              <span
                onClick={() => {
                  setSimLiked((prev) => !prev);
                  setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
                }}
                className="cursor-pointer"
              >
                <Heart className={`ico ${simLiked ? 'text-[#fe2c55] fill-[#fe2c55]' : ''}`} />
                <small>{simLikes > 0 ? simLikes : '24.5K'}</small>
              </span>
              <span>
                <MessageCircle className="ico" />
                <small>1,208</small>
              </span>
              <span onClick={() => setSimSaved((prev) => !prev)} className="cursor-pointer">
                <Bookmark className={`ico ${simSaved ? 'text-amber-400 fill-amber-400' : ''}`} />
                <small>856</small>
              </span>
              <span>
                <Share2 className="ico" />
                <small>342</small>
              </span>
              <div className="w-8 h-8 rounded-full border-2 border-white/40 flex items-center justify-center bg-black animate-spin" style={{ animationDuration: '4s' }}>
                <Music className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Bottom Caption Overlay */}
            <div className="pv-over">
              <b className="text-white text-sm mb-1">{handleWithAt}</b>
              <p className="line-clamp-2 text-xs opacity-95">
                {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-80">
                <Music className="w-3 h-3" />
                <span className="truncate">original sound - {brandName}</span>
              </div>
            </div>
          </div>
        </article>
      );
    }

    // 3. Instagram (Feed OR Reel)
    if (activePreviewNetwork === 'INSTAGRAM') {
      if (igPreviewType === 'reel') {
        return (
          <article className="pv pv--instagram pv--video" aria-label="Instagram Reel preview" style={{ maxWidth: previewDeviceMode === 'iphone' ? '100%' : '300px', margin: '0 auto' }}>
            <div className="pv-frame">
              {mediaUrls.length > 0 ? (
                <img src={mediaUrls[0]} alt="Reel visual" />
              ) : (
                <div className="pv-missing">
                  <Video className="ico" />
                  <span>Instagram Reel needs a video</span>
                </div>
              )}
              <span className="pv-play">
                <Play className="ico fill-white stroke-none" />
              </span>
              <span className="pv-shorts flex items-center gap-1 font-bold" style={{ background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)' }}>
                <NetworkIcon network="INSTAGRAM" className="w-3 h-3 text-white" />
                Reels
              </span>

              {/* Right Side Actions */}
              <div className="pv-side">
                <span
                  onClick={() => {
                    setSimLiked((prev) => !prev);
                    setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
                  }}
                  className="cursor-pointer"
                >
                  <Heart className={`ico ${simLiked ? 'text-rose-500 fill-rose-500' : ''}`} />
                  <small>{simLikes > 0 ? simLikes : '12.8K'}</small>
                </span>
                <span>
                  <MessageCircle className="ico" />
                  <small>432</small>
                </span>
                <span>
                  <Send className="ico" />
                  <small>Send</small>
                </span>
                <span onClick={() => setSimSaved((prev) => !prev)} className="cursor-pointer">
                  <Bookmark className={`ico ${simSaved ? 'text-amber-400 fill-amber-400' : ''}`} />
                </span>
                <span className="pv-dots text-white text-lg leading-none cursor-pointer">···</span>
              </div>

              {/* Bottom Overlay */}
              <div className="pv-over">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff', width: 26, height: 26, fontSize: 11 }}>
                    {brandInitials}
                  </span>
                  <b className="text-white text-xs">{rawHandle}</b>
                  <span className="text-[11px] text-white/80 font-semibold">• Follow</span>
                </div>
                <p className="line-clamp-2 text-xs">
                  {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-80">
                  <Music className="w-3 h-3" />
                  <span className="truncate">Original audio • {rawHandle}</span>
                </div>
              </div>
            </div>
          </article>
        );
      }

      // Default Instagram Feed
      return (
        <article className="pv pv--instagram" aria-label="Instagram preview">
          <header className="pv-head">
            <span className="bmark bmark--xs" style={{ backgroundColor: brandColor, color: '#fff' }}>
              {brandInitials}
            </span>
            <b>{rawHandle}</b>
            <span className="pv-dots">···</span>
          </header>

          {mediaUrls.length > 0 ? (
            <div className="pv-media pv-media--square relative group">
              <img src={mediaUrls[0]} alt="Instagram visual" className="transition-transform duration-300 group-hover:scale-[1.02]" />
              <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white border border-white/20">
                1:1 Square
              </span>
              {mediaUrls.length > 1 && (
                <span className="pv-count">1/{mediaUrls.length}</span>
              )}
            </div>
          ) : (
            <div className="pv-missing">
              <ImageIcon className="ico" />
              <span>Instagram needs a photo</span>
            </div>
          )}

          <div className="pv-actions">
            <button
              type="button"
              onClick={() => {
                setSimLiked((prev) => !prev);
                setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
              }}
              className={`cursor-pointer transition-transform active:scale-125 ${
                simLiked ? 'text-rose-500 fill-rose-500' : 'hover:text-rose-400'
              }`}
            >
              <Heart className={`ico ${simLiked ? 'fill-current' : ''}`} />
            </button>
            <button type="button" className="cursor-pointer hover:text-[var(--text)] transition-colors">
              <MessageCircle className="ico" />
            </button>
            <button type="button" className="cursor-pointer hover:text-[var(--text)] transition-colors">
              <Send className="ico" />
            </button>
            <button
              type="button"
              onClick={() => setSimSaved((prev) => !prev)}
              className={`ico ml-auto cursor-pointer transition-transform active:scale-125 ${
                simSaved ? 'text-amber-500 fill-amber-500' : 'hover:text-amber-400'
              }`}
            >
              <Bookmark className={`ico ${simSaved ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="pv-likes">{simLikes} {simLikes === 1 ? 'like' : 'likes'}</div>

          <div className="pv-text">
            <b>{rawHandle} </b>
            <span>
              {caption || (
                <span className="opacity-50">
                  What’s new at {brandName}? Write once — Murmura fits it to every network.
                </span>
              )}
            </span>
          </div>

          {firstComment && (
            <div className="pv-first">
              <b>{rawHandle} </b>
              <span>{firstComment}</span>
            </div>
          )}

          <div className="pv-when">
            {formattedDateShort.toUpperCase()} · {formattedTime}
          </div>
        </article>
      );
    }

    // 4. X (Twitter)
    if (activePreviewNetwork === 'X') {
      return (
        <article className="pv pv--x" aria-label="X preview">
          <div className="pv-row">
            <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff' }}>
              {brandInitials}
            </span>
            <div className="pv-col">
              <header className="pv-head pv-head--inline">
                <b>{brandName}</b>
                <span className="text-[var(--muted)] text-[13px]">
                  {handleWithAt} · {formattedDateShort}
                </span>
              </header>

              <p className="pv-text" style={{ padding: '4px 0 8px', fontSize: '14px', lineHeight: '1.45' }}>
                {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
              </p>

              {mediaUrls.length > 0 ? (
                <div className="pv-media pv-media--grid" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <img src={mediaUrls[0]} alt="X attachment" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
                </div>
              ) : null}

              <div className="pv-actions pv-actions--x">
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-sky-400 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  <small className="font-mono text-xs">18</small>
                </span>
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-400 transition-colors">
                  <Repeat className="w-4 h-4" />
                  <small className="font-mono text-xs">6</small>
                </span>
                <span
                  onClick={() => {
                    setSimLiked((prev) => !prev);
                    setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
                  }}
                  className={`flex items-center gap-1.5 cursor-pointer transition-colors ${simLiked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                >
                  <Heart className={`w-4 h-4 ${simLiked ? 'fill-current' : ''}`} />
                  <small className="font-mono text-xs">{simLikes > 0 ? simLikes : '84'}</small>
                </span>
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-sky-400 transition-colors">
                  <BarChart2 className="w-4 h-4" />
                  <small className="font-mono text-xs">1.4K</small>
                </span>
                <span onClick={() => setSimSaved((prev) => !prev)} className={`cursor-pointer ${simSaved ? 'text-amber-400' : 'hover:text-amber-400'}`}>
                  <Bookmark className={`w-4 h-4 ${simSaved ? 'fill-current' : ''}`} />
                </span>
              </div>
            </div>
          </div>
        </article>
      );
    }

    // 5. LinkedIn
    if (activePreviewNetwork === 'LINKEDIN') {
      return (
        <article className="pv pv--linkedin" aria-label="LinkedIn preview">
          <header className="pv-head">
            <span className="bmark bmark--sm" style={{ backgroundColor: brandColor, color: '#fff' }}>
              {brandInitials}
            </span>
            <span className="pv-col">
              <b>{brandName}</b>
              <small className="flex items-center gap-1 text-[var(--muted)] text-[11px]">
                18,420 followers · 1d · <Globe className="w-3 h-3" />
              </small>
            </span>
            <span className="pv-dots text-[var(--muted)]">···</span>
          </header>

          <p className="pv-text" style={{ padding: '0 14px 10px', fontSize: '13.5px', lineHeight: '1.45' }}>
            {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
          </p>

          {mediaUrls.length > 0 ? (
            <div className="pv-media pv-media--wide" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              <img src={mediaUrls[0]} alt="LinkedIn visual" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover' }} />
            </div>
          ) : null}

          <div className="pv-react flex items-center justify-between px-3.5 py-2 text-xs text-[var(--muted)] border-b border-[var(--line)]">
            <span className="flex items-center gap-1">
              <span className="inline-flex -space-x-1">
                <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">👍</span>
                <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white">❤️</span>
                <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white">👏</span>
              </span>
              <span className="ml-1 font-semibold">{simLikes > 0 ? simLikes : '64'}</span>
            </span>
            <span>12 comments · 4 reposts</span>
          </div>

          <div className="pv-actions pv-actions--li">
            <span
              onClick={() => {
                setSimLiked((prev) => !prev);
                setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
              }}
              className={`cursor-pointer ${simLiked ? 'text-blue-500 font-bold' : ''}`}
            >
              <ThumbsUp className={`ico ${simLiked ? 'fill-current' : ''}`} />
              Like
            </span>
            <span className="cursor-pointer">
              <MessageSquare className="ico" />
              Comment
            </span>
            <span className="cursor-pointer">
              <Repeat className="ico" />
              Repost
            </span>
            <span className="cursor-pointer">
              <Send className="ico" />
              Send
            </span>
          </div>
        </article>
      );
    }

    // 6. Facebook
    if (activePreviewNetwork === 'FACEBOOK') {
      return (
        <article className="pv pv--facebook" aria-label="Facebook preview">
          <header className="pv-head">
            <span className="bmark bmark--sm" style={{ backgroundColor: brandColor, color: '#fff' }}>
              {brandInitials}
            </span>
            <span className="pv-col">
              <b>{brandName}</b>
              <small className="flex items-center gap-1 text-[var(--muted)] text-[11.5px]">
                {formattedDateShort} at {formattedTime} · <Globe className="w-3 h-3" />
              </small>
            </span>
            <span className="pv-dots text-[var(--muted)]">···</span>
          </header>

          <p className="pv-text" style={{ padding: '0 14px 10px', fontSize: '14px', lineHeight: '1.45' }}>
            {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
          </p>

          {mediaUrls.length > 0 ? (
            <div className="pv-media pv-media--grid" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              <img src={mediaUrls[0]} alt="Facebook visual" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover' }} />
            </div>
          ) : null}

          <div className="pv-react flex items-center justify-between px-3.5 py-2 text-xs text-[var(--muted)] border-b border-[var(--line)]">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">👍</span>
              <span className="font-semibold">{simLikes > 0 ? simLikes : '38'}</span>
            </span>
            <span>9 comments · 3 shares</span>
          </div>

          <div className="pv-actions pv-actions--li">
            <span
              onClick={() => {
                setSimLiked((prev) => !prev);
                setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
              }}
              className={`cursor-pointer ${simLiked ? 'text-blue-500 font-bold' : ''}`}
            >
              <ThumbsUp className={`ico ${simLiked ? 'fill-current' : ''}`} />
              Like
            </span>
            <span className="cursor-pointer">
              <MessageSquare className="ico" />
              Comment
            </span>
            <span className="cursor-pointer">
              <Share2 className="ico" />
              Share
            </span>
          </div>
        </article>
      );
    }

    // 7. Threads
    if (activePreviewNetwork === 'THREADS') {
      return (
        <article className="pv pv--threads" aria-label="Threads preview">
          <div className="pv-row relative">
            <div className="flex flex-col items-center">
              <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff' }}>
                {brandInitials}
              </span>
              <div className="w-[1.5px] flex-1 bg-[var(--line)] my-1.5" />
            </div>

            <div className="pv-col">
              <header className="pv-head pv-head--inline">
                <b>{rawHandle}</b>
                <span className="text-[var(--muted)] text-[13px]">{formattedDateShort}</span>
                <span className="pv-dots ml-auto text-[var(--muted)]">···</span>
              </header>

              <p className="pv-text" style={{ padding: '2px 0 8px', fontSize: '14px', lineHeight: '1.45' }}>
                {caption || `What’s new at ${brandName}? Write once — Murmura fits it to every network.`}
              </p>

              {mediaUrls.length > 0 ? (
                <div className="pv-media pv-media--grid" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <img src={mediaUrls[0]} alt="Threads visual" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
                </div>
              ) : null}

              <div className="pv-actions" style={{ padding: '8px 0 0', gap: '16px' }}>
                <span
                  onClick={() => {
                    setSimLiked((prev) => !prev);
                    setSimLikes((prev) => (simLiked ? Math.max(0, prev - 1) : prev + 1));
                  }}
                  className={`cursor-pointer ${simLiked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                >
                  <Heart className={`w-4 h-4 ${simLiked ? 'fill-current' : ''}`} />
                </span>
                <span className="cursor-pointer hover:text-[var(--text)]">
                  <MessageCircle className="w-4 h-4" />
                </span>
                <span className="cursor-pointer hover:text-[var(--text)]">
                  <Repeat className="w-4 h-4" />
                </span>
                <span className="cursor-pointer hover:text-[var(--text)]">
                  <Send className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </article>
      );
    }

    // 8. Pinterest
    if (activePreviewNetwork === 'PINTEREST') {
      return (
        <article className="pv pv--pinterest" aria-label="Pinterest preview" style={{ maxWidth: previewDeviceMode === 'iphone' ? '100%' : '280px', margin: '0 auto' }}>
          <div className="pv-pin relative rounded-2xl overflow-hidden shadow-lg border border-[var(--line)]">
            {mediaUrls.length > 0 ? (
              <img src={mediaUrls[0]} alt="Pin visual" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
            ) : (
              <div className="pv-missing" style={{ aspectRatio: '3/4' }}>
                <ImageIcon className="ico" />
                <span>Pinterest needs a photo</span>
              </div>
            )}
            <button type="button" className="pv-save bg-[#e60023] text-white px-4 py-2 rounded-full font-bold text-xs tracking-wide shadow-md">
              Save
            </button>
          </div>
          <p className="pv-title font-bold text-sm mt-2 px-1">
            {caption ? caption.split(/[.!?\n]/)[0].slice(0, 80) : `${brandName} Aesthetic Ideas`}
          </p>
          <div className="pv-by flex items-center gap-2 mt-1 px-1">
            <span className="pv-av" style={{ backgroundColor: brandColor, color: '#fff', width: 24, height: 24, fontSize: 10 }}>
              {brandInitials}
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">{brandName}</span>
          </div>
        </article>
      );
    }

    return null;
  };

  return (
    <div className="view">
      {/* Top Header Bar */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Compose</h1>
        </div>

        <div className="head__stats">
          <div className="stat">
            <div className="stat__ico">
              <FileText className="ico" />
            </div>
            <div>
              <div className="stat__value">0</div>
              <div className="stat__label">Your drafts & changes</div>
            </div>
          </div>

          <div className="stat">
            <div className="stat__ico">
              <ShieldCheck className="ico" />
            </div>
            <div>
              <div className="stat__value">0</div>
              <div className="stat__label">Waiting for approval</div>
            </div>
          </div>

          <div className="stat">
            <div className="stat__ico">
              <Calendar className="ico" />
            </div>
            <div>
              <div className="stat__value">{isHollowHome ? 3 : 14}</div>
              <div className="stat__label">Scheduled, next 7 days</div>
            </div>
          </div>
        </div>

        <div className="head__actions">
          <button
            type="button"
            onClick={handleResetPost}
            className="btn btn--ghost magnetic"
          >
            <Plus className="ico" />
            <span>New post</span>
          </button>
        </div>
      </header>

      {/* 3-Column Compose Grid */}
      <div className="cm-grid">
        {/* ========================================================
            COLUMN 1: Content Editor Card (.cm-editor)
           ======================================================== */}
        <section className="cm-editor card">
          <div className="card__head cm-ed__head">
            <div className="cm-ed__lead">
              <h2 className="card__title">{currentPostId ? 'Edit post' : 'New post'}</h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBrandMenu(!showBrandMenu)}
                  className="cm-brand btn magnetic"
                >
                  <span
                    className="bmark bmark--sm"
                    style={{
                      backgroundColor: activeBrand?.color || 'var(--coral)',
                      color: activeBrand?.color === '#f2b740' ? '#1a1918' : '#fff',
                      fontWeight: 700,
                    }}
                  >
                    {activeBrand?.name
                      ? activeBrand.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'EO'}
                  </span>
                  <span className="cm-brand__t">
                    <small>Brand</small>
                    <span className="cm-brand__n">{activeBrand?.name || 'your brand'}</span>
                  </span>
                  <ChevronDown className="ico" />
                </button>

                {showBrandMenu && (
                  <div className="pop" style={{ top: '100%', left: 0, zIndex: 60, marginTop: 4 }}>
                    <div className="pop__head">
                      <span className="pop__title">Switch Brand</span>
                    </div>
                    <div className="pop__list">
                      {brands.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="menu__item"
                          onClick={() => {
                            setSelectedBrandId(b.id);
                            setGlobalBrandId(b.id);
                            setShowBrandMenu(false);
                          }}
                        >
                          <span
                            className="bmark bmark--xs"
                            style={{
                              backgroundColor: b.color,
                              color: b.color === '#f2b740' ? '#1a1918' : '#fff',
                              fontWeight: 700,
                            }}
                          >
                            {b.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{b.name}</span>
                          {selectedBrandId === b.id && <Check className="ico menu__check" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Publishing Mode Switcher (Auto API vs Manual Reminder) */}
          <div
            className="cm-mode-bar"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 14px',
              margin: '0 0 16px',
              backgroundColor: 'var(--well)',
              borderRadius: '16px',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Publish Mode:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--float)',
                  padding: '3px',
                  borderRadius: '999px',
                  border: '1px solid var(--line-2)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setPublishMode('AUTOMATIC')}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '5px 13px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    backgroundColor: publishMode === 'AUTOMATIC' ? 'var(--text)' : 'transparent',
                    color: publishMode === 'AUTOMATIC' ? 'var(--float)' : 'var(--muted)',
                  }}
                  title="Auto-Publish directly via official social network APIs at the scheduled time"
                >
                  <Sparkles style={{ width: 13, height: 13 }} />
                  <span>⚡ Auto-Publish (API)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublishMode('MANUAL')}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '5px 13px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    backgroundColor: publishMode === 'MANUAL' ? 'var(--text)' : 'transparent',
                    color: publishMode === 'MANUAL' ? 'var(--float)' : 'var(--muted)',
                  }}
                  title="Send a reminder at post time with 1-click caption copy and photo download"
                >
                  <Smartphone style={{ width: 13, height: 13 }} />
                  <span>📱 Manual (Reminder)</span>
                </button>
              </div>
            </div>

            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {publishMode === 'AUTOMATIC'
                ? '⚡ Direct API post at scheduled time'
                : '📱 Notification alert with 1-click caption copy & download'}
            </span>
          </div>

          {/* Destination Channels Row */}
          <div className="cm-row">
            <span className="cm-label">
              Post to · <span className="cm-dim">{selectedChannelIds.length} of {displayChannels.length}</span>
            </span>
            <div className="cm-chs">
              {displayChannels.map((ch) => {
                const isSelected = selectedChannelIds.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleChannel(ch.id)}
                    className="cm-ch btn magnetic"
                  >
                    <span className={`net net--sm net--${ch.network.toLowerCase()}`}>
                      <NetworkIcon network={ch.network} className="ico" />
                    </span>
                    <span className="cm-ch__n">{ch.networkTitle || formatNetworkTitle(ch.network)}</span>
                    <span className="cm-ch__h">{ch.handle}</span>
                    <span className="cm-ch__tick">
                      <Check className="ico" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Box */}
          <div className="cm-box">
            <div className="cm-box__glow" />
            <textarea
              className="cm-text"
              rows={7}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={`What’s new at ${activeBrand?.name || 'your brand'}? Write once — Murmura fits it to every network.`}
            />

            {/* Attached Media Strip */}
            {mediaUrls.length > 0 && (
              <div className="cm-media">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="cm-th">
                    <img src={url} alt="Attached" />
                    <span className="cm-th__n">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="cm-th__b cm-th__b--rm"
                      title="Remove attachment"
                    >
                      <X className="ico" />
                    </button>
                  </div>
                ))}
                <div className="cm-th-add">
                  <label className="cm-th-add__b cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="sr-only hidden"
                      onChange={handleFileUpload}
                    />
                    <Plus className="ico" />
                    <span>Add</span>
                  </label>
                </div>
              </div>
            )}

            {/* Bottom Tools Toolbar */}
            <div className="cm-tools">
              <label className="cm-tool btn cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="sr-only hidden"
                  onChange={handleFileUpload}
                />
                <ImageIcon className="ico" />
                <span>Media</span>
              </label>

              <button
                type="button"
                className="cm-tool btn"
                onClick={() => setCaption((prev) => (prev ? `${prev} #growth #luxury #craft` : '#growth #luxury #craft'))}
              >
                <Hash className="ico" />
                <span>Hashtags</span>
              </button>

              <button
                type="button"
                className="cm-tool btn"
                onClick={() =>
                  setCaption(
                    'Precision in every contour. Discover the latest editorial drop at your brand — live now.'
                  )
                }
              >
                <FileText className="ico" />
                <span>Template</span>
              </button>

              <button
                type="button"
                className="cm-tool cm-assist btn magnetic"
                onClick={handleAiAssist}
              >
                <Sparkles className="ico" />
                <span>Assist</span>
              </button>

              <div className="cm-tools__sp" />

              {/* Character Limit Rings */}
              <div className="cm-rings">
                {ringNetworks.map((r) => {
                  const rem = r.max - caption.length;
                  const isOver = rem < 0;
                  const isNear = rem <= r.max * 0.1 && rem >= 0;
                  const pct = Math.min(100, Math.max(0, (caption.length / r.max) * 100));
                  const strokeOffset = 88 - (pct / 100) * 88;

                  return (
                    <div
                      key={r.network}
                      className={`cm-ring ${isOver ? 'is-over' : isNear ? 'is-near' : ''}`}
                      title={`${formatNetworkTitle(r.network)} limit: ${r.max.toLocaleString()}`}
                    >
                      <span className={`net net--xs net--${r.network.toLowerCase()}`}>
                        <NetworkIcon network={r.network} className="ico" />
                      </span>
                      <div className="cm-ring__dial">
                        <svg viewBox="0 0 36 36">
                          <circle className="cm-ring__track" cx="18" cy="18" r="14" />
                          <circle
                            className="cm-ring__arc"
                            cx="18"
                            cy="18"
                            r="14"
                            strokeDasharray="88"
                            strokeDashoffset={strokeOffset}
                          />
                        </svg>
                      </div>
                      <span>{formatCharCount(rem, r.max)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notices & Problems Strip */}
          <div className="cm-probs">
            {!caption && mediaUrls.length === 0 ? (
              <div className="cm-prob">
                <i />
                <span>Write something or add a photo</span>
              </div>
            ) : blockingErrors.length > 0 ? (
              <div className="cm-prob cm-prob--coral">
                <AlertCircle className="ico" />
                <span>{blockingErrors[0].message}</span>
              </div>
            ) : warnings.length > 0 ? (
              <div className="cm-prob cm-prob--butter">
                <AlertTriangle className="ico" />
                <span>{warnings[0].message}</span>
              </div>
            ) : (
              <div className="cm-prob cm-prob--pine">
                <Check className="ico" />
                <span>
                  {(selectedNetworks.length === 1 || selectedChannelIds.length === 1)
                    ? 'Ready for 1 network'
                    : `Ready to schedule across ${selectedChannelIds.length} channels`}
                </span>
              </div>
            )}
          </div>

          {/* Extras / Collapsible Options */}
          <div className="cm-extras">
            <button
              type="button"
              className={`cm-xbtn btn ${showExtras || firstComment || campaignTag || linkUrl ? 'has-values' : ''}`}
              onClick={() => setShowExtras(!showExtras)}
            >
              <Settings className="ico" />
              <span>More options</span>
              <small>
                {firstComment
                  ? 'First comment set'
                  : campaignTag
                  ? `Campaign: ${campaignTag}`
                  : 'First comment, link, campaign'}
              </small>
              <ChevronDown
                className="ico"
                style={{
                  transform: showExtras ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              />
            </button>

            {showExtras && (
              <div className="cm-x">
                <div className="field">
                  <label className="field__label">
                    <span className="net net--xs net--instagram">
                      <NetworkIcon network="INSTAGRAM" className="ico" />
                    </span>
                    First comment (Instagram & Facebook)
                  </label>
                  <textarea
                    rows={2}
                    value={firstComment}
                    onChange={(e) => setFirstComment(e.target.value)}
                    placeholder="Drop extra links, citations or tags in the first comment..."
                    className="input"
                  />
                </div>

                <div className="cm-x__row">
                  <div className="field">
                    <label className="field__label">Campaign tag</label>
                    <input
                      type="text"
                      value={campaignTag}
                      onChange={(e) => setCampaignTag(e.target.value)}
                      placeholder="e.g. Autumn Drop 2026"
                      className="input"
                    />
                  </div>

                  <div className="field">
                    <label className="field__label">Link URL</label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://emberandoak.com/drop"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================
            COLUMN 2: Live Device Simulation Preview (.cm-pv)
           ======================================================== */}
        <aside className="cm-pv card">
          <div className="card__head cm-pv__head">
            <div className="cm-pv__lead">
              <h3 className="card__title">Preview</h3>
              <p className="card__sub">
                {formatNetworkTitle(activePreviewNetwork)} · @{activeChannelHandle}
              </p>
            </div>

            {/* Social Network Selector on top right of header */}
            <div className="seg cm-pv__seg">
              {previewNetworks.map((net) => (
                <button
                  key={net}
                  type="button"
                  aria-pressed={activePreviewNetwork === net}
                  onClick={() => setActivePreviewNetwork(net)}
                  className="seg__btn"
                  title={formatNetworkTitle(net)}
                >
                  <span className={`net net--xs net--${net.toLowerCase()}`}>
                    <NetworkIcon network={net} className="ico" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dedicated View Options Toolbar (Device & Feed/Reel) */}
          <div className="flex items-center justify-between px-4 pb-2 pt-0 gap-2">
            {/* Device Mode Toggle: Card vs Phone */}
            <div className="seg">
              <button
                type="button"
                aria-pressed={previewDeviceMode === 'card'}
                onClick={() => setPreviewDeviceMode('card')}
                className="seg__btn flex items-center space-x-1"
                title="Card view"
              >
                <Layout className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Card</span>
              </button>
              <button
                type="button"
                aria-pressed={previewDeviceMode === 'iphone'}
                onClick={() => setPreviewDeviceMode('iphone')}
                className="seg__btn flex items-center space-x-1"
                title="Phone simulation"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Phone</span>
              </button>
            </div>

            {/* Instagram Feed vs Reel Toggle */}
            {activePreviewNetwork === 'INSTAGRAM' ? (
              <div className="seg">
                <button
                  type="button"
                  aria-pressed={igPreviewType === 'feed'}
                  onClick={() => setIgPreviewType('feed')}
                  className="seg__btn text-[11px] font-bold px-2.5"
                >
                  Feed
                </button>
                <button
                  type="button"
                  aria-pressed={igPreviewType === 'reel'}
                  onClick={() => setIgPreviewType('reel')}
                  className="seg__btn text-[11px] font-bold px-2.5"
                >
                  Reel
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-[var(--muted)] opacity-70 px-1">
                {activePreviewNetwork === 'YOUTUBE' ? 'Shorts' : activePreviewNetwork === 'TIKTOK' ? 'Video' : 'Post'}
              </span>
            )}
          </div>

          <div className="cm-pv__stage">
            {/* Conditional Phone Bezel Wrapper */}
            <div
              className={
                previewDeviceMode === 'iphone'
                  ? 'relative mx-auto rounded-[46px] p-2.5 pt-3.5 pb-6 bg-[#0c0d10] border-[5px] border-[#22252a] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.12)] max-w-[340px] w-full transition-all duration-300'
                  : 'w-full flex justify-center transition-all duration-300'
              }
            >
              {/* iPhone Dynamic Island & Status Bar */}
              {previewDeviceMode === 'iphone' && (
                <div className="flex items-center justify-between px-4 pb-2.5 text-[10px] font-bold text-white tracking-wider select-none">
                  <span className="font-mono">9:41</span>
                  <div className="w-20 h-4 bg-black rounded-full mx-auto -mt-1 shadow-inner ring-1 ring-white/10 flex items-center justify-end pr-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                  </div>
                  <div className="flex items-center space-x-1 opacity-90 text-[9px] font-mono">
                    <span>5G</span>
                    <div className="w-3.5 h-2 border border-white rounded-[2px] p-[0.5px]">
                      <div className="h-full bg-white w-full rounded-[0.5px]" />
                    </div>
                  </div>
                </div>
              )}

              {renderSocialPreview()}

              {/* iPhone Bottom Bar */}
              {previewDeviceMode === 'iphone' && (
                <div className="w-28 h-1 bg-white/35 rounded-full mx-auto mt-3 shadow-sm" />
              )}
            </div>
          </div>

          <div className="cm-pv__foot">
            <Sparkles className="ico text-amber-400" />
            <span>{NETWORK_TIPS[activePreviewNetwork.toLowerCase()] || 'Live preview for this social network.'}</span>
          </div>
        </aside>

        {/* ========================================================
            COLUMN 3: When (.cm-when), Action Bar (.cm-bar), Drafts (.cm-drafts)
           ======================================================== */}
        <section className="cm-when card">
          <div className="card__head">
            <h3 className="card__title">When</h3>
            <span className="cm-tzpill">{workspace?.timezone?.split('/')[1] || 'Lisbon'}</span>
          </div>

          <div className="cm-when__big">
            <b>{formatDateBig(scheduledDate)}</b> <span>{formatTimeBig(scheduledDate)}</span>
            <small>{formatTimeUntil(scheduledDate)}</small>
          </div>

          <div className="cm-when__inputs">
            <input
              type="date"
              value={scheduledDate.slice(0, 10)}
              onChange={(e) => setScheduledDate((prev) => `${e.target.value}T${prev.slice(11, 16)}`)}
              className="input"
            />
            <input
              type="time"
              value={scheduledDate.slice(11, 16)}
              onChange={(e) => setScheduledDate((prev) => `${prev.slice(0, 10)}T${e.target.value}`)}
              className="input"
            />
          </div>

          {/* Best times suggestions */}
          <div className="cm-best">
            <div className="cm-label cm-best__for">
              Best times for
              <span className="net-stack">
                {selectedNetworks.map((net) => (
                  <span key={net} className={`net net--xs net--${net.toLowerCase()}`}>
                    <NetworkIcon network={net} className="ico" />
                  </span>
                ))}
              </span>
            </div>
            <div className="cm-best__chips">
              <button
                type="button"
                className="chip btn cm-bt magnetic"
                onClick={() => applySuggestedSlot(1, 20, 0)}
              >
                <Sparkles className="ico" />
                <span>Sat 8:00 PM</span>
              </button>
              <button
                type="button"
                className="chip btn cm-bt magnetic"
                onClick={() => applySuggestedSlot(2, 20, 0)}
              >
                <Sparkles className="ico" />
                <span>Sun 8:00 PM</span>
              </button>
              <button
                type="button"
                className="chip btn cm-bt magnetic"
                onClick={() => applySuggestedSlot(3, 20, 0)}
              >
                <Sparkles className="ico" />
                <span>Mon 8:00 PM</span>
              </button>
              <button
                type="button"
                className="chip btn cm-bt cm-bt--free magnetic"
                onClick={() => applySuggestedSlot(1, 13, 0)}
              >
                <Sparkles className="ico" />
                <span>Next free slot</span>
              </button>
            </div>
          </div>

          {/* 24-Hour Day Timeline */}
          <div className="cm-day">
            <div className="cm-day__bar">
              <div className="cm-day__dot tone--butter" style={{ left: '50%' }} />
              <div className="cm-day__me" style={{ left: `${getDayPercentage(scheduledDate)}%` }} />
            </div>
            <div className="cm-day__ticks">
              <span>12a</span>
              <span>6a</span>
              <span>12p</span>
              <span>6p</span>
              <span>12a</span>
            </div>
            <p className="cm-day__note">
              {isHollowHome ? '1 other post from your brand that day, none close to this one' : `2 other posts from ${activeBrand?.name || 'your brand'} that day, none close to this one`}
            </p>
          </div>

          <div className="cm-tz">
            <Globe className="ico" />
            <span>Times are in the workspace time zone, {workspace?.timezone || 'Europe/Lisbon'}.</span>
          </div>
        </section>

        {/* Action Bar (.cm-bar) */}
        <section className="cm-bar card">
          <div className="cm-bar__k">
            {publishMode === 'MANUAL' ? (
              <>
                <Smartphone className="ico" style={{ color: 'var(--butter)' }} />
                <span>Manual Reminder Mode (Self-Post)</span>
              </>
            ) : (
              <>
                <Sparkles className="ico" />
                <span>{canPublish ? 'You can publish directly' : 'Requires approval before publishing'}</span>
              </>
            )}
          </div>

          <div className="cm-bar__v">
            <b>{selectedChannelIds.length}</b> channels · <span>{formatShortSchedule(scheduledDate)}</span>
          </div>

          <div className="cm-bar__btns">
            {publishMode === 'MANUAL' ? (
              <>
                <button
                  type="button"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || (!caption && mediaUrls.length === 0)}
                  className="btn cm-go magnetic"
                  style={{ backgroundColor: 'var(--butter)', color: '#16191d' }}
                >
                  <Clock className="ico" />
                  <span>{scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Reminder'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  disabled={!caption && mediaUrls.length === 0}
                  className="btn cm-sec magnetic"
                >
                  <Smartphone className="ico" />
                  <span>Post Manually Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                  className="btn cm-sec magnetic"
                >
                  {saveDraftMutation.isPending ? 'Saving...' : 'Save draft'}
                </button>
              </>
            ) : canPublish ? (
              <>
                <button
                  type="button"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || blockingErrors.length > 0 || (!caption && mediaUrls.length === 0)}
                  className="btn cm-go magnetic"
                >
                  <Calendar className="ico" />
                  <span>{scheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => publishNowMutation.mutate()}
                  disabled={publishNowMutation.isPending || blockingErrors.length > 0 || (!caption && mediaUrls.length === 0)}
                  className="btn cm-sec magnetic"
                >
                  {publishNowMutation.isPending ? 'Publishing live...' : 'Publish now'}
                </button>
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                  className="btn cm-sec magnetic"
                >
                  {saveDraftMutation.isPending ? 'Saving...' : 'Save draft'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || blockingErrors.length > 0 || (!caption && mediaUrls.length === 0)}
                  className="btn cm-go magnetic"
                >
                  <Send className="ico" />
                  <span>{submitMutation.isPending ? 'Submitting...' : 'Send for Approval'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                  className="btn cm-sec magnetic"
                >
                  {saveDraftMutation.isPending ? 'Saving...' : 'Save draft'}
                </button>
              </>
            )}
          </div>

          <div className="cm-bar__why">
            {!caption && mediaUrls.length === 0
              ? '1 thing to fix before it can go'
              : publishMode === 'MANUAL'
              ? 'Ready to schedule as manual reminder'
              : blockingErrors.length > 0
              ? `${blockingErrors.length} issue to fix before it can go`
              : 'Ready to schedule'}
          </div>
        </section>

        {/* Drafts Waiting Card (.cm-drafts) */}
        <section className="cm-drafts card">
          <div className="card__head">
            <h3 className="card__title">Your drafts</h3>
          </div>

          {drafts.length === 0 ? (
            <div className="cm-dl__empty">
              <div className="empty">
                <FileText className="ico" />
                <div className="empty__title">No drafts waiting</div>
                <p className="empty__text">
                  Save a post as a draft and it waits here. Posts sent back to you with changes land here too.
                </p>
              </div>
            </div>
          ) : (
            <div className="cm-dl">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="cm-dr-li"
                  onClick={() => {
                    setCurrentPostId(d.id);
                    setCaption(d.caption || '');
                    if (d.firstComment) setFirstComment(d.firstComment);
                    if (d.mediaUrls) setMediaUrls(d.mediaUrls);
                    if (d.scheduledAt) setScheduledDate(new Date(d.scheduledAt).toISOString().slice(0, 16));
                    if (d.targets?.length) {
                      setSelectedChannelIds(d.targets.map((t: any) => t.channelId));
                    }
                    if (d.publishMode) {
                      setPublishMode(d.publishMode);
                    }
                    addToast({ type: 'info', message: 'Loaded draft into editor' });
                  }}
                >
                  <div
                    className="cm-dr"
                    data-state={d.status === 'CHANGES' ? 'changes' : 'pending'}
                  >
                    <div className="cm-dr__b">
                      <b>{d.caption || 'Untitled draft'}</b>
                      <small>
                        {d.scheduledAt ? new Date(d.scheduledAt).toLocaleDateString() : 'Unscheduled'}
                      </small>
                    </div>
                    <ArrowRight className="ico" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ManualPublishModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        post={{
          id: currentPostId || 'preview-post',
          caption,
          firstComment,
          mediaUrls,
          scheduledAt: scheduledDate,
          brand: activeBrand,
          channels: displayChannels.filter((c) => selectedChannelIds.includes(c.id)),
        }}
        onPublished={() => {
          handleResetPost();
          navigate('/overview');
        }}
      />
    </div>
  );
}

function formatScheduledTime(dStr: string) {
  const d = new Date(dStr);
  const isTomorrow = Math.abs(d.getDate() - new Date().getDate()) === 1;
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${isTomorrow ? 'TOMORROW' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} · ${timeStr}`;
}
