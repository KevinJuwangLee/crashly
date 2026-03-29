import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import Degree2AnimationScreen from './screens/Degree2AnimationScreen';
import Degree2Screen from './screens/Degree2Screen';
import NextSearchScreen from './screens/NextSearchScreen';
import WebResultsScreen from './screens/WebResultsScreen';
import SearchAnimationScreen from './screens/SearchAnimationScreen';
import SearchScreen from './screens/SearchScreen';
import TripResultsScreen from './screens/TripResultsScreen';
import type { OnboardingData } from './types/onboarding';

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

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Home: { onboarding?: OnboardingData } | undefined;
  Search: HousingSearchParams;
  SearchAnimation: SearchAnimationParams;
  Degree2Animation: SearchAnimationParams;
  Degree2: undefined;
  WebResults: undefined;
  NextSearch: undefined;
  TripResults: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const prevSession = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // still loading
    if (!navigationRef.isReady()) return;
    // Session just cleared → go to Login
    if (prevSession.current !== undefined && prevSession.current !== null && session === null) {
      navigationRef.navigate('Login');
    }
    prevSession.current = session;
  }, [session]);

  if (session === undefined) return null; // splash / loading

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName={session ? 'Home' : 'Login'}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SearchAnimation" component={SearchAnimationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Degree2Animation" component={Degree2AnimationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Degree2" component={Degree2Screen} options={{ headerShown: false }} />
        <Stack.Screen name="WebResults" component={WebResultsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NextSearch" component={NextSearchScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TripResults" component={TripResultsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
