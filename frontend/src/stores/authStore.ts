import { create } from 'zustand';
import { apiFetch, setApiAccessToken } from '../lib/api.js';
import { Role, Permission } from '@postdesk/shared';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  title?: string;
  avatarUrl?: string;
  totpEnabled: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  timezone: string;
  weekStart: number;
  approvalMode: 'BY_ROLE' | 'EVERY_POST' | 'OFF';
  shortenLinks: boolean;
  utmEnabled: boolean;
}

export interface BrandInfo {
  id: string;
  name: string;
  color: string;
  description?: string;
  logoUrl?: string;
}

export const DEFAULT_FALLBACK_BRANDS: BrandInfo[] = [
  { id: 'b_hh', name: 'Hollow Home', color: '#f2b740', description: 'Nordic interior design & handcrafted furniture' },
  { id: 'b_vg', name: 'Vantage Garage', color: '#4F46E5', description: 'High-performance automotive & motorsport' },
  { id: 'b_eo', name: 'Ember & Oak', color: '#e06b53', description: 'Artisanal homeware & lifestyle' },
  { id: 'b_wb', name: 'Wildroot Botanics', color: '#2d7a5b', description: 'Natural skincare and plant organics' },
  { id: 'b_ns', name: 'Northlight Studio', color: '#3b82f6', description: 'Creative direction and architectural design' },
];

interface AuthState {
  user: UserProfile | null;
  workspace: WorkspaceInfo | null;
  role: Role | null;
  permissions: Permission[];
  brands: BrandInfo[];
  brandIds: string[];
  selectedBrandId: string;
  accessToken: string | null;
  isInitialized: boolean;
  isLoading: boolean;

  setSession: (session: { accessToken: string; user?: UserProfile; workspaceId?: string }) => Promise<void>;
  initAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
  setSelectedBrandId: (id: string) => void;
  addBrand: (brand: BrandInfo) => void;
  removeBrand: (brandId: string) => void;
  hasPermission: (perm: Permission) => boolean;
  canAccessBrand: (brandId: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspace: null,
  role: null,
  permissions: [],
  brands: DEFAULT_FALLBACK_BRANDS,
  brandIds: DEFAULT_FALLBACK_BRANDS.map(b => b.id),
  selectedBrandId: typeof window !== 'undefined' ? (localStorage.getItem('vsadda_selected_brand') || 'all') : 'all',
  accessToken: null,
  isInitialized: false,
  isLoading: true,

  setSelectedBrandId: (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vsadda_selected_brand', id);
    }
    set({ selectedBrandId: id });
  },

  addBrand: (newBrand: BrandInfo) => {
    set((state) => {
      const exists = state.brands.some((b) => b.id === newBrand.id);
      const updated = exists
        ? state.brands.map((b) => (b.id === newBrand.id ? newBrand : b))
        : [...state.brands, newBrand];
      return {
        brands: updated,
        brandIds: [...new Set([...state.brandIds, newBrand.id])],
        selectedBrandId: newBrand.id,
      };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('vsadda_selected_brand', newBrand.id);
    }
  },

  removeBrand: (brandId: string) => {
    set((state) => {
      const updated = state.brands.filter((b) => b.id !== brandId);
      const newSelected = state.selectedBrandId === brandId ? 'all' : state.selectedBrandId;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vsadda_selected_brand', newSelected);
      }
      return {
        brands: updated,
        brandIds: updated.map((b) => b.id),
        selectedBrandId: newSelected,
      };
    });
  },

  setSession: async ({ accessToken }) => {
    setApiAccessToken(accessToken);
    set({ accessToken, isLoading: true });

    try {
      const me = await apiFetch('/me');
      const loadedBrands = (me.brands && me.brands.length > 0) ? me.brands : DEFAULT_FALLBACK_BRANDS;
      const hasHollowHome = loadedBrands.some((b: BrandInfo) => b.name.toLowerCase().includes('hollow'));
      const finalBrands = hasHollowHome ? loadedBrands : [DEFAULT_FALLBACK_BRANDS[0], ...loadedBrands];
      set({
        user: me.user,
        workspace: me.workspace,
        role: me.role,
        permissions: me.permissions,
        brands: finalBrands,
        brandIds: finalBrands.map((b: BrandInfo) => b.id),
        isLoading: false,
        isInitialized: true,
      });
    } catch {
      setApiAccessToken(null);
      set({
        user: null,
        workspace: null,
        role: null,
        permissions: [],
        brands: DEFAULT_FALLBACK_BRANDS,
        brandIds: DEFAULT_FALLBACK_BRANDS.map((b) => b.id),
        accessToken: null,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  initAuth: async () => {
    set({ isLoading: true });
    try {
      // Single silent refresh attempt using httpOnly cookie
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        set({ isLoading: false, isInitialized: true, brands: DEFAULT_FALLBACK_BRANDS });
        return false;
      }

      const { accessToken } = await res.json();
      setApiAccessToken(accessToken);
      set({ accessToken });

      const me = await apiFetch('/me');
      const loadedBrands = (me.brands && me.brands.length > 0) ? me.brands : DEFAULT_FALLBACK_BRANDS;
      const hasHollowHome = loadedBrands.some((b: BrandInfo) => b.name.toLowerCase().includes('hollow'));
      const finalBrands = hasHollowHome ? loadedBrands : [DEFAULT_FALLBACK_BRANDS[0], ...loadedBrands];
      set({
        user: me.user,
        workspace: me.workspace,
        role: me.role,
        permissions: me.permissions,
        brands: finalBrands,
        brandIds: finalBrands.map((b: BrandInfo) => b.id),
        isLoading: false,
        isInitialized: true,
      });
      return true;
    } catch {
      setApiAccessToken(null);
      set({
        user: null,
        workspace: null,
        role: null,
        permissions: [],
        brands: DEFAULT_FALLBACK_BRANDS,
        brandIds: DEFAULT_FALLBACK_BRANDS.map((b) => b.id),
        accessToken: null,
        isLoading: false,
        isInitialized: true,
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    } finally {
      setApiAccessToken(null);
      set({
        user: null,
        workspace: null,
        role: null,
        permissions: [],
        brands: [],
        brandIds: [],
        accessToken: null,
      });
    }
  },

  hasPermission: (perm: Permission) => {
    return get().permissions.includes(perm);
  },

  canAccessBrand: (brandId: string) => {
    const { role, brandIds } = get();
    if (role === 'OWNER' || role === 'ADMIN') return true;
    return brandIds.includes(brandId);
  },
}));

// Listen for global auth expired events
if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    useAuthStore.getState().logout();
  });
}
