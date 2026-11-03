import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore.js';
import { LoginView } from './components/auth/LoginView.js';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView.js';
import { AcceptInviteView } from './components/auth/AcceptInviteView.js';
import { PublicConnectView } from './components/connect/PublicConnectView.js';
import { AppShell } from './components/layout/AppShell.js';
import { OverviewView } from './components/dashboard/OverviewView.js';
import { ApprovalsView } from './components/approvals/ApprovalsView.js';
import { ComposeView } from './components/compose/ComposeView.js';
import { CalendarView } from './components/calendar/CalendarView.js';
import { InboxView } from './components/inbox/InboxView.js';
import { AnalyticsView } from './components/analytics/AnalyticsView.js';
import { ListeningView } from './components/listening/ListeningView.js';
import { ChannelsView } from './components/channels/ChannelsView.js';
import { LibraryView } from './components/library/LibraryView.js';
import { TeamView } from './components/team/TeamView.js';
import { SettingsView } from './components/settings/SettingsView.js';
import { ToastContainer } from './components/common/ToastContainer.js';
import { CommandPalette } from './components/common/CommandPalette.js';
import { SmoothScrollProvider } from './components/common/SmoothScrollProvider.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-9 h-9 border-3 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-text-muted">Loading VS Adda session...</span>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/forgot-password" element={<ForgotPasswordView />} />
      <Route path="/accept-invite/:token" element={<AcceptInviteView />} />
      <Route path="/connect/:token" element={<PublicConnectView />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewView />} />
        <Route path="approvals" element={<ApprovalsView />} />
        <Route path="approvals/:postId" element={<ApprovalsView />} />
        <Route path="compose" element={<ComposeView />} />
        <Route path="compose/:postId" element={<ComposeView />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="inbox" element={<InboxView />} />
        <Route path="inbox/:conversationId" element={<InboxView />} />
        <Route path="analytics" element={<AnalyticsView />} />
        <Route path="listening" element={<ListeningView />} />
        <Route path="channels" element={<ChannelsView />} />
        <Route path="library" element={<LibraryView />} />
        <Route path="library/:tab" element={<LibraryView />} />
        <Route path="team" element={<TeamView />} />
        <Route path="team/:tab" element={<TeamView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="settings/:tab" element={<SettingsView />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SmoothScrollProvider>
          <AppRoutes />
          <ToastContainer />
          <CommandPalette />
        </SmoothScrollProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
