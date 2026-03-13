/**
 * NeoSense Type Definitions
 */

export type UserRole = 'doctor' | 'health_worker';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'pending';
export type AnalysisType = 'jaundice' | 'cry';
export type JaundiceLabel = 'None' | 'Mild' | 'Moderate' | 'Severe';
export type CryLabel = 'Normal' | 'Distress' | 'Pain' | 'Weak/Silent';
export type FeedingStatus = 'Normal' | 'Poor' | 'Not feeding';
export type ActivityLevel = 'Active' | 'Weak' | 'Unresponsive';
export type ChatRole = 'user' | 'assistant';

export interface Profile {
    id: string;
    full_name: string;
    role: UserRole;
    institution: string | null;
    created_at: string;
}

export interface Test {
    id: string;
    user_id: string;
    name: string;
    notes: string | null;
    overall_risk: RiskLevel;
    created_at: string;
    updated_at: string;
}

export interface Analysis {
    id: string;
    test_id: string;
    type: AnalysisType;
    file_url: string | null;
    raw_result: Record<string, unknown> | null;
    score: number | null;
    label: string | null;
    created_at: string;
}

export interface Vitals {
    id: string;
    test_id: string;
    temperature: number | null;
    feeding_status: FeedingStatus | null;
    activity_level: ActivityLevel | null;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    user_id: string;
    test_id: string | null;
    role: ChatRole;
    content: string;
    created_at: string;
}

export interface RiskFusionInput {
    jaundice_score?: number | null;
    jaundice_label?: JaundiceLabel | null;
    cry_label?: CryLabel | null;
    temperature?: number | null;
    feeding_status?: FeedingStatus | null;
    activity_level?: ActivityLevel | null;
}

export interface RiskFusionResult {
    risk_level: RiskLevel;
    recommended_action: string;
    score: number;
}

export interface TestWithAnalyses extends Test {
    analyses: Analysis[];
    vitals: Vitals | null;
}
