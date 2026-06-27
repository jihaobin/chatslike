import { eq } from 'drizzle-orm';

import { creditGrants } from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';

import { TRIAL_CREDITS } from './constants';
import { CreditsService } from './credits';

export async function grantTrialCreditsOnRegistration(
  db: LobeChatDatabase | Transaction,
  params: { userId: string },
): Promise<{ credits: number; granted: boolean }> {
  const operationId = `trial:user:${params.userId}`;
  const existing = await db
    .select({ id: creditGrants.id })
    .from(creditGrants)
    .where(eq(creditGrants.operationId, operationId))
    .limit(1);

  if (existing[0]) return { credits: TRIAL_CREDITS, granted: false };

  const service = new CreditsService(db, params.userId);
  await service.grantTrialCredits({ operationId });

  return { credits: TRIAL_CREDITS, granted: true };
}
