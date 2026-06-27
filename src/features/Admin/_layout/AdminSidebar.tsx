'use client';

import { BarChart3, FileText, LayoutDashboard, ShoppingCart, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import ToggleLeftPanelButton from '@/features/NavPanel/ToggleLeftPanelButton';
import { lambdaQuery } from '@/libs/trpc/client/lambda';

const AdminSidebar = () => {
  const { t } = useTranslation('admin');
  const { data } = lambdaQuery.admin.checkAccess.useQuery();

  const navItems = [
    { icon: LayoutDashboard, path: '/home/settings/admin', title: t('nav.dashboard') },
    { icon: Users, path: '/home/settings/admin/users', title: t('nav.users') },
    { icon: ShoppingCart, path: '/home/settings/admin/orders', title: t('nav.orders') },
    { icon: BarChart3, path: '/home/settings/admin/usage', title: t('nav.usage') },
  ];

  const navStyle = ({ isActive }: { isActive: boolean }) => ({
    alignItems: 'center',
    borderRadius: 6,
    color: 'inherit',
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    textDecoration: 'none',
    ...(isActive ? { backgroundColor: 'var(--color-fill-secondary)' } : {}),
  });

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, width: 200 }}>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'flex-end',
          paddingBottom: 4,
        }}
      >
        <ToggleLeftPanelButton />
      </div>
      {navItems.map(({ icon: Icon, path, title }) => (
        <NavLink end={path === '/home/settings/admin'} key={path} style={navStyle} to={path}>
          <Icon size={16} />
          {title}
        </NavLink>
      ))}

      {data?.isSuperAdmin && (
        <NavLink style={navStyle} to="/home/settings/admin/audit">
          <FileText size={16} />
          {t('nav.audit')}
        </NavLink>
      )}
    </nav>
  );
};

export default AdminSidebar;
