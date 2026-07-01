import react from '@vitejs/plugin-react';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import type { ModulePreloadOptions } from 'vite';

import { viteEmotionSpeedy } from './emotionSpeedy';
import { viteMarkdownImport } from './markdownImport';
import { viteNodeModuleStub } from './nodeModuleStub';
import { vitePlatformResolve } from './platformResolve';
import { routeChunkPreload } from './routeChunkPreload';

/**
 * Shared manual chunk naming — groups leaf-node modules to reduce chunk file count.
 * Only targets pure data modules (no downstream dependents) to avoid facade chunk issues.
 */
/** Large i18n namespaces that get their own per-locale chunk instead of merging into the locale bundle */
const HEAVY_NS = new Set(['models', 'modelProvider']);

/** antd locale filename → app locale */
const ANTD_LOCALE: Record<string, string> = {
  ar_EG: 'ar',
  bg_BG: 'bg-BG',
  de_DE: 'de-DE',
  en_US: 'en-US',
  es_ES: 'es-ES',
  fa_IR: 'fa-IR',
  fr_FR: 'fr-FR',
  it_IT: 'it-IT',
  ja_JP: 'ja-JP',
  ko_KR: 'ko-KR',
  nl_NL: 'nl-NL',
  pl_PL: 'pl-PL',
  pt_BR: 'pt-BR',
  ru_RU: 'ru-RU',
  tr_TR: 'tr-TR',
  vi_VN: 'vi-VN',
  zh_CN: 'zh-CN',
  zh_TW: 'zh-TW',
};

/** dayjs locale filename → app locale */
const DAYJS_LOCALE: Record<string, string> = {
  'ar': 'ar',
  'bg': 'bg-BG',
  'de': 'de-DE',
  'en': 'en-US',
  'es': 'es-ES',
  'fa': 'fa-IR',
  'fr': 'fr-FR',
  'it': 'it-IT',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'pt-br': 'pt-BR',
  'ru': 'ru-RU',
  'tr': 'tr-TR',
  'vi': 'vi-VN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
};

const isNodePackage = (id: string, packageName: string) => {
  const normalized = id.replaceAll('\\', '/');

  return normalized.includes(`/node_modules/${packageName}/`);
};

const toKebabCase = (value: string) =>
  value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-+|-+$/g, '')
    .toLowerCase();

function getAppModuleChunkName(moduleId: string): string | null {
  const normalized = moduleId.replaceAll('\\', '/');

  if (normalized.includes('/node_modules/')) return null;
  if (normalized.includes('/src/routes/')) return 'app-routes';
  if (normalized.includes('/src/store/')) return 'app-store';
  if (normalized.includes('/src/services/')) return 'app-services';

  const featureMatch = normalized.match(/\/src\/features\/([^/]+)/);
  if (featureMatch) return `app-feature-${toKebabCase(featureMatch[1])}`;

  return null;
}

function sharedManualChunks(id: string): string | undefined {
  // i18n locale JSON/TS files
  const localeMatch = id.match(/\/locales\/([^/]+)\/([^/.]+)/);
  if (localeMatch) {
    const [, locale, ns] = localeMatch;
    if (locale === 'default') return 'i18n-default';
    if (HEAVY_NS.has(ns)) return `i18n-${locale}-${ns}`;
    return `i18n-${locale}`;
  }

  if (id.includes('/packages/model-runtime/') || isNodePackage(id, 'openai'))
    return 'vendor-ai-runtime';

  // model-bank (monorepo package — split before node_modules guard)
  if (id.includes('model-bank')) return 'providerConfig';

  if (!id.includes('node_modules')) return;

  // antd locale → merge into i18n-{locale}
  const antdMatch = id.match(/antd\/es\/locale\/([^/.]+)\.js/);
  if (antdMatch) {
    const locale = ANTD_LOCALE[antdMatch[1]];
    if (locale) return `i18n-${locale}`;
  }

  // dayjs locale → merge into i18n-{locale}
  const dayjsMatch = id.match(/dayjs\/locale\/([^/.]+)\.js/);
  if (dayjsMatch) {
    const locale = DAYJS_LOCALE[dayjsMatch[1]];
    if (locale) return `i18n-${locale}`;
  }

  if (
    isNodePackage(id, 'react') ||
    isNodePackage(id, 'react-dom') ||
    isNodePackage(id, 'react-router') ||
    isNodePackage(id, 'react-router-dom') ||
    isNodePackage(id, 'scheduler')
  ) {
    return 'vendor-react';
  }

  if (
    id.includes('es-toolkit') ||
    id.includes('@emotion/') ||
    id.includes('/motion/') ||
    id.includes('framer-motion')
  ) {
    return 'vendor-ui-runtime';
  }

  if (
    isNodePackage(id, 'dayjs') ||
    isNodePackage(id, 'i18next') ||
    isNodePackage(id, 'react-i18next') ||
    isNodePackage(id, 'swr') ||
    isNodePackage(id, 'zustand')
  ) {
    return 'vendor-data-runtime';
  }

  // Lucide icons
  if (id.includes('lucide-react')) return 'vendor-icons';
}

const sharedChunkFileNames = (chunkInfo: { name: string }) => {
  const { name } = chunkInfo;
  if (name.startsWith('i18n-')) return 'i18n/[name]-[hash].js';
  if (name.startsWith('vendor-')) return 'vendor/[name]-[hash].js';
  return 'assets/[name]-[hash].js';
};

