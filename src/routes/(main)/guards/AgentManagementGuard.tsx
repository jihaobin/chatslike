import { memo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useServerConfigStore } from '@/store/serverConfig';
import { featureFlagsSelectors } from '@/store/serverConfig/selectors';

/**
 * Guard for agent management routes (/agent/:id/profile, /community/*, /group/*)
 * When hideAgentManagement flag is enabled, redirects to home page
 */
const AgentManagementGuard = memo(() => {
  const hideAgentManagement = useServerConfigStore(featureFlagsSelectors)?.hideAgentManagement;

  if (hideAgentManagement) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
});

AgentManagementGuard.displayName = 'AgentManagementGuard';

export default AgentManagementGuard;
