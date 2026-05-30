import { createStaticStyles } from 'antd-style';

export const billingPageStyles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    min-width: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  cardLabel: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
  `,
  header: css`
    color: ${cssVar.colorText};
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
  `,
  page: css`
    width: 100%;
  `,
  section: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  sectionHeader: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  subtitle: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 13px;
  `,
}));
