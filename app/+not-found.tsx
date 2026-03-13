import { NeoButton } from '@/components/NeoButton';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.title}>Screen not found</Text>
      <Text style={styles.subtitle}>The page you're looking for doesn't exist.</Text>
      <NeoButton
        title="Go Home"
        onPress={() => router.replace('/(tabs)')}
        style={{ marginTop: Spacing.xxl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
