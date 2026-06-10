import { type GenerationBatch } from '@/types/generation';

import useRenderGenerationBusinessBatchItem from './renderGenerationBusinessBatchItem';

export default function useRenderBusinessBatchItem(batch: GenerationBatch) {
  return useRenderGenerationBusinessBatchItem(batch);
}
