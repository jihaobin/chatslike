import type { Plugin } from 'vite';

interface DirectImportRule {
  mode: 'default' | 'named';
  path: string;
}

const componentRules = {
  Accordion: { mode: 'named', path: '@lobehub/ui/es/Accordion/index' },
  AccordionItem: { mode: 'named', path: '@lobehub/ui/es/Accordion/index' },
  ActionIcon: { mode: 'default', path: '@lobehub/ui/es/ActionIcon/index' },
  Alert: { mode: 'default', path: '@lobehub/ui/es/Alert/index' },
  AutoComplete: { mode: 'default', path: '@lobehub/ui/es/AutoComplete/index' },
  Avatar: { mode: 'default', path: '@lobehub/ui/es/Avatar/index' },
  Block: { mode: 'default', path: '@lobehub/ui/es/Block/index' },
  Button: { mode: 'default', path: '@lobehub/ui/es/Button/index' },
  Center: { mode: 'named', path: '@lobehub/ui/es/Flex/index' },
  Checkbox: { mode: 'default', path: '@lobehub/ui/es/Checkbox/index' },
  Collapse: { mode: 'default', path: '@lobehub/ui/es/Collapse/index' },
  ConfigProvider: { mode: 'default', path: '@lobehub/ui/es/ConfigProvider/index' },
  ContextMenuTrigger: { mode: 'named', path: '@lobehub/ui/es/ContextMenu/index' },
  CopyButton: { mode: 'default', path: '@lobehub/ui/es/CopyButton/index' },
  DropdownMenu: { mode: 'default', path: '@lobehub/ui/es/DropdownMenu/index' },
  EditableText: { mode: 'default', path: '@lobehub/ui/es/EditableText/index' },
  Empty: { mode: 'default', path: '@lobehub/ui/es/Empty/index' },
  FileTypeIcon: { mode: 'default', path: '@lobehub/ui/es/FileTypeIcon/index' },
  Flexbox: { mode: 'named', path: '@lobehub/ui/es/Flex/index' },
  FluentEmoji: { mode: 'default', path: '@lobehub/ui/es/FluentEmoji/index' },
  Form: { mode: 'default', path: '@lobehub/ui/es/Form/index' },
  Grid: { mode: 'default', path: '@lobehub/ui/es/Grid/index' },
  Highlighter: { mode: 'default', path: '@lobehub/ui/es/Highlighter/index' },
  Icon: { mode: 'default', path: '@lobehub/ui/es/Icon/index' },
  Image: { mode: 'default', path: '@lobehub/ui/es/Image/index' },
  Input: { mode: 'default', path: '@lobehub/ui/es/Input/Input' },
  InputNumber: { mode: 'default', path: '@lobehub/ui/es/Input/InputNumber' },
  InputPassword: { mode: 'default', path: '@lobehub/ui/es/Input/InputPassword' },
  Markdown: { mode: 'default', path: '@lobehub/ui/es/Markdown/index' },
  MaterialFileTypeIcon: { mode: 'default', path: '@lobehub/ui/es/MaterialFileTypeIcon/index' },
  Mermaid: { mode: 'default', path: '@lobehub/ui/es/Mermaid/index' },
  Modal: { mode: 'default', path: '@lobehub/ui/es/Modal/index' },
  Popover: { mode: 'default', path: '@lobehub/ui/es/Popover/index' },
  ScrollArea: { mode: 'named', path: '@lobehub/ui/es/ScrollArea/index' },
  ScrollShadow: { mode: 'default', path: '@lobehub/ui/es/ScrollShadow/index' },
  SearchBar: { mode: 'default', path: '@lobehub/ui/es/SearchBar/index' },
  Segmented: { mode: 'default', path: '@lobehub/ui/es/Segmented/index' },
  Select: { mode: 'default', path: '@lobehub/ui/es/Select/index' },
  Skeleton: { mode: 'default', path: '@lobehub/ui/es/Skeleton/index' },
  SliderWithInput: { mode: 'default', path: '@lobehub/ui/es/SliderWithInput/index' },
  Snippet: { mode: 'default', path: '@lobehub/ui/es/Snippet/index' },
  SortableList: { mode: 'default', path: '@lobehub/ui/es/SortableList/index' },
  Tag: { mode: 'default', path: '@lobehub/ui/es/Tag/Tag' },
  Text: { mode: 'default', path: '@lobehub/ui/es/Text/index' },
  TextArea: { mode: 'default', path: '@lobehub/ui/es/Input/TextArea' },
  ThemeProvider: { mode: 'default', path: '@lobehub/ui/es/ThemeProvider/index' },
  Tooltip: { mode: 'default', path: '@lobehub/ui/es/Tooltip/index' },
  TooltipGroup: { mode: 'default', path: '@lobehub/ui/es/base-ui/Tooltip/TooltipGroup' },
  Typography: { mode: 'named', path: '@lobehub/ui/es/Markdown/index' },
} as const satisfies Record<string, DirectImportRule>;