const isI18nChunkFileName = (fileName: string) => {
  const normalized = fileName.split('?')[0].replaceAll('\\', '/');
  const basename = normalized.split('/').at(-1) ?? normalized;

  return normalized.startsWith('i18n/') || basename.startsWith('i18n-');
};

const isAppChunkFileName = (fileName: string) => {
  const basename = fileName.split('?')[0].replaceAll('\\', '/').split('/').at(-1) ?? fileName;

  return (
    basename.startsWith('app-routes-') ||
    basename.startsWith('app-feature-') ||
    basename.startsWith('app-store-') ||
    basename.startsWith('app-services-') ||
    basename === 'app-routes.js' ||
    basename === 'app-store.js' ||
    basename === 'app-services.js'
  );
};

export const sharedModulePreload = {
  resolveDependencies: (_filename, deps, context) =>
    deps.filter((dep) => {
      if (isI18nChunkFileName(dep)) return false;
      if (context.hostType === 'html' && isAppChunkFileName(dep)) return false;

      return true;
    }),
} satisfies ModulePreloadOptions;

export const sharedRollupOutput = {
  chunkFileNames: sharedChunkFileNames,
  manualChunks: sharedManualChunks,
};

interface SharedRolldownOutputOptions {
  strictExecutionOrder?: boolean;
}

export const createSharedRolldownOutput = (options: SharedRolldownOutputOptions = {}) => ({
  chunkFileNames: sharedChunkFileNames,
  strictExecutionOrder: options.strictExecutionOrder ?? true,
  codeSplitting: {
    groups: [
      {
        name: (moduleId: string) => {
          const manualChunk = sharedManualChunks(moduleId);
          if (manualChunk) return manualChunk;

          // 性能优化: 将小的路由组件合并，减少文件数量
          // 在高延迟网络环境下，减少请求数比缓存粒度更重要
          const appChunkName = getAppModuleChunkName(moduleId);
          if (appChunkName) return appChunkName;

          return null;
        },
        // 最小 chunk 大小: 50KB，避免产生过多小文件
        minSize: 50000,
      },
    ],
  },
});

type Platform = 'web' | 'mobile' | 'desktop';

const isDev = process.env.NODE_ENV !== 'production';
const enableRouteChunkPreload = process.env.LOBE_ROUTE_CHUNK_PRELOAD !== 'false';

interface SharedRendererOptions {
  platform: Platform;
  tsconfigPaths?: boolean;
}

export function sharedRendererPlugins(options: SharedRendererOptions) {
  return [
    viteEmotionSpeedy(),
    viteMarkdownImport(),
    viteNodeModuleStub(),
    vitePlatformResolve(options.platform),
    enableRouteChunkPreload && routeChunkPreload(),

    isDev && {
      name: 'lobe-dev-strip-manifest',
      transformIndexHtml: {
        order: 'pre' as const,
        handler: (html: string) => html.replace(/\s*<link\s+rel="manifest"[^>]*>\s*/i, '\n    '),
      },
    },

    isDev &&
      codeInspectorPlugin({
        bundler: 'vite',
        exclude: [/\.(css|json|html)$/],
        hotKeys: ['altKey', 'ctrlKey'],
      }),
    react(),
  ];
}

export function sharedRendererDefine(options: { isElectron: boolean; isMobile: boolean }) {
  const nextPublicDefine = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.toUpperCase().startsWith('NEXT_PUBLIC_'))
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );

  return {
    '__CI__': process.env.CI === 'true' ? 'true' : 'false',
    '__DEV__': process.env.NODE_ENV !== 'production' ? 'true' : 'false',
    '__ELECTRON__': JSON.stringify(options.isElectron),
    '__MOBILE__': JSON.stringify(options.isMobile),
    '__TEST__': 'false',
    ...nextPublicDefine,
    // Keep a safe fallback so generic `process.env` access won't crash in browser runtime.
    'process.env': '{}',
  };
}

export const sharedOptimizeDeps = {
  include: [
    'react',
    'react-dom',
    'react-dom/client',
    'react-router-dom',
    'antd',
    '@ant-design/icons',
    '@lobehub/ui',
    '@lobehub/ui > @emotion/react',
    'antd-style',
    'zustand',
    'zustand/middleware',
    'swr',
    'i18next',
    'react-i18next',
    'dayjs',
    'dayjs/esm/locale/ar',
    'dayjs/esm/locale/bg',
    'dayjs/esm/locale/de',
    'dayjs/esm/locale/en',
    'dayjs/esm/locale/es',
    'dayjs/esm/locale/fa',
    'dayjs/esm/locale/fr',
    'dayjs/esm/locale/it',
    'dayjs/esm/locale/ja',
    'dayjs/esm/locale/ko',
    'dayjs/esm/locale/nl',
    'dayjs/esm/locale/pl',
    'dayjs/esm/locale/pt-br',
    'dayjs/esm/locale/ru',
    'dayjs/esm/locale/tr',
    'dayjs/esm/locale/vi',
    'dayjs/esm/locale/zh-cn',
    'dayjs/esm/locale/zh-tw',

    'ahooks',
    'motion/react',
  ],
};

export const sharedResolveDedupe = [
  '@lobehub/ui',
  '@lobehub/ui/base-ui',
  '@lobehub/ui/brand',
  '@lobehub/ui/icons',
  '@lobehub/ui/mobile',
  '@lobehub/ui/awesome',
  'motion',
  'react',
  'react-dom',
  'react/jsx-runtime',
];

export const __testing = {
  getAppModuleChunkName,
  sharedResolveDedupe,
  sharedManualChunks,
};
