import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelHandlers } from './usePanelHandlers';

const updateAgentConfig = vi.hoisted(() => vi.fn());

vi.mock('@/store/agent', () => ({
  useAgentStore: <T>(selector: (state: { updateAgentConfig: typeof updateAgentConfig }) => T) =>
    selector({ updateAgentConfig }),
}));

describe('usePanelHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the provided model change handler immediately', () => {
    const onModelChange = vi.fn();
    const { result } = renderHook(() => usePanelHandlers({ onModelChange }));

    act(() => {
      result.current.handleModelChange('deepseek-v4-pro', 'lobehub');
    });

    expect(onModelChange).toHaveBeenCalledWith({
      model: 'deepseek-v4-pro',
      provider: 'lobehub',
    });
    expect(updateAgentConfig).not.toHaveBeenCalled();
  });

  it('updates the active agent config immediately when no handler is provided', () => {
    const { result } = renderHook(() => usePanelHandlers({}));

    act(() => {
      result.current.handleModelChange('claude-opus-4-8', 'lobehub');
    });

    expect(updateAgentConfig).toHaveBeenCalledWith({
      model: 'claude-opus-4-8',
      provider: 'lobehub',
    });
  });

  it('closes the panel through the open change handler', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => usePanelHandlers({ onOpenChange }));

    act(() => {
      result.current.handleClose();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
