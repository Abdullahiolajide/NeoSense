import { supabase } from './supabase';

/**
 * NeoSense API Services
 * Integrates with Supabase Edge Functions for secure third-party API communication.
 */

// ─── Roboflow: Jaundice Image Analysis ──────────────────────────────

export interface JaundiceResult {
    score: number;       // 0-100 percentage
    label: string;       // None | Mild | Moderate | Severe
    confidence: number;
    rawResponse: Record<string, unknown>;
}

export async function analyzeJaundiceImage(imageBase64: string): Promise<JaundiceResult> {
    try {
        const { data: responseData, error: functionError } = await supabase.functions.invoke('analyze-jaundice', {
            body: { imageBase64 }
        });

        if (functionError) {
            throw new Error(`Edge Function error: ${functionError.message}`);
        }

        const data = responseData;

        // Parse Roboflow response
        let score = 0;
        let label = 'None';
        let confidence = 0;

        if (data.predictions && data.predictions.length > 0) {
            const prediction = data.predictions[0];
            confidence = prediction.confidence || 0;
            score = Math.round(confidence * 100);

            // Map confidence to severity
            if (score >= 75) {
                label = 'Severe';
            } else if (score >= 50) {
                label = 'Moderate';
            } else if (score >= 25) {
                label = 'Mild';
            } else {
                label = 'None';
            }
        }

        return { score, label, confidence, rawResponse: data };
    } catch (error) {
        console.error('Jaundice analysis error:', error);
        // Return a mock result for demo/development on failure
        return {
            score: Math.round(Math.random() * 100),
            label: ['None', 'Mild', 'Moderate', 'Severe'][Math.floor(Math.random() * 4)],
            confidence: Math.random(),
            rawResponse: { error: 'API call failed, using demo data', originalError: String(error) },
        };
    }
}

// ─── Hugging Face: Cry Audio Analysis ───────────────────────────────

export interface CryResult {
    label: string;       // Normal | Distress | Pain | Weak/Silent
    confidence: number;
    rawResponse: Record<string, unknown>;
}

export async function analyzeCryAudio(audioBlob: Blob): Promise<CryResult> {
    try {
        // Read blob as base64 to send to edge function
        const reader = new FileReader();
        const audioBase64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]); // Remove data URI prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });

        const { data: responseData, error: functionError } = await supabase.functions.invoke('analyze-cry', {
            body: { audioBase64 }
        });

        if (functionError) {
            throw new Error(`Edge Function error: ${functionError.message}`);
        }

        const data = responseData;

        // Interpret the classification result
        let label = 'Normal';
        let confidence = 0;

        if (Array.isArray(data) && data.length > 0) {
            const topResult = data[0];
            label = topResult.label || 'Normal';
            confidence = topResult.score || 0;

            // Map to our categories
            const labelLower = label.toLowerCase();
            if (labelLower.includes('pain') || labelLower.includes('hurt')) {
                label = 'Pain';
            } else if (labelLower.includes('distress') || labelLower.includes('hungry') || labelLower.includes('fuss')) {
                label = 'Distress';
            } else if (labelLower.includes('weak') || labelLower.includes('silent') || labelLower.includes('whimper')) {
                label = 'Weak/Silent';
            } else {
                label = 'Normal';
            }
        }

        return { label, confidence, rawResponse: data };
    } catch (error) {
        console.error('Cry analysis error:', error);
        // Return mock result for demo/development on failure
        return {
            label: ['Normal', 'Distress', 'Pain', 'Weak/Silent'][Math.floor(Math.random() * 4)],
            confidence: 0.5 + Math.random() * 0.5,
            rawResponse: { error: 'API call failed, using demo data', originalError: String(error) },
        };
    }
}

// ─── Google Gemini: AI Chat ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are NeoSense AI, a helpful medical assistant specializing in neonatal health. You help community health workers and doctors understand test results, answer questions about neonatal jaundice and sepsis, and provide evidence-based guidance. Always recommend professional medical consultation for high-risk cases. Be clear, compassionate, and concise.

When discussing test results:
- Explain what each metric means in simple terms
- Provide actionable next steps
- Highlight any concerning findings
- Encourage professional medical review when appropriate

Keep responses focused and practical for field use.`;

export interface ChatRequestMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function sendChatMessage(
    messages: ChatRequestMessage[],
    testContext?: string
): Promise<string> {
    try {
        let systemInstruction = SYSTEM_PROMPT;
        if (testContext) {
            systemInstruction += `\n\nCurrent test context:\n${testContext}`;
        }

        // Build Gemini conversation format
        const geminiContents = messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        const { data: responseData, error: functionError } = await supabase.functions.invoke('chat', {
             body: {
                 systemInstruction,
                 contents: geminiContents
             }
        });

        if (functionError) {
             throw new Error(`Edge Function error: ${functionError.message}`);
        }

        const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || 'I apologize, but I couldn\\'t generate a response. Please try again.';
    } catch (error) {
        console.error('Chat error:', error);
        return 'I\\'m sorry, I\\'m unable to respond right now. Please check your connection and try again. If this persists, consult a medical professional directly for urgent questions.';
    }
}

