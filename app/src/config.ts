import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Everything you would change to point this example at your own setup.
 *
 * Values come from environment variables at bundle time. Expo exposes any
 * variable prefixed `EXPO_PUBLIC_` to the app, so put them in `app/.env`:
 *
 *   EXPO_PUBLIC_ASSESSMENT_ID=your-assessment-uuid
 *
 * Nothing secret belongs here. Anything in this file ships inside the app
 * bundle and can be read by anyone who downloads it. The API key stays on the
 * server, which is the whole reason `server/` exists.
 */

/**
 * The LAN address of the machine running the Expo dev server.
 *
 * This exists to remove the most common cause of "the app just hangs on first
 * run". Inside a device or emulator, `localhost` means *that device*, so a
 * server on your laptop is unreachable at that address. The usual fix is to
 * make every developer look up their own IP and paste it into a config file,
 * which is friction and goes stale the moment they change network.
 *
 * Expo already knows the answer: it told the device where to fetch the JS
 * bundle from, and that is the same machine your token server runs on. So we
 * read it back out and reuse the host.
 *
 * Returns null in a production build, where there is no dev server, and where
 * you would be pointing at a real HTTPS backend anyway.
 */
function devServerHost(): string | null {
  // e.g. "192.168.1.245:8081" on a device, "127.0.0.1:8081" on web
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older manifests keep it in a different place; harmless if absent.
    (Constants.manifest2?.extra?.expoGo?.debuggerHost as string | undefined);

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/**
 * Where the token server lives, as seen *from the device*.
 *
 * Three cases, and getting any of them wrong looks identical from the app: a
 * request that never completes.
 *
 *   1. Expo told us a real LAN address. That is a physical device, or an
 *      emulator started with one. Use it directly.
 *
 *   2. No usable address, on Android. The dev server is reached over an adb
 *      port forward, so it reports `localhost`, which inside the emulator means
 *      the emulator itself. `10.0.2.2` is the emulator's alias for the host
 *      machine, and is what you want here. Falling back to `localhost` instead
 *      is the single most common cause of "it just hangs".
 *
 *   3. No usable address, on iOS. The simulator shares the host's network
 *      stack, so `localhost` really is your machine.
 */
function defaultTokenServer(): string {
  const host = devServerHost();
  if (host) return `http://${host}:8787`;
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8787'
    : 'http://localhost:8787';
}

export const Config = {
  /**
   * Base URL of YOUR backend, the one that mints tokens. Never Edpire directly:
   * the app must not hold an API key.
   *
   * Defaults to whatever address reaches your dev machine from this device,
   * worked out in defaultTokenServer() above, so a device and an emulator both
   * work with no configuration. Set EXPO_PUBLIC_TOKEN_SERVER to override, which
   * you will do in production.
   */
  tokenServer: process.env.EXPO_PUBLIC_TOKEN_SERVER ?? defaultTokenServer(),

  /** A published assessment in your Edpire org. */
  assessmentId: process.env.EXPO_PUBLIC_ASSESSMENT_ID ?? '',

  /**
   * Which Edpire the player talks to. Empty means the SDK default,
   * https://edpire.com, which is what you want in production. Override it for
   * staging or a self-hosted instance.
   *
   * Remember this URL is resolved inside the WebView on the device, so
   * `localhost` means the device, not your laptop.
   */
  edpireBaseUrl: process.env.EXPO_PUBLIC_EDPIRE_BASE_URL ?? '',

  /**
   * Pinned deliberately. `@edpire/sdk` is pre-1.0, so a minor release can
   * change behaviour under you. Bump this on purpose, not by accident.
   */
  sdkVersion: '0.6.11',

  /**
   * The assessment's own learner-facing language, which decides text direction.
   * This is not your app's UI language: a French exercise reads left to right
   * even inside a right-to-left product, which is why Edpire takes it per
   * assessment.
   */
  locale: process.env.EXPO_PUBLIC_LOCALE ?? 'en',
} as const;

export const isConfigured = Config.assessmentId.length > 0;
