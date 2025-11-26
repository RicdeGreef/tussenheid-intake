// src/services/apiService.ts

// Dit is de URL van jouw live Supabase Edge Function
// Zorg dat deze URL klopt met jouw project!
const API_ENDPOINT =
  'https://eixutpznmpctdwsxymvd.supabase.co/functions/v1/process-intake'

// Dit zijn alle mogelijke velden uit de intake.
export interface ExtractedData {
  naam?: string
  geboortedatum?: string
  email?: string
  telefoonnummer?: string
  postcode?: string
  woonplaats?: string
  reisafstand_bereidheid?: string
  korte_omschrijving?: string
  motivatie?: string
  talenten?: string | string[]
  ervaring_met_vrijwilligerswerk?: string
  voorkeur_doelgroepen?: string | string[]
  voorkeur_activiteiten?: string | string[]
  soort_werk?: string
  beschikbaarheid_dagen?: string | string[]
  beschikbaarheid_tijdstippen?: string | string[]
  frequentie?: string
  maximale_duur_per_keer?: string
  startdatum?: string
  online_of_op_locatie?: string
  fysieke_beperkingen?: string
  grenzen_voorkeuren?: string
  voorkeur_communicatiekanaal?: string
}

// Response-structuur van de Supabase function
export interface IntakeResponse {
  userText: string
  botText: string
  audioBase64: string
  extractedData: ExtractedData        // alleen nieuwe data van deze beurt
  knownFields?: string[]              // lijst met velden die de server kent
  isFinished: boolean
}

/**
 * Stuurt input (Audio of Tekst) naar de backend.
 * @param input Blob (audio) of string (tekst)
 * @param currentData Huidige kennis over de gebruiker (client-side)
 */
export async function processIntake(
  input: Blob | string,
  currentData: ExtractedData,
): Promise<IntakeResponse> {
  const formData = new FormData()

  // Slimme detectie: is het audio of tekst?
  if (input instanceof Blob) {
    // Audio: Bepaal extensie voor Whisper
    let extension = 'webm'
    if (input.type.includes('mp4') || input.type.includes('m4a')) extension = 'm4a'
    else if (input.type.includes('wav')) extension = 'wav'
    else if (input.type.includes('ogg')) extension = 'ogg'

    const fileName = `recording.${extension}`
    console.log(`Audio versturen als: ${fileName}`)
    formData.append('audio', input, fileName)
  } else {
    // Tekst: Verstuur als string
    console.log('Tekst versturen:', input)
    formData.append('textInput', input)
  }

  // 1) Bepaal welke velden al een waarde hebben (client-side)
  const knownFields = Object.entries(currentData ?? {})
    .filter(([_, v]) => v !== null && v !== undefined && v !== '')
    .map(([k]) => k as string)

  // 2) Stuur zowel de lijst met bekende velden als de volledige (platte) data mee
  formData.append('knownFields', JSON.stringify(knownFields))
  formData.append('currentData', JSON.stringify(currentData ?? {}))

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server Error (${response.status}): ${errorText}`)
    }

    const data: IntakeResponse = await response.json()
    return data
  } catch (error) {
    console.error('Fout tijdens verwerken intake:', error)
    throw error
  }
}

export async function playAudioResponse(base64Audio: string): Promise<void> {
  if (!base64Audio) return

  return new Promise((resolve, reject) => {
    try {
      const audioStr = `data:audio/mp3;base64,${base64Audio}`
      const audio = new Audio(audioStr)
      audio.onended = () => resolve()
      audio.onerror = (e) => reject(e)
      audio.play().catch((e) => {
        console.error('Audio play error (mogelijk autoplay block):', e)
        resolve()
      })
    } catch (e) {
      resolve()
    }
  })
}
