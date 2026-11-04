import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { getBrandMeta } from '../../lib/brandHelper.js';

interface BrandDef {
  id: string;
  name: string;
  short: string;
  color: string;
  textColor?: string;
}

const BRANDS_DEF: Record<string, BrandDef> = {};

type RoleId = 'owner' | 'admin' | 'manager' | 'editor' | 'community' | 'analyst' | 'client';

interface RoleConfig {
  id: RoleId;
  name: string;
  tone: 'ink' | 'sea' | 'pine' | 'butter' | 'lilac' | 'plain' | 'coral';
  desc: string;
  locked?: boolean;
}

const ROLES_CONFIG: RoleConfig[] = [
  { id: 'owner', name: 'Owner', tone: 'ink', desc: 'Full control, including billing. Cannot be edited.', locked: true },
  { id: 'admin', name: 'Admin', tone: 'sea', desc: 'Runs the workspace: team, roles, channels and settings.' },
  { id: 'manager', name: 'Manager', tone: 'pine', desc: 'Publishes and approves for the brands they look after.' },
  { id: 'editor', name: 'Editor', tone: 'butter', desc: 'Writes posts; every post goes to a manager for approval.' },
  { id: 'community', name: 'Community', tone: 'lilac', desc: 'Answers the inbox and hands conversations on.' },
  { id: 'analyst', name: 'Analyst', tone: 'plain', desc: 'Reads every report and runs listening. Cannot post.' },
  { id: 'client', name: 'Client', tone: 'coral', desc: 'Your client: reviews and approves their own brand’s posts.' },
];

const ROLE_DOT_COLORS: Record<RoleId, string> = {
  owner: '#16191d',
  admin: '#38bdf8',
  manager: '#10b981',
  editor: '#f59e0b',
  community: '#06b6d4',
  analyst: '#94a3b8',
  client: '#f43f5e',
};

interface MemberItem {
  id: string;
  name: string;
  role: RoleId;
  title: string;
  brands: 'all' | string[];
  status: 'active' | 'invited' | 'suspended';
  email: string;
  lastActive: string;
  mfa: boolean;
  joined: string;
  photo?: string | null;
  isYou?: boolean;
}

const INITIAL_MEMBERS: MemberItem[] = [];

interface PermissionItem {
  id: string;
  group: 'Publishing' | 'Engagement' | 'Insights' | 'Content' | 'Admin';
  label: string;
  hint: string;
}

const ALL_PERMISSIONS: PermissionItem[] = [
  { id: 'post.create', group: 'Publishing', label: 'Write posts', hint: 'Draft posts and send them for approval' },
  { id: 'post.publish', group: 'Publishing', label: 'Publish without approval', hint: 'Schedule or publish straight away' },
  { id: 'post.approve', group: 'Publishing', label: 'Approve posts', hint: 'Approve or send back other people’s posts' },
  { id: 'post.delete', group: 'Publishing', label: 'Delete posts', hint: 'Remove scheduled and published posts' },
  { id: 'calendar.edit', group: 'Publishing', label: 'Reschedule', hint: 'Drag posts to a new time on the calendar' },
  { id: 'inbox.reply', group: 'Engagement', label: 'Reply in inbox', hint: 'Answer comments, messages and mentions' },
  { id: 'inbox.assign', group: 'Engagement', label: 'Assign conversations', hint: 'Hand conversations to teammates' },
  { id: 'analytics.view', group: 'Insights', label: 'View analytics', hint: 'See reports and post performance' },
  { id: 'analytics.export', group: 'Insights', label: 'Export reports', hint: 'Download CSV and PDF reports' },
  { id: 'listening.manage', group: 'Insights', label: 'Manage listening', hint: 'Add and remove tracked keywords' },
  { id: 'library.manage', group: 'Content', label: 'Manage library', hint: 'Upload, tag and delete media and templates' },
  { id: 'channels.manage', group: 'Admin', label: 'Connect channels', hint: 'Connect, reconnect and remove social accounts' },
  { id: 'team.manage', group: 'Admin', label: 'Manage team & roles', hint: 'Invite people, change roles and permissions' },
  { id: 'billing.manage', group: 'Admin', label: 'Billing', hint: 'Change plan, seats and payment details' },
  { id: 'settings.manage', group: 'Admin', label: 'Workspace settings', hint: 'Approval rules, time zone, branding' },
];

const INITIAL_ROLE_PERMS: Record<RoleId, string[]> = {
  owner: ALL_PERMISSIONS.map((p) => p.id),
  admin: ALL_PERMISSIONS.map((p) => p.id).filter((id) => id !== 'billing.manage'),
  manager: [
    'post.create',
    'post.publish',
    'post.approve',
    'post.delete',
    'calendar.edit',
    'inbox.reply',
    'inbox.assign',
    'analytics.view',
    'analytics.export',
    'listening.manage',
    'library.manage',
  ],
  editor: ['post.create', 'calendar.edit', 'inbox.reply', 'analytics.view', 'library.manage'],
  community: ['inbox.reply', 'inbox.assign', 'analytics.view'],
  analyst: ['analytics.view', 'analytics.export', 'listening.manage'],
  client: ['post.approve', 'analytics.view'],
};

interface AuditItem {
  id: string;
  whoId: string;
  whoName: string;
  kind: 'approval' | 'channel' | 'team' | 'role' | 'post' | 'inbox' | 'settings' | 'auth';
  text: string;
  at: string;
}

const INITIAL_AUDIT_LOGS: AuditItem[] = [];

