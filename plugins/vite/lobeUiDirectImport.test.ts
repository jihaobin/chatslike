import { describe, expect, it } from 'vitest';

import { transformLobeUiDirectImports } from './lobeUiDirectImport';

describe('transformLobeUiDirectImports', () => {
  it('rewrites common value imports to component-level entrypoints', () => {
    const code = "import { Button, Flexbox, Icon } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import Button from '@lobehub/ui/es/Button/index';",
        "import { Flexbox } from '@lobehub/ui/es/Flex/index';",
        "import Icon from '@lobehub/ui/es/Icon/index';",
      ].join('\n'),
    );
  });

  it('keeps aliases while preserving unsupported specifiers on the root import', () => {
    const code = "import { Button as LobeButton, UnknownWidget } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import LobeButton from '@lobehub/ui/es/Button/index';",
        "import { UnknownWidget } from '@lobehub/ui';",
      ].join('\n'),
    );
  });

  it('rewrites type-only imports to type imports from direct paths', () => {
    const code = "import type { FlexboxProps, MenuProps } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import type { FlexboxProps } from '@lobehub/ui/es/Flex/index';",
        "import type { MenuProps } from '@lobehub/ui/es/Menu/index';",
      ].join('\n'),
    );
  });

  it('rewrites inline type specifiers without turning value imports into type imports', () => {
    const code = "import { type IconProps, Icon } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import type { IconProps } from '@lobehub/ui/es/Icon/index';",
        "import Icon from '@lobehub/ui/es/Icon/index';",
      ].join('\n'),
    );
  });

  it('rewrites components whose type index does not have a matching runtime module', () => {
    const code = "import { Input, InputNumber, InputPassword, Tag, TextArea } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import Input from '@lobehub/ui/es/Input/Input';",
        "import InputNumber from '@lobehub/ui/es/Input/InputNumber';",
        "import InputPassword from '@lobehub/ui/es/Input/InputPassword';",
        "import Tag from '@lobehub/ui/es/Tag/Tag';",
        "import TextArea from '@lobehub/ui/es/Input/TextArea';",
      ].join('\n'),
    );
  });

  it('rewrites utility imports to existing utility files', () => {
    const code = "import { copyToClipboard, stopPropagation } from '@lobehub/ui';";

    expect(transformLobeUiDirectImports(code)).toBe(
      [
        "import { copyToClipboard } from '@lobehub/ui/es/utils/copyToClipboard';",
        "import { stopPropagation } from '@lobehub/ui/es/utils/dom';",
      ].join('\n'),
    );
  });
});
