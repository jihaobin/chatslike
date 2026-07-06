'use client';

import { defineFixtures, single, variants } from './_helpers';

export default defineFixtures({
  identifier: 'lobe-web-browsing',
  fixtures: {
    crawlMultiPages: single({
      args: {
        urls: ['https://news.qq.com/rain/a/20260520A05GCN00', 'https://example.com/agentic-cloud'],
      },
      pluginState: {
        results: [
          {
            crawler: 'firecrawl',
            data: {
              content:
                '## 阿里云峰会发布真武M890\n\n阿里巴巴年度云栖峰会上集中亮出 AI 技术底牌，推出新一代 AI 芯片与模型服务。\n\n![AI infrastructure](https://images.unsplash.com/photo-1518770660439-4636190af475)\n\n真武M890 面向大规模推理场景，配合千问旗舰模型和云端推理服务，形成从芯片到应用的完整链路。',
              description:
                '阿里巴巴年度云栖峰会上集中亮出 AI 技术底牌，推出新一代 AI 芯片与模型服务。',
              title: '阿里云峰会：发布“真武M890”AI芯片、千问旗舰模型Qwen3.7-Max上线',
              url: 'https://news.qq.com/rain/a/20260520A05GCN00',
            },
            originalUrl: 'https://news.qq.com/rain/a/20260520A05GCN00',
          },
          {
            crawler: 'firecrawl',
            data: {
              content:
                '## 面向 Agentic 时代的全栈体系\n\n阿里云在峰会上宣布 Agent 化升级，同步推出多项面向智能体的基础设施。\n\n新的技术栈覆盖芯片、云平台、模型服务和推理调度，重点降低智能体应用的大规模部署成本。',
              description: '阿里云在峰会上宣布 Agent 化升级，同步推出多项面向智能体的基础设施。',
              title: '面向Agentic时代，阿里云重构“芯-云-模型-推理”全栈技术体系',
              url: 'https://example.com/agentic-cloud',
            },
            originalUrl: 'https://example.com/agentic-cloud',
          },
        ],
      },
    }),
    crawlSinglePage: single({
      args: { url: 'https://example.com/qianwen-cloud' },
      pluginState: {
        results: [
          {
            crawler: 'firecrawl',
            data: {
              content:
                '## 阿里云推出AI产品官网“千问云”\n\n北京商报报道阿里云推出面向 AI 产品的新官网与平台能力。\n\n平台聚合模型调用、知识库、智能体编排和企业级权限管理，帮助开发者更快构建生产级 AI 应用。\n\n### 平台能力\n\n- 模型服务统一入口\n- 智能体工作流编排\n- 企业级安全与审计',
              description: '北京商报报道阿里云推出面向 AI 产品的新官网与平台能力。',
              title: '阿里云推出AI产品官网“千问云”',
              url: 'https://example.com/qianwen-cloud',
            },
            originalUrl: 'https://example.com/qianwen-cloud',
          },
        ],
      },
    }),
    search: variants([
      {
        args: {
          query: '阿里云峰会 AI 产品 发布',
          searchEngines: ['google', 'bing'],
        },
        label: 'With results',
        pluginState: {
          query: '阿里云峰会 AI 产品 发布',
          results: [
            {
              content: '阿里巴巴年度云栖峰会上集中亮出 AI 技术底牌，推出新一代 AI 芯片与模型服务。',
              engines: ['QQ News'],
              title: '阿里云峰会：发布“真武M890”AI芯片、千问旗舰模型Qwen3.7-Max上线',
              url: 'https://news.qq.com/rain/a/20260520A05GCN00',
            },
            {
              content: '阿里云在峰会上宣布 Agent 化升级，同步推出多项面向智能体的基础设施。',
              engines: ['同花顺'],
              title: '面向Agentic时代，阿里云重构“芯-云-模型-推理”全栈技术体系',
              url: 'https://example.com/agentic-cloud',
            },
            {
              content: '北京商报报道阿里云推出面向 AI 产品的新官网与平台能力。',
              engines: ['北京商报'],
              title: '阿里云推出AI产品官网“千问云”',
              url: 'https://example.com/qianwen-cloud',
            },
            {
              content: '开发者社区整理了大会上的模型、平台和推理服务升级。',
              engines: ['阿里云开发者社区'],
              title: '阿里云发布为Agent而生的全新AI产品',
              url: 'https://developer.aliyun.com/article/example',
            },
            {
              content: '网易报道大会发布的多项 AI 基础设施和应用服务。',
              engines: ['网易'],
              title: '阿里云发布为Agent而生的全新AI产品官网“千问云”',
              url: 'https://www.163.com/example',
            },
          ],
        },
      },
      {
        args: {
          query: 'undocumented internal preview snapshot harness',
          searchEngines: ['google'],
        },
        label: 'No results',
        pluginState: {
          query: 'undocumented internal preview snapshot harness',
          results: [],
        },
      },
    ]),
  },
});
