// src/services/apiService.ts

// Dit is de URL van jouw live Supabase Edge Function
// Zorg dat deze nog steeds klopt met jouw project!
const API_ENDPOINT = "https://eixutpznmpctdwsxymvd.supabase.co/functions/v1/process-intake";

export interface ExtractedData {
  naam?: string;
  postcode?: string;
  type_werk?: string;
  beschikbaarheid?: string;
  contact?: string;
}

export interface IntakeResponse {
  userText: string;
  botText: string;
  audioBase64: string;
  extractedData: ExtractedData;
  isFinished: boolean;
}

/**
 * Stuurt input (Audio of Tekst) naar de backend.
 * @param input Blob (audio) of string (tekst)
 * @param currentData Huidige kennis over de gebruiker
 */
export async function processIntake(
  input: Blob | string, 
  currentData: ExtractedData
): Promise<IntakeResponse> {
  
  const formData = new FormData();
  
  // Check of het audio of tekst is
  if (input instanceof Blob) {
      // Audio logica (bestandsnaam bepalen)
      let extension = 'webm'; 
      if (input.type.includes('mp4') || input.type.includes('m4a')) {
        extension = 'm4a'; 
      } else if (input.type.includes('wav')) {
        extension = 'wav';
      } else if (input.type.includes('ogg')) {
        extension = 'ogg';
      }
      const fileName = `recording.${extension}`;
      console.log(`Audio versturen als: ${fileName}`);
      formData.append('audio', input, fileName);
  } else if (typeof input === 'string') {
      // Tekst logica
      console.log("Tekst bericht versturen:", input);
      formData.append('textInput', input);
  }
  
  formData.append('extractedData', JSON.stringify(currentData));
  formData.append('context', JSON.stringify({ stage: 'interview' }));

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server Error (${response.status}): ${errorText}`);
    }

    const data: IntakeResponse = await response.json();
    return data;

  } catch (error) {
    console.error("Fout tijdens verwerken intake:", error);
    throw error;
  }
}

export async function playAudioResponse(base64Audio: string): Promise<void> {
  if (!base64Audio) return; 
  
  return new Promise((resolve, reject) => {
    try {
      const audioStr = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioStr);
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
      audio.play().catch((e) => {
        console.error("Audio play error:", e);
        // We rejecten niet, zodat de flow doorgaat (tekst is er immers wel)
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}