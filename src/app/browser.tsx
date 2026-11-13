import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BrowserScreen } from '@/features/browser/components/BrowserScreen';

export default function BrowserRoute() {
  const { url } = useLocalSearchParams<{ url?: string }>();

  return <BrowserScreen initialUrl={url ?? 'https://www.google.com'} />;
}
