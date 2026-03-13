/**
 * NeoButton — Premium animated button component
 */
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '@/constants/Theme';
import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface NeoButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    fullWidth?: boolean;
}

export function NeoButton({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    style,
    fullWidth = false,
}: NeoButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    }, [scale]);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }, [scale]);

    const handlePress = useCallback(() => {
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    }, [disabled, loading, onPress]);

    const variantStyles = getVariantStyles(variant);
    const sizeStyles = getSizeStyles(size);

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled || loading}
            style={[
                styles.button,
                variantStyles.button,
                sizeStyles.button,
                fullWidth && styles.fullWidth,
                (disabled || loading) && styles.disabled,
                variant === 'primary' && Shadows.glow,
                animatedStyle,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variantStyles.textColor}
                />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            { color: variantStyles.textColor },
                            sizeStyles.text,
                            icon ? { marginLeft: 8 } : undefined,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </AnimatedPressable>
    );
}

function getVariantStyles(variant: string) {
    switch (variant) {
        case 'primary':
            return {
                button: {
                    backgroundColor: Colors.primary,
                } as ViewStyle,
                textColor: Colors.textInverse,
            };
        case 'secondary':
            return {
                button: {
                    backgroundColor: Colors.secondary,
                } as ViewStyle,
                textColor: Colors.textPrimary,
            };
        case 'outline':
            return {
                button: {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: Colors.primary,
                } as ViewStyle,
                textColor: Colors.primary,
            };
        case 'danger':
            return {
                button: {
                    backgroundColor: Colors.error,
                } as ViewStyle,
                textColor: Colors.textPrimary,
            };
        case 'ghost':
            return {
                button: {
                    backgroundColor: 'transparent',
                } as ViewStyle,
                textColor: Colors.primary,
            };
        default:
            return {
                button: { backgroundColor: Colors.primary } as ViewStyle,
                textColor: Colors.textInverse,
            };
    }
}

function getSizeStyles(size: string) {
    switch (size) {
        case 'sm':
            return {
                button: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm } as ViewStyle,
                text: { fontSize: FontSize.sm } as any,
            };
        case 'lg':
            return {
                button: { paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl } as ViewStyle,
                text: { fontSize: FontSize.lg } as any,
            };
        default:
            return {
                button: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg } as ViewStyle,
                text: { fontSize: FontSize.md } as any,
            };
    }
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.lg,
    },
    text: {
        fontFamily: FontFamily.heading,
        textAlign: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.5,
    },
});
