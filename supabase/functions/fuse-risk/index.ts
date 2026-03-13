import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * NeoSense Risk Fusion Edge Function
 * 
 * Fuses jaundice scan, cry analysis, and manual vitals into a single risk score.
 */

interface RiskFusionInput {
    jaundice_score?: number | null;
    jaundice_label?: string | null;
    cry_label?: string | null;
    temperature?: number | null;
    feeding_status?: string | null;
    activity_level?: string | null;
}

interface RiskFusionResult {
    risk_level: "low" | "moderate" | "high";
    recommended_action: string;
    score: number;
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    try {
        const input: RiskFusionInput = await req.json();
        let score = 0;
        const factors: string[] = [];

        // ─── Jaundice Scoring ─────────────────────────────────────────

        if (input.jaundice_label === "Severe") {
            score += 40;
            factors.push("Severe jaundice detected");
        } else if (input.jaundice_label === "Moderate") {
            score += 25;
            factors.push("Moderate jaundice detected");
        } else if (input.jaundice_label === "Mild") {
            score += 10;
            factors.push("Mild jaundice detected");
        }

        if (input.jaundice_score != null && input.jaundice_score > 0) {
            score += Math.min(input.jaundice_score * 0.3, 20);
        }

        // ─── Cry Analysis Scoring ─────────────────────────────────────

        if (input.cry_label === "Weak/Silent") {
            score += 35;
            factors.push("Weak or silent cry — possible neurological concern");
        } else if (input.cry_label === "Pain") {
            score += 25;
            factors.push("Pain cry detected — possible acute distress");
        } else if (input.cry_label === "Distress") {
            score += 15;
            factors.push("Distress cry detected");
        }

        // ─── Temperature Scoring ──────────────────────────────────────

        if (input.temperature != null) {
            if (input.temperature > 38.5) {
                score += 25;
                factors.push("High fever (>38.5°C) — possible sepsis");
            } else if (input.temperature > 38.0) {
                score += 15;
                factors.push("Elevated temperature (>38°C)");
            } else if (input.temperature < 35.5) {
                score += 20;
                factors.push("Hypothermia (<35.5°C) — concerning");
            } else if (input.temperature < 36.0) {
                score += 10;
                factors.push("Low temperature (<36°C)");
            }
        }

        // ─── Feeding Status Scoring ───────────────────────────────────

        if (input.feeding_status === "Not feeding") {
            score += 20;
            factors.push("Not feeding — requires immediate attention");
        } else if (input.feeding_status === "Poor") {
            score += 10;
            factors.push("Poor feeding observed");
        }

        // ─── Activity Level Scoring ───────────────────────────────────

        if (input.activity_level === "Unresponsive") {
            score += 30;
            factors.push("Unresponsive — CRITICAL indicator");
        } else if (input.activity_level === "Weak") {
            score += 12;
            factors.push("Weak activity level");
        }

        // ─── Compound Risk Factors ────────────────────────────────────
        // If multiple high-risk factors co-exist, increase score

        const highFactors = [
            input.jaundice_label === "Severe",
            input.cry_label === "Weak/Silent",
            input.temperature != null && input.temperature > 38.5,
            input.activity_level === "Unresponsive",
            input.feeding_status === "Not feeding",
        ].filter(Boolean).length;

        if (highFactors >= 3) {
            score += 15;
            factors.push("Multiple critical risk factors present — compound risk elevated");
        } else if (highFactors >= 2) {
            score += 8;
            factors.push("Multiple concerning factors present");
        }

        // Clamp
        score = Math.min(Math.round(score), 100);

        // ─── Determine Risk Level ─────────────────────────────────────

        let risk_level: "low" | "moderate" | "high";
        let recommended_action: string;

        if (score >= 60) {
            risk_level = "high";
            recommended_action =
                "🚨 URGENT: Refer to nearest health facility immediately. This newborn shows high-risk indicators (" +
                factors.join("; ") +
                ") that require professional medical evaluation without delay.";
        } else if (score >= 30) {
            risk_level = "moderate";
            recommended_action =
                "⚠️ CAUTION: Schedule a medical follow-up within 24 hours. Monitor closely for: " +
                factors.join("; ") +
                ". Watch for any worsening symptoms.";
        } else {
            risk_level = "low";
            recommended_action =
                "✅ Low risk detected. Continue routine monitoring and standard newborn care. " +
                (factors.length > 0
                    ? "Minor observations: " + factors.join("; ") + "."
                    : "All indicators appear normal.") +
                " Schedule regular check-ups as recommended.";
        }

        const result: RiskFusionResult = { risk_level, recommended_action, score };

        return new Response(JSON.stringify(result), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: "Invalid request", details: String(error) }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});
