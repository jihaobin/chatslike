import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus } from '@/types/asyncTask';
import type { GenerationBatch } from '@/types/generation';

import { VideoGenerationBatchItem } from './BatchItem';

const retryVideoGenerationTask = vi.fn();
const useCheckGenerationStatus = vi.fn();

vi.mock('@lobehub/icons', () => ({
  ModelTag: ({ model }: { model: string }) => <span>{model}</span>,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIconGroup: ({ items }: { items: { key: string; label: string }[] }) => (
    <div>
      {items.map((item) => (
        <button key={item.key} type="button">
          {item.label}
        </button>
      ))}
    </div>
  ),
  Block: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Markdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
        success: vi.fn(),
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    batchActions: 'batch-actions',
    container: 'container',
  }),
}));

vi.mock('@/business/client/hooks/useRenderBusinessVideoBatchItem', () => ({
  default: () => ({ businessBatchItem: null, shouldRenderBusinessBatchItem: false }),
}));

vi.mock('@/routes/(main)/(create)/features/GenerationInput', () => ({
  GenerationInvalidAPIKey: () => <div>Invalid API Key</div>,
}));

vi.mock('@/store/video', () => ({
  useVideoStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeGenerationTopicId: 'topic-1',
      removeGeneration: vi.fn(),
      removeGenerationBatch: vi.fn(),
      retryVideoGenerationTask,
      setModelAndProviderOnSelect: vi.fn(),
      setParamOnInput: vi.fn(),
      useCheckGenerationStatus,
    }),
}));

vi.mock('./VideoErrorItem', () => ({
  default: () => <div>Video failed</div>,
}));

vi.mock('./VideoLoadingItem', () => ({
  default: () => <div>Video loading</div>,
}));

vi.mock('./VideoReferenceFrames', () => ({
  default: () => <div>Reference frames</div>,
}));

vi.mock('./VideoSuccessItem', () => ({
  default: () => <div>Video success</div>,
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'generation.actions.copyPrompt': 'Copy Prompt',
          'generation.actions.deleteBatch': 'Delete Batch',
          'generation.actions.reuseSettings': 'Reuse Settings',
          'generation.actions.retryProcessing': 'Retry Processing',
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

const createBatch = (status: AsyncTaskStatus): GenerationBatch => ({
  createdAt: new Date('2026-06-11T13:12:41.000Z'),
  generations: [
    {
      asyncTaskId: 'task-1',
      createdAt: new Date('2026-06-11T13:12:41.000Z'),
      id: 'generation-1',
      task: {
        error:
          status === AsyncTaskStatus.Error
            ? { body: { detail: 'Background polling failed' }, name: 'ServerError' }
            : undefined,
        id: 'task-1',
        status,
      },
    },
  ],
  id: 'batch-1',
  model: 'doubao-seedance-2.0-fast',
  prompt: 'Generate a low quality test video',
  provider: 'doubao',
});

describe('VideoGenerationBatchItem', () => {
  it('renders a visible retry processing button for failed video generations', () => {
    render(<VideoGenerationBatchItem batch={createBatch(AsyncTaskStatus.Error)} />);

    expect(screen.getByRole('button', { name: 'Retry Processing' })).toBeInTheDocument();
  });

  it('does not render the retry processing button for pending video generations', () => {
    render(<VideoGenerationBatchItem batch={createBatch(AsyncTaskStatus.Pending)} />);

    expect(screen.queryByRole('button', { name: 'Retry Processing' })).not.toBeInTheDocument();
  });
});
