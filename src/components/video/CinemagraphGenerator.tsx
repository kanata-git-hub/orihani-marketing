import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon,  Play, Loader2, AlertCircle, CheckCircle2, RefreshCw, Sparkles, Download, Type, FileText, Trash2, History, X, Copy, Check } from 'lucide-react';
import { VideoHistoryItem, saveVideoToDB } from '../../hooks/useVideoHistory';
import { motion, AnimatePresence } from 'framer-motion';
import { GeminiService } from '../../services/video/geminiService';

import { usePipeline } from '../../context/PipelineContext';
import { useApiKey } from '../../hooks/useApiKey';
import { downloadFile } from '../../utils/downloadUtils';
import { CHARACTERS } from '../../constants';
import { compressImage } from '../../utils/imageUtils';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface GeneratorState {
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
}

interface CinemagraphGeneratorProps {
  state: GeneratorState;
  setState: React.Dispatch<React.SetStateAction<GeneratorState>>;
  history: VideoHistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<VideoHistoryItem[]>>;
}

export const CinemagraphGenerator = React.forwardRef<any, CinemagraphGeneratorProps>(({ state, setState, history, setHistory }, ref) => {
  const [innerTab, setInnerTab] = useState<'영상설정' | '레퍼런스' | '프롬프트' | '히스토리'>('프롬프트');
  const [copiedClip, setCopiedClip] = useState<number | null>(null);

  const getClipPrompts = (text: string) => {
    const prompts: string[] = [];
    const prompt1Match = text.match(/Prompt 1:\s*([\s\S]*?)(?=🎬 CLIP 2|Prompt 2|$)/i);
    if (prompt1Match) prompts.push(prompt1Match[1].trim());
    
    const prompt2Match = text.match(/Prompt 2:\s*([\s\S]*)/i);
    if (prompt2Match) prompts.push(prompt2Match[1].trim());
    
    return prompts;
  };

  const {
    diseaseName,
    situationDescription,
    image,
    lastFrameImage,
    referenceImages,
    selectedCharacterIds,
    isAutoLoadingRefs,
    videoPrompt,
    videoUrl,
    status,
    error,
    progress,
    aspectRatio,
    model,
    duration,
    resolution,
  } = state;

  const setDiseaseName = (val: string) => setState(prev => ({ ...prev, diseaseName: val }));
  const setSituationDescription = (val: string) => setState(prev => ({ ...prev, situationDescription: val }));
  const setImage = (val: { b64: string; mime: string; preview: string } | null) => setState(prev => ({ ...prev, image: val }));
  const setLastFrameImage = (val: { b64: string; mime: string; preview: string } | null) => setState(prev => ({ ...prev, lastFrameImage: val }));
  const setReferenceImages = (val: string[]) => setState(prev => ({ ...prev, referenceImages: val }));
  const setSelectedCharacterIds = (val: string[]) => setState(prev => ({ ...prev, selectedCharacterIds: val }));
  const setIsAutoLoadingRefs = (val: boolean) => setState(prev => ({ ...prev, isAutoLoadingRefs: val }));
  const setVideoPrompt = (val: string | null) => setState(prev => ({ ...prev, videoPrompt: val }));
  const setVideoUrl = (val: string | null) => setState(prev => ({ ...prev, videoUrl: val }));
  const setStatus = (val: GeneratorState['status']) => setState(prev => ({ ...prev, status: val }));
  const setError = (val: string | null) => setState(prev => ({ ...prev, error: val }));
  const setProgress = (val: number) => setState(prev => ({ ...prev, progress: val }));
  const setAspectRatio = (val: GeneratorState['aspectRatio']) => setState(prev => ({ ...prev, aspectRatio: val }));
  const setModel = (val: GeneratorState['model']) => setState(prev => ({ ...prev, model: val }));
  const setDuration = (val: GeneratorState['duration']) => setState(prev => ({ ...prev, duration: val }));
  const setResolution = (val: GeneratorState['resolution']) => setState(prev => ({ ...prev, resolution: val }));

  const { hasApiKey, setHasApiKey, handleOpenKeyDialog } = useApiKey();


  const { sharedTitle, sharedScript, sharedImage, sharedLastFrame, setSharedVideoUrl, sharedVideoPrompt, sharedCharacters } = usePipeline();

  useEffect(() => {
    if (sharedTitle) setDiseaseName(sharedTitle);
    if (sharedScript && sharedScript.length > 0) {
      setSituationDescription(sharedScript.join(' '));
    }
    if (sharedImage) {
      const mimeMatch = sharedImage.match(/data:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const b64 = sharedImage.split(',')[1] || sharedImage;
      setImage({ b64, mime, preview: sharedImage });
    }
    if (sharedLastFrame) {
      const mimeMatch = sharedLastFrame.match(/data:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const b64 = sharedLastFrame.split(',')[1] || sharedLastFrame;
      setLastFrameImage({ b64, mime, preview: sharedLastFrame });
    }
    if (sharedVideoPrompt) {
      setVideoPrompt(sharedVideoPrompt);
    }
  }, [sharedTitle, sharedScript, sharedImage, sharedLastFrame, sharedVideoPrompt]);

  useEffect(() => {
    if (sharedCharacters && sharedCharacters.length > 0) {
      // automatically load character references
      const loadChars = async () => {
        setReferenceImages([]);
        setSelectedCharacterIds(sharedCharacters);
        setIsAutoLoadingRefs(true);
        let newRefs: string[] = [];
        for (const charId of sharedCharacters) {
          const char = CHARACTERS.find(c => c.id === charId);
          if (!char) continue;
          const url = char.img; // Use only the front image
          if (url.startsWith('data:')) {
            newRefs.push(url);
          } else {
            try {
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                
                try {
                  const { compressImage } = await import('../../utils/imageUtils');
                  const compressed = await compressImage(dataUrl, 1280, 1280, 0.85); // refs don't need to be huge
                  newRefs.push(compressed);
                } catch (e) {
                  newRefs.push(dataUrl);
                }
              }
            } catch (e) {
              console.warn("Failed to load char image", e);
            }
          }
        }
        setReferenceImages(newRefs);
        setIsAutoLoadingRefs(false);
      };
      
      // if selectedCharacterIds isn't exactly the same as sharedCharacters, run the load
      const isSame = sharedCharacters.length === selectedCharacterIds?.length && sharedCharacters.every((v, i) => v === selectedCharacterIds?.[i]);
      if (!isSame) {
        loadChars();
      }
    }
  }, [sharedCharacters]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const { compressImage } = await import('../../utils/imageUtils');
          const compressedDataUrl = await compressImage(dataUrl, 1920, 1920, 0.85);
          const base64String = compressedDataUrl.split(',')[1];
          const mime = compressedDataUrl.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/)?.[1] || file.type;
          
          setImage({
            b64: base64String,
            mime: mime,
            preview: URL.createObjectURL(file), // original file preview
          });
        } catch (err) {
          console.error("Compression failed", err);
          const base64String = dataUrl.split(',')[1];
          setImage({
            b64: base64String,
            mime: file.type,
            preview: URL.createObjectURL(file),
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLastFrameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (lastFrameImage?.preview) {
        URL.revokeObjectURL(lastFrameImage.preview);
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const { compressImage } = await import('../../utils/imageUtils');
          const compressedDataUrl = await compressImage(dataUrl, 1920, 1920, 0.85);
          const base64String = compressedDataUrl.split(',')[1];
          const mime = compressedDataUrl.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/)?.[1] || file.type;
          
          setLastFrameImage({
            b64: base64String,
            mime: mime,
            preview: URL.createObjectURL(file),
          });
          setSelectedCharacterIds([]);
          setReferenceImages([]);
        } catch (err) {
          console.error("Compression failed", err);
          const base64String = dataUrl.split(',')[1];
          setLastFrameImage({
            b64: base64String,
            mime: file.type,
            preview: URL.createObjectURL(file),
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    setIsAutoLoadingRefs(true);
    let newSelectedIds = [...(selectedCharacterIds || [])];
    
    if (newSelectedIds.includes(characterId)) {
      newSelectedIds = newSelectedIds.filter(id => id !== characterId);
    } else {
      if (newSelectedIds.length >= 3) {
        newSelectedIds.shift(); // keep it max 3
      }
      newSelectedIds.push(characterId);
    }
    setSelectedCharacterIds(newSelectedIds);

    const newRefs: string[] = [];
    for (const id of newSelectedIds) {
      const char = CHARACTERS.find(c => c.id === id);
      if (char) {
        const url = char.img; // Use only the front image
        if (url.startsWith('data:')) {
          newRefs.push(url);
        } else {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const reader = new FileReader();
              const dataUrl = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              const compressed = await compressImage(dataUrl);
              newRefs.push(compressed);
            }
          } catch (e) {
            console.warn(`Failed to load char image for ${id}`, e);
          }
        }
      }
    }
    setReferenceImages(newRefs);
    setIsAutoLoadingRefs(false);
  };

  React.useImperativeHandle(ref, () => ({ generateCinemagraph, reset, handleDownload }));
  const generateCinemagraph = async () => {
    if (!image || !diseaseName) return;
    if (!videoPrompt) {
      setError("Please generate a scenario first.");
      return;
    }
    
    setStatus('generating');
    setError(null);
    setProgress(20);

    try {
      const generationKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || 'dummy';
      
      const generationGemini = new GeminiService(generationKey);
      let actualModel = duration === '12s' ? 'veo-3.1-generate-preview' : model;

      let finalVideoPrompt = videoPrompt;
      if (selectedCharacterIds && selectedCharacterIds?.length > 0 && !lastFrameImage) {
        const charOrder = selectedCharacterIds.map((id, index) => {
            const char = CHARACTERS.find(c => c.id === id);
            return char ? `Asset Reference Image ${index + 1}: ${char.name}` : ``;
        }).filter(Boolean).join('\n');

        finalVideoPrompt = `CRITICAL DIRECTIVE ON CHARACTER CONSISTENCY:
The attached ASSET REFERENCE IMAGES correspond directly to the targeted characters.
Character Mapping:
${charOrder}

You MUST perfectly match their 3D toy-style appearance, facial proportions, and outfits precisely to the reference images without any morphing. Do NOT morph them into realistic animals or humans.
Specific character rules:
- O-wonjang: Anthropomorphic white duck with a large round head. EXACTLY 2 small tufts of hair pointing upwards on top. Wearing round brown-framed glasses with small black oval eyes inside. Light pink rosy cheeks. Solid orange smooth duck bill and orange webbed feet. Wearing a white doctor's open coat over a crisp light blue collared shirt. Slim standard duck proportions, absolutely no human face, no human lips, no teeth, minimalist 3D plastic toy style.
- Nurse: Anthropomorphic white duck with a COMPLETELY SMOOTH round head (NO HAIR). Small black dot eyes, deep red rosy cheeks, NO GLASSES. Solid orange smooth duck bill and orange webbed feet. Wearing a light beige short-sleeved wrap-style top with a breast pocket (pen and thermometer inside) and dark navy pants. Minimalist 3D plastic toy style, absolutely no human face, no human lips, no teeth.
- Deok-i: Fat, completely naked yellow duck with a large round head. EXACTLY 3 small tufts of hair pointing upwards on top. Small black dot eyes, deep red rosy cheeks. Solid orange smooth duck bill and orange webbed feet. About the size of a human child. Minimalist 3D plastic toy style, absolutely no human face, no human lips, no teeth.

Follow the actions described below, but NEVER break this character consistency rule.

Video Scenario:
${videoPrompt}`;
      }

      // 👉 사용자가 UI에서 선택한 해상도(resolution)를 그대로 전달!
      let operation = await generationGemini.generateCinemagraph(image.b64, image.mime, finalVideoPrompt, {
        model: actualModel,
        aspectRatio,
        duration,
        resolution: resolution,
        referenceImages: lastFrameImage ? [] : referenceImages,
        lastFrameB64: lastFrameImage?.b64,
        lastFrameMime: lastFrameImage?.mime
      });
      setProgress(40);

      setStatus('polling');
      let completedOp = await generationGemini.pollOperation(operation);
      setProgress(60);

      if (duration === '12s') {
        setStatus('extending');
        const extensionOp = await generationGemini.extendVideo(completedOp, finalVideoPrompt, generationKey, {
           referenceImages: lastFrameImage ? [] : referenceImages
        });
        completedOp = await generationGemini.pollOperation(extensionOp);
        setProgress(90);
      }

      const downloadLink = completedOp.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch('/api/downloadVideo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uri: downloadLink })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch video through proxy.');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setSharedVideoUrl(url);
        setStatus('completed');
        setProgress(100);

        // Save to history
        import('../../hooks/useVideoHistory').then(({ loadVideoFromDB, saveVideoToDB }) => {
          loadVideoFromDB('video_history').then((savedHistory) => {
            const history = savedHistory || [];
            const newItem = {
              id: Date.now().toString(),
              diseaseName: diseaseName || 'Untitled',
              situationDescription: situationDescription || '',
              videoPrompt: videoPrompt || '',
              videoBlob: blob,
              createdAt: Date.now()
            };
            const updated = [newItem, ...history].slice(0, 10); // Keep last 10
            saveVideoToDB('video_history', updated).catch(e => console.error("Failed to save video history", e));
          });
        });

      } else {
        throw new Error('Failed to get video download link');
      }
    } catch (err: any) {
      console.error('Error generating cinemagraph:', err);
      if (err.message?.includes('Requested entity was not found')) {
        setHasApiKey(false);
        setError('API Key session expired. Please re-select your key.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    downloadFile(videoUrl, `cinemagraph-${(diseaseName || 'untitled').toLowerCase().replace(/\s+/g, '-')}.mp4`);
  };

  const downloadRefImage = () => {
    if (!image || !image.preview) return;
    downloadFile(image.preview, `구조된-썸네일-${Date.now()}.png`);
    alert('썸네일 구조 완료! 다운로드 폴더를 확인해 보세요.');
  };

  const reset = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    setState(prev => ({
      ...prev,
      diseaseName: '',
      situationDescription: '',
      image: null,
      videoUrl: null,
      status: 'idle',
      error: null,
      progress: 0,
    }));
  };


  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col gap-6 h-full min-h-0">
      
{/* 2. Preview (Only when running or completed) */}
      {(status !== 'idle' || videoUrl || error) && (
        <div className="bg-zinc-900 rounded-3xl overflow-hidden shadow-xl flex flex-col border border-zinc-800 min-h-[300px] md:min-h-[400px]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">프리뷰</span>
            {status === 'completed' && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Ready ({resolution})
              </span>
            )}
          </div>
          
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {videoUrl ? (
                <motion.video
                  key="video"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-8 space-y-4 max-w-sm"
                >
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={() => {
                      setStatus('idle');
                      setError(null);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-8 space-y-6 w-full max-w-xs"
                >
                  <div className="relative w-20 h-20 mx-auto">
                    <Loader2 className="w-full h-full text-zinc-700 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-mono text-zinc-500">{progress}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-400 text-sm font-medium animate-pulse">
                      {status === 'generating' && 'Waiting for Veo resources...'}
                      {status === 'polling' && 'Generating video frames...'}
                      {status === 'extending' && 'Extending duration...'}
                    </p>
                    <p className="text-zinc-600 text-xs">This may take up to 2-3 minutes.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 3. Tabs (Settings, Reference, Prompt, History) */}
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* Tabs */}
        <div className="flex bg-[#e8dfd1]/50 p-1 rounded-xl w-fit overflow-x-auto hide-scrollbar gap-0 shrink-0 mx-auto">
          {['영상설정', '레퍼런스', '프롬프트', '히스토리'].map(tab => (
            <button
              key={tab}
              onClick={() => setInnerTab(tab as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${
                innerTab === tab 
                  ? 'bg-white text-[#552c24] shadow-sm' 
                  : 'text-[#552c24]/60 hover:text-[#552c24]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="flex flex-col bg-white rounded-3xl border border-[#e8dfd1] overflow-hidden shadow-sm flex-1 min-h-0">
          <div className="p-5 md:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {innerTab === '영상설정' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">비율</label>
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <button
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${aspectRatio === '16:9' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    16:9
                  </button>
                  <button
                    onClick={() => {
                      setAspectRatio('9:16');
                      setDuration('8s');
                    }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${aspectRatio === '9:16' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    9:16
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">시간</label>
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <button
                    onClick={() => setDuration('8s')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${duration === '8s' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    8s
                  </button>
                  <button
                    onClick={() => {
                      setDuration('12s');
                      setAspectRatio('16:9');
                    }}
                    disabled={aspectRatio === '9:16'}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${duration === '12s' && aspectRatio !== '9:16' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'} ${aspectRatio === '9:16' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    12s
                  </button>
                </div>
                {aspectRatio === '9:16' && (
                  <p className="text-[10px] text-zinc-400 mt-2 italic">* 9:16 is limited to 8s.</p>
                )}
                {aspectRatio === '16:9' && duration === '12s' && (
                  <p className="text-[10px] text-zinc-400 mt-2 italic">* 12s requires 16:9 and Veo Pro.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">모델</label>
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      setModel('veo-3.1-fast-generate-preview');
                      if (resolution === '4k') setResolution('1080p');
                    }}
                    disabled={duration === '12s'}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${model === 'veo-3.1-fast-generate-preview' && duration !== '12s' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'} ${duration === '12s' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Veo Fast
                  </button>
                  <button
                    onClick={() => setModel('veo-3.1-generate-preview')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${model === 'veo-3.1-generate-preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    Veo Pro
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">화질</label>
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <button
                    onClick={() => setResolution('720p')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${resolution === '720p' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    720p
                  </button>
                  <button
                    onClick={() => setResolution('1080p')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${resolution === '1080p' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    1080p
                  </button>
                  <button
                    onClick={() => setResolution('4k')}
                    disabled={model === 'veo-3.1-fast-generate-preview'}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${resolution === '4k' && model !== 'veo-3.1-fast-generate-preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'} ${model === 'veo-3.1-fast-generate-preview' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    4K
                  </button>
                </div>
                {model === 'veo-3.1-fast-generate-preview' && (
                  <p className="text-[10px] text-zinc-400 mt-2 italic">* 4K is only available on Veo Pro.</p>
                )}
              </div>
            </div>
          )}

          {innerTab === '레퍼런스' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  시작 썸네일 
                  {image?.preview && (
                    <button onClick={downloadRefImage} className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      다운로드
                    </button>
                  )}
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${image ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'}`}
                >
                  {image ? (
                    <img src={image.preview} alt="Reference" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-600">클릭 시 시작 프레임 업로드</p>
                      <p className="text-xs text-gray-400 mt-1">16:9 나 9:16 추천</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  마지막 프레임 (선택)
                </label>
                <div 
                  onClick={() => lastFrameInputRef.current?.click()}
                  className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${lastFrameImage ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'}`}
                >
                  {lastFrameImage ? (
                    <img src={lastFrameImage.preview} alt="End Frame" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-600">클릭 시 마지막 프레임 업로드</p>
                      <p className="text-xs text-gray-400 mt-1">(옵션)</p>
                    </div>
                  )}
                  <input type="file" ref={lastFrameInputRef} onChange={handleLastFrameChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">캐릭터 레퍼런스</label>
                  {isAutoLoadingRefs && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
                </div>
                {lastFrameImage && (
                  <p className="text-xs text-amber-500 mb-2">※ 마지막 프레임이 설정된 경우 캐릭터 레퍼런스는 적용되지 않습니다.</p>
                )}
                
                {/* @ts-ignore */}
                <div className={`grid grid-cols-4 gap-2 ${lastFrameImage ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  {CHARACTERS.map(char => {
                    const isSelected = selectedCharacterIds?.includes(char.id);
                    return (
                      <button
                        key={char.id}
                        onClick={() => handleSelectCharacter(char.id)}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                          <img src={char.img} alt={char.name} className="w-full h-full object-cover" />
                        </div>
                        <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>{char.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {innerTab === '프롬프트' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">주제</label>
                <input
                  type="text"
                  value={diseaseName || ''}
                  onChange={(e) => setState(prev => ({ ...prev, diseaseName: e.target.value }))}
                  className="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  placeholder="No topic..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">상황 묘사</label>
                <textarea
                  value={situationDescription || ''}
                  onChange={(e) => setState(prev => ({ ...prev, situationDescription: e.target.value }))}
                  className="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  placeholder="No situation description..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">프롬프트 (AI 자동 생성)</label>
                </div>
                <textarea
                  value={videoPrompt || ''}
                  onChange={(e) => setState(prev => ({ ...prev, videoPrompt: e.target.value }))}
                  className="w-full h-40 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm text-zinc-700 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all custom-scrollbar"
                  placeholder="Generating optimized video prompt..."
                />
                {videoPrompt && getClipPrompts(videoPrompt).length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {getClipPrompts(videoPrompt).map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          navigator.clipboard.writeText(prompt);
                          setCopiedClip(idx);
                          setTimeout(() => setCopiedClip(null), 2000);
                        }}
                        className="flex-1 py-2 px-3 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        {copiedClip === idx ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600">복사 완료</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">클립 {idx + 1} 복사</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {innerTab === '히스토리' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">최근 작업</span>
                <button 
                  onClick={() => {
                    if (confirm('모든 히스토리를 삭제하시겠습니까?')) {
                      setHistory([]);
                      saveVideoToDB('video_history', []);
                    }
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              </div>
              
              {history?.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-sm">
                  아직 생성된 영상이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history?.map((item) => (
                    <div 
                      key={item.id}
                      className="group relative bg-zinc-50 rounded-2xl border border-black/5 overflow-hidden hover:border-zinc-300 transition-all cursor-pointer"
                      onClick={() => {
                        const url = URL.createObjectURL(item.videoBlob);
                        setState(prev => ({
                          ...prev,
                          diseaseName: item.diseaseName,
                          situationDescription: item.situationDescription,
                          videoPrompt: item.videoPrompt || null,
                          videoUrl: url,
                          status: 'completed',
                          progress: 100
                        }));
                      }}
                    >
                      <div className="aspect-video bg-zinc-100 relative">
                        <video 
                          src={URL.createObjectURL(item.videoBlob)} 
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => e.currentTarget.play()}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg">
                            <Play className="w-4 h-4 text-zinc-900 ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-white border-t border-black/5">
                        <h4 className="font-semibold text-xs text-zinc-900 truncate">{item.diseaseName}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-zinc-500">
                            {new Date(item.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('삭제하시겠습니까?')) {
                                setHistory(prev => {
                                  const updated = prev.filter(h => h.id !== item.id);
                                  saveVideoToDB('video_history', updated);
                                  return updated;
                                });
                              }
                            }}
                            className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
});
