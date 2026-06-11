import createDebug from 'debug';
import { ModelProvider } from 'model-bank';

import type {
  CreateVideoPayload,
  CreateVideoResponse,
  PollVideoStatusResult,
} from '../../types/video';
import type { CreateVideoOptions } from '../openaiCompatibleFactory';

const log = createDebug('lobe-video:openai-compatible');

interface OpenAIVideoStatusResponse {
  completed_at?: number;
  created?: number;
  created_at?: number;
  duration?: number;
  error?: {
    code?: string;
    message?: string;
  };
  expires_at?: number;
  height?: number;
  id?: string;
  metadata?: {
    url?: string;
  };
  model?: string;
  object?: string;
  progress?: number;
  prompt?: string;
  seconds?: string;
  size?: string;
  status?: string;
  url?: string;
  width?: number;
}

type NormalizedOpenAIVideoStatusResponse = OpenAIVideoStatusResponse & {
  data?: {
    content?: {
      video_url?: string;
    };
    status?: string;
  };
  fail_reason?: string;
  result_url?: string;
  task_id?: string;
};

interface OpenAICompatibleWrappedVideoResponse {
  code?: string;
  data?: NormalizedOpenAIVideoStatusResponse;
  message?: string;
}

const unwrapVideoResponse = (
  response: OpenAIVideoStatusResponse | OpenAICompatibleWrappedVideoResponse,
): NormalizedOpenAIVideoStatusResponse => {
  if ('data' in response && response.data && typeof response.data === 'object') {
    return response.data;
  }

  return response as OpenAIVideoStatusResponse;
};

/**
 * Query the status of a video generation task
 * Compatible with OpenAI Sora API
 */
export async function queryOpenAICompatibleVideoStatus(
  inferenceId: string,
  options: { apiKey: string; baseURL: string },
): Promise<NormalizedOpenAIVideoStatusResponse> {
  const statusUrl = `${options.baseURL}/videos/${inferenceId}`;

  log('Querying video status for: %s', inferenceId);

  const response = await fetch(statusUrl, {
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'GET',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI-compatible video status API error: ${response.status} ${errorText}`);
  }

  const rawData = (await response.json()) as
    | OpenAIVideoStatusResponse
    | OpenAICompatibleWrappedVideoResponse;

  const data = unwrapVideoResponse(rawData);
  log('Video status response: %O', data);

  return data;
}

/**
 * Poll video status and return standardized result
 * Compatible with OpenAI Sora API
 */
export async function pollOpenAICompatibleVideoStatus(
  inferenceId: string,
  options: { apiKey: string; baseURL: string },
): Promise<PollVideoStatusResult> {
  const response = await queryOpenAICompatibleVideoStatus(inferenceId, options);

  const status = response.status?.toLowerCase();
  const videoUrl =
    response.url ??
    response.metadata?.url ??
    response.result_url ??
    response.data?.content?.video_url;

  if (status === 'completed' || status === 'success' || status === 'succeeded') {
    // Some providers return the download URL directly in the url field
    // Others require calling /videos/{id}/content endpoint
    let finalVideoUrl = videoUrl;

    if (!finalVideoUrl) {
      // If no URL returned, construct the content endpoint URL
      finalVideoUrl = `${options.baseURL}/videos/${inferenceId}/content`;
    }

    // Return headers for authenticated download
    // OpenAI-compatible providers use Bearer token
    return {
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
      },
      status: 'success',
      videoUrl: finalVideoUrl,
    };
  }

  if (status === 'failed' || status === 'failure' || status === 'error') {
    return {
      error: response.error?.message || response.fail_reason || 'Video generation failed',
      status: 'failed',
    };
  }

  // queued, in_progress, or any other status means still pending
  return { status: 'pending' };
}

/**
 * OpenAI-compatible video generation implementation
 * Works with OpenAI Sora, and other OpenAI-compatible providers
 *
 * API Format:
 * POST /v1/videos
 * {
 *   model: string,
 *   prompt: string,
 *   seconds?: string,      // OpenAI Sora format (string type)
 *   input_reference?: string | { image_url: string } | { file_id: string },  // For image-to-video
 * }
 *
 * Creates a video generation task and returns immediately with inferenceId.
 * The frontend polls the task status using async task polling mechanism.
 */
export async function createOpenAICompatibleVideo(
  payload: CreateVideoPayload,
  options: CreateVideoOptions,
): Promise<CreateVideoResponse> {
  const { model, params } = payload;
  const { prompt, imageUrl, size, duration } = params;

  log('Creating video with OpenAI-compatible API - model: %s, params: %O', model, params);

  const baseURL = options.baseURL || 'https://api.openai.com/v1';

  // Build request body compatible with OpenAI Sora
  const body: Record<string, unknown> = {
    model,
    prompt,
  };

  // Duration: prefer 'seconds' (string) for OpenAI Sora compatibility
  if (duration !== undefined && duration !== null) {
    body['seconds'] = duration.toString();
  }

  // Size/resolution
  if (size) {
    body['size'] = size;
  }

  // Image-to-video support
  if (imageUrl) {
    // OpenAI JSON requests reject bare strings, for example:
    // `input_reference: "https://example.com/image.jpg"`.
    body['input_reference'] =
      options.provider === ModelProvider.OpenAI ? { image_url: imageUrl } : imageUrl;
  }

  log('OpenAI-compatible video API request body: %O', body);

  const response = await fetch(`${baseURL}/videos`, {
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    log('OpenAI-compatible video API error: %s %s', response.status, errorText);
    throw new Error(`OpenAI-compatible video API error: ${response.status} ${errorText}`);
  }

  const data = unwrapVideoResponse(await response.json());
  log('OpenAI-compatible video API response: %O', data);

  const inferenceId = data?.task_id ?? data?.id;

  if (!inferenceId) {
    throw new Error('Invalid response: missing task id');
  }

  log('Video task created with id: %s, returning immediately for frontend polling', inferenceId);

  // Return immediately with inferenceId only
  // Frontend will poll the task status using the async task polling mechanism
  // This avoids blocking the API response for 30 seconds during server-side polling
  return { inferenceId };
}
