import React from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();

  return <OnboardingScreen onFinish={() => router.replace('/(tabs)')} />;
}
