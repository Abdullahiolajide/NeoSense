/**
 * RiskMeter — Animated semicircle gauge for risk visualization
 */
import { Colors, FontFamily, FontSize } from '@/constants/Theme';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface RiskMeterProps {
    score: number; // 0-100
    riskLevel: 'low' | 'moderate' | 'high' | 'pending';
    size?: number;
}

export function RiskMeter({ score, riskLevel, size = 200 }: RiskMeterProps) {
    const animatedScore = useSharedValue(0);
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    // Arc from 180° to 0° (left to right semicircle)
    const startAngle = Math.PI;
    const endAngle = 0;

    useEffect(() => {
        animatedScore.value = withTiming(score / 100, {
            duration: 1500,
            easing: Easing.out(Easing.cubic),
        });
    }, [score, animatedScore]);

    // Background arc path
    const bgArcPath = describeArc(center, center + radius * 0.1, radius, startAngle, endAngle);

    const animatedProps = useAnimatedProps(() => {
        const angle = startAngle + (endAngle - startAngle) * animatedScore.value;
        const path = describeArc(center, center + radius * 0.1, radius, startAngle, angle);
        return { d: path };
    });

    const riskColor =
        riskLevel === 'high'
            ? Colors.riskHigh
            : riskLevel === 'moderate'
                ? Colors.riskModerate
                : riskLevel === 'pending'
                    ? Colors.textMuted
                    : Colors.riskLow;

    const riskText =
        riskLevel === 'high'
            ? 'HIGH RISK'
            : riskLevel === 'moderate'
                ? 'MODERATE'
                : riskLevel === 'pending'
                    ? 'PENDING'
                    : 'LOW RISK';

    return (
        <View style={[styles.container, { width: size, height: size * 0.65 }]}>
            <Svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
                <Defs>
                    <LinearGradient id="riskGradient" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={Colors.riskLow} />
                        <Stop offset="0.5" stopColor={Colors.riskModerate} />
                        <Stop offset="1" stopColor={Colors.riskHigh} />
                    </LinearGradient>
                </Defs>
                {/* Background arc */}
                <Path
                    d={bgArcPath}
                    stroke={Colors.surfaceLight}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                />
                {/* Animated foreground arc */}
                <AnimatedPath
                    animatedProps={animatedProps}
                    stroke={riskColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                />
            </Svg>
            {/* Score text */}
            <View style={styles.scoreContainer}>
                <Text style={[styles.scoreText, { color: riskColor }]}>{Math.round(score)}</Text>
                <Text style={[styles.riskLabel, { color: riskColor }]}>{riskText}</Text>
            </View>
        </View>
    );
}

function describeArc(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number
): string {
    'worklet';
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    const sweep = endAngle > startAngle ? 0 : 1;

    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    scoreContainer: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
    },
    scoreText: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxxl,
        lineHeight: FontSize.xxxl + 4,
    },
    riskLabel: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.sm,
        letterSpacing: 2,
        marginTop: 2,
    },
});
