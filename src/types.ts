
export interface Project {
  id: number;
  title: string;           // Naam van het project
  description: string;     // Wat ga je doen?
  tags: string[];
  organization: string;    // De organisatie erachter (verborgen tijdens swipen)
  reason?: string;         // AI match reden
  score?: number;          // AI score
}

export interface UserProfile {
  name: string;
  interests: string;
  context: string;
}
