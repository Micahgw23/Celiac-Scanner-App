import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AppStateProvider } from '@/lib/AppState';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="scan" />
          <Stack.Screen name="result" />
          <Stack.Screen name="label" />
          <Stack.Screen name="assistant" />
          <Stack.Screen name="history" options={{ headerShown: true, title: 'Scan History' }} />
        </Stack>
      </AppStateProvider>
    </ThemeProvider>
  );
}
