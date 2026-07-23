import React, { useEffect, useRef } from 'react';
import { AgentLog } from '../types/agent';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Info, MessageSquare } from 'lucide-react';

interface LiveAgentLogProps {
  logs: AgentLog[];
}

export default function LiveAgentLog({ logs }: LiveAgentLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getIcon = (type: AgentLog['type']) => {
    switch (type) {
      case 'working': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'feedback': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBgColor = (type: AgentLog['type']) => {
    switch (type) {
      case 'working': return 'bg-blue-50 border-blue-100';
      case 'success': return 'bg-emerald-50 border-emerald-100';
      case 'warning': return 'bg-orange-50 border-orange-100';
      case 'error': return 'bg-red-50 border-red-100';
      case 'feedback': return 'bg-purple-50 border-purple-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  if (logs.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          에이전트 실시간 소통 현황
        </h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">Live</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-3 p-3 rounded-xl border ${getBgColor(log.type)}`}
            >
              <div className="mt-0.5 shrink-0">
                {getIcon(log.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900">{log.agentName}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {log.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
