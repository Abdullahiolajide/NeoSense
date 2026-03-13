/**
 * PulseWave — Signature concentric circle pulse animation
 * Used on dashboard hero and during scanning
 */
import { Colors } from '@/constants/Theme';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

interface PulseWaveProps {
    size?: number;
    color?: string;
    rings?: number;
    speed?: number;
}

export function PulseWave({
    size = 200,
    color = Colors.primary,
    rings = 4,
    speed = 2000,
}: PulseWaveProps) {
    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {Array.from({ length: rings }).map((_, i) => (
                <PulseRing
                    key={i}
                    size={size}
                    color={color}
                    delay={(speed / rings) * i}
                    duration={speed}
                />
            ))}
            {/* Center dot */}
            <View
                style={[
                    styles.centerDot,
                    {
                        width: size * 0.12,
                        height: size * 0.12,
                        borderRadius: size * 0.06,
                        backgroundColor: color,
                    },
                ]}
            />
        </View>
    );
}

function PulseRing({
    size,
    color,
    delay,
    duration,
}: {
    size: number;
    color: string;
    delay: number;
    duration: number;
}) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            delay,
            withRepeat(
                withTiming(1, { duration, easing: Easing.out(Easing.ease) }),
                -1,
                false
            )
        );
    }, [delay, duration, progress]);

    const animatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(progress.value, [0, 1], [0.2, 1]);
        const opacity = interpolate(progress.value, [0, 0.5, 1], [0.6, 0.3, 0]);

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <Animated.View
            style={[
                styles.ring,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: color,
                },
                animatedStyle,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        borderWidth: 1.5,
    },
    centerDot: {
        position: 'absolute',
    },
});
