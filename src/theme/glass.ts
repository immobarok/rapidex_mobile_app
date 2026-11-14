import { Platform, ViewStyle } from 'react-native';
import { colors } from './colors';

export const iosContinuousCurve: ViewStyle =
  Platform.OS === 'ios' ? { borderCurve: 'continuous' } : {};

export const glassBevelStyle: ViewStyle = {
  ...iosContinuousCurve,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  borderTopColor: colors.glassHighlight,
  borderBottomColor: colors.glassBorderSubtle,
};
