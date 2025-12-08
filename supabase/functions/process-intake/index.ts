// supabase/functions/process-intake/index.ts

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Alle velden die we in het intake-profiel willen hebben
const ALL_FIELDS = [
  'naam',
  'geboortedatum',
  'email',
  'telefoonnummer',
  'postcode',
  'woonplaats',
  'reisafstand_bereidheid',
  'korte_omschrijving',
  'motivatie',
  'talenten',
  'ervaring_met_vrijwilligerswerk',
  'voorkeur_doelgroepen',
  'voorkeur_activiteiten',
  'soort_werk',
  'beschikbaarheid_dagen',
  'beschikbaarheid_tijdstippen',
  'frequentie',
  'maximale_duur_per_keer',
  'startdatum',
  'online_of_op_locatie',
  'opleidingsniveau',
  'werkervaring',
  'voorkeur_communicatiekanaal',
]

// Hulpfunctie: maak set van bekende velden uit JSON-string
function parseKnownFields(str: string | null): Set<string> {
  if (!str) return new Set()
  try {
    const arr = JSON.parse(str)
    if (Array.isArray(arr)) {
      return new Set(arr.filter((x) => typeof x === 'string'))
    }
  } catch (e) {
    console.error('knownFields parse waarschuwing:', e)
  }
  return new Set()
}

// Huidige intake-data plat en beperkt tot bekende velden houden
function sanitizeCurrentData(data: any): any {
  const result: any = {}
  if (!data || typeof data !== 'object') return result
  for (const key of ALL_FIELDS) {
    const value = data[key]
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      continue
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    ) {
      result[key] = value
    }
  }
  return result
}

// Bepaal of alles ingevuld is obv bekende velden + nieuw gevonden velden
function computeIsFinished(known: Set<string>, newlyExtracted: any): boolean {
  const filled = new Set(known)
  if (newlyExtracted && typeof newlyExtracted === 'object') {
    for (const key of Object.keys(newlyExtracted)) {
      if (
        ALL_FIELDS.includes(key) &&
        newlyExtracted[key] !== null &&
        newlyExtracted[key] !== undefined &&
        newlyExtracted[key] !== ''
      ) {
        filled.add(key)
      }
    }
  }
  return ALL_FIELDS.every((f) => filled.has(f))
}

