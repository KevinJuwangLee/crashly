import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { navigationRef } from '../App';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import type { CrashlyRole, OnboardingData } from '../types/onboarding';
import universitiesData from '../assets/universities.json';

type UniEntry = { name: string; city: string; state: string };
const allUniversities = universitiesData as UniEntry[];

const STATE_NAMES: Record<string, string> = {
  AK: 'Alaska', AL: 'Alabama', AR: 'Arkansas', AS: 'American Samoa',
  AZ: 'Arizona', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DC: 'Washington D.C.', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  GU: 'Guam', HI: 'Hawaii', IA: 'Iowa', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine', MI: 'Michigan',
  MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana',
  NC: 'North Carolina', ND: 'North Dakota', NE: 'Nebraska', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VA: 'Virginia', VI: 'U.S. Virgin Islands', VT: 'Vermont',
  WA: 'Washington', WI: 'Wisconsin', WV: 'West Virginia', WY: 'Wyoming',
};

const ALL_STATES = [...new Set(allUniversities.map((u) => u.state))]
  .sort((a, b) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b));

function getCitiesForState(state: string): string[] {
  return [...new Set(allUniversities.filter((u) => u.state === state).map((u) => u.city))].sort();
}


type StepId =
  | 'email'
  | 'password'
  | 'role'
  | 'name'
  | 'school'
  | 'state'
  | 'city'
  | 'cohabit'
  | 'paying'
  | 'charging'
  | 'availability'
  | 'complete';

type Transition =
  | null
  | { mode: 'forward'; nextIndex: number }
  | { mode: 'back'; prevIndex: number };

type Answers = {
  email: string;
  password: string;
  role: CrashlyRole | null;
  firstName: string;
  lastName: string;
  university: string;
  state: string;
  city: string;
  cohabitPreference: OnboardingData['cohabitPreference'] | null;
  paying: OnboardingData['paying'] | null;
  charging: OnboardingData['charging'] | null;
  availability: NonNullable<OnboardingData['availability']>;
};

const initialAnswers = (): Answers => ({
  email: '',
  password: '',
  role: null,
  firstName: '',
  lastName: '',
  university: '',
  state: '',
  city: '',
  cohabitPreference: null,
  paying: null,
  charging: null,
  availability: [],
});

function buildSteps(role: CrashlyRole | null): StepId[] {
  const s: StepId[] = ['email', 'password', 'role', 'name', 'school', 'state', 'city', 'cohabit'];
  if (role === 'stay' || role === 'both') s.push('paying');
  if (role === 'host' || role === 'both') {
    s.push('charging');
    s.push('availability');
  }
  s.push('complete');
  return s;
}


type Theme = {
  background: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  primaryBg: string;
  primaryText: string;
  progressTrack: string;
  progressFill: string;
  cardSelectedBorder: string;
  cardSelectedBg: string;
  chipSelectedBg: string;
  chipSelectedText: string;
};

const light: Theme = {
  background: '#FAF9F6',
  text: '#2C2C2A',
  textMuted: '#6B6965',
  textSubtle: '#8A8783',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E2DC',
  placeholder: '#A9A6A0',
  primaryBg: '#2C2C2A',
  primaryText: '#FAF9F6',
  progressTrack: '#E8E5DF',
  progressFill: '#2C2C2A',
  cardSelectedBorder: '#2C2C2A',
  cardSelectedBg: '#F3F1EC',
  chipSelectedBg: '#2C2C2A',
  chipSelectedText: '#FAF9F6',
};

const dark: Theme = {
  background: '#1C1C1A',
  text: '#F0EFEB',
  textMuted: '#B5B3AD',
  textSubtle: '#8E8C86',
  inputBg: '#252523',
  inputBorder: '#3A3A37',
  placeholder: '#6E6C68',
  primaryBg: '#FAF9F6',
  primaryText: '#2C2C2A',
  progressTrack: '#2E2E2C',
  progressFill: '#FAF9F6',
  cardSelectedBorder: '#FAF9F6',
  cardSelectedBg: '#2A2A28',
  chipSelectedBg: '#FAF9F6',
  chipSelectedText: '#2C2C2A',
};

