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
import { Feather } from '@expo/vector-icons';
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
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type WizardStep = 'selection' | 'jaundice' | 'cry' | 'vitals' | 'analyzing' | 'report';

export default function TestDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [test, setTest] = useState<TestWithAnalyses | null>(null);
    const [loading, setLoading] = useState(true);
    const [riskResult, setRiskResult] = useState<RiskFusionResult | null>(null);

    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>('selection');
    const [selectedModels, setSelectedModels] = useState({
        jaundice: false,
        cry: false,
        vitals: false,
    });

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
    const [temperature, setTemperature] = useState('');
    const [feedingStatus, setFeedingStatus] = useState<FeedingStatus | null>(null);
    const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
    const [savingVitals, setSavingVitals] = useState(false);

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

            // If test already has results and we haven't started wizard yet, skip to report
            if (data.analyses.length > 0 && currentStep === 'selection') {
                setCurrentStep('report');
            }
        } catch (err) {
            console.error('Load test error:', err);
            Alert.alert('Error', 'Failed to load test data');
        } finally {
            setLoading(false);
        }
    }, [id, computeRisk, currentStep]);

    useEffect(() => {
        loadTest();
    }, [loadTest]);

    // Get latest analysis of each type
    const latestJaundice = test?.analyses.find((a) => a.type === 'jaundice');
    const latestCry = test?.analyses.find((a) => a.type === 'cry');

    // Navigation and Step Handling
    const getNextStep = (current: WizardStep): WizardStep => {
        if (current === 'selection') {
            if (selectedModels.jaundice) return 'jaundice';
            if (selectedModels.cry) return 'cry';
            if (selectedModels.vitals) return 'vitals';
            return 'analyzing';
        }
        if (current === 'jaundice') {
            if (selectedModels.cry) return 'cry';
            if (selectedModels.vitals) return 'vitals';
            return 'analyzing';
        }
        if (current === 'cry') {
            if (selectedModels.vitals) return 'vitals';
            return 'analyzing';
        }
        if (current === 'vitals') return 'analyzing';
        if (current === 'analyzing') return 'report';
        return 'report';
    };

    const handleNext = () => {
        const next = getNextStep(currentStep);
        if (next === 'analyzing') {
            startAnalysisFlow();
        } else {
            setCurrentStep(next);
        }
    };

    const startAnalysisFlow = async () => {
        pulse.value = withRepeat(withTiming(1.5, { duration: 1000 }), -1, true);
        setCurrentStep('analyzing');
        // Wait for a "cool" duration to show animations
        setTimeout(() => {
            setCurrentStep('report');
        }, 3000);
    };

    const pulse = useSharedValue(1);
    const dot1Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    const dot2Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    const dot3Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

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

    // ─── Step Renders ──────────────────────────────────────────────────

    const renderSelection = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>← Cancel</Text>
                </Pressable>
            </View>

            <Text style={styles.wizardTitle}>Select Analyses</Text>
            <Text style={styles.wizardSubtitle}>
                Choose which screening models you would like to run for {test?.name}.
            </Text>

            <View style={styles.selectionGrid}>
                {[
                    { id: 'jaundice', name: 'Jaundice Scan', icon: 'camera', desc: 'Camera-based skin analysis' },
                    { id: 'cry', name: 'Cry Analysis', icon: 'mic', desc: 'Audio classification' },
                    { id: 'vitals', name: 'Manual Vitals', icon: 'activity', desc: 'Temperature & signs' }
                ].map((item) => {
                    const isSelected = selectedModels[item.id as keyof typeof selectedModels];
                    return (
                        <Pressable
                            key={item.id}
                            style={[styles.selectionCard, isSelected && styles.selectionCardActive]}
                            onPress={() => setSelectedModels(prev => ({ ...prev, [item.id]: !isSelected }))}
                        >
                            <Feather
                                name={item.icon as any}
                                size={32}
                                color={isSelected ? Colors.primary : Colors.textMuted}
                            />
                            <Text style={[styles.selectionTitle, isSelected && styles.selectionTitleActive]}>
                                {item.name}
                            </Text>
                            <Text style={styles.selectionDesc}>{item.desc}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <NeoButton
                title="Start Screening"
                onPress={handleNext}
                fullWidth
                size="lg"
                disabled={!selectedModels.jaundice && !selectedModels.cry && !selectedModels.vitals}
                style={{ marginTop: Spacing.huge }}
            />
        </Animated.View>
    );

    const renderJaundiceStep = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
            <Text style={styles.wizardTitle}>Jaundice Scan</Text>
            <Text style={styles.wizardSubtitle}>Capture a clear image of the baby's face or skin.</Text>

            <GlassCard style={styles.analysisCard}>
                <View style={styles.cardHeader}>
                    <Feather name="camera" size={32} color={Colors.primary} />
                    <View>
                        <Text style={styles.cardTitle}>Image Capture</Text>
                        <Text style={styles.cardSubtitle}>Position skin in frame</Text>
                    </View>
                </View>

                {analyzingImage ? (
                    <View style={styles.analyzeState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.analyzeText}>Processing image...</Text>
                    </View>
                ) : latestJaundice ? (
                    <View>
                        <View style={styles.resultRow}>
                            <View>
                                <Text style={styles.resultLabel}>Status</Text>
                                <Text style={styles.resultValueSuccess}>Captured</Text>
                            </View>
                            <Feather name="check-circle" size={40} color={Colors.riskLow} />
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
                        title="Open Camera"
                        onPress={openCamera}
                        fullWidth
                        style={{ marginTop: Spacing.md }}
                    />
                )}
            </GlassCard>

            <View style={styles.stepFooter}>
                <NeoButton
                    title="Next Step"
                    onPress={handleNext}
                    fullWidth
                    size="lg"
                    disabled={!latestJaundice}
                />
            </View>
        </Animated.View>
    );

    const renderCryStep = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
            <Text style={styles.wizardTitle}>Cry Analysis</Text>
            <Text style={styles.wizardSubtitle}>Record 10 seconds of the baby crying.</Text>

            <GlassCard style={styles.analysisCard}>
                <View style={styles.cardHeader}>
                    <Feather name="mic" size={32} color={Colors.primary} />
                    <View>
                        <Text style={styles.cardTitle}>Audio Recording</Text>
                        <Text style={styles.cardSubtitle}>Ensure quiet environment</Text>
                    </View>
                </View>

                {analyzingAudio ? (
                    <View style={styles.analyzeState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.analyzeText}>Analyzing cry pattern...</Text>
                    </View>
                ) : isRecording ? (
                    <View style={styles.recordingState}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingTime}>{recordingDuration}s / 10s</Text>
                        <Text style={styles.recordingLabel}>Recording...</Text>
                        <NeoButton
                            title="Stop"
                            onPress={stopRecording}
                            variant="danger"
                            size="sm"
                            style={{ marginTop: Spacing.md }}
                        />
                    </View>
                ) : latestCry ? (
                    <View>
                        <View style={styles.resultRow}>
                            <View>
                                <Text style={styles.resultLabel}>Status</Text>
                                <Text style={styles.resultValueSuccess}>Recorded</Text>
                            </View>
                            <Feather name="check-circle" size={40} color={Colors.riskLow} />
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
                        title="Start Recording"
                        onPress={startRecording}
                        fullWidth
                        style={{ marginTop: Spacing.md }}
                    />
                )}
            </GlassCard>

            <View style={styles.stepFooter}>
                <NeoButton
                    title="Next Step"
                    onPress={handleNext}
                    fullWidth
                    size="lg"
                    disabled={!latestCry}
                />
            </View>
        </Animated.View>
    );

    const renderVitalsStep = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
            <Text style={styles.wizardTitle}>Manual Vitals</Text>
            <Text style={styles.wizardSubtitle}>Enter basic vitals to improve assessment accuracy.</Text>

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
            </GlassCard>

            <View style={styles.stepFooter}>
                <NeoButton
                    title="Analyze Results"
                    onPress={async () => {
                        await handleSaveVitals();
                        handleNext();
                    }}
                    loading={savingVitals}
                    fullWidth
                    size="lg"
                />
            </View>
        </Animated.View>
    );

    const renderAnalyzing = () => (
        <View style={styles.analyzingContainer}>
            <Animated.View entering={FadeInDown.duration(1000)} style={styles.analyzingContent}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.analyzingTitle}>Fusing Data...</Text>
                <Text style={styles.analyzingSubtitle}>
                    AI models are converging to generate your risk report.
                </Text>

                <View style={styles.analyzingDots}>
                    <Animated.View style={[styles.analyzingDot, dot1Style]} />
                    <Animated.View style={[styles.analyzingDot, dot2Style, { opacity: 0.6 }]} />
                    <Animated.View style={[styles.analyzingDot, dot3Style, { opacity: 0.3 }]} />
                </View>
            </Animated.View>
        </View>
    );

    const renderReport = () => (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>← Dashboard</Text>
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
                        <Text style={styles.sectionTitle}>Final Assessment</Text>
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

            {/* Input Summary */}
            <Text style={styles.historyTitle}>Input Details</Text>
            {test?.analyses.map((a) => (
                <View key={a.id} style={styles.historyItem}>
                    <Feather
                        name={a.type === 'jaundice' ? 'camera' : 'mic'}
                        size={20}
                        color={Colors.textSecondary}
                    />
                    <View style={styles.historyContent}>
                        <Text style={styles.historyLabel}>
                            {a.type === 'jaundice' ? 'Jaundice Scan' : 'Cry Analysis'}
                        </Text>
                        <Text style={styles.historyResult}>
                            {a.label} — {Math.round(a.score || 0)}%
                        </Text>
                    </View>
                </View>
            ))}

            {test?.vitals && (
                <View style={styles.historyItem}>
                    <Feather name="activity" size={20} color={Colors.textSecondary} />
                    <View style={styles.historyContent}>
                        <Text style={styles.historyLabel}>Manual Vitals</Text>
                        <Text style={styles.historyResult}>
                            {test.vitals.temperature}°C • {test.vitals.feeding_status} • {test.vitals.activity_level}
                        </Text>
                    </View>
                </View>
            )}

            <NeoButton
                title="Talk to AI Specialist"
                onPress={() => router.push('/(tabs)/chat')}
                variant="primary"
                fullWidth
                size="lg"
                icon={<Feather name="message-square" size={20} color="white" />}
                style={{ marginTop: Spacing.huge }}
            />

            <NeoButton
                title="Done"
                onPress={() => router.replace('/')}
                variant="outline"
                fullWidth
                size="lg"
                style={{ marginTop: Spacing.md }}
            />
        </ScrollView>
    );

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

    const renderContent = () => {
        switch (currentStep) {
            case 'selection': return renderSelection();
            case 'jaundice': return renderJaundiceStep();
            case 'cry': return renderCryStep();
            case 'vitals': return renderVitalsStep();
            case 'analyzing': return renderAnalyzing();
            case 'report': return renderReport();
            default: return renderSelection();
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {renderContent()}
        </View>
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

    // Wizard Shared
    wizardTitle: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
        marginTop: Spacing.xl,
    },
    wizardSubtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
        marginBottom: Spacing.huge,
        lineHeight: 22,
    },
    stepFooter: {
        marginTop: Spacing.huge,
        paddingTop: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },

    // Selection Step
    selectionGrid: {
        gap: Spacing.lg,
    },
    selectionCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.xs,
    },
    selectionCardActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryDim,
    },
    selectionTitle: {
        fontFamily: FontFamily.heading,
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
        marginTop: Spacing.xs,
    },
    selectionTitleActive: {
        color: Colors.primary,
    },
    selectionDesc: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textMuted,
    },

    // Analyzing Step
    analyzingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    analyzingContent: {
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.huge,
    },
    analyzingTitle: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
        marginTop: Spacing.lg,
    },
    analyzingSubtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    analyzingDots: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
    },
    analyzingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
    },

    resultValueSuccess: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xl,
        color: Colors.riskLow,
        marginTop: 2,
    },
});
