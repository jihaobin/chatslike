import {
  adminClient,
  genericOAuthClient,
  inferAdditionalFields,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { type auth } from '@/auth';

export const {
  linkSocial,
  oauth2,
  accountInfo,
  listAccounts,
  phoneNumber,
  signIn,
  signOut,
  unlinkAccount,
  useSession,
} = createAuthClient({
  plugins: [
    adminClient(),
    inferAdditionalFields<typeof auth>(),
    genericOAuthClient(),
    phoneNumberClient(),
  ],
});
