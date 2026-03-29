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
const LINE = 'rgba(44,44,42,0.15)';
const GOLD = '#C9A227';
const CARD_BORDER = '#E8E5E0';
const COUNT_MUTED = '#B0ADA8';

const COUNT_TOTAL_MS = 1200;
const COUNT_PAUSE_AFTER_MS = 2000;
const CARD_STAGGER_MS = 150;
const CARD_SLIDE_MS = 300;
const SLOT_DIGIT_HEIGHT = 86;

const CYCLE_MESSAGES = [
  'Checking your network',
  'Finding friends nearby',
  'Asking around for you',
  'Almost there',
] as const;

const SATELLITE_INITIALS = ['JW', 'ZM', 'TR', 'SO', 'CR'] as const;

type ArmConfig = {
  rMin: number;
  rMax: number;
  pulseMs: number;
  angleMs: number;
  baseDeg: number;
};

const ARM_CONFIGS: ArmConfig[] = [
  { rMin: 80, rMax: 120, pulseMs: 3000, angleMs: 18600, baseDeg: 19 },
  { rMin: 90, rMax: 140, pulseMs: 3800, angleMs: 24100, baseDeg: 81 },
  { rMin: 70, rMax: 110, pulseMs: 2800, angleMs: 17200, baseDeg: 147 },
  { rMin: 100, rMax: 150, pulseMs: 4200, angleMs: 26800, baseDeg: 213 },
  { rMin: 85, rMax: 125, pulseMs: 3500, angleMs: 20300, baseDeg: 301 },
];

const HUB_SIZE = 80;
const HUB_R = HUB_SIZE / 2;
const SAT_SIZE = 50;
const SAT_R = SAT_SIZE / 2;
const ORBIT_BOX = 340;
const CENTER = ORBIT_BOX / 2;

const FIND_HOUSING_MIN_MS = 3000;

type SearchAnimRoute = RouteProp<RootStackParamList, 'SearchAnimation'>;
type SearchAnimNav = StackNavigationProp<RootStackParamList, 'SearchAnimation'>;

type MatchResult = {
  name?: string;
  university?: string | null;
  rating?: number | null;
  summary?: string | null;
};

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

