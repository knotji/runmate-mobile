import { Capacitor, registerPlugin } from '@capacitor/core';

interface StoryImageNativePlugin {
  save(options: { dataUrl: string; fileName: string }): Promise<{ uri: string; fileName: string }>;
}

const StoryImage = registerPlugin<StoryImageNativePlugin>('StoryImage');

export function canSaveStoryImageNatively(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function saveStoryImageNatively(dataUrl: string, fileName: string): Promise<void> {
  await StoryImage.save({ dataUrl, fileName });
}
