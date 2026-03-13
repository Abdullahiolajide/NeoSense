/**
 * NeoInput — Styled text input component
 */
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface NeoInputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    icon?: React.ReactNode;
}

export function NeoInput({
    label,
    error,
    containerStyle,
    icon,
    ...props
}: NeoInputProps) {
    const [focused, setFocused] = useState(false);
    const borderOpacity = useSharedValue(0);

    const animatedBorder = useAnimatedStyle(() => ({
        borderColor: `rgba(0, 229, 255, ${borderOpacity.value})`,
    }));

    const handleFocus = useCallback(
        (e: any) => {
            setFocused(true);
            borderOpacity.value = withTiming(0.5, { duration: 200 });
            props.onFocus?.(e);
        },
        [borderOpacity, props]
    );

    const handleBlur = useCallback(
        (e: any) => {
            setFocused(false);
            borderOpacity.value = withTiming(0, { duration: 200 });
            props.onBlur?.(e);
        },
        [borderOpacity, props]
    );

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <Animated.View style={[styles.inputContainer, animatedBorder, error ? styles.errorBorder : undefined]}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <TextInput
                    {...props}
                    style={[styles.input, icon ? styles.inputWithIcon : undefined, props.style]}
                    placeholderTextColor={Colors.textMuted}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </Animated.View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    iconContainer: {
        paddingLeft: Spacing.lg,
    },
    input: {
        flex: 1,
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        padding: Spacing.lg,
    },
    inputWithIcon: {
        paddingLeft: Spacing.sm,
    },
    errorBorder: {
        borderColor: Colors.error,
    },
    errorText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.error,
        marginTop: Spacing.xs,
    },
});
