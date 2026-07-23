import React, { useState, useEffect } from 'react';
import { Loader2, PenLine, Instagram, Copy, Check, Sparkles, Video, ExternalLink, History, Trash2, ChevronRight, Play, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { usePipeline } from '../context/PipelineContext';
import { generateBlogPost, BlogGenerationResult, getTreatmentPrompt, getInfoPrompt } from '../services/blog/geminiService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface HistoryItem {
  id: string;
  timestamp: number;
  mode: 'treatment' | 'info' | 'interview';
  topic: string;
  treatment: string;
  result: BlogGenerationResult;
}

export default function BlogPost() {
  const [mode, setMode] = useState<'treatment' | 'info' | 'interview'>('treatment');
  const [topic, setTopic] = useState('');
  const [treatment, setTreatment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoryItem['result'] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'content'>('settings');
  
  const { sharedTopic, sharedTreatment, sharedFormat, sharedTarget, sharedSituation, sharedTreatments, sharedDisease, setSharedTitle, setSharedScript, setSharedInstaContent, setSharedBlogContent } = usePipeline();

  useEffect(() => {
    if (sharedTopic) {
      setTopic(sharedTopic);
    }
    if (sharedTreatment) {
      setTreatment(sharedTreatment);
    }
    if (sharedFormat) {
      if (sharedFormat.includes('인터뷰')) {
        setMode('interview');
      } else if (sharedFormat.includes('정보')) {
        setMode('info');
      } else {
        setMode('treatment');
      }
    }
  }, [sharedTopic, sharedTreatment, sharedFormat]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('content_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (newItem: HistoryItem) => {
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 50);
      localStorage.setItem('content_history', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('content_history', JSON.stringify(updated));
      return updated;
    });
  };

  const loadFromHistory = (item: HistoryItem) => {
    setMode(item.mode);
    setTopic(item.topic);
    setTreatment(item.treatment);
    setResult(item.result);
    
    if (item.result) {
      setSharedTitle(item.result.instaTitle || '');
      setSharedInstaContent(item.result.instaContent || '');
      setSharedScript(item.result.videoScript || []);
      setSharedBlogContent(item.result.blog || '');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyBlog = async (text: string, id: string) => {
    const cleanLines =  (text || '').split('\n');

    // HTML 태그로 변환 (네이버 블로그 복붙용)
    let inBlockquote = false;
    let isFirstTextLine = true;
    const htmlParts: string[] = [];

    for (let i = 0; i < cleanLines.length; i++) {
      let htmlLine = cleanLines[i].trim();

      // 빈 줄은 여백으로 유지
      if (!htmlLine) {
        if (inBlockquote) {
          htmlParts.push('</div>');
          inBlockquote = false;
        }
        htmlParts.push('<p><br></p>');
        continue;
      }

      // 첫 번째 줄은 대제목
      if (isFirstTextLine) {
        isFirstTextLine = false;
        htmlLine = htmlLine.replace(/^(제목|소제목):\s*/, '').replace(/^#+\s*/, '');
        htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
        htmlParts.push(`<p><span style="font-size: 24pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
        continue;
      }

      // 제목이나 소제목, 마크다운 #, 또는 질문(Q) 로 시작하는 경우 소제목(인용구 4 스타일) 처리
      if (/^(제목|소제목):\s*/.test(htmlLine) || htmlLine.startsWith('#') || /^[Q]\./i.test(htmlLine) || /^질문:/i.test(htmlLine)) {
        if (inBlockquote) { htmlParts.push('</div>'); inBlockquote = false; }
        htmlLine = htmlLine.replace(/^(제목|소제목):\s*/, '').replace(/^#+\s*/, '');
        htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
        // 네이버 블로그 인용구 4(상하단 선) 스타일을 시각적으로 구현 (기본 blockquote는 인용구 1로만 붙여넣기 됨)
        htmlParts.push(`<div style="border-top: 1px solid #000000; border-bottom: 1px solid #000000; padding: 20px 10px; margin: 30px 0;"><p><span style="font-size: 18pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p></div>`);
        continue;
      }

      // 3줄 요약 블록 시작
      if (htmlLine.includes('3줄 요약')) {
        if (inBlockquote) { htmlParts.push('</div>'); inBlockquote = false; }
        inBlockquote = true;
        htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
        htmlParts.push(`<div style="border: 2px solid #e5e7eb; padding: 20px; background-color: #f9fafb; margin: 20px 0;"><p><span style="font-size: 14pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
        continue;
      }

      // 3줄 요약 블록 내부
      if (inBlockquote) {
        htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '$1');
        htmlParts.push(`<p><span style="font-size: 11pt; font-weight: bold; font-style: normal;">${htmlLine}</span></p>`);
        continue;
      }

      // 답변(A) 문구 볼드 처리
      if (/^[A]\./i.test(htmlLine) || /^답변:/i.test(htmlLine)) {
        if (!htmlLine.includes('**')) {
           htmlLine = `**${htmlLine}**`;
        }
      }

      // 마크다운 볼드체(**)를 <b> 태그로 변환
      htmlLine = htmlLine.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

      htmlParts.push(`<p>${htmlLine}</p>`);
    }

    if (inBlockquote) {
      htmlParts.push('</div>');
    }

    const htmlText = htmlParts.join('\n');

    const cleanPlainText = cleanLines.join('\n').replace(/\*\*/g, '');

    try {
      const blobHtml = new Blob([htmlText], { type: 'text/html' });
      const blobText = new Blob([cleanPlainText], { type: 'text/plain' });
      const data = [new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      })];
      await navigator.clipboard.write(data);
      
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      navigator.clipboard.writeText(cleanPlainText);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const generateContent = async () => {
    if (!topic || !treatment) return;
    setLoading(true);
    setResult(null); 
    setError(null);
    
    try {
      const generatedResult = await generateBlogPost(mode, topic, treatment);
      
      setResult(generatedResult);
      setSharedTitle(generatedResult.instaTitle);
      setSharedInstaContent(generatedResult.instaContent);
      setSharedScript(generatedResult.videoScript);
      
      const combinedBlogContent = generatedResult.imageSuggestion 
        ? `[이미지 삽입 제안: ${generatedResult.imageSuggestion}]\n\n${generatedResult.blog}`
        : generatedResult.blog;
        
      setSharedBlogContent(combinedBlogContent);
      
      // Save to Firestore for duplication check
      if (sharedTarget && sharedSituation && sharedTreatments && sharedTreatments.length > 0) {
        try {
          await addDoc(collection(db, 'blog_history'), {
            publishDate: new Date().toISOString(),
            disease: sharedDisease || '미상',
            target: sharedTarget,
            situation: sharedSituation,
            treatments: sharedTreatments
          });
        } catch (e) {
          console.error("Failed to save history to Firestore:", e);
        }
      }

      saveToHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        mode,
        topic,
        treatment,
        result: generatedResult
      });
    } catch (error: any) {
      console.error("Generation failed:", error);
      setError(error.message || "콘텐츠 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4 md:gap-6 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
              <Sparkles className="text-white w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">블로그</h1>
          </div>
          
          <div className="flex bg-[#e8dfd1]/50 p-1 rounded-xl w-fit shrink-0 ml-auto">
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'settings' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
            >
              생성
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
            >
              히스토리
            </button>
            <button 
              onClick={() => setActiveTab('content')}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'content' ? 'bg-white text-[#552c24] shadow-sm' : 'text-[#552c24]/60 hover:text-[#552c24]'}`}
            >
              콘텐츠
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        

        {activeTab === 'settings' && (
          <section className="space-y-8">
            <div className="bg-white p-4 md:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight">생성</h2>
                <button
                  onClick={generateContent}
                  disabled={loading || !topic || !treatment}
                  className="bg-black text-white rounded-xl px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>생성 중...</span>
                    </>
                  ) : (
                    <>
                      <PenLine className="w-4 h-4" />
                      <span>포스팅 생성하기</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Mode Selector */}
              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setMode('treatment')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                    mode === 'treatment' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  치료형
                </button>
                <button
                  onClick={() => setMode('info')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                    mode === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  정보형
                </button>
                <button
                  onClick={() => setMode('interview')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg ${
                    mode === 'interview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  인터뷰형
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest font-bold text-gray-400">
                    {mode === 'treatment' ? '글 주제 (질병)' : mode === 'info' ? '글 주제 (생활습관/소재)' : '인터뷰 주제 (소재)'}
                  </label>
                  <input
                    type="text"
                    placeholder={mode === 'treatment' ? "예: 만성 소화불량, 목 어깨 통증" : mode === 'info' ? "예: 봄철 춘곤증, 올바른 수면 자세" : "예: 2040 젊은 고혈압 증가"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest font-bold text-gray-400">
                    {mode === 'treatment' ? '치료 방법 (처방 포함)' : mode === 'info' ? '다루고 싶은 팁/주의사항' : '다루고 싶은 핵심 내용'}
                  </label>
                  <textarea
                    placeholder={mode === 'treatment' ? "예: 비위 기능을 강화하고 기운을 순환시키는 방향, 침 치료와 한약 병행" : mode === 'info' ? "예: 고추장 대신 들기름 사용, 밥 양은 절반으로 줄이기" : "예: 젊은 고혈압의 위험성, 생활습관 개선 등"}
                    rows={5}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all resize-none"
                    value={treatment || ""}
                    onChange={(e) => setTreatment(e.target.value)}
                  />
                </div>


              </div>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="space-y-8">
            {history.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-4 md:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 opacity-40">
                    <History className="w-4 h-4" />
                    <span className="text-[11px] uppercase tracking-wider font-bold">최근 생성 히스토리</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm('모든 히스토리를 삭제하시겠습니까?')) {
                        setHistory([]);
                        localStorage.removeItem('content_history');
                      }
                    }}
                    className="text-[10px] text-red-500 hover:underline font-bold uppercase tracking-widest transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="w-full text-left bg-gray-50 border border-gray-100 rounded-xl p-3 hover:border-gray-300 transition-all group relative cursor-pointer"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                            item.mode === 'treatment' ? 'bg-blue-100 text-blue-600' : 
                            item.mode === 'info' ? 'bg-green-100 text-green-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {item.mode === 'treatment' ? '치료형' : item.mode === 'info' ? '정보형' : '인터뷰형'}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {new Date(item.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm font-bold truncate pr-6">{item.topic}</p>
                        <p className="text-[10px] text-gray-400 truncate">{item.result.instaTitle}</p>
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-white rounded-3xl p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <History className="w-8 h-8 text-gray-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-lg text-gray-900">히스토리가 없습니다</p>
                  <p className="text-sm text-gray-400">콘텐츠를 생성하면 히스토리가 기록됩니다</p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'content' && (
          <section className="relative">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Blog Post Card */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold uppercase tracking-wider text-gray-600">Naver Blog Post</span>
                      </div>
                      <button
                        onClick={() => handleCopyBlog(result.blog, 'blog')}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {copied === 'blog' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                    <div className="p-5 md:p-8 prose prose-sm max-w-none text-gray-800">
                      <div className="whitespace-pre-wrap leading-relaxed font-medium">
                        {result.blog}
                      </div>
                    </div>
                  </div>

                  {/* Instagram Card */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-pink-500" />
                        <span className="text-sm font-bold uppercase tracking-wider text-gray-600">Instagram Thumbnail</span>
                      </div>
                      <button
                        onClick={() => handleCopy(`${result.instaTitle}\n\n${result.instaContent}`, 'insta')}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {copied === 'insta' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                    <div className="p-5 md:p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Insta Title</label>
                        <p className="text-xl font-bold text-pink-500">{result.instaTitle}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Insta Content</label>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium text-gray-700">
                            {result.instaContent}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Script Card */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-bold uppercase tracking-wider text-gray-600">8-Second Video Script</span>
                      </div>
                      <button
                        onClick={() => handleCopy(result.videoScript.join('\n'), 'video')}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {copied === 'video' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                    <div className="p-5 md:p-8">
                      <div className="grid grid-cols-1 gap-4">
                        {result.videoScript.map((line, index) => (
                          <div key={index} className="flex items-center gap-4 group">
                            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 transition-all">
                              <p className="text-sm font-medium text-gray-800">{line}</p>
                            </div>
                            <div className="text-[10px] font-mono text-gray-400 tabular-nums">
                              {line.length}/13
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-6 text-[10px] text-center text-gray-400 uppercase tracking-widest font-bold">
                        각 문장 2.6초 노출 권장
                      </p>
                    </div>
                  </div>

                  {/* Sources Section */}
                  {result.sources && (
                    <div className="bg-white rounded-3xl p-4 md:p-6 border border-gray-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">참고 자료 (Google Search)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {result.sources.map((source, index) => (
                          <a 
                            key={index}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-2 truncate"
                          >
                            <span className="text-gray-400">[{index + 1}]</span>
                            {source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evaluation Trigger */}
                  <div className="pt-8 border-t border-gray-200">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 md:p-6 text-center">
                      <h3 className="text-blue-900 font-bold mb-2">생성된 콘텐츠를 평가하고 싶으신가요?</h3>
                      <p className="text-sm text-blue-700 mb-4">
                        좌측 메뉴의 <strong>'콘텐츠 평가소'</strong> 탭으로 이동하여<br/>
                        다중 에이전트(시장조사팀, 기획팀, 재무팀, CEO)의 종합 평가를 받아보세요.
                      </p>
                      <button
                        onClick={() => {
                          // App.tsx에서 탭을 변경하는 로직이 필요하지만, 
                          // 여기서는 단순히 안내만 하거나, Context를 통해 탭 변경을 트리거할 수 있습니다.
                          alert("좌측 메뉴에서 '콘텐츠 평가소' 탭을 클릭해주세요.");
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        콘텐츠 평가소로 이동 안내
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-white rounded-3xl p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                    <PenLine className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-lg text-gray-900">생성된 콘텐츠가 없습니다</p>
                    <p className="text-sm text-gray-400">생성 탭에서 '포스팅 생성하기' 버튼을 눌러주세요.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </section>
        )}
      </main>

      
    </div>
  );
}