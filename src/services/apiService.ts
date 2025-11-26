// src/services/apiService.ts

// Check of deze URL nog klopt met wat je in je terminal zag bij de laatste deploy!
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

export async function processAudioIntake(
  audioBlob: Blob, 
  currentData: ExtractedData
): Promise<IntakeResponse> {
  
  const formData = new FormData();
  
  // --- CRUCIALE FIX: Bestandsnaam dynamisch bepalen ---
  // Whisper heeft de extensie nodig om te weten hoe het bestand te lezen.
  let extension = 'webm'; 
  if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
    extension = 'm4a'; 
  } else if (audioBlob.type.includes('wav')) {
    extension = 'wav';
  } else if (audioBlob.type.includes('ogg')) {
    extension = 'ogg';
  }

  const fileName = `recording.${extension}`;
  console.log(`Audio versturen als: ${fileName} (MIME: ${audioBlob.type})`);

  formData.append('audio', audioBlob, fileName);
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
  if (!base64Audio) return; // Geen audio = niets doen
  
  return new Promise((resolve, reject) => {
    try {
      const audioStr = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioStr);
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
      audio.play().catch((e) => {
        console.error("Audio play error:", e);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}