const typeRules = {
  ActionIconSize: { mode: 'named', path: '@lobehub/ui/es/ActionIcon/index' },
  ActionIconProps: { mode: 'named', path: '@lobehub/ui/es/ActionIcon/index' },
  AutoCompleteProps: { mode: 'named', path: '@lobehub/ui/es/AutoComplete/index' },
  BlockProps: { mode: 'named', path: '@lobehub/ui/es/Block/index' },
  ButtonProps: { mode: 'named', path: '@lobehub/ui/es/Button/index' },
  CenterProps: { mode: 'named', path: '@lobehub/ui/es/Flex/index' },
  DropdownItem: { mode: 'named', path: '@lobehub/ui/es/DropdownMenu/index' },
  DropdownMenuProps: { mode: 'named', path: '@lobehub/ui/es/DropdownMenu/index' },
  FlexboxProps: { mode: 'named', path: '@lobehub/ui/es/Flex/index' },
  GridProps: { mode: 'named', path: '@lobehub/ui/es/Grid/index' },
  IconProps: { mode: 'named', path: '@lobehub/ui/es/Icon/index' },
  IconSize: { mode: 'named', path: '@lobehub/ui/es/Icon/index' },
  ImageProps: { mode: 'named', path: '@lobehub/ui/es/Image/index' },
  InputProps: { mode: 'named', path: '@lobehub/ui/es/Input/index' },
  MenuProps: { mode: 'named', path: '@lobehub/ui/es/Menu/index' },
  ModalInstance: { mode: 'named', path: '@lobehub/ui/es/Modal/index' },
  ModalProps: { mode: 'named', path: '@lobehub/ui/es/Modal/index' },
  SegmentedProps: { mode: 'named', path: '@lobehub/ui/es/Segmented/index' },
  SliderWithInputProps: { mode: 'named', path: '@lobehub/ui/es/SliderWithInput/index' },
  TextAreaProps: { mode: 'named', path: '@lobehub/ui/es/Input/index' },
  TooltipProps: { mode: 'named', path: '@lobehub/ui/es/Tooltip/index' },
  TypographyProps: { mode: 'named', path: '@lobehub/ui/es/Markdown/index' },
} as const satisfies Record<string, DirectImportRule>;

const valueRules = {
  ...componentRules,
  closeContextMenu: { mode: 'named', path: '@lobehub/ui/es/ContextMenu/index' },
  combineKeys: { mode: 'named', path: '@lobehub/ui/es/Hotkey/index' },
  copyToClipboard: { mode: 'named', path: '@lobehub/ui/es/utils/copyToClipboard' },
  createModal: { mode: 'named', path: '@lobehub/ui/es/Modal/index' },
  createRawModal: { mode: 'named', path: '@lobehub/ui/es/Modal/index' },
  showContextMenu: { mode: 'named', path: '@lobehub/ui/es/ContextMenu/index' },
  stopPropagation: { mode: 'named', path: '@lobehub/ui/es/utils/dom' },
  toast: { mode: 'named', path: '@lobehub/ui/es/base-ui/Toast/imperative' },
  useModalContext: { mode: 'named', path: '@lobehub/ui/es/Modal/index' },
} as const satisfies Record<string, DirectImportRule>;

