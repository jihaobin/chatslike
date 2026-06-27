'use client';

import { Outlet } from 'react-router-dom';

import AdminGuard from '@/features/Admin/_layout/AdminGuard';
import ToggleLeftPanelButton from '@/features/NavPanel/ToggleLeftPanelButton';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

const AdminSettingsLayout = () => {
  const showPanel = useGlobalStore(systemStatusSelectors.showLeftPanel);
  return (
    <AdminGuard>
      {!showPanel && (
        <div style={{ display: 'flex', padding: '4px 8px' }}>
          <ToggleLeftPanelButton />
        </div>
      )}
      <Outlet />
    </AdminGuard>
  );
};

export default AdminSettingsLayout;
