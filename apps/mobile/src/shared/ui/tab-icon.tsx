import Svg, { Path } from 'react-native-svg';

const paths = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-7h6v7',
  workouts: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12M3 12H1M21 12h2',
  progress: 'M3 3v18h18M7 15l4-4 4 3 6-7M17 7h4v4',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2',
} as const;

export function TabIcon({
  name,
  color,
  size,
}: {
  name: keyof typeof paths;
  color: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
