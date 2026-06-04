import { createStaticStyles } from 'antd-style';

export const billingPageStyles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    min-width: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  cardLabel: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  header: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
    color: ${cssVar.colorText};
  `,
  page: css`
    width: 100%;
  `,
  platformCatalog: css`
    width: 100%;
  `,
  platformMetric: css`
    min-width: 132px;
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgContainer};
  `,
  platformSidebar: css`
    width: 220px;
    min-width: 220px;
  `,
  platformStatusBar: css`
    align-items: stretch;
  `,
  platformTable: css`
    overflow: auto;
    min-width: 0;
  `,
  platformWorkbench: css`
    min-height: 420px;
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
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
}));
