// supabase/functions/process-intake/index.ts

// Setup basis server
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("--- Start Intake (Powered by OpenAI GPT-4o) ---")

    // 2. Lees de data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const currentDataStr = formData.get('extractedData') as string
    
    // Robuust parsen van de JSON data
    let currentData = {};
    try {
        if (currentDataStr) currentData = JSON.parse(currentDataStr);
    } catch (e) {
        console.error("Kon extractedData niet parsen:", e);
    }

    if (!audioFile) throw new Error('Geen audio bestand ontvangen')

    // ----------------------------------------------------------------
    // STAP 1: WHISPER (Spraak naar Tekst)
    // ----------------------------------------------------------------
    console.log("Stap 1: Transcriberen (Whisper)...")
    const transcriptionBody = new FormData()
    transcriptionBody.append('file', audioFile)
    transcriptionBody.append('model', 'whisper-1')
    // We laten 'language' weg of zetten hem op 'nl', maar auto-detect is vaak veiliger bij korte audio
    transcriptionBody.append('language', 'nl') 

    const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: transcriptionBody,
    })

    if (!sttResponse.ok) {
        const err = await sttResponse.text();
        console.error("Whisper Error:", err);
        throw new Error(`Whisper API Error: ${err}`)
    }
    
    const sttData = await sttResponse.json()
    const userText = sttData.text || ""
    console.log("Gebruiker zei:", userText)

    // Als de gebruiker niets zei (of Whisper faalde), geef een fallback zonder GPT te bellen
    if (userText.trim().length < 2) {
        return createResponse(
            "", 
            "Excuus, ik hoorde u niet goed. Kunt u dat herhalen?", 
            "", 
            currentData, 
            false
        );
    }

    // ----------------------------------------------------------------
    // STAP 2: GPT-4o (Het Brein)
    // ----------------------------------------------------------------
    console.log("Stap 2: Denken (GPT-4o)...")

    const systemPrompt = `
      Je bent de vriendelijke, professionele AI-intakecoördinator van vrijwilligersplatform 'Tussenheid'.
      
      Jouw doel: Verzamel ontbrekende gegevens voor een match via een gesproken gesprek.
      
      Huidige kennis van de gebruiker (JSON): ${JSON.stringify(currentData)}
      
      Verzamel deze info (stel max 1 vraag tegelijk!):
      1. Naam
      2. Postcode of Woonplaats
      3. Type werk (Bestuurlijk/Denkwerk vs Praktisch/Handen)
      4. Beschikbaarheid
      5. Contactvoorkeur (Telefoon/E-mail)

      Instructies:
      - Pas je toon aan op de gebruiker (Formeel bij ouderen, vlot bij jongeren).
      - Antwoord KORT en bondig (max 2 zinnen), want het wordt uitgesproken.
      - Geef ALTIJD antwoord in JSON formaat.
    `

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o", // Het slimste model
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `De gebruiker zei zojuist: "${userText}". Update de data en geef antwoord.` }
        ]
      })
    })

    if (!llmResponse.ok) throw new Error(`OpenAI LLM Error: ${await llmResponse.text()}`)

    const llmData = await llmResponse.json()
    const rawContent = llmData.choices[0].message.content
    
    let aiResult = { 
        bot_response: "Ik begrijp het, vertel me meer.", 
        extracted_data: currentData, 
        is_finished: false 
    };

    try {
        const parsed = JSON.parse(rawContent);
        aiResult = { ...aiResult, ...parsed };
    } catch (e) {
        console.error("JSON Parse fout:", rawContent);
    }

    // ----------------------------------------------------------------
    // STAP 3: TTS (Tekst naar Spraak)
    // ----------------------------------------------------------------
    console.log("Stap 3: Spreken (TTS)...", aiResult.bot_response)
    
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "tts-1",
        input: aiResult.bot_response || "Een momentje alstublieft.",
        voice: "nova",
        response_format: "mp3",
      }),
    })

    if (!ttsResponse.ok) throw new Error(`TTS Error: ${await ttsResponse.text()}`)

    const audioArrayBuffer = await ttsResponse.arrayBuffer()
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)))

    return createResponse(
        userText,
        aiResult.bot_response,
        audioBase64,
        aiResult.extracted_data,
        aiResult.is_finished
    );

  } catch (error: any) {
    console.error("Critical Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Hulpfunctie voor consistente response
function createResponse(userText: string, botText: string, audioBase64: string, extractedData: any, isFinished: boolean) {
    return new Response(
      JSON.stringify({ userText, botText, audioBase64, extractedData, isFinished }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}