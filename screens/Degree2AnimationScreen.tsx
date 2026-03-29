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

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const LINE = 'rgba(44,44,42,0.12)';
const GOLD = '#C9A227';
const CARD_BORDER = '#E8E5E0';
const D2_SAT_FILL = '#8A8A88';

const CYCLE_MESSAGES = [
  'Reaching out further...',
  'Checking your friends networks...',
  'Finding hidden connections...',
] as const;

const DIRECT_INITIALS = ['JW', 'ZM', 'SO'] as const;

type ArmConfig = {
  rMin: number;
  rMax: number;
  pulseMs: number;
  angleMs: number;
  baseDeg: number;
};

const DIRECT_ARMS: ArmConfig[] = [
  { rMin: 88, rMax: 118, pulseMs: 3400, angleMs: 21000, baseDeg: 12 },
  { rMin: 92, rMax: 124, pulseMs: 3000, angleMs: 25500, baseDeg: 127 },
  { rMin: 78, rMax: 112, pulseMs: 3800, angleMs: 18800, baseDeg: 245 },
];

const HUB_SIZE = 80;
const HUB_R = HUB_SIZE / 2;
const SAT_SIZE = 50;
const SAT_R = SAT_SIZE / 2;
const D2_SAT_SIZE = 35;
const D2_SAT_R = D2_SAT_SIZE / 2;
const ORBIT_BOX = 360;
const CENTER = ORBIT_BOX / 2;
const MINI_ORBIT_R = 34;

const FIND_DEG2_MIN_MS = 3000;

type Route = RouteProp<RootStackParamList, 'Degree2Animation'>;
type Nav = StackNavigationProp<RootStackParamList, 'Degree2Animation'>;

type Deg2Result = {
  name?: string;
  university?: string | null;
  rating?: number | null;
  teaser_summary?: string | null;
  via_friend?: string | null;
};

