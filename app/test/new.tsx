import { NeoButton } from '@/components/NeoButton';
import { NeoInput } from '@/components/NeoInput';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { createTest } from '@/lib/database';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewTestScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = useCallback(async () => {
        if (!name.trim()) {
            setError('Please enter a test name');
            return;
        }
        if (!user?.id) {
            setError('You must be logged in');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const test = await createTest(user.id, name.trim(), notes.trim() || undefined);
            router.replace(`/test/${test.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create test');
        } finally {
            setLoading(false);
        }
    }, [name, notes, user?.id, router]);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backText}>← Back</Text>
                    </Pressable>
                </View>

                <Animated.View entering={FadeInDown.duration(600)}>
                    <Text style={styles.title}>New Screening Test</Text>
                    <Text style={styles.subtitle}>
                        Create a new neonatal screening test. You'll be able to capture images
                        and record audio for analysis.
                    </Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.form}>
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <NeoInput
                        label="Test Name *"
                        placeholder="e.g., Baby Amara — Day 2"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />

                    <NeoInput
                        label="Notes (Optional)"
                        placeholder="Any additional observations..."
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={4}
                        style={{ minHeight: 100, textAlignVertical: 'top' }}
                    />

                    <NeoButton
                        title="Create Test & Start Screening"
                        onPress={handleCreate}
                        loading={loading}
                        fullWidth
                        size="lg"
                        style={{ marginTop: Spacing.xl }}
                    />
                </Animated.View>

                {/* Quick Guide */}
                <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.guideSection}>
                    <Text style={styles.guideTitle}>What happens next?</Text>
                    <View style={styles.guideStep}>
                        <Text style={styles.guideNumber}>1</Text>
                        <View style={styles.guideContent}>
                            <Text style={styles.guideStepTitle}>📷 Jaundice Scan</Text>
                            <Text style={styles.guideStepText}>
                                Capture an image of the baby's skin/eyes for jaundice analysis
                            </Text>
                        </View>
                    </View>
                    <View style={styles.guideStep}>
                        <Text style={styles.guideNumber}>2</Text>
                        <View style={styles.guideContent}>
                            <Text style={styles.guideStepTitle}>🎙️ Cry Analysis</Text>
                            <Text style={styles.guideStepText}>
                                Record the baby's cry for audio classification
                            </Text>
                        </View>
                    </View>
                    <View style={styles.guideStep}>
                        <Text style={styles.guideNumber}>3</Text>
                        <View style={styles.guideContent}>
                            <Text style={styles.guideStepTitle}>📊 Risk Assessment</Text>
                            <Text style={styles.guideStepText}>
                                Get an AI-powered risk fusion score with recommendations
                            </Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
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
    header: {
        marginBottom: Spacing.xl,
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: Spacing.sm,
    },
    backText: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.md,
        color: Colors.primary,
    },
    title: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.xxxl,
    },
    form: {},
    errorContainer: {
        backgroundColor: Colors.riskHighDim,
        borderRadius: 12,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    errorText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.error,
    },
    guideSection: {
        marginTop: Spacing.huge,
    },
    guideTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
        marginBottom: Spacing.xl,
    },
    guideStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.xl,
        gap: Spacing.lg,
    },
    guideNumber: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.md,
        color: Colors.primary,
        width: 28,
        height: 28,
        lineHeight: 28,
        textAlign: 'center',
        borderRadius: 14,
        backgroundColor: Colors.primaryDim,
        overflow: 'hidden',
    },
    guideContent: {
        flex: 1,
    },
    guideStepTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    guideStepText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
});
