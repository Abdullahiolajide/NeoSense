import { RoleBadge } from '@/components/Badges';
import { GlassCard } from '@/components/GlassCard';
import { NeoButton } from '@/components/NeoButton';
import { PulseWave } from '@/components/PulseWave';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';
import { getUserStats } from '@/lib/database';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { profile, user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [stats, setStats] = useState({ total: 0, highRisk: 0, thisWeek: 0 });
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        if (user?.id) {
            getUserStats(user.id).then(setStats).catch(() => { });
        }
    }, [user?.id]);

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOut(true);
                        try {
                            await signOut();
                        } catch {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        } finally {
                            setLoggingOut(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Profile Header */}
            <Animated.View entering={FadeInDown.duration(600)} style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {profile?.full_name
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2) || '?'}
                        </Text>
                    </View>
                    <View style={styles.avatarPulse}>
                        <PulseWave size={100} rings={2} speed={3000} color={Colors.primary + '40'} />
                    </View>
                </View>

                <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
                {profile?.role && <RoleBadge role={profile.role} />}
                {profile?.institution && (
                    <Text style={styles.institution}>🏥 {profile.institution}</Text>
                )}
                <Text style={styles.email}>{user?.email}</Text>
            </Animated.View>

            {/* Stats */}
            <Animated.View entering={FadeInDown.duration(600).delay(200)}>
                <GlassCard style={styles.statsCard}>
                    <Text style={styles.sectionTitle}>Your Activity</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.total}</Text>
                            <Text style={styles.statLabel}>Total Tests</Text>
                        </View>
                        <View style={[styles.statItem, styles.statBorder]}>
                            <Text style={[styles.statValue, { color: Colors.riskHigh }]}>
                                {stats.highRisk}
                            </Text>
                            <Text style={styles.statLabel}>High Risk</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: Colors.mint }]}>
                                {stats.thisWeek}
                            </Text>
                            <Text style={styles.statLabel}>This Week</Text>
                        </View>
                    </View>
                </GlassCard>
            </Animated.View>

            {/* About Section */}
            <Animated.View entering={FadeInDown.duration(600).delay(400)}>
                <GlassCard style={styles.aboutCard}>
                    <Text style={styles.sectionTitle}>About NeoSense</Text>
                    <Text style={styles.aboutText}>
                        NeoSense uses artificial intelligence to assist healthcare workers in
                        screening newborns for jaundice and sepsis. The app analyzes images and
                        cry audio to provide risk assessments.
                    </Text>
                    <View style={styles.versionRow}>
                        <Text style={styles.versionLabel}>Version</Text>
                        <Text style={styles.versionValue}>1.0.0</Text>
                    </View>
                    <View style={styles.versionRow}>
                        <Text style={styles.versionLabel}>Build</Text>
                        <Text style={styles.versionValue}>2025.1</Text>
                    </View>
                </GlassCard>
            </Animated.View>

            {/* Logout */}
            <Animated.View entering={FadeInDown.duration(600).delay(600)}>
                <NeoButton
                    title="Sign Out"
                    onPress={handleLogout}
                    variant="outline"
                    fullWidth
                    loading={loggingOut}
                    style={styles.logoutButton}
                />
            </Animated.View>

            <Text style={styles.footer}>
                Made with ❤️ for neonatal care
            </Text>
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
    profileHeader: {
        alignItems: 'center',
        marginBottom: Spacing.xxxl,
        marginTop: Spacing.xl,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryDim,
        borderWidth: 2,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    avatarPulse: {
        position: 'absolute',
        zIndex: 1,
    },
    avatarText: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.primary,
    },
    userName: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    institution: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: Spacing.sm,
    },
    email: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        marginTop: Spacing.xs,
    },
    statsCard: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statBorder: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: Colors.border,
    },
    statValue: {
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
    aboutCard: {
        marginBottom: Spacing.xxl,
    },
    aboutText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    versionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    versionLabel: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    versionValue: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
    },
    logoutButton: {
        marginBottom: Spacing.xxl,
    },
    footer: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.md,
    },
});
