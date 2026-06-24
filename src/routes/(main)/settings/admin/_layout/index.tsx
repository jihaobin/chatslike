import { Outlet } from 'react-router-dom';

import AdminGuard from '@/features/Admin/_layout/AdminGuard';

const AdminSettingsLayout = () => (
  <AdminGuard>
    <Outlet />
  </AdminGuard>
);

export default AdminSettingsLayout;
