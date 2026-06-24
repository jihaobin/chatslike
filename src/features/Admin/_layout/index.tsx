'use client';

import { Outlet } from 'react-router-dom';

import AdminGuard from './AdminGuard';
import AdminSidebar from './AdminSidebar';

const AdminLayout = () => (
  <AdminGuard>
    <div style={{ display: 'flex', height: '100%' }}>
      <AdminSidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
    </div>
  </AdminGuard>
);

export default AdminLayout;
