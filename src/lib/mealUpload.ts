import { supabase } from '@/lib/supabaseClient';
import type { MealAnalysis } from '@/types/logs';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export function inferBangkokMealType(date = new Date()): MealType {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart);
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

export async function analyzeMealImages(files: File[], mealType: string, note: string): Promise<MealAnalysis> {
  if (!files.length || files.length > 4 || files.some((file) => !file.type.startsWith('image/'))) throw new Error('Choose Between 1 And 4 Valid Food Images');
  const imageDataUrls = await prepareUploadImages(files);
  if (imageDataUrls.reduce((total, image) => total + image.length, 0) > 5_500_000) throw new Error('These Photos Are Too Large. Try Fewer Photos.');
  const { data, error } = await supabase.functions.invoke('analyze-meal', { body: { imageDataUrls, mealType, note } });
  if (error) throw new Error(readFunctionError(error.message));
  if (!data?.data) throw new Error(data?.error ?? 'Meal Analysis Returned No Result');
  return data.data as MealAnalysis;
}

type PrepareUploadImageOptions = { maxDimension?: number; quality?: number; tileTallImages?: boolean; maxOutputImages?: number };

export async function prepareUploadImages(files: File[], options: PrepareUploadImageOptions = {}): Promise<string[]> {
  if (!files.length || files.length > 4 || files.some((file) => !file.type.startsWith('image/'))) throw new Error('Choose Between 1 And 4 Valid Images');
  const maxOutputImages = options.maxOutputImages ?? files.length;
  const baseTiles = Math.floor(maxOutputImages / files.length);
  const extraTiles = maxOutputImages % files.length;
  const images = (await Promise.all(files.map((file, index) => prepareImage(file, options, baseTiles + (index < extraTiles ? 1 : 0))))).flat();
  if (images.reduce((total, image) => total + image.length, 0) > 5_500_000) throw new Error('These Photos Are Too Large. Try Fewer Photos.');
  return images;
}
async function prepareImage(file: File, options: PrepareUploadImageOptions, maxTiles: number): Promise<string[]> {
  const original = await fileToDataUrl(file);
  const image = await loadImage(original);
  if (!options.tileTallImages || maxTiles <= 1 || image.height <= image.width * 2.4) return [drawImageRegion(image, 0, image.height, options)];
  const overlap = Math.round(image.height * 0.04);
  const cropHeight = Math.ceil((image.height + overlap * (maxTiles - 1)) / maxTiles);
  const step = cropHeight - overlap;
  const tiles: string[] = [];
  for (let top = 0; top < image.height && tiles.length < maxTiles; top += step) {
    const height = Math.min(cropHeight, image.height - top);
    tiles.push(drawImageRegion(image, top, height, options));
    if (top + height >= image.height) break;
  }
  return tiles;
}
function drawImageRegion(image: HTMLImageElement, sourceTop: number, sourceHeight: number, options: PrepareUploadImageOptions): string {
  const maxDimension = options.maxDimension ?? 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.width, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext('2d')?.drawImage(image, 0, sourceTop, image.width, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', options.quality ?? 0.78);
}
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could Not Read This Image')); reader.readAsDataURL(file); }); }
function loadImage(url: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Could Not Open This Image')); image.src = url; }); }
function readFunctionError(message: string) { return message.includes('non-2xx') ? 'Meal Analysis Failed. Please Try Again.' : message; }
