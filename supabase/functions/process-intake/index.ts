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
    console.log("--- Start Intake Request ---")

    // Check of API keys aanwezig zijn
    if (!OPENAI_API_KEY) {
        throw new Error("Server configuratie fout: OPENAI_API_KEY ontbreekt.")
    }

    // 2. Lees de data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const textInput = formData.get('textInput') as string | null
    const currentDataStr = formData.get('extractedData') as string
    
    // Veilig parsen van input data
    let currentData = {};
    try {
        if (currentDataStr && currentDataStr !== "undefined" && currentDataStr !== "null") {
            currentData = JSON.parse(currentDataStr);
        }
    } catch (e) {
        console.error("Data parse waarschuwing:", e);
    }

    // Check input
    if (!audioFile && !textInput) {
        return createResponse("", "Ik hoorde niets. Kunt u dat herhalen?", "", currentData, false);
    }

    let userText = "";

    // ----------------------------------------------------------------
    // STAP 1: Input Verwerken (Whisper of Tekst)
    // ----------------------------------------------------------------
    if (audioFile) {
        console.log("Stap 1: Audio transcriberen...")
        const transcriptionBody = new FormData()
        transcriptionBody.append('file', audioFile)
        transcriptionBody.append('model', 'whisper-1')
        // Taal auto-detect is vaak veiliger
        // transcriptionBody.append('language', 'nl') 

        const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: transcriptionBody,
        })

        if (!sttResponse.ok) {
            const err = await sttResponse.text()
            console.error("Whisper Error:", err)
            throw new Error(`Fout bij luisteren: ${sttResponse.status}`)
        }
        const sttData = await sttResponse.json()
        userText = sttData.text || ""
    } else if (textInput) {
        console.log("Stap 1: Tekst ontvangen")
        userText = textInput;
    }

    console.log("Gebruiker input:", userText)

    if (!userText || userText.trim().length < 2) {
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
    console.log("Stap 2: AI aan het denken...")

    const systemPrompt = `
      Je bent de vriendelijke, professionele AI-intakecoördinator van 'Tussenheid'.
      
      Huidige data (JSON): ${JSON.stringify(currentData)}
      
      Jouw doel: Verzamel ontbrekende velden (naam, postcode, type_werk, beschikbaarheid, contact).
      Stel max 1 vraag tegelijk.

      Instructies:
      1. Update de data op basis van de input.
      2. Stel een vervolgvraag als er iets mist.
      3. Houd het antwoord KORT (max 2 zinnen).
      4. Antwoord ALTIJD in valide JSON.

      JSON Formaat:
      {
        "bot_response": "Tekst om uit te spreken",
        "extracted_data": { ... },
        "is_finished": boolean
      }
    `

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ]
      })
    })

    if (!llmResponse.ok) {
        const err = await llmResponse.text()
        console.error("OpenAI LLM Error:", err)
        throw new Error(`Fout bij nadenken: ${llmResponse.status}`)
    }

    const llmData = await llmResponse.json()
    const rawContent = llmData.choices[0].message.content
    
    let aiResult = { 
        bot_response: "Een moment geduld alstublieft.", 
        extracted_data: currentData, 
        is_finished: false 
    };

    try {
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        aiResult = { ...aiResult, ...parsed, extracted_data: { ...currentData, ...parsed.extracted_data } };
    } catch (e) {
        console.error("JSON Parse Error:", rawContent);
        // Fallback: als het geen JSON is, gebruik de ruwe tekst
        if (!rawContent.trim().startsWith("{")) {
             aiResult.bot_response = rawContent;
        }
    }

    // ----------------------------------------------------------------
    // STAP 3: TTS (Tekst naar Spraak)
    // ----------------------------------------------------------------
    console.log("Stap 3: Audio genereren...", aiResult.bot_response)
    
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

    if (!ttsResponse.ok) {
        console.error("TTS Error:", await ttsResponse.text())
        // We gaan niet crashen op TTS, maar sturen gewoon geen audio terug
        return createResponse(
            userText,
            aiResult.bot_response,
            "", // Geen audio
            aiResult.extracted_data,
            aiResult.is_finished
        );
    }

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
    console.error("CRITICAL SERVER ERROR:", error)
    return new Response(JSON.stringify({ error: error.message || "Onbekende server fout" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function createResponse(userText: string, botText: string, audioBase64: string, extractedData: any, isFinished: boolean) {
    return new Response(
      JSON.stringify({ userText, botText, audioBase64, extractedData, isFinished }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}