function OrbitalArm({
  config,
  initials,
}: {
  config: ArmConfig;
  initials: string;
}) {
  const radiusPulse = useRef(new Animated.Value(0)).current;
  const angleSpin = useRef(new Animated.Value(0)).current;

  const rInterp = useMemo(
    () =>
      radiusPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [config.rMin, config.rMax],
      }),
    [radiusPulse, config.rMin, config.rMax],
  );

  const rotate = useMemo(
    () =>
      angleSpin.interpolate({
        inputRange: [0, 1],
        outputRange: [`${config.baseDeg}deg`, `${config.baseDeg + 360}deg`],
      }),
    [angleSpin, config.baseDeg],
  );

  useEffect(() => {
    const half = Math.max(200, config.pulseMs / 2);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radiusPulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(radiusPulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    const angleLoop = Animated.loop(
      Animated.timing(angleSpin, {
        toValue: 1,
        duration: config.angleMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    pulseLoop.start();
    angleLoop.start();
    return () => {
      pulseLoop.stop();
      angleLoop.stop();
    };
  }, [config, radiusPulse, angleSpin]);

  return (
    <Animated.View
      style={[
        styles.armPivot,
        {
          left: CENTER,
          top: CENTER,
          transform: [{ rotate }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.connectorLine,
          {
            width: rInterp,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.satelliteOuter,
          {
            marginLeft: -SAT_R,
            marginTop: -SAT_R,
            transform: [{ translateX: rInterp }],
          },
        ]}
      >
        <View style={styles.satelliteCircle}>
          <Text style={styles.satelliteInitials}>{initials}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function SearchAnimationScreen() {
  const navigation = useNavigation<SearchAnimNav>();
  const { params } = useRoute<SearchAnimRoute>();

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const {
    user_id,
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
  } = params;

  const animLayerOpacity = useRef(new Animated.Value(1)).current;
  const resultsLayerOpacity = useRef(new Animated.Value(0)).current;

  const [messageIndex, setMessageIndex] = useState(0);
  const [showResultsLayer, setShowResultsLayer] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const countScroll = useRef(new Animated.Value(0)).current;
  const countScale = useRef(new Animated.Value(1)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;

  const cardAnims = useMemo(
    () =>
      results.map(() => ({
        translateX: new Animated.Value(300),
        opacity: new Animated.Value(0),
      })),
    [results],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % CYCLE_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const minDelay = new Promise<void>((resolve) =>
      setTimeout(resolve, FIND_HOUSING_MIN_MS),
    );

    const apiCall = (async () => {
      try {
        const res = await fetch(FIND_HOUSING_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            user_id,
            destination_city,
            destination_state,
            university,
            date_from,
            date_to,
            preferences,
            user_willing_to_pay: 'yes',
            user_gender_preference: 'no preference',
          }),
        });
        const text = await res.text();
        let data: {
          ok?: boolean;
          degree1Results?: unknown;
          degree2Results?: unknown;
          results?: unknown;
          error?: string;
        } = {};
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          if (!cancelled) {
            setFetchError('Invalid response');
            setResults([]);
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
            setResults([]);
          }
          return;
        }
        const raw = data.degree1Results ?? data.results;
        const list = Array.isArray(raw)
          ? (raw as MatchResult[])
          : [];
        if (!cancelled) {
          setFetchError(null);
          setResults(list);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : String(e));
          setResults([]);
        }
      }
    })();

    void Promise.all([minDelay, apiCall]).then(() => {
      if (cancelled) return;
      setShowResultsLayer(true);
      Animated.parallel([
        Animated.timing(animLayerOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(resultsLayerOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      cancelled = true;
    };
  }, [
    user_id,
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
    animLayerOpacity,
    resultsLayerOpacity,
  ]);

  const cityTitle = destination_city.trim() || 'this city';

  useEffect(() => {
    if (!showResultsLayer) return;

    if (fetchError || results.length === 0) {
      countScroll.setValue(0);
      countScale.setValue(1);
      Animated.timing(continueOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    const n = results.length;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    countScroll.setValue(0);
    countScale.setValue(1);
    continueOpacity.setValue(0);
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

    const cardsPhaseStart = COUNT_TOTAL_MS + COUNT_PAUSE_AFTER_MS;
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
      const buttonDelay = (n - 1) * CARD_STAGGER_MS + CARD_SLIDE_MS;
      const tBtn = setTimeout(() => {
        Animated.timing(continueOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, buttonDelay);
      timeouts.push(tBtn);
    }, cardsPhaseStart);
    timeouts.push(tCards);

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [
    showResultsLayer,
    fetchError,
    results.length,
    cardAnims,
    countScroll,
    countScale,
    continueOpacity,
  ]);

  const renderItem: ListRenderItem<MatchResult> = useCallback(
    ({ item, index }) => (
      <SlidingResultCard
        item={item}
        translateX={cardAnims[index]!.translateX}
        opacityAnim={cardAnims[index]!.opacity}
      />
    ),
    [cardAnims],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.backBtnRow}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Text style={styles.backGlyph}>Back</Text>
          </Pressable>
        </View>
        {fetchError ? (
          <View style={styles.subHeaderBlock}>
            <Text style={[styles.countHeaderLine, styles.countHeaderLineSpacing]}>
              Something went wrong
            </Text>
            <Text style={styles.errorBanner}>{fetchError}</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.subHeaderBlock}>
            <Text style={[styles.countHeaderLine, { paddingHorizontal: 12 }]}>
              {`No direct connections found in ${cityTitle}`}
            </Text>
          </View>
        ) : (
          <View style={styles.countHeaderBlock}>
            <Text style={[styles.countHeaderLine, styles.countHeaderLineAboveSlot]}>
              We found
            </Text>
            <Animated.View
              style={{ transform: [{ scale: countScale }] }}
            >
              <View style={styles.countSlotClip}>
                <Animated.View
                  style={[
                    styles.countSlotRail,
                    { transform: [{ translateY: countScroll }] },
                  ]}
                >
                  {Array.from({ length: results.length + 1 }, (_, i) => (
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
                          i === results.length
                            ? styles.countDigitFinal
                            : styles.countDigitMuted,
                        ]}
                      >
                        {i}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              </View>
            </Animated.View>
            <Text
              style={[styles.countHeaderLine, styles.countHeaderLineBelowSlot]}
            >
              friends you can reach out to
            </Text>
          </View>
        )}
      </>
    ),
    [
      handleBack,
      fetchError,
      results.length,
      cityTitle,
      countScroll,
      countScale,
    ],
  );

  const listFooter = useMemo(
    () => (
      <Animated.View
        style={[
          styles.footerActionsWrap,
          { opacity: continueOpacity },
        ]}
      >
        <Pressable
          style={styles.footerBtnPrimary}
          onPress={() =>
            navigation.navigate('Degree2Animation', {
              user_id,
              destination_city,
              destination_state,
              university,
              date_from,
              date_to,
              preferences,
            })
          }
        >
          <Text style={styles.footerBtnPrimaryLabel}>Keep searching</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtnSecondary}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.footerBtnSecondaryLabel}>I'm good here</Text>
        </Pressable>
      </Animated.View>
    ),
    [
      navigation,
      continueOpacity,
      user_id,
      destination_city,
      destination_state,
      university,
      date_from,
      date_to,
      preferences,
    ],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View
        style={[styles.layer, { opacity: animLayerOpacity }]}
        pointerEvents={showResultsLayer ? 'none' : 'auto'}
      >
        <View style={styles.phase1Inner}>
          <Pressable
            onPress={handleBack}
            hitSlop={14}
            style={styles.backBtnPhase1}
          >
            <Text style={styles.backGlyph}>Back</Text>
          </Pressable>
          <View style={[styles.orbitHost, { width: ORBIT_BOX, height: ORBIT_BOX }]}>
            {ARM_CONFIGS.map((cfg, i) => (
              <OrbitalArm
                key={i}
                config={cfg}
                initials={SATELLITE_INITIALS[i] ?? '?'}
              />
            ))}
            <View style={styles.hubWrap} pointerEvents="none">
              <View style={styles.hubCircle}>
                <Text style={styles.hubInitials}>EY</Text>
              </View>
            </View>
          </View>
          <Text style={styles.cycleText}>{CYCLE_MESSAGES[messageIndex]}</Text>
        </View>
      </Animated.View>

      {showResultsLayer ? (
        <Animated.View
          style={[
            styles.layer,
            styles.resultsLayer,
            { opacity: resultsLayerOpacity },
          ]}
        >
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item.name ?? 'x'}-${i}`}
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

function SlidingResultCard({
  item,
  translateX,
  opacityAnim,
}: {
  item: MatchResult;
  translateX: Animated.Value;
  opacityAnim: Animated.Value;
}) {
  const name = item.name ?? 'Unknown';
  const rating =
    typeof item.rating === 'number' && !Number.isNaN(item.rating)
      ? item.rating
      : null;
  const stars =
    rating != null
      ? Math.max(0, Math.min(5, Math.round(rating)))
      : null;

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          opacity: opacityAnim,
          transform: [{ translateX }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>{initialsFromName(name)}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardName}>{name}</Text>
            {item.university ? (
              <Text style={styles.cardUniversity}>{item.university}</Text>
            ) : null}
            {stars != null ? (
              <Text style={styles.cardStars}>
                <Text style={styles.starGold}>{'★'.repeat(stars)}</Text>
                <Text style={styles.starMuted}>
                  {'☆'.repeat(Math.max(0, 5 - stars))}
                </Text>
              </Text>
            ) : null}
            {item.summary ? (
              <Text style={styles.cardSummary}>{item.summary}</Text>
            ) : null}
            <View style={styles.cardFooter}>
              <Pressable style={styles.messagePill} onPress={() => {}}>
                <Text style={styles.messagePillLabel}>Message</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
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
    paddingBottom: 48,
    backgroundColor: IVORY,
  },
  backBtnPhase1: {
    position: 'absolute',
    top: 50,
    left: 24,
    zIndex: 10,
    paddingVertical: 8,
  },
  orbitHost: {
    position: 'relative',
    marginBottom: 40,
    backgroundColor: IVORY,
  },
  armPivot: {
    position: 'absolute',
    width: 0,
    height: 0,
    zIndex: 0,
  },
  connectorLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 1,
    marginTop: -0.5,
    backgroundColor: LINE,
  },
  satelliteOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SAT_SIZE,
    height: SAT_SIZE,
    zIndex: 1,
  },
  satelliteCircle: {
    width: SAT_SIZE,
    height: SAT_SIZE,
    borderRadius: SAT_R,
    backgroundColor: CHARCOAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satelliteInitials: {
    color: IVORY,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  hubWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  hubCircle: {
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_R,
    backgroundColor: CHARCOAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubInitials: {
    color: IVORY,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cycleText: {
    fontSize: 16,
    fontWeight: '400',
    color: CHARCOAL,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    letterSpacing: -0.2,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 0,
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
  countHeaderLine: {
    fontSize: 22,
    fontWeight: '500',
    color: CHARCOAL,
    textAlign: 'center',
    lineHeight: 28,
  },
  countHeaderLineSpacing: {
    marginBottom: 12,
  },
  countHeaderLineAboveSlot: {
    marginBottom: 6,
  },
  countHeaderLineBelowSlot: {
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
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  cardWrap: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: IVORY,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    minHeight: 140,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardAvatarText: {
    color: IVORY,
    fontSize: 14,
    fontWeight: '600',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: CHARCOAL,
    marginBottom: 3,
  },
  cardUniversity: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 8,
  },
  cardStars: {
    fontSize: 14,
    marginBottom: 8,
  },
  starGold: {
    color: GOLD,
  },
  starMuted: {
    color: '#D4D1CB',
  },
  cardSummary: {
    fontSize: 15,
    fontWeight: '400',
    color: CHARCOAL,
    lineHeight: 22,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  messagePill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: IVORY,
  },
  messagePillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CHARCOAL,
  },
  footerActionsWrap: {
    marginTop: 24,
    marginBottom: 40,
    width: '100%',
    alignSelf: 'stretch',
    gap: 12,
  },
  footerBtnPrimary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: CHARCOAL,
    alignSelf: 'stretch',
  },
  footerBtnPrimaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: IVORY,
  },
  footerBtnSecondary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CHARCOAL,
    alignSelf: 'stretch',
  },
  footerBtnSecondaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: CHARCOAL,
  },
});
