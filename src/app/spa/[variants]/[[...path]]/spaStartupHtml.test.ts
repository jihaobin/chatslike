import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripStartupLoadingScreen } from '../../../../../scripts/stripStartupLoadingScreen.mjs';
import { mobileHtmlTemplate } from './mobileHtmlTemplate.source';

const rootIndexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('SPA startup HTML', () => {
  it('does not inline the loading screen in the local dev HTML entry', () => {
    expect(rootIndexHtml).not.toContain('id="loading-screen"');
    expect(rootIndexHtml).not.toContain('id="loading-brand"');
  });

  it('does not inline the loading screen in the mobile SPA template source', () => {
    expect(mobileHtmlTemplate).not.toContain('id="loading-screen"');
    expect(mobileHtmlTemplate).not.toContain('id="loading-brand"');
  });

  it('strips loading screen markup from generated server SPA templates', () => {
    const generatedHtml = stripStartupLoadingScreen(`
      <style>
        html body {
          background: #f8f8f8;
        }
        #loading-screen {
          position: fixed;
          inset: 0;
        }
        @keyframes loading-draw {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes loading-fill {
          30% { fill-opacity: 0.05; }
          100% { fill-opacity: 1; }
        }
        #loading-brand {
          color: #1f1f1f;
        }
        #loading-brand svg path {
          animation: loading-draw 2s infinite, loading-fill 2s infinite;
        }
        html[data-theme='dark'] #loading-brand {
          color: #f0f0f0;
        }
      </style>
      <body>
        <div id="loading-screen">
          <div id="loading-brand" aria-label="Loading" role="status">
            <svg><title>LobeHub</title><path d="M0 0" /></svg>
          </div>
        </div>
        <div id="root" style="height: 100%"></div>
      </body>
    `);

    expect(generatedHtml).not.toContain('id="loading-screen"');
    expect(generatedHtml).not.toContain('id="loading-brand"');
    expect(generatedHtml).not.toContain('@keyframes loading-draw');
    expect(generatedHtml).not.toContain('@keyframes loading-fill');
  });
});
