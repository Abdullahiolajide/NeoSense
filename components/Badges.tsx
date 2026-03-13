/**
 * RoleBadge — Displays user role with appropriate styling
 */
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import type { UserRole } from '@/constants/Types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface RoleBadgeProps {
    role: UserRole;
    size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
    const isDoctor = role === 'doctor';
    const label = isDoctor ? 'Doctor' : 'Health Worker';
    const color = isDoctor ? Colors.secondary : Colors.mint;
    const bgColor = isDoctor ? Colors.secondaryDim : Colors.mintDim;

    return (
        <View style={[styles.badge, { backgroundColor: bgColor }, size === 'sm' && styles.badgeSm]}>
            <Text style={[styles.text, { color }, size === 'sm' && styles.textSm]}>
                {label}
            </Text>
        </View>
    );
}

/**
 * RiskBadge — Displays risk level with color coding
 */
interface RiskBadgeProps {
    risk: 'low' | 'moderate' | 'high' | 'pending';
    size?: 'sm' | 'md';
}

export function RiskBadge({ risk, size = 'md' }: RiskBadgeProps) {
    const config = {
        low: { label: 'Low Risk', color: Colors.riskLow, bg: Colors.riskLowDim },
        moderate: { label: 'Moderate', color: Colors.riskModerate, bg: Colors.riskModerateDim },
        high: { label: 'High Risk', color: Colors.riskHigh, bg: Colors.riskHighDim },
        pending: { label: 'Pending', color: Colors.textMuted, bg: Colors.surfaceLight },
    }[risk];

    return (
        <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={[styles.text, { color: config.color }, size === 'sm' && styles.textSm]}>
                {config.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.round,
        alignSelf: 'flex-start',
    },
    badgeSm: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: Spacing.xs,
    },
    text: {
        fontFamily: FontFamily.bodySemiBold,
        fontSize: FontSize.sm,
    },
    textSm: {
        fontSize: FontSize.xs,
    },
});
