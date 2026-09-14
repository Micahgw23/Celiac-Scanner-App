import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { AppStateProvider } from '@/lib/AppState';

export default function RootLayout() {
  // The wrapper hook (not react-native's) so navigation chrome and app content
  // resolve the scheme the same way, including on web.
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <RootStack />
      </AppStateProvider>
    </ThemeProvider>
  );
}

/**
 * One header treatment across the app.
 *
 * Screens previously had four different back patterns — a native header on
 * one, a custom in-screen row on another, a bottom link on a third, and
 * nothing at all on two more. Camera and onboarding screens stay headerless
 * (full-bleed / focused); everything else gets the native header, themed to
 * the page background so the two don't meet at a visible seam.
 */
function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="result" options={{ headerShown: true, title: 'Result' }} />
      <Stack.Screen name="label" />
      <Stack.Screen name="assistant" options={{ headerShown: true, title: 'Ask about a food' }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'Scan History' }} />
    </Stack>
  );
}
