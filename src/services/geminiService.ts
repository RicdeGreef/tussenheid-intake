
import { PROJECT_DATABASE } from "../constants";
import { Project, UserProfile } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fallback: Als AI faalt, doet JavaScript de keyword telling
const fallbackMatching = (userProfile: UserProfile): Project[] => {
  console.warn("AI failed, switching to local keyword matching.");
  const searchTerms = userProfile.interests.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
  
  return [...PROJECT_DATABASE]
    .map(proj => {
      let score = 0;
      let matches: string[] = [];
      
      proj.tags.forEach(tag => {
        if (searchTerms.some(term => tag.includes(term) || term.includes(tag))) {
          score += 20;
          matches.push(tag);
        }
      });
      
      if (searchTerms.some(term => proj.description.toLowerCase().includes(term) || proj.title.toLowerCase().includes(term))) {
        score += 10;
      }
      
      return { 
        ...proj, 
        score, 
        reason: matches.length > 0 
          ? `Gematched op trefwoorden: ${matches.join(", ")}` 
          : "Geselecteerd op basis van algemene beschrijving." 
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
};

export const getRankedMatches = async (userProfile: UserProfile): Promise<Project[]> => {
  // We sturen de database met IDs zodat de AI makkelijk kan verwijzen
  const dbContext = PROJECT_DATABASE.map((proj) => 
    `ID ${proj.id}: (Project: ${proj.title}) (Tags: ${proj.tags.join(", ")}) - ${proj.description}`
  ).join("\n");

  const systemInstruction = `
    Je bent een zoekmachine gespecialiseerd in 'Vrijwilligers Project Matching'.
    Je ontvangt gebruikersinteresses en een lijst met specifieke PROJECTEN.
    
    Jouw taak:
    1. Scan de interesses en achtergrond van de gebruiker.
    2. Zoek de beste matches in de PROJECT BESCHRIJVINGEN en TAGS.
    3. Puntentelling:
       - Directe skill/interesse match = 20 punten.
       - Contextuele match (bijv. 'buiten' past bij 'natuur') = 10 punten.
    4. Sorteer de projecten van HOOGSTE score naar LAAGSTE score.
    
    Geef in het veld 'reason' kort aan WAAROM dit project bij de gebruiker past.
  `;

  const userPrompt = `
    GEBRUIKER NAAM: ${userProfile.name}
    INTERESSES: "${userProfile.interests}"
    ACHTERGROND/ERVARING: "${userProfile.context}"
    
    BESCHIKBARE PROJECTEN:
    ${dbContext}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rankings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  score: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
                required: ["id", "score", "reason"]
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const parsed = JSON.parse(text);
    const rankings = parsed.rankings || [];

    // Koppel de AI scores terug aan de echte database objecten
    const scoredProjects = PROJECT_DATABASE.map((proj) => {
      const ranking = rankings.find((r: any) => r.id === proj.id);
      return {
        ...proj,
        score: ranking ? ranking.score : 0,
        reason: ranking ? ranking.reason : "Geen directe match gevonden."
      };
    });

    // Sorteer op score (hoog naar laag)
    const sorted = scoredProjects.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Pak de top 5
    const top5 = sorted.slice(0, 5);

    if (top5.length === 0) throw new Error("Geen resultaten");

    return top5;

  } catch (error) {
    console.error("Gemini Matching failed:", error);
    return fallbackMatching(userProfile);
  }
};
