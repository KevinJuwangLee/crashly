import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const CARD_BORDER = '#E8E5E0';
const CARD_BG = '#FFFFFF';
const SAVE_OK_MS = 2000;
const SAVE_ERR = '#9B3B4A';

/** Match trips / demo usage; change if your `profiles.id` is uuid. */
const PROFILE_ROW_ID = 2;

type DbRole = 'guest' | 'host' | 'both';

type PayingUi = 'yes_always' | 'depends' | 'prefer_free';
type ChargingUi = 'yes' | 'free' | 'depends';
type GenderUi = 'same' | 'any' | 'open';

type ProfileNav = StackNavigationProp<RootStackParamList, 'Profile'>;

type ProfileRow = {
  name: string;
  university: string;
  city: string;
  state: string;
  role: string;
  gender_preference: string | null;
  willing_to_pay: boolean | null;
  willing_to_charge: boolean | null;
  availability: string | null;
};

function payingFromDb(b: boolean | null): PayingUi {
  if (b === false) return 'prefer_free';
  return 'yes_always';
}

function payingToDb(p: PayingUi): boolean {
  return p !== 'prefer_free';
}

function chargingFromDb(b: boolean | null): ChargingUi {
  if (b === false) return 'free';
  return 'yes';
}

function chargingToDb(c: ChargingUi): boolean {
  return c !== 'free';
}

function genderFromDb(s: string | null): GenderUi {
  const v = (s ?? '').toLowerCase();
  if (v === 'same') return 'same';
  return 'any';
}

function genderToDb(g: GenderUi): string {
  if (g === 'same') return 'same';
  return 'any';
}

function roleFromDb(r: string | null): DbRole {
  const v = (r ?? '').toLowerCase();
  if (v === 'host') return 'host';
  if (v === 'both') return 'both';
  return 'guest';
}

function roleLabel(r: DbRole): string {
  if (r === 'guest') return 'Looking to stay';
  if (r === 'host') return 'Hosting others';
  return 'Stay & Host';
}

function genderLabel(g: GenderUi): string {
  if (g === 'same') return 'Same gender only';
  if (g === 'open') return 'Open to discuss';
  return 'No preference';
}

function payingLabel(p: PayingUi): string {
  if (p === 'yes_always') return 'Always';
  if (p === 'depends') return 'Depends';
  return 'Free only';
}

