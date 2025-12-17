import { createClient } from '@supabase/supabase-js';
import { Project, UserProfile } from "../types";

// 1. Veilig ophalen van variabelen
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Check of ze bestaan VOORDAT we crashen
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("🚨 CRITIQUE ERROR: Supabase keys ontbreken in .env bestand!");
  console.error("Zorg dat VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in je .env staan.");
}

// 3. Initialiseer client (met fallback om wit scherm te voorkomen)
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

export const getRankedMatches = async (userProfile: UserProfile): Promise<Project[]> => {
  console.log("Matching aanvragen via Supabase Edge Function...");

  if (!supabaseUrl) {
    throw new Error("Supabase URL ontbreekt. Check je .env bestand.");
  }

  try {
    const { data, error } = await supabase.functions.invoke('match-projects', {
      body: { userProfile },
    });

    if (error) {
      console.error("Supabase Function Error Details:", error);
      throw error;
    }

    if (!data) {
        throw new Error("Geen data ontvangen van server (data is null)");
    }

    return data as Project[];

  } catch (error: any) {
    console.error("Matching failed:", error);
    // Gooi de error door zodat de UI het kan tonen
    throw error;
  }
};