import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  Degree1SummaryResult,
  Degree2SummaryResult,
  RootStackParamList,
} from '../App';
import { supabase } from '../lib/supabase';
import type { WebListing } from './WebResultsScreen';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const CARD_BORDER = '#E8E5E0';
const COUNT_MUTED = '#B0ADA8';
const GOLD = '#C9A227';
const GOOD_MATCH = '#2F855A';
const SAVE_ERROR = '#9B3B4A';

const COUNT_TOTAL_MS = 1200;
const STAT_SLOT_HEIGHT = 44;
const STAT_DIGIT_SIZE = 36;
const STAT_DIGIT_LINE = 42;

type SummaryRoute = RouteProp<RootStackParamList, 'Summary'>;
type SummaryNav = StackNavigationProp<RootStackParamList, 'Summary'>;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0]!;
    return w.slice(0, 2).toUpperCase();
  }
  const a = parts[0]![0] ?? '';
  const b = parts[parts.length - 1]![0] ?? '';
  return (a + b).toUpperCase();
}

function StatSlot({
  target,
  label,
  scroll,
  scale,
}: {
  target: number;
  label: string;
  scroll: Animated.Value;
  scale: Animated.Value;
}) {
  const cells = Math.max(0, target) + 1;
  return (
    <View style={styles.statBox}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={styles.statSlotClip}>
          <Animated.View
            style={[
              styles.statSlotRail,
              { transform: [{ translateY: scroll }] },
            ]}
          >
            {Array.from({ length: cells }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.statDigitCell,
                  { height: STAT_SLOT_HEIGHT },
                ]}
              >
                <Text
                  style={[
                    styles.statDigit,
                    i === target ? styles.statDigitFinal : styles.statDigitMuted,
                  ]}
                >
                  {i}
                </Text>
              </View>
            ))}
          </Animated.View>
        </View>
      </Animated.View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SummaryScreen() {
  const navigation = useNavigation<SummaryNav>();
  const { params } = useRoute<SummaryRoute>();
  const {
    destination_city,
    destination_state,
    date_from,
    date_to,
    degree1Results,
    degree2Results,
    webResults,
  } = params;

  const n1 = degree1Results.length;
  const n2 = degree2Results.length;
  const n3 = webResults.length;

  const scroll1 = useRef(new Animated.Value(0)).current;
  const scale1 = useRef(new Animated.Value(1)).current;
  const scroll2 = useRef(new Animated.Value(0)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scroll3 = useRef(new Animated.Value(0)).current;
  const scale3 = useRef(new Animated.Value(1)).current;

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle',
  );
  const saveNavigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      if (saveNavigateTimerRef.current != null) {
        clearTimeout(saveNavigateTimerRef.current);
      }
    };
  }, []);

  const handleSaveTrip = useCallback(async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaveState('saving');
    const { error } = await supabase.from('trips').insert({
      user_id: 2,
      destination_city: destination_city.trim(),
      destination_state: destination_state.trim(),
      date_from: date_from.trim(),
      date_to: date_to.trim(),
      status: 'searching',
    });
    if (error) {
      saveInFlightRef.current = false;
      setSaveState('error');
      return;
    }
    setSaveState('success');
    saveNavigateTimerRef.current = setTimeout(() => {
      saveNavigateTimerRef.current = null;
      navigation.navigate('Home');
    }, 2000);
  }, [destination_city, destination_state, date_from, date_to, navigation]);

  useEffect(() => {
    const runSlot = (
      scroll: Animated.Value,
      scale: Animated.Value,
      n: number,
    ) => {
      scroll.setValue(0);
      scale.setValue(1);
      const dist = n * STAT_SLOT_HEIGHT;
      return Animated.timing(scroll, {
        toValue: -dist,
        duration: COUNT_TOTAL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
    };

    const springBounce = (scale: Animated.Value) => {
      scale.setValue(1.08);
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    };

    const a1 = runSlot(scroll1, scale1, n1);
    const a2 = runSlot(scroll2, scale2, n2);
    const a3 = runSlot(scroll3, scale3, n3);

    Animated.parallel([a1, a2, a3]).start(({ finished }) => {
      if (!finished) return;
      springBounce(scale1);
      springBounce(scale2);
      springBounce(scale3);
    });
  }, [n1, n2, n3, scroll1, scroll2, scroll3, scale1, scale2, scale3]);

  const cityLine =
    `${destination_city.trim()}${destination_state.trim() ? `, ${destination_state.trim()}` : ''}`.trim() ||
    'Your trip';
  const dateLine = `${date_from.trim()} – ${date_to.trim()}`.trim();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Your search summary</Text>
        <Text style={styles.subtitle}>
          {cityLine}
          {'\n'}
          {dateLine}
        </Text>

        <View style={styles.statRow}>
          <StatSlot
            target={n1}
            label="Direct friends"
            scroll={scroll1}
            scale={scale1}
          />
          <StatSlot
            target={n2}
            label="Friends of friends"
            scroll={scroll2}
            scale={scale2}
          />
          <StatSlot
            target={n3}
            label="Online listings"
            scroll={scroll3}
            scale={scale3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Direct friends</Text>
          {degree1Results.length === 0 ? (
            <Text style={styles.emptyText}>No direct connections found</Text>
          ) : (
            degree1Results.map((item: Degree1SummaryResult, i: number) => (
              <Degree1Card key={`d1-${i}`} item={item} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Friends of friends</Text>
          {degree2Results.length === 0 ? (
            <Text style={styles.emptyText}>
              No second degree connections found
            </Text>
          ) : (
            degree2Results.map((item: Degree2SummaryResult, i: number) => (
              <Degree2Card key={`d2-${i}`} item={item} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Online listings</Text>
          {webResults.length === 0 ? (
            <Text style={styles.emptyText}>No online listings found</Text>
          ) : (
            webResults.map((item: WebListing, i: number) => (
              <WebSummaryCard key={`w-${i}`} item={item} />
            ))
          )}
        </View>

        <View style={styles.footerBlock}>
          <Pressable
            style={[
              styles.saveTrip,
              (saveState === 'saving' || saveState === 'success') &&
                styles.saveTripDisabled,
            ]}
            onPress={() => {
              void handleSaveTrip();
            }}
            disabled={saveState === 'saving' || saveState === 'success'}
          >
            <Text style={styles.saveTripLabel}>Save trip</Text>
          </Pressable>
          {saveState === 'success' ? (
            <Text style={styles.saveFeedbackOk}>Trip saved!</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={styles.saveFeedbackErr}>Could not save trip</Text>
          ) : null}
          <Pressable
            style={styles.startOver}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.startOverLabel}>Start over</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Degree1Card({ item }: { item: Degree1SummaryResult }) {
  const name = item.name?.trim() || 'Unknown';
  const rating =
    typeof item.rating === 'number' && !Number.isNaN(item.rating)
      ? item.rating
      : null;
  const stars =
    rating != null
      ? Math.max(0, Math.min(5, Math.round(rating)))
      : null;
  const good = item.is_good_match === true;

  return (
    <View style={styles.card}>
      <View style={styles.cardRowTop}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{initialsFromName(name)}</Text>
        </View>
        <View style={styles.cardMainCol}>
          <View style={styles.nameRow}>
            <Text style={styles.cardTitleText} numberOfLines={1}>
              {name}
            </Text>
            {good ? <View style={styles.goodDot} /> : null}
          </View>
          {item.university ? (
            <Text style={styles.cardMuted} numberOfLines={1}>
              {item.university}
            </Text>
          ) : null}
          {stars != null ? (
            <Text style={styles.cardStars}>
              <Text style={styles.starGold}>{'★'.repeat(stars)}</Text>
              <Text style={styles.starEmpty}>
                {'☆'.repeat(Math.max(0, 5 - stars))}
              </Text>
            </Text>
          ) : null}
          {item.summary ? (
            <Text style={styles.cardOneLine} numberOfLines={1}>
              {item.summary}
            </Text>
          ) : null}
        </View>
        <Pressable style={styles.pillBtn} onPress={() => {}}>
          <Text style={styles.pillBtnLabel}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Degree2Card({ item }: { item: Degree2SummaryResult }) {
  const via = item.via_friend?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardRowTop}>
        <View style={styles.cardMainCol}>
          <View style={styles.redactedBar} />
          {item.university ? (
            <Text style={styles.cardMuted}>{item.university}</Text>
          ) : null}
          {item.teaser_summary ? (
            <Text style={styles.cardBody}>{item.teaser_summary}</Text>
          ) : null}
          {via ? (
            <Text style={styles.viaLine}>{`via ${via}`}</Text>
          ) : null}
        </View>
        <Pressable style={styles.pillBtn} onPress={() => {}}>
          <Text style={styles.pillBtnLabel}>Request access</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WebSummaryCard({ item }: { item: WebListing }) {
  const src = item.source?.trim() || 'Other';
  const trust =
    typeof item.trust_score === 'number' && !Number.isNaN(item.trust_score)
      ? Math.round(item.trust_score)
      : null;
  const link = typeof item.link === 'string' ? item.link.trim() : '';

  return (
    <View style={styles.card}>
      <View style={styles.webTopRow}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourcePillText}>{src}</Text>
        </View>
      </View>
      <Text style={styles.webTitle}>
        {item.title?.trim() || 'Untitled listing'}
      </Text>
      <Text style={styles.webDesc}>{item.description?.trim() || ''}</Text>
      <View style={styles.webBottomRow}>
        <Text style={styles.priceTag}>
          {item.estimated_price_range?.trim() || '—'}
        </Text>
        {trust != null ? (
          <View style={styles.trustPill}>
            <Text
              style={styles.trustPillText}
            >{`Trust ${trust}/10`}</Text>
          </View>
        ) : (
          <View style={styles.trustPlaceholder} />
        )}
      </View>
      {link ? (
        <Pressable
          style={styles.viewBtn}
          onPress={() => {
            void Linking.openURL(link);
          }}
        >
          <Text style={styles.viewBtnLabel}>View</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: CHARCOAL,
    textAlign: 'center',
    paddingTop: 60,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: IVORY,
  },
  statSlotClip: {
    height: STAT_SLOT_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 48,
  },
  statSlotRail: {
    alignItems: 'center',
  },
  statDigitCell: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  statDigit: {
    fontSize: STAT_DIGIT_SIZE,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: STAT_DIGIT_LINE,
    includeFontPadding: false,
  },
  statDigitMuted: {
    color: COUNT_MUTED,
  },
  statDigitFinal: {
    color: CHARCOAL,
  },
  statLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
    textAlign: 'center',
    lineHeight: 15,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '500',
    color: CHARCOAL,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
    paddingVertical: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    backgroundColor: IVORY,
  },
  cardRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: {
    color: IVORY,
    fontSize: 14,
    fontWeight: '600',
  },
  cardMainCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitleText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    minWidth: 0,
  },
  goodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOOD_MATCH,
  },
  cardMuted: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 6,
  },
  cardStars: {
    fontSize: 13,
    marginBottom: 6,
  },
  starGold: {
    color: GOLD,
  },
  starEmpty: {
    color: '#D4D1CB',
  },
  cardOneLine: {
    fontSize: 14,
    color: CHARCOAL,
    lineHeight: 20,
  },
  cardBody: {
    fontSize: 14,
    color: CHARCOAL,
    lineHeight: 20,
    marginBottom: 6,
  },
  viaLine: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  redactedBar: {
    height: 12,
    width: '72%',
    maxWidth: 200,
    borderRadius: 6,
    backgroundColor: '#D4D1CB',
    marginBottom: 10,
  },
  pillBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: IVORY,
    alignSelf: 'flex-start',
  },
  pillBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CHARCOAL,
  },
  webTopRow: {
    marginBottom: 10,
  },
  sourcePill: {
    alignSelf: 'flex-start',
    backgroundColor: CHARCOAL,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  sourcePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: IVORY,
    letterSpacing: 0.3,
  },
  webTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    marginBottom: 8,
    lineHeight: 22,
  },
  webDesc: {
    fontSize: 14,
    color: CHARCOAL,
    lineHeight: 20,
    marginBottom: 12,
  },
  webBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  priceTag: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
    flex: 1,
  },
  trustPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: IVORY,
  },
  trustPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: CHARCOAL,
  },
  trustPlaceholder: {
    minWidth: 1,
  },
  viewBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHARCOAL,
    backgroundColor: IVORY,
  },
  viewBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CHARCOAL,
  },
  footerBlock: {
    marginTop: 8,
    gap: 12,
  },
  saveTrip: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: CHARCOAL,
  },
  saveTripDisabled: {
    opacity: 0.55,
  },
  saveTripLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: IVORY,
  },
  saveFeedbackOk: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },
  saveFeedbackErr: {
    fontSize: 13,
    color: SAVE_ERROR,
    textAlign: 'center',
    lineHeight: 18,
  },
  startOver: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: CHARCOAL,
  },
  startOverLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: IVORY,
  },
});