function MiniOrbitalArm({
  baseDeg,
  angleMs,
  orbitR,
}: {
  baseDeg: number;
  angleMs: number;
  orbitR: number;
}) {
  const angleSpin = useRef(new Animated.Value(0)).current;

  const rotate = useMemo(
    () =>
      angleSpin.interpolate({
        inputRange: [0, 1],
        outputRange: [`${baseDeg}deg`, `${baseDeg + 360}deg`],
      }),
    [angleSpin, baseDeg],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(angleSpin, {
        toValue: 1,
        duration: angleMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [angleSpin, angleMs]);

  return (
    <Animated.View
      style={[
        styles.miniPivot,
        {
          transform: [{ rotate }],
        },
      ]}
    >
      <View
        style={[
          styles.miniLine,
          {
            width: orbitR,
          },
        ]}
      />
      <View
        style={[
          styles.d2SatelliteOuter,
          {
            marginLeft: -D2_SAT_R,
            marginTop: -D2_SAT_R,
            transform: [{ translateX: orbitR }],
          },
        ]}
      >
        <View style={styles.d2SatelliteCircle} />
      </View>
    </Animated.View>
  );
}

function FriendArmCluster({
  config,
  initials,
  miniAngleA,
  miniAngleB,
  miniSpeedA,
  miniSpeedB,
}: {
  config: ArmConfig;
  initials: string;
  miniAngleA: number;
  miniAngleB: number;
  miniSpeedA: number;
  miniSpeedB: number;
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
        <View style={styles.miniOrbitHost} pointerEvents="none">
          <MiniOrbitalArm
            baseDeg={miniAngleA}
            angleMs={miniSpeedA}
            orbitR={MINI_ORBIT_R}
          />
          <MiniOrbitalArm
            baseDeg={miniAngleB}
            angleMs={miniSpeedB}
            orbitR={MINI_ORBIT_R - 5}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function groupByViaFriend(rows: Deg2Result[]): Map<string, Deg2Result[]> {
  const m = new Map<string, Deg2Result[]>();
  for (const r of rows) {
    const v = (r.via_friend ?? 'Friend').trim() || 'Friend';
    if (!m.has(v)) m.set(v, []);
    m.get(v)!.push(r);
  }
  return m;
}

export default function Degree2AnimationScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const {
    user_id,
    destination_city,
    destination_state,
    university,
    date_from,
    date_to,
    preferences,
  } = params;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const [messageIndex, setMessageIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [deg2Results, setDeg2Results] = useState<Deg2Result[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const animLayerOpacity = useRef(new Animated.Value(1)).current;
  const resultsLayerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % CYCLE_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    console.log('Degree2 screen mounted, calling API with:', {
      destination_city,
      destination_state,
      degree: 2,
    });

    let cancelled = false;

    const minDelay = new Promise<void>((resolve) =>
      setTimeout(resolve, FIND_DEG2_MIN_MS),
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
            degree: 2,
          }),
        });
        const text = await res.text();
        let data: {
          ok?: boolean;
          degree2Results?: unknown;
          error?: string;
        } = {};
        try {
          data = JSON.parse(text) as typeof data;
        } catch (error) {
          console.log('Degree2 API error:', error);
          if (!cancelled) {
            setFetchError('Invalid response');
            setDeg2Results([]);
          }
          return;
        }

        const response = { status: res.status, data };
        console.log('Degree2 API response:', JSON.stringify(response));

        if (!res.ok || !data.ok) {
          const error =
            typeof data.error === 'string'
              ? data.error
              : `Request failed (${res.status})`;
          console.log('Degree2 API error:', error);
          if (!cancelled) {
            setFetchError(error);
            setDeg2Results([]);
          }
          return;
        }
        const raw = data.degree2Results;
        const list = Array.isArray(raw) ? (raw as Deg2Result[]) : [];
        if (!cancelled) {
          setFetchError(null);
          setDeg2Results(list);
        }
      } catch (error) {
        console.log('Degree2 API error:', error);
        if (!cancelled) {
          setFetchError(
            error instanceof Error ? error.message : String(error),
          );
          setDeg2Results([]);
        }
      }
    })();

    void Promise.all([minDelay, apiCall]).then(() => {
      if (cancelled) return;
      setShowResults(true);
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

  const cityLabel = destination_city.trim() || 'this city';
  const grouped = useMemo(() => groupByViaFriend(deg2Results), [deg2Results]);
  const sectionKeys = useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View
        style={[styles.layer, { opacity: animLayerOpacity }]}
        pointerEvents={showResults ? 'none' : 'auto'}
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
            {DIRECT_ARMS.map((cfg, i) => (
              <FriendArmCluster
                key={i}
                config={cfg}
                initials={DIRECT_INITIALS[i] ?? '?'}
                miniAngleA={22 + i * 53}
                miniAngleB={198 + i * 41}
                miniSpeedA={5100 + i * 700}
                miniSpeedB={6900 + i * 500}
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

      {showResults ? (
        <Animated.View
          style={[
            styles.layer,
            styles.resultsLayer,
            { opacity: resultsLayerOpacity },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={styles.backBtnRow}
            >
              <Text style={styles.backGlyph}>Back</Text>
            </Pressable>

            <Text style={styles.resultsTitle}>Friends of friends</Text>
            <Text style={styles.resultsSubtitle}>
              {`People your connections know in ${cityLabel}`}
            </Text>

            {fetchError ? (
              <Text style={styles.errorText}>{fetchError}</Text>
            ) : null}

            {sectionKeys.length === 0 && !fetchError ? (
              <Text style={styles.emptyText}>
                No connections found through your friends
              </Text>
            ) : null}

            {sectionKeys.map((friendName) => {
              const people = grouped.get(friendName) ?? [];
              const n = people.length;
              return (
                <View key={friendName} style={styles.section}>
                  <Text style={styles.sectionHeader}>
                    {`${friendName} knows ${n} people in ${cityLabel}`}
                  </Text>
                  {people.map((row, idx) => {
                    const rating =
                      typeof row.rating === 'number' &&
                      !Number.isNaN(row.rating)
                        ? row.rating
                        : null;
                    const stars =
                      rating != null
                        ? Math.max(0, Math.min(5, Math.round(rating)))
                        : null;
                    return (
                      <View
                        key={`${friendName}-${idx}`}
                        style={styles.card}
                      >
                        <Text style={styles.cardNameHidden}>
                          ••••• •••••
                        </Text>
                        {row.university ? (
                          <Text style={styles.cardUniversity}>
                            {row.university}
                          </Text>
                        ) : null}
                        {stars != null ? (
                          <Text style={styles.cardStars}>
                            <Text style={styles.starGold}>
                              {'★'.repeat(stars)}
                            </Text>
                            <Text style={styles.starMuted}>
                              {'☆'.repeat(Math.max(0, 5 - stars))}
                            </Text>
                          </Text>
                        ) : null}
                        {row.teaser_summary ? (
                          <Text style={styles.cardTeaser}>
                            {row.teaser_summary}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  <Pressable style={styles.askPill} onPress={() => {}}>
                    <Text style={styles.askPillLabel}>
                      {`Ask ${friendName} for access`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.footerActionsWrap}>
              <Pressable
                style={styles.footerBtnPrimary}
                onPress={() => navigation.navigate('WebResults')}
              >
                <Text style={styles.footerBtnPrimaryLabel}>Keep searching</Text>
              </Pressable>
              <Pressable
                style={styles.footerBtnSecondary}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.footerBtnSecondaryLabel}>
                  {"I'm good here"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
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
  backBtnRow: {
    alignSelf: 'flex-start',
    paddingTop: 50,
    marginBottom: 12,
    paddingVertical: 6,
  },
  backGlyph: {
    fontSize: 16,
    fontWeight: '500',
    color: CHARCOAL,
  },
  orbitHost: {
    position: 'relative',
    marginBottom: 36,
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
  miniOrbitHost: {
    position: 'absolute',
    left: SAT_R,
    top: SAT_R,
    width: 0,
    height: 0,
    zIndex: 2,
  },
  miniPivot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  miniLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 1,
    marginTop: -0.5,
    backgroundColor: LINE,
  },
  d2SatelliteOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: D2_SAT_SIZE,
    height: D2_SAT_SIZE,
  },
  d2SatelliteCircle: {
    width: D2_SAT_SIZE,
    height: D2_SAT_SIZE,
    borderRadius: D2_SAT_R,
    backgroundColor: D2_SAT_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.2)',
  },
  hubWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: CHARCOAL,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  resultsSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: MUTED,
    marginBottom: 24,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 15,
    color: '#8B2942',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '500',
    color: CHARCOAL,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 24,
    lineHeight: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '600',
    color: CHARCOAL,
    marginBottom: 10,
    lineHeight: 24,
  },
  askPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: CHARCOAL,
  },
  askPillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IVORY,
  },
  card: {
    backgroundColor: IVORY,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    marginBottom: 12,
  },
  cardNameHidden: {
    fontSize: 17,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2,
    marginBottom: 6,
  },
  cardUniversity: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 6,
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
  cardTeaser: {
    fontSize: 15,
    color: CHARCOAL,
    lineHeight: 22,
  },
  footerActionsWrap: {
    marginTop: 16,
    marginBottom: 24,
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
