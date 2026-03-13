/**
 * GlassCard — Glassmorphism card component used throughout the app
 */
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/Theme';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'highlight' | 'risk-low' | 'risk-moderate' | 'risk-high';
    noPadding?: boolean;
}

export function GlassCard({ children, style, variant = 'default', noPadding }: GlassCardProps) {
    const borderColor = {
        default: Colors.glassBorder,
        highlight: Colors.primary + '30',
        'risk-low': Colors.riskLow + '30',
        'risk-moderate': Colors.riskModerate + '30',
        'risk-high': Colors.riskHigh + '30',
    }[variant];

    return (
        <View
            style={[
                styles.card,
                { borderColor },
                !noPadding && styles.padding,
                Shadows.medium,
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
    },
    padding: {
        padding: Spacing.xl,
    },
});