interface ImportSpecifier {
  imported: string;
  isType: boolean;
  local: string;
  raw: string;
}

const importPattern =
  /import\s+(type\s+)?\{(?<specifiers>[\s\S]*?)\}\s+from\s+['"]@lobehub\/ui['"];?/g;

const hasOwn = <T extends object>(object: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(object, key);

const getRule = (specifier: ImportSpecifier): DirectImportRule | undefined => {
  if (specifier.isType) {
    return hasOwn(typeRules, specifier.imported) ? typeRules[specifier.imported] : undefined;
  }

  return hasOwn(valueRules, specifier.imported) ? valueRules[specifier.imported] : undefined;
};

const toNamedSpecifier = (specifier: ImportSpecifier) => {
  return specifier.local === specifier.imported
    ? specifier.imported
    : `${specifier.imported} as ${specifier.local}`;
};

const parseImportSpecifiers = (source: string, importTypeOnly: boolean): ImportSpecifier[] => {
  return source
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const isType = importTypeOnly || raw.startsWith('type ');
      const value = raw.replace(/^type\s+/, '').trim();
      const match = /^(?<imported>[$\w]+)(?:\s+as\s+(?<local>[$\w]+))?$/.exec(value);

      if (!match?.groups) return { imported: value, isType, local: value, raw };

      return {
        imported: match.groups.imported,
        isType,
        local: match.groups.local ?? match.groups.imported,
        raw,
      };
    });
};

const createImportLine = (rule: DirectImportRule, specifier: ImportSpecifier) => {
  if (specifier.isType) {
    return `import type { ${toNamedSpecifier(specifier)} } from '${rule.path}';`;
  }

  if (rule.mode === 'default') {
    return `import ${specifier.local} from '${rule.path}';`;
  }

  return `import { ${toNamedSpecifier(specifier)} } from '${rule.path}';`;
};

const createRootImportLine = (specifiers: ImportSpecifier[], importTypeOnly: boolean) => {
  if (specifiers.length === 0) return '';

  const body = specifiers
    .map((specifier) => (importTypeOnly || specifier.isType ? specifier.raw : specifier.raw))
    .join(', ');

  return `import ${importTypeOnly ? 'type ' : ''}{ ${body} } from '@lobehub/ui';`;
};

const shouldTransform = (id: string) => {
  if (id.includes('/node_modules/') || id.includes('\\node_modules\\')) return false;
  if (id.endsWith('.d.ts') || id.endsWith('.d.mts')) return false;

  return /\.(?:[cm]?[jt]sx?)$/.test(id.split('?')[0]);
};

export const transformLobeUiDirectImports = (code: string) => {
  if (!code.includes('@lobehub/ui')) return code;

  return code.replaceAll(importPattern, (fullMatch, typeKeyword: string | undefined, specifiers) => {
    const importTypeOnly = Boolean(typeKeyword);
    const parsed = parseImportSpecifiers(specifiers, importTypeOnly);
    const directImports: string[] = [];
    const remainingSpecifiers: ImportSpecifier[] = [];

    for (const specifier of parsed) {
      const rule = getRule(specifier);

      if (rule) {
        directImports.push(createImportLine(rule, specifier));
      } else {
        remainingSpecifiers.push(specifier);
      }
    }

    if (directImports.length === 0) return fullMatch;

    const rootImport = createRootImportLine(remainingSpecifiers, importTypeOnly);

    return [...directImports, rootImport].filter(Boolean).join('\n');
  });
};

export const viteLobeUiDirectImport = (): Plugin => ({
  name: 'lobe-ui-direct-import',
  transform(code, id) {
    if (!shouldTransform(id)) return null;

    const transformed = transformLobeUiDirectImports(code);
    if (transformed === code) return null;

    return {
      code: transformed,
      map: null,
    };
  },
});
