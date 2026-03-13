import { RiskBadge } from '@/components/Badges';
import { GlassCard } from '@/components/GlassCard';
import { NeoButton } from '@/components/NeoButton';
import { NeoInput } from '@/components/NeoInput';
import { RiskMeter } from '@/components/RiskMeter';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import type {
    ActivityLevel,
    FeedingStatus,
    RiskFusionResult,
    TestWithAnalyses
} from '@/constants/Types';
import { analyzeCryAudio, analyzeJaundiceImage } from '@/lib/api';
import {
    computeLocalRiskFusion,
    createAnalysis,
    fuseRiskRemote,
    getTestById,
    updateTestRisk,
    uploadFile,
    upsertVitals,
} from '@/lib/database';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TestDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [test, setTest] = useState<TestWithAnalyses | null>(null);
    const [loading, setLoading] = useState(true);
    const [riskResult, setRiskResult] = useState<RiskFusionResult | null>(null);

    // Camera state
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // Audio state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [analyzingAudio, setAnalyzingAudio] = useState(false);
    const recordingTimer = useRef<NodeJS.Timeout | null>(null);

    // Vitals state
    const [showVitals, setShowVitals] = useState(false);
    const [temperature, setTemperature] = useState('');
    const [feedingStatus, setFeedingStatus] = useState<FeedingStatus | null>(null);
    const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
    const [savingVitals, setSavingVitals] = useState(false);

    // Load test data
    const loadTest = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getTestById(id);
            setTest(data);

            // Load existing vitals
            if (data.vitals) {
                setTemperature(data.vitals.temperature?.toString() || '');
                setFeedingStatus(data.vitals.feeding_status);
                setActivityLevel(data.vitals.activity_level);
            }

            // Compute risk from existing analyses
            computeRisk(data);
        } catch (err) {
            console.error('Load test error:', err);
            Alert.alert('Error', 'Failed to load test data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadTest();
    }, [loadTest]);

    // Get latest analysis of each type
    const latestJaundice = test?.analyses.find((a) => a.type === 'jaundice');
    const latestCry = test?.analyses.find((a) => a.type === 'cry');

    // Compute risk
    const computeRisk = useCallback(
        async (testData: TestWithAnalyses) => {
            const jaundiceAnalysis = testData.analyses.find((a) => a.type === 'jaundice');
            const cryAnalysis = testData.analyses.find((a) => a.type === 'cry');

            if (!jaundiceAnalysis && !cryAnalysis) return;

            const input = {
                jaundice_score: jaundiceAnalysis?.score,
                jaundice_label: jaundiceAnalysis?.label as any,
                cry_label: cryAnalysis?.label as any,
                temperature: testData.vitals?.temperature,
                feeding_status: testData.vitals?.feeding_status as any,
                activity_level: testData.vitals?.activity_level as any,
            };

            try {
                const result = await fuseRiskRemote(input);
                setRiskResult(result);
                await updateTestRisk(testData.id, result.risk_level);
            } catch {
                const result = computeLocalRiskFusion(input);
                setRiskResult(result);
            }
        },
        []
    );

    // ─── Camera / Jaundice ─────────────────────────────────────────────

    const handleCaptureImage = useCallback(async () => {
        if (!cameraRef.current) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true,
            });

            if (photo) {
                setCapturedImage(photo.uri);
                setShowCamera(false);
                setAnalyzingImage(true);

                // Analyze with Roboflow
                const result = await analyzeJaundiceImage(photo.base64 || '');

                // Upload to Supabase storage
                let fileUrl: string | null = null;
                try {
                    const fileBlob = await fetch(photo.uri).then((r) => r.blob());
                    fileUrl = await uploadFile(
                        'test-images',
                        `${id}/jaundice-${Date.now()}.jpg`,
                        fileBlob,
                        'image/jpeg'
                    );
                } catch {
                    // Upload failure OK — we have the analysis
                }

                // Save analysis
                const analysis = await createAnalysis(
                    id!,
                    'jaundice',
                    fileUrl,
                    result.rawResponse,
                    result.score,
                    result.label
                );

                // Refresh test data
                await loadTest();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            console.error('Image capture error:', err);
            Alert.alert('Error', 'Failed to capture and analyze image');
        } finally {
            setAnalyzingImage(false);
        }
    }, [id, loadTest]);

    const openCamera = useCallback(async () => {
        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                Alert.alert('Permission Required', 'Camera permission is needed for jaundice scanning.');
                return;
            }
        }
        setShowCamera(true);
    }, [cameraPermission, requestCameraPermission]);

    // ─── Audio / Cry Analysis ─────────────────────────────────────────

    const startRecording = useCallback(async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission Required', 'Microphone permission is needed for cry analysis.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(rec);
            setIsRecording(true);
            setRecordingDuration(0);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Timer for duration display and auto-stop at 10s
            recordingTimer.current = setInterval(() => {
                setRecordingDuration((prev) => {
                    if (prev >= 10) {
                        stopRecording();
                        return 10;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error('Recording start error:', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (!recording) return;

        if (recordingTimer.current) {
            clearInterval(recordingTimer.current);
            recordingTimer.current = null;
        }

        setIsRecording(false);
        setAnalyzingAudio(true);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                // Analyze with Hugging Face
                const fileBlob = await fetch(uri).then((r) => r.blob());
                const result = await analyzeCryAudio(fileBlob);

                // Upload to Supabase storage
                let fileUrl: string | null = null;
                try {
                    fileUrl = await uploadFile(
                        'test-audio',
                        `${id}/cry-${Date.now()}.wav`,
                        fileBlob,
                        'audio/wav'
                    );
                } catch {
                    // Upload failure OK
                }

                // Save analysis
                await createAnalysis(
                    id!,
                    'cry',
                    fileUrl,
                    result.rawResponse,
                    Math.round(result.confidence * 100),
                    result.label
                );

                await loadTest();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            console.error('Recording stop error:', err);
            Alert.alert('Error', 'Failed to analyze cry audio');
        } finally {
            setAnalyzingAudio(false);
        }
    }, [recording, id, loadTest]);

    // ─── Vitals ────────────────────────────────────────────────────────

    const handleSaveVitals = useCallback(async () => {
        if (!id) return;
        setSavingVitals(true);
        try {
            await upsertVitals(id, {
                temperature: temperature ? parseFloat(temperature) : null,
                feeding_status: feedingStatus,
                activity_level: activityLevel,
            } as any);

            // Recompute risk
            await loadTest();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', 'Failed to save vitals');
        } finally {
            setSavingVitals(false);
        }
    }, [id, temperature, feedingStatus, activityLevel, loadTest]);

    // ─── Render Helpers ────────────────────────────────────────────────

    const getSeverityColor = (label: string | null) => {
        switch (label) {
            case 'Severe':
            case 'Pain':
            case 'Weak/Silent':
                return Colors.riskHigh;
            case 'Moderate':
            case 'Distress':
                return Colors.riskModerate;
            case 'Mild':
            case 'Normal':
                return Colors.riskLow;
            default:
                return Colors.textMuted;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.content}>
                    <SkeletonCard style={{ marginBottom: Spacing.md }} />
                    <SkeletonCard style={{ marginBottom: Spacing.md }} />
                    <SkeletonCard />
                </View>
            </View>
        );
    }

    // Full screen camera
    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                >
                    <View style={styles.cameraOverlay}>
                        <View style={styles.cameraGuide}>
                            <Text style={styles.cameraGuideText}>
                                Position the baby's face/skin in frame
                            </Text>
                        </View>
                        <View style={styles.cameraButtons}>
                            <Pressable
                                style={styles.cameraCancelBtn}
                                onPress={() => setShowCamera(false)}
                            >
                                <Text style={styles.cameraCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.captureBtn} onPress={handleCaptureImage}>
                                <View style={styles.captureBtnInner} />
                            </Pressable>
                            <View style={{ width: 60 }} />
                        </View>
                    </View>
                </CameraView>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </Pressable>
            </View>

            <Animated.View entering={FadeInDown.duration(500)}>
                <View style={styles.titleRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.testTitle}>{test?.name}</Text>
                        <Text style={styles.testDate}>
                            {test?.created_at
                                ? new Date(test.created_at).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                })
                                : ''}
                        </Text>
                    </View>
                    <RiskBadge risk={test?.overall_risk || 'pending'} />
                </View>
            </Animated.View>

            {/* ─── Risk Fusion Section ─────────────────────────────────── */}
            {riskResult && (
                <Animated.View entering={FadeInDown.duration(600).delay(100)}>
                    <GlassCard
                        variant={
                            riskResult.risk_level === 'high'
                                ? 'risk-high'
                                : riskResult.risk_level === 'moderate'
                                    ? 'risk-moderate'
                                    : 'risk-low'
                        }
                        style={styles.riskSection}
                    >
                        <Text style={styles.sectionTitle}>Risk Assessment</Text>
                        <View style={styles.riskMeterContainer}>
                            <RiskMeter
                                score={riskResult.score}
                                riskLevel={riskResult.risk_level}
                                size={220}
                            />
                        </View>
                        <Text style={styles.recommendation}>{riskResult.recommended_action}</Text>
                    </GlassCard>
                </Animated.View>
            )}

            {/* ─── Jaundice Card ───────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(600).delay(200)}>
                <GlassCard style={styles.analysisCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardEmoji}>📷</Text>
                        <View>
                            <Text style={styles.cardTitle}>Jaundice Scan</Text>
                            <Text style={styles.cardSubtitle}>Camera-based skin analysis</Text>
                        </View>
                    </View>

                    {analyzingImage ? (
                        <View style={styles.analyzeState}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.analyzeText}>Analyzing image...</Text>
                        </View>
                    ) : latestJaundice ? (
                        <View>
                            {/* Result */}
                            <View style={styles.resultRow}>
                                <View>
                                    <Text style={styles.resultLabel}>Severity</Text>
                                    <Text
                                        style={[
                                            styles.resultValue,
                                            { color: getSeverityColor(latestJaundice.label) },
                                        ]}
                                    >
                                        {latestJaundice.label}
                                    </Text>
                                </View>
                                <View style={styles.scoreCircle}>
                                    <Text style={styles.scoreValue}>{Math.round(latestJaundice.score || 0)}%</Text>
                                    <Text style={styles.scoreLabel}>Score</Text>
                                </View>
                            </View>

                            {/* Progress bar */}
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${latestJaundice.score || 0}%`,
                                            backgroundColor: getSeverityColor(latestJaundice.label),
                                        },
                                    ]}
                                />
                            </View>

                            {capturedImage && (
                                <Image source={{ uri: capturedImage }} style={styles.thumbnail} />
                            )}

                            <NeoButton
                                title="Retake Scan"
                                onPress={openCamera}
                                variant="outline"
                                size="sm"
                                style={{ marginTop: Spacing.md }}
                            />
                        </View>
                    ) : (
                        <NeoButton
                            title="Capture Image"
                            onPress={openCamera}
                            fullWidth
                            style={{ marginTop: Spacing.md }}
                        />
                    )}
                </GlassCard>
            </Animated.View>

            {/* ─── Cry Analysis Card ───────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(600).delay(300)}>
                <GlassCard style={styles.analysisCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardEmoji}>🎙️</Text>
                        <View>
                            <Text style={styles.cardTitle}>Cry Analysis</Text>
                            <Text style={styles.cardSubtitle}>Audio classification</Text>
                        </View>
                    </View>

                    {analyzingAudio ? (
                        <View style={styles.analyzeState}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.analyzeText}>Analyzing audio...</Text>
                        </View>
                    ) : isRecording ? (
                        <View style={styles.recordingState}>
                            <Animated.View style={styles.recordingPulse}>
                                <View style={styles.recordingDot} />
                            </Animated.View>
                            <Text style={styles.recordingTime}>{recordingDuration}s / 10s</Text>
                            <Text style={styles.recordingLabel}>Recording...</Text>
                            <View style={styles.waveform}>
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.waveBar,
                                            {
                                                height: 8 + Math.random() * 32,
                                                backgroundColor:
                                                    recordingDuration > 0
                                                        ? Colors.primary
                                                        : Colors.textMuted,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                            <NeoButton
                                title="Stop Recording"
                                onPress={stopRecording}
                                variant="danger"
                                fullWidth
                                style={{ marginTop: Spacing.lg }}
                            />
                        </View>
                    ) : latestCry ? (
                        <View>
                            <View style={styles.resultRow}>
                                <View>
                                    <Text style={styles.resultLabel}>Classification</Text>
                                    <Text
                                        style={[
                                            styles.resultValue,
                                            { color: getSeverityColor(latestCry.label) },
                                        ]}
                                    >
                                        {latestCry.label}
                                    </Text>
                                </View>
                                <View style={styles.scoreCircle}>
                                    <Text style={styles.scoreValue}>{Math.round(latestCry.score || 0)}%</Text>
                                    <Text style={styles.scoreLabel}>Confidence</Text>
                                </View>
                            </View>

                            <NeoButton
                                title="Record Again"
                                onPress={startRecording}
                                variant="outline"
                                size="sm"
                                style={{ marginTop: Spacing.md }}
                            />
                        </View>
                    ) : (
                        <NeoButton
                            title="Record Cry (10s max)"
                            onPress={startRecording}
                            fullWidth
                            style={{ marginTop: Spacing.md }}
                        />
                    )}
                </GlassCard>
            </Animated.View>

            {/* ─── Manual Vitals ───────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.duration(600).delay(400)}>
                <Pressable onPress={() => setShowVitals(!showVitals)}>
                    <GlassCard style={styles.vitalsCard}>
                        <View style={styles.vitalsHeader}>
                            <View>
                                <Text style={styles.cardTitle}>Manual Vitals</Text>
                                <Text style={styles.cardSubtitle}>Optional — improves accuracy</Text>
                            </View>
                            <Text style={styles.chevron}>{showVitals ? '▲' : '▼'}</Text>
                        </View>
                    </GlassCard>
                </Pressable>

                {showVitals && (
                    <Animated.View entering={FadeInDown.duration(300)}>
                        <GlassCard style={styles.vitalsForm}>
                            <NeoInput
                                label="Temperature (°C)"
                                placeholder="e.g., 37.5"
                                value={temperature}
                                onChangeText={setTemperature}
                                keyboardType="decimal-pad"
                            />

                            <Text style={styles.vitalsLabel}>Feeding Status</Text>
                            <View style={styles.optionRow}>
                                {(['Normal', 'Poor', 'Not feeding'] as FeedingStatus[]).map((opt) => (
                                    <Pressable
                                        key={opt}
                                        style={[
                                            styles.optionChip,
                                            feedingStatus === opt && styles.optionSelected,
                                        ]}
                                        onPress={() => setFeedingStatus(opt)}
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                feedingStatus === opt && styles.optionTextSelected,
                                            ]}
                                        >
                                            {opt}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={styles.vitalsLabel}>Activity Level</Text>
                            <View style={styles.optionRow}>
                                {(['Active', 'Weak', 'Unresponsive'] as ActivityLevel[]).map((opt) => (
                                    <Pressable
                                        key={opt}
                                        style={[
                                            styles.optionChip,
                                            activityLevel === opt && styles.optionSelected,
                                        ]}
                                        onPress={() => setActivityLevel(opt)}
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                activityLevel === opt && styles.optionTextSelected,
                                            ]}
                                        >
                                            {opt}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <NeoButton
                                title="Save Vitals & Recompute Risk"
                                onPress={handleSaveVitals}
                                loading={savingVitals}
                                fullWidth
                                style={{ marginTop: Spacing.lg }}
                            />
                        </GlassCard>
                    </Animated.View>
                )}
            </Animated.View>

            {/* ─── Analysis History ────────────────────────────────────── */}
            {test && test.analyses.length > 0 && (
                <Animated.View entering={FadeInDown.duration(600).delay(500)}>
                    <Text style={styles.historyTitle}>Analysis History</Text>
                    {test.analyses.map((a, index) => (
                        <View key={a.id} style={styles.historyItem}>
                            <Text style={styles.historyIcon}>
                                {a.type === 'jaundice' ? '📷' : '🎙️'}
                            </Text>
                            <View style={styles.historyContent}>
                                <Text style={styles.historyLabel}>
                                    {a.type === 'jaundice' ? 'Jaundice Scan' : 'Cry Analysis'}
                                </Text>
                                <Text style={styles.historyResult}>
                                    {a.label} — {Math.round(a.score || 0)}%
                                </Text>
                            </View>
                            <Text style={styles.historyDate}>
                                {new Date(a.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </View>
                    ))}
                </Animated.View>
            )}
        </ScrollView>
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
        marginBottom: Spacing.md,
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
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.xxl,
    },
    testTitle: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
    },
    testDate: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        marginTop: 4,
    },

    // Risk Section
    riskSection: {
        marginBottom: Spacing.xl,
        alignItems: 'center',
    },
    riskMeterContainer: {
        marginVertical: Spacing.lg,
    },
    recommendation: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Analysis Cards
    analysisCard: {
        marginBottom: Spacing.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    cardEmoji: {
        fontSize: 32,
    },
    cardTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
    },
    cardSubtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textMuted,
    },
    sectionTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },

    // Analyze State
    analyzeState: {
        alignItems: 'center',
        padding: Spacing.xxl,
        gap: Spacing.md,
    },
    analyzeText: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },

    // Results
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    resultLabel: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    resultValue: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xl,
        marginTop: 2,
    },
    scoreCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.border,
    },
    scoreValue: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.lg,
        color: Colors.primary,
    },
    scoreLabel: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.surfaceLight,
        borderRadius: 3,
        marginTop: Spacing.lg,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    thumbnail: {
        width: '100%',
        height: 150,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.md,
        backgroundColor: Colors.surfaceLight,
    },

    // Recording
    recordingState: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    recordingPulse: {
        marginBottom: Spacing.md,
    },
    recordingDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.error,
    },
    recordingTime: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
    },
    recordingLabel: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.error,
        marginTop: Spacing.xs,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: Spacing.xl,
        height: 40,
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5,
    },

    // Camera
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'space-between',
        padding: Spacing.xxl,
        paddingBottom: 60,
    },
    cameraGuide: {
        marginTop: 80,
        alignItems: 'center',
    },
    cameraGuideText: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.md,
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.round,
        overflow: 'hidden',
    },
    cameraButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cameraCancelBtn: {
        width: 60,
    },
    cameraCancelText: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.md,
        color: 'white',
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'white',
    },

    // Vitals
    vitalsCard: {
        marginBottom: 2,
    },
    vitalsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chevron: {
        fontSize: 14,
        color: Colors.textMuted,
    },
    vitalsForm: {
        marginTop: 2,
        marginBottom: Spacing.lg,
    },
    vitalsLabel: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.sm,
    },
    optionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    optionChip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.surfaceLight,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    optionSelected: {
        backgroundColor: Colors.primaryDim,
        borderColor: Colors.primary,
    },
    optionText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    optionTextSelected: {
        color: Colors.primary,
        fontFamily: FontFamily.bodySemiBold,
    },

    // History
    historyTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
        marginTop: Spacing.xxl,
        marginBottom: Spacing.lg,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    historyIcon: {
        fontSize: 20,
    },
    historyContent: {
        flex: 1,
    },
    historyLabel: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
    },
    historyResult: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    historyDate: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
});