function chargingLabel(c: ChargingUi): string {
  if (c === 'yes') return 'Paid';
  if (c === 'free') return 'Free';
  return 'Depends';
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveHint, setSaveHint] = useState<'idle' | 'ok' | 'err'>('idle');
  const saveHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [city, setCity] = useState('');
  const [stateUS, setStateUS] = useState('');
  const [availability, setAvailability] = useState('');
  const [role, setRole] = useState<DbRole>('guest');
  const [gender, setGender] = useState<GenderUi>('any');
  const [paying, setPaying] = useState<PayingUi>('yes_always');
  const [charging, setCharging] = useState<ChargingUi>('yes');

  const snapshotRef = useRef<{
    name: string;
    university: string;
    city: string;
    state: string;
    availability: string;
    role: DbRole;
    gender: GenderUi;
    paying: PayingUi;
    charging: ChargingUi;
  } | null>(null);

  const applyRow = useCallback((row: ProfileRow) => {
    setName(row.name ?? '');
    setUniversity(row.university ?? '');
    setCity(row.city ?? '');
    setStateUS(row.state ?? '');
    setAvailability(row.availability ?? '');
    const r = roleFromDb(row.role);
    setRole(r);
    setGender(genderFromDb(row.gender_preference));
    setPaying(payingFromDb(row.willing_to_pay));
    setCharging(chargingFromDb(row.willing_to_charge));
    snapshotRef.current = {
      name: row.name ?? '',
      university: row.university ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      availability: row.availability ?? '',
      role: r,
      gender: genderFromDb(row.gender_preference),
      paying: payingFromDb(row.willing_to_pay),
      charging: chargingFromDb(row.willing_to_charge),
    };
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', PROFILE_ROW_ID)
      .single();
    if (!error && data) {
      applyRow(data as ProfileRow);
    }
    setLoading(false);
  }, [applyRow]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    return () => {
      if (saveHintTimer.current != null) clearTimeout(saveHintTimer.current);
    };
  }, []);

  const startEdit = useCallback(() => {
    const s = snapshotRef.current;
    if (s) {
      setName(s.name);
      setUniversity(s.university);
      setCity(s.city);
      setStateUS(s.state);
      setAvailability(s.availability);
      setRole(s.role);
      setGender(s.gender);
      setPaying(s.paying);
      setCharging(s.charging);
    }
    setEditing(true);
    setSaveHint('idle');
  }, []);

  const cancelEdit = useCallback(() => {
    const s = snapshotRef.current;
    if (s) {
      setName(s.name);
      setUniversity(s.university);
      setCity(s.city);
      setStateUS(s.state);
      setAvailability(s.availability);
      setRole(s.role);
      setGender(s.gender);
      setPaying(s.paying);
      setCharging(s.charging);
    }
    setEditing(false);
    setSaveHint('idle');
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveHint('idle');
    if (saveHintTimer.current != null) {
      clearTimeout(saveHintTimer.current);
      saveHintTimer.current = null;
    }

    const payload = {
      name: name.trim(),
      university: university.trim(),
      city: city.trim(),
      state: stateUS.trim(),
      availability: availability.trim() || null,
      role,
      gender_preference: genderToDb(gender),
      willing_to_pay: payingToDb(paying),
      willing_to_charge: chargingToDb(charging),
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', PROFILE_ROW_ID);

    setSaving(false);
    if (error) {
      setSaveHint('err');
      return;
    }

    await loadProfile();
    setEditing(false);
    setSaveHint('ok');
    saveHintTimer.current = setTimeout(() => {
      saveHintTimer.current = null;
      setSaveHint('idle');
    }, SAVE_OK_MS);
  }, [
    saving,
    name,
    university,
    city,
    stateUS,
    availability,
    role,
    gender,
    paying,
    charging,
    loadProfile,
  ]);

  const locLine =
    [city.trim(), stateUS.trim()].filter(Boolean).join(', ') || '—';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={MUTED} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Image
                source={require('../assets/handsome-dan.jpg')}
                style={styles.profileAvatarImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.profileName}>{name.trim() || '—'}</Text>
            <Text style={styles.profileUniversity}>
              {university.trim() || '—'}
            </Text>
            <Text style={styles.profileLocation}>{locLine}</Text>
            <View style={styles.profileRatingRow}>
              <Text style={styles.profileRatingStar}>★★★★★</Text>
              <Text style={styles.profileRatingNum}>4.8</Text>
              <Text style={styles.profileRatingCount}>(12 reviews)</Text>
            </View>
          </View>

          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>About</Text>
            {!editing ? (
              <Pressable onPress={startEdit} hitSlop={8}>
                <Text style={styles.profileEditBtn}>Edit</Text>
              </Pressable>
            ) : (
              <Pressable onPress={cancelEdit} hitSlop={8}>
                <Text style={styles.profileEditBtn}>Cancel</Text>
              </Pressable>
            )}
          </View>

          <FieldBlock label="Name" editing={editing}>
            {editing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={MUTED}
              />
            ) : (
              <Text style={styles.fieldValue}>{name.trim() || '—'}</Text>
            )}
          </FieldBlock>

          <FieldBlock label="University" editing={editing}>
            {editing ? (
              <TextInput
                style={styles.input}
                value={university}
                onChangeText={setUniversity}
                placeholder="University"
                placeholderTextColor={MUTED}
              />
            ) : (
              <Text style={styles.fieldValue}>{university.trim() || '—'}</Text>
            )}
          </FieldBlock>

          <FieldBlock label="City" editing={editing}>
            {editing ? (
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={MUTED}
              />
            ) : (
              <Text style={styles.fieldValue}>{city.trim() || '—'}</Text>
            )}
          </FieldBlock>

          <FieldBlock label="State" editing={editing}>
            {editing ? (
              <TextInput
                style={styles.input}
                value={stateUS}
                onChangeText={setStateUS}
                placeholder="e.g. CT"
                placeholderTextColor={MUTED}
                autoCapitalize="characters"
              />
            ) : (
              <Text style={styles.fieldValue}>{stateUS.trim() || '—'}</Text>
            )}
          </FieldBlock>

          <FieldBlock label="Role" editing={editing}>
            {editing ? (
              <View style={styles.chipRow}>
                {(
                  [
                    ['guest', 'Stay'],
                    ['host', 'Host'],
                    ['both', 'Both'],
                  ] as const
                ).map(([val, label]) => (
                  <Pressable
                    key={val}
                    style={[styles.chip, role === val && styles.chipOn]}
                    onPress={() => setRole(val)}
                  >
                    <Text
                      style={[styles.chipText, role === val && styles.chipTextOn]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>{roleLabel(role)}</Text>
            )}
          </FieldBlock>

          <FieldBlock label="Preference" editing={editing}>
            {editing ? (
              <View style={styles.chipRow}>
                {(
                  [
                    ['same', 'Same gender'],
                    ['any', 'No preference'],
                    ['open', 'Open'],
                  ] as const
                ).map(([val, label]) => (
                  <Pressable
                    key={val}
                    style={[styles.chip, gender === val && styles.chipOn]}
                    onPress={() => setGender(val)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        gender === val && styles.chipTextOn,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>{genderLabel(gender)}</Text>
            )}
          </FieldBlock>

          {(role === 'guest' || role === 'both') && (
            <FieldBlock label="Paying" editing={editing}>
              {editing ? (
                <View style={styles.chipRow}>
                  {(
                    [
                      ['yes_always', 'Always'],
                      ['depends', 'Depends'],
                      ['prefer_free', 'Free only'],
                    ] as const
                  ).map(([val, label]) => (
                    <Pressable
                      key={val}
                      style={[styles.chip, paying === val && styles.chipOn]}
                      onPress={() => setPaying(val)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          paying === val && styles.chipTextOn,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.fieldValue}>{payingLabel(paying)}</Text>
              )}
            </FieldBlock>
          )}

          {(role === 'host' || role === 'both') && (
            <FieldBlock label="Hosting fee" editing={editing}>
              {editing ? (
                <View style={styles.chipRow}>
                  {(
                    [
                      ['yes', 'Paid'],
                      ['free', 'Free'],
                      ['depends', 'Depends'],
                    ] as const
                  ).map(([val, label]) => (
                    <Pressable
                      key={val}
                      style={[styles.chip, charging === val && styles.chipOn]}
                      onPress={() => setCharging(val)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          charging === val && styles.chipTextOn,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.fieldValue}>{chargingLabel(charging)}</Text>
              )}
            </FieldBlock>
          )}

          <FieldBlock label="Availability & preferences" editing={editing}>
            {editing ? (
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={availability}
                onChangeText={setAvailability}
                placeholder="e.g. Weekends, evenings, pet-friendly, same gender only..."
                placeholderTextColor={MUTED}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.fieldValueMultiline}>
                {availability.trim() || '—'}
              </Text>
            )}
          </FieldBlock>

          {editing ? (
            <View style={styles.saveRow}>
              <Pressable
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={() => {
                  void handleSave();
                }}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          ) : null}

          {saveHint === 'ok' ? (
            <Text style={styles.feedbackOk}>Saved!</Text>
          ) : null}
          {saveHint === 'err' ? (
            <Text style={styles.feedbackErr}>Could not save</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FieldBlock({
  label,
  editing,
  children,
}: {
  label: string;
  editing: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.fieldBlock, editing && styles.fieldBlockEdit]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: CHARCOAL,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: MUTED,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CHARCOAL,
    overflow: 'hidden',
    marginBottom: 12,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: CHARCOAL,
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileUniversity: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 2,
  },
  profileLocation: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
  profileRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  profileRatingStar: {
    fontSize: 13,
    color: '#F5A623',
  },
  profileRatingNum: {
    fontSize: 13,
    fontWeight: '700',
    color: CHARCOAL,
  },
  profileRatingCount: {
    fontSize: 12,
    color: MUTED,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  profileSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  profileEditBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: CHARCOAL,
  },
  fieldBlock: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  fieldBlockEdit: {
    paddingBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
    color: CHARCOAL,
    lineHeight: 22,
  },
  fieldValueMultiline: {
    fontSize: 15,
    fontWeight: '500',
    color: CHARCOAL,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: CHARCOAL,
    backgroundColor: CARD_BG,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
  },
  chipOn: {
    backgroundColor: CHARCOAL,
    borderColor: CHARCOAL,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: CHARCOAL,
  },
  chipTextOn: {
    color: IVORY,
  },
  saveRow: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  saveBtn: {
    backgroundColor: CHARCOAL,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: IVORY,
  },
  feedbackOk: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    marginTop: 12,
  },
  feedbackErr: {
    fontSize: 13,
    color: SAVE_ERR,
    textAlign: 'center',
    marginTop: 12,
  },
});
