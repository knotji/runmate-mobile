import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample } from '@capgo/capacitor-health';
import { defaultProfile } from '@/types/profile';
import { loadProfileFromSupabase, saveProfileToSupabase } from '@/lib/profileStorage';

const SAMSUNG_HEALTH_SOURCE_ID = 'com.sec.android.app.shealth';

export type SamsungWeightSyncResult = {
  status: 'synced' | 'unavailable' | 'permission_required' | 'manual_override' | 'no_data';
  weightKg?: number;
  measuredAt?: string;
  error?: string;
};

export async function syncSamsungWeight(): Promise<SamsungWeightSyncResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return { status: 'unavailable' };
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return { status: 'unavailable' };
    const authorization = await Health.checkAuthorization({ read: ['weight'] });
    if (!authorization.readAuthorized.includes('weight')) return { status: 'permission_required' };
    const result = await Health.readSamples({
      dataType: 'weight',
      startDate: new Date(Date.now() - 365 * 86_400_000).toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 100,
    });
    const latest = selectLatestSamsungWeight(result.samples);
    if (!latest) return { status: 'no_data' };

    const profileResult = await loadProfileFromSupabase();
    if (!profileResult.ok) throw new Error(('message' in profileResult && profileResult.message) || 'Could Not Load Your Profile.');
    const profile = profileResult.profile ?? { ...defaultProfile, timezone: 'Asia/Bangkok' };
    if (profile.fieldSources?.weightKg === 'manual') {
      return { status: 'manual_override', weightKg: latest.value, measuredAt: latest.startDate };
    }
    const next = {
      ...profile,
      weightKg: Math.round(latest.value * 10) / 10,
      fieldSources: { ...profile.fieldSources, weightKg: 'health_connect' as const },
    };
    const saved = await saveProfileToSupabase(next);
    if (!saved.ok) throw new Error(('message' in saved && saved.message) || 'Could Not Save Health Connect Weight.');
    return { status: 'synced', weightKg: next.weightKg, measuredAt: latest.startDate };
  } catch (error) {
    return { status: 'unavailable', error: error instanceof Error ? error.message : 'Body Weight Sync Failed.' };
  }
}

export function selectLatestSamsungWeight(samples: HealthSample[]): HealthSample | undefined {
  return samples
    .filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID && sample.value >= 30 && sample.value <= 300)
    .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))[0];
}
