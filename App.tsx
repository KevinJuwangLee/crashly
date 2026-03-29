import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ProfileScreen from './screens/ProfileScreen';
import Degree2AnimationScreen from './screens/Degree2AnimationScreen';
import Degree2Screen from './screens/Degree2Screen';
import NextSearchScreen from './screens/NextSearchScreen';
import SummaryScreen from './screens/SummaryScreen';
import WebResultsScreen, { type WebListing } from './screens/WebResultsScreen';
import SearchAnimationScreen from './screens/SearchAnimationScreen';
import SearchScreen from './screens/SearchScreen';
import TripResultsScreen from './screens/TripResultsScreen';
import ChatScreen from './screens/ChatScreen';
import InboxScreen from './screens/InboxScreen';
import { supabase } from './lib/supabase';
import type { OnboardingData } from './types/onboarding';

export type Degree1SummaryResult = {
  name?: string;
  university?: string | null;
  rating?: number | null;
  summary?: string | null;
  is_good_match?: boolean;
  willing_to_charge?: boolean | string | null;
  /** Supabase `profiles.id` for the matched host (merged server-side). */
  profile_id?: string | null;
  id?: string | null;
};

export type Degree2SummaryResult = {
  name?: string;
  university?: string | null;
  rating?: number | null;
  teaser_summary?: string | null;
  via_friend?: string | null;
  /** Bridge friend's `profiles.id` (merged server-side). */
  via_friend_profile_id?: string | null;
  /** Same as `via_friend_profile_id`; included for clients that expect this name. */
  via_friend_id?: string | null;
};

export type SummaryScreenParams = {
  destination_city: string;
  destination_state: string;
  date_from: string;
  date_to: string;
  degree1Results: Degree1SummaryResult[];
  degree2Results: Degree2SummaryResult[];
  webResults: WebListing[];
};

export type HousingSearchParams = {
  destination_city: string;
  destination_state: string;
  university: string;
  date_from: string;
  date_to: string;
  preferences: string;
};

export type SearchAnimationParams = {
  user_id: number;
  destination_city: string;
  destination_state: string;
  university: string;
  date_from: string;
  date_to: string;
  preferences: string;
};

export type ChatTripSummary = {
  destination?: string;
  dates?: string;
};

export type ChatScreenParams = {
  conversation_id: string;
  other_user_name: string;
  other_user_initials: string;
  trip_summary?: ChatTripSummary;
};

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Home: { onboarding?: OnboardingData } | undefined;
  Profile: undefined;
  Chat: ChatScreenParams;
  Inbox: undefined;
  Search: HousingSearchParams;
  SearchAnimation: SearchAnimationParams;
  Degree2Animation: SearchAnimationParams & {
    degree1Results: Degree1SummaryResult[];
  };
  Degree2: undefined;
  WebResults: HousingSearchParams & {
    degree1Results: Degree1SummaryResult[];
    degree2Results: Degree2SummaryResult[];
  };
  Summary: SummaryScreenParams;
  NextSearch: undefined;
  TripResults: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const prevSession = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => setSession(s));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!navigationRef.isReady()) return;
    if (
      prevSession.current !== undefined &&
      prevSession.current !== null &&
      session === null
    ) {
      navigationRef.navigate('Login');
    }
    prevSession.current = session;
  }, [session]);

  if (session === undefined) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName={session ? 'Home' : 'Login'}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Inbox"
          component={InboxScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SearchAnimation"
          component={SearchAnimationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Degree2Animation"
          component={Degree2AnimationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Degree2"
          component={Degree2Screen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WebResults"
          component={WebResultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Summary"
          component={SummaryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NextSearch"
          component={NextSearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TripResults"
          component={TripResultsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
