import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PipelineState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sharedTopic: string;
  sharedTreatment: string;
  sharedFormat: string;
  sharedDisease: string;
  sharedTarget: string;
  sharedSituation: string;
  sharedTreatments: string[];
  sharedTitle: string;
  sharedInstaContent: string;
  sharedScript: string[];
  sharedImage: string | null;
  sharedLastFrame: string | null;
  sharedBlogContent: string;
  sharedVideoUrl: string | null;
  sharedImagePrompt: string;
  sharedVideoPrompt: string;
  sharedCharacters: string[];
  sharedScenarioId: string;
  setSharedScenarioId: (id: string) => void;
  
  setSharedTopic: (topic: string) => void;
  setSharedTreatment: (treatment: string) => void;
  setSharedFormat: (format: string) => void;
  setSharedDisease: (disease: string) => void;
  setSharedTarget: (target: string) => void;
  setSharedSituation: (situation: string) => void;
  setSharedTreatments: (treatments: string[]) => void;
  setSharedTitle: (title: string) => void;
  setSharedInstaContent: (content: string) => void;
  setSharedScript: (script: string[]) => void;
  setSharedImage: (img: string | null) => void;
  setSharedLastFrame: (img: string | null) => void;
  setSharedBlogContent: (content: string) => void;
  setSharedVideoUrl: (url: string | null) => void;
  setSharedImagePrompt: (prompt: string) => void;
  setSharedVideoPrompt: (prompt: string) => void;
  setSharedCharacters: (chars: string[]) => void;
}

const PipelineContext = createContext<PipelineState | undefined>(undefined);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [sharedScenarioId, setSharedScenarioId] = useState('');
  const [activeTab, setActiveTab] = useState('topic');
  const [sharedTopic, setSharedTopic] = useState('');
  const [sharedTreatment, setSharedTreatment] = useState('');
  const [sharedFormat, setSharedFormat] = useState('');
  const [sharedDisease, setSharedDisease] = useState('');
  const [sharedTarget, setSharedTarget] = useState('');
  const [sharedSituation, setSharedSituation] = useState('');
  const [sharedTreatments, setSharedTreatments] = useState<string[]>([]);
  const [sharedTitle, setSharedTitle] = useState('');
  const [sharedInstaContent, setSharedInstaContent] = useState('');
  const [sharedScript, setSharedScript] = useState<string[]>([]);
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [sharedLastFrame, setSharedLastFrame] = useState<string | null>(null);
  const [sharedBlogContent, setSharedBlogContent] = useState('');
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);
  const [sharedImagePrompt, setSharedImagePrompt] = useState('');
  const [sharedVideoPrompt, setSharedVideoPrompt] = useState('');
  const [sharedCharacters, setSharedCharacters] = useState<string[]>([]);
  
  return (
    <PipelineContext.Provider value={{
      activeTab, setActiveTab,
      sharedScenarioId, setSharedScenarioId,
      sharedTopic, setSharedTopic,
      sharedTreatment, setSharedTreatment,
      sharedFormat, setSharedFormat,
      sharedDisease, setSharedDisease,
      sharedTarget, setSharedTarget,
      sharedSituation, setSharedSituation,
      sharedTreatments, setSharedTreatments,
      sharedTitle, setSharedTitle,
      sharedInstaContent, setSharedInstaContent,
      sharedScript, setSharedScript,
      sharedImage, setSharedImage,
      sharedLastFrame, setSharedLastFrame,
      sharedBlogContent, setSharedBlogContent,
      sharedVideoUrl, setSharedVideoUrl,
      sharedImagePrompt, setSharedImagePrompt,
      sharedVideoPrompt, setSharedVideoPrompt,
      sharedCharacters, setSharedCharacters
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (context === undefined) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
}