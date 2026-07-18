import { supabase } from '@/lib/supabaseClient';
import { prepareUploadImages } from '@/lib/mealUpload';
import { reconcileSleepAnalysis } from '@/lib/sleepAnalysisReconcile';
import type { SleepAnalysis } from '@/types/logs';

export async function analyzeSleepImages(files: File[], note: string): Promise<SleepAnalysis> {
  const imageDataUrls = await prepareUploadImages(files, { maxDimension: 1920, quality: 0.9, tileTallImages: true, maxOutputImages: 4 });
  const { data, error } = await supabase.functions.invoke('analyze-sleep', { body: { imageDataUrls, note } });
  if (error) throw new Error(error.message.includes('non-2xx') ? 'Sleep Analysis Failed. Please Try Again.' : error.message);
  if (!data?.data) throw new Error(data?.error ?? 'Sleep Analysis Returned No Result');
  return reconcileSleepAnalysis(data.data as SleepAnalysis);
}
