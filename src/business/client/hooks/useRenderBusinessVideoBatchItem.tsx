import { type GenerationBatch } from '@/types/generation';

import useRenderGenerationBusinessBatchItem from './renderGenerationBusinessBatchItem';

export default function useRenderBusinessVideoBatchItem(batch: GenerationBatch) {
  return useRenderGenerationBusinessBatchItem(batch);
}
