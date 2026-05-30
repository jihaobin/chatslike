import { Text } from '@lobehub/ui';
import { memo } from 'react';

import { formatNumber } from '@/utils/format';

interface CreditAmountProps {
  size?: 'large' | 'small';
  value?: number | null;
}

const CreditAmount = memo<CreditAmountProps>(({ size = 'small', value }) => (
  <Text
    as={'span'}
    style={{
      fontSize: size === 'large' ? 28 : 13,
      fontWeight: size === 'large' ? 700 : 500,
      lineHeight: size === 'large' ? 1.2 : 1.4,
    }}
  >
    {formatNumber(value ?? 0)}
  </Text>
));

CreditAmount.displayName = 'CreditAmount';

export default CreditAmount;
