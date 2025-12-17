import { createClient } from '@supabase/supabase-js';
import { Project, UserProfile } from "../types";

// 1. Veilig ophalen van variabelen
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Client initialisatie
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

export const getRankedMatches = async (userProfile: UserProfile): Promise<Project[]> => {
  console.log("🚀 Matching aanvragen (DEBUG FETCH MODE)...");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL/Key ontbreekt in .env");
  }

  try {
    // We gebruiken hier 'fetch' in plaats van 'supabase.functions.invoke'
    // zodat we de foutmelding direct als tekst kunnen lezen in de console.
    const response = await fetch(`${supabaseUrl}/functions/v1/match-projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ userProfile })
    });

    // LEES HET ANTWOORD VAN DE SERVER
    const responseText = await response.text();
    console.log("👇👇👇 HIER IS DE FOUTMELDING VAN DE SERVER 👇👇👇");
    console.log(responseText);
    console.log("👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆");

    if (!response.ok) {
        // Probeer het te parsen als JSON voor een nettere error
        try {
            const jsonErr = JSON.parse(responseText);
            throw new Error(jsonErr.error || jsonErr.message || responseText);
        } catch (e) {
            throw new Error(`Server Fout (${response.status}): ${responseText}`);
        }
    }

    const data = JSON.parse(responseText);
    return data as Project[];

  } catch (error: any) {
    console.error("❌ DEFINITIEVE FOUT:", error);
    throw error;
  }
};