export function TeamView() {
  const queryClient = useQueryClient();
  const { user, selectedBrandId, brands } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  // Active top-level subtab
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'audit'>('members');

  // Search & Role filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleId>('all');

  // Local state for members and roles
  const [members, setMembers] = useState<MemberItem[]>(INITIAL_MEMBERS);
  const [rolePerms, setRolePerms] = useState<Record<RoleId, string[]>>(INITIAL_ROLE_PERMS);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>(INITIAL_AUDIT_LOGS);

  // Drawer & Modals state
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSeatsModal, setShowSeatsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [activeRoleDropdownId, setActiveRoleDropdownId] = useState<string | null>(null);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerMemberId) {
        setDrawerMemberId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerMemberId]);

  // Invite modal form fields
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleId>('editor');
  const [inviteBrandScope, setInviteBrandScope] = useState<'all' | string>('all');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  // Audit filter state
  const [auditQuery, setAuditQuery] = useState('');
  const [auditKindFilter, setAuditKindFilter] = useState<string>('all');
  const [auditWhoFilter, setAuditWhoFilter] = useState<string>('all');

  // Optional backend queries to keep synchronization
  const { data: serverStats } = useQuery({
    queryKey: ['team-stats'],
    queryFn: async () => apiFetch<any>('/team/stats').catch(() => null),
  });

  // Calculate live statistics
  const activeMembersCount = useMemo(
    () => members.filter((m) => m.status === 'active').length,
    [members]
  );
  const seatsUsedCount = useMemo(
    () => members.filter((m) => m.status !== 'suspended').length,
    [members]
  );
  const seatLimit = serverStats?.seatLimit || 15;
  const pendingInvitesCount = useMemo(
    () => members.filter((m) => m.status === 'invited').length,
    [members]
  );
  const mfaCount = useMemo(
    () => members.filter((m) => m.status === 'active' && m.mfa).length,
    [members]
  );
  const mfaCoveragePct = activeMembersCount > 0 ? Math.round((mfaCount / activeMembersCount) * 100) : 64;

  // 4 members without 2FA
  const without2FA = useMemo(
    () => members.filter((m) => m.status === 'active' && !m.mfa),
    [members]
  );

  // Pending invites list
  const pendingInvites = useMemo(
    () => members.filter((m) => m.status === 'invited'),
    [members]
  );

  // Drawer member object
  const drawerMember = useMemo(
    () => (drawerMemberId ? members.find((m) => m.id === drawerMemberId) : null),
    [drawerMemberId, members]
  );

  // Filtered members list
  const filteredMembers = useMemo(() => {
    let list = members;

    // Filter by role chip
    if (roleFilter !== 'all') {
      list = list.filter((m) => m.role === roleFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q)
      );
    }

    return list;
  }, [members, roleFilter, searchQuery]);

  // Handle changing a member's role
  const handleSetRole = (memberId: string, newRole: RoleId) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    const m = members.find((x) => x.id === memberId);
    if (m) {
      addToast({
        type: 'success',
        message: `${m.name.split(' ')[0]} is now ${newRole === 'analyst' || newRole === 'admin' ? 'an' : 'a'} ${ROLES_CONFIG.find((r) => r.id === newRole)?.name || newRole}`,
      });
      // Add audit event
      setAuditLogs((prev) => [
        {
          id: `au_${Date.now()}`,
          whoId: 'm-camila',
          whoName: 'Camila Ortiz',
          kind: 'role',
          text: `changed ${m.name}’s role to ${newRole}`,
          at: 'just now',
        },
        ...prev,
      ]);
    }
    setActiveRoleDropdownId(null);
  };

  // Handle member status toggle (Suspend/Activate)
  const handleToggleSuspend = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const nextStatus = m.status === 'suspended' ? 'active' : 'suspended';
          addToast({
            type: 'info',
            message: nextStatus === 'suspended'
              ? `${m.name.split(' ')[0]} is suspended — they can’t sign in`
              : `${m.name.split(' ')[0]} is back`,
          });
          return { ...m, status: nextStatus };
        }
        return m;
      })
    );
    setActiveRowMenuId(null);
  };

  // Handle revoking / removing an invite
  const handleRevokeInvite = (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    addToast({
      type: 'info',
      message: target ? `Revoked invitation for ${target.name}` : 'Invitation revoked',
    });
    setActiveRowMenuId(null);
  };

  // Handle resending an invite
  const handleResendInvite = (email: string) => {
    addToast({
      type: 'success',
      message: `Invite sent again to ${email}`,
    });
    setActiveRowMenuId(null);
  };

  // Handle brand toggle inside drawer
  const handleToggleMemberBrand = (memberId: string, brandKey: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        if (brandKey === 'all') {
          return { ...m, brands: m.brands === 'all' ? ['ember', 'wild'] : 'all' };
        }
        if (m.brands === 'all') {
          return { ...m, brands: [brandKey] };
        }
        const exists = m.brands.includes(brandKey);
        const nextBrands = exists
          ? m.brands.filter((b) => b !== brandKey)
          : [...m.brands, brandKey];
        return { ...m, brands: nextBrands.length === 0 ? [brandKey] : nextBrands };
      })
    );
  };

  // Handle matrix permission cell toggle
  const handleTogglePermission = (roleId: RoleId, permId: string) => {
    if (roleId === 'owner') {
      addToast({ type: 'error', message: 'The Owner always has every permission' });
      return;
    }
    setRolePerms((prev) => {
      const current = prev[roleId] || [];
      const hasPerm = current.includes(permId);
      const nextPerms = hasPerm ? current.filter((id) => id !== permId) : [...current, permId];
      return { ...prev, [roleId]: nextPerms };
    });
    const roleName = ROLES_CONFIG.find((r) => r.id === roleId)?.name || roleId;
    const permLabel = ALL_PERMISSIONS.find((p) => p.id === permId)?.label || permId;
    addToast({
      type: 'info',
      message: `Updated permissions for ${roleName}: ${permLabel}`,
    });
  };

  // Submit invite form
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const name = inviteName.trim() || inviteEmail.split('@')[0];
    const newMember: MemberItem = {
      id: `m-${Date.now()}`,
      name,
      role: inviteRole,
      title: ROLES_CONFIG.find((r) => r.id === inviteRole)?.name || 'Editor',
      brands: inviteBrandScope === 'all' ? 'all' : [inviteBrandScope],
      status: 'invited',
      email: inviteEmail.trim(),
      lastActive: 'Invite sent',
      mfa: false,
      joined: 'Pending',
    };

    setMembers((prev) => [...prev, newMember]);
    setGeneratedInviteUrl(`https://demo.codeandchill.store/murmura/#/accept-invite?token=inv_${Date.now()}`);
    addToast({ type: 'success', message: `Invitation issued to ${inviteEmail.trim()}` });
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['When,Person,Role,Kind,Action', ...auditLogs.map((a) => `"${a.at}","${a.whoName}","Role","${a.kind}","${a.text}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `murmura-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', message: `Exported ${auditLogs.length} events` });
  };

  // Helper to render initials avatar
  const renderAvatar = (member: MemberItem, size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
    if (member.photo) {
      return (
        <img
          src={member.photo}
          className={`av av--${size}`}
          alt={member.name}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    const initials = member.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const hash = member.id.charCodeAt(member.id.length - 1) % 4;
    return (
      <span className={`av av--${size} av--t${hash}`} title={member.name}>
        {initials}
      </span>
    );
  };

  // Helper to render brand badges
  const renderBrandsCell = (m: MemberItem) => {
    if (m.brands === 'all') {
      return (
        <span className="tm-allb">
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
            <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
          </svg>
          All brands
        </span>
      );
    }
    if (Array.isArray(m.brands) && m.brands.length > 0) {
      return (
        <div className="tm-brands">
          <span className="tm-bstack" title={m.brands.map((bKey) => getBrandMeta(bKey, brands).name).join(', ')}>
            {m.brands.map((bKey) => {
              const b = getBrandMeta(bKey, brands);
              return (
                <span
                  key={bKey}
                  className="bmark bmark--xs"
                  style={{
                    backgroundColor: b.color || '#4f46e5',
                    color: '#ffffff',
                  }}
                >
                  {b.monogram}
                </span>
              );
            })}
          </span>
          <span className="tm-bcount">
            {m.brands.length === 1
              ? getBrandMeta(m.brands[0], brands).name
              : `${m.brands.length} brands`}
          </span>
        </div>
      );
    }
    return <span className="tm-nob">No brands</span>;
  };

  return (
    <div data-view="team" className="view tm" style={{ minWidth: 0 }}>
      {/* 1. Header with Stats Strip */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">
            Team &amp;<br />roles
          </h1>
        </div>

        <div className="head__stats">
          {/* Active People */}
          <div className="stat" data-stat="people">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="9" cy="8.5" r="3.5" />
                <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
                <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c1.8.6 3 2.2 3.5 4.7" />
              </svg>
            </span>
            <div className="stat__body">
              <span className="stat__num"><b className="num tnum">{activeMembersCount}</b></span>
              <span className="stat__label">Active people</span>
            </div>
          </div>

          {/* Seats Used */}
          <div className="stat" data-stat="seats">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                <path d="M3 10h18M7 15h3" />
              </svg>
            </span>
            <div className="stat__body">
              <span className="stat__num"><b className="num tnum">{seatsUsedCount}</b></span>
              <span className="stat__label">of {seatLimit} seats used</span>
              <span className="meter tm-seatmeter" aria-hidden="true">
                <span
                  className="meter__fill"
                  style={{
                    transform: `scaleX(${Math.min(1, seatsUsedCount / seatLimit)})`,
                    transformOrigin: '0 50%',
                  }}
                />
              </span>
            </div>
          </div>

          {/* Pending Invites */}
          <div className="stat" data-stat="invites">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            </span>
            <div className="stat__body">
              <span className="stat__num"><b className="num tnum">{pendingInvitesCount}</b></span>
              <span className="stat__label">Pending invites</span>
            </div>
          </div>

          {/* 2FA Coverage */}
          <div className="stat" data-stat="mfa">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </span>
            <div className="stat__body">
              <span className="stat__num"><b className="num tnum">{mfaCoveragePct}%</b></span>
              <span className="stat__label">Two-factor coverage</span>
            </div>
          </div>
        </div>

        {/* Action Button: + Invite */}
        <div className="head__actions">
          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => {
              setGeneratedInviteUrl(null);
              setInviteEmail('');
              setInviteName('');
              setShowInviteModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
            Invite
          </button>
        </div>
      </header>

      {/* 2. Sub-header Segmented Tabs Bar */}
      <div className="tm-bar">
        <div className="seg" role="tablist" aria-label="Team sections">
          <button
            type="button"
            className="seg__btn"
            aria-selected={activeTab === 'members'}
            onClick={() => setActiveTab('members')}
            style={{
              backgroundColor: activeTab === 'members' ? 'var(--solid)' : 'transparent',
              color: activeTab === 'members' ? 'var(--text)' : 'var(--muted)',
              boxShadow: activeTab === 'members' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              borderRadius: '999px',
            }}
          >
            Members
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-selected={activeTab === 'roles'}
            onClick={() => setActiveTab('roles')}
            style={{
              backgroundColor: activeTab === 'roles' ? 'var(--solid)' : 'transparent',
              color: activeTab === 'roles' ? 'var(--text)' : 'var(--muted)',
              boxShadow: activeTab === 'roles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              borderRadius: '999px',
            }}
          >
            Roles &amp; permissions
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            style={{
              backgroundColor: activeTab === 'audit' ? 'var(--solid)' : 'transparent',
              color: activeTab === 'audit' ? 'var(--text)' : 'var(--muted)',
              boxShadow: activeTab === 'audit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              borderRadius: '999px',
            }}
          >
            Audit log
          </button>
        </div>

        {/* Current User Badge on Right */}
        <span className="tm-bar__who">
          <img src="/images/camila.jpg" className="av av--sm" alt="Camila" />
          <span>
            You’re <b>{user?.name?.split(' ')[0] || 'You'}</b> · Owner
          </span>
        </span>
      </div>

      {/* 3. STAGE CONTENT */}
      <div className="tm-stage">
        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="tm-mgrid">
            {/* Main People Card */}
            <section className="card tm-members" aria-labelledby="tm-members-t">
              <header className="card__head">
                <div>
                  <h2 className="card__title" id="tm-members-t">People</h2>
                  <p className="card__sub" data-msub>
                    {filteredMembers.length} people · 7 roles
                  </p>
                </div>
                <div className="card__tools">
                  <label className="search tm-search">
                    <svg className="ico" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m16 16 4 4" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Search people"
                      aria-label="Search people"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </label>
                </div>
              </header>

              {/* Role filter chips strip */}
              <div className="tm-chip-row hfade" role="group" aria-label="Filter by role">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={roleFilter === 'all'}
                  onClick={() => setRoleFilter('all')}
                >
                  Everyone <b data-count={members.length}>{members.length}</b>
                </button>
                {ROLES_CONFIG.map((rc) => {
                  const count = members.filter((m) => m.role === rc.id).length;
                  return (
                    <button
                      key={rc.id}
                      type="button"
                      className="chip tm-rchip"
                      aria-pressed={roleFilter === rc.id}
                      onClick={() => setRoleFilter(rc.id)}
                    >
                      <i className={`tm-rdot tone--${rc.tone}`} />
                      {rc.name} <b data-count={count}>{count}</b>
                    </button>
                  );
                })}
              </div>

              {/* Table Column Headers */}
              <div className="tm-thead" aria-hidden="true">
                <span>Person</span>
                <span>Title</span>
                <span>Role</span>
                <span>Brands</span>
                <span>Status</span>
                <span>2FA</span>
                <span>Last active</span>
                <span></span>
              </div>

              {/* People Rows List */}
              <ul className="tm-list">
                {filteredMembers.map((m) => {
                  const roleConfig = ROLES_CONFIG.find((r) => r.id === m.role) || ROLES_CONFIG[3];
                  const isSuspended = m.status === 'suspended';
                  return (
                    <li
                      key={m.id}
                      className={`tm-row ${isSuspended ? 'is-suspended' : ''}`}
                      data-key={m.id}
                      data-member={m.id}
                    >
                      {/* 1. Person: Avatar + Name + Email */}
                      <a
                        className="tm-who cursor-pointer"
                        href={`#/team/${m.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setDrawerMemberId(m.id);
                        }}
                      >
                        {renderAvatar(m, 'md')}
                        <span className="tm-who__t">
                          <b>
                            {m.name}
                            {m.isYou && <span className="badge badge--plain">You</span>}
                          </b>
                          <small>{m.email}</small>
                        </span>
                      </a>

                      {/* 2. Title */}
                      <span className="tm-title">{m.title}</span>

                      {/* 3. Role */}
                      <span className="tm-rolecell relative">
                        {m.role === 'owner' ? (
                          <span className="tm-role is-fixed" title="The owner’s role is fixed">
                            <span className={`rbadge rbadge--${roleConfig.tone} tm-badge`}>
                              <span className="tm-badge__t">{roleConfig.name}</span>
                            </span>
                            <svg className="ico tm-role__lock" viewBox="0 0 24 24">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                            </svg>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="tm-role"
                            aria-haspopup="menu"
                            aria-expanded={activeRoleDropdownId === m.id}
                            aria-label={`Role: ${roleConfig.name}. Change role`}
                            onClick={() =>
                              setActiveRoleDropdownId(activeRoleDropdownId === m.id ? null : m.id)
                            }
                          >
                            <span className={`rbadge rbadge--${roleConfig.tone} tm-badge`}>
                              <span className="tm-badge__t">{roleConfig.name}</span>
                            </span>
                            <svg className="ico tm-role__chev" viewBox="0 0 24 24">
                              <path d="m6 9.5 6 6 6-6" />
                            </svg>
                          </button>
                        )}

                        {/* Inline Role Changer Menu */}
                        {activeRoleDropdownId === m.id && (
                          <div
                            className="pop"
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              zIndex: 60,
                              width: 220,
                            }}
                          >
                            <div className="pop__head">
                              <span className="pop__title">Change role</span>
                            </div>
                            <div className="pop__list">
                              {ROLES_CONFIG.map((rc) => (
                                <button
                                  key={rc.id}
                                  type="button"
                                  className="menu__item"
                                  onClick={() => handleSetRole(m.id, rc.id)}
                                >
                                  <i className={`tm-rdot tone--${rc.tone}`} />
                                  <span>{rc.name}</span>
                                  {m.role === rc.id && (
                                    <svg className="ico menu__check" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </span>

                      {/* 4. Brands */}
                      <span className="tm-brands">{renderBrandsCell(m)}</span>

                      {/* 5. Status */}
                      <span className="tm-status">
                        {m.status === 'active' && (
                          <span className="spill spill--pine">
                            <i />
                            Active
                          </span>
                        )}
                        {m.status === 'invited' && (
                          <span className="spill spill--butter">
                            <i />
                            Invited
                          </span>
                        )}
                        {m.status === 'suspended' && (
                          <span className="spill spill--coral">
                            <i />
                            Suspended
                          </span>
                        )}
                      </span>

                      {/* 6. 2FA */}
                      <span className={`tm-mfa ${m.mfa ? 'is-on' : ''}`}>
                        {m.status === 'invited' ? (
                          '—'
                        ) : m.mfa ? (
                          <>
                            <svg className="ico" viewBox="0 0 24 24">
                              <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                              <path d="m9 12 2.2 2.2L15.5 10" />
                            </svg>
                            On
                          </>
                        ) : (
                          <>
                            <svg className="ico" viewBox="0 0 24 24">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                              <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
                            </svg>
                            Off
                          </>
                        )}
                      </span>

                      {/* 7. Last active */}
                      <span className="tm-last">{m.lastActive}</span>

                      {/* 8. More options */}
                      <div className="relative">
                        <button
                          type="button"
                          className="ibtn ibtn--sm tm-more"
                          aria-label={`Options for ${m.name}`}
                          onClick={() => setActiveRowMenuId(activeRowMenuId === m.id ? null : m.id)}
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <circle cx="5.5" cy="12" r="1.3" />
                            <circle cx="12" cy="12" r="1.3" />
                            <circle cx="18.5" cy="12" r="1.3" />
                          </svg>
                        </button>

                        {/* Options Dropdown Menu */}
                        {activeRowMenuId === m.id && (
                          <div
                            className="pop"
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              zIndex: 60,
                              width: 190,
                            }}
                          >
                            <button
                              type="button"
                              className="menu__item"
                              onClick={() => {
                                setDrawerMemberId(m.id);
                                setActiveRowMenuId(null);
                              }}
                            >
                              <svg className="ico" viewBox="0 0 24 24">
                                <circle cx="12" cy="8.5" r="3.8" />
                                <path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" />
                              </svg>
                              <span>Open profile</span>
                            </button>
                            {m.status === 'invited' && (
                              <button
                                type="button"
                                className="menu__item"
                                onClick={() => handleResendInvite(m.email)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                                  <path d="m4 7 8 6 8-6" />
                                </svg>
                                <span>Resend invite</span>
                              </button>
                            )}
                            {m.role !== 'owner' && (
                              <button
                                type="button"
                                className="menu__item"
                                onClick={() => handleToggleSuspend(m.id)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  {m.status === 'suspended' ? (
                                    <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
                                  ) : (
                                    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                                  )}
                                </svg>
                                <span>{m.status === 'suspended' ? 'Restore access' : 'Suspend'}</span>
                              </button>
                            )}
                            {m.status === 'invited' ? (
                              <button
                                type="button"
                                className="menu__item is-danger"
                                onClick={() => handleRevokeInvite(m.id)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <path d="M6 6l12 12M18 6 6 18" />
                                </svg>
                                <span>Revoke invite</span>
                              </button>
                            ) : (
                              m.role !== 'owner' && (
                                <button
                                  type="button"
                                  className="menu__item is-danger"
                                  onClick={() => handleRevokeInvite(m.id)}
                                >
                                  <svg className="ico" viewBox="0 0 24 24">
                                    <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
                                  </svg>
                                  <span>Remove from team</span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 3 Bottom Cards (Seats · Two-Factor · Pending Invites) */}
            <aside className="tm-side">
              {/* Card 1: Seats · Agency Plan (Glass Card) */}
              <section className="card tile tm-seats" aria-label="Seats">
                <p className="tm-seats__k">
                  <svg className="ico" viewBox="0 0 24 24">
                    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                    <path d="M3 10h18M7 15h3" />
                  </svg>
                  Seats · Agency plan
                </p>
                <p className="tm-seats__v">
                  <b data-seats-used>{seatsUsedCount}</b>
                  <span>/ {seatLimit}</span>
                </p>
                <span className="meter tm-seats__m" aria-hidden="true">
                  <span
                    className="meter__fill"
                    style={{
                      transform: `scaleX(${Math.min(1, seatsUsedCount / seatLimit)})`,
                      transformOrigin: '0 50%',
                    }}
                  />
                </span>
                <p className="tm-seats__s">
                  {Math.max(0, seatLimit - seatsUsedCount)} free · suspended people don’t count
                </p>
                <button
                  type="button"
                  className="btn btn--sm tm-seats__btn"
                  onClick={() => setShowSeatsModal(true)}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Manage seats
                </button>
              </section>

              {/* Card 2: Two-Factor (White Card) */}
              <section className="card tm-mfa-card" aria-labelledby="tm-mfa-t">
                <header className="card__head">
                  <h2 className="card__title" id="tm-mfa-t">Two-factor</h2>
                  <span className="badge badge--plain">Optional</span>
                </header>
                <p className="tm-big">
                  <b>{mfaCoveragePct}%</b>
                  <span>of active people use it</span>
                </p>
                <span className="meter">
                  <span
                    className="meter__fill meter__fill--pine"
                    style={{
                      transform: `scaleX(${mfaCoveragePct / 100})`,
                      transformOrigin: '0 50%',
                    }}
                  />
                </span>
                <p className="card__sub tm-side-sub">{without2FA.length} without it</p>
                <ul className="tm-side-list">
                  {without2FA.slice(0, 5).map((m) => {
                    const r = ROLES_CONFIG.find((x) => x.id === m.role) || ROLES_CONFIG[3];
                    return (
                      <li key={m.id} className="tm-side-row">
                        <a
                          href={`#/team/${m.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setDrawerMemberId(m.id);
                          }}
                        >
                          {renderAvatar(m, 'sm')}
                          <span>{m.name}</span>
                        </a>
                        <span className={`rbadge rbadge--${r.tone}`}>{r.name}</span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm tm-side-cta"
                  onClick={() => setShowSecurityModal(true)}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                    <path d="m9 12 2.2 2.2L15.5 10" />
                  </svg>
                  Security settings
                </button>
              </section>

              {/* Card 3: Pending Invites (White Card) */}
              <section className="card tm-inv-card" aria-labelledby="tm-inv-t">
                <header className="card__head">
                  <h2 className="card__title" id="tm-inv-t">Pending invites</h2>
                  <span className="badge badge--butter">{pendingInvites.length}</span>
                </header>
                {pendingInvites.length > 0 ? (
                  <ul className="tm-side-list">
                    {pendingInvites.map((m) => {
                      const r = ROLES_CONFIG.find((x) => x.id === m.role) || ROLES_CONFIG[3];
                      return (
                        <li key={m.id} className="tm-side-row" data-member={m.id}>
                          {renderAvatar(m, 'sm')}
                          <span>
                            <b>{m.name}</b>
                            <small>{r.name} · {m.email}</small>
                          </span>
                          <button
                            type="button"
                            className="ibtn ibtn--sm"
                            title={`Resend invite to ${m.name}`}
                            onClick={() => handleResendInvite(m.email)}
                          >
                            <svg className="ico" viewBox="0 0 24 24">
                              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                              <path d="m4 7 8 6 8-6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="ibtn ibtn--sm"
                            title={`Revoke ${m.name}’s invite`}
                            onClick={() => handleRevokeInvite(m.id)}
                          >
                            <svg className="ico" viewBox="0 0 24 24">
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="empty" style={{ padding: '24px 8px' }}>
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    <p className="empty__title">No open invites</p>
                    <p className="empty__text">Everyone you invited has joined.</p>
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}

        {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
        {activeTab === 'roles' && (
          <div className="tm-roles">
            {/* Roles Carousel / Cards Row */}
            <section className="card tm-rcards" aria-labelledby="tm-rcards-t">
              <header className="card__head">
                <div>
                  <h2 className="card__title" id="tm-rcards-t">Roles</h2>
                  <p className="card__sub" data-rsub>
                    {ROLES_CONFIG.length} roles · 0 custom
                  </p>
                </div>
                <div className="card__tools">
                  <button
                    type="button"
                    className="btn btn--ink btn--sm magnetic"
                    onClick={() => {
                      addToast({ type: 'info', message: 'Custom role creation is available on Agency plan.' });
                    }}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New role
                  </button>
                </div>
              </header>

              <div className="tm-rc-row">
                {ROLES_CONFIG.map((rc) => {
                  const roleMembers = members.filter((m) => m.role === rc.id);
                  const pCount = (rolePerms[rc.id] || []).length;
                  return (
                    <article
                      key={rc.id}
                      className={`tile tone--${rc.tone} tm-rc`}
                      data-rc={rc.id}
                      data-key={rc.id}
                    >
                      <header className="tm-rc__head">
                        <h3 className="tm-rc__name">{rc.name}</h3>
                        {rc.locked ? (
                          <span className="tm-rc__tag" title="Can’t be edited">
                            <svg className="ico" viewBox="0 0 24 24">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                            </svg>
                          </span>
                        ) : null}
                      </header>

                      <p className="tm-rc__desc">{rc.desc}</p>

                      <div className="tm-rc__nums">
                        <button
                          type="button"
                          className="tm-rc__num"
                          onClick={() => {
                            setRoleFilter(rc.id);
                            setActiveTab('members');
                          }}
                          title={`See ${rc.name} people`}
                        >
                          <b data-count={roleMembers.length}>{roleMembers.length}</b>
                          <small>{roleMembers.length === 1 ? 'person' : 'people'}</small>
                        </button>
                        <div className="tm-rc__num">
                          <b data-count={pCount}>{pCount}</b>
                          <small>of {ALL_PERMISSIONS.length} permissions</small>
                        </div>
                      </div>

                      <span className="meter tm-rc__meter" aria-hidden="true">
                        <span
                          className="meter__fill"
                          style={{
                            transform: `scaleX(${pCount / ALL_PERMISSIONS.length})`,
                            transformOrigin: '0 50%',
                          }}
                        />
                      </span>

                      <footer className="tm-rc__foot">
                        {roleMembers.length > 0 ? (
                          <>
                            <span className="av-stack">
                              {roleMembers.slice(0, 4).map((rm) => (
                                <React.Fragment key={rm.id}>
                                  {renderAvatar(rm, 'xs')}
                                </React.Fragment>
                              ))}
                            </span>
                            {roleMembers.length > 4 && <small>+{roleMembers.length - 4}</small>}
                          </>
                        ) : (
                          <small>Nobody yet</small>
                        )}
                        <span className="tm-rc__tag tm-rc__tag--sys">
                          {rc.locked ? 'Fixed' : 'Built in'}
                        </span>
                      </footer>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Matrix Table: Who Can Do What */}
            <section className="card tm-mxcard" aria-labelledby="tm-mx-t">
              <header className="card__head">
                <div>
                  <h2 className="card__title" id="tm-mx-t">Who can do what</h2>
                  <p className="card__sub">
                    Changes apply to everyone on the role straight away.
                  </p>
                </div>
                <div className="card__tools tm-mx-legend">
                  <span>
                    <i className="tm-lg tm-lg--on">
                      <svg className="tm-tick" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m6 12.5 4 4L18.2 8" />
                      </svg>
                    </i>
                    Allowed
                  </span>
                  <span>
                    <i className="tm-lg" />
                    Not allowed
                  </span>
                  <span>
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                    </svg>
                    Fixed
                  </span>
                </div>
              </header>

              <div className="tm-mx-wrap">
                <table className="tm-mx">
                  <thead>
                    <tr>
                      <th className="tm-mx__corner" scope="col">Permission</th>
                      {ROLES_CONFIG.map((rc) => {
                        const pCount = (rolePerms[rc.id] || []).length;
                        return (
                          <th key={rc.id} scope="col" className="tm-mx__col">
                            <span className={`rbadge rbadge--${rc.tone}`}>{rc.name}</span>
                            <small>
                              <b data-count={pCount}>{pCount}</b>/{ALL_PERMISSIONS.length}
                              {rc.locked && (
                                <svg className="ico" viewBox="0 0 24 24" style={{ width: 12, height: 12, display: 'inline', marginLeft: 3 }}>
                                  <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                                  <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                                </svg>
                              )}
                            </small>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(['Publishing', 'Engagement', 'Insights', 'Content', 'Admin'] as const).map((groupName) => (
                      <React.Fragment key={groupName}>
                        <tr className="tm-mx__group">
                          <th scope="rowgroup" colSpan={ROLES_CONFIG.length + 1}>
                            <span>{groupName}</span>
                          </th>
                        </tr>
                        {ALL_PERMISSIONS.filter((p) => p.group === groupName).map((perm) => (
                          <tr key={perm.id}>
                            <th scope="row" className="tm-mx__perm">
                              <b>{perm.label}</b>
                              <small>{perm.hint}</small>
                            </th>
                            {ROLES_CONFIG.map((rc) => {
                              const isChecked = (rolePerms[rc.id] || []).includes(perm.id);
                              const isDisabled = rc.locked;
                              return (
                                <td key={rc.id}>
                                  <button
                                    type="button"
                                    className={`tm-cell tm-cell--${rc.tone}`}
                                    role="checkbox"
                                    aria-checked={isChecked}
                                    aria-disabled={isDisabled}
                                    onClick={() => handleTogglePermission(rc.id, perm.id)}
                                    title={isDisabled ? 'Owner always has every permission' : `${rc.name}: ${perm.label}`}
                                  >
                                    <i className="tm-cell__ring" />
                                    <i className="tm-cell__fill" style={{ opacity: isChecked ? 1 : 0 }} />
                                    <svg className="tm-tick" viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: isChecked ? 1 : 0 }}>
                                      <path d="m6 12.5 4 4L18.2 8" />
                                    </svg>
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="tm-agrid">
            <section className="card tm-audit" aria-labelledby="tm-audit-t">
              <header className="card__head">
                <div>
                  <h2 className="card__title" id="tm-audit-t">Audit log</h2>
                  <p className="card__sub" data-asub>
                    {auditLogs.length} events recorded
                  </p>
                </div>
                <div className="card__tools">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={handleExportCSV}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 4v11.5M7 10.5l5 5 5-5M5 20h14" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </header>

              {/* Tools row */}
              <div className="tm-atools">
                <label className="search tm-search">
                  <svg className="ico" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16 16 4 4" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search the log"
                    aria-label="Search the log"
                    value={auditQuery}
                    onChange={(e) => setAuditQuery(e.target.value)}
                  />
                </label>
                <select
                  className="input tm-who-sel"
                  aria-label="Filter by person"
                  value={auditWhoFilter}
                  onChange={(e) => setAuditWhoFilter(e.target.value)}
                >
                  <option value="all">Everyone</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kind chips */}
              <div className="tm-chip-row hfade" role="group" aria-label="Filter by kind">
                {['all', 'approval', 'channel', 'team', 'role', 'post', 'inbox', 'settings'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    aria-pressed={auditKindFilter === k}
                    onClick={() => setAuditKindFilter(k)}
                  >
                    {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>

              {/* Timeline list */}
              <ol className="tm-tl">
                <li className="tm-day">Today</li>
                {auditLogs.map((log) => {
                  const actor = members.find((m) => m.id === log.whoId) || {
                    id: log.whoId,
                    name: log.whoName,
                    role: 'editor',
                  };
                  return (
                    <li key={log.id} className="tm-ev">
                      <span className="tm-ev__ico tone--sea">
                        <svg className="ico" viewBox="0 0 24 24">
                          <path d="M12 8v4l3 2" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </span>
                      <div className="tm-ev__body">
                        {renderAvatar(actor as any, 'sm')}
                        <p>
                          <b>{log.whoName}</b> {log.text}
                          <small>{log.kind} · {log.at}</small>
                        </p>
                      </div>
                      <time className="tm-ev__t">{log.at}</time>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Audit Sidebar: By Kind & Most Active */}
            <aside className="tm-side">
              <section className="card tm-kinds">
                <header className="card__head">
                  <h2 className="card__title">By kind</h2>
                </header>
                <div className="tm-kinds__body">
                  <ul className="legend tm-kinds__legend" style={{ width: '100%' }}>
                    <li>
                      <span>
                        <i className="tone--pine" style={{ backgroundColor: 'var(--pine)' }} />
                        Approvals <b>2</b>
                      </span>
                    </li>
                    <li>
                      <span>
                        <i className="tone--sea" style={{ backgroundColor: 'var(--sea)' }} />
                        Channels <b>1</b>
                      </span>
                    </li>
                    <li>
                      <span>
                        <i className="tone--butter" style={{ backgroundColor: 'var(--butter)' }} />
                        Team <b>2</b>
                      </span>
                    </li>
                    <li>
                      <span>
                        <i className="tone--lilac" style={{ backgroundColor: 'var(--lilac)' }} />
                        Roles <b>1</b>
                      </span>
                    </li>
                    <li>
                      <span>
                        <i className="tone--coral" style={{ backgroundColor: 'var(--coral)' }} />
                        Posts <b>2</b>
                      </span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="card tm-actors">
                <header className="card__head">
                  <h2 className="card__title">Most active</h2>
                  <span className="card__sub">recent events</span>
                </header>
                <ul className="tm-side-list">
                  {[
                    { m: members[0], count: 3 },
                    { m: members[1], count: 3 },
                    { m: members[2], count: 2 },
                    { m: members[3], count: 1 },
                  ].map(({ m, count }) => (
                    <li key={m.id} className="tm-side-row tm-actor">
                      <button
                        type="button"
                        className="tm-actor__btn"
                        onClick={() => {
                          setAuditWhoFilter(m.id);
                        }}
                      >
                        {renderAvatar(m, 'sm')}
                        <span>
                          <b>{m.name}</b>
                          <span className="meter">
                            <span
                              className="meter__fill meter__fill--lilac"
                              style={{ transform: `scaleX(${count / 3})`, transformOrigin: '0 50%' }}
                            />
                          </span>
                        </span>
                        <em>{count}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>

      {/* 4. DRAWER: MEMBER DETAILS */}
      {drawerMember &&
        createPortal(
          <>
            <div
              className="tm-member-overlay"
              onClick={() => setDrawerMemberId(null)}
              aria-hidden="true"
            />
            <aside
              className="tm-floating-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`${drawerMember.name} details`}
            >
              <div className="tm-floating-drawer__inner">
                {/* Drawer Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                    {drawerMember.photo ? (
                      <img
                        src={drawerMember.photo}
                        className="tm-drawer-avatar"
                        alt={drawerMember.name}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span
                        className="tm-drawer-avatar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          color: '#334155',
                        }}
                      >
                        {drawerMember.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <h2
                        style={{
                          fontSize: '24px',
                          fontWeight: 600,
                          color: 'var(--text, #16191d)',
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {drawerMember.name}
                      </h2>
                      <p
                        style={{
                          fontSize: '17px',
                          color: '#555555',
                          margin: '4px 0 0 0',
                          fontWeight: 400,
                        }}
                      >
                        {drawerMember.title}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '10px',
                        }}
                      >
                        <span
                          style={{
                            background: '#16191d',
                            color: '#ffffff',
                            borderRadius: '999px',
                            padding: '3px 12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '0.01em',
                          }}
                        >
                          {ROLES_CONFIG.find((r) => r.id === drawerMember.role)?.name || 'Member'}
                        </span>
                        {drawerMember.status === 'active' ? (
                          <span className="tm-badge-active-soft">
                            <span className="tm-badge-active-dot" />
                            Active
                          </span>
                        ) : drawerMember.status === 'invited' ? (
                          <span className="tm-badge-active-soft">
                            <span className="tm-badge-active-dot" style={{ backgroundColor: '#f59e0b' }} />
                            Invited
                          </span>
                        ) : (
                          <span className="tm-badge-active-soft">
                            <span className="tm-badge-active-dot" style={{ backgroundColor: '#ef4444' }} />
                            Suspended
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tm-drawer-close-btn"
                    aria-label="Close"
                    onClick={() => setDrawerMemberId(null)}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 2x2 Info Cards */}
                <div className="tm-drawer-facts">
                  <div className="tm-drawer-info-card">
                    <span style={{ fontSize: '13px', color: 'var(--muted, #6b7280)', marginBottom: '4px' }}>
                      Email
                    </span>
                    <a
                      href={`mailto:${drawerMember.email}`}
                      style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: 'var(--text, #16191d)',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={drawerMember.email}
                    >
                      {drawerMember.email}
                    </a>
                  </div>

                  <div className="tm-drawer-info-card">
                    <span style={{ fontSize: '13px', color: 'var(--muted, #6b7280)', marginBottom: '4px' }}>
                      Joined
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text, #16191d)' }}>
                      {drawerMember.joined}
                    </span>
                  </div>

                  <div className="tm-drawer-info-card">
                    <span style={{ fontSize: '13px', color: 'var(--muted, #6b7280)', marginBottom: '4px' }}>
                      Last active
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text, #16191d)' }}>
                      {drawerMember.lastActive}
                    </span>
                  </div>

                  <div className="tm-drawer-info-card">
                    <span style={{ fontSize: '13px', color: 'var(--muted, #6b7280)', marginBottom: '4px' }}>
                      Two-factor
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {drawerMember.mfa ? (
                        <>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: 500, color: '#10b981' }}>On</span>
                        </>
                      ) : (
                        <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--muted, #6b7280)' }}>Off</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Section */}
                <section style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text, #16191d)', margin: 0 }}>
                    Role
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      fontSize: '13px',
                      color: 'var(--muted, #6b7280)',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>
                      {drawerMember.isYou || drawerMember.role === 'owner'
                        ? "You can't change your own role"
                        : "The owner’s role is fixed"}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                    role="radiogroup"
                    aria-label="Role"
                  >
                    {ROLES_CONFIG.map((rc) => {
                      const isSelected = drawerMember.role === rc.id;
                      const isDisabled = drawerMember.role === 'owner';
                      const dotColor = ROLE_DOT_COLORS[rc.id] || '#94a3b8';
                      return (
                        <button
                          key={rc.id}
                          type="button"
                          role="radio"
                          className={`tm-dw-chip ${isSelected ? 'is-selected' : ''}`}
                          aria-checked={isSelected}
                          disabled={isDisabled}
                          onClick={() => handleSetRole(drawerMember.id, rc.id)}
                        >
                          {!isSelected && (
                            <span
                              className="tm-dw-chip-dot"
                              style={{ backgroundColor: dotColor }}
                            />
                          )}
                          {rc.name}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      marginTop: '12px',
                      fontSize: '14px',
                      color: 'var(--muted, #64748b)',
                      lineHeight: 1.4,
                      margin: '12px 0 0 0',
                    }}
                  >
                    {ROLES_CONFIG.find((r) => r.id === drawerMember.role)?.desc ||
                      'Full control, including billing. Cannot be edited.'}
                  </p>
                </section>

                {/* Brand Access Section */}
                <section style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text, #16191d)', margin: 0 }}>
                    Brand access
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      fontSize: '13px',
                      color: 'var(--muted, #6b7280)',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>You can't change your own access</span>
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Row 1: All brands */}
                    <div className="tm-drawer-brand-card">
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#16191d',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
                          <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b
                          style={{
                            display: 'block',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--text, #16191d)',
                          }}
                        >
                          All brands
                        </b>
                        <small
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            color: 'var(--muted, #64748b)',
                            marginTop: '2px',
                          }}
                        >
                          Includes brands you add later
                        </small>
                      </div>
                      <button
                        type="button"
                        className="tm-switch"
                        role="switch"
                        aria-checked={drawerMember.brands === 'all'}
                        disabled={drawerMember.role === 'owner'}
                        onClick={() => handleToggleMemberBrand(drawerMember.id, 'all')}
                      >
                        <span className="tm-switch-thumb" />
                      </button>
                    </div>

                    {/* Dynamic Real Brands */}
                    {(brands || []).map((b: any) => (
                      <div key={b.id} className="tm-drawer-brand-card">
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: b.color || '#4F46E5',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '16px',
                            flexShrink: 0,
                          }}
                        >
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b
                            style={{
                              display: 'block',
                              fontSize: '16px',
                              fontWeight: 600,
                              color: 'var(--text, #16191d)',
                            }}
                          >
                            {b.name}
                          </b>
                          <small
                            style={{
                              display: 'block',
                              fontSize: '13px',
                              color: 'var(--muted, #64748b)',
                              marginTop: '2px',
                            }}
                          >
                            {b.timezone || 'Connected brand'}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="tm-switch"
                          role="switch"
                          aria-checked={
                            drawerMember.brands === 'all' ||
                            (Array.isArray(drawerMember.brands) && drawerMember.brands.includes(b.id))
                          }
                          disabled={drawerMember.brands === 'all' || drawerMember.role === 'owner'}
                          onClick={() => handleToggleMemberBrand(drawerMember.id, b.id)}
                        >
                          <span className="tm-switch-thumb" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Permissions list */}
                <section style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text, #16191d)', margin: 0 }}>
                    What {drawerMember.name.split(' ')[0]} can do
                  </h3>
                  <ul className="tm-dw-perms" style={{ marginTop: '12px' }}>
                    {ALL_PERMISSIONS.slice(0, 8).map((p) => {
                      const isGranted = (rolePerms[drawerMember.role] || []).includes(p.id);
                      return (
                        <li key={p.id} className={isGranted ? 'is-on' : ''}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {isGranted ? (
                              <path d="m5 12.5 4.5 4.5L19 7.5" />
                            ) : (
                              <path d="M6 6l12 12M18 6 6 18" />
                            )}
                          </svg>
                          {p.label}
                        </li>
                      );
                    })}
                  </ul>
                  <a
                    className="tm-dw-link cursor-pointer"
                    style={{ marginTop: '12px', display: 'inline-flex' }}
                    onClick={() => {
                      setDrawerMemberId(null);
                      setActiveTab('roles');
                    }}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <circle cx="8" cy="15" r="4" />
                      <path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" />
                    </svg>
                    Edit what {drawerMember.name.split(' ')[0]} can do
                  </a>
                </section>

                {/* Footer actions */}
                <footer className="tm-dw-actions" style={{ marginTop: '24px' }}>
                  <button
                    type="button"
                    className="btn btn--ink"
                    onClick={() => {
                      addToast({ type: 'info', message: `Viewing as ${drawerMember.name}` });
                    }}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View as {drawerMember.name.split(' ')[0]}
                  </button>
                  {drawerMember.role !== 'owner' && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleToggleSuspend(drawerMember.id)}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        {drawerMember.status === 'suspended' ? (
                          <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
                        ) : (
                          <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                        )}
                      </svg>
                      {drawerMember.status === 'suspended' ? 'Restore' : 'Suspend'}
                    </button>
                  )}
                  {drawerMember.role !== 'owner' && (
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        handleRevokeInvite(drawerMember.id);
                        setDrawerMemberId(null);
                      }}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
                      </svg>
                      Remove
                    </button>
                  )}
                </footer>
              </div>
            </aside>
          </>,
          document.body
        )}

      {/* 5. MODAL: INVITE MEMBER */}
      {showInviteModal && (
        <>
          <div
            className="scrim"
            style={{ opacity: 1, visibility: 'visible' }}
            onClick={() => setShowInviteModal(false)}
          />
          <dialog className="modal" open style={{ zIndex: 80, position: 'fixed', top: '15vh' }}>
            <form className="mform" onSubmit={handleSendInvite}>
              <div className="mform__head">
                <div>
                  <h2 className="mform__title">Invite a teammate</h2>
                  <p className="mform__sub">
                    They get an email with a link to join VS Adda Agency.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  aria-label="Close"
                  onClick={() => setShowInviteModal(false)}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {generatedInviteUrl ? (
                <div style={{ padding: '0 22px 22px' }}>
                  <div className="card tile tone--pine" style={{ padding: 18, marginBottom: 16 }}>
                    <b>Invitation Sent!</b>
                    <p style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                      Share this unique join link with your teammate to let them sign in:
                    </p>
                    <div
                      style={{
                        background: 'var(--solid)',
                        color: 'var(--text)',
                        borderRadius: 12,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        marginTop: 10,
                        wordBreak: 'break-all',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{generatedInviteUrl}</span>
                      <button
                        type="button"
                        className="btn btn--sm btn--ink"
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInviteUrl);
                          addToast({ type: 'success', message: 'Invite link copied!' });
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn--ink"
                      onClick={() => setShowInviteModal(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mform__grid">
                    <label className="field">
                      <span className="field__label">Full name</span>
                      <input
                        type="text"
                        placeholder="Jordan Blake"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Work email</span>
                      <input
                        type="email"
                        placeholder="jordan@northlight.studio"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">Role</span>
                      <select
                        className="input"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as RoleId)}
                      >
                        {ROLES_CONFIG.filter((r) => r.id !== 'owner').map((rc) => (
                          <option key={rc.id} value={rc.id}>
                            {rc.name} — {rc.desc}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field field--wide">
                      <span className="field__label">Brand Access</span>
                      <select
                        className="input"
                        value={inviteBrandScope}
                        onChange={(e) => setInviteBrandScope(e.target.value)}
                      >
                        <option value="all">All brands (Agency access)</option>
                        {(brands || []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} only
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mform__foot">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setShowInviteModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn--ink">
                      Send invite
                    </button>
                  </div>
                </>
              )}
            </form>
          </dialog>
        </>
      )}

      {/* 6. MODAL: MANAGE SEATS */}
      {showSeatsModal && (
        <>
          <div
            className="scrim"
            style={{ opacity: 1, visibility: 'visible' }}
            onClick={() => setShowSeatsModal(false)}
          />
          <dialog className="modal" open style={{ zIndex: 80, position: 'fixed', top: '18vh' }}>
            <div className="mform">
              <div className="mform__head">
                <div>
                  <h2 className="mform__title">Agency Plan · Seats</h2>
                  <p className="mform__sub">
                    Your agency currently has {seatLimit} seats included.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  aria-label="Close"
                  onClick={() => setShowSeatsModal(false)}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: '0 22px 20px' }}>
                <div className="card tile tm-seats-panel" style={{ padding: 18, marginBottom: 14 }}>
                  <p style={{ fontSize: 13, opacity: 0.8 }}>Seats in use</p>
                  <p style={{ fontSize: 32, fontWeight: 700, margin: '4px 0' }}>
                    {seatsUsedCount} <span style={{ fontSize: 18, opacity: 0.7 }}>/ {seatLimit}</span>
                  </p>
                  <p style={{ fontSize: 13, opacity: 0.85 }}>
                    {seatLimit - seatsUsedCount} available seats. Suspended members do not count towards your quota.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowSeatsModal(false)}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="btn btn--ink"
                    onClick={() => {
                      addToast({ type: 'info', message: 'Redirecting to Billing settings...' });
                      setShowSeatsModal(false);
                    }}
                  >
                    Add more seats (+ $15/mo)
                  </button>
                </div>
              </div>
            </div>
          </dialog>
        </>
      )}

      {/* 7. MODAL: SECURITY SETTINGS */}
      {showSecurityModal && (
        <>
          <div
            className="scrim"
            style={{ opacity: 1, visibility: 'visible' }}
            onClick={() => setShowSecurityModal(false)}
          />
          <dialog className="modal" open style={{ zIndex: 80, position: 'fixed', top: '18vh' }}>
            <div className="mform">
              <div className="mform__head">
                <div>
                  <h2 className="mform__title">Two-factor &amp; Security</h2>
                  <p className="mform__sub">
                    Agency-wide 2FA and authentication policy settings.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  aria-label="Close"
                  onClick={() => setShowSecurityModal(false)}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: '0 22px 20px' }}>
                <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--glass-2)',
                      borderRadius: 16,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 14 }}>Require 2FA for all members</b>
                      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
                        Members without 2FA must set it up on their next sign-in.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={false}
                      onClick={() => addToast({ type: 'info', message: 'Updated 2FA enforcement policy.' })}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--glass-2)',
                      borderRadius: 16,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 14 }}>Automatic Session Timeout</b>
                      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
                        Sign out inactive sessions after 14 days.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={true}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn--ink"
                    onClick={() => {
                      addToast({ type: 'success', message: 'Security preferences saved.' });
                      setShowSecurityModal(false);
                    }}
                  >
                    Save preferences
                  </button>
                </div>
              </div>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
