import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; 
import { 
  Image as ImageIcon, 
  Sparkles, 
  Upload, 
  Download, 
  RefreshCw, 
  Settings2, 
  Search,
  Check,
  AlertCircle,
  ChevronRight,
  Edit3,
  History,
  Trash2 
} from 'lucide-react';
import { 
  generateImage, 
  editImage, 
  ImageModel, 
  ImageSize, 
  AspectRatio,
  RefImage
} from '../services/thumbnail/geminiService';

import { usePipeline } from '../context/PipelineContext';
import { ThumbnailHistoryItem, saveToDB, loadFromDB } from '../hooks/useThumbnailHistory';
import { compressImage, generateSecondImage } from '../utils/canvasUtils';
import { useApiKey } from '../hooks/useApiKey';
import { downloadFile } from '../utils/downloadUtils';
import { CHARACTERS } from '../constants';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const MODELS: { id: ImageModel; name: string; description: string }[] = [
  { 
    id: 'gemini-3.1-flash-image', 
    name: 'Nano Banana 2 (Flash)', 
    description: '' 
  }
];

const SIZES: ImageSize[] = ['512px', '1K', '2K', '4K'];
const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '1:1', label: '1:1' },
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' },
  { id: '3:4', label: '3:4' }
];

const DEFAULT_CHARACTER = "A cute, round, yellow 3D duck character named 'Duckie' with a friendly expression, small orange beak, and expressive eyes.";
const DEFAULT_STYLE = "Vibrant, high-quality 3D render style, clean lighting, Instagram thumbnail aesthetic, bold colors, clear subject focus, professional composition. Cultural consistency: If any background characters or extras appear, they must wear general modern clothing or Korean traditional Hanbok. Avoid any traditional clothing from other cultures. Medical/Health theme: Strictly avoid Western medicine elements (e.g., pills, capsules, syringes, Western stethoscopes). CRITICAL: ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO SYMBOLS, NO LOGOS, NO SIGNAGE. The image must be completely textless and clean.";

