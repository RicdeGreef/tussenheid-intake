// supabase/functions/match-projects/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Database (ingekort voor overzicht, werkt hetzelfde)
const PROJECT_DATABASE = [
    { id: 0, title: "Operatie Stadsbos", organization: "Groene Gidsen", description: "Bomen planten.", tags: ["natuur"] },
    { id: 1, title: "Luisterend Oor", organization: "LeesLicht", description: "Verhalen inspreken.", tags: ["media"] },
    { id: 2, title: "Digi-Maatje", organization: "TechVoorIedereen", description: "Ouderen helpen met iPad.", tags: ["digitaal"] },
    // ... je mag hier jouw volledige lijst laten staan ...
];

Deno.serve(async (req) => {
  // 1. CORS Preflight (Altijd eerst)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Probeer de body te lezen (vaak gaat het hier mis als de frontend leeg is)
    let userProfile;
    try {
        const body = await req.json();
        userProfile = body.userProfile;
    } catch (e) {
        throw new Error(`Fout bij lezen aanvraag (JSON Parse): ${e.message}`);
    }

    if (!userProfile) {
        throw new Error("Geen 'userProfile' ontvangen in de data.");
    }

    // 3. Controleer de API Key (Dit is de hoofdverdachte)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error("SERVER ERROR: 'GEMINI_API_KEY' niet gevonden in Secrets! Heb je 'npx supabase secrets set' gedaan of het Dashboard gebruikt?");
    }

    // 4. Test of Google AI werkt
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    // 5. De AI Logica
    const dbContext = PROJECT_DATABASE.map((proj) => 
      `ID ${proj.id}: ${proj.title} - ${proj.description}`
    ).join("\n");

    const userPrompt = `
      GEBRUIKER: ${userProfile.name}, INTERESSES: ${userProfile.interests}
      PROJECTEN: ${dbContext}
      Geef JSON met rankings: [{id, score, reason}]
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    const rankings = parsed.rankings || [];

    // Resultaat bouwen
    const topMatch = PROJECT_DATABASE[0]; // Fallback
    // ... hier jouw logica voor sorteren ...
    
    // Voor de debug sturen we nu gewoon even de eerste match terug om te testen of de AI werkte
    return new Response(JSON.stringify([topMatch]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    // --- DE DEBUG OPLOSSING ---
    // In plaats van crashen (500), sturen we de fout netjes terug (400)
    // Zodat jij hem in je browser kunt lezen!
    return new Response(JSON.stringify({ 
        error: error.message, 
        detail: "Kijk hierboven wat er mis ging!",
        stack: error.stack 
    }), {
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})