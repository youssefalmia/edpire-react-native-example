import { Config } from './config';

/**
 * Builds the page the WebView runs.
 *
 * Kept in its own file because it is the only place where native code and the
 * web player meet, and it is worth reading on its own.
 *
 * Loaded as an inline string rather than from a URL, so there is no page for
 * you to host. The document then has an *opaque origin*, which Edpire allows
 * deliberately: a native WebView has no origin you could register in the
 * dashboard. That is why there is nothing to add to Allowed Embed Origins for
 * mobile. The token is what authorises the request.
 */
export function buildPlayerHtml(token: string): string {
  // Only ever interpolated into a JS string literal below, and both values are
  // ours rather than user input, but escape anyway: a stray quote here would
  // break the page in a way that is tedious to debug through a WebView.
  const safeToken = JSON.stringify(token);
  const safeLocale = JSON.stringify(Config.locale);
  const baseUrlLine = Config.edpireBaseUrl
    ? `baseUrl: ${JSON.stringify(Config.edpireBaseUrl)},`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <!-- viewport-fit=cover lets the safe-area insets below actually do something
       on notched devices. user-scalable=no stops a double-tap from zooming the
       assessment, which on a phone is almost always accidental. -->
  <meta name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; }

    /* The player fills its container, so the container needs a real height.
       A container with no height collapses to zero and the player disappears
       with no error at all. This one line prevents the single most common
       "it renders blank" report. */
    #root {
      height: 100vh;
      padding: env(safe-area-inset-top) env(safe-area-inset-right)
               env(safe-area-inset-bottom) env(safe-area-inset-left);
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script src="https://cdn.jsdelivr.net/npm/@edpire/sdk@${Config.sdkVersion}/dist/umd/index.global.js"></script>
  <script>
    // React Native's bridge takes a STRING, unlike most web message APIs. Send
    // an object and you receive "[object Object]" on the native side, which is
    // a confusing five minutes. Everything goes through here so that is decided
    // in exactly one place.
    function send(type, payload) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    }

    // Forward console output to React Native so it shows up in your terminal.
    // Without this, anything the page logs is invisible and you are debugging
    // a black box.
    ['log', 'warn', 'error'].forEach(function (level) {
      var original = console[level];
      console[level] = function () {
        try { send('console', { level: level, text: Array.prototype.join.call(arguments, ' ') }); } catch (e) {}
        original.apply(console, arguments);
      };
    });
    window.addEventListener('error', function (e) {
      send('console', { level: 'error', text: String(e.message) });
    });

    if (typeof EdpireSDK === 'undefined') {
      // The bundle is loaded from a CDN, so this is the offline case. Say so,
      // rather than leaving a blank screen with no explanation.
      send('error', {
        code: 'SDK_NOT_LOADED',
        message: 'The Edpire SDK bundle did not load. Check the device\\'s connectivity.'
      });
    } else {
      EdpireSDK.EdpireAssessment.mount({
        token: ${safeToken},
        container: '#root',
        locale: ${safeLocale},
        ${baseUrlLine}
        onComplete: function (result) { send('complete', result); },
        onError: function (error) { send('error', error); }
      });
    }
  </script>
</body>
</html>`;
}
