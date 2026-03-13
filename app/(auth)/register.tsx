import { NeoButton } from '@/components/NeoButton';
import { NeoInput } from '@/components/NeoInput';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import type { UserRole } from '@/constants/Types';
import { signUp } from '@/lib/auth';
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

export default function RegisterScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('health_worker');
    const [institution, setInstitution] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = useCallback(async () => {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            setError('Please fill in all required fields');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await signUp(email.trim(), password, fullName.trim(), role, institution.trim() || undefined);
            // Auth state change will handle navigation
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [fullName, email, password, role, institution]);

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
                <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join NeoSense to start screening</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.formSection}>
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <NeoInput
                        label="Full Name"
                        placeholder="Dr. Sarah Johnson"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                    />

                    <NeoInput
                        label="Email Address"
                        placeholder="sarah@hospital.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <NeoInput
                        label="Password"
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    {/* Role Selection */}
                    <Text style={styles.label}>Role</Text>
                    <View style={styles.roleRow}>
                        <Pressable
                            style={[
                                styles.roleOption,
                                role === 'doctor' && styles.roleSelected,
                            ]}
                            onPress={() => setRole('doctor')}
                        >
                            <Text style={styles.roleIcon}>👨‍⚕️</Text>
                            <Text
                                style={[
                                    styles.roleText,
                                    role === 'doctor' && styles.roleTextSelected,
                                ]}
                            >
                                Doctor
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.roleOption,
                                role === 'health_worker' && styles.roleSelected,
                            ]}
                            onPress={() => setRole('health_worker')}
                        >
                            <Text style={styles.roleIcon}>🏥</Text>
                            <Text
                                style={[
                                    styles.roleText,
                                    role === 'health_worker' && styles.roleTextSelected,
                                ]}
                            >
                                Health Worker
                            </Text>
                        </Pressable>
                    </View>

                    <NeoInput
                        label="Institution (Optional)"
                        placeholder="City General Hospital"
                        value={institution}
                        onChangeText={setInstitution}
                        autoCapitalize="words"
                    />

                    <NeoButton
                        title="Create Account"
                        onPress={handleRegister}
                        loading={loading}
                        fullWidth
                        size="lg"
                        style={{ marginTop: Spacing.md }}
                    />

                    <View style={styles.loginRow}>
                        <Text style={styles.loginText}>Already have an account?</Text>
                        <Pressable onPress={() => router.back()}>
                            <Text style={styles.loginLink}> Sign In</Text>
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
        padding: Spacing.xxl,
        paddingTop: 60,
    },
    header: {
        marginBottom: Spacing.xxxl,
    },
    title: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxxl,
        color: Colors.textPrimary,
    },
    subtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    formSection: {
        flex: 1,
    },
    label: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    roleRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    roleOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    roleSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryDim,
    },
    roleIcon: {
        fontSize: 20,
    },
    roleText: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    roleTextSelected: {
        color: Colors.primary,
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
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.xxl,
        marginBottom: Spacing.huge,
    },
    loginText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    loginLink: {
        fontFamily: FontFamily.bodySemiBold,
        fontSize: FontSize.md,
        color: Colors.primary,
    },
});
