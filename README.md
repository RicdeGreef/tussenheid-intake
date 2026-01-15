Deze handleiding is bedoeld voor een volgend projectteam om de applicatie binnen 15 minuten draaiende te krijgen. 
Stap 1: Code Ophalen & Installeren 

Clone de repository van GitHub: 
git clone [https://github.com/RicdeGreef/tussenheid-intake.git](https://github.com/RicdeGreef/tussenheid-intake.git) 
cd tussenheid-intake 
 
Installeer de benodigde packages (Frontend): 
npm install 
 
Stap 2: Supabase Project Aanmaken 

Maak een gratis account en project aan op Supabase.com. 
Ga naar Project Settings -> API. 
Kopieer de Project URL en de anon / public key. 
Stap 3: Omgevingsvariabelen Instellen (.env) 
Let op: Dit bestand staat niet op GitHub om beveiligingsredenen. Je moet dit zelf aanmaken. 
Maak in de hoofdmap van het project een bestand genaamd .env. 
Plak de volgende inhoud en vul jouw gegevens in: 
VITE_SUPABASE_URL=[https://jouw-project-id.supabase.co](https://jouw-project-id.supabase.co) 
VITE_SUPABASE_ANON_KEY=jouw-lange-anon-key-hier 
 
Stap 4: Backend (Edge Functions) Deployen 
De intelligentie van de app zit in de Edge Functions. Deze moet je uploaden naar jouw Supabase project. 
Installeer de Supabase CLI (indien nog niet aanwezig): npm install -g supabase. 
Login via de terminal: npx supabase login. 
Link je lokale map aan je online project (gebruik je Project ID uit de URL): 
npx supabase link --project-ref jouw-project-id 
 
Deploy de functies: 
npx supabase functions deploy match-projects --no-verify-jwt 
npx supabase functions deploy process-intake --no-verify-jwt 
 
Stap 5: API Keys Koppelen (Cruciaal!) 
De server heeft toegang nodig tot Google Gemini. Dit mag nooit in de frontend code staan. 
Ga naar het Supabase Dashboard -> Edge Functions. 
Klik op de functie match-projects. 
Ga naar Secrets (of beheer dit via Project Settings -> Edge Functions). 
Voeg een nieuw secret toe: 
Naam: GEMINI_API_KEY 
Waarde: Je Google AI Studio key (begint met AIza...). 
Sla op. De functie herstart automatisch. 
Stap 6: Starten 
Start de ontwikkelserver: 
npm run dev 
 
Open de browser op http://localhost:5173 (of de poort die in de terminal staat). De app is nu volledig operationeel. 
 
Tips 

Eerst de architectuur te analyseren 
Kijk goed hoe data, AI, frontend en backend met elkaar samenwerken. 
AI beperkt en doelgericht in te zetten 
Gebruik AI alleen waar het echt meerwaarde heeft (bijvoorbeeld ranking of selectie). 
De dataset verder uit te breiden 
Meer projecten en organisaties zorgen voor betere en realistischere matches. 
De input van gebruikers te verbeteren 
Vraag naar achtergrond, vaardigheden en ervaring in plaats van alleen interesses. 
Blijf testen met echte gebruikers 
Dit levert waardevolle inzichten op voor verdere optimalisatie. 
