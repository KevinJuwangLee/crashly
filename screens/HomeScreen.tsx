import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import universitiesJson from '../assets/universities.json';

type HomeNav = StackNavigationProp<RootStackParamList, 'Home'>;

type UniversityRow = {
  name: string;
  city: string;
  state: string;
};

const UNIVERSITIES: readonly UniversityRow[] = universitiesJson as UniversityRow[];

/** Shown when `Home` has no onboarding params (matches handsome-dan + seed demo user). */
const DEFAULT_PROFILE_FULL_NAME = 'Elihu Yale';
const DEFAULT_PROFILE_UNIVERSITY = 'Yale University';
const DEFAULT_PROFILE_LOCATION = 'New Haven, CT';

export type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

const NYC_CENTER = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

async function reverseGeocode(
  latitude: number,
  longitude: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal });
  const data = (await res.json()) as {
    results?: { formatted_address: string }[];
    status: string;
  };
  if (data.status !== 'OK' || !data.results?.[0]?.formatted_address) {
    return null;
  }
  return data.results[0].formatted_address;
}

function getGoogleMapsApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { googlePlacesApiKey?: string }
    | undefined;
  if (extra?.googlePlacesApiKey) return extra.googlePlacesApiKey;
  if (typeof process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY === 'string') {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  }
  return undefined;
}

function getGooglePlacesApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { googlePlacesApiKey?: string }
    | undefined;
  return extra?.googlePlacesApiKey;
}

type CityPlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
};

function cityPredictionLines(p: CityPlacePrediction): {
  main: string;
  sub: string;
} {
  const sf = p.structured_formatting;
  if (sf?.main_text) {
    return {
      main: sf.main_text,
      sub: (sf.secondary_text ?? '').trim(),
    };
  }
  const parts = p.description.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    main: parts[0] ?? p.description,
    sub: parts.slice(1).join(', '),
  };
}

/** US state code at start of secondary text, e.g. "TX, USA". */
function parseUsStatePrefix(secondary: string): string {
  const m = secondary.trim().match(/^([A-Z]{2})\b/);
  return m ? m[1]! : '';
}

