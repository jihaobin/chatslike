'use client';

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { data, isLoading, isError } = lambdaQuery.admin.checkAccess.useQuery();

  if (isLoading || isError) return null;
  if (!data?.hasAccess) return <Navigate replace to="/" />;

  return <>{children}</>;
};

export default AdminGuard;
