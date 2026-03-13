import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const ROBOFLOW_API_KEY = Deno.env.get('ROBOFLOW_API_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      throw new Error('Image base64 is required');
    }

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
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
