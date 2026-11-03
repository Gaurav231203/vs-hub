import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiAccessToken } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { matchesBrand, getBrandCanonicalSlug } from '../../lib/brandHelper.js';

interface BrandMeta {
  id: string;
  name: string;
  short: string;
  tone: 'coral' | 'butter' | 'ink' | 'pine' | 'sea';
  monogram: string;
}

const BRAND_METAS: Record<string, BrandMeta> = {
  starlight: { id: 'starlight', name: 'Starlight Bakery', short: 'Starlight', tone: 'coral', monogram: 'SB' },
  hollow: { id: 'hollow', name: 'Hollow Home', short: 'Hollow', tone: 'butter', monogram: 'HH' },
  vantage: { id: 'vantage', name: 'Vantage Garage', short: 'Vantage', tone: 'ink', monogram: 'VG' },
  acme: { id: 'acme', name: 'Acme Corp', short: 'Acme', tone: 'sea', monogram: 'AC' },
  nexus: { id: 'nexus', name: 'Nexus Tech', short: 'Nexus', tone: 'sea', monogram: 'NT' },
  zenith: { id: 'zenith', name: 'Zenith Fitness', short: 'Zenith', tone: 'pine', monogram: 'ZF' },
  ember: { id: 'ember', name: 'Ember & Oak', short: 'Ember', tone: 'coral', monogram: 'EO' },
  wild: { id: 'wild', name: 'Wildroot Botanics', short: 'Wildroot', tone: 'pine', monogram: 'WB' },
  north: { id: 'north', name: 'Northlight Studio', short: 'Northlight', tone: 'sea', monogram: 'NS' },
};

interface LibraryPhoto {
  id: string;
  brandId: string;
  title: string;
  tags: string[];
  w: number;
  h: number;
  src: string;
  starred: boolean;
  usedCount: number;
  addedAgo: string;
  authorName: string;
  custom?: boolean;
  posts?: Array<{
    id: string;
    caption: string;
    status: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    createdAt?: string;
  }>;
}

interface PostReference {
  id: string;
  brandId: string;
  text: string;
  at: string;
  networks: string[];
  status: 'published' | 'scheduled' | 'pending';
}

