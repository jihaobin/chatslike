declare module '@lobehub/ui/es/brand/BrandLoading/index' {
  import type { FC } from 'react';

  import type { DivProps, SvgProps } from '@lobehub/ui/es/types/index';

  export interface BrandLoadingProps {
    size?: number;
    text: FC<SvgProps & DivProps & { size?: number }>;
  }

  const BrandLoading: FC<BrandLoadingProps & SvgProps & DivProps>;

  export default BrandLoading;
}

declare module '@lobehub/ui/es/brand/LobeHubText/index' {
  import type { FC } from 'react';

  import type { DivProps, SvgProps } from '@lobehub/ui/es/types/index';

  const LobeHubText: FC<SvgProps & DivProps & { size?: number }>;

  export default LobeHubText;
}

declare module '@lobehub/ui/es/icons/lucideExtra/SkillsIcon' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';
  import type { LucideProps } from 'lucide-react';

  const SkillsIcon: ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >;

  export default SkillsIcon;
}
