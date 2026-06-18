import type { UserGeneralConfig } from '@lobechat/types';

export const DEFAULT_COST_ESTIMATE_WARNING_THRESHOLD = 2;

export const DEFAULT_COMMON_SETTINGS: UserGeneralConfig = {
  animationMode: 'agile',
  // Appearance panel removed: contextMenuMode is pinned to 'default' in the selector.
  contextMenuMode: 'default',
  costEstimateWarningThreshold: DEFAULT_COST_ESTIMATE_WARNING_THRESHOLD,
  fontSize: 14,
  highlighterTheme: 'lobe-theme',
  isDevMode: false,
  isLiteMode: false,
  mermaidTheme: 'lobe-theme',
  telemetry: true,
  // Appearance panel removed: default transition changed from 'fadeIn' to 'smooth'.
  transitionMode: 'smooth',
};
