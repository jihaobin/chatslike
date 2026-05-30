import { eq } from 'drizzle-orm';

import { creditGrants } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { CreditsService } from './credits';

const normalizeTrialPhoneNumber = (phoneNumber: string) => {
  const compactPhoneNumber = phoneNumber.replaceAll(/[\s\-()]/g, '');

  if (compactPhoneNumber.startsWith('+')) {
    return `+${compactPhoneNumber.slice(1).replaceAll(/\D/g, '')}`;
  }

  const digits = compactPhoneNumber.replaceAll(/\D/g, '');

  if (/^1\d{10}$/.test(digits)) {
    return `+86${digits}`;
  }

  if (/^861\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return digits || compactPhoneNumber;
};

export async function grantTrialCreditsAfterPhoneVerified(
  db: LobeChatDatabase,
  params: { phoneNumber: string; userId: string },
): Promise<{ granted: boolean }> {
  const normalizedPhoneNumber = normalizeTrialPhoneNumber(params.phoneNumber);
  const operationId = `trial:phone:${normalizedPhoneNumber}`;
  const existing = await db
    .select({ id: creditGrants.id })
    .from(creditGrants)
    .where(eq(creditGrants.operationId, operationId))
    .limit(1);

  if (existing[0]) return { granted: false };

  const service = new CreditsService(db, params.userId);
  await service.grantTrialCredits({ operationId, phoneNumber: normalizedPhoneNumber });

  return { granted: true };
}
