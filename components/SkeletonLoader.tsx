/**
 * SkeletonLoader — Animated placeholder while content loads
 */
import { BorderRadius, Colors } from '@/constants/Theme';
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function SkeletonLoader({
    width = '100%',
    height = 20,
    borderRadius = BorderRadius.sm,
    style,
}: SkeletonProps) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
    }, [shimmer]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
    }));

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width: width as any, height, borderRadius },
                animatedStyle,
                style,
            ]}
        />
    );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
    return (
        <View style={[styles.card, style]}>
            <SkeletonLoader width="60%" height={16} />
            <SkeletonLoader width="40%" height={12} style={{ marginTop: 8 }} />
            <SkeletonLoader width="80%" height={12} style={{ marginTop: 8 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: Colors.surfaceLight,
    },
    card: {
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 20,
        gap: 4,
    },
});
