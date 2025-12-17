import React from 'react';
import { Project } from '../types';
import { RefreshCw, ExternalLink, Building2, Briefcase, CheckCircle2 } from 'lucide-react';

interface ResultsProps {
  likedProjects: Project[];
  userName: string;
  onRestart: () => void;
  onSelectProject: (project: Project) => void;
}

export const Results: React.FC<ResultsProps> = ({ likedProjects, userName, onRestart, onSelectProject }) => {
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Background: Licht greige (#f1f3de) */}
      <div className="bg-[#f1f3de] rounded-3xl p-8 shadow-2xl border-b-4 border-[#dadcd1]">
        <div className="text-center mb-8">
            {/* Groen (#7b963a) */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#7b963a]/20 text-[#7b963a] mb-4">
                <CheckCircle2 size={24} />
            </div>
            <h2 className="text-2xl font-black text-[#1c3047]">Jouw Matches</h2>
            <p className="text-[#566171] mt-2 font-serif-italic">
            {likedProjects.length === 0 
                ? `Helaas ${userName}, geen matches gevonden.` 
                : `Top keuze ${userName}! Klik op een match om je aan te melden:`}
            </p>
        </div>

        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {likedProjects.map((proj, idx) => (
            <div 
              key={idx} 
              onClick={() => onSelectProject(proj)}
              className="bg-white border border-[#dadcd1] rounded-2xl p-6 hover:shadow-md transition-all group cursor-pointer hover:border-[#7b963a] hover:scale-[1.02]"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-[#7b963a]" />
                    <h3 className="text-xl font-bold text-[#1c3047] group-hover:text-[#7b963a] transition-colors">
                        {proj.organization}
                    </h3>
                </div>
                <ExternalLink size={18} className="text-[#dadcd1] group-hover:text-[#7b963a]" />
              </div>
              
              <p className="text-sm text-[#566171] mb-5 leading-relaxed pl-7 border-l-2 border-[#dadcd1] ml-2">
                {proj.description}
              </p>
              
              <div className="bg-[#1c3047] rounded-xl p-4 flex items-center gap-4 shadow-inner">
                <div className="p-3 bg-white/10 rounded-full">
                    <Briefcase size={20} className="text-[#f1f3de]" />
                </div>
                <div>
                    <span className="block text-xs text-[#dadcd1] font-bold uppercase tracking-wider mb-0.5">
                        Jouw Project / Rol
                    </span>
                    <span className="block text-lg font-bold text-white">
                        {proj.title}
                    </span>
                </div>
              </div>

              {proj.reason && (
                <div className="mt-4 text-xs text-[#566171] italic text-right font-serif-italic">
                  Match reden: {proj.reason}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onRestart}
          className="w-full mt-8 bg-[#566171] hover:bg-[#1c3047] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <RefreshCw size={20} />
          Opnieuw Beginnen
        </button>
      </div>
    </div>
  );
};