import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GEMINI_API_KEY = Deno.env.get('GOOGLE_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log("--- Start Process Intake (Gemini 2.5) ---");
    
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const contextStr = formData.get('context') as string
    const currentDataStr = formData.get('extractedData') as string
    
    const context = contextStr ? JSON.parse(contextStr) : { stage: 'greeting' }
    const currentData = currentDataStr ? JSON.parse(currentDataStr) : {}

    if (!audioFile) throw new Error('Geen audio bestand ontvangen')

    // --- STAP 1: WHISPER (Spraak naar Tekst) ---
    const transcriptionBody = new FormData()
    transcriptionBody.append('file', audioFile)
    transcriptionBody.append('model', 'whisper-1')
    transcriptionBody.append('language', 'nl')

    const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: transcriptionBody,
    })
    
    if (!sttResponse.ok) throw new Error(`Whisper Error: ${await sttResponse.text()}`)
    
    const sttData = await sttResponse.json()
    const userText = sttData.text
    console.log("Gebruiker zei:", userText)

    // --- STAP 2: GEMINI 2.5 FLASH (Het Brein) ---
    // We gebruiken nu het nieuwste, snelle model.
    const MODEL_NAME = "gemini-2.5-flash"; 
    
    const systemPrompt = `
      Je bent de vriendelijke, professionele AI-intakecoördinator van 'Tussenheid'. 
      
      Jouw doel: Verzamel ontbrekende gegevens voor een vrijwilligersmatch.
      Huidige kennis (JSON): ${JSON.stringify(currentData)}
      Gebruiker input: "${userText}"
      
      Verzamel deze info (stel max 1 vraag tegelijk):
      1. Naam
      2. Postcode/Woonplaats
      3. Type werk (Bestuurlijk vs Praktisch)
      4. Beschikbaarheid
      5. Contactvoorkeur

      Output JSON formaat:
      {
        "bot_response": "Korte gesproken reactie (max 2 zinnen)",
        "extracted_data": { ...geupdate velden... },
        "is_finished": boolean
      }
    `

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { 
            response_mime_type: "application/json",
            temperature: 0.7 
        }
      })
    })

    if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error("Gemini 2.5 Error:", errText);
        // Fallback naar 1.5 als 2.5 toch niet mag van je API key rechten
        throw new Error(`Gemini API Error (${MODEL_NAME}): ${errText}`);
    }
    
    const geminiData = await geminiResponse.json()
    // Veilig parsen van het antwoord
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    let aiResult = { 
        bot_response: "Sorry, ik kon dat niet verwerken.", 
        extracted_data: currentData, 
        is_finished: false 
    };

    if (rawContent) {
        try {
            aiResult = JSON.parse(rawContent);
        } catch (e) {
            console.error("JSON Parse fout:", rawContent);
        }
    }

    // --- STAP 3: TTS (Tekst naar Spraak) ---
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "tts-1",
        input: aiResult.bot_response,
        voice: "nova",
        response_format: "mp3",
      }),
    })

    if (!ttsResponse.ok) throw new Error(`TTS Error: ${await ttsResponse.text()}`)

    const audioArrayBuffer = await ttsResponse.arrayBuffer()
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)))

    return new Response(
      JSON.stringify({
        userText,
        botText: aiResult.bot_response,
        audioBase64,
        extractedData: aiResult.extracted_data,
        isFinished: aiResult.is_finished
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error: any) {
    console.error("Critical Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})