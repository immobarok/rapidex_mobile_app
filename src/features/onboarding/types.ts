import { Ionicons } from '@expo/vector-icons';

export type OnboardingSlide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  description: string;
};

