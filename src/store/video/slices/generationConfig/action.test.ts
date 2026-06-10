import { act, renderHook } from '@testing-library/react';
import {
  type AIVideoModelCard,
  extractVideoDefaultValues,
  type RuntimeVideoGenParams,
  type VideoModelParamsSchema,
} from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiProviderSelectors } from '@/store/aiInfra';
import { useVideoStore } from '@/store/video';

const modelASchema: VideoModelParamsSchema = {
  prompt: { default: '' },
  imageUrl: { default: '' },
  endImageUrl: { default: '' },
  duration: { default: 5, min: 1, max: 10 },
};

const modelBSchema: VideoModelParamsSchema = {
  prompt: { default: '' },
  imageUrl: { default: '' },
  endImageUrl: { default: '' },
  duration: { default: 3, min: 1, max: 10 },
};

const testVideoModels: AIVideoModelCard[] = [
  {
    id: 'video-model-a',
    displayName: 'Video Model A',
    type: 'video',
    parameters: modelASchema,
    releasedAt: '2025-01-01',
  },
  {
    id: 'video-model-b',
    displayName: 'Video Model B',
    type: 'video',
    parameters: modelBSchema,
    releasedAt: '2025-01-02',
  },
];

const mockProviders = [
  {
    id: 'provider-a',
    name: 'Provider A',
    children: [testVideoModels[0]],
  },
  {
    id: 'provider-b',
    name: 'Provider B',
    children: [testVideoModels[1]],
  },
];

const mockProvidersWithoutParameters = [
  {
    id: 'provider-a',
    name: 'Provider A',
    children: [{ ...testVideoModels[0], parameters: undefined }],
  },
];

const enabledVideoModelListMock = vi.hoisted(() => vi.fn(() => mockProviders));

vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: {
    enabledVideoModelList: enabledVideoModelListMock,
  },
  getAiInfraStoreState: vi.fn(() => ({})),
}));

const modelBDefaultValues = extractVideoDefaultValues(modelBSchema);

beforeEach(() => {
  vi.clearAllMocks();
  enabledVideoModelListMock.mockReturnValue(mockProviders);

  useVideoStore.setState({
    isInit: true,
    model: 'video-model-a',
    provider: 'provider-a',
    parametersSchema: modelASchema,
    parameters: {
      prompt: 'initial prompt',
      imageUrl: 'start-frame.png',
      endImageUrl: 'end-frame.png',
      duration: 6,
    } as RuntimeVideoGenParams,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('video generationConfig actions', () => {
  it('should initialize to the first enabled video provider when no saved selection is available', () => {
    useVideoStore.setState({
      isInit: false,
      model: 'dreamina-seedance-2-0-260128',
      provider: 'lobehub',
    });

    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.initializeVideoConfig(true);
    });

    expect(result.current.isInit).toBe(true);
    expect(result.current.model).toBe('video-model-a');
    expect(result.current.provider).toBe('provider-a');
    expect(result.current.parametersSchema).toBe(modelASchema);
  });

  it('should initialize with fallback video parameters when the selected model has no schema', () => {
    enabledVideoModelListMock.mockReturnValue(mockProvidersWithoutParameters);
    useVideoStore.setState({
      isInit: false,
      model: 'dreamina-seedance-2-0-260128',
      provider: 'lobehub',
    });

    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.initializeVideoConfig(true);
    });

    expect(result.current.isInit).toBe(true);
    expect(result.current.model).toBe('video-model-a');
    expect(result.current.provider).toBe('provider-a');
    expect(result.current.parameters.prompt).toBe('');
  });

  it('should fall back to the first enabled video model when remembered model was removed', () => {
    useVideoStore.setState({
      isInit: false,
      model: 'removed-video-model',
      provider: 'removed-provider',
    });

    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.initializeVideoConfig(true, 'removed-video-model', 'removed-provider');
    });

    expect(result.current.isInit).toBe(true);
    expect(result.current.model).toBe('video-model-a');
    expect(result.current.provider).toBe('provider-a');
    expect(result.current.parametersSchema).toBe(modelASchema);
  });

  it('should clear video model selection when no video model is enabled', () => {
    vi.mocked(aiProviderSelectors.enabledVideoModelList).mockReturnValue([]);
    useVideoStore.setState({
      isInit: false,
      model: 'removed-video-model',
      provider: 'removed-provider',
    });

    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.initializeVideoConfig(true, 'removed-video-model', 'removed-provider');
    });

    expect(result.current.isInit).toBe(true);
    expect(result.current.model).toBe('');
    expect(result.current.provider).toBe('');
  });

  it('should preserve prompt and frame images when switching model', () => {
    const { result } = renderHook(() => useVideoStore());

    act(() => {
      result.current.setParamOnInput('prompt', 'cinematic sunset');
      result.current.setParamOnInput('imageUrl', 'start-custom.png');
      result.current.setParamOnInput('endImageUrl', 'end-custom.png');
      result.current.setParamOnInput('duration', 8);
    });

    act(() => {
      result.current.setModelAndProviderOnSelect('video-model-b', 'provider-b');
    });

    expect(result.current.parameters).toEqual({
      ...modelBDefaultValues,
      prompt: 'cinematic sunset',
      imageUrl: 'start-custom.png',
      endImageUrl: 'end-custom.png',
    });
    expect(result.current.parameters?.duration).toBe(modelBDefaultValues.duration);
  });
});
