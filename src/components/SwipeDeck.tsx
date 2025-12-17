import React, { useState } from 'react';
import { Project } from '../types';
import { X, Heart, Info } from 'lucide-react';

interface SwipeDeckProps {
  projects: Project[];
  onFinished: (liked: Project[]) => void;
}

export const SwipeDeck: React.FC<SwipeDeckProps> = ({ projects, onFinished }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<Project[]>([]);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  const currentProject = projects[currentIndex];

  const handleSwipe = (dir: 'left' | 'right') => {
    setDirection(dir);
    
    // Slight delay to allow animation to play
    setTimeout(() => {
      if (dir === 'right') {
        setLiked(prev => [...prev, currentProject]);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= projects.length) {
        // If we swiped the last card, we need to pass the updated liked list
        const finalLiked = dir === 'right' ? [...liked, currentProject] : liked;
        onFinished(finalLiked);
      } else {
        setCurrentIndex(nextIndex);
        setDirection(null);
      }
    }, 300);
  };

  if (!currentProject) return null;

  const progress = ((currentIndex) / projects.length) * 100;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto h-[600px]">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-[#1c3047]/30 rounded-full mb-6 overflow-hidden">
        <div 
          className="h-full bg-[#7b963a] transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="relative w-full flex-grow perspective-1000">
        <div 
          className={`
            absolute inset-0 bg-[#f1f3de] border border-[#dadcd1] rounded-3xl p-6 shadow-2xl flex flex-col
            transition-all duration-300 ease-in-out transform origin-bottom
            ${direction === 'left' ? '-translate-x-full -rotate-12 opacity-0' : ''}
            ${direction === 'right' ? 'translate-x-full rotate-12 opacity-0' : ''}
          `}
        >
          {/* Tag / Index */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-mono text-[#566171] uppercase tracking-widest">
              Project {currentIndex + 1} / {projects.length}
            </span>
            {currentProject.reason && (
               <div className="group relative">
                 <Info size={16} className="text-[#566171] cursor-help hover:text-[#1c3047]" />
                 <div className="absolute right-0 top-6 w-48 p-3 bg-[#1c3047] rounded-lg text-xs text-[#f1f3de] z-50 hidden group-hover:block shadow-xl">
                    <span className="font-bold block mb-1">AI Match:</span>
                    {currentProject.reason}
                 </div>
               </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-grow flex flex-col justify-center">
            {/* Note: We intentionally show Project Title, NOT Organization Name here */}
            {/* Font Montserrat Black */}
            <h2 className="text-3xl font-black text-[#1c3047] mb-4 leading-tight">
              {currentProject.title}
            </h2>
            <p className="text-[#566171] text-lg leading-relaxed mb-6 font-medium">
              {currentProject.description}
            </p>
            
            <div className="flex flex-wrap gap-2 mt-auto">
              {currentProject.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-[#dadcd1] text-[#566171] rounded-full text-xs font-bold uppercase tracking-wide">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Background Card Effect (Visual stack) */}
        {currentIndex < projects.length - 1 && (
            <div className="absolute inset-0 bg-[#dadcd1] rounded-3xl transform scale-95 translate-y-4 -z-10 shadow-lg"></div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6 mt-8">
        <button 
          onClick={() => handleSwipe('left')}
          // Rood: #c52e26
          className="w-16 h-16 rounded-full bg-white border-2 border-[#c52e26]/10 flex items-center justify-center text-[#c52e26] hover:bg-[#c52e26] hover:text-white hover:scale-110 transition-all duration-200 shadow-lg"
        >
          <X size={32} />
        </button>
        <button 
          onClick={() => handleSwipe('right')}
          // Groen: #7b963a
          className="w-16 h-16 rounded-full bg-white border-2 border-[#7b963a]/10 flex items-center justify-center text-[#7b963a] hover:bg-[#7b963a] hover:text-white hover:scale-110 transition-all duration-200 shadow-lg"
        >
          <Heart size={32} fill="currentColor" className="opacity-100" />
        </button>
      </div>
    </div>
  );
};