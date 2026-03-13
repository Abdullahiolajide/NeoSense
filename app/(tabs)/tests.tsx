import { RiskBadge } from '@/components/Badges';
import { GlassCard } from '@/components/GlassCard';
import { NeoButton } from '@/components/NeoButton';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { Colors, FontFamily, FontSize, Shadows, Spacing } from '@/constants/Theme';
import type { Test } from '@/constants/Types';
import { useAuth } from '@/contexts/AuthContext';
import { deleteTest, getTests } from '@/lib/database';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TestsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadTests = useCallback(async () => {
        if (!user?.id) return;
        try {
            const data = await getTests(user.id);
            setTests(data);
        } catch (err) {
            console.error('Load tests error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadTests();
    }, [loadTests]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleDeleteTest = async (testId: string, testName: string) => {
        Alert.alert(
            'Delete Test',
            `Are you sure you want to delete "${testName}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTest(testId);
                            loadTests();
                        } catch (err) {
                            console.error('Delete test error:', err);
                            Alert.alert('Error', 'Failed to delete test');
                        }
                    },
                },
            ]
        );
    };

    const renderTest = useCallback(
        ({ item, index }: { item: Test; index: number }) => (
            <Animated.View entering={FadeInRight.duration(400).delay(index * 80)}>
                <GlassCard style={styles.testCard}>
                    <Pressable 
                        onPress={() => router.push(`/test/${item.id}`)}
                        style={styles.cardPressable}
                    >
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleArea}>
                                <Text style={styles.testName} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={styles.testDate}>{formatDate(item.created_at)}</Text>
                            </View>
                            <RiskBadge risk={item.overall_risk} size="sm" />
                        </View>
                        {item.notes ? (
                            <Text style={styles.testNotes} numberOfLines={2}>
                                {item.notes}
                            </Text>
                        ) : null}
                    </Pressable>

                    <View style={styles.cardFooter}>
                        <Pressable 
                            onPress={() => router.push(`/test/${item.id}`)}
                            style={styles.viewDetailsBtn}
                        >
                            <Text style={styles.viewDetails}>View Details →</Text>
                        </Pressable>
                        <Pressable 
                            onPress={() => handleDeleteTest(item.id, item.name)}
                            style={styles.deleteBtn}
                        >
                            <Feather name="trash-2" size={18} color={Colors.error} />
                        </Pressable>
                    </View>
                </GlassCard>
            </Animated.View>
        ),
        [router]
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
                <Text style={styles.title}>Tests</Text>
                <Text style={styles.subtitle}>{tests.length} total screening tests</Text>
            </Animated.View>

            {loading ? (
                <View style={styles.listContent}>
                    {[0, 1, 2].map((i) => (
                        <SkeletonCard key={i} style={{ marginBottom: Spacing.md }} />
                    ))}
                </View>
            ) : tests.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>No tests yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Create your first neonatal screening test to get started
                    </Text>
                    <NeoButton
                        title="Create First Test"
                        onPress={() => router.push('/test/new')}
                        style={{ marginTop: Spacing.xxl }}
                    />
                </View>
            ) : (
                <FlatList
                    data={tests}
                    renderItem={renderTest}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadTests();
                            }}
                            tintColor={Colors.primary}
                        />
                    }
                />
            )}

            {/* FAB */}
            {tests.length > 0 && (
                <Pressable
                    style={[styles.fab, Shadows.glow]}
                    onPress={() => router.push('/test/new')}
                >
                    <Text style={styles.fabIcon}>+</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        padding: Spacing.xxl,
        paddingBottom: Spacing.md,
    },
    title: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
    },
    subtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    listContent: {
        padding: Spacing.xxl,
        paddingTop: Spacing.md,
        paddingBottom: 100,
    },
    testCard: {
        marginBottom: Spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    cardTitleArea: {
        flex: 1,
        marginRight: Spacing.md,
    },
    testName: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
    },
    testDate: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    testNotes: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    cardPressable: {
        padding: 0,
    },
    viewDetails: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.primary,
    },
    cardFooter: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.md,
        marginTop: Spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    viewDetailsBtn: {
        flex: 1,
    },
    deleteBtn: {
        padding: Spacing.xs,
        marginLeft: Spacing.md,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: Spacing.lg,
    },
    emptyTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.xl,
        color: Colors.textPrimary,
    },
    emptySubtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: Spacing.xxl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fabIcon: {
        fontSize: 28,
        color: Colors.textInverse,
        fontWeight: '300',
        marginTop: -2,
    },
});
