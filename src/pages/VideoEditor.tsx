import React, { useState, useEffect, useRef } from 'react';
import { CinemagraphGenerator } from '../components/video/CinemagraphGenerator';
import { Sparkles, Play, Loader2, History, Trash2 } from 'lucide-react';
import { VideoHistoryItem, loadVideoFromDB, saveVideoToDB } from '../hooks/useVideoHistory';

export default function VideoEditor() {
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const generatorRef = useRef<any>(null);

  // Generator State
  const [generatorState, setGeneratorState] = useState<{
    diseaseName: string;
    situationDescription: string;
    image: { b64: string; mime: string; preview: string } | null;
    lastFrameImage: { b64: string; mime: string; preview: string } | null;
    referenceImages: string[];
    selectedCharacterIds: string[];
    isAutoLoadingRefs: boolean;
    videoPrompt: string | null;
    videoUrl: string | null;
    status: 'idle' | 'analyzing' | 'generating' | 'polling' | 'extending' | 'completed' | 'error';
    error: string | null;
    progress: number;
    aspectRatio: '16:9' | '9:16';
    model: 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
    duration: '8s' | '12s';
    resolution: '720p' | '1080p' | '4k';
  }>({
    diseaseName: '',
    situationDescription: '',
    image: null,
    lastFrameImage: null,
    referenceImages: [],
    selectedCharacterIds: [],
    isAutoLoadingRefs: false,
    videoPrompt: null,
    videoUrl: null,
    status: 'idle',
    error: null,
    progress: 0,
    aspectRatio: '16:9',
    model: 'veo-3.1-fast-generate-preview',
    duration: '8s',
    resolution: '720p',
  });

  // Load history on mount and when a new video is completed
  useEffect(() => {
    if (generatorState.status === 'completed' || generatorState.status === 'idle') {
      setTimeout(() => {
        loadVideoFromDB('video_history').then((savedHistory) => {
          if (savedHistory) {
            setHistory(savedHistory);
          }
        }).catch(e => console.error("Failed to load video history", e));
      }, 500);
    }
  }, [generatorState.status]);

  const handleGenerate = () => {
    if (generatorRef.current) {
      generatorRef.current.generateCinemagraph();
    }
  };

  const { status, image, videoPrompt, resolution } = generatorState;
  const canGenerate = image && videoPrompt && (status === 'idle' || status === 'error' || status === 'completed');

  return (
    <div className="absolute inset-0 bottom-16 md:bottom-0 flex flex-col bg-[#fffcf8]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 md:h-16 py-3 md:py-0 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">영상 제작</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status === 'completed' && (
              <>
                <button
                  onClick={() => generatorRef.current?.handleDownload()}
                  className="px-4 py-2 rounded-xl font-bold text-sm bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all flex items-center gap-2"
                >
                  다운로드
                </button>
                <button
                  onClick={() => generatorRef.current?.reset()}
                  className="px-4 py-2 rounded-xl font-bold text-sm bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all flex items-center gap-2"
                >
                  초기화
                </button>
              </>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 ${canGenerate ? 'bg-[#552c24] text-[#ffcd4a] hover:bg-[#3d1f19]' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
            >
              {status === 'idle' || status === 'error' || status === 'completed' ? (
                <>
                  <Play className="w-4 h-4" />
                  생성
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {status === 'generating' && `Initializing Veo (${resolution})...`}
                  {status === 'polling' && `Crafting Video (${resolution})...`}
                  {status === 'extending' && 'Extending to 12s...'}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 w-full flex-1 overflow-hidden flex flex-col">
        <CinemagraphGenerator 
          ref={generatorRef}
          state={generatorState} 
          setState={setGeneratorState}
          history={history}
          setHistory={setHistory}
        />

      </main>
    </div>
  );
}
