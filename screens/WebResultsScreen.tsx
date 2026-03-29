import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Linking,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import { supabaseAnonKey } from '../lib/supabase';

const FIND_HOUSING_URL =
  'https://mfvyjksetlmzfxrviadq.supabase.co/functions/v1/find-housing';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const CARD_BORDER = '#E8E5E0';
const COUNT_MUTED = '#B0ADA8';

const ORBIT_BOX = 320;
const ORBIT_CX = ORBIT_BOX / 2;
const ORBIT_CY = ORBIT_BOX / 2;
const HUB_SEARCH = 70;
const HUB_SEARCH_R = HUB_SEARCH / 2;
const LENS = 30;
const LENS_R = LENS / 2;
const ORBIT_R = 140;
const ORBIT_TICK_MS = 16;

const PILL_LABELS = ['Airbnb', 'Facebook', 'Craigslist', 'Sublet'] as const;
const PILL_OMEGA = [0.007, 0.0055, 0.0085, 0.006] as const;

const CYCLE_MESSAGES = [
  'Searching the web...',
  'Checking Airbnb...',
  'Scanning local groups...',
  'Checking Craigslist...',
  'Almost there...',
] as const;

const MIN_PHASE1_MS = 4000;
const COUNT_TOTAL_MS = 1200;
const COUNT_PAUSE_AFTER_MS = 1500;
const CARD_STAGGER_MS = 150;
const CARD_SLIDE_MS = 300;
const SLOT_DIGIT_HEIGHT = 86;

type WebRoute = RouteProp<RootStackParamList, 'WebResults'>;
type WebNav = StackNavigationProp<RootStackParamList, 'WebResults'>;

export type WebListing = {
  source?: string;
  title?: string;
  description?: string;
  link?: string;
  estimated_price_range?: string;
  trust_score?: number;
};

function OrbitConnector({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.orbitConnector,
        {
          left: midX,
          top: midY,
          width: len,
          marginLeft: -len / 2,
          marginTop: -0.5,
          transform: [{ rotate: `${angleDeg}deg` }],
        },
      ]}
    />
  );
}

function SearchOrbitPhase({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);
  const angles = useRef([
    0,
    Math.PI / 2,
    Math.PI,
    (3 * Math.PI) / 2,
  ]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      for (let i = 0; i < 4; i++) {
        let a = angles.current[i]! + PILL_OMEGA[i]!;
        if (a > 2 * Math.PI) a -= 2 * Math.PI;
        angles.current[i] = a;
      }
      setTick((t) => (t + 1) % 1_000_000);
    }, ORBIT_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  const layout = useMemo(() => {
    const cx = ORBIT_CX;
    const cy = ORBIT_CY;
    const th = angles.current;
    return [0, 1, 2, 3].map((i) => {
      const a = th[i]!;
      const px = cx + ORBIT_R * Math.cos(a);
      const py = cy + ORBIT_R * Math.sin(a);
      return { px, py, label: PILL_LABELS[i] ?? '' };
    });
  }, [tick]);

  const hubCx = ORBIT_CX;
  const hubCy = ORBIT_CY;

  return (
    <View style={styles.orbitBox}>
      {layout.map((L, i) => (
        <OrbitConnector
          key={`line-${i}`}
          x1={hubCx}
          y1={hubCy}
          x2={L.px}
          y2={L.py}
        />
      ))}
      {layout.map((L, i) => (
        <View
          key={`pill-${i}`}
          style={[
            styles.sourcePillOrbit,
            {
              left: L.px - 44,
              top: L.py - 14,
            },
          ]}
        >
          <Text style={styles.sourcePillOrbitLabel}>{L.label}</Text>
        </View>
      ))}
      <View
        style={[
          styles.searchHub,
          {
            left: ORBIT_CX - HUB_SEARCH_R,
            top: ORBIT_CY - HUB_SEARCH_R,
          },
        ]}
      >
        <View style={styles.lensOuter}>
          <View style={styles.lensInner} />
        </View>
        <View style={styles.magHandle} />
      </View>
    </View>
  );
}

