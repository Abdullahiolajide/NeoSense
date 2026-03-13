import type { Analysis, RiskFusionInput, RiskFusionResult, Test, TestWithAnalyses, Vitals } from '@/constants/Types';
import { supabase } from './supabase';

// ─── Tests ───────────────────────────────────────────────────────────

export async function createTest(userId: string, name: string, notes?: string): Promise<Test> {
    const { data, error } = await supabase
        .from('tests')
        .insert({
            user_id: userId,
            name,
            notes: notes || null,
            overall_risk: 'pending',
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getTests(userId: string): Promise<Test[]> {
    const { data, error } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getTestById(testId: string): Promise<TestWithAnalyses> {
    const { data: test, error: testError } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single();

    if (testError) throw testError;

    const { data: analyses, error: analysesError } = await supabase
        .from('analyses')
        .select('*')
        .eq('test_id', testId)
        .order('created_at', { ascending: false });

    if (analysesError) throw analysesError;

    const { data: vitals, error: vitalsError } = await supabase
        .from('vitals')
        .select('*')
        .eq('test_id', testId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (vitalsError) throw vitalsError;

    return { ...test, analyses: analyses || [], vitals };
}

export async function updateTestRisk(testId: string, risk: string) {
    const { error } = await supabase
        .from('tests')
        .update({ overall_risk: risk, updated_at: new Date().toISOString() })
        .eq('id', testId);

    if (error) throw error;
}

export async function deleteTest(testId: string) {
    // Delete analyses first (cascade manually)
    await supabase.from('analyses').delete().eq('test_id', testId);
    await supabase.from('vitals').delete().eq('test_id', testId);

    const { error } = await supabase.from('tests').delete().eq('id', testId);
    if (error) throw error;
}

// ─── Analyses ────────────────────────────────────────────────────────

export async function createAnalysis(
    testId: string,
    type: 'jaundice' | 'cry',
    fileUrl: string | null,
    rawResult: Record<string, unknown>,
    score: number,
    label: string,
): Promise<Analysis> {
    const { data, error } = await supabase
        .from('analyses')
        .insert({
            test_id: testId,
            type,
            file_url: fileUrl,
            raw_result: rawResult,
            score,
            label,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getAnalysesByTestId(testId: string): Promise<Analysis[]> {
    const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('test_id', testId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ─── Vitals ──────────────────────────────────────────────────────────

export async function upsertVitals(
    testId: string,
    vitals: Partial<Vitals>
): Promise<Vitals> {
    // Check if vitals exist for this test
    const { data: existing } = await supabase
        .from('vitals')
        .select('id')
        .eq('test_id', testId)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from('vitals')
            .update({
                temperature: vitals.temperature,
                feeding_status: vitals.feeding_status,
                activity_level: vitals.activity_level,
            })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('vitals')
            .insert({
                test_id: testId,
                temperature: vitals.temperature || null,
                feeding_status: vitals.feeding_status || null,
                activity_level: vitals.activity_level || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}

// ─── File Upload ─────────────────────────────────────────────────────

export async function uploadFile(
    bucket: string,
    path: string,
    file: Blob | ArrayBuffer,
    contentType: string
): Promise<string> {
    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType, upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return urlData.publicUrl;
}

// ─── Risk Fusion ─────────────────────────────────────────────────────

export function computeLocalRiskFusion(input: RiskFusionInput): RiskFusionResult {
    // Local fallback risk fusion logic (mirrors edge function)
    let score = 0;
    let factors: string[] = [];

    // Jaundice scoring
    if (input.jaundice_label === 'Severe') {
        score += 40;
        factors.push('Severe jaundice detected');
    } else if (input.jaundice_label === 'Moderate') {
        score += 25;
        factors.push('Moderate jaundice detected');
    } else if (input.jaundice_label === 'Mild') {
        score += 10;
        factors.push('Mild jaundice detected');
    }

    // Jaundice numeric score
    if (input.jaundice_score != null) {
        score += Math.min(input.jaundice_score * 0.3, 20);
    }

    // Cry scoring
    if (input.cry_label === 'Weak/Silent') {
        score += 35;
        factors.push('Weak or silent cry observed');
    } else if (input.cry_label === 'Pain') {
        score += 25;
        factors.push('Pain cry detected');
    } else if (input.cry_label === 'Distress') {
        score += 15;
        factors.push('Distress cry detected');
    }

    // Temperature
    if (input.temperature != null) {
        if (input.temperature > 38.0) {
            score += 20;
            factors.push('Elevated temperature');
        } else if (input.temperature < 36.0) {
            score += 15;
            factors.push('Low temperature');
        }
    }

    // Feeding
    if (input.feeding_status === 'Not feeding') {
        score += 20;
        factors.push('Not feeding');
    } else if (input.feeding_status === 'Poor') {
        score += 10;
        factors.push('Poor feeding');
    }

    // Activity
    if (input.activity_level === 'Unresponsive') {
        score += 25;
        factors.push('Unresponsive');
    } else if (input.activity_level === 'Weak') {
        score += 10;
        factors.push('Weak activity');
    }

    // Clamp score
    score = Math.min(score, 100);

    let risk_level: 'low' | 'moderate' | 'high';
    let recommended_action: string;

    if (score >= 60) {
        risk_level = 'high';
        recommended_action = 'URGENT: Refer to nearest health facility immediately. This newborn shows high-risk indicators that require professional medical evaluation.';
    } else if (score >= 30) {
        risk_level = 'moderate';
        recommended_action = 'CAUTION: Schedule a medical follow-up within 24 hours. Monitor the newborn closely for any worsening symptoms.';
    } else {
        risk_level = 'low';
        recommended_action = 'Low risk detected. Continue routine monitoring and standard newborn care. Schedule regular check-ups.';
    }

    return { risk_level, recommended_action, score };
}

export async function fuseRiskRemote(input: RiskFusionInput): Promise<RiskFusionResult> {
    try {
        const { data, error } = await supabase.functions.invoke('fuse-risk', {
            body: input,
        });

        if (error) throw error;
        return data as RiskFusionResult;
    } catch {
        // Fallback to local computation
        return computeLocalRiskFusion(input);
    }
}

// ─── Stats ───────────────────────────────────────────────────────────

export async function getUserStats(userId: string) {
    const { data: allTests, error: allError } = await supabase
        .from('tests')
        .select('id, overall_risk, created_at')
        .eq('user_id', userId);

    if (allError) throw allError;

    const total = allTests?.length || 0;
    const highRisk = allTests?.filter((t) => t.overall_risk === 'high').length || 0;

    // This week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = allTests?.filter(
        (t) => new Date(t.created_at) >= weekAgo
    ).length || 0;

    return { total, highRisk, thisWeek };
}
