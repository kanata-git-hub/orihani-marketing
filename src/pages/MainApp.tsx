import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  PenLine, 
  Image as ImageIcon, 
  Film, 
  LayoutDashboard,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import BlogTopic from './BlogTopic';
import BlogPost from './BlogPost';
import ScenarioPlanner from './ScenarioPlanner';
import InstaThumbnail from './InstaThumbnail';
import VideoEditor from './VideoEditor';
import { usePipeline } from '../context/PipelineContext';

type TabType = "topic" | "post" | "scenario" | "thumbnail" | "video";

export default function MainApp() {
  const { activeTab, setActiveTab } = usePipeline();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { id: 'topic', label: '글감 찾기', icon: <Search className="w-5 h-5 md:w-5 md:h-5" /> },
    { id: 'post', label: '블로그', icon: <PenLine className="w-5 h-5 md:w-5 md:h-5" /> },
    { id: 'scenario', label: '시나리오', icon: <FileText className="w-5 h-5 md:w-5 md:h-5" /> },
    { id: 'thumbnail', label: '썸네일', icon: <ImageIcon className="w-5 h-5 md:w-5 md:h-5" /> },
    { id: 'video', label: '영상 편집', icon: <Film className="w-5 h-5 md:w-5 md:h-5" /> },
  ] as const;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#fffcf8] overflow-hidden font-sans text-[#552c24]">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-[#e8dfd1] z-40 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Doctor" className="w-8 h-8 object-contain" />
          <h1 className="font-bold text-base tracking-tight text-[#552c24]">오리 마케팅</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className="text-xs p-1.5 bg-slate-100 rounded-md">관리자</button>
          )}
          <button onClick={logout} className="text-xs text-slate-500">로그아웃</button>
        </div>
      </header>

      {/* Desktop Left Sidebar Navigation */}
      <aside className="hidden md:flex w-64 bg-white border-r border-[#e8dfd1] flex-col z-50 shrink-0">
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#e8dfd1]">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Doctor" className="w-10 h-10 object-contain" />
            <h1 className="font-bold text-lg tracking-tight text-[#552c24]">오리 마케팅</h1>
          </div>
        </div>

        <div className="p-4 flex-1">
          <p className="text-xs font-bold text-[#552c24]/50 uppercase tracking-widest mb-4 px-2">
            Workspace
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-bold text-sm ${
                  activeTab === item.id 
                    ? 'bg-[#552c24] text-[#ffcd4a] shadow-md' 
                    : 'text-[#552c24]/70 hover:bg-[#ffcd4a]/20 hover:text-[#552c24]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-[#e8dfd1] space-y-2">
           {isAdmin && (
             <button onClick={() => navigate('/admin')} className="w-full text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2">
               <LayoutDashboard className="w-4 h-4" /> 관리자 모드
             </button>
           )}
           <div className="flex items-center gap-2 px-3 py-2">
             <img src={user?.photoURL || "/icon.png"} className="w-6 h-6 rounded-full" alt="Profile" />
             <div className="flex-1 min-w-0">
               <p className="text-xs font-medium truncate">{user?.email}</p>
             </div>
             <button onClick={logout} className="text-xs text-red-500 hover:text-red-700">로그아웃</button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-[#fffcf8] pb-16 md:pb-0 flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab !== 'video' && <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-full"
          >
            {activeTab === 'topic' && <BlogTopic />}
            {activeTab === 'post' && <BlogPost />}
            {activeTab === 'scenario' && <ScenarioPlanner />}
            {activeTab === 'thumbnail' && <InstaThumbnail />}
          </motion.div>}
        </AnimatePresence>
        <VideoEditor visible={activeTab === 'video'} />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8dfd1] z-50 flex justify-around items-center px-1 pb-safe h-16 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as TabType)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              activeTab === item.id 
                ? 'text-[#552c24]' 
                : 'text-[#552c24]/40 hover:text-[#552c24]/70'
            }`}
          >
            <div className={`p-1 rounded-full ${activeTab === item.id ? 'bg-[#ffcd4a]/30' : ''}`}>
              {item.icon}
            </div>
            <span className={`text-[10px] font-bold ${activeTab === item.id ? 'text-[#552c24]' : ''}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
