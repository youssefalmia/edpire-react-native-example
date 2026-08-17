import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AssessmentScreen } from './src/AssessmentScreen';
import { Config, isConfigured } from './src/config';

/**
 * Two screens: a launcher, and the assessment.
 *
 * Kept this small on purpose. Navigation, a catalogue and auth are your app's
 * job, and adding them here would bury the twenty lines that actually matter.
 * Those live in src/AssessmentScreen.tsx and src/buildPlayerHtml.ts.
 */
export default function App() {
  const [playing, setPlaying] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!isConfigured ? (
        <NotConfigured />
      ) : playing ? (
        <AssessmentScreen
          assessmentId={Config.assessmentId}
          onClose={() => setPlaying(false)}
        />
      ) : (
        <Home onStart={() => setPlaying(true)} />
      )}
    </SafeAreaProvider>
  );
}

function Home({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>
          edpire<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.lede}>
          One button, one screen. Tapping this mints a token on your server and
          opens the assessment in a WebView.
        </Text>

        <Pressable style={styles.cta} onPress={onStart} accessibilityRole="button">
          <Text style={styles.ctaText}>Start assessment</Text>
        </Pressable>

        <View style={styles.details}>
          <Detail label="Token server" value={Config.tokenServer} />
          <Detail label="Assessment" value={Config.assessmentId} />
          <Detail label="SDK" value={Config.sdkVersion} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.detail} numberOfLines={1}>
      {label}: {value}
    </Text>
  );
}

function NotConfigured() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>No assessment configured</Text>
        <Text style={styles.lede}>
          Create <Text style={styles.code}>app/.env</Text> with a published
          assessment from your Edpire org, then restart the dev server:
        </Text>
        <Text selectable style={styles.block}>
          EXPO_PUBLIC_ASSESSMENT_ID=your-assessment-uuid
        </Text>
        <Text style={styles.footnote}>
          Environment variables are read when the bundle is built, so a reload is
          not enough. Stop and restart `npx expo start`.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fbfaf7' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 30, fontWeight: '700', color: '#1d2025' },
  dot: { color: '#d23b2b' },
  lede: { textAlign: 'center', color: '#565b66', fontSize: 15, lineHeight: 22, maxWidth: 320 },
  cta: {
    marginTop: 12,
    backgroundColor: '#1d2025',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  details: { marginTop: 28, gap: 3, alignItems: 'center' },
  detail: { fontSize: 11, color: '#8d93a0' },
  code: { fontFamily: 'monospace', color: '#1d2025' },
  block: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#1d2025',
    backgroundColor: '#f5f4f1',
    padding: 12,
    borderRadius: 8,
  },
  footnote: { fontSize: 12, color: '#8d93a0', textAlign: 'center', maxWidth: 320 },
});