// Filter AI-output: alleen platte waarden voor bekende velden
function sanitizeExtractedData(extracted: any): any {
  const result: any = {}
  if (!extracted || typeof extracted !== 'object') return result

  for (const key of ALL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(extracted, key)) continue
    const value = extracted[key]
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    ) {
      result[key] = value
    }
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('Server configuratie fout: OPENAI_API_KEY ontbreekt.')
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const textInput = formData.get('textInput') as string | null
    const knownFieldsStr = formData.get('knownFields') as string | null
    const currentDataStr = formData.get('currentData') as string | null

    // knownFields vanuit de client
    const knownFieldsSet = parseKnownFields(knownFieldsStr)

    // currentData vanuit de client
    let currentData: any = {}
    try {
      if (currentDataStr && currentDataStr !== 'undefined' && currentDataStr !== 'null') {
        currentData = JSON.parse(currentDataStr)
      }
    } catch (e) {
      console.error('currentData parse waarschuwing:', e)
    }

    // Vul knownFields ook op basis van niet-lege waarden in currentData
    const sanitizedCurrent = sanitizeCurrentData(currentData)
    for (const key of Object.keys(sanitizedCurrent)) {
      knownFieldsSet.add(key)
    }

    if (!audioFile && !textInput) {
      return createResponse(
        '',
        'Ik hoorde niets. Kunt u dat herhalen?',
        '',
        {},
        Array.from(knownFieldsSet),
        false,
      )
    }

    let userText = ''

    // 1. Speech → tekst (of direct tekst)
    if (audioFile) {
      const transcriptionBody = new FormData()
      transcriptionBody.append('file', audioFile)
      transcriptionBody.append('model', 'whisper-1')

      const sttResponse = await fetch(
        'https://api.openai.com/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: transcriptionBody,
        },
      )

      if (!sttResponse.ok) {
        const err = await sttResponse.text()
        console.error('Whisper Error:', err)
        throw new Error(`Fout bij luisteren: ${sttResponse.status}`)
      }
      const sttData = await sttResponse.json()
      userText = sttData.text || ''
    } else if (textInput) {
      userText = textInput
    }

    if (!userText || userText.trim().length < 2) {
      return createResponse(
        '',
        'Excuus, ik hoorde u niet goed. Kunt u dat herhalen?',
        '',
        {},
        Array.from(knownFieldsSet),
        false,
      )
    }

    // 2. GPT-4o: welke velden zitten er in deze utterance + wat is de volgende vraag?
    const systemPrompt = `
Je bent de vriendelijke, professionele AI-intakecoördinator van Tussenheid.

Je voert een intakegesprek met een vrijwilliger.

Je krijgt:
- "knownFields": een lijst met veldnamen die al ingevuld zijn.
- "intakeData": een JSON-object met de huidige ingevulde waarden voor deze velden.
- de laatste uitspraak van de vrijwilliger als userText (in het user-bericht).

knownFields: ${JSON.stringify(Array.from(knownFieldsSet))}
intakeData: ${JSON.stringify(sanitizedCurrent)}

Je werkt ALLEEN met de volgende velden:
${ALL_FIELDS.join(', ')}

JOUW TAAK PER BEURT:
1. Haal uit de userText alle informatie die hoort bij bovenstaande velden.
   - Stop dit in "extracted_data" als een platte JSON (key → waarde).
   - Gebruik alleen veldnamen uit de lijst hierboven.
2. Zodra een veld een duidelijke waarde heeft (in intakeData of in extracted_data),
   beschouw je dat veld als ingevuld en vraag je daar NIET opnieuw naar.
3. Kies maximaal 1 nieuw veld dat nog niet ingevuld is en stel daar een duidelijke vraag over.
4. Als naar jouw inschatting alle velden inhoudelijk voldoende zijn beantwoord,
   stel dan géén nieuwe vragen meer maar sluit vriendelijk af.

BELANGRIJK:
- Houd "bot_response" kort (max 2 zinnen).
- Antwoord ALTIJD in geldig JSON met precies dit formaat:

{
  "bot_response": "Tekst om uit te spreken",
  "extracted_data": { ... },
  "is_finished": boolean
}
`

    const llmResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
        }),
      },
    )

    if (!llmResponse.ok) {
      const err = await llmResponse.text()
      console.error('OpenAI LLM Error:', err)
      throw new Error(`Fout bij nadenken: ${llmResponse.status}`)
    }

    const llmData = await llmResponse.json()
    const rawContent = llmData.choices?.[0]?.message?.content ?? ''

    let botText = 'Een moment geduld alstublieft.'
    let extractedTurnData: any = {}
    let isFinishedModel = false

    try {
      const cleanJson = rawContent
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()
      const parsed = JSON.parse(cleanJson)

      if (typeof parsed.bot_response === 'string') {
        botText = parsed.bot_response
      }
      extractedTurnData = sanitizeExtractedData(parsed.extracted_data)
      if (typeof parsed.is_finished === 'boolean') {
        isFinishedModel = parsed.is_finished
      }
    } catch (e) {
      console.error('JSON Parse Error:', rawContent)
      if (!rawContent.trim().startsWith('{')) {
        botText = rawContent || botText
      }
    }

    // 3. Bepaal nieuwe knownFields + echte isFinished (server-side)
    const updatedKnown = new Set(knownFieldsSet)
    for (const key of Object.keys(extractedTurnData)) {
      updatedKnown.add(key)
    }

    const isFinishedComputed = computeIsFinished(
      updatedKnown,
      extractedTurnData,
    )

    const finalIsFinished = isFinishedComputed || isFinishedModel
    const updatedKnownArr = Array.from(updatedKnown)

    // 4. TTS
    const ttsResponse = await fetch(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: botText,
          voice: 'nova',
          response_format: 'mp3',
        }),
      },
    )

    if (!ttsResponse.ok) {
      console.error('TTS Error:', await ttsResponse.text())
      return createResponse(
        userText,
        botText,
        '',
        extractedTurnData,
        updatedKnownArr,
        finalIsFinished,
      )
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer()

    // Veilige base64-conversie zonder enorme spread (voorkomt call stack errors)
    const bytes = new Uint8Array(audioArrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const audioBase64 = btoa(binary)

    return createResponse(
      userText,
      botText,
      audioBase64,
      extractedTurnData,
      updatedKnownArr,
      finalIsFinished,
    )
  } catch (error: any) {
    console.error('CRITICAL SERVER ERROR:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Onbekende server fout' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

function createResponse(
  userText: string,
  botText: string,
  audioBase64: string,
  extractedData: any,
  knownFields: string[],
  isFinished: boolean,
) {
  return new Response(
    JSON.stringify({
      userText,
      botText,
      audioBase64,
      extractedData,
      knownFields,
      isFinished,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}
