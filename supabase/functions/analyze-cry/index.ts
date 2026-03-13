import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'

const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audioBase64 } = await req.json();
    
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'Audio base64 is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Convert base64 to binary buffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Use a model specifically for baby cry classification
    const MODEL_URL = 'https://api-inference.huggingface.co/models/alibidarani/sick-baby-audio-classification';
    
    const response = await fetch(
      MODEL_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HF Error ${response.status}:`, errorText);
      
      // If model is loading, HF returns 503. Return it to client to retry or handle.
      if (response.status === 503) {
        return new Response(JSON.stringify({ error: 'Model is loading, please try again in a moment.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        });
      }

      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function logical error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
