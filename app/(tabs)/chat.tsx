import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { ChatRequestMessage, sendChatMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function ChatScreen() {
    const { user, profile } = useAuth();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const [messages, setMessages] = useState<DisplayMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hello${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋\n\nI'm NeoSense AI, your neonatal health assistant. I can help you:\n\n• Understand jaundice and sepsis test results\n• Answer questions about newborn care\n• Provide evidence-based guidance\n• Explain risk assessments\n\nHow can I help you today?`,
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || sending) return;

        const userMsg: DisplayMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputText('');
        setSending(true);

        // Build conversation history for Claude
        const conversationHistory: ChatRequestMessage[] = messages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content }));
        conversationHistory.push({ role: 'user', content: text });

        try {
            const response = await sendChatMessage(conversationHistory);

            const assistantMsg: DisplayMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMsg]);

            // Save to Supabase
            if (user?.id) {
                try {
                    await supabase.from('chat_messages').insert([
                        { user_id: user.id, role: 'user', content: text },
                        { user_id: user.id, role: 'assistant', content: response },
                    ]);
                } catch {
                    // Ignore save errors
                }
            }
        } catch {
            const errorMsg: DisplayMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, I couldn\'t process your request. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setSending(false);
        }
    }, [inputText, sending, messages, user?.id]);

    const renderMessage = useCallback(
        ({ item, index }: { item: DisplayMessage; index: number }) => {
            const isUser = item.role === 'user';
            return (
                <Animated.View
                    entering={FadeInUp.duration(300).delay(50)}
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                >
                    {!isUser && (
                        <View style={styles.aiLabel}>
                            <Text style={styles.aiLabelText}>🤖 NeoSense AI</Text>
                        </View>
                    )}
                    <Text
                        style={[
                            styles.messageText,
                            isUser ? styles.userText : styles.assistantText,
                        ]}
                    >
                        {item.content}
                    </Text>
                    <Text style={styles.timestamp}>
                        {item.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </Text>
                </Animated.View>
            );
        },
        []
    );

    // Quick suggestion chips
    const suggestions = [
        'What is neonatal jaundice?',
        'When to refer urgently?',
        'Normal cry vs distress cry',
        'Feeding assessment tips',
    ];

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>AI Assistant</Text>
                <Text style={styles.headerSubtitle}>Neonatal Health Expert</Text>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                }
                ListFooterComponent={
                    sending ? (
                        <View style={[styles.messageBubble, styles.assistantBubble]}>
                            <View style={styles.typingIndicator}>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.typingText}>NeoSense AI is thinking...</Text>
                            </View>
                        </View>
                    ) : messages.length <= 1 ? (
                        <View style={styles.suggestionsContainer}>
                            <Text style={styles.suggestionsTitle}>Try asking:</Text>
                            {suggestions.map((s) => (
                                <Pressable
                                    key={s}
                                    style={styles.suggestionChip}
                                    onPress={() => {
                                        setInputText(s);
                                    }}
                                >
                                    <Text style={styles.suggestionText}>{s}</Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null
                }
            />

            {/* Input Bar */}
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Ask about neonatal health..."
                    placeholderTextColor={Colors.textMuted}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={2000}
                    editable={!sending}
                />
                <Pressable
                    style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || sending}
                >
                    <Text style={styles.sendIcon}>↑</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        padding: Spacing.xxl,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontFamily: FontFamily.headingBold,
        fontSize: FontSize.xxl,
        color: Colors.textPrimary,
    },
    headerSubtitle: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    messagesList: {
        padding: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    aiLabel: {
        marginBottom: Spacing.sm,
    },
    aiLabelText: {
        fontFamily: FontFamily.bodySemiBold,
        fontSize: FontSize.xs,
        color: Colors.primary,
    },
    messageText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        lineHeight: 22,
    },
    userText: {
        color: Colors.textInverse,
    },
    assistantText: {
        color: Colors.textPrimary,
    },
    timestamp: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: Spacing.sm,
        alignSelf: 'flex-end',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    typingText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    suggestionsContainer: {
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    suggestionsTitle: {
        fontFamily: FontFamily.bodyMedium,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    suggestionChip: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        alignSelf: 'flex-start',
    },
    suggestionText: {
        fontFamily: FontFamily.body,
        fontSize: FontSize.sm,
        color: Colors.primary,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        fontFamily: FontFamily.body,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        backgroundColor: Colors.backgroundLight,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendDisabled: {
        opacity: 0.4,
    },
    sendIcon: {
        fontSize: 20,
        color: Colors.textInverse,
        fontWeight: 'bold',
    },
});
