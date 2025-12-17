import React, { useState, useEffect } from 'react';
import { SwipeDeck } from './components/SwipeDeck';
import { Results } from './components/Results';
import { ChatInterface } from './components/ChatInterface'; 
import { Project, UserProfile } from './types';
import { getRankedMatches } from './services/geminiService';
import { Loader2 } from 'lucide-react';
import './index.css';

enum AppState {
  STARTUP,
  LOADING,
  SWIPING,
  RESULTS,
  INTAKE
}

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.STARTUP);
  const [matches, setMatches] = useState<Project[]>([]);
  const [likedProjects, setLikedProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: 'Gast', interests: '', context: '' });

  // AUTO-START: Zodra de app opent, begin met zoeken naar projecten
  useEffect(() => {
    const startMatching = async () => {
      setAppState(AppState.LOADING);
      try {
        // We gebruiken een dummy profiel om breed te zoeken
        const guestProfile = { 
            name: "Gast", 
            interests: "sociaal duurzaam divers praktisch buiten", 
            context: "algemeen" 
        };
        setUserProfile(guestProfile);
        
        const results = await getRankedMatches(guestProfile);
        setMatches(results);
        setAppState(AppState.SWIPING);
      } catch (error) {
        console.error("Matching failed", error);
        // Fallback: Als API faalt, kunnen we hier evt hardcoded data tonen
      }
    };

    startMatching();
  }, []);

  const handleFinishedSwiping = (liked: Project[]) => {
    setLikedProjects(liked);
    setAppState(AppState.RESULTS);
  };

  const handleStartIntake = (project: Project) => {
    console.log("Starting intake for:", project.title);
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

  return (
    <div className="min-h-screen w-full bg-[#1c3047] text-[#f1f3de] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md h-full flex flex-col">
        
        {/* Header (verbergen tijdens intake voor focus) */}
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
              <p className="text-sm text-[#566171] mt-2 italic">Even geduld a.u.b.</p>
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
  );
}

export default App;