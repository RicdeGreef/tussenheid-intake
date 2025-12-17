// supabase/functions/match-projects/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Onze tijdelijke database
const PROJECT_DATABASE = [
    {
        id: 0,
        title: "Operatie Stadsbos",
        organization: "Groene Gidsen Collectief",
        description: "Help mee met het aanplanten van 500 nieuwe bomen in de stadswijk en leg een bijenlint aan langs de singel.",
        tags: ["natuur", "fysiek", "buiten", "klimaat"],
    },
    {
        id: 1,
        title: "Luisterend Oor Podcast",
        organization: "LeesLicht",
        description: "Spreek korte verhalen en nieuwsberichten in voor een luisterbibliotheek voor slechtziende ouderen.",
        tags: ["media", "taal", "creatief", "thuiswerk"],
    },
    {
        id: 2,
        title: "Digi-Maatje Senior",
        organization: "TechVoorIedereen",
        description: "Geef 1-op-1 uitleg aan ouderen over hoe ze kunnen videobellen met hun kleinkinderen en veilig online bankieren.",
        tags: ["digitaal", "ouderen", "geduld", "sociaal"],
    },
    {
        id: 3,
        title: "Hondenuitlaatservice 'Kwispel'",
        organization: "Dierenvrienden Op Wielen",
        description: "Maak wekelijks een wandeling met honden van eigenaren die slecht ter been zijn of herstellende zijn van een operatie.",
        tags: ["dieren", "wandelen", "zorg", "actief"],
    },
    {
        id: 4,
        title: "Boodschappen PlusBus",
        organization: "BuurtBuddies",
        description: "Bestuur de buurtbus of ga mee als begeleider om minder mobiele buurtbewoners naar de markt te brengen voor hun boodschappen.",
        tags: ["vervoer", "gezelligheid", "ouderen", "praktisch"],
    },
    {
        id: 5,
        title: "Tunnel Art Project",
        organization: "KleurDeWijk",
        description: "Begeleid een groep jongeren bij het ontwerpen en schilderen van een legale graffiti-kunstwerk in de fietstunnel.",
        tags: ["kunst", "jongeren", "coaching", "creatief"],
    },
    {
        id: 6,
        title: "Plastic Vissers Event",
        organization: "WereldWater Helden",
        description: "Organiseer een sup- en kano-tocht waarbij deelnemers plastic uit de grachten vissen. Jij regelt de logistiek en instructie.",
        tags: ["organiseren", "sportief", "milieu", "water"],
    },
    {
        id: 7,
        title: "Cultuur Taxi Chauffeur",
        organization: "RijdMee",
        description: "Breng kinderen uit achterstandswijken op zaterdagochtend naar hun muziek- of sportles en weer veilig thuis.",
        tags: ["autorijden", "kinderen", "verantwoordelijkheid", "sociaal"],
    },
    {
        id: 8,
        title: "Walk & Talk Avond",
        organization: "Nachtlicht Netwerk",
        description: "Loop mee in tweetallen door de wijk in de avonduren om aanspreekpunt te zijn en de sociale veiligheid te vergroten.",
        tags: ["veiligheid", "wandelen", "communicatie", "buurt"],
    },
    {
        id: 9,
        title: "Huiskamer Concerten",
        organization: "MuziekMakers Aan Huis",
        description: "Speel gitaar, piano of zing een uurtje in de gemeenschappelijke ruimte van een lokaal verzorgingstehuis.",
        tags: ["muziek", "optreden", "entertainment", "zorg"],
    },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userProfile } = await req.json()
    
    // Key ophalen uit de server secrets
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set in secrets')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const dbContext = PROJECT_DATABASE.map((proj) => 
      `ID ${proj.id}: (Project: ${proj.title}) (Tags: ${proj.tags.join(", ")}) - ${proj.description}`
    ).join("\n");

    const systemInstruction = `
      Je bent een zoekmachine gespecialiseerd in 'Vrijwilligers Project Matching'.
      Je ontvangt gebruikersinteresses en een lijst met specifieke PROJECTEN.
      Geef een JSON object terug met een array 'rankings'.
      Elk item heeft: id (nummer), score (0-100), reason (korte zin).
    `;

    const userPrompt = `
      GEBRUIKER: ${userProfile.name}
      INTERESSES: "${userProfile.interests}"
      CONTEXT: "${userProfile.context}"
      
      PROJECTEN:
      ${dbContext}
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    const rankings = parsed.rankings || [];

    const scoredProjects = PROJECT_DATABASE.map((proj) => {
      const ranking = rankings.find((r: any) => r.id === proj.id);
      return {
        ...proj,
        score: ranking ? ranking.score : 0,
        reason: ranking ? ranking.reason : "Geen directe match gevonden."
      };
    });

    const top5 = scoredProjects
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

    return new Response(JSON.stringify(top5), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})