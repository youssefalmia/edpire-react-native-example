import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { buildPlayerHtml } from './buildPlayerHtml';
import { Config } from './config';
import { mintToken, TokenError } from './tokenService';

/** What the player sends back when the learner submits. Snake_case, mirroring the API. */
export type EmbedResult = {
  submission_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  awaiting_manual_grading?: boolean;
};

type EmbedError = { code: string; message: string };

/** Messages crossing the WebView bridge. See buildPlayerHtml for the sending side. */
type BridgeMessage =
  | { type: 'complete'; payload: EmbedResult }
  | { type: 'error'; payload: EmbedError }
  | { type: 'console'; payload: { level: string; text: string } };

type Props = {
  assessmentId: string;
  onClose: () => void;
};

/**
 * The whole integration.
 *
 * Mint a token on your server, hand it to a WebView running the Edpire player,
 * and listen for the result. Everything else in this repo is scaffolding.
 */
export function AssessmentScreen({ assessmentId, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmbedResult | null>(null);

  // Guards against setting state after the screen has gone away, which React
  // warns about and which is easy to hit here because minting is async.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    setError(null);
    setToken(null);
    try {
      const minted = await mintToken(assessmentId);
      if (alive.current) setToken(minted);
    } catch (e) {
      if (alive.current) {
        setError(e instanceof TokenError ? e.message : String(e));
      }
    }
  }, [assessmentId]);

  useEffect(() => { void load(); }, [load]);

  // Android's hardware back button would otherwise exit the app from here,
  // which feels broken mid-assessment.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const handleMessage = useCallback((raw: string) => {
    let message: BridgeMessage;
    try {
      message = JSON.parse(raw) as BridgeMessage;
    } catch {
      console.warn('[edpire] unparseable bridge message:', raw);
      return;
    }

    switch (message.type) {
      case 'complete':
        console.log(`[edpire] complete ${message.payload.score}/${message.payload.max_score}`);
        if (alive.current) setResult(message.payload);
        break;
      case 'error':
        console.warn(`[edpire] ${message.payload.code}: ${message.payload.message}`);
        if (alive.current) {
          setError(`${message.payload.code}\n\n${message.payload.message}`);
        }
        break;
      case 'console':
        console.log(`[webview] ${message.payload.text}`);
        break;
    }
  }, []);

  if (error) return <ErrorView message={error} onRetry={load} onClose={onClose} />;

  if (!token) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Minting a token on your server...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <WebView
        // Inline HTML rather than a hosted URL, so there is nothing to deploy.
        source={{ html: buildPlayerHtml(token) }}
        // Required for source={{ html }}: without it the WebView refuses to
        // load anything, because an inline document has no origin to whitelist.
        originWhitelist={['*']}
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
        // The player is a full web app.
        javaScriptEnabled
        domStorageEnabled
        // Android: the page is served as inline data (no scheme) while the SDK
        // and API are https. Without this, Android treats that as mixed content
        // and silently blocks the requests.
        mixedContentMode="always"
        // Media questions record audio or video. Without these the browser
        // prompt never resolves and the question quietly does nothing.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // iOS: let a typed answer focus without an extra tap.
        keyboardDisplayRequiresUserAction={false}
        // Keep links inside the player rather than spawning windows we do not manage.
        setSupportMultipleWindows={false}
        // Android: lets the page scroll properly when nested in native layout.
        nestedScrollEnabled
        style={styles.fill}
        onError={(e) => console.warn('[webview] load error', e.nativeEvent.description)}
        renderLoading={() => <ActivityIndicator style={styles.fill} size="large" />}
        startInLoadingState
      />

      {/*
        onComplete does not navigate away.

        After submitting, the player rewrites itself into the corrected paper: a
        score banner, per-question marks, and the answer key on anything the
        learner missed. This bar appears underneath instead, leaving those
        corrections on screen.
      */}
      {result && <ResultBar result={result} onClose={onClose} />}
    </SafeAreaView>
  );
}

function ResultBar({ result, onClose }: { result: EmbedResult; onClose: () => void }) {
  const provisional = result.awaiting_manual_grading === true;
  return (
    <View style={styles.bar}>
      <Text style={styles.barText} numberOfLines={2}>
        {provisional
          ? 'Score is provisional. Open responses still need a teacher.'
          : 'Scroll up to review the corrections.'}
      </Text>
      <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

function ErrorView({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.errorBody}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text selectable style={styles.errorText}>{message}</Text>
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={onClose} accessibilityRole="button">
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#fff' },
  muted: { color: '#565b66' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e7e5e0',
    backgroundColor: '#fbfaf7',
  },
  barText: { flex: 1, fontSize: 13, color: '#1d2025' },
  button: {
    backgroundColor: '#1d2025',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  linkButton: { paddingVertical: 12 },
  link: { color: '#565b66', textDecorationLine: 'underline' },
  errorBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#d23b2b' },
  errorText: { textAlign: 'center', color: '#1d2025', fontSize: 13, lineHeight: 20 },
});
