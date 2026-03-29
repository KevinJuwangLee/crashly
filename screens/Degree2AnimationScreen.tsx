import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ListRenderItem,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntroRequestCardView } from '../components/IntroRequestCardView';
import type { IntroRequestPayload } from '../components/IntroRequestCardView';
import type { RootStackParamList } from '../App';
import { supabase, supabaseAnonKey } from '../lib/supabase';

const FIND_HOUSING_URL =
  'https://mfvyjksetlmzfxrviadq.supabase.co/functions/v1/find-housing';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const GOLD = '#C9A227';
const CARD_BORDER = '#E8E5E0';
const D2_SAT_FILL = '#8A8A88';
const COUNT_MUTED = '#B0ADA8';

const COUNT_TOTAL_MS = 1200;
const COUNT_PAUSE_AFTER_MS = 2000;
const SECTION_STAGGER_MS = 200;
const CARD_SLIDE_MS = 300;
const SLOT_DIGIT_HEIGHT = 86;

const CYCLE_MESSAGES = [
  'Reaching out further...',
  'Checking your friends networks...',
  'Finding hidden connections...',
] as const;

const DIRECT_INITIALS = ['JW', 'ZM', 'SO'] as const;

const ORBIT_BOX = 320;
const ORBIT_CX = ORBIT_BOX / 2;
const ORBIT_CY = ORBIT_BOX / 2;
const HUB_SIZE = 80;
const HUB_R = HUB_SIZE / 2;
const FRIEND_SIZE = 55;
const FRIEND_R = FRIEND_SIZE / 2;
const D2_SIZE = 32;
const D2_R = D2_SIZE / 2;
const R_FRIEND_ORBIT = 130;
const R_D2_ORBIT = 65;
const ORBIT_TICK_MS = 16;

const FRIEND_OMEGA = [0.008, 0.006, 0.01] as const;
const D2_OMEGA: readonly [number, number][] = [
  [0.015, 0.02],
  [0.018, 0.014],
  [0.016, 0.022],
];

const FIND_DEG2_MIN_MS = 3000;
const MESSAGE_USER_ID = 2;

type Route = RouteProp<RootStackParamList, 'Degree2Animation'>;
type Nav = StackNavigationProp<RootStackParamList, 'Degree2Animation'>;

type Deg2Result = {
  name?: string;
  university?: string | null;
  rating?: number | null;
  teaser_summary?: string | null;
  via_friend?: string | null;
  via_friend_profile_id?: string | null;
  via_friend_id?: string | null;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const a = parts[0]![0] ?? '';
  const b = parts[parts.length - 1]![0] ?? '';
  return (a + b).toUpperCase();
}

