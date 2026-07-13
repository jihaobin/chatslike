import { Alert, Flexbox } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Lazy-load agent-runtime so DEFAULT_SECURITY_BLACKLIST / InterventionChecker
// do not pull vendor-ai-runtime into the synchronous module graph.
const checkSecurityBlacklist = async (args: Record<string, unknown>) => {
  const { DEFAULT_SECURITY_BLACKLIST, InterventionChecker } = await import(
    '@lobechat/agent-runtime'
  );
  return InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, args);
};

interface SecurityBlacklistWarningProps {
  args: Record<string, any>;
}

const SecurityBlacklistWarning = memo<SecurityBlacklistWarningProps>(({ args }) => {
  const { t } = useTranslation('tool');
  const [securityCheck, setSecurityCheck] = useState<{ blocked: boolean; reason?: string } | null>(
    null,
  );

  useEffect(() => {
    checkSecurityBlacklist(args).then(setSecurityCheck);
  }, [args]);

  if (!securityCheck?.blocked) return null;

  return (
    <Alert
      showIcon
      title={t('localFiles.securityBlacklist.warning')}
      type="error"
      variant="borderless"
      description={
        <Flexbox gap={4} style={{ fontSize: 12 }}>
          <div>{securityCheck.reason ? t(securityCheck.reason as any) : undefined}</div>
        </Flexbox>
      }
    />
  );
});

SecurityBlacklistWarning.displayName = 'SecurityBlacklistWarning';

export default SecurityBlacklistWarning;
