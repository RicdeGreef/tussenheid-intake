import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from 'lucide-react';

// Importeer jouw componenten
import { SwipeDeck } from './components/SwipeDeck';
import { Results } from './components/Results';
import { ChatInterface } from './components/ChatInterface';
import { getRankedMatches } from './services/geminiService';
import { Project, UserProfile } from './types';

// Vergeet CSS niet
import './index.css';

const queryClient = new QueryClient();

enum AppState {
  STARTUP,
  LOADING,
  SWIPING,
  RESULTS,
  INTAKE
}

const App = () => {
  // --- De logica van de Swipe App ---
  const [appState, setAppState] = useState<AppState>(AppState.STARTUP);
  const [matches, setMatches] = useState<Project[]>([]);
  const [likedProjects, setLikedProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: 'Gast', interests: '', context: '' });

  // Auto-start bij laden
  useEffect(() => {
    const startMatching = async () => {
      setAppState(AppState.LOADING);
      try {
        const guestProfile = { 
            name: "Gast", 
            interests: "sociaal duurzaam divers praktisch buiten", 
            context: "algemeen" 
        };
        setUserProfile(guestProfile);
        
        // Let op: Zorg dat je .env goed staat voor Supabase!
        const results = await getRankedMatches(guestProfile);
        setMatches(results);
        setAppState(AppState.SWIPING);
      } catch (error) {
        console.error("Matching failed", error);
        // Eventueel error state tonen
      }
    };

    startMatching();
  }, []);

  const handleFinishedSwiping = (liked: Project[]) => {
    setLikedProjects(liked);
    setAppState(AppState.RESULTS);
  };

  const handleStartIntake = (project: Project) => {
    setSelectedProject(project);
    setAppState(AppState.INTAKE);
  };

  const handleBackToResults = () => {
    setAppState(AppState.RESULTS);
    setSelectedProject(null);
  };

  const handleRestart = () => {
    window.location.reload();
  };

  // --- De Render (HTML) ---
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Deze Toasters zijn cruciaal voor de Chat app! */}
        <Toaster />
        <Sonner />

        <div className="min-h-screen w-full bg-[#1c3047] text-[#f1f3de] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md h-full flex flex-col">
            
            {/* Header */}
            {appState !== AppState.INTAKE && (
              <header className="text-center mb-8 flex-shrink-0">
                <h1 className="text-4xl font-black text-[#f1f3de] tracking-tight font-sans">Tussenheid</h1>
                <p className="text-[#dadcd1] mt-2 text-lg italic font-serif">
                  Vind jouw ideale vrijwilligersplek
                </p>
              </header>
            )}

            <main className="w-full flex-grow flex flex-col justify-center">
              
              {(appState === AppState.STARTUP || appState === AppState.LOADING) && (
                <div className="flex flex-col items-center justify-center h-64 bg-[#f1f3de] rounded-3xl text-[#1c3047] shadow-xl">
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-[#7b963a]" />
                  <p className="font-bold text-lg">Projecten ophalen...</p>
                </div>
              )}

              {appState === AppState.SWIPING && (
                <SwipeDeck 
                  projects={matches} 
                  onFinished={handleFinishedSwiping} 
                />
              )}

              {appState === AppState.RESULTS && (
                <Results 
                  likedProjects={likedProjects} 
                  userName={userProfile.name} 
                  onRestart={handleRestart}
                  onSelectProject={handleStartIntake}
                />
              )}

              {appState === AppState.INTAKE && selectedProject && (
                <div className="bg-white rounded-3xl overflow-hidden shadow-2xl h-[80vh] w-full border-4 border-[#dadcd1]">
                    <ChatInterface 
                        matchedProject={selectedProject}
                        onBack={handleBackToResults}
                    />
                </div>
              )}
            </main>
            
            {appState !== AppState.INTAKE && (
                <footer className="mt-8 text-center text-[#566171] text-xs flex-shrink-0">
                &copy; {new Date().getFullYear()} Tussenheid Vrijwilligersplatform
                </footer>
            )}
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;