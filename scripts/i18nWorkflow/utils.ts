import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import prettier from '@prettier/sync';
import { consola } from 'consola';
import { colors } from 'consola/utils';

import i18nConfig from './i18nConfig';

const prettierOptions = prettier.resolveConfig(path.resolve(__dirname, '../../.prettierrc.js'));
const fileWriteRetryableErrors = new Set([
  'EACCES',
  'EBUSY',
  'EMFILE',
  'ENFILE',
  'EPERM',
  'UNKNOWN',
]);
const fileWriteMaxAttempts = 3;

const sleepSync = (ms: number) => {
  if (ms <= 0) return;

  const sharedBuffer = new SharedArrayBuffer(4);
  const sharedArray = new Int32Array(sharedBuffer);
  Atomics.wait(sharedArray, 0, 0, ms);
};

const isRetryableFileSystemError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const code = Reflect.get(error, 'code');
  return typeof code === 'string' && fileWriteRetryableErrors.has(code);
};

const writeTextFileSafely = (filePath: string, content: string) => {
  const tempFilePath = path.resolve(
    path.dirname(filePath),
    `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  for (let attempt = 0; attempt < fileWriteMaxAttempts; attempt += 1) {
    try {
      writeFileSync(tempFilePath, content, 'utf8');

      try {
        rmSync(filePath, { force: true });
      } catch {
        // Ignore destination cleanup failures and rely on rename/retry.
      }

      renameSync(tempFilePath, filePath);
      return;
    } catch (error) {
      try {
        rmSync(tempFilePath, { force: true });
      } catch {
        // Ignore temp cleanup failures and retry or rethrow below.
      }

      if (!isRetryableFileSystemError(error) || attempt === fileWriteMaxAttempts - 1) {
        throw error;
      }

      sleepSync(25 * 2 ** attempt);
    }
  }
};

export const readJSON = (filePath: string) => {
  const data = readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

export const writeJSON = (filePath: string, data: any) => {
  const jsonStr = JSON.stringify(data, null, 2);
  writeTextFileSafely(filePath, jsonStr);
};

export const writeJSONWithPrettier = (filePath: string, data: any) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const formatted = prettier.format(jsonStr, {
    ...prettierOptions,
    parser: 'json',
  });
  writeTextFileSafely(filePath, formatted);
};

export const genResourcesContent = (locales: string[]) => {
  let index = '';
  let indexObj = '';

  for (const locale of locales) {
    index += `import ${locale} from "./${locale}";\n`;
    indexObj += `   "${locale.replace('_', '-')}": ${locale},\n`;
  }

  return `${index}
const resources = {
${indexObj}} as const;
export default resources;
export const defaultResources = ${i18nConfig.entryLocale};
export type Resources = typeof resources;
export type DefaultResources = typeof defaultResources;
export type Namespaces = keyof DefaultResources;
export type Locales = keyof Resources;
`;
};

export const genNamespaceList = (files: string[], locale: string) => {
  return files.map((file) => ({
    name: file.replace('.json', ''),
    path: path.resolve(i18nConfig.output, locale, file),
  }));
};

export const tagBlue = (text: string) => colors.bgBlueBright(colors.black(` ${text} `));
export const tagYellow = (text: string) => colors.bgYellowBright(colors.black(` ${text} `));
export const tagGreen = (text: string) => colors.bgGreenBright(colors.black(` ${text} `));
export const tagWhite = (text: string) => colors.bgWhiteBright(colors.black(` ${text} `));

export const split = (name: string) => {
  consola.log('');
  consola.log(colors.gray(`========================== ${name} ==============================`));
};
