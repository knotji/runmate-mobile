import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';

export const NATIVE_AUTH_CALLBACK = 'com.runmate.mobile://auth/callback';

export async function signInWithGoogle(): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative
    ? NATIVE_AUTH_CALLBACK
    : new URL('/login', window.location.origin).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: isNative,
    },
  });

  if (error) throw error;
  if (isNative) {
    if (!data.url) throw new Error('Google did not return a sign-in URL.');
    await Browser.open({ url: data.url });
  }
}

export async function completeNativeGoogleSignIn(callbackUrl: string): Promise<boolean> {
  if (!callbackUrl.startsWith(NATIVE_AUTH_CALLBACK)) return false;

  const url = new URL(callbackUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const errorMessage = url.searchParams.get('error_description') ?? hash.get('error_description');
  if (errorMessage) throw new Error(errorMessage);

  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (!accessToken || !refreshToken) throw new Error('Google sign-in returned an incomplete session.');

  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return true;
}