export default function InstaThumbnail() {
  const [title, setTitle] = useState('');
  const [secondImageText, setSecondImageText] = useState('오리한의원과 함께하는\n건강한 다이어트');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('gemini-3.1-flash-image');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('2K');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('9:16');
  const [referenceImages, setReferenceImages] = useState<RefImage[]>([]);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [isAutoLoadingRefs, setIsAutoLoadingRefs] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [secondGeneratedImage, setSecondGeneratedImage] = useState<string | null>(null);
  const [generatedLastFrame, setGeneratedLastFrame] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasAutoLoadedChars, setHasAutoLoadedChars] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sharedTitle, sharedInstaContent, setSharedImage, setSharedLastFrame, sharedImagePrompt, sharedCharacters } = usePipeline();
  const { hasApiKey: isApiKeySet, setHasApiKey: setIsApiKeySet, handleOpenKeyDialog } = useApiKey();
  const [history, setHistory] = useState<ThumbnailHistoryItem[]>([]);

  useEffect(() => {
    loadDefaultReferences();
    
    // 🚀 대형 창고(IndexedDB)에서 히스토리 불러오기
    loadFromDB('thumbnail_history').then((savedHistory) => {
      if (savedHistory) {
        setHistory(savedHistory);
      }
    }).catch(e => console.error("Failed to load history from DB", e));
  }, []);

  const [localImagePrompt, setLocalImagePrompt] = useState('');
  useEffect(() => {
    if (sharedTitle) setTitle(sharedTitle);
    if (sharedInstaContent) setSecondImageText(sharedInstaContent);
    if (sharedImagePrompt) setLocalImagePrompt(sharedImagePrompt);
  }, [sharedTitle, sharedInstaContent, sharedImagePrompt]);

  useEffect(() => {
    if (hasAutoLoadedChars) return;

    let charIdsToLoad = [];
    
    if (sharedCharacters && sharedCharacters.length > 0) {
      charIdsToLoad = sharedCharacters;
    } else if (sharedImagePrompt) {
      const text = sharedImagePrompt.toLowerCase();
      if (text.includes('o-wonjang') || text.includes('owonjang') || text.includes('오원장')) charIdsToLoad.push('owonjang');
      if (text.includes('somi') || text.includes('간호사') || text.includes('소미')) charIdsToLoad.push('somi');
      if (text.includes('deok-i') || text.includes('deoki') || text.includes('덕이')) charIdsToLoad.push('deoki');
    }

    if (charIdsToLoad.length > 0) {
      const loadChars = async () => {
        setReferenceImages([]); // clear
        for (const charId of charIdsToLoad) {
          await handleSelectCharacter(charId);
        }
        setHasAutoLoadedChars(true);
      };
      loadChars();
    }
  }, [sharedCharacters, sharedImagePrompt, hasAutoLoadedChars]);

  // 🚀 대형 창고에 안전하게 저장하기 (최대 10개로 증가!)
  const saveToHistory = (img1: string, img2: string | null, img3: string | null = null) => {
    if (!title) return;
    const newItem: ThumbnailHistoryItem = {
      id: Date.now().toString(),
      title,
      model: MODELS.find(m => m.id === selectedModel)?.name || selectedModel,
      img1,
      img2,
      img3,
      createdAt: Date.now(),
    };
    
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 10); 
      saveToDB('thumbnail_history', updated).catch(e => console.error("DB Save Error", e));
      return updated;
    });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveToDB('thumbnail_history', updated).catch(e => console.error("DB Delete Error", e));
      return updated;
    });
  };

  const loadHistoryItem = (item: ThumbnailHistoryItem) => {
    setTitle(item.title);
    setGeneratedImage(item.img1);
    setSecondGeneratedImage(item.img2);
    setGeneratedLastFrame(item.img3 || null);
    setSharedImage(item.img1); 
    setSharedLastFrame(item.img3 || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadDefaultReferences = async () => {
    setIsAutoLoadingRefs(true);
    
    try {
      const res = await fetch('/icon.png');
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0 && blob.type.startsWith('image/')) {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          setLogoImage(dataUrl);
        }
      }
    } catch (e) {
      console.warn("Failed to load logo", e);
    }

    setIsAutoLoadingRefs(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setReferenceImages(prev => [...prev, { url: reader.result as string, label: 'User Uploaded Reference' }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectCharacter = async (characterId: string) => {
    setIsAutoLoadingRefs(true);
    const char = CHARACTERS.find(c => c.id === characterId);
    if (!char) {
      setIsAutoLoadingRefs(false);
      return;
    }
    
    const newRefs: RefImage[] = [];
    for (const url of char.imgs) {
      if (url.startsWith('data:')) {
        newRefs.push({ url, label: char.name });
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
            newRefs.push({ url: dataUrl, label: char.name });
          }
        } catch (e) {
          console.warn("Failed to load char image", e);
        }
      }
    }
    
    // Append instead of replacing
    setReferenceImages(prev => {
      const merged = [...prev];
      for (const ref of newRefs) {
        if (!merged.find(r => r.url === ref.url)) {
          merged.push(ref);
        }
      }
      return merged;
    });
    setIsAutoLoadingRefs(false);
  };


  const handleGenerate = async () => {
    if (!title) return;
    setIsGenerating(true);
    setError(null);
    setIsEditing(false);
    setGeneratedImage(null);
    setSecondGeneratedImage(null);

    try {
      const characterInstruction = referenceImages.length > 0
        ? `CRITICAL REFERENCE REQUIREMENT:
The images provided alongside this prompt are EXACT reference sheets for the 3D subculture characters you must draw. 
- You MUST preserve their exact 3D simplistic toy style, facial proportions, and visual identity.
- DO NOT draw a generic duck or a realistic duck. You must perfectly replicate the smooth, stylized 3D mascot design shown in the references.
- DO NOT give them human skin, human mouths, or human teeth. They have seamless smooth duck bills and distinct facial expressions as shown in the images.
- Re-create these specific characters faithfully in the new action and environment requested below.`
        : DEFAULT_CHARACTER;

      let promptsToGenerate: string[] = [];
      const sceneMatches = [...(localImagePrompt || '').matchAll(/- \*\*(?:Scene|Clip) \d+.*?\*\*:?([^]*?)(?=- \*\*|$)/gi)];

      if (sceneMatches.length > 0) {
        promptsToGenerate = sceneMatches.map(m => `${characterInstruction}\n\n${m[1].trim()}`);
      } else if (localImagePrompt && localImagePrompt.includes('ART & VISUAL DIRECTION')) {
        promptsToGenerate = [`${characterInstruction}\n\n${localImagePrompt}`];
      } else {
        const basePrompt = `[Task]
Create a high-quality Instagram thumbnail based on the blog context.
Medium: vertical smartphone POV photo or cinematic shot.

${characterInstruction}

Action/Scene: ${title}
Blog Context/Subtitle: ${secondImageText}
Specific Visual Scenario: ${localImagePrompt || 'Ensure the image corresponds closely with the Action/Scene.'}

[ART & VISUAL DIRECTION]
Blend of Pixar and anime inspiration, 3D cartoon rendering style. Glossy lighting effects, bright and vibrant color palette. Cinematic lighting setup. Highly expressive and adorable facial emotions. Photorealistic background with seamless integration.

[STRICT CONTINUITY AND PHYSICS RULES]
1. Text in Images (CRITICAL): NEVER generate any garbled, fake, or nonsense text (squiggles). If the prompt does not explicitly request specific English text, ensure screens, papers, and signs are completely blank. Do NOT generate any Korean text.
2. MEDICAL/HEALTH: Strictly avoid Western medicine elements (e.g., pills, capsules, syringes, Western stethoscopes). This is an Oriental Medicine Clinic context.
3. EXTRAS: Minimize background characters unless essential. If extras are present, they MUST wear modern casual clothing or Korean Hanbok. Strictly avoid traditional attire from other countries.
4. ABSOLUTELY NO LOGOS, NO SIGNAGE, NO WATERMARKS. The image must be clean.
5. NO CLIPPING: If the character interacts with a physical object (desk, bed), their body must rest on it physically with realistic contact shadows.
6. IDENTITY: If the character's back is turned to the camera, state clearly "Back of head visible ONLY. Do NOT draw facial features (eyes, mouth, red cheeks) on the back of the head".

[ENVIRONMENT & ACTION]
Environment: Create a warm, cozy atmosphere with wooden elements. If in a clinic, use Oriental Medicine Clinic aesthetics (wooden medicine cabinets, warm lighting).
Action: The character must be the central focus, executing the action described in "${title}" and reflecting the mood of "${secondImageText}". Focus on office worker fatigue, pain, or Oriental Medicine treatments (acupuncture, cupping, chuna, etc.). Give them a highly expressive, relatable facial expression.`;
        promptsToGenerate = [basePrompt];
      }

      const limitedRefs = referenceImages.slice(0, 9);
      const totalPayloadSize = limitedRefs.reduce((acc, img) => acc + img.url.length, 0);
      console.log(`Generating image with ${limitedRefs.length} reference images. Total payload size: ${(totalPayloadSize / 1024 / 1024).toFixed(2)} MB`);

      const generatedResults: string[] = [];
      for (let i = 0; i < promptsToGenerate.length; i++) {
        let currentPrompt = promptsToGenerate[i];
        let currentRefs: (string | RefImage)[] = [...limitedRefs];

        if (i > 0 && generatedResults.length > 0) {
          currentRefs.unshift(generatedResults[i - 1]);
          currentPrompt = `[MAINTAIN ENVIRONMENT CONSISTENCY]\nThe very first provided reference image is the PREVIOUS SCENE. If the environment/location in this prompt is the same as the previous scene, you MUST perfectly replicate the background, lighting, and general setting from that first reference image to maintain continuity.\n\n` + currentPrompt;
        }

        const result = await generateImage({
          model: selectedModel,
          prompt: currentPrompt,
          aspectRatio: selectedRatio,
          imageSize: selectedSize,
          referenceImages: currentRefs.slice(0, 9), // Keep it within any potential limits
        });
        if (result) {
          generatedResults.push(result);
        }
      }

      if (generatedResults.length > 0) {
        const firstResult = generatedResults[0];
        setGeneratedImage(firstResult);
        setSharedImage(firstResult); 
        
        let secondImg: string | null = null;
        if (secondImageText) {
          secondImg = await generateSecondImage(firstResult, secondImageText, logoImage);
          setSecondGeneratedImage(secondImg);
        }

        let lastResult: string | null = null;
        if (generatedResults.length > 1) {
          lastResult = generatedResults[generatedResults.length - 1];
          setGeneratedLastFrame(lastResult);
          setSharedLastFrame(lastResult);
        }

        saveToHistory(firstResult, secondImg, lastResult);
      } else {
        setError("Failed to generate image. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.status === 'UNAVAILABLE' || err.code === 503 || err.message?.includes('503')) {
        setError("현재 AI 모델 사용량이 많아 일시적으로 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
      } else if (err.message?.includes("Requested entity was not found")) {
        setError("API 키가 유효하지 않거나 설정되지 않았습니다.");
        setIsApiKeySet(false);
      } else {
        setError(err.message || "이미지 생성 중 오류가 발생했습니다.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!title || !generatedImage) return;
    setIsGenerating(true);
    setError(null);
    setIsEditing(true);

    try {
      const result = await editImage(generatedImage, title, selectedModel);
      if (result) {
        setGeneratedImage(result);
        setSharedImage(result);
        
        let secondImg: string | null = null;
        if (secondImageText) {
          secondImg = await generateSecondImage(result, secondImageText, logoImage);
        }
        
        saveToHistory(result, secondImg);
      } else {
        setError("Failed to edit image.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during editing.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (img: string, name: string) => {
    downloadFile(img, `${name}-${Date.now()}.png`);
  };

  const [activeTabLocal, setActiveTabLocal] = useState<'character' | 'plan' | 'settings' | 'result' | 'history'>('plan');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#ffcd4a] flex items-center justify-center shadow-sm">
              <ImageIcon className="text-[#552c24] w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800">썸네일</h1>
          </div>
             
          {!isApiKeySet && (
            <button 
              onClick={handleOpenKeyDialog}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <Settings2 size={16} />
              API 키 연결
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col flex-1 overflow-hidden gap-4 min-h-0">
        <div className="flex bg-[#e8dfd1]/50 p-1 rounded-xl w-fit overflow-x-auto hide-scrollbar gap-0 shrink-0 mx-auto">
          <button 
            onClick={() => setActiveTabLocal('character')}
            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'character' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
          >
            캐릭터
          </button>
          <button 
            onClick={() => setActiveTabLocal('plan')}
            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'plan' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
          >
            기획
          </button>
          <button 
            onClick={() => setActiveTabLocal('settings')}
            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'settings' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
          >
            생성 설정
          </button>
          <button 
            onClick={() => setActiveTabLocal('result')}
            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'result' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
          >
            결과
          </button>
          <button 
            onClick={() => setActiveTabLocal('history')}
            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'history' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
          >
            히스토리
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {activeTabLocal === 'character' && (
            <section className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-gray-200 overflow-y-auto custom-scrollbar h-full flex flex-col min-h-0">
              <h2 className="text-sm font-bold mb-4 shrink-0">캐릭터</h2>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2 mb-2">
                  {CHARACTERS.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => handleSelectCharacter(c.id)}
                      className="flex text-xs items-center gap-2 pr-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                    >
                      <img src={c.img} alt={c.name} className="w-6 h-6 rounded-full object-cover bg-gray-100" />
                      <span className="font-bold text-gray-700">{c.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setReferenceImages([])}
                    className="flex text-xs items-center px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full hover:bg-red-100 transition-colors font-bold"
                  >
                    초기화
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  {isAutoLoadingRefs && (
                    <div className="flex items-center gap-2 mb-4 text-xs text-gray-400 animate-pulse font-bold">
                      <RefreshCw size={14} className="animate-spin" />
                      기본 레퍼런스 이미지를 불러오는 중...
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {referenceImages.map((imgItem, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                        <img src={imgItem.url} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeReferenceImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square bg-white rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-400"
                    >
                      <Upload size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0">
                      <ImageIcon size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-700">총 {referenceImages.length}장의 이미지</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                        여러 장의 이미지를 올리면 캐릭터의 생김새를 더 정확하게 유지합니다.
                      </p>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                    multiple
                  />
                </div>
              </div>
            </section>
          )}

          {activeTabLocal === 'plan' && (
            <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-200 overflow-y-auto custom-scrollbar h-full flex flex-col min-h-0 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">프롬프트</label>
                <textarea 
                  value={localImagePrompt || ""}
                  onChange={(e) => setLocalImagePrompt(e.target.value)}
                  placeholder="스크립트 기반 시각화 명세..."
                  className="w-full h-16 bg-blue-50/50 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white border border-blue-100 transition-all resize-none text-blue-900 custom-scrollbar"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">썸네일 제목</label>
                <textarea 
                  value={title || ""}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="무엇에 관한 썸네일인가요? (예: 맛있는 커피 만들기)"
                  className="w-full h-[66px] bg-gray-50 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white border border-gray-200 transition-all resize-none custom-scrollbar"
                />
              </div>

              <div className="space-y-2 flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">내용(8줄이내)</label>
                <textarea 
                  value={secondImageText || ""}
                  onChange={(e) => setSecondImageText(e.target.value)}
                  placeholder={"2번째 장의 중간에 들어갈 문구를 입력하세요.\n(엔터로 줄바꿈, 최대 8줄 권장)"}
                  className="w-full h-[86px] bg-gray-50 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white border border-gray-200 transition-all resize-none leading-relaxed custom-scrollbar"
                />

              </div>
            </section>
          )}

          {activeTabLocal === 'settings' && (
            <section className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-gray-200 overflow-y-auto custom-scrollbar h-full flex flex-col min-h-0 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">생성 모델</label>
                <div className="grid grid-cols-1 gap-2">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedModel === m.id 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="font-bold text-sm">{m.name}</div>
                      {m.description && <div className={`text-[10px] mt-0.5 ${selectedModel === m.id ? 'text-gray-400' : 'text-gray-400'}`}>{m.description}</div>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">해상도</label>
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedSize === s 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">비율</label>
                <div className="flex gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRatio(r.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedRatio === r.id 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {!isApiKeySet && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-600 font-bold leading-relaxed">
                    이 모델을 사용하려면 유료 Gemini API 키를 연결해야 합니다.
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline ml-1">자세히 알아보기</a>
                  </p>
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3"
                >
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-600 font-bold leading-relaxed">{error}</p>
                </motion.div>
              )}

              <div className="pt-4 flex gap-3 mt-auto">
                <button 
                  onClick={async () => {
                    setActiveTabLocal('result');
                    await handleGenerate();
                  }}
                  disabled={isGenerating || !title || !isApiKeySet}
                  className="flex-1 bg-black text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-all shadow-lg shadow-black/10"
                >
                  {isGenerating && !isEditing ? <RefreshCw className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  생성하기
                </button>
                {generatedImage && (
                  <button 
                    onClick={async () => {
                      setActiveTabLocal('result');
                      await handleEdit();
                    }}
                    disabled={isGenerating || !title}
                    className="w-14 h-14 bg-gray-100 text-gray-600 border border-gray-200 rounded-2xl flex items-center justify-center hover:bg-gray-200 disabled:opacity-50 transition-all"
                    title="재편집"
                  >
                    {isGenerating && isEditing ? <RefreshCw className="animate-spin w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </section>
          )}

          {activeTabLocal === 'result' && (
            <section className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-gray-200 overflow-y-auto custom-scrollbar h-full flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4 shrink-0">
                <h2 className="text-xl font-bold tracking-tight">결과</h2>
                <div className="flex gap-2">
                  {generatedImage && (
                    <button 
                      onClick={() => downloadImage(generatedImage, 'thumbnail-1')}
                      className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-600"
                      title="Download Image 1"
                    >
                      <Download size={18} />
                    </button>
                  )}
                  {secondGeneratedImage && (
                    <button 
                      onClick={() => downloadImage(secondGeneratedImage, 'thumbnail-2')}
                      className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-600"
                      title="Download Image 2"
                    >
                      <Download size={18} />
                    </button>
                  )}
                  {generatedLastFrame && (
                    <button 
                      onClick={() => downloadImage(generatedLastFrame, 'thumbnail-last')}
                      className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-600"
                      title="Download Last Frame"
                    >
                      <Download size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-8 flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-4 py-20"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-gray-100 rounded-full" />
                        <div className="absolute top-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg mb-1">이미지를 그리고 있습니다...</p>
                        <p className="text-xs text-gray-400 font-bold">약 10초에서 20초 정도 소요됩니다.</p>
                      </div>
                    </motion.div>
                  ) : generatedImage ? (
                    <motion.div 
                      key="results"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8 overflow-y-auto custom-scrollbar pr-2"
                    >
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">1번째 이미지: 메인 썸네일</div>
                        <div className={`rounded-3xl overflow-hidden bg-gray-50 border border-gray-200 mx-auto ${
                          selectedRatio === '1:1' ? 'aspect-square max-h-[500px]' : 
                          selectedRatio === '16:9' ? 'aspect-video w-full' : 
                          selectedRatio === '9:16' ? 'aspect-[9/16] max-h-[500px]' : 
                          'aspect-[3/4] max-h-[500px]'
                        }`}>
                          <img 
                            src={generatedImage} 
                            alt="Generated 1" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>

                      {generatedLastFrame && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">마지막 장면 이미지</div>
                          <div className={`rounded-3xl overflow-hidden bg-gray-50 border border-gray-200 mx-auto ${
                            selectedRatio === '1:1' ? 'aspect-square max-h-[500px]' : 
                            selectedRatio === '16:9' ? 'aspect-video w-full' : 
                            selectedRatio === '9:16' ? 'aspect-[9/16] max-h-[500px]' : 
                            'aspect-[3/4] max-h-[500px]'
                          }`}>
                            <img 
                              src={generatedLastFrame} 
                              alt="Generated Last Frame" 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>
                      )}

                      {secondGeneratedImage && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">텍스트 오버레이 이미지 (옵션)</div>
                          <div className={`rounded-3xl overflow-hidden bg-gray-50 border border-gray-200 mx-auto ${
                            selectedRatio === '1:1' ? 'aspect-square max-h-[500px]' : 
                            selectedRatio === '16:9' ? 'aspect-video w-full' : 
                            selectedRatio === '9:16' ? 'aspect-[9/16] max-h-[500px]' : 
                            'aspect-[3/4] max-h-[500px]'
                          }`}>
                            <img 
                              src={secondGeneratedImage} 
                              alt="Generated 2" 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center py-32 opacity-20"
                    >
                      <ImageIcon size={64} strokeWidth={1.5} />
                      <p className="mt-4 font-bold">기획을 확인하고 생성하기 버튼을 누르세요</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {error && !isGenerating && !generatedImage && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 mt-auto shrink-0"
                  >
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-red-600 font-bold leading-relaxed">{error}</p>
                  </motion.div>
                )}
              </div>
            </section>
          )}

          {activeTabLocal === 'history' && (
            <section className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-gray-200 h-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 shrink-0 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-600">히스토리</h3>
                </div>
                <p className="text-[10px] font-bold text-gray-400">* 최근 10개의 생성 기록만 저장됩니다.</p>
              </div>
              
              {history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {history.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3 group relative cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all" onClick={() => loadHistoryItem(item)}>
                      <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative bg-white">
                        <img src={item.img1} alt="History 1" className="w-full h-full object-cover" />
                        {item.img2 && (
                          <img src={item.img2} alt="History 2" className="absolute bottom-1 right-1 w-1/3 aspect-square rounded-md border-2 border-white shadow-sm object-cover" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800 truncate pr-6">{item.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {new Date(item.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); deleteHistoryItem(item.id);}} className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[#e8dfd1] bg-gray-50 rounded-3xl p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-gray-100">
                    <History className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-lg text-gray-600">히스토리가 없습니다</p>
                    <p className="text-sm text-gray-400">이미지를 생성하면 기록됩니다</p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
