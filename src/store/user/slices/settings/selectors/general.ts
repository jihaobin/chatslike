import { DEFAULT_LANG } from '@/const/locale';
import { type Locales, normalizeLocale } from '@/locales/resources';
import { isOnServerSide } from '@/utils/env';

import { type UserStore } from '../../../store';
import { currentSettings } from './settings';

// Advanced settings panel removed: `isDevMode` is pinned to false and no longer reads
// user preference, so dev-only UI stays hidden across the app.
const generalConfig = (s: UserStore) => ({ ...currentSettings(s).general, isDevMode: false });

const neutralColor = (s: UserStore) => generalConfig(s).neutralColor;
const primaryColor = (s: UserStore) => generalConfig(s).primaryColor;
const fontSize = (s: UserStore) => generalConfig(s).fontSize;
const highlighterTheme = (s: UserStore) => generalConfig(s).highlighterTheme;
const mermaidTheme = (s: UserStore) => generalConfig(s).mermaidTheme;
const transitionMode = (s: UserStore) => generalConfig(s).transitionMode;
const animationMode = (s: UserStore) => generalConfig(s).animationMode;
// Appearance panel removed: context menu is pinned to 'default' so all platforms behave
// consistently, rather than deriving from the runtime environment.
const contextMenuMode = (s: UserStore) => generalConfig(s).contextMenuMode ?? 'default';
const responseLanguage = (s: UserStore) => generalConfig(s).responseLanguage;
const currentResponseLanguage = (s: UserStore): Locales => {
  const locale = responseLanguage(s);

  if (locale) return normalizeLocale(locale);
  if (isOnServerSide) return DEFAULT_LANG;

  return normalizeLocale(navigator.language);
};
const telemetry = (s: UserStore) => generalConfig(s).telemetry;
const enableAutoScrollOnStreaming = (s: UserStore) =>
  generalConfig(s).enableAutoScrollOnStreaming ?? true;

export const userGeneralSettingsSelectors = {
  animationMode,
  config: generalConfig,
  contextMenuMode,
  enableAutoScrollOnStreaming,
  fontSize,
  highlighterTheme,
  mermaidTheme,
  neutralColor,
  primaryColor,
  currentResponseLanguage,
  responseLanguage,
  telemetry,
  transitionMode,
};
