import { RiskBadge, RoleBadge } from '@/components/Badges';
import { GlassCard } from '@/components/GlassCard';
import { NeoButton } from '@/components/NeoButton';
import { PulseWave } from '@/components/PulseWave';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import type { Test } from '@/constants/Types';
import { useAuth } from '@/contexts/AuthContext';
import { getTests, getUserStats } from '@/lib/database';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ total: 0, highRisk: 0, thisWeek: 0 });
  const [recentTests, setRecentTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [statsData, testsData] = await Promise.all([
        getUserStats(user.id),
        getTests(user.id),
      ]);
      setStats(statsData);
      setRecentTests(testsData.slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      {/* Hero Section */}
      <Animated.View entering={FadeInDown.duration(600)} style={styles.heroSection}>
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>
              Hello, {profile?.full_name?.split(' ')[0] || 'Doctor'} 👋
            </Text>
            {profile?.role && <RoleBadge role={profile.role} size="sm" />}
          </View>
        </View>

        {/* Pulse Wave Hero */}
        <View style={styles.pulseContainer}>
          <PulseWave size={180} rings={5} speed={2500} />
        </View>
        <Text style={styles.heroTitle}>NeoSense</Text>
        <Text style={styles.heroSubtitle}>AI Neonatal Screening</Text>
      </Animated.View>

      {/* Stats Cards */}
      <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Tests</Text>
        </GlassCard>
        <GlassCard style={[styles.statCard, { borderColor: Colors.riskHigh + '30' }]}>
          <Text style={[styles.statNumber, { color: Colors.riskHigh }]}>{stats.highRisk}</Text>
          <Text style={styles.statLabel}>High Risk</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.mint }]}>{stats.thisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </GlassCard>
      </Animated.View>

      {/* New Test CTA */}
      <Animated.View entering={FadeInDown.duration(600).delay(400)}>
        <NeoButton
          title="✨  Start New Test"
          onPress={() => router.push('/test/new')}
          fullWidth
          size="lg"
          style={styles.ctaButton}
        />
      </Animated.View>

      {/* Recent Tests */}
      <Animated.View entering={FadeInDown.duration(600).delay(600)} style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tests</Text>
          <Pressable onPress={() => router.push('/(tabs)/tests')}>
            <Text style={styles.seeAll}>See All →</Text>
          </Pressable>
        </View>

        {loading ? (
          <>
            <SkeletonCard style={{ marginBottom: Spacing.md }} />
            <SkeletonCard style={{ marginBottom: Spacing.md }} />
          </>
        ) : recentTests.length === 0 ? (
          <GlassCard>
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🩺</Text>
              <Text style={styles.emptyTitle}>No tests yet</Text>
              <Text style={styles.emptySubtitle}>
                Start your first neonatal screening test
              </Text>
            </View>
          </GlassCard>
        ) : (
          recentTests.map((test, index) => (
            <Animated.View
              key={test.id}
              entering={FadeInRight.duration(400).delay(index * 100)}
            >
              <Pressable onPress={() => router.push(`/test/${test.id}`)}>
                <GlassCard style={styles.testCard}>
                  <View style={styles.testCardHeader}>
                    <Text style={styles.testName} numberOfLines={1}>
                      {test.name}
                    </Text>
                    <RiskBadge risk={test.overall_risk} size="sm" />
                  </View>
                  <Text style={styles.testDate}>{formatDate(test.created_at)}</Text>
                  {test.notes ? (
                    <Text style={styles.testNotes} numberOfLines={1}>
                      {test.notes}
                    </Text>
                  ) : null}
                </GlassCard>
              </Pressable>
            </Animated.View>
          ))
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xxl,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  greetingRow: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  greetingText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  greeting: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  pulseContainer: {
    marginVertical: Spacing.xl,
  },
  heroTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: FontSize.display,
    color: Colors.primary,
    letterSpacing: 2,
    marginTop: Spacing.md,
  },
  heroSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: FontSize.xxl,
    color: Colors.primary,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  ctaButton: {
    marginBottom: Spacing.xxxl,
  },
  recentSection: {},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  seeAll: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  testCard: {
    marginBottom: Spacing.md,
  },
  testCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  testName: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
  },
  testDate: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  testNotes: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
