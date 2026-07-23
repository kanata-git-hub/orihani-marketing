import React, { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle, AlertCircle, RefreshCw, MessageSquare, Users, Briefcase, TrendingUp, DollarSign, ArrowRight, UserCheck, ThumbsUp, ThumbsDown, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { runMultiAgentSystem } from '../services/topic/multiAgent';
import { usePipeline } from '../context/PipelineContext';

import { AgentLog, FinalOutput } from '../types/agent';
import LiveAgentLog from '../components/LiveAgentLog';

export default function BlogTopic() {
  const { setActiveTab: setGlobalActiveTab, setSharedTopic, setSharedTreatment, setSharedFormat, setSharedDisease, setSharedTarget, setSharedSituation, setSharedTreatments } = usePipeline();
  
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [result, setResult] = useState<FinalOutput | null>(() => {
    try {
      const saved = localStorage.getItem('multiAgentResult');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  
  const [userFeedbackInput, setUserFeedbackInput] = useState(() => {
    return localStorage.getItem('userFeedbackInput') || "";
  });
  const [isWaitingForUser, setIsWaitingForUser] = useState(() => {
    return localStorage.getItem('isWaitingForUser') === 'true';
  });

  useEffect(() => {
    if (result) {
      localStorage.setItem('multiAgentResult', JSON.stringify(result));
    } else {
      localStorage.removeItem('multiAgentResult');
    }
  }, [result]);

  useEffect(() => {
    localStorage.setItem('userFeedbackInput', userFeedbackInput);
  }, [userFeedbackInput]);

  useEffect(() => {
    localStorage.setItem('isWaitingForUser', String(isWaitingForUser));
  }, [isWaitingForUser]);

  
  const handleStart = async (feedback?: string, previousCategory?: string) => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setIsWaitingForUser(false);
    try {
      const output = await runMultiAgentSystem((log) => {
        setLogs(prev => [...prev, log]);
      }, feedback, previousCategory);
      setResult(output);
      setIsWaitingForUser(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprove = () => {
    if (!result) return;
    setSharedTopic(result.finalTopic);
    setSharedTreatment(result.finalTreatment || '');
    setSharedFormat(result.format || '');
    if (result.disease) setSharedDisease(result.disease);
    if (result.target) setSharedTarget(result.target);
    if (result.situation) setSharedSituation(result.situation);
    if (result.treatments) setSharedTreatments(result.treatments);
    setIsWaitingForUser(false);
    setGlobalActiveTab('post');
  };

  const handleReject = () => {
    if (!userFeedbackInput.trim()) {
      alert("반려 사유(피드백)를 입력해주세요.");
      return;
    }
    handleStart(userFeedbackInput, result?.category);
    setUserFeedbackInput("");
  };

  
        return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="border-b border-[#e8dfd1] bg-white/80 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#e8dfd1] flex items-center justify-center shadow-sm">
              <Briefcase className="w-4 h-4 text-[#552c24]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#552c24]">글감 찾기</h1>
          </div>
          <button
            onClick={() => handleStart()}
            disabled={isRunning}
            className={`px-3 py-1.5 text-sm md:px-5 md:py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isRunning 
                ? 'bg-[#e8dfd1] text-[#552c24]/50 cursor-not-allowed' 
                : 'bg-[#552c24] text-[#ffcd4a] hover:bg-[#3d1f19]'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>실행 중...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>기획 시작</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col flex-1 overflow-hidden gap-4 min-h-0">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 md:p-6 flex items-start gap-4 text-red-800 shrink-0">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-lg mb-1">오류가 발생했습니다</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {!result && !isRunning && logs.length === 0 && !error ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e8dfd1] bg-[#fffcf8] rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-[#e8dfd1]">
              <Briefcase className="w-8 h-8 text-[#552c24]/40" />
            </div>
            <div>
              <p className="text-[#552c24] font-bold mb-1">아직 기획된 글감이 없습니다</p>
              <p className="text-[#d97706] text-sm">상단의 기획 시작 버튼을 눌러주세요.</p>
            </div>
          </div>
        ) : !result ? (
          <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex-1 min-h-0 flex flex-col space-y-6">
            {isRunning && (
              <div className="flex flex-col items-center justify-center space-y-4 py-8 shrink-0">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-[#e8dfd1] border-t-[#552c24] rounded-full animate-spin"></div>
                  <Users className="w-6 h-6 text-[#552c24] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-lg font-bold text-[#552c24] animate-pulse">에이전트 회의 진행 중...</p>
                <p className="text-sm text-[#552c24]/60">각 팀의 에이전트들이 자료를 조사하고 토론하고 있습니다. 잠시만 기다려주세요.</p>
              </div>
            )}
            
            {logs.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#fffcf8] border border-[#e8dfd1] rounded-2xl p-4">
                <LiveAgentLog logs={logs} />
              </div>
            )}
          </section>
        ) : (
          <section className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-[#e8dfd1] flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6">
            <div className="flex justify-end gap-3 mb-2 shrink-0">
              <button
                onClick={() => {
                  setResult(null);
                  setLogs([]);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 bg-white text-[#552c24] border border-[#e8dfd1] hover:bg-gray-50 transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                다시하기
              </button>
              <button
                onClick={() => setGlobalActiveTab('blog')}
                className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 bg-[#ffcd4a] text-[#552c24] hover:bg-[#ffe180] shadow-md transition-all border border-[#e8dfd1]"
              >
                <ArrowRight className="w-4 h-4" />
                블로그로 이동
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 md:p-6 border border-[#e8dfd1] shadow-sm md:col-span-2">
                <div className="text-xs mb-1.5 uppercase tracking-wider font-bold text-[#d97706]">글 주제 (질병)</div>
                <div className="text-lg font-black text-[#552c24]">{result.finalTopic}</div>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 border border-[#e8dfd1] shadow-sm">
                <div className="text-xs mb-1.5 uppercase tracking-wider font-bold text-[#d97706]">질환/부위</div>
                <div className="text-base font-bold text-[#552c24]">{result.disease}</div>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 border border-[#e8dfd1] shadow-sm">
                <div className="text-xs mb-1.5 uppercase tracking-wider font-bold text-[#d97706]">타겟</div>
                <div className="text-base font-bold text-[#552c24]">{result.target}</div>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 border border-[#e8dfd1] shadow-sm">
                <div className="text-xs mb-1.5 uppercase tracking-wider font-bold text-[#d97706]">상황</div>
                <div className="text-base font-bold text-[#552c24]">{result.situation}</div>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-6 border border-[#e8dfd1] shadow-sm">
                <div className="text-xs mb-1.5 uppercase tracking-wider font-bold text-[#d97706]">블로그 형식</div>
                <div className="text-base font-bold text-[#552c24]">{result.format || '미정'}</div>
              </div>
            </div>

            {result.debateSummary && (
              <div className="bg-white border border-[#e8dfd1] rounded-2xl p-5 md:p-8 shadow-sm mt-6">
                <h3 className="text-lg font-bold text-[#552c24] mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#552c24]/60" />
                  에이전트 회의 요약
                </h3>
                <div className="prose prose-amber max-w-none text-[#552c24]">
                  <ReactMarkdown>{result.debateSummary}</ReactMarkdown>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