function createStyles(t: Theme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: t.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      minHeight: 44,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      marginLeft: -8,
    },
    backGlyph: {
      fontSize: 28,
      fontWeight: '400',
      color: t.text,
      marginTop: -2,
    },
    progressOuter: {
      flex: 1,
      marginLeft: 4,
      marginRight: 20,
      justifyContent: 'center',
    },
    progressTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: t.progressTrack,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: t.progressFill,
    },
    keyboard: {
      flex: 1,
    },
    slideClip: {
      flex: 1,
      overflow: 'hidden',
    },
    slideRow: {
      flex: 1,
      flexDirection: 'row',
    },
    scrollContent: {
      paddingHorizontal: 32,
      paddingTop: 8,
      paddingBottom: 40,
      flexGrow: 1,
    },
    question: {
      fontSize: 30,
      fontWeight: '500',
      lineHeight: 40,
      letterSpacing: -0.5,
      color: t.text,
      marginBottom: 32,
    },
    optionsBlock: {
      gap: 12,
    },
    optionCard: {
      backgroundColor: t.inputBg,
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: 14,
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    optionCardSelected: {
      borderColor: t.cardSelectedBorder,
      backgroundColor: t.cardSelectedBg,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.2,
      color: t.text,
    },
    fieldGroup: {
      marginBottom: 18,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: t.textSubtle,
      marginBottom: 8,
      marginLeft: 2,
    },
    inputShell: {
      backgroundColor: t.inputBg,
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: 14,
      minHeight: 52,
      justifyContent: 'center',
    },
    input: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 16,
      color: t.text,
      letterSpacing: -0.2,
    },
    primaryButton: {
      backgroundColor: t.primaryBg,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 28,
    },
    primaryLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: t.primaryText,
      letterSpacing: -0.2,
    },
    primaryButtonDisabled: {
      opacity: 0.45,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    chip: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.inputBg,
    },
    chipLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
      letterSpacing: -0.2,
    },
    chipOn: {
      backgroundColor: t.chipSelectedBg,
      borderColor: t.chipSelectedBg,
    },
    chipLabelOn: {
      color: t.chipSelectedText,
    },
    completeTitle: {
      fontSize: 30,
      fontWeight: '500',
      lineHeight: 40,
      letterSpacing: -0.5,
      color: t.text,
      marginBottom: 16,
    },
    completeSubtitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      color: t.textMuted,
      letterSpacing: -0.1,
    },
  });
}