function OrbitLine({
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
  if (len < 0.5) {
    return null;
  }
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.orbitLineSeg,
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

function TrigOrbitField({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);
  const friendAngles = useRef([
    0,
    (2 * Math.PI) / 3,
    (4 * Math.PI) / 3,
  ]);
  const d2Angles = useRef<number[][]>([
    [0, Math.PI],
    [Math.PI / 2, (3 * Math.PI) / 2],
    [Math.PI / 4, (5 * Math.PI) / 4],
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        let a = friendAngles.current[i]! + FRIEND_OMEGA[i]!;
        if (a > 2 * Math.PI) {
          a -= 2 * Math.PI;
        }
        friendAngles.current[i] = a;
      }
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          let b = d2Angles.current[i]![j]! + D2_OMEGA[i]![j]!;
          if (b > 2 * Math.PI) {
            b -= 2 * Math.PI;
          }
          d2Angles.current[i]![j] = b;
        }
      }
      setTick((t) => (t + 1) % 1_000_000);
    }, ORBIT_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  const layout = useMemo(() => {
    const cx = ORBIT_CX;
    const cy = ORBIT_CY;
    const fa = friendAngles.current;
    const da = d2Angles.current;
    return [0, 1, 2].map((i) => {
      const ang = fa[i]!;
      const fx = cx + R_FRIEND_ORBIT * Math.cos(ang);
      const fy = cy + R_FRIEND_ORBIT * Math.sin(ang);
      const d2s = [0, 1].map((j) => {
        const sa = da[i]![j]!;
        return {
          x: fx + R_D2_ORBIT * Math.cos(sa),
          y: fy + R_D2_ORBIT * Math.sin(sa),
        };
      });
      return { fx, fy, d2s };
    });
  }, [tick]);

  return (
    <View style={styles.trigOrbitHost}>
      {layout.map((L, i) => (
        <OrbitLine
          key={`hub-f-${i}`}
          x1={ORBIT_CX}
          y1={ORBIT_CY}
          x2={L.fx}
          y2={L.fy}
        />
      ))}
      {layout.map((L, i) =>
        L.d2s.map((p, j) => (
          <OrbitLine
            key={`f${i}-d2-${j}`}
            x1={L.fx}
            y1={L.fy}
            x2={p.x}
            y2={p.y}
          />
        )),
      )}
      {layout.map((L, i) =>
        L.d2s.map((p, j) => (
          <View
            key={`d2-${i}-${j}`}
            style={[
              styles.trigD2Circle,
              {
                left: p.x - D2_R,
                top: p.y - D2_R,
              },
            ]}
          />
        )),
      )}
      {layout.map((L, i) => (
        <View
          key={`friend-${i}`}
          style={[
            styles.trigFriendCircle,
            {
              left: L.fx - FRIEND_R,
              top: L.fy - FRIEND_R,
            },
          ]}
        >
          <Text style={styles.trigFriendInitials}>
            {DIRECT_INITIALS[i] ?? '?'}
          </Text>
        </View>
      ))}
      <View
        style={[
          styles.trigHubCircle,
          {
            left: ORBIT_CX - HUB_R,
            top: ORBIT_CY - HUB_R,
          },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('../assets/handsome-dan.jpg')}
          style={styles.trigHubAvatar}
          resizeMode="cover"
        />
      </View>
    </View>
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

type Deg2Section = {
  viaFriend: string;
  people: Deg2Result[];
};

function bridgeProfileIdFromSection(section: Deg2Section): string | null {
  for (const p of section.people) {
    const raw = p.via_friend_id ?? p.via_friend_profile_id;
    const id =
      typeof raw === 'string' && raw.trim()
        ? raw.trim()
        : typeof raw === 'number'
          ? String(raw)
          : null;
    if (id) return id;
  }
  return null;
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
    degree1Results,
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
  const countScroll = useRef(new Animated.Value(0)).current;
  const countScale = useRef(new Animated.Value(1)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;

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

  const grouped = useMemo(() => groupByViaFriend(deg2Results), [deg2Results]);
  const sectionKeys = useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

  const sections = useMemo((): Deg2Section[] => {
    return sectionKeys.map((viaFriend) => ({
      viaFriend,
      people: grouped.get(viaFriend) ?? [],
    }));
  }, [sectionKeys, grouped]);

  const totalCardCount = useMemo(
    () => sections.reduce((acc, s) => acc + s.people.length, 0),
    [sections],
  );

  const sectionAnims = useMemo(
    () =>
      Array.from({ length: sections.length }, () => ({
        translateX: new Animated.Value(300),
        opacity: new Animated.Value(0),
      })),
    [sections.length],
  );

  const sheetAnim = useRef(new Animated.Value(520)).current;
  const [introSheetVisible, setIntroSheetVisible] = useState(false);
  const [introSheetSection, setIntroSheetSection] =
    useState<Deg2Section | null>(null);
  const [introPersonalNote, setIntroPersonalNote] = useState('');
  const [introSubmitting, setIntroSubmitting] = useState(false);

  useEffect(() => {
    if (!introSheetVisible) return;
    sheetAnim.setValue(520);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [introSheetVisible, sheetAnim]);

  const closeIntroSheet = useCallback(() => {
    if (introSubmitting) return;
    Animated.timing(sheetAnim, {
      toValue: 520,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setIntroSheetVisible(false);
      setIntroSheetSection(null);
      setIntroPersonalNote('');
    });
  }, [introSubmitting, sheetAnim]);

  const openIntroSheet = useCallback((section: Deg2Section) => {
    const pid = bridgeProfileIdFromSection(section);
    if (!pid) {
      Alert.alert(
        'Cannot start chat',
        "Could not resolve that friend's profile.",
      );
      return;
    }
    setIntroSheetSection(section);
    setIntroPersonalNote('');
    setIntroSheetVisible(true);
  }, []);

  const submitIntroRequest = useCallback(async () => {
    const section = introSheetSection;
    if (!section || introSubmitting) return;

    const profileId = bridgeProfileIdFromSection(section);
    if (!profileId) {
      Alert.alert(
        'Cannot start chat',
        "Could not resolve that friend's profile.",
      );
      return;
    }

    const vf = section.viaFriend.trim() || 'Friend';
    const otherInitials = initialsFromName(vf);
    const connectionsCount = section.people.length;

    const introPayload = {
      type: 'intro_request' as const,
      via_friend: vf,
      destination_city,
      destination_state,
      date_from,
      date_to,
      requester_name: 'Elihu Yale',
      requester_university: 'Yale University',
      personal_note: introPersonalNote.trim(),
      connections_count: connectionsCount,
      status: 'pending' as const,
    };

    setIntroSubmitting(true);

    const q12 = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id_1', MESSAGE_USER_ID)
      .eq('user_id_2', profileId)
      .maybeSingle();

    let conversationId: string | null = q12.data?.id
      ? String(q12.data.id)
      : null;

    if (!conversationId) {
      const q21 = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id_1', profileId)
        .eq('user_id_2', MESSAGE_USER_ID)
        .maybeSingle();

      conversationId = q21.data?.id ? String(q21.data.id) : null;
    }

    if (!conversationId) {
      const ins = await supabase
        .from('conversations')
        .insert({
          user_id_1: MESSAGE_USER_ID,
          user_id_2: profileId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (ins.error || !ins.data?.id) {
        setIntroSubmitting(false);
        Alert.alert(
          'Could not start chat',
          ins.error?.message ?? 'Failed to create conversation',
        );
        return;
      }
      conversationId = String(ins.data.id);
    }

    const msg = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: MESSAGE_USER_ID,
      content: JSON.stringify(introPayload),
      is_trip_request: true,
      created_at: new Date().toISOString(),
    });

    if (msg.error) {
      setIntroSubmitting(false);
      Alert.alert('Could not send request', msg.error.message);
      return;
    }

    const destSummary = `Introduction request · ${destination_city.trim()}`;

    Animated.timing(sheetAnim, {
      toValue: 520,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIntroSheetVisible(false);
        setIntroSheetSection(null);
        setIntroPersonalNote('');
      }
    });

    navigation.navigate('Chat', {
      conversation_id: conversationId,
      other_user_name: vf,
      other_user_initials: otherInitials,
      trip_summary: {
        destination: destSummary,
      },
    });

    setIntroSubmitting(false);
  }, [
    introSheetSection,
    introSubmitting,
    introPersonalNote,
    destination_city,
    destination_state,
    date_from,
    date_to,
    navigation,
    sheetAnim,
  ]);

  const introPreviewPayload: IntroRequestPayload | null = introSheetSection
    ? {
        type: 'intro_request',
        via_friend: introSheetSection.viaFriend.trim() || 'Friend',
        destination_city,
        destination_state,
        date_from,
        date_to,
        connections_count: introSheetSection.people.length,
        status: 'pending',
      }
    : null;

  useEffect(() => {
    if (!showResults) return;

    if (fetchError || totalCardCount === 0) {
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

    const n = totalCardCount;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    countScroll.setValue(0);
    countScale.setValue(1);
    continueOpacity.setValue(0);
    sectionAnims.forEach((a) => {
      a.translateX.setValue(300);
      a.opacity.setValue(0);
    });

    const numSections = sectionAnims.length;
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
      sectionAnims.forEach((anim, i) => {
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
        }, i * SECTION_STAGGER_MS);
        timeouts.push(t);
      });
      const buttonDelay =
        (numSections - 1) * SECTION_STAGGER_MS + CARD_SLIDE_MS;
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
    showResults,
    fetchError,
    totalCardCount,
    sectionAnims,
    countScroll,
    countScale,
    continueOpacity,
  ]);

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
        ) : totalCardCount === 0 ? (
          <View style={styles.subHeaderBlock}>
            <Text style={[styles.countHeaderLine, { paddingHorizontal: 12 }]}>
              No connections found through your friends
            </Text>
          </View>
        ) : (
          <View style={styles.countHeaderBlock}>
            <Text style={[styles.countHeaderLine, styles.countHeaderLineAboveSlot]}>
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
                  {Array.from({ length: totalCardCount + 1 }, (_, i) => (
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
                          i === totalCardCount
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
              friends of friends nearby
            </Text>
          </View>
        )}
      </>
    ),
    [
      handleBack,
      fetchError,
      totalCardCount,
      countScroll,
      countScale,
    ],
  );

  const listFooter = useMemo(
    () => (
      <Animated.View
        style={[styles.footerActionsWrap, { opacity: continueOpacity }]}
      >
        <Pressable
          style={styles.footerBtnPrimary}
          onPress={() =>
            navigation.navigate('WebResults', {
              destination_city,
              destination_state,
              university,
              date_from,
              date_to,
              preferences,
              degree1Results,
              degree2Results: deg2Results,
            })
          }
        >
          <Text style={styles.footerBtnPrimaryLabel}>
            Keep searching online
          </Text>
        </Pressable>
        <Pressable
          style={styles.footerBtnSecondary}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.footerBtnSecondaryLabel}>
            {"I'm good here"}
          </Text>
        </Pressable>
      </Animated.View>
    ),
    [
      navigation,
      continueOpacity,
      destination_city,
      destination_state,
      university,
      date_from,
      date_to,
      preferences,
      degree1Results,
      deg2Results,
    ],
  );

  const renderItem: ListRenderItem<Deg2Section> = useCallback(
    ({ item, index }) => {
      const anim = sectionAnims[index];
      if (!anim) {
        return null;
      }

      return (
        <Animated.View
          style={{
            opacity: anim.opacity,
            transform: [{ translateX: anim.translateX }],
          }}
        >
          <Text
            style={[
              styles.sectionHeader,
              index === 0 ? styles.sectionHeaderFirst : null,
            ]}
          >
            {`${item.viaFriend} knows ${item.people.length} people nearby`}
          </Text>
          {item.people.map((row, idx) => {
            const rating =
              typeof row.rating === 'number' && !Number.isNaN(row.rating)
                ? row.rating
                : null;
            const stars =
              rating != null
                ? Math.max(0, Math.min(5, Math.round(rating)))
                : null;
            return (
              <View key={`${item.viaFriend}-card-${idx}`} style={styles.card}>
                <View style={styles.nameRedactBar} />
                {row.university ? (
                  <Text style={styles.cardUniversity}>{row.university}</Text>
                ) : null}
                {stars != null ? (
                  <Text style={styles.cardStars}>
                    <Text style={styles.starGold}>{'★'.repeat(stars)}</Text>
                    <Text style={styles.starMuted}>
                      {'☆'.repeat(Math.max(0, 5 - stars))}
                    </Text>
                  </Text>
                ) : null}
                {row.teaser_summary ? (
                  <Text style={styles.cardTeaser}>{row.teaser_summary}</Text>
                ) : null}
              </View>
            );
          })}
          <Pressable
            style={styles.askPill}
            onPress={() => openIntroSheet(item)}
          >
            <Text style={styles.askPillLabel}>
              {`Ask ${item.viaFriend} for access`}
            </Text>
          </Pressable>
        </Animated.View>
      );
    },
    [sectionAnims, openIntroSheet],
  );

  const keyExtractor = useCallback((item: Deg2Section) => item.viaFriend, []);

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
          <TrigOrbitField active={!showResults} />
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
          <FlatList
            style={styles.resultsList}
            data={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      ) : null}

      <Modal
        visible={introSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeIntroSheet}
      >
        <KeyboardAvoidingView
          style={styles.sheetRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={closeIntroSheet}
            disabled={introSubmitting}
          />
          <Animated.View
            style={[
              styles.sheetPanel,
              { transform: [{ translateY: sheetAnim }] },
            ]}
          >
            <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScrollContent}
              >
                <Text style={styles.sheetTitle}>Ask for an introduction</Text>
                {introPreviewPayload ? (
                  <IntroRequestCardView
                    data={introPreviewPayload}
                    includePersonalInCard={false}
                    includeRequesterRow={false}
                  />
                ) : null}
                <TextInput
                  style={styles.sheetNoteInput}
                  value={introPersonalNote}
                  onChangeText={setIntroPersonalNote}
                  placeholder="Hey! Ask your friend personally..."
                  placeholderTextColor={MUTED}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
                <Pressable
                  style={[
                    styles.sheetSendBtn,
                    introSubmitting && styles.sheetSendBtnDisabled,
                  ]}
                  onPress={() => void submitIntroRequest()}
                  disabled={introSubmitting}
                >
                  <Text style={styles.sheetSendBtnLabel}>Send request</Text>
                </Pressable>
                <Pressable
                  onPress={closeIntroSheet}
                  disabled={introSubmitting}
                  style={styles.sheetCancelBtn}
                >
                  <Text style={styles.sheetCancelLabel}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
  trigOrbitHost: {
    width: ORBIT_BOX,
    height: ORBIT_BOX,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 36,
    backgroundColor: IVORY,
  },
  orbitLineSeg: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(44,44,42,0.2)',
    zIndex: 0,
  },
  trigD2Circle: {
    position: 'absolute',
    width: D2_SIZE,
    height: D2_SIZE,
    borderRadius: D2_R,
    backgroundColor: D2_SAT_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.2)',
    zIndex: 1,
  },
  trigFriendCircle: {
    position: 'absolute',
    width: FRIEND_SIZE,
    height: FRIEND_SIZE,
    borderRadius: FRIEND_R,
    backgroundColor: CHARCOAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  trigFriendInitials: {
    color: IVORY,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  trigHubCircle: {
    position: 'absolute',
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_R,
    overflow: 'hidden',
    backgroundColor: CHARCOAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,44,42,0.35)',
    zIndex: 3,
  },
  trigHubAvatar: {
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_R,
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
    paddingBottom: 24,
    paddingTop: 0,
    backgroundColor: IVORY,
    flexGrow: 1,
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
  sectionHeader: {
    fontSize: 18,
    fontWeight: '500',
    color: CHARCOAL,
    marginTop: 24,
    marginBottom: 10,
    lineHeight: 24,
  },
  sectionHeaderFirst: {
    marginTop: 8,
  },
  askPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 20,
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
  nameRedactBar: {
    width: 80,
    height: 16,
    borderRadius: 4,
    backgroundColor: CHARCOAL,
    opacity: 0.15,
    marginBottom: 10,
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
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44, 44, 42, 0.35)',
  },
  sheetPanel: {
    backgroundColor: IVORY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: CARD_BORDER,
    maxHeight: '88%',
    paddingTop: 8,
  },
  sheetSafe: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: CHARCOAL,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  sheetNoteInput: {
    marginTop: 16,
    minHeight: 96,
    maxHeight: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: IVORY,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: CHARCOAL,
    lineHeight: 22,
  },
  sheetSendBtn: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
  },
  sheetSendBtnDisabled: {
    opacity: 0.45,
  },
  sheetSendBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: IVORY,
  },
  sheetCancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetCancelLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: MUTED,
  },
});
