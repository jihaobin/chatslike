import { BRANDING_NAME } from '@lobechat/business-const';

/**
 * Marketplace / plugin manifests use the literal `'LobeHub'` as the canonical
 * author value to flag first-party (official) items. That literal mirrors
 * server-side marketplace data and is used as an equality key for the official
 * badge, so it must NOT be renamed in storage or comparisons.
 *
 * Use this helper at render time only, to display the configured brand name
 * instead of the raw `'LobeHub'` marker.
 */
export const OFFICIAL_AUTHOR_KEY = 'LobeHub';

export const displayAuthor = (author?: string): string | undefined =>
  author === OFFICIAL_AUTHOR_KEY ? BRANDING_NAME : author;
