import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AssessmentScreen } from './src/AssessmentScreen';
import { Config } from './src/config';
import { listAssessments, type AssessmentSummary } from './src/tokenService';

/**
 * Two screens: a picker, and the assessment.
 *
 * Kept this small on purpose. Navigation, a catalogue and auth are your app's
 * job, and adding them here would bury the twenty lines that actually matter.
 * Those live in src/AssessmentScreen.tsx and src/buildPlayerHtml.ts.
 */
export default function App() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {playing ? (
        <AssessmentScreen assessmentId={playing} onClose={() => setPlaying(null)} />
      ) : (
        <Home onPick={setPlaying} />
      )}
    </SafeAreaProvider>
  );
}

/**
 * Lists the assessments your server offers, and opens the one you tap.
 *
 * This is the whole point of the screen: **you never type an Edpire ID.** Your
 * server knows them, this list shows titles, and the ID travels invisibly from
 * the tap into the token request. Build the same thing in your own admin and
 * nobody on your team will ever paste a UUID.
 */
function Home({ onPick }: { onPick: (id: string) => void }) {
  const [items, setItems] = useState<AssessmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      setItems(await listAssessments());
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          edpire<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.footnote}>
          {Config.tokenServer}   ·   SDK {Config.sdkVersion}
        </Text>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items === null ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Asking your server what is published...</Text>
        </View>
      ) : items.length === 0 ? (
        <EmptyState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          ListHeaderComponent={
            <Text style={styles.lede}>
              Published in your organisation. Tap one to play it.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => onPick(item.id)}
              accessibilityRole="button"
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.exerciseCount != null && (
                  <Text style={styles.cardMeta}>{item.exerciseCount} exercise(s)</Text>
                )}
              </View>
              <Text style={styles.chevron}>▶</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * Shown when the organisation has nothing published yet.
 *
 * This is a real first-run state, not an error: a brand new org has no
 * assessments, and the fix is in Edpire rather than in this app.
 */
function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.centeredBody}>
      <Text style={styles.emptyTitle}>Nothing published yet</Text>
      <Text style={styles.emptyText}>
        This organisation has no published assessments, so there is nothing for
        the app to open.{'\n\n'}
        Create one in Edpire, publish it, then pull to refresh. A draft will not
        appear here: only published assessments can be played.
      </Text>
      <Text selectable style={styles.code}>docs.edpire.com/quickstart</Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </ScrollView>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.centeredBody}>
      <Text style={styles.errorTitle}>Could not load assessments</Text>
      <Text selectable style={styles.emptyText}>{message}</Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fbfaf7' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 2 },
  brand: { fontSize: 26, fontWeight: '700', color: '#1d2025' },
  dot: { color: '#d23b2b' },
  footnote: { fontSize: 11, color: '#8d93a0' },
  lede: { color: '#565b66', fontSize: 14, marginBottom: 12 },
  list: { padding: 20, paddingTop: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7e5e0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1d2025' },
  cardMeta: { fontSize: 12, color: '#8d93a0' },
  chevron: { color: '#d23b2b', fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  centeredBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 28,
  },
  muted: { color: '#565b66' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1d2025' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#d23b2b' },
  emptyText: { textAlign: 'center', color: '#565b66', fontSize: 14, lineHeight: 21 },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#1d2025' },
  button: {
    backgroundColor: '#1d2025',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