export default function WebResultsScreen() {
  const navigation = useNavigation<WebNav>();
  const { params } = useRoute<WebRoute>();
  const {
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
    degree1Results,
    degree2Results,
  } = params;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const [msgIdx, setMsgIdx] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [listings, setListings] = useState<WebListing[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const animOpacity = useRef(new Animated.Value(1)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const countScroll = useRef(new Animated.Value(0)).current;
  const countScale = useRef(new Animated.Value(1)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % CYCLE_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const minWait = new Promise<void>((r) =>
      setTimeout(r, MIN_PHASE1_MS),
    );

    const api = (async () => {
      try {
        const res = await fetch(FIND_HOUSING_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            user_id: 2,
            destination_city,
            destination_state,
            university,
            date_from,
            date_to,
            preferences,
            user_willing_to_pay: 'yes',
            user_gender_preference: 'no preference',
            degree: 3,
          }),
        });
        const text = await res.text();
        let data: {
          ok?: boolean;
          webResults?: unknown;
          error?: string;
        } = {};
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          if (!cancelled) {
            setFetchError('Invalid response');
            setListings([]);
          }
          return;
        }
        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setFetchError(
              typeof data.error === 'string'
                ? data.error
                : `Request failed (${res.status})`,
            );
            setListings([]);
          }
          return;
        }
        const raw = data.webResults;
        const arr = Array.isArray(raw) ? (raw as WebListing[]) : [];
        if (!cancelled) {
          setFetchError(null);
          setListings(arr);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : String(e));
          setListings([]);
        }
      }
    })();

    void Promise.all([minWait, api]).then(() => {
      if (cancelled) return;
      setShowResults(true);
      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(resultsOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

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
    animOpacity,
    resultsOpacity,
  ]);

  const n = listings.length;

  const cardAnims = useMemo(
    () =>
      Array.from({ length: Math.max(n, 0) }, () => ({
        translateX: new Animated.Value(300),
        opacity: new Animated.Value(0),
      })),
    [n],
  );

  useEffect(() => {
    if (!showResults) return;

    if (fetchError || n === 0) {
      countScroll.setValue(0);
      countScale.setValue(1);
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    countScroll.setValue(0);
    countScale.setValue(1);
    footerOpacity.setValue(0);
    cardAnims.forEach((a) => {
      a.translateX.setValue(300);
      a.opacity.setValue(0);
    });

    const slotDist = n * SLOT_DIGIT_HEIGHT;
    Animated.timing(countScroll, {
      toValue: -slotDist,
      duration: COUNT_TOTAL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      countScale.setValue(1.12);
      Animated.spring(countScale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    });

    const cardsStart = COUNT_TOTAL_MS + COUNT_PAUSE_AFTER_MS;
    const tCards = setTimeout(() => {
      cardAnims.forEach((anim, i) => {
        const t = setTimeout(() => {
          Animated.parallel([
            Animated.timing(anim.translateX, {
              toValue: 0,
              duration: CARD_SLIDE_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: CARD_SLIDE_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();
        }, i * CARD_STAGGER_MS);
        timeouts.push(t);
      });
      const btnDelay = (n - 1) * CARD_STAGGER_MS + CARD_SLIDE_MS;
      timeouts.push(
        setTimeout(() => {
          Animated.timing(footerOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, btnDelay),
      );
    }, cardsStart);
    timeouts.push(tCards);

    return () => timeouts.forEach(clearTimeout);
  }, [
    showResults,
    fetchError,
    n,
    cardAnims,
    countScroll,
    countScale,
    footerOpacity,
  ]);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.backBtnRow}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backGlyph}>Back</Text>
          </Pressable>
        </View>
        {fetchError ? (
          <View style={styles.subHeaderBlock}>
            <Text style={[styles.countLine, styles.countLineSpacing]}>
              Something went wrong
            </Text>
            <Text style={styles.errorBanner}>{fetchError}</Text>
          </View>
        ) : n === 0 ? (
          <View style={styles.subHeaderBlock}>
            <Text style={[styles.countLine, { paddingHorizontal: 12 }]}>
              No listings found online for this search
            </Text>
          </View>
        ) : (
          <View style={styles.countHeaderBlock}>
            <Text style={[styles.countLine, styles.countLineAboveSlot]}>
              We found
            </Text>
            <Animated.View style={{ transform: [{ scale: countScale }] }}>
              <View style={styles.countSlotClip}>
                <Animated.View
                  style={[
                    styles.countSlotRail,
                    { transform: [{ translateY: countScroll }] },
                  ]}
                >
                  {Array.from({ length: n + 1 }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.countDigitCell,
                        { height: SLOT_DIGIT_HEIGHT },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countDigit,
                          i === n ? styles.countDigitFinal : styles.countDigitMuted,
                        ]}
                      >
                        {i}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              </View>
            </Animated.View>
            <Text style={[styles.countLine, styles.countLineBelowSlot]}>
              places online
            </Text>
          </View>
        )}
      </>
    ),
    [handleBack, fetchError, n, countScroll, countScale],
  );

  const renderItem: ListRenderItem<WebListing> = useCallback(
    ({ item, index }) => {
      const anim = cardAnims[index];
      if (!anim) return null;
      const src = item.source?.trim() || 'Other';
      const trust =
        typeof item.trust_score === 'number' && !Number.isNaN(item.trust_score)
          ? Math.round(item.trust_score)
          : null;
      const link = typeof item.link === 'string' ? item.link.trim() : '';
      return (
        <Animated.View
          style={{
            opacity: anim.opacity,
            transform: [{ translateX: anim.translateX }],
          }}
        >
          <View style={styles.resultCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardSourcePill}>
                <Text style={styles.cardSourcePillText}>{src}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>
              {item.title?.trim() || 'Untitled listing'}
            </Text>
            <Text style={styles.cardDescription}>
              {item.description?.trim() || ''}
            </Text>
            <View style={styles.cardBottomRow}>
              <Text style={styles.priceTag}>
                {item.estimated_price_range?.trim() || '—'}
              </Text>
              {trust != null ? (
                <View style={styles.trustPill}>
                  <Text style={styles.trustPillText}>{`Trust ${trust}/10`}</Text>
                </View>
              ) : (
                <View style={styles.trustPillPlaceholder} />
              )}
            </View>
            {link ? (
              <Pressable
                style={styles.viewListingBtn}
                onPress={() => {
                  void Linking.openURL(link);
                }}
              >
                <Text style={styles.viewListingBtnLabel}>View listing</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      );
    },
    [cardAnims],
  );

  const listFooter = useMemo(
    () => (
      <Animated.View style={[styles.footerWrap, { opacity: footerOpacity }]}>
        <Pressable
          style={styles.footerPrimary}
          onPress={() =>
            navigation.navigate('Summary', {
              destination_city,
              destination_state,
              date_from,
              date_to,
              degree1Results,
              degree2Results,
              webResults: listings,
            })
          }
        >
          <Text style={styles.footerPrimaryLabel}>See full summary</Text>
        </Pressable>
        <Pressable
          style={styles.footerSecondary}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.footerSecondaryLabel}>{"I'm good here"}</Text>
        </Pressable>
      </Animated.View>
    ),
    [
      navigation,
      footerOpacity,
      listings,
      destination_city,
      destination_state,
      date_from,
      date_to,
      degree1Results,
      degree2Results,
    ],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View
        style={[styles.layer, { opacity: animOpacity }]}
        pointerEvents={showResults ? 'none' : 'auto'}
      >
        <View style={styles.phase1Inner}>
          <Pressable
            onPress={handleBack}
            hitSlop={14}
            style={styles.backPhase1}
          >
            <Text style={styles.backGlyph}>Back</Text>
          </Pressable>
          <SearchOrbitPhase active={!showResults} />
          <Text style={styles.cycleText}>{CYCLE_MESSAGES[msgIdx]}</Text>
        </View>
      </Animated.View>

      {showResults ? (
        <Animated.View
          style={[styles.layer, styles.resultsLayer, { opacity: resultsOpacity }]}
        >
          <FlatList
            style={styles.resultsList}
            data={listings}
            keyExtractor={(_, i) => `web-${i}`}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IVORY,
  },
  resultsLayer: {
    zIndex: 2,
  },
  phase1Inner: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: IVORY,
  },
  backPhase1: {
    position: 'absolute',
    top: 50,
    left: 24,
    zIndex: 10,
    paddingVertical: 8,
  },
  orbitBox: {
    width: ORBIT_BOX,
    height: ORBIT_BOX,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 28,
    backgroundColor: IVORY,
  },
  orbitConnector: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(44,44,42,0.15)',
    zIndex: 0,
  },
  sourcePillOrbit: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CHARCOAL,
    zIndex: 2,
    minWidth: 72,
    alignItems: 'center',
  },
  sourcePillOrbitLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: IVORY,
    letterSpacing: -0.2,
  },
  searchHub: {
    position: 'absolute',
    width: HUB_SEARCH,
    height: HUB_SEARCH,
    borderRadius: HUB_SEARCH_R,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    zIndex: 3,
  },
  lensOuter: {
    width: LENS,
    height: LENS,
    borderRadius: LENS_R,
    borderWidth: 3,
    borderColor: CHARCOAL,
    backgroundColor: IVORY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensInner: {
    width: LENS - 10,
    height: LENS - 10,
    borderRadius: (LENS - 10) / 2,
    backgroundColor: IVORY,
  },
  magHandle: {
    position: 'absolute',
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: IVORY,
    bottom: 14,
    transform: [{ rotate: '48deg' }],
  },
  cycleText: {
    fontSize: 16,
    fontWeight: '400',
    color: CHARCOAL,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  resultsList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
    backgroundColor: IVORY,
  },
  backBtnRow: {
    alignSelf: 'stretch',
    paddingTop: 50,
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backGlyph: {
    fontSize: 16,
    fontWeight: '500',
    color: CHARCOAL,
  },
  subHeaderBlock: {
    paddingTop: 80,
    alignItems: 'center',
    width: '100%',
    paddingBottom: 8,
  },
  countHeaderBlock: {
    paddingTop: 80,
    alignItems: 'center',
    paddingBottom: 8,
    width: '100%',
  },
  countLine: {
    fontSize: 22,
    fontWeight: '500',
    color: CHARCOAL,
    textAlign: 'center',
    lineHeight: 28,
  },
  countLineSpacing: {
    marginBottom: 12,
  },
  countLineAboveSlot: {
    marginBottom: 6,
  },
  countLineBelowSlot: {
    marginTop: 6,
  },
  countSlotClip: {
    height: SLOT_DIGIT_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 100,
    marginVertical: 10,
  },
  countSlotRail: {
    alignItems: 'center',
  },
  countDigitCell: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  countDigit: {
    fontSize: 72,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 80,
    includeFontPadding: false,
  },
  countDigitMuted: {
    color: COUNT_MUTED,
  },
  countDigitFinal: {
    color: CHARCOAL,
  },
  errorBanner: {
    fontSize: 15,
    color: '#8B2942',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    backgroundColor: IVORY,
  },
  cardTopRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cardSourcePill: {
    alignSelf: 'flex-start',
    backgroundColor: CHARCOAL,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cardSourcePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: IVORY,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    marginBottom: 8,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: CHARCOAL,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceTag: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
    flex: 1,
    marginRight: 12,
  },
  trustPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: IVORY,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  trustPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: CHARCOAL,
  },
  trustPillPlaceholder: {
    minWidth: 1,
  },
  viewListingBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: CHARCOAL,
  },
  viewListingBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IVORY,
  },
  footerWrap: {
    marginTop: 24,
    marginBottom: 40,
    gap: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  footerPrimary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: CHARCOAL,
    alignSelf: 'stretch',
  },
  footerPrimaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: IVORY,
  },
  footerSecondary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHARCOAL,
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  footerSecondaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: CHARCOAL,
  },
});
