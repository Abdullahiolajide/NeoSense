import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audioBase64 } = await req.json();
    
    if (!audioBase64) {
      throw new Error('Audio base64 is required');
    }

    // Convert base64 to binary buffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBuffer = bytes.buffer;

    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/wav2vec2-large-960h',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/octet-stream', // Send as octet-stream representation of the audio
        },
        body: audioBuffer,
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
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
