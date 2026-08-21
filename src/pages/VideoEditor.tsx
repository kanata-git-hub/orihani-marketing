import React, { useState, useEffect, useRef } from 'react';
import { CinemagraphGenerator } from '../components/video/CinemagraphGenerator';
import { Sparkles, Play, Loader2, History, Trash2, Copy, Check, FileText, Hash } from 'lucide-react';
import { VideoHistoryItem, loadVideoFromDB, saveVideoToDB } from '../hooks/useVideoHistory';
import { loadScenarioHistory, ScenarioHistoryItem } from '../hooks/useScenarioHistory';

const getTtsChunks = (text: string): string[] => {
  if (!text) return [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+[\s]*|[^.!?\n]+$/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= 290) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

export default function VideoEditor() {
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const generatorRef = useRef<any>(null);
  const [latestBlogContent, setLatestBlogContent] = useState<any>(null);
  const [latestScenario, setLatestScenario] = useState<ScenarioHistoryItem | null>(null);
  const [copiedTTSIndex, setCopiedTTSIndex] = useState<number | null>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);

  useEffect(() => {
    try {
      const savedContent = localStorage.getItem('content_history');
      if (savedContent) {
        const parsed = JSON.parse(savedContent);
        if (parsed && parsed.length > 0) {
          setLatestBlogContent(parsed[0]);
        }
      }
      loadScenarioHistory().then(res => {
        if (res && res.length > 0) {
          setLatestScenario(res[0]);
        }
      }).catch(e => console.error(e));
    } catch (e) {
      console.error("Failed to parse content history", e);
    }
  }, []);


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
    aspectRatio: '9:16',
    model: 'veo-3.1-fast-generate-preview',
    duration: '8s',
    resolution: '1080p',
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
        
        {latestScenario?.rawPlan && (
          <div className="mb-4 flex flex-wrap items-center gap-2 shrink-0 bg-[#fffcf8] p-3 rounded-2xl border border-[#e8dfd1] shadow-sm z-10">
            <span className="text-sm font-bold text-[#552c24] px-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#d97706]" /> 마스터 시나리오 연동</span>
            <button
              onClick={() => {
                const plan = latestScenario.rawPlan;
                const scriptMatch = plan.match(/📱 화면 자막 & TTS[\s\S]*?(?=💬)/);
                const textToCopy = scriptMatch ? scriptMatch[0].trim() : plan;
                navigator.clipboard.writeText(textToCopy);
                setCopiedTTSIndex(999);
                setTimeout(() => setCopiedTTSIndex(null), 2000);
              }}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a] transition-colors flex items-center gap-2 border border-[#fde68a]"
            >
              {copiedTTSIndex === 999 ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              대본(자막) 복사
            </button>
            <button
              onClick={() => {
                const plan = latestScenario.rawPlan;
                const titleMatch = plan.match(/🎬 제목:\s*(.*)/);
                const title = titleMatch ? titleMatch[1] : latestScenario.title;
                const hashtagMatch = plan.match(/🏷️ 해시태그 5개:\s*(.*)/);
                const hashtags = hashtagMatch ? hashtagMatch[1] : '';
                const textToCopy = `${title}\n\n${hashtags}`;
                navigator.clipboard.writeText(textToCopy);
                setCopiedTitle(true);
                setTimeout(() => setCopiedTitle(false), 2000);
              }}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a] transition-colors flex items-center gap-2 border border-[#fde68a]"
            >
              {copiedTitle ? <Check className="w-4 h-4 text-green-600" /> : <Hash className="w-4 h-4" />}
              제목/태그 복사
            </button>
          </div>
        )}


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
