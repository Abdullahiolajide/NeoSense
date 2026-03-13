import { NeoButton } from '@/components/NeoButton';
import { NeoInput } from '@/components/NeoInput';
import { PulseWave } from '@/components/PulseWave';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { signIn } from '@/lib/auth';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = useCallback(async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await signIn(email.trim(), password);
            // Auth state change will handle navigation
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [email, password]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Logo & Pulse */}
                <Animated.View entering={FadeInUp.duration(800)} style={styles.heroSection}>
                    <PulseWave size={140} />
                    <Text style={styles.logoText}>NeoSense</Text>
                    <Text style={styles.tagline}>AI-Powered Neonatal Diagnostics</Text>
                </Animated.View>

                {/* Form */}
                <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.formSection}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <NeoInput
                        label="Email Address"
                        placeholder="doctor@hospital.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <NeoInput
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <NeoButton
                        title="Sign In"
                        onPress={handleLogin}
                        loading={loading}
                        fullWidth
                        size="lg"
                        style={{ marginTop: Spacing.md }}
                    />

                    <View style={styles.registerRow}>
                        <Text style={styles.registerText}>Don't have an account?</Text>
                        <Pressable onPress={() => router.push('/(auth)/register')}>
                            <Text style={styles.registerLink}> Register</Text>
                        </Pressable>
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
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Spacing.xxl,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: Spacing.huge,
    },
    logoText: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxxl,
        color: Colors.primary,
        marginTop: Spacing.xl,
        letterSpacing: 1,
    },
    tagline: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    formSection: {
        width: '100%',
    },
    title: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.xxl,
    },
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
    registerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.xxl,
    },
    registerText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    registerLink: {
        fontFamily: FontFamily.bodySemiBold,
        fontSize: FontSize.md,
        color: Colors.primary,
    },
});