async function fetchCityPlacePredictions(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<CityPlacePrediction[]> {
  const q = input.trim();
  if (!q) return [];
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
    `input=${encodeURIComponent(q)}&types=(cities)&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal });
  const data = (await res.json()) as {
    predictions?: CityPlacePrediction[];
    status: string;
  };
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return [];
  }
  return (data.predictions ?? []).slice(0, 4);
}

/** Best-effort parse from Google formatted_address into city + state. */
function parseCityStateFromFormattedAddress(address: string): {
  city: string;
  state: string;
} {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { city: '', state: '' };
  if (parts.length === 1) return { city: parts[0]!, state: '' };
  if (parts.length === 2) {
    const st = parts[1]!.match(/^([A-Za-z]{2})(\b|\s|\d)/);
    return {
      city: parts[0]!,
      state: st ? st[1]!.toUpperCase() : parts[1]!.slice(0, 2).toUpperCase(),
    };
  }
  const stateZip = parts[parts.length - 2]!;
  const st = stateZip.match(/^([A-Za-z]{2})(\s|$|\d)/);
  const state = st ? st[1]!.toUpperCase() : '';
  const city = parts[parts.length - 3] ?? parts[0]!;
  return { city, state };
}

function calendarCellsForMonth(year: number, monthIndex: number): (number | null)[] {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const nDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells.push(null);
  return cells;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function compareCalendarDay(a: Date, b: Date): number {
  const t1 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const t2 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return t1 - t2;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Top AI dome visible height — ~35–40% of screen (first thing users see). */
const COLLAPSED_HEIGHT_RATIO = 0.375;
const DOME_SIZE = 1000;
const DOME_RADIUS = DOME_SIZE / 2;

type Theme = {
  pageBg: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  inputBg: string;
  inputBorder: string;
  inputInner: string;
  placeholder: string;
  primaryBg: string;
  primaryText: string;
  cardBg: string;
  cardBorder: string;
  pillBg: string;
  pillText: string;
  secondaryBtnBorder: string;
  declineText: string;
  modalOverlay: string;
  modalBg: string;
  modalItemBorder: string;
  domeBase: string;
  domeLayer1: string;
  domeLayer2: string;
  domeLayer1Opacity: number;
  domeLayer2Opacity: number;
  searchBarBg: string;
};

const light: Theme = {
  pageBg: '#FAF9F6',
  text: '#2C2C2A',
  textMuted: '#6B6965',
  textSubtle: '#8A8783',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E2DC',
  inputInner: '#F0EDE8',
  placeholder: '#A9A6A0',
  primaryBg: '#2C2C2A',
  primaryText: '#FAF9F6',
  cardBg: '#FFFFFF',
  cardBorder: '#E8E5DF',
  pillBg: '#EDE9E3',
  pillText: '#4A4844',
  secondaryBtnBorder: '#2C2C2A',
  declineText: '#6B6965',
  modalOverlay: 'rgba(44, 44, 42, 0.35)',
  modalBg: '#FAF9F6',
  modalItemBorder: '#E5E2DC',
  domeBase: '#E6DFD6',
  domeLayer1: '#EFE8E1',
  domeLayer2: '#F5EDE5',
  domeLayer1Opacity: 0.72,
  domeLayer2Opacity: 0.45,
  searchBarBg: '#F0EDE8',
};

const dark: Theme = {
  pageBg: '#1C1C1A',
  text: '#F0EFEB',
  textMuted: '#B5B3AD',
  textSubtle: '#8E8C86',
  inputBg: '#252523',
  inputBorder: '#3A3A37',
  inputInner: '#2E2E2B',
  placeholder: '#6E6C68',
  primaryBg: '#FAF9F6',
  primaryText: '#2C2C2A',
  cardBg: '#252523',
  cardBorder: '#3A3A37',
  pillBg: '#32322F',
  pillText: '#D8D6D0',
  secondaryBtnBorder: '#FAF9F6',
  declineText: '#9C9893',
  modalOverlay: 'rgba(0, 0, 0, 0.55)',
  modalBg: '#252523',
  modalItemBorder: '#3A3A37',
  domeBase: '#2C2825',
  domeLayer1: '#38332F',
  domeLayer2: '#3D3834',
  domeLayer1Opacity: 0.65,
  domeLayer2Opacity: 0.4,
  searchBarBg: '#2E2E2B',
};

function createStyles(t: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 48,
    },
    scrollPadded: {
      paddingHorizontal: 24,
    },
    domeScrollSection: {
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.3,
      color: t.text,
    },
    addBtn: {
      fontSize: 15,
      fontWeight: '600',
      color: t.textMuted,
    },
    tripCard: {
      backgroundColor: t.cardBg,
      borderWidth: 1,
      borderColor: t.cardBorder,
      borderRadius: 14,
      padding: 18,
      marginBottom: 12,
    },
    tripDest: {
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    tripDates: {
      fontSize: 14,
      color: t.textMuted,
      marginBottom: 12,
    },
    tripsEmpty: {
      fontSize: 15,
      color: t.textMuted,
      marginTop: 4,
      marginBottom: 8,
    },
    tripsLoading: {
      fontSize: 14,
      color: t.textMuted,
      marginTop: 4,
      marginBottom: 12,
    },
    tripStatusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    tripStatusPillText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    pill: {
      alignSelf: 'flex-start',
      backgroundColor: t.pillBg,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: t.pillText,
      letterSpacing: 0.2,
    },
    pastTripHost: {
      fontSize: 14,
      fontWeight: '500',
      color: t.text,
      marginTop: 6,
      marginBottom: 14,
      letterSpacing: -0.1,
    },
    pastTripFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    completedPill: {
      alignSelf: 'flex-start',
      backgroundColor: t.inputBorder,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 20,
    },
    completedPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: t.textMuted,
      letterSpacing: 0.2,
    },
    rateHostBtn: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.text,
      backgroundColor: 'transparent',
    },
    rateHostBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: t.text,
      letterSpacing: 0.1,
    },
    rateSheetRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    rateSheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.modalOverlay,
    },
    rateSheetPanel: {
      backgroundColor: t.modalBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: t.cardBorder,
      maxHeight: '88%',
      paddingTop: 8,
    },
    rateSheetSafe: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    rateSheetScrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      paddingTop: 12,
    },
    rateSheetTitle: {
      fontSize: 18,
      fontWeight: '500',
      color: t.text,
      marginBottom: 8,
      letterSpacing: -0.2,
    },
    rateSheetHostLine: {
      fontSize: 14,
      color: t.textMuted,
      marginBottom: 18,
      lineHeight: 20,
    },
    rateStarsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 6,
      marginBottom: 18,
    },
    rateStarHit: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    rateStarGlyph: {
      fontSize: 34,
      lineHeight: 40,
    },
    rateReviewInput: {
      minHeight: 96,
      maxHeight: 160,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.cardBorder,
      backgroundColor: t.inputBg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: t.text,
      lineHeight: 22,
    },
    rateSubmitBtn: {
      marginTop: 18,
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: t.primaryBg,
      alignItems: 'center',
    },
    rateSubmitBtnDisabled: {
      opacity: 0.45,
    },
    rateSubmitBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: t.primaryText,
    },
    rateCancelBtn: {
      marginTop: 14,
      paddingVertical: 10,
      alignItems: 'center',
    },
    rateCancelText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.textMuted,
    },
    rateSuccessText: {
      marginTop: 14,
      fontSize: 13,
      fontWeight: '500',
      color: '#4A7D5C',
      textAlign: 'center',
    },
    reqCard: {
      backgroundColor: t.cardBg,
      borderWidth: 1,
      borderColor: t.cardBorder,
      borderRadius: 14,
      padding: 18,
      marginBottom: 12,
    },
    reqName: {
      fontSize: 16,
      fontWeight: '600',
      color: t.text,
      marginBottom: 4,
    },
    reqSchool: {
      fontSize: 14,
      color: t.textMuted,
      marginBottom: 14,
    },
    reqRow: {
      flexDirection: 'row',
      gap: 10,
    },
    acceptBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.secondaryBtnBorder,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    acceptLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
    },
    declineBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: t.pillBg,
    },
    declineLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: t.declineText,
    },
    expandOverlayHost: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      overflow: 'hidden',
      zIndex: 30,
      backgroundColor: 'transparent',
    },
    domeCircleWrap: {
      width: DOME_SIZE,
      height: DOME_SIZE,
      borderRadius: DOME_RADIUS,
      alignSelf: 'center',
      overflow: 'hidden',
    },
    domeBaseFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.domeBase,
    },
    domeGlowOuter: {
      position: 'absolute',
      width: DOME_SIZE * 0.62,
      height: DOME_SIZE * 0.62,
      borderRadius: (DOME_SIZE * 0.62) / 2,
      backgroundColor: t.domeLayer1,
      opacity: t.domeLayer1Opacity * 0.55,
      bottom: DOME_SIZE * 0.1,
      left: DOME_SIZE * 0.19,
    },
    domeGlowInner: {
      position: 'absolute',
      width: DOME_SIZE * 0.4,
      height: DOME_SIZE * 0.4,
      borderRadius: (DOME_SIZE * 0.4) / 2,
      backgroundColor: t.domeLayer2,
      opacity: t.domeLayer2Opacity * 0.65,
      top: DOME_SIZE * 0.32,
      left: DOME_SIZE * 0.3,
    },
    collapsedOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      paddingHorizontal: 28,
    },
    collapsedOverlayInner: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    heroHi: {
      fontSize: 16,
      fontWeight: '500',
      color: t.textMuted,
      letterSpacing: -0.1,
      marginBottom: 4,
    },
    heroGreeting: {
      fontSize: 38,
      fontWeight: '500',
      lineHeight: 46,
      letterSpacing: -0.8,
      color: t.text,
      marginBottom: 12,
    },
    heroSubtitle: {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '400',
      color: t.textMuted,
      marginBottom: 22,
      letterSpacing: -0.2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: 400,
      backgroundColor: t.searchBarBg,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.inputBorder,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 10,
      color: t.textMuted,
    },
    searchPlaceholder: {
      flex: 1,
      fontSize: 16,
      color: t.placeholder,
    },
    expandedRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 6,
      backgroundColor: t.domeBase,
    },
    expandedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      marginLeft: -10,
    },
    backGlyph: {
      fontSize: 30,
      fontWeight: '300',
      color: t.text,
    },
    planTitle: {
      fontSize: 28,
      fontWeight: '500',
      letterSpacing: -0.5,
      color: t.text,
      marginTop: 4,
      marginBottom: 24,
    },
    fieldLabel: {
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
    },
    inputMulti: {
      minHeight: 100,
      paddingTop: 14,
      textAlignVertical: 'top',
    },
    mapBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.inputBg,
    },
    mapBtnLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: t.textMuted,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    dateCell: {
      flex: 1,
      backgroundColor: t.inputBg,
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    dateCellLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: t.textSubtle,
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    dateCellValue: {
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
    },
    findBtn: {
      marginTop: 28,
      marginBottom: 16,
      backgroundColor: t.primaryBg,
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
    },
    findBtnLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: t.primaryText,
      letterSpacing: -0.2,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.modalOverlay,
    },
    modalSheet: {
      backgroundColor: t.modalBg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: '72%',
      paddingBottom: 28,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    modalItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.modalItemBorder,
    },
    modalItemText: {
      fontSize: 16,
      color: t.text,
    },
    cityStateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    cityField: {
      flex: 2,
      minWidth: 0,
    },
    cityAutocompleteWrap: {
      zIndex: 2,
    },
    universityAutocompleteWrap: {
      zIndex: 3,
      marginBottom: 6,
    },
    cityInputShellRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 12,
    },
    cityInputFlex: {
      flex: 1,
      minWidth: 0,
    },
    cityDropdown: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.inputBorder,
      backgroundColor: t.pageBg,
      overflow: 'hidden',
    },
    cityDropdownRow: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    cityDropdownRowPressed: {
      backgroundColor: t.inputInner,
    },
    cityDropdownMain: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.2,
      color: t.text,
    },
    cityDropdownSub: {
      fontSize: 13,
      marginTop: 3,
      color: t.textMuted,
      letterSpacing: -0.1,
    },
    cityDropdownSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.inputBorder,
      marginLeft: 14,
    },
    stateField: {
      flex: 1,
      minWidth: 88,
      maxWidth: 120,
    },
    calSheet: {
      backgroundColor: t.modalBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 28,
      maxHeight: '78%',
    },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 12,
    },
    calTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: t.text,
      letterSpacing: -0.3,
    },
    calNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calNavGlyph: {
      fontSize: 20,
      fontWeight: '500',
      color: t.text,
      marginTop: -2,
    },
    calWeekRow: {
      flexDirection: 'row',
      paddingHorizontal: 6,
      marginBottom: 6,
    },
    calWeekCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
    },
    calWeekLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: t.textSubtle,
      letterSpacing: 0.3,
    },
    calWeek: {
      flexDirection: 'row',
      paddingHorizontal: 6,
      marginBottom: 4,
    },
    calDayTouch: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
    },
    calDayInner: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayInnerMuted: {
      opacity: 0,
    },
    calDayInnerInRange: {
      backgroundColor: t.pillBg,
    },
    calDayInnerSelected: {
      backgroundColor: t.primaryBg,
    },
    calDayLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
    },
    calDayLabelSelected: {
      color: t.primaryText,
      fontWeight: '600',
    },
    calDayLabelInRange: {
      color: t.text,
    },
    calHint: {
      fontSize: 13,
      color: t.textMuted,
      paddingHorizontal: 20,
      paddingBottom: 12,
      textAlign: 'center',
    },
    mapModalRoot: {
      flex: 1,
      backgroundColor: '#0d0d0c',
    },
    mapViewFill: {
      ...StyleSheet.absoluteFillObject,
    },
    mapTopBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 4,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    mapCloseBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(250,249,246,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapCloseGlyph: {
      fontSize: 22,
      fontWeight: '300',
      color: '#2C2C2A',
      marginTop: -2,
    },
    mapPinLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
      zIndex: 2,
    },
    mapPinOffset: {
      marginTop: -36,
    },
    mapPinGlyph: {
      fontSize: 44,
    },
    mapBottomArea: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 4,
      paddingHorizontal: 20,
    },
    mapAddressCard: {
      backgroundColor: t.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.cardBorder,
      padding: 18,
      marginBottom: 12,
    },
    mapAddressLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: t.textSubtle,
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    mapAddressText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '500',
      color: t.text,
    },
    mapGeocodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 24,
    },
    mapConfirmBtn: {
      backgroundColor: t.primaryBg,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 4,
    },
    mapConfirmLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: t.primaryText,
    },
    mapConfirmDisabled: {
      opacity: 0.45,
    },
    mapWebFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    mapWebFallbackText: {
      fontSize: 16,
      color: t.textMuted,
      textAlign: 'center',
    },
    inboxBtn: {
      position: 'absolute',
      right: 68,
      zIndex: 100,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    inboxLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
      letterSpacing: -0.2,
    },
    hamburgerBtn: {
      position: 'absolute',
      right: 20,
      zIndex: 100,
      padding: 8,
      gap: 5,
    },
    hamburgerLine: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: t.text,
    },
    menuOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    menuPanel: {
      width: '55%',
      height: '100%',
      backgroundColor: t.pageBg,
      borderLeftWidth: 1,
      borderLeftColor: t.cardBorder,
    },
    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    menuItemText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
    },
    menuItemActive: {
      fontWeight: '700',
      color: t.text,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.cardBorder,
    },
    menuItemSignOut: {
      color: '#E05252',
    },
    menuProfileRow: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 20,
      gap: 8,
    },
    menuProfileAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.primaryBg,
      overflow: 'hidden',
    },
    menuProfileAvatarImage: {
      width: '100%',
      height: '100%',
    },
    menuProfileName: {
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    menuProfileSub: {
      fontSize: 12,
      color: t.textMuted,
      marginTop: 1,
      textAlign: 'center',
    },
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TRIPS_USER_ID = 2;

const TRIP_STATUS_PILL = {
  searching: { bg: '#F4E4BC', fg: '#5C4A1A', label: 'Searching' as const },
  confirmed: { bg: '#D4EDDA', fg: '#1E5B3A', label: 'Confirmed' as const },
  completed: { bg: '#E5E2DC', fg: '#6B6965', label: 'Completed' as const },
} as const;

type TripRow = {
  id: string;
  user_id?: number;
  destination_city?: string | null;
  destination_state?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  status?: string | null;
  created_at?: string;
};

function tripStatusMeta(status: string | null | undefined) {
  const s = (status ?? '').toLowerCase().trim();
  if (s === 'confirmed') return TRIP_STATUS_PILL.confirmed;
  if (s === 'completed') return TRIP_STATUS_PILL.completed;
  return TRIP_STATUS_PILL.searching;
}

function formatTripDestination(city: string | null | undefined, state: string | null | undefined) {
  const c = (city ?? '').trim();
  const st = (state ?? '').trim();
  if (c && st) return `${c}, ${st}`;
  return c || st || 'Trip';
}

const MOCK_PAST_TRIP = {
  destination: 'Boston, MA',
  dates: 'Mar 10 - Mar 13, 2026',
  hostLine: 'Samuel Okonkwo · MIT',
  hostProfileName: 'Samuel Okonkwo',
  hostUniversity: 'MIT',
} as const;

const RATE_STAR_GOLD = '#F4A623';
const RATE_STAR_EMPTY = '#D4D1CB';

type ConnectionEntry = { id: string; name: string; university: string };

const INITIAL_REQUESTS: ConnectionEntry[] = [
  { id: '1', name: 'Jordan Lee', university: 'UT Austin' },
  { id: '2', name: 'Sam Rivera', university: 'CU Boulder' },
];

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? dark : light;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onboarding = route.params?.onboarding;

  const profileFullName = useMemo(
    () =>
      [onboarding?.firstName, onboarding?.lastName]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(' ')
        .trim() || DEFAULT_PROFILE_FULL_NAME,
    [onboarding?.firstName, onboarding?.lastName],
  );
  const profileUniversity =
    onboarding?.university?.trim() || DEFAULT_PROFILE_UNIVERSITY;
  const profileLocation =
    onboarding?.city?.trim() || DEFAULT_PROFILE_LOCATION;

  const displayName =
    onboarding?.firstName?.trim() ||
    profileFullName.split(/\s+/).filter(Boolean)[0] ||
    'there';

  const collapsedClip = useMemo(
    () => Math.round(screenHeight * COLLAPSED_HEIGHT_RATIO),
    [screenHeight],
  );
  const domeTop = useMemo(
    () => Math.round(collapsedClip - DOME_SIZE + 38),
    [collapsedClip],
  );

  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'home' | 'connections'>('home');
  const [requests, setRequests] = useState<ConnectionEntry[]>(INITIAL_REQUESTS);
  const [connections, setConnections] = useState<ConnectionEntry[]>([]);

  const rateSheetAnim = useRef(new Animated.Value(520)).current;
  const [rateSheetVisible, setRateSheetVisible] = useState(false);
  const [rateStars, setRateStars] = useState(0);
  const [rateReviewText, setRateReviewText] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateSuccess, setRateSuccess] = useState(false);
  const [pastTripHostRated, setPastTripHostRated] = useState(false);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const run = async () => {
        setTripsLoading(true);
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', TRIPS_USER_ID)
          .order('created_at', { ascending: false });

        console.log('Fetched trips:', JSON.stringify(data));
        if (error) {
          console.log('Trips fetch error:', JSON.stringify(error));
        }

        if (!cancelled) {
          setTrips((data as TripRow[] | null) ?? []);
          setTripsLoading(false);
        }
      };

      void run();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const acceptRequest = useCallback((id: string) => {
    setRequests((prev) => {
      const req = prev.find((r) => r.id === id);
      if (req) setConnections((c) => [...c, req]);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const declineRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);
  const menuSlide = useRef(new Animated.Value(screenWidth)).current;

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    Animated.timing(menuSlide, {
      toValue: 0,
      duration: 280,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: true,
    }).start();
  }, [menuSlide, screenWidth]);

  const closeMenu = useCallback(() => {
    Animated.timing(menuSlide, {
      toValue: screenWidth,
      duration: 240,
      easing: Easing.bezier(0.55, 0.06, 0.68, 0.19),
      useNativeDriver: true,
    }).start(() => setMenuOpen(false));
  }, [menuSlide, screenWidth]);

  const closeRateSheetAnimated = useCallback(() => {
    Animated.timing(rateSheetAnim, {
      toValue: 520,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setRateSheetVisible(false);
      setRateSuccess(false);
      setRateStars(0);
      setRateReviewText('');
    });
  }, [rateSheetAnim]);

  const openRateSheet = useCallback(() => {
    setRateSuccess(false);
    setRateStars(0);
    setRateReviewText('');
    setRateSheetVisible(true);
  }, []);

  const closeRateSheet = useCallback(() => {
    if (rateSubmitting) return;
    closeRateSheetAnimated();
  }, [rateSubmitting, closeRateSheetAnimated]);

  useEffect(() => {
    if (!rateSheetVisible) return;
    rateSheetAnim.setValue(520);
    Animated.spring(rateSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [rateSheetVisible, rateSheetAnim]);

  const submitHostReview = useCallback(async () => {
    if (rateStars < 1 || rateSubmitting) return;
    setRateSubmitting(true);
    const { error } = await supabase
      .from('profiles')
      .update({ rating: rateStars })
      .eq('name', MOCK_PAST_TRIP.hostProfileName);
    setRateSubmitting(false);
    if (error) {
      Alert.alert('Could not submit review', error.message);
      return;
    }
    setPastTripHostRated(true);
    setRateSuccess(true);
    setTimeout(() => {
      closeRateSheetAnimated();
    }, 2000);
  }, [rateStars, rateSubmitting, closeRateSheetAnimated]);

  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [preferences, setPreferences] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4);
    return d;
  });
  const [datePicker, setDatePicker] = useState<null | 'from' | 'to'>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [mapCenter, setMapCenter] = useState({
    lat: NYC_CENTER.latitude,
    lng: NYC_CENTER.longitude,
  });
  const [mapAddressPreview, setMapAddressPreview] = useState('');
  const [mapGeocodeLoading, setMapGeocodeLoading] = useState(false);

  const mapsApiKey = useMemo(() => getGoogleMapsApiKey(), []);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const placesAutocompleteKey = useMemo(() => getGooglePlacesApiKey(), []);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityAbortRef = useRef<AbortController | null>(null);
  const cityBlurHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CityPlacePrediction[]>(
    [],
  );
  const [cityAutocompleteLoading, setCityAutocompleteLoading] =
    useState(false);
  const [cityDropdownVisible, setCityDropdownVisible] = useState(false);

  const [universitySearch, setUniversitySearch] = useState('');
  const [universityDropdownVisible, setUniversityDropdownVisible] =
    useState(false);
  const universityFocusedRef = useRef(false);
  const universityBlurHideRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const universitySuggestions = useMemo(() => {
    const q = universitySearch.trim().toLowerCase();
    if (!q) return [];
    const out: UniversityRow[] = [];
    for (const u of UNIVERSITIES) {
      if (u.name.toLowerCase().includes(q)) {
        out.push(u);
        if (out.length >= 5) break;
      }
    }
    return out;
  }, [universitySearch]);

  const layoutProgress = useRef(new Animated.Value(0)).current;
  const visualProgress = useRef(new Animated.Value(0)).current;

  const maxScale = useMemo(
    () =>
      Math.max(
        (1.42 * Math.hypot(screenWidth, screenHeight)) / DOME_RADIUS,
        (1.22 * Math.max(screenWidth, screenHeight)) / DOME_RADIUS,
      ),
    [screenWidth, screenHeight],
  );

  const clipHeight = layoutProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedClip, screenHeight],
  });

  const circleScale = visualProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, maxScale],
  });

  const circleTranslateY = visualProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight * 0.32],
  });

  const collapsedOpacity = visualProgress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [1, 0, 0],
  });

  const expandedOpacity = visualProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });

  const runExpand = useCallback(() => {
    setExpanded(true);
    layoutProgress.setValue(0);
    visualProgress.setValue(0);
    Animated.parallel([
      Animated.timing(layoutProgress, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(visualProgress, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [layoutProgress, visualProgress]);

  const runCollapse = useCallback(() => {
    Animated.parallel([
      Animated.timing(layoutProgress, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(visualProgress, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setExpanded(false);
    });
  }, [layoutProgress, visualProgress]);

  const openDatePicker = (which: 'from' | 'to') => {
    setDatePicker(which);
    const ref = which === 'from' ? fromDate : toDate;
    setCalendarMonth(new Date(ref.getFullYear(), ref.getMonth(), 1));
  };
  const closeDatePicker = useCallback(() => setDatePicker(null), []);

  const selectCalendarDay = useCallback(
    (day: number) => {
      if (!datePicker || day < 1) return;
      const y = calendarMonth.getFullYear();
      const m = calendarMonth.getMonth();
      const next = new Date(y, m, day);
      next.setHours(0, 0, 0, 0);
      if (datePicker === 'from') {
        setFromDate(next);
        if (compareCalendarDay(toDate, next) < 0) {
          setToDate(new Date(next));
        }
      } else {
        if (compareCalendarDay(next, fromDate) < 0) {
          setFromDate(next);
          setToDate(fromDate);
        } else {
          setToDate(next);
        }
      }
      closeDatePicker();
    },
    [datePicker, calendarMonth, fromDate, toDate, closeDatePicker],
  );

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }, []);

  const onFindStay = useCallback(() => {
    const city = destinationCity.trim();
    const state = destinationState.trim();
    if (!city || !state) {
      Alert.alert(
        'Missing destination',
        'Please enter a city and state before searching.',
      );
      return;
    }
    navigation.navigate('SearchAnimation', {
      user_id: 2,
      destination_city: city,
      destination_state: state,
      university: universitySearch.trim(),
      date_from: toISODateLocal(fromDate),
      date_to: toISODateLocal(toDate),
      preferences: preferences.trim(),
    });
  }, [
    destinationCity,
    destinationState,
    universitySearch,
    fromDate,
    toDate,
    preferences,
    navigation,
  ]);

  const closeMapModal = useCallback(() => {
    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;
    setMapModalVisible(false);
  }, []);

  const onMapRegionChangeComplete = useCallback(
    (region: Region) => {
      const lat = region.latitude;
      const lng = region.longitude;
      setMapCenter({ lat, lng });

      geocodeAbortRef.current?.abort();
      const ac = new AbortController();
      geocodeAbortRef.current = ac;

      if (!mapsApiKey) {
        setMapAddressPreview(
          'Add your Google Maps API key to app.json (extra.googlePlacesApiKey).',
        );
        setMapGeocodeLoading(false);
        return;
      }

      setMapGeocodeLoading(true);
      reverseGeocode(lat, lng, mapsApiKey, ac.signal)
        .then((addr) => {
          if (!ac.signal.aborted) {
            setMapAddressPreview(addr ?? 'Could not resolve address');
          }
        })
        .catch(() => {
          if (!ac.signal.aborted) {
            setMapAddressPreview('Could not resolve address');
          }
        })
        .finally(() => {
          if (!ac.signal.aborted) {
            setMapGeocodeLoading(false);
          }
        });
    },
    [mapsApiKey],
  );

  const confirmMapLocation = useCallback(() => {
    if (mapGeocodeLoading || !mapAddressPreview.trim()) return;
    if (
      mapAddressPreview.startsWith('Add your Google') ||
      mapAddressPreview === 'Could not resolve address'
    ) {
      return;
    }
    const payload: SelectedLocation = {
      address: mapAddressPreview,
      latitude: mapCenter.lat,
      longitude: mapCenter.lng,
    };
    setSelectedLocation(payload);
    const { city, state } = parseCityStateFromFormattedAddress(mapAddressPreview);
    if (city) setDestinationCity(city);
    else setDestinationCity(mapAddressPreview.split(',')[0]?.trim() ?? '');
    setDestinationState(state);
    closeMapModal();
  }, [
    mapAddressPreview,
    mapCenter.lat,
    mapCenter.lng,
    mapGeocodeLoading,
    closeMapModal,
  ]);

  useEffect(() => {
    if (!mapModalVisible) return;
    setMapCenter({
      lat: NYC_CENTER.latitude,
      lng: NYC_CENTER.longitude,
    });
    setMapAddressPreview('');
    setMapGeocodeLoading(true);
    if (!mapsApiKey) {
      setMapAddressPreview(
        'Add your Google Maps API key to app.json (extra.googlePlacesApiKey).',
      );
      setMapGeocodeLoading(false);
      return;
    }
    const ac = new AbortController();
    geocodeAbortRef.current = ac;
    reverseGeocode(
      NYC_CENTER.latitude,
      NYC_CENTER.longitude,
      mapsApiKey,
      ac.signal,
    )
      .then((addr) => {
        if (!ac.signal.aborted) {
          setMapAddressPreview(addr ?? 'Could not resolve address');
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setMapAddressPreview('Could not resolve address');
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setMapGeocodeLoading(false);
        }
      });
    return () => {
      ac.abort();
    };
  }, [mapModalVisible, mapsApiKey]);

  useEffect(() => {
    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
      if (cityBlurHideRef.current) clearTimeout(cityBlurHideRef.current);
      if (universityBlurHideRef.current) {
        clearTimeout(universityBlurHideRef.current);
      }
      cityAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!universityFocusedRef.current) return;
    const q = universitySearch.trim();
    if (!q) {
      setUniversityDropdownVisible(false);
      return;
    }
    setUniversityDropdownVisible(universitySuggestions.length > 0);
  }, [universitySearch, universitySuggestions]);

  const onCityChangeText = useCallback(
    (text: string) => {
      setDestinationCity(text);
      if (cityBlurHideRef.current) {
        clearTimeout(cityBlurHideRef.current);
        cityBlurHideRef.current = null;
      }
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
      cityAbortRef.current?.abort();

      if (!text.trim()) {
        setCitySuggestions([]);
        setCityAutocompleteLoading(false);
        setCityDropdownVisible(false);
        return;
      }

      if (!placesAutocompleteKey) {
        setCitySuggestions([]);
        setCityDropdownVisible(false);
        return;
      }

      cityDebounceRef.current = setTimeout(() => {
        const ac = new AbortController();
        cityAbortRef.current = ac;
        setCityAutocompleteLoading(true);
        void (async () => {
          try {
            const preds = await fetchCityPlacePredictions(
              text,
              placesAutocompleteKey,
              ac.signal,
            );
            if (ac.signal.aborted) return;
            setCitySuggestions(preds);
            setCityDropdownVisible(preds.length > 0);
          } catch {
            if (!ac.signal.aborted) {
              setCitySuggestions([]);
              setCityDropdownVisible(false);
            }
          } finally {
            if (!ac.signal.aborted) setCityAutocompleteLoading(false);
          }
        })();
      }, 280);
    },
    [placesAutocompleteKey],
  );

  const onSelectCityPrediction = useCallback((p: CityPlacePrediction) => {
    if (cityBlurHideRef.current) {
      clearTimeout(cityBlurHideRef.current);
      cityBlurHideRef.current = null;
    }
    if (cityDebounceRef.current) {
      clearTimeout(cityDebounceRef.current);
      cityDebounceRef.current = null;
    }
    cityAbortRef.current?.abort();
    const { main, sub } = cityPredictionLines(p);
    setDestinationCity(main);
    const us = parseUsStatePrefix(sub);
    if (us) setDestinationState(us);
    setCitySuggestions([]);
    setCityDropdownVisible(false);
    setCityAutocompleteLoading(false);
  }, []);

  const onCityInputFocus = useCallback(() => {
    if (cityBlurHideRef.current) {
      clearTimeout(cityBlurHideRef.current);
      cityBlurHideRef.current = null;
    }
    if (citySuggestions.length > 0) setCityDropdownVisible(true);
  }, [citySuggestions.length]);

  const onCityInputBlur = useCallback(() => {
    cityBlurHideRef.current = setTimeout(() => {
      setCityDropdownVisible(false);
      cityBlurHideRef.current = null;
    }, 280);
  }, []);

  const onUniversityChangeText = useCallback((text: string) => {
    setUniversitySearch(text);
    if (universityBlurHideRef.current) {
      clearTimeout(universityBlurHideRef.current);
      universityBlurHideRef.current = null;
    }
  }, []);

  const onUniversityInputFocus = useCallback(() => {
    if (universityBlurHideRef.current) {
      clearTimeout(universityBlurHideRef.current);
      universityBlurHideRef.current = null;
    }
    universityFocusedRef.current = true;
    const q = universitySearch.trim();
    if (q && universitySuggestions.length > 0) {
      setUniversityDropdownVisible(true);
    }
  }, [universitySearch, universitySuggestions]);

  const onUniversityInputBlur = useCallback(() => {
    universityFocusedRef.current = false;
    universityBlurHideRef.current = setTimeout(() => {
      setUniversityDropdownVisible(false);
      universityBlurHideRef.current = null;
    }, 280);
  }, []);

  const onSelectUniversity = useCallback((u: UniversityRow) => {
    if (universityBlurHideRef.current) {
      clearTimeout(universityBlurHideRef.current);
      universityBlurHideRef.current = null;
    }
    universityFocusedRef.current = false;
    setUniversitySearch(u.name);
    setDestinationCity(u.city);
    setDestinationState(u.state.slice(0, 2).toUpperCase());
    setUniversityDropdownVisible(false);
    Keyboard.dismiss();
  }, []);

  const selectDate = (d: Date) => {
    if (datePicker === 'from') setFromDate(d);
    if (datePicker === 'to') setToDate(d);
    closeDatePicker();
  };

  const renderDomeCircle = () => (
    <View style={[styles.domeCircleWrap, { marginTop: domeTop }]}>
      <View style={styles.domeBaseFill} />
      <View style={styles.domeGlowOuter} />
      <View style={styles.domeGlowInner} />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Pressable
        style={[styles.inboxBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.navigate('Inbox')}
        hitSlop={12}
      >
        <Text style={styles.inboxLabel}>Inbox</Text>
      </Pressable>
      {/* Hamburger button — floats top-right above everything */}
      <Pressable
        style={[styles.hamburgerBtn, { top: insets.top + 12 }]}
        onPress={openMenu}
        hitSlop={12}
      >
        <View style={styles.hamburgerLine} />
        <View style={styles.hamburgerLine} />
        <View style={styles.hamburgerLine} />
      </Pressable>

      {/* Slide-in panel from right */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <View style={styles.menuOverlay}>
          <Pressable style={{ flex: 1 }} onPress={closeMenu} />
          <Animated.View
            style={[styles.menuPanel, { transform: [{ translateX: menuSlide }] }]}
          >
            <View style={{ paddingTop: insets.top + 24, flex: 1 }}>
              {/* Profile identity at top of panel */}
              <Pressable
                style={styles.menuProfileRow}
                onPress={() => {
                  closeMenu();
                  navigation.navigate('Profile');
                }}
              >
                <View style={styles.menuProfileAvatar}>
                  <Image
                    source={require('../assets/handsome-dan.jpg')}
                    style={styles.menuProfileAvatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.menuProfileName} numberOfLines={1}>
                  {profileFullName}
                </Text>
                <Text style={styles.menuProfileSub} numberOfLines={1}>
                  {profileUniversity}
                </Text>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable style={styles.menuItem} onPress={() => { setActiveView('home'); closeMenu(); }}>
                <Text style={[styles.menuItemText, activeView === 'home' && styles.menuItemActive]}>Home</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  closeMenu();
                  navigation.navigate('Profile');
                }}
              >
                <Text style={styles.menuItemText}>Profile</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setActiveView('connections'); closeMenu(); }}>
                <Text style={[styles.menuItemText, activeView === 'connections' && styles.menuItemActive]}>
                  {`Connection Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
                </Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={async () => { closeMenu(); await supabase.auth.signOut(); }}>
                <Text style={[styles.menuItemText, styles.menuItemSignOut]}>Sign Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={rateSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeRateSheet}
      >
        <KeyboardAvoidingView
          style={styles.rateSheetRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.rateSheetBackdrop}
            onPress={closeRateSheet}
            disabled={rateSubmitting || rateSuccess}
          />
          <Animated.View
            style={[
              styles.rateSheetPanel,
              { transform: [{ translateY: rateSheetAnim }] },
            ]}
          >
            <SafeAreaView edges={['bottom']} style={styles.rateSheetSafe}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.rateSheetScrollContent}
              >
                <Text style={styles.rateSheetTitle}>Rate your stay</Text>
                <Text style={styles.rateSheetHostLine}>
                  {`${MOCK_PAST_TRIP.hostProfileName}\n${MOCK_PAST_TRIP.hostUniversity}`}
                </Text>
                {rateSuccess ? (
                  <Text style={styles.rateSuccessText}>Review submitted!</Text>
                ) : (
                  <>
                    <View style={styles.rateStarsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          style={styles.rateStarHit}
                          onPress={() => setRateStars(n)}
                          hitSlop={4}
                        >
                          <Text
                            style={[
                              styles.rateStarGlyph,
                              {
                                color:
                                  n <= rateStars
                                    ? RATE_STAR_GOLD
                                    : RATE_STAR_EMPTY,
                              },
                            ]}
                          >
                            ★
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.rateReviewInput}
                      value={rateReviewText}
                      onChangeText={setRateReviewText}
                      placeholder="Share your experience..."
                      placeholderTextColor={theme.placeholder}
                      multiline
                      maxLength={2000}
                      textAlignVertical="top"
                    />
                    <Pressable
                      style={[
                        styles.rateSubmitBtn,
                        (rateStars < 1 || rateSubmitting) &&
                          styles.rateSubmitBtnDisabled,
                      ]}
                      onPress={() => void submitHostReview()}
                      disabled={rateStars < 1 || rateSubmitting}
                    >
                      <Text style={styles.rateSubmitBtnText}>
                        Submit review
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={closeRateSheet}
                      disabled={rateSubmitting}
                      style={styles.rateCancelBtn}
                    >
                      <Text style={styles.rateCancelText}>Cancel</Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!expanded}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.domeScrollSection,
            {
              height: collapsedClip,
              opacity: expanded ? 0 : 1,
            },
          ]}
          pointerEvents={expanded ? 'none' : 'auto'}
          importantForAccessibility={expanded ? 'no-hide-descendants' : 'yes'}
        >
          <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderDomeCircle()}
            <View style={styles.collapsedOverlay}>
              <View
                style={[
                  styles.collapsedOverlayInner,
                  { paddingTop: insets.top + 12 },
                ]}
              >
                <Text style={styles.heroHi}>{`Hi, ${displayName}!`}</Text>
                <Text style={styles.heroGreeting}>
                  {`Where to next?`}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {`Tell me where you're headed`}
                </Text>
                <Pressable style={styles.searchBar} onPress={runExpand}>
                  <Text style={styles.searchIcon}>✦</Text>
                  <Text style={styles.searchPlaceholder}>
                    Ask me anything...
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.scrollPadded}>
          <View style={{ height: 8 }} />

          {activeView === 'home' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming trips</Text>
                <Pressable hitSlop={8}>
                  <Text style={styles.addBtn}>Add</Text>
                </Pressable>
              </View>
              {tripsLoading ? (
                <Text style={styles.tripsLoading}>Loading trips…</Text>
              ) : trips.length === 0 ? (
                <Text style={styles.tripsEmpty}>No upcoming trips yet</Text>
              ) : (
                trips.map((trip) => {
                  const pill = tripStatusMeta(trip.status);
                  const dest = formatTripDestination(
                    trip.destination_city,
                    trip.destination_state,
                  );
                  const df = (trip.date_from ?? '').trim();
                  const dt = (trip.date_to ?? '').trim();
                  const dateLine =
                    df && dt ? `${df} to ${dt}` : df || dt || '';
                  return (
                    <View key={trip.id} style={styles.tripCard}>
                      <Text style={styles.tripDest}>{dest}</Text>
                      {dateLine ? (
                        <Text style={styles.tripDates}>{dateLine}</Text>
                      ) : null}
                      <View
                        style={[
                          styles.tripStatusPill,
                          { backgroundColor: pill.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tripStatusPillText,
                            { color: pill.fg },
                          ]}
                        >
                          {pill.label}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                <Text style={styles.sectionTitle}>Past trips</Text>
              </View>
              <View style={styles.tripCard}>
                <Text style={styles.tripDest}>{MOCK_PAST_TRIP.destination}</Text>
                <Text style={styles.tripDates}>{MOCK_PAST_TRIP.dates}</Text>
                <Text style={styles.pastTripHost}>{MOCK_PAST_TRIP.hostLine}</Text>
                <View style={styles.pastTripFooter}>
                  <View style={styles.completedPill}>
                    <Text style={styles.completedPillText}>Completed</Text>
                  </View>
                  {!pastTripHostRated ? (
                    <Pressable
                      style={styles.rateHostBtn}
                      onPress={openRateSheet}
                      hitSlop={6}
                    >
                      <Text style={styles.rateHostBtnText}>Rate host</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          )}

          {activeView === 'connections' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Connection Requests</Text>
              </View>
              {requests.length === 0 && (
                <Text style={{ color: theme.textMuted, fontSize: 15, marginTop: 8 }}>
                  No pending requests.
                </Text>
              )}
              {requests.map((req) => (
                <View key={req.id} style={styles.reqCard}>
                  <Text style={styles.reqName}>{req.name}</Text>
                  <Text style={styles.reqSchool}>{req.university}</Text>
                  <View style={styles.reqRow}>
                    <Pressable style={styles.acceptBtn} onPress={() => acceptRequest(req.id)}>
                      <Text style={styles.acceptLabel}>Accept</Text>
                    </Pressable>
                    <Pressable style={styles.declineBtn} onPress={() => declineRequest(req.id)}>
                      <Text style={styles.declineLabel}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {expanded ? (
        <Animated.View
          style={[styles.expandOverlayHost, { height: clipHeight }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              transform: [
                { scale: circleScale },
                { translateY: circleTranslateY },
              ],
            }}
          >
            {renderDomeCircle()}
          </Animated.View>

          <Animated.View
            style={[styles.collapsedOverlay, { opacity: collapsedOpacity }]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.collapsedOverlayInner,
                { paddingTop: insets.top + 12 },
              ]}
            >
              <Text style={styles.heroGreeting}>
                {`Where to next, ${displayName}?`}
              </Text>
              <Text style={styles.heroSubtitle}>
                {`Tell me where you're headed`}
              </Text>
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>✦</Text>
                <Text style={styles.searchPlaceholder}>
                  Ask me anything...
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.expandedRoot,
              {
                opacity: expandedOpacity,
                paddingTop: insets.top + 4,
              },
            ]}
            pointerEvents="auto"
          >
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingBottom: insets.bottom + 24,
                }}
              >
                <View style={styles.expandedHeader}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={runCollapse}
                    hitSlop={12}
                    accessibilityLabel="Back"
                  >
                    <Text style={styles.backGlyph}>‹</Text>
                  </Pressable>
                </View>
                <Text style={styles.planTitle}>Plan your stay</Text>

                <View
                  style={[
                    styles.cityAutocompleteWrap,
                    styles.universityAutocompleteWrap,
                  ]}
                >
                  <Text style={styles.fieldLabel}>
                    Traveling to a university?
                  </Text>
                  <View style={[styles.inputShell, styles.cityInputShellRow]}>
                    <TextInput
                      style={[styles.input, styles.cityInputFlex]}
                      value={universitySearch}
                      onChangeText={onUniversityChangeText}
                      onFocus={onUniversityInputFocus}
                      onBlur={onUniversityInputBlur}
                      placeholder="Search by school name"
                      placeholderTextColor={theme.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      blurOnSubmit={false}
                    />
                  </View>
                  {universityDropdownVisible &&
                  universitySuggestions.length > 0 ? (
                    <View style={styles.cityDropdown}>
                      <FlatList
                        data={universitySuggestions}
                        keyExtractor={(item) => item.name}
                        keyboardShouldPersistTaps="handled"
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={() => onSelectUniversity(item)}
                            style={({ pressed }) => [
                              styles.cityDropdownRow,
                              pressed && styles.cityDropdownRowPressed,
                            ]}
                          >
                            <Text style={styles.cityDropdownMain}>
                              {item.name}
                            </Text>
                            <Text style={styles.cityDropdownSub}>
                              {`${item.city}, ${item.state}`}
                            </Text>
                          </Pressable>
                        )}
                        ItemSeparatorComponent={() => (
                          <View style={styles.cityDropdownSep} />
                        )}
                      />
                    </View>
                  ) : null}
                </View>

                <Text style={styles.fieldLabel}>Destination</Text>
                <View style={styles.cityStateRow}>
                  <View style={[styles.cityField, styles.cityAutocompleteWrap]}>
                    <Text style={styles.fieldLabel}>City</Text>
                    <View style={[styles.inputShell, styles.cityInputShellRow]}>
                      <TextInput
                        style={[styles.input, styles.cityInputFlex]}
                        value={destinationCity}
                        onChangeText={onCityChangeText}
                        onFocus={onCityInputFocus}
                        onBlur={onCityInputBlur}
                        placeholder="City"
                        placeholderTextColor={theme.placeholder}
                        autoCapitalize="words"
                        autoCorrect={false}
                        blurOnSubmit={false}
                      />
                      {cityAutocompleteLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.textMuted}
                        />
                      ) : null}
                    </View>
                    {cityDropdownVisible && citySuggestions.length > 0 ? (
                      <View style={styles.cityDropdown}>
                        <FlatList
                          data={citySuggestions}
                          keyExtractor={(item) => item.place_id}
                          keyboardShouldPersistTaps="handled"
                          scrollEnabled={false}
                          renderItem={({ item }) => {
                            const { main, sub } = cityPredictionLines(item);
                            return (
                              <Pressable
                                onPress={() => onSelectCityPrediction(item)}
                                style={({ pressed }) => [
                                  styles.cityDropdownRow,
                                  pressed && styles.cityDropdownRowPressed,
                                ]}
                              >
                                <Text style={styles.cityDropdownMain}>
                                  {main}
                                </Text>
                                {sub ? (
                                  <Text style={styles.cityDropdownSub}>
                                    {sub}
                                  </Text>
                                ) : null}
                              </Pressable>
                            );
                          }}
                          ItemSeparatorComponent={() => (
                            <View style={styles.cityDropdownSep} />
                          )}
                        />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.stateField}>
                    <Text style={styles.fieldLabel}>State</Text>
                    <View style={styles.inputShell}>
                      <TextInput
                        style={styles.input}
                        value={destinationState}
                        onChangeText={setDestinationState}
                        placeholder="ST"
                        placeholderTextColor={theme.placeholder}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={2}
                      />
                    </View>
                  </View>
                </View>

                <Pressable
                  style={styles.mapBtn}
                  onPress={() => setMapModalVisible(true)}
                >
                  <Text style={styles.mapBtnLabel}>Pick on map</Text>
                </Pressable>

                <Text style={[styles.fieldLabel, { marginTop: 22 }]}>
                  Dates
                </Text>
                <View style={styles.dateRow}>
                  <Pressable
                    style={styles.dateCell}
                    onPress={() => openDatePicker('from')}
                  >
                    <Text style={styles.dateCellLabel}>FROM</Text>
                    <Text style={styles.dateCellValue}>
                      {formatDate(fromDate)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.dateCell}
                    onPress={() => openDatePicker('to')}
                  >
                    <Text style={styles.dateCellLabel}>TO</Text>
                    <Text style={styles.dateCellValue}>
                      {formatDate(toDate)}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 22 }]}>
                  Any preferences?
                </Text>
                <View style={styles.inputShell}>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={preferences}
                    onChangeText={setPreferences}
                    placeholder="House rules, accessibility, vibe…"
                    placeholderTextColor={theme.placeholder}
                    multiline
                  />
                </View>

                <Pressable style={styles.findBtn} onPress={onFindStay}>
                  <Text style={styles.findBtnLabel}>Find my stay</Text>
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </Animated.View>
      ) : null}

      <Modal
        visible={mapModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeMapModal}
      >
        <View style={styles.mapModalRoot}>
          {Platform.OS === 'web' ? (
            <View style={styles.mapWebFallback}>
              <Text style={styles.mapWebFallbackText}>
                Map picker runs on the iOS and Android apps. Use a device or
                simulator to choose a location.
              </Text>
              <Pressable
                style={[styles.mapConfirmBtn, { marginTop: 24 }]}
                onPress={closeMapModal}
              >
                <Text style={styles.mapConfirmLabel}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <MapView
                style={styles.mapViewFill}
                /*provider={PROVIDER_GOOGLE}*/

                initialRegion={NYC_CENTER}
                onRegionChangeComplete={onMapRegionChangeComplete}
                rotateEnabled={false}
                pitchEnabled={false}
              />
              <View style={styles.mapPinLayer} pointerEvents="none">
                <View style={styles.mapPinOffset}>
                  <Text style={styles.mapPinGlyph}>📍</Text>
                </View>
              </View>
              <View
                style={[
                  styles.mapTopBar,
                  { paddingTop: insets.top + 8 },
                ]}
              >
                <Pressable
                  style={styles.mapCloseBtn}
                  onPress={closeMapModal}
                  accessibilityLabel="Close map"
                >
                  <Text style={styles.mapCloseGlyph}>✕</Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.mapBottomArea,
                  { paddingBottom: Math.max(insets.bottom, 16) },
                ]}
              >
                <View style={styles.mapAddressCard}>
                  <Text style={styles.mapAddressLabel}>SELECTED AREA</Text>
                  <View style={styles.mapGeocodeRow}>
                    {mapGeocodeLoading ? (
                      <ActivityIndicator
                        style={{ marginRight: 10 }}
                        size="small"
                        color={theme.textMuted}
                      />
                    ) : null}
                    <Text
                      style={styles.mapAddressText}
                      numberOfLines={4}
                    >
                      {mapAddressPreview ||
                        (mapGeocodeLoading ? 'Looking up address…' : '—')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.mapConfirmBtn,
                    (mapGeocodeLoading ||
                      !mapAddressPreview.trim() ||
                      mapAddressPreview.startsWith('Add your Google') ||
                      mapAddressPreview === 'Could not resolve address') &&
                      styles.mapConfirmDisabled,
                  ]}
                  onPress={confirmMapLocation}
                  disabled={
                    mapGeocodeLoading ||
                    !mapAddressPreview.trim() ||
                    mapAddressPreview.startsWith('Add your Google') ||
                    mapAddressPreview === 'Could not resolve address'
                  }
                >
                  <Text style={styles.mapConfirmLabel}>Confirm location</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal
        visible={datePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeDatePicker} />
          <View
            style={[
              styles.calSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.calHeader}>
              <Pressable
                style={styles.calNavBtn}
                onPress={() => shiftCalendarMonth(-1)}
                hitSlop={8}
              >
                <Text style={styles.calNavGlyph}>‹</Text>
              </Pressable>
              <Text style={[styles.calTitle, { flex: 1, textAlign: 'center' }]}>
                {calendarMonth.toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Pressable
                style={styles.calNavBtn}
                onPress={() => shiftCalendarMonth(1)}
                hitSlop={8}
              >
                <Text style={styles.calNavGlyph}>›</Text>
              </Pressable>
            </View>
            <Text style={styles.calHint}>
              {datePicker === 'from'
                ? 'Select your check-in date'
                : 'Select your check-out date'}
            </Text>
            <View style={styles.calWeekRow}>
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} style={styles.calWeekCell}>
                  <Text style={styles.calWeekLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {chunkArray(
              calendarCellsForMonth(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth(),
              ),
              7,
            ).map((week, wi) => (
              <View key={wi} style={styles.calWeek}>
                {week.map((day, di) => {
                  if (day === null) {
                    return (
                      <View
                        key={`pad-${wi}-${di}`}
                        style={styles.calDayTouch}
                      >
                        <View
                          style={[
                            styles.calDayInner,
                            styles.calDayInnerMuted,
                          ]}
                        />
                      </View>
                    );
                  }
                  const cellDate = new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth(),
                    day,
                  );
                  cellDate.setHours(0, 0, 0, 0);
                  const isFrom = isSameCalendarDay(cellDate, fromDate);
                  const isTo = isSameCalendarDay(cellDate, toDate);
                  const inRange =
                    compareCalendarDay(cellDate, fromDate) >= 0 &&
                    compareCalendarDay(cellDate, toDate) <= 0;
                  return (
                    <Pressable
                      key={`${wi}-${day}`}
                      style={styles.calDayTouch}
                      onPress={() => selectCalendarDay(day)}
                    >
                      <View
                        style={[
                          styles.calDayInner,
                          inRange &&
                            !isFrom &&
                            !isTo &&
                            styles.calDayInnerInRange,
                          (isFrom || isTo) && styles.calDayInnerSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayLabel,
                            inRange &&
                              !isFrom &&
                              !isTo &&
                              styles.calDayLabelInRange,
                            (isFrom || isTo) && styles.calDayLabelSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