const INITIAL_PHOTOS: LibraryPhoto[] = [
  // Starlight Bakery (6)
  { id: 'sb-croissant', brandId: 'starlight', title: 'Flaky butter croissant', tags: ['pastry', 'bakery'], w: 720, h: 900, src: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=900&auto=format&fit=crop&q=80', starred: true, usedCount: 5, addedAgo: '2 days ago', authorName: 'Sophia' },
  { id: 'sb-sourdough', brandId: 'starlight', title: 'Country sourdough loaf', tags: ['sourdough', 'bread'], w: 900, h: 675, src: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=900&auto=format&fit=crop&q=80', starred: false, usedCount: 3, addedAgo: '4 days ago', authorName: 'Devon' },
  { id: 'sb-tart', brandId: 'starlight', title: 'Seasonal fruit tart', tags: ['pastry', 'dessert'], w: 720, h: 900, src: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=900&auto=format&fit=crop&q=80', starred: false, usedCount: 2, addedAgo: '1 week ago', authorName: 'Sophia' },
  { id: 'sb-baguette', brandId: 'starlight', title: 'Fresh warm baguettes', tags: ['bread', 'morning'], w: 900, h: 600, src: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&auto=format&fit=crop&q=80', starred: true, usedCount: 4, addedAgo: '1 week ago', authorName: 'Devon' },
  { id: 'sb-cinnamon', brandId: 'starlight', title: 'Cardamom morning buns', tags: ['pastry', 'morning'], w: 720, h: 900, src: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=900&auto=format&fit=crop&q=80', starred: false, usedCount: 3, addedAgo: '2 weeks ago', authorName: 'Sophia' },
  { id: 'sb-flour', brandId: 'starlight', title: 'Dough kneading by hand', tags: ['process', 'behind the scenes'], w: 900, h: 600, src: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=900&auto=format&fit=crop&q=80', starred: false, usedCount: 1, addedAgo: '3 weeks ago', authorName: 'Devon' },

  // Hollow Home (7)
  { id: 'hollow-room', brandId: 'hollow', title: 'Reading corner', tags: ['interior', 'chair'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/hollow-room-sm.jpg', starred: false, usedCount: 2, addedAgo: '3 weeks ago', authorName: 'Haruto' },
  { id: 'hollow-chair', brandId: 'hollow', title: 'Bouclé lounge chair', tags: ['product', 'chair'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/hollow-chair-sm.jpg', starred: true, usedCount: 3, addedAgo: '1 month ago', authorName: 'Peter' },
  { id: 'hollow-lamp', brandId: 'hollow', title: 'Pleat table lamp', tags: ['product', 'lighting'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/hollow-lamp-sm.jpg', starred: false, usedCount: 1, addedAgo: '2 months ago', authorName: 'Haruto' },
  { id: 'hollow-throw', brandId: 'hollow', title: 'Wool throw', tags: ['product', 'textiles'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/hollow-throw-sm.jpg', starred: false, usedCount: 2, addedAgo: '2 weeks ago', authorName: 'Peter' },
  { id: 'hollow-sofa', brandId: 'hollow', title: 'Friends on the Låg sofa', tags: ['lifestyle', 'sofa'], w: 900, h: 600, src: '/murmura/photos/murmura/posts/hollow-sofa-sm.jpg', starred: false, usedCount: 2, addedAgo: '1 month ago', authorName: 'Freya' },
  { id: 'hollow-detail', brandId: 'hollow', title: 'Oak side table', tags: ['product', 'detail'], w: 900, h: 900, src: '/murmura/photos/murmura/posts/hollow-detail-sm.jpg', starred: false, usedCount: 3, addedAgo: '5 days ago', authorName: 'Haruto' },
  { id: 'hollow-living', brandId: 'hollow', title: 'Living room, full set', tags: ['interior', 'campaign'], w: 900, h: 600, src: '/murmura/photos/murmura/posts/hollow-living-sm.jpg', starred: false, usedCount: 2, addedAgo: '3 weeks ago', authorName: 'Peter' },

  // Vantage Garage (6)
  { id: 'vantage-gauge', brandId: 'vantage', title: 'Redline', tags: ['detail', 'night'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/vantage-gauge-sm.jpg', starred: true, usedCount: 3, addedAgo: '10 days ago', authorName: 'Omar' },
  { id: 'vantage-wheel', brandId: 'vantage', title: 'Fresh ceramic coat', tags: ['wheels', 'detail'], w: 900, h: 675, src: '/murmura/photos/murmura/posts/vantage-wheel-sm.jpg', starred: false, usedCount: 2, addedAgo: '2 weeks ago', authorName: 'Kwame' },
  { id: 'vantage-night', brandId: 'vantage', title: 'Parking deck reveal', tags: ['reveal', 'night'], w: 900, h: 675, src: '/murmura/photos/murmura/posts/vantage-night-sm.jpg', starred: false, usedCount: 2, addedAgo: '1 month ago', authorName: 'Omar' },
  { id: 'vantage-lift', brandId: 'vantage', title: 'Wheel balancing', tags: ['workshop', 'wheels'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/vantage-lift-sm.jpg', starred: false, usedCount: 2, addedAgo: '3 weeks ago', authorName: 'Kwame' },
  { id: 'vantage-drive', brandId: 'vantage', title: 'Delivery drive', tags: ['customer', 'drive'], w: 720, h: 900, src: '/murmura/photos/murmura/posts/vantage-drive-sm.jpg', starred: false, usedCount: 1, addedAgo: '1 month ago', authorName: 'Omar' },
  { id: 'vantage-engine', brandId: 'vantage', title: 'Engine bay detail', tags: ['workshop', 'engine'], w: 900, h: 675, src: '/murmura/photos/murmura/posts/vantage-engine-sm.jpg', starred: false, usedCount: 2, addedAgo: '2 weeks ago', authorName: 'Omar' },

  // Ember & Oak (5)
  { id: 'ember-shot', brandId: 'ember', title: 'Espresso pull', tags: ['espresso', 'process'], w: 725, h: 900, src: '/murmura/photos/murmura/posts/ember-shot-sm.jpg', starred: false, usedCount: 4, addedAgo: '4 days ago', authorName: 'Nia' },
  { id: 'ember-pour', brandId: 'ember', title: 'Milk pour', tags: ['latte', 'process'], w: 725, h: 900, src: '/murmura/photos/murmura/posts/ember-pour-sm.jpg', starred: false, usedCount: 7, addedAgo: '1 week ago', authorName: 'Elise' },
  { id: 'ember-latte', brandId: 'ember', title: 'Latte art, close', tags: ['latte', 'cafe'], w: 900, h: 603, src: '/murmura/photos/murmura/posts/ember-latte-sm.jpg', starred: false, usedCount: 2, addedAgo: '2 weeks ago', authorName: 'Nia' },
  { id: 'ember-roastery', brandId: 'ember', title: 'The roastery', tags: ['roastery', 'behind the scenes'], w: 900, h: 502, src: '/murmura/photos/murmura/posts/ember-roastery-sm.jpg', starred: false, usedCount: 1, addedAgo: '1 month ago', authorName: 'Elise' },
  { id: 'ember-weigh', brandId: 'ember', title: 'Weighing the dose', tags: ['process', 'beans'], w: 725, h: 900, src: '/murmura/photos/murmura/posts/ember-weigh-sm.jpg', starred: false, usedCount: 2, addedAgo: '3 weeks ago', authorName: 'Nia' },

  // Wildroot Botanics (7)
  { id: 'wild-golden', brandId: 'wild', title: 'Golden hour dropper', tags: ['product', 'campaign'], w: 599, h: 900, src: '/murmura/photos/murmura/posts/wild-golden-sm.jpg', starred: true, usedCount: 4, addedAgo: '6 days ago', authorName: 'Camila' },
  { id: 'wild-daisy', brandId: 'wild', title: 'Daisy bath', tags: ['ritual', 'flowers'], w: 900, h: 599, src: '/murmura/photos/murmura/posts/wild-daisy-sm.jpg', starred: false, usedCount: 2, addedAgo: '2 weeks ago', authorName: 'Elise' },
  { id: 'wild-dried', brandId: 'wild', title: 'Dried botanicals', tags: ['ingredients', 'flatlay'], w: 600, h: 900, src: '/murmura/photos/murmura/posts/wild-dried-sm.jpg', starred: false, usedCount: 3, addedAgo: '3 weeks ago', authorName: 'Nia' },
  { id: 'wild-dropper', brandId: 'wild', title: 'Facial oil drop', tags: ['product', 'oil'], w: 900, h: 599, src: '/murmura/photos/murmura/posts/wild-dropper-sm.jpg', starred: false, usedCount: 2, addedAgo: '1 month ago', authorName: 'Camila' },
  { id: 'wild-petals', brandId: 'wild', title: 'Rose petals', tags: ['ingredients'], w: 600, h: 900, src: '/murmura/photos/murmura/posts/wild-petals-sm.jpg', starred: false, usedCount: 3, addedAgo: '2 weeks ago', authorName: 'Elise' },
  { id: 'wild-bloom', brandId: 'wild', title: 'Rose & jasmine', tags: ['ingredients', 'flowers'], w: 671, h: 900, src: '/murmura/photos/murmura/posts/wild-bloom-sm.jpg', starred: false, usedCount: 2, addedAgo: '1 month ago', authorName: 'Nia' },
  { id: 'wild-vials', brandId: 'wild', title: 'Tincture vials', tags: ['product', 'lab'], w: 900, h: 596, src: '/murmura/photos/murmura/posts/wild-vials-sm.jpg', starred: false, usedCount: 1, addedAgo: '2 months ago', authorName: 'Camila' },
];

const SAMPLE_POST_REFERENCES: Record<string, PostReference[]> = {
  'hollow-room': [
    { id: 'p10', brandId: 'hollow', text: 'Three ways to style a reading corner with one chair and one good lamp.', at: 'Thu 14:00', networks: ['instagram', 'pinterest'], status: 'published' },
    { id: 'p11', brandId: 'hollow', text: 'Pinterest board idea: "one room, four seasons"', at: 'Next Wed 10:00', networks: ['pinterest'], status: 'scheduled' },
  ],
  'vantage-gauge': [
    { id: 'p20', brandId: 'vantage', text: 'Night reveal. Same car, 31 hours later.', at: 'Fri 19:30', networks: ['instagram', 'tiktok', 'youtube'], status: 'published' },
    { id: 'p21', brandId: 'vantage', text: 'Two-stage correction + 9H ceramic on this GT. Swipe for the 50/50.', at: 'Yesterday', networks: ['instagram'], status: 'published' },
    { id: 'p22', brandId: 'vantage', text: 'Delivery day. The drive home is the best part of the job.', at: 'In 3 days', networks: ['tiktok'], status: 'scheduled' },
  ],
  'ember-shot': [
    { id: 'p30', brandId: 'ember', text: 'Pumpkin spice? Never heard of her. Our autumn menu is maple, cardamom and cortado.', at: 'Mon 09:00', networks: ['instagram', 'threads'], status: 'pending' },
    { id: 'p31', brandId: 'ember', text: 'Behind the drum: our head roaster Ada on why we never rush the first crack.', at: 'Last Tue', networks: ['instagram', 'facebook'], status: 'published' },
    { id: 'p32', brandId: 'ember', text: 'Your dose matters more than your grinder. Here is how we weigh every shot.', at: '3 days ago', networks: ['instagram'], status: 'published' },
    { id: 'p33', brandId: 'ember', text: 'Saturday cupping at the roastery, 10am. Free, bring a friend.', at: 'Next Sat', networks: ['facebook', 'instagram'], status: 'scheduled' },
  ],
  'ember-pour': [
    { id: 'p40', brandId: 'ember', text: 'Home brewing 101, part three: why your pour-over tastes sour, grind change that fixes it.', at: 'Wed 18:00', networks: ['instagram', 'facebook'], status: 'pending' },
    { id: 'p41', brandId: 'ember', text: 'Slow mornings start with a slow pour. 18g in, 300g out.', at: 'Last Sun', networks: ['instagram', 'tiktok'], status: 'published' },
    { id: 'p42', brandId: 'ember', text: 'Latte art Friday. Tag us in your best tulip and we will share our favorites.', at: '2 weeks ago', networks: ['instagram'], status: 'published' },
    { id: 'p43', brandId: 'ember', text: 'The Oak blend is back for autumn — chocolate, toasted hazelnut.', at: 'Oct 14', networks: ['facebook', 'threads'], status: 'published' },
  ],
  'wild-golden': [
    { id: 'p50', brandId: 'wild', text: 'Our spring campaign, shot on the coast at Ericeira. Meet Inês.', at: 'Fri 11:00', networks: ['instagram', 'tiktok'], status: 'published' },
    { id: 'p51', brandId: 'wild', text: 'A three-step night routine for tired skin: cleanse, three drops of Bloom.', at: 'Tomorrow 20:00', networks: ['instagram', 'threads'], status: 'pending' },
    { id: 'p52', brandId: 'wild', text: 'Every bottle of Bloom oil holds 212 petals. We counted.', at: 'Last week', networks: ['instagram', 'pinterest'], status: 'published' },
    { id: 'p53', brandId: 'wild', text: 'Giveaway 🌼 Win the full Spring Ritual set — follow, like, tag a friend.', at: 'Oct 18', networks: ['instagram', 'tiktok'], status: 'published' },
  ],
};

interface TemplateItem {
  id: string;
  brandId: string | null;
  name: string;
  text: string;
}

const INITIAL_TEMPLATES: TemplateItem[] = [
  {
    id: 't1',
    brandId: null,
    name: 'Launch countdown',
    text: 'In {days} days: {product}. Turn on notifications so you’re first in line.',
  },
  {
    id: 't2',
    brandId: null,
    name: 'Giveaway rules',
    text: 'GIVEAWAY 🎁 Win {prize}.\n\nHow to enter:\n1. Follow us\n2. Like this post\n3. Tag {friend_count} friends in the comments\n\nWinner picked on {date}. Good luck!',
  },
  {
    id: 't3',
    brandId: 'ember',
    name: 'Weekly roast spotlight',
    text: 'Behind the roast this week: {origin} {process}. Tasting notes: {notes}. Bags ship {day} ☕',
  },
  {
    id: 't4',
    brandId: 'hollow',
    name: 'Room styling notes',
    text: 'Styling {room} around one key piece: the {piece}. Keep the palette to {colors} and add {texture} for depth.',
  },
  {
    id: 't5',
    brandId: 'vantage',
    name: 'Ceramic package slots',
    text: 'Slots open for {month}: full paint correction and {coating} on {slots} cars only. Link in bio to book.',
  },
  {
    id: 't6',
    brandId: 'wild',
    name: 'Evening ritual steps',
    text: 'Evening ritual: {step_1}, then three drops of {product}, then {step_3}. Wake up with hydrated, calm skin.',
  },
];

interface HashtagSetItem {
  id: string;
  brandId: string;
  name: string;
  tags: string[];
}

const INITIAL_HASHTAGS: HashtagSetItem[] = [
  {
    id: 'h0',
    brandId: 'starlight',
    name: 'Artisan bakery',
    tags: ['#artisanbakery', '#sourdough', '#croissant', '#frenchpastry', '#organicbaking', '#bakerlife', '#morningpastry'],
  },
  {
    id: 'h1',
    brandId: 'ember',
    name: 'Coffee core',
    tags: ['#specialtycoffee', '#slowcoffee', '#portlandcoffee', '#pourover', '#coffeeroasters', '#baristadaily', '#singleorigin'],
  },
  {
    id: 'h2',
    brandId: 'hollow',
    name: 'Interiors',
    tags: ['#scandihome', '#interiordesign', '#slowliving', '#boucle', '#danishdesign', '#nordichome', '#interiorstyling'],
  },
  {
    id: 'h3',
    brandId: 'vantage',
    name: 'Detailing',
    tags: ['#ceramiccoating', '#paintcorrection', '#detailing', '#carsofinstagram', '#austincars', '#paintprotection', '#supercars'],
  },
  {
    id: 'h4',
    brandId: 'wild',
    name: 'Skin rituals',
    tags: ['#cleanbeauty', '#botanicalskincare', '#facialoil', '#selfcareritual', '#lisbon', '#organicskincare', '#glowingskin'],
  },
];

interface SavedReplyItem {
  id: string;
  title: string;
  text: string;
}

const INITIAL_REPLIES: SavedReplyItem[] = [
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
  {
    id: 'r4',
    title: 'Booking',
    text: 'We’d love to have you in. You can pick a slot here: link in bio, or reply with your preferred week.',
  },
  {
    id: 'r5',
    title: 'Sensitive skin',
    text: 'Bloom is fragrance-free and patch-tested, but we always suggest a small test on your wrist first.',
  },
];

export function LibraryView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, brands } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const outletCtx = useOutletContext<{ selectedBrandId?: string; setSelectedBrandId?: (id: string) => void }>() || {};

  // Active Shelf Tab
  const [activeTab, setActiveTab] = useState<'media' | 'templates' | 'hashtags' | 'replies'>('media');

  // Filters State
  const [selectedBrand, setSelectedBrand] = useState<string>(outletCtx.selectedBrandId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [onlyStarred, setOnlyStarred] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'new' | 'used'>('new');

  // Multi-Selection State
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // Data Store
  const [photos, setPhotos] = useState<LibraryPhoto[]>(INITIAL_PHOTOS);

  // Fetch real assets from backend
  const { data: serverAssetsData, refetch: refetchAssets } = useQuery({
    queryKey: ['library-assets', selectedBrand],
    queryFn: () => {
      const qs = selectedBrand && selectedBrand !== 'all' ? `?brandId=${selectedBrand}` : '';
      return apiFetch(`/library/assets${qs}`).catch(() => null);
    },
  });

  useEffect(() => {
    if (serverAssetsData?.items && Array.isArray(serverAssetsData.items)) {
      const serverPhotos: LibraryPhoto[] = serverAssetsData.items.map((item: any) => ({
        id: item.id,
        brandId: item.brandId || item.brand?.id || 'hollow',
        title: item.title,
        tags: Array.isArray(item.tags) ? item.tags : ['product'],
        w: item.width || 800,
        h: item.height || 1000,
        src: item.url,
        starred: item.starred || false,
        usedCount: item.usageCount || 0,
        addedAgo: 'Uploaded',
        authorName: 'Agency',
        custom: true,
        posts: item.posts || [],
      }));

      setPhotos((prev) => {
        const serverIds = new Set(serverPhotos.map((sp) => sp.id));
        const nonServerPrev = prev.filter((p) => !serverIds.has(p.id));
        return [...serverPhotos, ...nonServerPrev];
      });
    }
  }, [serverAssetsData]);
  const [templates, setTemplates] = useState<TemplateItem[]>(INITIAL_TEMPLATES);
  const [hashtagSets, setHashtagSets] = useState<HashtagSetItem[]>(INITIAL_HASHTAGS);
  const [replies, setReplies] = useState<SavedReplyItem[]>(INITIAL_REPLIES);

  // Detail Drawer State
  const [drawerPhoto, setDrawerPhoto] = useState<LibraryPhoto | null>(null);

  // Modals for Adding New Items
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);

  const [showHashtagModal, setShowHashtagModal] = useState<boolean>(false);
  const [editingHashtag, setEditingHashtag] = useState<HashtagSetItem | null>(null);

  const [showReplyModal, setShowReplyModal] = useState<boolean>(false);
  const [editingReply, setEditingReply] = useState<SavedReplyItem | null>(null);

  // Drag & Drop / Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);

  // Dynamic Masonry Spans
  const masonryRef = useRef<HTMLDivElement>(null);
  const [spans, setSpans] = useState<Record<string, number>>({});

  // Sync with global outlet selectedBrandId if it changes from outside
  useEffect(() => {
    if (outletCtx.selectedBrandId && outletCtx.selectedBrandId !== selectedBrand) {
      setSelectedBrand(outletCtx.selectedBrandId);
    }
  }, [outletCtx.selectedBrandId]);

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrand(brandId);
    if (outletCtx.setSelectedBrandId) {
      outletCtx.setSelectedBrandId(brandId);
    }
  };

  // Toggle photo star
  const handleToggleStar = (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === photoId) {
          const next = !p.starred;
          addToast({
            type: 'info',
            message: next ? `Starred "${p.title}"` : `Unstarred "${p.title}"`,
          });
          return { ...p, starred: next };
        }
        return p;
      })
    );
    if (drawerPhoto && drawerPhoto.id === photoId) {
      setDrawerPhoto((cur) => (cur ? { ...cur, starred: !cur.starred } : null));
    }
  };

  // Toggle photo selection
  const handleToggleCardSelect = (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  // Click card action
  const handleCardClick = (photo: LibraryPhoto) => {
    if (isSelecting) {
      handleToggleCardSelect(photo.id);
    } else {
      setDrawerPhoto(photo);
    }
  };

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Brand filter
      if (selectedBrand !== 'all' && !matchesBrand(photo.brandId, selectedBrand, brands)) {
        return false;
      }
      // Starred filter
      if (onlyStarred && !photo.starred) {
        return false;
      }
      // Tag filter
      if (selectedTags.size > 0) {
        const matchesAnyTag = photo.tags.some((t) => selectedTags.has(t));
        if (!matchesAnyTag) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const brandName = BRAND_METAS[photo.brandId]?.name?.toLowerCase() || '';
        const haystack = `${photo.title} ${photo.tags.join(' ')} ${brandName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'used') {
        return b.usedCount - a.usedCount;
      }
      // Default: keep natural display order
      return 0;
    });
  }, [photos, selectedBrand, onlyStarred, selectedTags, searchQuery, sortBy]);

  // Compute tag counts across photos that match current brand/star filter
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    photos
      .filter((p) => {
        if (selectedBrand !== 'all' && !matchesBrand(p.brandId, selectedBrand, brands)) return false;
        if (onlyStarred && !p.starred) return false;
        return true;
      })
      .forEach((p) => {
        p.tags.forEach((t) => {
          counts.set(t, (counts.get(t) || 0) + 1);
        });
      });

    // Sort by count descending
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 16);
  }, [photos, selectedBrand, onlyStarred]);

  // Calculate dynamic Pinterest masonry grid spans
  const calculateSpans = useCallback(() => {
    const container = masonryRef.current;
    if (!container || !container.offsetWidth) return;
    const computedCols = getComputedStyle(container).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const colGap = 14;
    const rowHeight = 4;
    const colWidth = (container.clientWidth - (computedCols - 1) * colGap) / computedCols;

    const getSpan = (ar: number) => Math.max(8, Math.ceil((colWidth * ar + colGap) / rowHeight));

    const nextSpans: Record<string, number> = {};
    const dropAr = Math.min(1.05, Math.max(0.62, 240 / colWidth));
    nextSpans['__drop__'] = getSpan(dropAr);

    filteredPhotos.forEach((photo) => {
      const ar = photo.h / photo.w;
      nextSpans[photo.id] = getSpan(ar);
    });

    setSpans(nextSpans);
  }, [filteredPhotos]);

  useEffect(() => {
    calculateSpans();
    const ro = new ResizeObserver(() => calculateSpans());
    if (masonryRef.current) ro.observe(masonryRef.current);
    window.addEventListener('resize', calculateSpans);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calculateSpans);
    };
  }, [calculateSpans]);

  // Handle Real Photo Upload to Backend Storage
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!fileList.length) {
      addToast({ type: 'info', message: 'Only image files (JPG, PNG, WebP) can be added.' });
      return;
    }

    const first = fileList[0];
    const cleanTitle = first.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
    
    // Resolve target brand
    let targetBrandId = selectedBrand !== 'all' ? selectedBrand : brands[0]?.id || 'b_hh';
    const matchedBrand = brands.find((b) => b.id === targetBrandId || b.id.toLowerCase() === targetBrandId.toLowerCase());
    if (matchedBrand) targetBrandId = matchedBrand.id;
    else if (brands.length > 0) targetBrandId = brands[0].id;

    setUploadingName(first.name);
    setUploadPercent(20);

    try {
      // 1. Get presigned upload URL
      setUploadPercent(40);
      const uploadMeta = await apiFetch('/library/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          brandId: targetBrandId,
          filename: first.name,
          contentType: first.type || 'image/jpeg',
          byteSize: first.size,
        }),
      });

      // 2. Direct PUT upload to storage
      setUploadPercent(70);
      const token = getApiAccessToken();
      const uploadHeaders: Record<string, string> = {
        'Content-Type': first.type || 'image/jpeg',
      };
      if (token) {
        uploadHeaders['Authorization'] = `Bearer ${token}`;
      }
      const uploadRes = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        body: first,
        headers: uploadHeaders,
        credentials: 'include',
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        throw new Error(`Direct upload failed with status ${uploadRes.status}: ${errText}`);
      }

      setUploadPercent(90);

      // 3. Confirm upload and create DB record
      const asset = await apiFetch('/library/confirm-upload', {
        method: 'POST',
        body: JSON.stringify({
          brandId: targetBrandId,
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          kind: 'IMAGE',
          publicUrl: uploadMeta.publicUrl,
          key: uploadMeta.key,
          byteSize: first.size,
          contentType: first.type || 'image/jpeg',
        }),
      });

      setUploadPercent(100);
      addToast({ type: 'success', message: `Added "${asset.title}" to library.` });
      refetchAssets();
    } catch (err: any) {
      console.warn('Backend upload fallback:', err.message);
      const previewUrl = URL.createObjectURL(first);
      const newPhoto: LibraryPhoto = {
        id: `upload-${Date.now()}`,
        brandId: targetBrandId,
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        tags: ['product'],
        w: 800,
        h: 1000,
        src: previewUrl,
        starred: false,
        usedCount: 0,
        addedAgo: 'Just now',
        authorName: 'You',
        custom: true,
      };
      setPhotos((prev) => [newPhoto, ...prev]);
      addToast({ type: 'success', message: `Added "${newPhoto.title}" to library.` });
    } finally {
      setTimeout(() => {
        setUploadingName(null);
        setUploadPercent(0);
      }, 300);
    }
  };

  const handleUseInPost = (photoUrls: string[]) => {
    navigate('/compose', { state: { media: photoUrls, brandId: selectedBrand !== 'all' ? selectedBrand : undefined } });
  };

  const totalPhotosCount = photos.length;
  const inUseCount = photos.filter((p) => p.usedCount > 0).length;
  const kitsCount = templates.length + hashtagSets.length + replies.length;

  return (
    <div data-view="library" className="view" style={{ minWidth: 0 }}>
      {/* 1. Header with Stats Strip & Actions */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Library</h1>
        </div>

        <div className="head__stats">
          {/* Stat 1: Photos in library */}
          <div className="stat" data-stat="media">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{totalPhotosCount}</b>
              </span>
              <span className="stat__label">Photos in the library</span>
            </div>
          </div>

          {/* Stat 2: In use across posts */}
          <div className="stat" data-stat="used">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m12 2 10 5-10 5L2 7l10-5Z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{inUseCount}</b>
              </span>
              <span className="stat__label">In use across posts</span>
            </div>
          </div>

          {/* Stat 3: Templates, sets & replies */}
          <div className="stat" data-stat="kits">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{kitsCount}</b>
              </span>
              <span className="stat__label">Templates, sets &amp; replies</span>
            </div>
          </div>
        </div>

        <div className="head__actions">
          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
        </div>
      </header>

      {/* 2. Shelves Segmented Tabs Bar */}
      <div className="toolbar lb-tabsbar">
        <div className="seg">
          <button
            type="button"
            className="seg__btn"
            aria-pressed={activeTab === 'media'}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-pressed={activeTab === 'templates'}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-pressed={activeTab === 'hashtags'}
            onClick={() => setActiveTab('hashtags')}
          >
            Hashtag sets
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-pressed={activeTab === 'replies'}
            onClick={() => setActiveTab('replies')}
          >
            Saved replies
          </button>
        </div>
      </div>

      {/* TAB 1: MEDIA (PINTEREST MASONRY LIBRARY) */}
      {activeTab === 'media' && (
        <div className="lb-pane" data-pane="media">
          {/* Filter Bar Row 1 */}
          <div className="toolbar lb-bar">
            {/* Search Pill */}
            <label className="search lb-search">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search titles and tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </label>

            {/* Brand Filter Chips */}
            <div className="lb-chips hfade" role="group" aria-label="Filter by brand">
              <button
                type="button"
                className="chip lb-bchip"
                aria-pressed={selectedBrand === 'all'}
                onClick={() => handleBrandSelect('all')}
              >
                All
              </button>
              {Object.values(BRAND_METAS).map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  className="chip lb-bchip"
                  aria-pressed={selectedBrand === bm.id || (selectedBrand !== 'all' && matchesBrand(bm.id, selectedBrand, brands))}
                  onClick={() => handleBrandSelect(bm.id)}
                  title={bm.name}
                >
                  <span className={`bmark bmark--xs tone--${bm.tone}`}>{bm.monogram}</span>
                  <span>{bm.short}</span>
                </button>
              ))}
            </div>

            <span className="toolbar__spacer" />

            {/* Right Controls: Starred, Sort, Select */}
            <div className="lb-opts">
              <button
                type="button"
                className="chip lb-star-f"
                aria-pressed={onlyStarred}
                onClick={() => setOnlyStarred((prev) => !prev)}
              >
                <svg className="ico" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Starred
              </button>

              <div className="lb-sort">
                <div className="seg">
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={sortBy === 'new'}
                    onClick={() => setSortBy('new')}
                  >
                    Newest
                  </button>
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={sortBy === 'used'}
                    onClick={() => setSortBy('used')}
                  >
                    Most used
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="chip lb-selbtn"
                aria-pressed={isSelecting}
                onClick={() => {
                  const next = !isSelecting;
                  setIsSelecting(next);
                  if (!next) setSelectedPhotos(new Set());
                }}
              >
                <svg className="ico" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Select
              </button>
            </div>
          </div>

          {/* Tags Filter Row */}
          <div className="lb-tags hfade" role="group" aria-label="Filter by tag">
            <span className="lb-tags__lab">
              <svg className="ico" viewBox="0 0 24 24">
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              Tags
            </span>
            {tagCounts.map(([tag, count]) => {
              const isActive = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className="chip lb-tag"
                  aria-pressed={isActive}
                  onClick={() => {
                    setSelectedTags((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag)) next.delete(tag);
                      else next.add(tag);
                      return next;
                    });
                  }}
                >
                  <span>{tag}</span>
                  <small className="tnum">{count}</small>
                </button>
              );
            })}
          </div>

          {/* Pinterest Masonry Table */}
          <div
            className={`lb-table ${isSelecting ? 'is-selecting' : ''} ${isDragOver ? 'is-drag' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragOver(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer?.files?.length) {
                handleUploadFiles(e.dataTransfer.files);
              }
            }}
          >
            <div className="lb-masonry" ref={masonryRef}>
              {/* Dropzone Card (1st Item) */}
              <div
                className="lb-drop"
                style={{ gridRowEnd: `span ${spans['__drop__'] || 36}` }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr"
                  tabIndex={-1}
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleUploadFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  className="lb-drop__btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="lb-drop__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </span>
                  <b>Drop photos here</b>
                  <small>
                    or <u>browse</u> · JPG, PNG, WebP
                  </small>
                </button>
              </div>

              {/* Uploading Progress Ring Card (if uploading) */}
              {uploadingName && (
                <figure
                  className="lb-item lb-up"
                  style={{ gridRowEnd: 'span 38' }}
                >
                  <div className="lb-up__card">
                    <svg className="lb-up__ring" viewBox="0 0 52 52" aria-hidden="true">
                      <circle cx="26" cy="26" r="22" className="lb-up__track" />
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        className="lb-up__arc"
                        strokeDasharray={2 * Math.PI * 22}
                        strokeDashoffset={2 * Math.PI * 22 * (1 - uploadPercent / 100)}
                      />
                    </svg>
                    <b className="lb-up__pct tnum">{uploadPercent}%</b>
                    <small className="lb-up__name">{uploadingName}</small>
                  </div>
                </figure>
              )}

              {/* Authentic Photo Cards */}
              {filteredPhotos.map((photo) => {
                const bm = BRAND_METAS[photo.brandId] || BRAND_METAS.hollow;
                const isSelected = selectedPhotos.has(photo.id);
                const spanRows = spans[photo.id] || Math.max(14, Math.ceil((220 * (photo.h / photo.w) + 14) / 4));

                return (
                  <figure
                    key={photo.id}
                    className={`lb-item ${isSelected ? 'is-sel' : ''}`}
                    data-key={photo.id}
                    data-ar={photo.h / photo.w}
                    style={{ gridRowEnd: `span ${spanRows}` }}
                  >
                    <div className="lb-card" data-lift>
                      {/* Image Click to Open / Select */}
                      <button
                        type="button"
                        className="lb-card__open"
                        onClick={() => handleCardClick(photo)}
                        aria-label={`${photo.title}, used in ${photo.usedCount} posts`}
                      >
                        <img
                          src={photo.src}
                          width={photo.w}
                          height={photo.h}
                          alt={photo.title}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/bakery.jpg';
                          }}
                        />
                      </button>

                      {/* Brand Badge Top-Left */}
                      <span className="lb-card__brand">
                        <span className={`bmark bmark--xs tone--${bm.tone}`} title={bm.name}>
                          {bm.monogram}
                        </span>
                      </span>

                      {/* Star Button Top-Right */}
                      <button
                        type="button"
                        className="lb-card__star"
                        aria-pressed={photo.starred}
                        onClick={(e) => handleToggleStar(photo.id, e)}
                        aria-label={`${photo.starred ? 'Unstar' : 'Star'} ${photo.title}`}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>

                      {/* Select Checkmark Bottom-Right */}
                      <span
                        className="lb-card__check"
                        onClick={(e) => handleToggleCardSelect(photo.id, e)}
                        aria-hidden="true"
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>

                      {/* Dark Gradient Caption Bottom */}
                      <span className="lb-card__cap">
                        <b>{photo.title}</b>
                        <small>{photo.usedCount > 0 ? `Used in ${photo.usedCount}` : 'Not used yet'}</small>
                      </span>
                    </div>
                  </figure>
                );
              })}
            </div>

            {/* Empty state when filters return 0 results */}
            {filteredPhotos.length === 0 && (
              <div className="lb-mempty">
                <div className="empty">
                  <svg className="ico" viewBox="0 0 24 24">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <h3 className="empty__title">No photos match</h3>
                  <p className="empty__text">
                    Nothing in the library fits these filters. Loosen them, or search for something else.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setSelectedBrand('all');
                      if (outletCtx.setSelectedBrandId) outletCtx.setSelectedBrandId('all');
                      setSearchQuery('');
                      setSelectedTags(new Set());
                      setOnlyStarred(false);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Multi-Selection Bar */}
          <div
            className="lb-selbar"
            style={{
              visibility: isSelecting && selectedPhotos.size > 0 ? 'visible' : 'hidden',
              transform: isSelecting && selectedPhotos.size > 0 ? 'translateY(0)' : 'translateY(160%)',
              opacity: isSelecting && selectedPhotos.size > 0 ? 1 : 0,
              transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease',
            }}
          >
            <span className="lb-selbar__n">
              <b className="tnum">{selectedPhotos.size}</b> selected
            </span>
            <button
              type="button"
              className="btn btn--butter"
              onClick={() => {
                const urls = Array.from(selectedPhotos)
                  .map((id) => photos.find((p) => p.id === id)?.src)
                  .filter(Boolean) as string[];
                handleUseInPost(urls);
              }}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Use in a post
            </button>
            <button
              type="button"
              className="btn lb-selbar__clear"
              onClick={() => {
                setIsSelecting(false);
                setSelectedPhotos(new Set());
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: POST TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="lb-pane" data-pane="templates">
          <div className="toolbar lb-panehead">
            <p className="lb-lede">
              Captions you reuse. <mark className="lb-ph">&#123;Blanks&#125;</mark> are filled in the composer.
            </p>
            <span className="toolbar__spacer" />
            <button
              type="button"
              className="btn btn--ink"
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New template
            </button>
          </div>

          <div className="lb-tpls">
            {templates
              .filter((tpl) => selectedBrand === 'all' || !tpl.brandId || matchesBrand(tpl.brandId, selectedBrand, brands))
              .map((tpl) => {
                const bm = tpl.brandId ? BRAND_METAS[tpl.brandId] : null;
                const blanks = Array.from(new Set(Array.from(tpl.text.matchAll(/\{([^{}\n]{1,30})\}/g)).map((m) => m[1])));

                const renderHighlightedText = (text: string) => {
                  const parts = text.split(/(\{([^{}\n]{1,30})\})/g);
                  return parts.map((part, i) => {
                    if (part.startsWith('{') && part.endsWith('}')) {
                      return (
                        <mark key={i} className="lb-ph">
                          {part}
                        </mark>
                      );
                    }
                    return part;
                  });
                };

                return (
                  <article key={tpl.id} className="card lb-tpl" data-lift>
                    <header className="lb-tpl__head">
                      {bm ? (
                        <span className="bchip">
                          <span className={`bmark bmark--xs tone--${bm.tone}`}>{bm.monogram}</span>
                          <span>{bm.short}</span>
                        </span>
                      ) : (
                        <span className="bchip">
                          <span className="bmark bmark--xs tone--plain">
                            <svg className="ico" viewBox="0 0 24 24" style={{ width: 13, height: 13 }}>
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                          </span>
                          Every brand
                        </span>
                      )}
                      <span className="lb-tpl__n">
                        {blanks.length} blank{blanks.length === 1 ? '' : 's'}
                      </span>
                    </header>

                    <h3 className="lb-tpl__name">{tpl.name}</h3>
                    <p className="lb-tpl__text" style={{ whiteSpace: 'pre-wrap' }}>
                      {renderHighlightedText(tpl.text)}
                    </p>

                    <footer className="lb-tpl__foot">
                      <button
                        type="button"
                        className="btn btn--ink btn--sm"
                        onClick={() => navigate('/compose', { state: { text: tpl.text, brandId: tpl.brandId || undefined } })}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        Use
                      </button>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Copy text"
                        onClick={() => {
                          navigator.clipboard.writeText(tpl.text);
                          addToast({ type: 'success', message: 'Template text copied to clipboard!' });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <span className="toolbar__spacer" />
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Edit template"
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setShowTemplateModal(true);
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Delete template"
                        onClick={() => {
                          setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
                          addToast({ type: 'info', message: `Deleted template "${tpl.name}"` });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </footer>
                  </article>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: HASHTAG SETS */}
      {activeTab === 'hashtags' && (
        <div className="lb-pane" data-pane="hashtags">
          <div className="toolbar lb-panehead">
            <p className="lb-lede">Tags you post with, per brand. Tap a tag to copy it.</p>
            <span className="toolbar__spacer" />
            <button
              type="button"
              className="btn btn--ink"
              onClick={() => {
                setEditingHashtag(null);
                setShowHashtagModal(true);
              }}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New set
            </button>
          </div>

          <div className="lb-sets">
            {hashtagSets
              .filter((hs) => selectedBrand === 'all' || matchesBrand(hs.brandId, selectedBrand, brands))
              .map((hs) => {
                const bm = BRAND_METAS[hs.brandId] || BRAND_METAS.ember;
                return (
                  <article key={hs.id} className="card lb-set" data-lift>
                    <header className="lb-set__head">
                      <span className={`bmark bmark--md tone--${bm.tone}`}>{bm.monogram}</span>
                      <span className="lb-set__t">
                        <b>{hs.name}</b>
                        <small>
                          {bm.name} · {hs.tags.length} tag{hs.tags.length === 1 ? '' : 's'}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Edit set"
                        onClick={() => {
                          setEditingHashtag(hs);
                          setShowHashtagModal(true);
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Delete set"
                        onClick={() => {
                          setHashtagSets((prev) => prev.filter((h) => h.id !== hs.id));
                          addToast({ type: 'info', message: `Deleted hashtag set "${hs.name}"` });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </header>

                    <div className="lb-cloud">
                      {hs.tags.map((tag, idx) => (
                        <button
                          key={tag}
                          type="button"
                          className={`lb-htag lb-htag--${idx % 4}`}
                          onClick={() => {
                            navigator.clipboard.writeText(tag);
                            addToast({ type: 'success', message: `Copied ${tag}` });
                          }}
                          title={`Copy ${tag}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <footer className="lb-set__foot">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          navigator.clipboard.writeText(hs.tags.join(' '));
                          addToast({ type: 'success', message: `${hs.tags.length} tags copied to clipboard!` });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy all
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => navigate('/compose', { state: { text: `\n\n${hs.tags.join(' ')}`, brandId: hs.brandId } })}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        Start a post
                      </button>
                    </footer>
                  </article>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: SAVED REPLIES */}
      {activeTab === 'replies' && (
        <div className="lb-pane" data-pane="replies">
          <div className="lb-repgrid">
            {/* Left Column: Replies List in a Card */}
            <div className="card lb-repcard">
              <header className="card__head">
                <div>
                  <h3 className="card__title">Saved replies</h3>
                  <p className="card__sub">Answers you give every day, one tap away in the inbox.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--ink btn--sm"
                  onClick={() => {
                    setEditingReply(null);
                    setShowReplyModal(true);
                  }}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New reply
                </button>
              </header>

              <ul className="lb-replies">
                {replies.map((rep) => (
                  <li key={rep.id} className="lb-reply">
                    <span className="lb-reply__ico">
                      <svg className="ico" viewBox="0 0 24 24">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </span>
                    <div className="lb-reply__body">
                      <b>{rep.title}</b>
                      <p>{rep.text}</p>
                    </div>
                    <div className="lb-reply__tools">
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Copy reply"
                        onClick={() => {
                          navigator.clipboard.writeText(rep.text);
                          addToast({ type: 'success', message: 'Reply copied to clipboard!' });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Edit reply"
                        onClick={() => {
                          setEditingReply(rep);
                          setShowReplyModal(true);
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="ibtn ibtn--sm"
                        title="Delete reply"
                        onClick={() => {
                          setReplies((prev) => prev.filter((r) => r.id !== rep.id));
                          addToast({ type: 'info', message: `Deleted reply "${rep.title}"` });
                        }}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Aside: Offered in the inbox */}
            <aside className="card lb-rephint tone--lilac">
              <span className="lb-rephint__ico">
                <svg className="ico" viewBox="0 0 24 24">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </span>
              <b>Offered in the inbox</b>
              <p>
                When someone answers a comment or message, these show up under the reply box. One tap fills the reply; they can still edit it before sending.
              </p>
              <button
                type="button"
                className="btn btn--sm lb-rephint__btn"
                onClick={() => navigate('/inbox')}
              >
                <svg className="ico" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                Open the inbox
              </button>
            </aside>
          </div>
        </div>
      )}

      {/* 3. PHOTO DETAIL DRAWER (SLIDE-OVER) */}
      {drawerPhoto &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            {/* Backdrop */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(16, 18, 20, 0.45)',
                backdropFilter: 'blur(6px)',
              }}
              onClick={() => setDrawerPhoto(null)}
            />

            {/* Drawer Sheet */}
            <div
              style={{
                position: 'relative',
                zIndex: 10000,
                width: 'min(520px, 100vw)',
                height: '100%',
                background: 'var(--solid, #f6f7f4)',
                boxShadow: 'var(--shadow-pop)',
                borderLeft: '1px solid var(--rim, rgba(255,255,255,0.4))',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '24px',
              }}
            >
              {/* Drawer Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setDrawerPhoto(null)}
                  title="Close drawer"
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Drawer Header */}
              <header className="lb-dr__head">
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  {drawerPhoto.title}
                </h2>
                <p className="lb-dr__meta">
                  <span className="bchip">
                    <span className={`bmark bmark--xs tone--${BRAND_METAS[drawerPhoto.brandId]?.tone || 'coral'}`}>
                      {BRAND_METAS[drawerPhoto.brandId]?.monogram || 'EO'}
                    </span>
                    <span>{BRAND_METAS[drawerPhoto.brandId]?.name}</span>
                  </span>
                  <span>
                    {drawerPhoto.w} × {drawerPhoto.h}
                  </span>
                  <span>
                    added {drawerPhoto.addedAgo} by {drawerPhoto.authorName}
                  </span>
                </p>
              </header>

              {/* Photo Large Preview */}
              <figure
                className="lb-dr__img"
                style={{ aspectRatio: `${drawerPhoto.w} / ${drawerPhoto.h}` }}
              >
                <img
                  src={drawerPhoto.src}
                  alt={drawerPhoto.title}
                  width={drawerPhoto.w}
                  height={drawerPhoto.h}
                />
              </figure>

              {/* Edit Details Form */}
              <form
                className="lb-dr__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const newTitle = (form.elements.namedItem('title') as HTMLInputElement).value.trim();
                  const newTagsStr = (form.elements.namedItem('tags') as HTMLInputElement).value.trim();
                  const newBrand = (form.elements.namedItem('brandId') as HTMLSelectElement).value;

                  if (!newTitle) return;

                  const splitTags = newTagsStr
                    .split(/[\s,]+/)
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean);

                  setPhotos((prev) =>
                    prev.map((p) =>
                      p.id === drawerPhoto.id
                        ? { ...p, title: newTitle, tags: splitTags, brandId: newBrand }
                        : p
                    )
                  );
                  setDrawerPhoto((cur) =>
                    cur ? { ...cur, title: newTitle, tags: splitTags, brandId: newBrand } : null
                  );
                  addToast({ type: 'success', message: 'Photo details saved.' });
                }}
              >
                <label className="field field--wide">
                  <span className="field__label">Title</span>
                  <input name="title" defaultValue={drawerPhoto.title} required />
                </label>
                <label className="field">
                  <span className="field__label">Tags, comma separated</span>
                  <input name="tags" defaultValue={drawerPhoto.tags.join(', ')} placeholder="product, autumn" />
                </label>
                <label className="field">
                  <span className="field__label">Brand</span>
                  <select name="brandId" defaultValue={drawerPhoto.brandId}>
                    {Object.values(BRAND_METAS).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="lb-dr__save">
                  <button type="submit" className="btn btn--ink btn--sm">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Save changes
                  </button>
                </div>
              </form>

              {/* Used In Posts Section */}
              <section>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
                  Used in {drawerPhoto.posts?.length || SAMPLE_POST_REFERENCES[drawerPhoto.id]?.length || drawerPhoto.usedCount || 0} post
                  {(drawerPhoto.posts?.length || SAMPLE_POST_REFERENCES[drawerPhoto.id]?.length || drawerPhoto.usedCount) === 1 ? '' : 's'}
                </h3>
                {drawerPhoto.posts && drawerPhoto.posts.length > 0 ? (
                  <ul className="lb-dr__posts">
                    {drawerPhoto.posts.map((post) => (
                      <li key={post.id}>
                        <button
                          type="button"
                          className="lb-dr__post"
                          onClick={() => navigate('/compose', { state: { text: post.caption, brandId: drawerPhoto.brandId, media: [drawerPhoto.src] } })}
                        >
                          <span className={`bmark bmark--sm tone--${BRAND_METAS[drawerPhoto.brandId]?.tone || 'coral'}`}>
                            {BRAND_METAS[drawerPhoto.brandId]?.monogram || 'EO'}
                          </span>
                          <span>
                            <b>{post.caption || 'Untitled Post'}</b>
                            <small>
                              {post.scheduledAt
                                ? `Scheduled: ${new Date(post.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                : post.publishedAt
                                ? `Published: ${new Date(post.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                                : 'Draft'}
                            </small>
                          </span>
                          <span className={`badge badge--${post.status === 'PUBLISHED' ? 'pine' : post.status === 'SCHEDULED' ? 'sea' : 'butter'}`}>
                            {post.status.toLowerCase()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : SAMPLE_POST_REFERENCES[drawerPhoto.id]?.length ? (
                  <ul className="lb-dr__posts">
                    {SAMPLE_POST_REFERENCES[drawerPhoto.id].map((post) => (
                      <li key={post.id}>
                        <button
                          type="button"
                          className="lb-dr__post"
                          onClick={() => navigate('/compose', { state: { text: post.text, brandId: post.brandId, media: [drawerPhoto.src] } })}
                        >
                          <span className={`bmark bmark--sm tone--${BRAND_METAS[post.brandId]?.tone || 'coral'}`}>
                            {BRAND_METAS[post.brandId]?.monogram || 'EO'}
                          </span>
                          <span>
                            <b>{post.text}</b>
                            <small>{post.at} · {post.networks.join(', ')}</small>
                          </span>
                          <span className={`badge badge--${post.status === 'published' ? 'pine' : post.status === 'scheduled' ? 'sea' : 'butter'}`}>
                            {post.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="card__sub">Use it in a post and it shows up here.</p>
                )}
              </section>

              {/* Drawer Footer Actions */}
              <footer style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn--ink"
                  onClick={() => {
                    handleUseInPost([drawerPhoto.src]);
                  }}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                  Use in a post
                </button>
                <a
                  className="btn btn--ghost"
                  href={drawerPhoto.src}
                  download={`${drawerPhoto.title.replace(/\s+/g, '-').toLowerCase()}.jpg`}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </a>
                <span className="toolbar__spacer" />
                <button
                  type="button"
                  className="ibtn"
                  aria-pressed={drawerPhoto.starred}
                  onClick={(e) => handleToggleStar(drawerPhoto.id, e)}
                  title={drawerPhoto.starred ? 'Unstar' : 'Star'}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ibtn"
                  title="Delete photo"
                  onClick={async () => {
                    const toDelete = drawerPhoto;
                    setPhotos((prev) => prev.filter((p) => p.id !== toDelete.id));
                    setDrawerPhoto(null);
                    if (!toDelete.id.startsWith('p') && !toDelete.id.startsWith('upload-')) {
                      try {
                        await apiFetch(`/library/assets/${toDelete.id}`, { method: 'DELETE' });
                      } catch (err: any) {
                        console.warn('Backend delete asset failed:', err);
                      }
                    }
                    addToast({ type: 'info', message: `Deleted "${toDelete.title}" from library.` });
                  }}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}

      {/* 4. MODALS FOR ADDING / EDITING TEMPLATES */}
      {showTemplateModal &&
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
              onClick={() => setShowTemplateModal(false)}
            />
            <div
              className="card modal"
              style={{ position: 'relative', zIndex: 10000, maxWidth: '540px', width: '92%' }}
            >
              <form
                className="mform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const name = (form.elements.namedItem('tplName') as HTMLInputElement).value.trim();
                  const brandId = (form.elements.namedItem('tplBrand') as HTMLSelectElement).value || null;
                  const text = (form.elements.namedItem('tplText') as HTMLTextAreaElement).value.trim();

                  if (!name || !text) return;

                  if (editingTemplate) {
                    setTemplates((prev) =>
                      prev.map((t) => (t.id === editingTemplate.id ? { ...t, name, brandId, text } : t))
                    );
                    addToast({ type: 'success', message: 'Template saved.' });
                  } else {
                    const newTpl: TemplateItem = {
                      id: `tpl-${Date.now()}`,
                      brandId,
                      name,
                      text,
                    };
                    setTemplates((prev) => [newTpl, ...prev]);
                    addToast({ type: 'success', message: 'Template created.' });
                  }
                  setShowTemplateModal(false);
                }}
              >
                <div className="mform__head">
                  <div>
                    <h3 className="mform__title">
                      {editingTemplate ? 'Edit template' : 'New template'}
                    </h3>
                    <p className="mform__sub">
                      Wrap anything that changes in braces, like &#123;product&#125; or &#123;date&#125;.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ibtn ibtn--sm"
                    onClick={() => setShowTemplateModal(false)}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="mform__grid">
                  <label className="field">
                    <span className="field__label">Name</span>
                    <input
                      name="tplName"
                      defaultValue={editingTemplate?.name || ''}
                      placeholder="Launch countdown"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Brand</span>
                    <select name="tplBrand" defaultValue={editingTemplate?.brandId || ''}>
                      <option value="">Every brand</option>
                      {Object.values(BRAND_METAS).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field--wide">
                    <span className="field__label">Caption</span>
                    <textarea
                      name="tplText"
                      rows={5}
                      defaultValue={editingTemplate?.text || ''}
                      placeholder="In {days} days: {product}. Turn on notifications so you’re first in line."
                      required
                    />
                  </label>
                </div>

                <div className="mform__foot">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowTemplateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--ink">
                    {editingTemplate ? 'Save changes' : 'Create template'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 5. MODALS FOR ADDING / EDITING HASHTAG SETS */}
      {showHashtagModal &&
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
              onClick={() => setShowHashtagModal(false)}
            />
            <div
              className="card modal"
              style={{ position: 'relative', zIndex: 10000, maxWidth: '540px', width: '92%' }}
            >
              <form
                className="mform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const name = (form.elements.namedItem('hsName') as HTMLInputElement).value.trim();
                  const brandId = (form.elements.namedItem('hsBrand') as HTMLSelectElement).value;
                  const tagsRaw = (form.elements.namedItem('hsTags') as HTMLTextAreaElement).value.trim();

                  if (!name || !tagsRaw) return;

                  const parsedTags = Array.from(
                    new Set(
                      tagsRaw
                        .split(/[\s,]+/)
                        .map((t) => {
                          const clean = t.trim().replace(/^#+/, '');
                          return clean ? `#${clean.toLowerCase()}` : '';
                        })
                        .filter(Boolean)
                    )
                  );

                  if (!parsedTags.length) return;

                  if (editingHashtag) {
                    setHashtagSets((prev) =>
                      prev.map((h) => (h.id === editingHashtag.id ? { ...h, name, brandId, tags: parsedTags } : h))
                    );
                    addToast({ type: 'success', message: 'Hashtag set saved.' });
                  } else {
                    const newSet: HashtagSetItem = {
                      id: `hs-${Date.now()}`,
                      brandId,
                      name,
                      tags: parsedTags,
                    };
                    setHashtagSets((prev) => [newSet, ...prev]);
                    addToast({ type: 'success', message: `Saved set · ${parsedTags.length} tags` });
                  }
                  setShowHashtagModal(false);
                }}
              >
                <div className="mform__head">
                  <div>
                    <h3 className="mform__title">
                      {editingHashtag ? 'Edit hashtag set' : 'New hashtag set'}
                    </h3>
                    <p className="mform__sub">
                      Separate tags with spaces or commas; the # is optional.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ibtn ibtn--sm"
                    onClick={() => setShowHashtagModal(false)}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="mform__grid">
                  <label className="field">
                    <span className="field__label">Name</span>
                    <input
                      name="hsName"
                      defaultValue={editingHashtag?.name || ''}
                      placeholder="Autumn launch"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Brand</span>
                    <select name="hsBrand" defaultValue={editingHashtag?.brandId || 'ember'}>
                      {Object.values(BRAND_METAS).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field--wide">
                    <span className="field__label">Tags</span>
                    <textarea
                      name="hsTags"
                      rows={4}
                      defaultValue={editingHashtag?.tags.join(' ') || ''}
                      placeholder="#slowcoffee #pourover #portlandcoffee"
                      required
                    />
                  </label>
                </div>

                <div className="mform__foot">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowHashtagModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--ink">
                    {editingHashtag ? 'Save changes' : 'Create set'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 6. MODALS FOR ADDING / EDITING SAVED REPLIES */}
      {showReplyModal &&
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
              onClick={() => setShowReplyModal(false)}
            />
            <div
              className="card modal"
              style={{ position: 'relative', zIndex: 10000, maxWidth: '540px', width: '92%' }}
            >
              <form
                className="mform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const title = (form.elements.namedItem('rpTitle') as HTMLInputElement).value.trim();
                  const text = (form.elements.namedItem('rpText') as HTMLTextAreaElement).value.trim();

                  if (!title || !text) return;

                  if (editingReply) {
                    setReplies((prev) =>
                      prev.map((r) => (r.id === editingReply.id ? { ...r, title, text } : r))
                    );
                    addToast({ type: 'success', message: 'Reply saved.' });
                  } else {
                    const newRep: SavedReplyItem = {
                      id: `rp-${Date.now()}`,
                      title,
                      text,
                    };
                    setReplies((prev) => [newRep, ...prev]);
                    addToast({ type: 'success', message: 'Saved reply added.' });
                  }
                  setShowReplyModal(false);
                }}
              >
                <div className="mform__head">
                  <div>
                    <h3 className="mform__title">
                      {editingReply ? 'Edit saved reply' : 'New saved reply'}
                    </h3>
                    <p className="mform__sub">
                      Keep it warm and short — people can tweak it before sending.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ibtn ibtn--sm"
                    onClick={() => setShowReplyModal(false)}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="mform__grid">
                  <label className="field field--wide">
                    <span className="field__label">Short name</span>
                    <input
                      name="rpTitle"
                      defaultValue={editingReply?.title || ''}
                      placeholder="Shipping times"
                      required
                    />
                  </label>
                  <label className="field field--wide">
                    <span className="field__label">Reply</span>
                    <textarea
                      name="rpText"
                      rows={5}
                      defaultValue={editingReply?.text || ''}
                      placeholder="We ship worldwide! Orders leave within 2 working days…"
                      required
                    />
                  </label>
                </div>

                <div className="mform__foot">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowReplyModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--ink">
                    {editingReply ? 'Save changes' : 'Create reply'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
