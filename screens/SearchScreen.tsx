import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import { supabaseAnonKey } from '../lib/supabase';

const FIND_HOUSING_URL =
  'https://mfvyjksetlmzfxrviadq.supabase.co/functions/v1/find-housing';

type SearchRoute = RouteProp<RootStackParamList, 'Search'>;
type SearchNav = StackNavigationProp<RootStackParamList, 'Search'>;

export default function SearchScreen() {
  const navigation = useNavigation<SearchNav>();
  const { params } = useRoute<SearchRoute>();
  const {
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
  } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function callFindHousing() {
      setLoading(true);
      setError(null);
      setRawResponse(null);

      try {
        const body = {
          user_id: 2,
          destination_city,
          destination_state,
          university,
          date_from,
          date_to,
          preferences,
          user_willing_to_pay: 'yes',
          user_gender_preference: 'no preference',
        };

        const res = await fetch(FIND_HOUSING_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          parsed = { _nonJsonBody: text };
        }

        if (cancelled) return;

        setRawResponse(parsed);
        if (!res.ok) {
          setError(`Request failed (${res.status})`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void callFindHousing();

    return () => {
      cancelled = true;
    };
  }, [
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
  ]);

  const jsonText =
    rawResponse === null
      ? ''
      : typeof rawResponse === 'string'
        ? rawResponse
        : JSON.stringify(rawResponse, null, 2);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={styles.backGlyph}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.sub}>
          Trip: {destination_city}, {destination_state}
          {university ? ` · ${university}` : ''}
        </Text>

        {loading ? (
          <Text style={styles.loadingText}>Searching...</Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {jsonText ? (
          <View style={styles.jsonBlock}>
            <Text style={styles.jsonLabel}>Raw response</Text>
            <Text style={styles.jsonText} selectable>
              {jsonText}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 4,
  },
  backGlyph: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2C2C2A',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    color: '#6B6965',
    marginBottom: 20,
    lineHeight: 21,
  },
  loadingText: {
    fontSize: 16,
    color: '#2C2C2A',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#8B2942',
    marginBottom: 16,
    lineHeight: 21,
  },
  jsonBlock: {
    marginTop: 8,
  },
  jsonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8783',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  jsonText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12,
    lineHeight: 17,
    color: '#2C2C2A',
    backgroundColor: '#F0EDE8',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E2DC',
  },
});
