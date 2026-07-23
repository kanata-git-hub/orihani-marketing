import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Image as ImageIcon, Video,  FileText, Check, AlertCircle, RefreshCw, Layers, Users, Clock, ArrowRight } from 'lucide-react';
import { usePipeline } from '../context/PipelineContext';
import { useApiKey } from '../hooks/useApiKey';
import { CHARACTERS, SYSTEM_PROMPT } from '../constants';
import { getGeminiClient } from '../services/geminiClient';
import { loadScenarioHistory, saveScenarioHistory, ScenarioHistoryItem } from '../hooks/useScenarioHistory';

export default function ScenarioPlanner() {
  const { 
    sharedTitle, 
    sharedInstaContent,
    sharedBlogContent,
    sharedScript,
    sharedImagePrompt, setSharedImagePrompt,
    sharedVideoPrompt, setSharedVideoPrompt,
    sharedCharacters, setSharedCharacters,
    setActiveTab
  } = usePipeline();

  const { hasApiKey, handleOpenKeyDialog } = useApiKey();

  const [localImagePrompt, setLocalImagePrompt] = useState(sharedImagePrompt || '');
  const [localVideoPrompt, setLocalVideoPrompt] = useState(sharedVideoPrompt || '');
  const [localCharacters, setLocalCharacters] = useState<string[]>(sharedCharacters || []);
  const [rawPlan, setRawPlan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryItem[]>([]);
  const [activeTabLocal, setActiveTabLocal] = useState<'history' | 'overview' | 'characters' | 'thumbnail' | 'video'>('overview');

  useEffect(() => {
    loadScenarioHistory().then(res => setHistory(res)).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    setLocalImagePrompt(sharedImagePrompt || '');
    setLocalVideoPrompt(sharedVideoPrompt || '');
    setLocalCharacters(sharedCharacters || []);
  }, [sharedImagePrompt, sharedVideoPrompt, sharedCharacters]);

  const toggleCharacter = (id: string) => {
    if (localCharacters.includes(id)) {
      setLocalCharacters(prev => prev.filter(c => c !== id));
    } else {
      setLocalCharacters(prev => [...prev, id]);
    }
  };

  const handleGenerate = async () => {
    if (!hasApiKey) {
      handleOpenKeyDialog();
      return;
    }

    setIsGenerating(true);
    setError(null);

    const apiKey = (process.env as any).API_KEY || (process.env as any).GEMINI_API_KEY;
    if (!apiKey) {
      setError("No API Key found.");
      setIsGenerating(false);
      return;
    }

    const ai = getGeminiClient();

    try {
      const prompt = `Here is the drafted content:
Title: ${sharedTitle}
Insta Text: ${sharedInstaContent}
Video Script: ${sharedScript.join('\n')}
Blog Content Extract: ${sharedBlogContent}

Follow the system instructions to plan the visual scenario.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT
        }
      });

      const text = response.text || '';
      setRawPlan(text);
      
      let finalChars: string[] = [];
      let finalImgPrompt: string = '';
      let finalVideoPrompt: string = '';

      // Parse Characters
      const charMatch = text.match(/-\s+\*\*출연 캐릭터:\*\*(.*)/);
      if (charMatch) {
        const charsString = charMatch[1].toLowerCase();
        const detectedChars = CHARACTERS.filter(c => charsString.includes(c.id)).map(c => c.id);
        if (detectedChars.length > 0) {
          finalChars = detectedChars;
          setLocalCharacters(detectedChars);
        }
      }

      // Parse Image Prompt
      const imageSectionMatch = text.match(/### 1\. Image Generation Prompts.*?([\s\S]*?)(?=### 2\. Video Generation Prompts)/i);
      if (imageSectionMatch) {
         finalImgPrompt = imageSectionMatch[1].trim();
         setLocalImagePrompt(finalImgPrompt);
      }

      // Parse Video Prompt
      const videoSectionMatch = text.match(/### 2\. Video Generation Prompts.*?([\s\S]*)/i);
      if (videoSectionMatch) {
         finalVideoPrompt = videoSectionMatch[1].trim();
         setLocalVideoPrompt(finalVideoPrompt);
      }

      const newItem: ScenarioHistoryItem = {
        id: Date.now().toString(),
        title: sharedTitle || 'Untitled Scenario',
        rawPlan: text,
        imagePrompt: finalImgPrompt,
        videoPrompt: finalVideoPrompt,
        createdAt: Date.now()
      };
      
      setHistory(prev => {
        const updated = [newItem, ...prev].slice(0, 10);
        saveScenarioHistory(updated).catch(e => console.error(e));
        return updated;
      });
      setActiveTabLocal('characters');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate scenario.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadHistoryItem = (item: ScenarioHistoryItem) => {
    setRawPlan(item.rawPlan || '');
    setLocalImagePrompt(item.imagePrompt || '');
    setLocalVideoPrompt(item.videoPrompt || '');
    setActiveTabLocal('thumbnail');
  };

  const handleSaveAndNext = () => {
    setSharedImagePrompt(localImagePrompt);
    setSharedVideoPrompt(localVideoPrompt);
    setSharedCharacters(localCharacters);
    setActiveTab('thumbnail'); // Go to next step
  };

    return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#fffcf8]">
      <header className="border-b border-[#e8dfd1] bg-white/80 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#ffcd4a] flex items-center justify-center shadow-sm">
              <FileText className="text-[#552c24] w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">시나리오</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !hasApiKey}
              className="flex items-center justify-center gap-2 bg-[#552c24] text-[#ffcd4a] px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-[#3d1f19] transition-all disabled:opacity-50 min-w-[80px]"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? '생성 중...' : '생성'}</span>
            </button>
            <button 
              onClick={handleSaveAndNext}
              disabled={!rawPlan && history.length === 0}
              className="flex items-center justify-center gap-2 bg-[#ffcd4a] text-[#552c24] px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-[#ffe180] transition-all disabled:opacity-50 min-w-[80px]"
            >
              <Check className="w-4 h-4" />
              <span>저장</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col flex-1 overflow-hidden gap-6 min-h-0">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 shrink-0">
            <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
            <p className="text-sm text-red-600 font-bold">{error}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-6 min-h-0">
          {/* Left Column: Master Scenario */}
          <div className={`flex-col min-h-0 ${rawPlan ? 'flex md:w-1/2' : 'hidden'}`}>
            <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-[#552c24] shrink-0">
                <FileText className="w-4 h-4 text-[#ffcd4a]" />
                마스터 시나리오
              </h2>
              <div className="bg-[#fffcf8] border border-[#e8dfd1] rounded-2xl p-4 md:p-5 text-sm whitespace-pre-wrap leading-relaxed overflow-y-auto custom-scrollbar flex-1 text-[#552c24]">
                {rawPlan}
              </div>
            </section>
          </div>

          {/* Right Column: Tabs and Editor */}
          <div className={`flex flex-col min-h-0 ${rawPlan ? 'md:w-1/2' : 'w-full max-w-4xl mx-auto'}`}>
            <div className="flex bg-[#e8dfd1]/50 p-1 rounded-xl w-fit overflow-x-auto hide-scrollbar gap-0 shrink-0 mb-4 mx-auto">
              <button 
                onClick={() => setActiveTabLocal('history')}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'history' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
              >
                히스토리
              </button>
              <button 
                onClick={() => setActiveTabLocal('overview')}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'overview' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
              >
                개요
              </button>
              <button 
                onClick={() => setActiveTabLocal('characters')}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'characters' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
              >
                캐릭터
              </button>
              <button 
                onClick={() => setActiveTabLocal('thumbnail')}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'thumbnail' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
              >
                썸네일
              </button>
              <button 
                onClick={() => setActiveTabLocal('video')}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${activeTabLocal === 'video' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
              >
                비디오
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {activeTabLocal === 'history' && (
                <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
                  <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#552c24] shrink-0">
                    <Clock className="w-4 h-4 text-[#552c24]/50" />
                    히스토리
                  </h2>
                  {history?.length > 0 ? (
                    <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => loadHistoryItem(item)}
                          className="w-full p-4 bg-[#fffcf8] rounded-2xl border border-[#e8dfd1] text-left hover:border-[#ffcd4a] hover:shadow-md transition-all group shrink-0"
                        >
                          <p className="text-xs text-[#552c24]/50 mb-1">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                          <p className="text-sm font-bold text-[#552c24] truncate mb-2">
                            {item.title}
                          </p>
                          <div className="flex items-center text-[#ffcd4a] text-[10px] font-bold">
                            <span className="flex-1">이전 기획안 재설정</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e8dfd1] bg-[#fffcf8] rounded-2xl p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <Clock className="w-8 h-8 text-[#e8dfd1]" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-lg text-[#552c24]">히스토리가 없습니다</p>
                        <p className="text-sm text-[#552c24]/50">시나리오를 생성하면 기록됩니다</p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeTabLocal === 'overview' && (
                <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
                  <h2 className="text-sm font-bold mb-4 flex items-center gap-2 shrink-0 text-[#552c24]">
                    <Layers className="w-4 h-4 text-[#552c24]/50" />
                    개요
                  </h2>
                  <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    <div className="bg-[#fffcf8] rounded-2xl p-4 md:p-5 border border-[#e8dfd1]/50">
                      <span className="text-xs font-bold text-[#d97706] block mb-2">제목</span>
                      <p className="font-bold text-[#552c24] text-lg">{sharedTitle || '작성된 제목이 없습니다'}</p>
                    </div>
                    
                    <div className="bg-[#fffcf8] rounded-2xl p-4 md:p-5 border border-[#e8dfd1]/50">
                      <span className="text-xs font-bold text-[#d97706] block mb-2">인스타 텍스트 (요약)</span>
                      <p className="text-[#552c24] whitespace-pre-wrap leading-relaxed">{sharedInstaContent || '내용 없음'}</p>
                    </div>
                  </div>
                </section>
              )}

              {activeTabLocal === 'characters' && (
                <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
                  <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#552c24] shrink-0">
                    <Users className="w-4 h-4 text-[#552c24]/50" />
                    캐릭터
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pr-2 flex-1 content-start">
                    {CHARACTERS.map(char => (
                      <button 
                        key={char.id}
                        onClick={() => toggleCharacter(char.id)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                          localCharacters.includes(char.id) 
                            ? 'border-[#552c24] bg-[#ffcd4a]/10 ring-2 ring-[#ffcd4a]/20' 
                            : 'border-[#e8dfd1] hover:bg-[#fffcf8] grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                        }`}
                      >
                        <img src={char.img} alt={char.name} className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-full bg-white shadow-sm border border-[#e8dfd1]" />
                        <span className="text-xs md:text-sm font-bold text-[#552c24] text-center leading-tight">{char.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {activeTabLocal === 'thumbnail' && (
                <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
                  <h2 className="text-sm font-bold mb-4 shrink-0 text-[#552c24] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#552c24]/50" />
                    썸네일
                  </h2>
                  <textarea 
                    value={localImagePrompt || ""}
                    onChange={(e) => setLocalImagePrompt(e.target.value)}
                    placeholder="AI 생성 버튼을 누르거나 직접 작성해주세요."
                    className="w-full flex-1 bg-[#fffcf8] border border-[#e8dfd1] rounded-2xl p-5 text-[#552c24] focus:outline-none focus:ring-2 focus:ring-[#ffcd4a]/50 resize-none transition-all"
                  />
                </section>
              )}

              {activeTabLocal === 'video' && (
                <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex flex-col flex-1 min-h-0">
                  <h2 className="text-sm font-bold mb-4 shrink-0 text-[#552c24] flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#552c24]/50" />
                    비디오
                  </h2>
                  <textarea 
                    value={localVideoPrompt || ""}
                    onChange={(e) => setLocalVideoPrompt(e.target.value)}
                    placeholder="AI 생성 버튼을 누르거나 직접 작성해주세요."
                    className="w-full flex-1 bg-[#fffcf8] border border-[#e8dfd1] rounded-2xl p-5 text-[#552c24] focus:outline-none focus:ring-2 focus:ring-[#ffcd4a]/50 resize-none transition-all leading-relaxed"
                  />
                  <p className="text-[10px] text-[#552c24]/50 mt-4 flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-3 h-3" />
                    비디오 프롬프트는 씬(Scene) 단위로 상세하게 묘사하는 것이 좋습니다.
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
