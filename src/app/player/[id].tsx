import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlayerScreen } from '@/features/player/components/PlayerScreen';

export default function PlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PlayerScreen id={id ?? ''} />;
}
