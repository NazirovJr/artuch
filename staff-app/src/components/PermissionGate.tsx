import React from 'react';
import { AppAbility } from '../utils/ability';

interface Props {
  ability: AppAbility;
  action: string;
  subject: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ ability, action, subject, children, fallback = null }: Props) {
  if (ability.can(action as any, subject as any)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
