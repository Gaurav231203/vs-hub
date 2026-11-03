import React from 'react';
import { Permission } from '@postdesk/shared';
import { useAuthStore } from '../../stores/authStore.js';

interface PermissionGateProps {
  perm: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ perm, fallback = null, children }: PermissionGateProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!hasPermission(perm)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
