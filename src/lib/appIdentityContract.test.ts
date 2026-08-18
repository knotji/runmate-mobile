import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import capacitorConfig from '../../capacitor.config';
import { NATIVE_AUTH_CALLBACK } from './googleAuth';

const EXPECTED_APP_ID = 'com.runmate.mobile';
const EXPECTED_DISPLAY_NAME = 'WholeMate';

function repositoryFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('permanent Android app identity', () => {
  it('keeps the existing Capacitor app ID while allowing the display name to change', () => {
    expect(capacitorConfig.appId).toBe(EXPECTED_APP_ID);
    expect(capacitorConfig.appName).toBe(EXPECTED_DISPLAY_NAME);
  });

  it('keeps the Android application ID and namespace', () => {
    const gradle = repositoryFile('android/app/build.gradle');

    expect(gradle).toContain(`namespace = "${EXPECTED_APP_ID}"`);
    expect(gradle).toContain(`applicationId "${EXPECTED_APP_ID}"`);
  });

  it('keeps the native callback and package resources compatible', () => {
    const strings = repositoryFile('android/app/src/main/res/values/strings.xml');
    const manifest = repositoryFile('android/app/src/main/AndroidManifest.xml');

    expect(NATIVE_AUTH_CALLBACK).toBe(`${EXPECTED_APP_ID}://auth/callback`);
    expect(strings).toContain(`<string name="package_name">${EXPECTED_APP_ID}</string>`);
    expect(strings).toContain(`<string name="custom_url_scheme">${EXPECTED_APP_ID}</string>`);
    expect(manifest).toContain(`android:scheme="${EXPECTED_APP_ID}"`);
  });

  it('uses the coordinated display name in native and web entry points', () => {
    const strings = repositoryFile('android/app/src/main/res/values/strings.xml');
    const html = repositoryFile('index.html');
    const webManifest = JSON.parse(repositoryFile('public/manifest.json')) as { name?: string; short_name?: string };

    expect(strings).toContain(`<string name="app_name">${EXPECTED_DISPLAY_NAME}</string>`);
    expect(strings).toContain(`<string name="title_activity_main">${EXPECTED_DISPLAY_NAME}</string>`);
    expect(html).toContain(`<title>${EXPECTED_DISPLAY_NAME}</title>`);
    expect(html).toContain(`content="${EXPECTED_DISPLAY_NAME}"`);
    expect(webManifest.name).toBe(EXPECTED_DISPLAY_NAME);
    expect(webManifest.short_name).toBe(EXPECTED_DISPLAY_NAME);
  });

  it('keeps the WholeMate artwork coordinated across web, native, and share surfaces', () => {
    const webManifest = JSON.parse(repositoryFile('public/manifest.json')) as {
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src?: string; type?: string; purpose?: string }>;
    };
    const favicon = repositoryFile('public/favicon.svg');
    const masterMark = repositoryFile('resources/logo.svg');
    const notificationMark = repositoryFile('android/app/src/main/res/drawable/ic_stat_runmate.xml');
    const launchTheme = repositoryFile('android/app/src/main/res/values/styles.xml');
    const shareRenderer = repositoryFile('src/lib/shareCanvasRenderer.ts');

    expect(webManifest.theme_color).toBe('#17324D');
    expect(webManifest.background_color).toBe('#F4F8FC');
    expect(webManifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-512.webp', type: 'image/webp', purpose: 'any maskable' }),
    ]));
    expect(favicon).toContain('#17324D');
    expect(favicon).toContain('#48BFAE');
    expect(masterMark).toContain('#48BFAE');
    expect(notificationMark).toContain('android:strokeColor="#FFFFFFFF"');
    expect(notificationMark).toContain('android:fillColor="@android:color/transparent"');
    expect(launchTheme).toContain('<item name="android:background">@drawable/splash</item>');
    expect(shareRenderer).toContain('drawWholeMateMark');
    expect(shareRenderer).toContain("const text = 'WHOLEMATE'");
  });
});
