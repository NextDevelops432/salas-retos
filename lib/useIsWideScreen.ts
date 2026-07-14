import { useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 860;

export function useIsWideScreen(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
