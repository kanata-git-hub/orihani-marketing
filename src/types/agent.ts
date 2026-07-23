export interface AgentLog {
  id: string;
  timestamp: number;
  agentName: string;
  message: string;
  type: 'info' | 'working' | 'success' | 'warning' | 'error' | 'feedback';
}

export interface AgentResponse {
  role: string;
  content: string;
  score?: number;
  feedback?: string;
}

export interface FinalOutput {
  crawler: AgentResponse;
  jsonProcessor: AgentResponse;
  planner: AgentResponse;
  reviewer: AgentResponse;
  debateSummary?: string;
  finalTopic: string;
  finalTreatment?: string;
  format?: string;
  disease?: string;
  target?: string;
  situation?: string;
  treatments?: string[];
  category?: string;
  
  // Temporary legacy fallbacks, can eventually be removed if completely unused
  ceo?: AgentResponse;
  director?: AgentResponse;
}
