
export interface Project {
  id: string; // A unique identifier, e.g., 'project-chimera'
  name: string;
  vision: string;
  goal: string;
  offer: string;
  investorTarget: number;
  investmentAmount: number;
}

export interface Investment {
  projectId: string;
  userId: string;
  timestamp: number;
}

export type NewProjectInput = Omit<Project, 'id'>;