export default function OnboardingScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? dark : light;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [transition, setTransition] = useState<Transition>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signingUp, setSigningUp] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const translateX = useRef(new Animated.Value(0)).current;

  const steps = useMemo(() => buildSteps(answers.role), [answers.role]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [steps.length, stepIndex]);

  useEffect(() => {
    if (!transition) return;

    let cancelled = false;

    if (transition.mode === 'forward') {
      translateX.setValue(0);
      const anim = Animated.timing(translateX, {
        toValue: -windowWidth,
        duration: 360,
        easing: Easing.bezier(0.32, 0.08, 0.24, 1),
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (!finished || cancelled) return;
        setStepIndex(transition.nextIndex);
        setTransition(null);
        translateX.setValue(0);
      });
      return () => {
        cancelled = true;
        anim.stop();
      };
    }

    translateX.setValue(-windowWidth);
    const anim = Animated.timing(translateX, {
      toValue: 0,
      duration: 360,
      easing: Easing.bezier(0.32, 0.08, 0.24, 1),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished || cancelled) return;
      setStepIndex(transition.prevIndex);
      setTransition(null);
      translateX.setValue(0);
    });
    return () => {
      cancelled = true;
      anim.stop();
    };
  }, [transition, windowWidth, translateX]);

  const busy = transition !== null;

  const requestForward = useCallback(() => {
    if (busy || stepIndex >= steps.length - 1) return;
    setTransition({ mode: 'forward', nextIndex: stepIndex + 1 });
  }, [busy, stepIndex, steps.length]);

  const requestBack = useCallback(() => {
    if (busy || stepIndex <= 0) return;
    setTransition({ mode: 'back', prevIndex: stepIndex - 1 });
  }, [busy, stepIndex]);

  const currentStepId = steps[stepIndex];
  const progressRatio = (stepIndex + 1) / steps.length;

  const canProceed = useMemo(() => {
    switch (currentStepId) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.edu$/i.test(answers.email);
      case 'password':
        return answers.password.length >= 6;
      case 'role':
        return answers.role !== null;
      case 'name':
        return (
          answers.firstName.trim().length > 0 &&
          answers.lastName.trim().length > 0
        );
      case 'school':
        return answers.university.trim().length > 0;
      case 'state':
        return answers.state.trim().length > 0;
      case 'city':
        return answers.city.trim().length > 0;
      case 'cohabit':
        return answers.cohabitPreference !== null;
      case 'paying':
        return answers.paying !== null;
      case 'charging':
        return answers.charging !== null;
      case 'availability':
        return answers.availability.length > 0;
      case 'complete':
        return true;
      default:
        return false;
    }
  }, [currentStepId, answers]);

  const onSelectRole = useCallback(
    (role: CrashlyRole) => {
      if (busy || currentStepId !== 'role') return;
      setAnswers((prev) => ({
        ...prev,
        role,
        paying: null,
        charging: null,
        availability: [],
      }));
      setTransition({ mode: 'forward', nextIndex: stepIndex + 1 });
    },
    [busy, stepIndex],
  );

  const pickAndAdvance = useCallback(
    (patch: Partial<Answers>) => {
      if (busy || stepIndex >= steps.length - 1) return;
      setAnswers((prev) => ({ ...prev, ...patch }));
      setTransition({ mode: 'forward', nextIndex: stepIndex + 1 });
    },
    [busy, stepIndex, steps.length],
  );

  const toggleAvailability = (
    key: NonNullable<OnboardingData['availability']>[number],
  ) => {
    setAnswers((prev) => {
      const has = prev.availability.includes(key);
      const availability = has
        ? prev.availability.filter((x) => x !== key)
        : [...prev.availability, key];
      return { ...prev, availability };
    });
  };

  const finishOnboarding = async () => {
    setSignUpError(null);
    setSigningUp(true);
    const { error } = await supabase.auth.signUp({
      email: answers.email,
      password: answers.password,
    });
    setSigningUp(false);
    if (error) {
      setSignUpError(error.message);
      return;
    }
    navigationRef.navigate('Home');
  };

  const renderStepBody = (idx: number) => {
    const id = steps[idx];
    if (!id) return null;

    const optionCard = (
      label: string,
      selected: boolean,
      onPress: () => void,
    ) => (
      <Pressable
        key={label}
        onPress={onPress}
        disabled={busy}
        style={[styles.optionCard, selected && styles.optionCardSelected]}
      >
        <Text style={styles.optionLabel}>{label}</Text>
      </Pressable>
    );

    switch (id) {
      case 'email':
        return (
          <>
            <Text style={styles.question}>What's your college email?</Text>
            <Text style={{ fontSize: 14, color: theme.textMuted, marginBottom: 20, marginTop: -20 }}>
              Only .edu addresses are accepted.
            </Text>
            <View style={styles.fieldGroup}>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={answers.email}
                  onChangeText={(email) => setAnswers((p) => ({ ...p, email }))}
                  placeholder="you@university.edu"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            </View>
            <Pressable
              style={[styles.primaryButton, !canProceed && idx === stepIndex && styles.primaryButtonDisabled]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      case 'password':
        return (
          <>
            <Text style={styles.question}>Create a password</Text>
            <Text style={{ fontSize: 14, color: theme.textMuted, marginBottom: 20, marginTop: -20 }}>
              Must be at least 6 characters.
            </Text>
            <View style={styles.fieldGroup}>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={answers.password}
                  onChangeText={(password) => setAnswers((p) => ({ ...p, password }))}
                  placeholder="••••••••"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                />
              </View>
            </View>
            <Pressable
              style={[styles.primaryButton, !canProceed && idx === stepIndex && styles.primaryButtonDisabled]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      case 'role':
        return (
          <>
            <Text style={styles.question}>What brings you to Crashly?</Text>
            <View style={styles.optionsBlock}>
              {optionCard(
                'Find a place to stay',
                answers.role === 'stay',
                () => onSelectRole('stay'),
              )}
              {optionCard('Host others', answers.role === 'host', () =>
                onSelectRole('host'),
              )}
              {optionCard('Both', answers.role === 'both', () =>
                onSelectRole('both'),
              )}
            </View>
          </>
        );
      case 'name':
        return (
          <>
            <Text style={styles.question}>{`What's your name?`}</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>First name</Text>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={answers.firstName}
                  onChangeText={(firstName) =>
                    setAnswers((p) => ({ ...p, firstName }))
                  }
                  placeholder="Alex"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Last name</Text>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={answers.lastName}
                  onChangeText={(lastName) =>
                    setAnswers((p) => ({ ...p, lastName }))
                  }
                  placeholder="Rivera"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                !canProceed && idx === stepIndex && styles.primaryButtonDisabled,
              ]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      case 'school': {
        const schoolResults = schoolSearch.trim().length > 0
          ? allUniversities
              .filter((u) => u.name.toLowerCase().includes(schoolSearch.toLowerCase()))
              .slice(0, 12)
          : [];
        return (
          <>
            <Text style={styles.question}>Where do you go to school?</Text>
            <View style={styles.fieldGroup}>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={schoolSearch}
                  onChangeText={(q) => {
                    setSchoolSearch(q);
                    setAnswers((p) => ({ ...p, university: '' }));
                  }}
                  placeholder="Search your university…"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
            {answers.university ? (
              <View style={[styles.optionCard, styles.optionCardSelected, { marginBottom: 16 }]}>
                <Text style={styles.optionLabel}>{answers.university}</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginBottom: 16 }}>
                {schoolResults.map((u) => (
                  <Pressable
                    key={u.name + u.city}
                    style={styles.optionCard}
                    onPress={() => {
                      setAnswers((p) => ({ ...p, university: u.name }));
                      setSchoolSearch(u.name);
                    }}
                  >
                    <Text style={styles.optionLabel}>{u.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                      {u.city}, {u.state}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              style={[styles.primaryButton, !canProceed && idx === stepIndex && styles.primaryButtonDisabled]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      }
      case 'state': {
        const filteredStates = stateSearch.trim()
          ? ALL_STATES.filter((abbr) =>
              (STATE_NAMES[abbr] ?? abbr).toLowerCase().includes(stateSearch.toLowerCase())
            )
          : ALL_STATES;
        return (
          <>
            <Text style={styles.question}>What state are you based in?</Text>
            <View style={styles.fieldGroup}>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={stateSearch}
                  onChangeText={(q) => {
                    setStateSearch(q);
                    setAnswers((p) => ({ ...p, state: '', city: '' }));
                    setCitySearch('');
                  }}
                  placeholder="Search state…"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
            <View style={styles.optionsBlock}>
              {filteredStates.map((abbr) => (
                <Pressable
                  key={abbr}
                  style={[styles.optionCard, answers.state === abbr && styles.optionCardSelected]}
                  onPress={() => {
                    setAnswers((p) => ({ ...p, state: abbr, city: '' }));
                    setStateSearch(STATE_NAMES[abbr] ?? abbr);
                    setCitySearch('');
                    if (idx === stepIndex) setTransition({ mode: 'forward', nextIndex: stepIndex + 1 });
                  }}
                  disabled={busy}
                >
                  <Text style={styles.optionLabel}>{STATE_NAMES[abbr] ?? abbr}</Text>
                </Pressable>
              ))}
            </View>
          </>
        );
      }
      case 'city': {
        const stateCities = getCitiesForState(answers.state);
        const cityResults = citySearch.trim().length > 0
          ? stateCities.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 12)
          : stateCities.slice(0, 12);
        return (
          <>
            <Text style={styles.question}>Which city?</Text>
            <View style={styles.fieldGroup}>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={citySearch}
                  onChangeText={(q) => {
                    setCitySearch(q);
                    setAnswers((p) => ({ ...p, city: '' }));
                  }}
                  placeholder="Search city…"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
            {answers.city ? (
              <View style={[styles.optionCard, styles.optionCardSelected, { marginBottom: 16 }]}>
                <Text style={styles.optionLabel}>{answers.city}</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginBottom: 16 }}>
                {cityResults.map((c) => (
                  <Pressable
                    key={c}
                    style={styles.optionCard}
                    onPress={() => {
                      setAnswers((p) => ({ ...p, city: c }));
                      setCitySearch(c);
                    }}
                  >
                    <Text style={styles.optionLabel}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              style={[styles.primaryButton, !canProceed && idx === stepIndex && styles.primaryButtonDisabled]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      }
      case 'cohabit':
        return (
          <>
            <Text style={styles.question}>
              Any preferences for who you stay with or host?
            </Text>
            <View style={styles.optionsBlock}>
              {optionCard(
                'Same gender only',
                answers.cohabitPreference === 'same_gender',
                () => pickAndAdvance({ cohabitPreference: 'same_gender' }),
              )}
              {optionCard(
                'No preference',
                answers.cohabitPreference === 'no_preference',
                () => pickAndAdvance({ cohabitPreference: 'no_preference' }),
              )}
              {optionCard(
                'Open to discuss',
                answers.cohabitPreference === 'open',
                () => pickAndAdvance({ cohabitPreference: 'open' }),
              )}
            </View>
          </>
        );
      case 'paying':
        return (
          <>
            <Text style={styles.question}>
              Are you open to paying for a place?
            </Text>
            <View style={styles.optionsBlock}>
              {optionCard(
                'Yes always',
                answers.paying === 'yes_always',
                () => pickAndAdvance({ paying: 'yes_always' }),
              )}
              {optionCard(
                'Depends on the situation',
                answers.paying === 'depends',
                () => pickAndAdvance({ paying: 'depends' }),
              )}
              {optionCard(
                'Prefer free only',
                answers.paying === 'prefer_free',
                () => pickAndAdvance({ paying: 'prefer_free' }),
              )}
            </View>
          </>
        );
      case 'charging':
        return (
          <>
            <Text style={styles.question}>Open to charging guests?</Text>
            <View style={styles.optionsBlock}>
              {optionCard(
                'Yes',
                answers.charging === 'yes',
                () => pickAndAdvance({ charging: 'yes' }),
              )}
              {optionCard(
                `No, I'd host for free`,
                answers.charging === 'free',
                () => pickAndAdvance({ charging: 'free' }),
              )}
              {optionCard(
                'Depends',
                answers.charging === 'depends',
                () => pickAndAdvance({ charging: 'depends' }),
              )}
            </View>
          </>
        );
      case 'availability':
        return (
          <>
            <Text style={styles.question}>
              When are you usually free to host?
            </Text>
            <View style={styles.chipRow}>
              {(
                [
                  'Weekdays',
                  'Weekends',
                  'Mornings',
                  'Evenings',
                ] as const
              ).map((label) => {
                const keyMap = {
                  Weekdays: 'weekdays',
                  Weekends: 'weekends',
                  Mornings: 'mornings',
                  Evenings: 'evenings',
                } as const;
                const key = keyMap[label];
                const on = answers.availability.includes(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleAvailability(key)}
                    disabled={busy}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text
                      style={[styles.chipLabel, on && styles.chipLabelOn]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                !canProceed && idx === stepIndex && styles.primaryButtonDisabled,
              ]}
              onPress={requestForward}
              disabled={busy || !canProceed || idx !== stepIndex}
            >
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
          </>
        );
      case 'complete': {
        const name = answers.firstName.trim() || 'there';
        return (
          <>
            <Text style={styles.completeTitle}>
              {`You're all set, ${name}!`}
            </Text>
            <Text style={styles.completeSubtitle}>
              We&apos;ll use this to match you thoughtfully. You can update
              anything later.
            </Text>
            {signUpError && (
              <Text style={{ color: 'red', marginBottom: 12, textAlign: 'center' }}>{signUpError}</Text>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={finishOnboarding}
              disabled={busy || signingUp}
            >
              <Text style={styles.primaryLabel}>{signingUp ? 'Creating account…' : `Let's go`}</Text>
            </Pressable>
          </>
        );
      }
      default:
        return null;
    }
  };

  const panel = (idx: number) => (
    <View style={{ width: windowWidth, flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderStepBody(idx)}
      </ScrollView>
    </View>
  );

  let slideInner: ReactNode;
  if (transition?.mode === 'forward') {
    slideInner = (
      <>
        {panel(stepIndex)}
        {panel(transition.nextIndex)}
      </>
    );
  } else if (transition?.mode === 'back') {
    slideInner = (
      <>
        {panel(transition.prevIndex)}
        {panel(stepIndex)}
      </>
    );
  } else {
    slideInner = panel(stepIndex);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          {stepIndex > 0 ? (
            <Pressable
              style={styles.backBtn}
              onPress={requestBack}
              disabled={busy}
              hitSlop={12}
              accessibilityLabel="Back"
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.progressOuter}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressRatio * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.slideClip}>
          {transition ? (
            <Animated.View
              style={[
                styles.slideRow,
                { width: windowWidth * 2, transform: [{ translateX }] },
              ]}
            >
              {slideInner}
            </Animated.View>
          ) : (
            <View style={styles.slideRow}>{slideInner}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
