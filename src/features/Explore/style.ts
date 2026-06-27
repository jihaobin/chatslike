import { createStaticStyles } from 'antd-style';

/** Shared layout primitives used across Explore sections and Pricing.tsx */
export const styles = createStaticStyles(({ css, cssVar }) => ({
  // Used by Pricing.tsx — keep these class names stable
  container: css`
    overflow-y: auto;
    width: 100%;
    height: 100%;
    background: ${cssVar.colorBgContainer};
  `,
  content: css`
    width: 100%;
    max-width: 1200px;
    margin-inline: auto;
    padding: 24px;
  `,
}));
