/**
 * NeoSense API Services
 * Integrates with Roboflow (jaundice), Hugging Face (cry analysis), and Claude (chat)
 */

// ─── Roboflow: Jaundice Image Analysis ──────────────────────────────

const ROBOFLOW_API_KEY = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY || '';

export interface JaundiceResult {
    score: number;       // 0-100 percentage
    label: string;       // None | Mild | Moderate | Severe
    confidence: number;
    rawResponse: Record<string, unknown>;
}

export async function analyzeJaundiceImage(imageBase64: string): Promise<JaundiceResult> {
    try {
        const response = await fetch(
            `https://serverless.roboflow.com/newborn-jaundice-detection/2?api_key=${ROBOFLOW_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: imageBase64,
            }
        );

        if (!response.ok) {
            throw new Error(`Roboflow API error: ${response.status}`);
        }

        const data = await response.json();

        // Parse Roboflow response — adapt based on your model's output format
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
        // Return a mock result for demo/development
        return {
            score: Math.round(Math.random() * 100),
            label: ['None', 'Mild', 'Moderate', 'Severe'][Math.floor(Math.random() * 4)],
            confidence: Math.random(),
            rawResponse: { error: 'API call failed, using demo data', originalError: String(error) },
        };
    }
}

// ─── Hugging Face: Cry Audio Analysis ───────────────────────────────

const HF_API_KEY = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY || '';

export interface CryResult {
    label: string;       // Normal | Distress | Pain | Weak/Silent
    confidence: number;
    rawResponse: Record<string, unknown>;
}

export async function analyzeCryAudio(audioBlob: Blob): Promise<CryResult> {
    try {
        const response = await fetch(
            'https://api-inference.huggingface.co/models/facebook/wav2vec2-large-960h',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'audio/wav',
                },
                body: audioBlob,
            }
        );

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status}`);
        }

        const data = await response.json();

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
        // Return mock result for demo/development
        return {
            label: ['Normal', 'Distress', 'Pain', 'Weak/Silent'][Math.floor(Math.random() * 4)],
            confidence: 0.5 + Math.random() * 0.5,
            rawResponse: { error: 'API call failed, using demo data', originalError: String(error) },
        };
    }
}

// ─── Google Gemini: AI Chat ─────────────────────────────────────────

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

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

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: systemInstruction }],
                    },
                    contents: geminiContents,
                    generationConfig: {
                        maxOutputTokens: 1024,
                        temperature: 0.7,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error: ${response.status} — ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error) {
        console.error('Chat error:', error);
        return 'I\'m sorry, I\'m unable to respond right now. Please check your connection and try again. If this persists, consult a medical professional directly for urgent questions.';
    }
}

