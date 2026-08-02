const fs = require('fs');
let content = fs.readFileSync('src/pages/VideoEditor.tsx', 'utf8');

// add imports
content = content.replace(
  "import { Sparkles, Play, Loader2, History, Trash2 } from 'lucide-react';",
  "import { Sparkles, Play, Loader2, History, Trash2, Copy, Check, FileText, Hash } from 'lucide-react';"
);

// add state inside VideoEditor
const stateToAdd = `  const [latestBlogContent, setLatestBlogContent] = useState<any>(null);
  const [copiedTTS, setCopiedTTS] = useState(false);
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
    } catch (e) {
      console.error("Failed to parse content history", e);
    }
  }, []);
`;

content = content.replace(
  '  const generatorRef = useRef<any>(null);',
  '  const generatorRef = useRef<any>(null);\n' + stateToAdd
);

// add buttons before CinemagraphGenerator
const buttonsToAdd = `
        {latestBlogContent?.result?.youtubeTtsScript && (
          <div className="mb-4 flex flex-wrap items-center gap-2 shrink-0 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm z-10">
            <span className="text-sm font-semibold text-gray-700 px-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#ffcd4a]" /> 블로그 연동 (최근 포스팅)</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(latestBlogContent.result.youtubeTtsScript);
                setCopiedTTS(true);
                setTimeout(() => setCopiedTTS(false), 2000);
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              {copiedTTS ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              대본복사
            </button>
            <button
              onClick={() => {
                const text = \`제목: \${latestBlogContent.result.youtubeTitle}\\n\\n해시태그: \${latestBlogContent.result.youtubeHashtags}\`;
                navigator.clipboard.writeText(text);
                setCopiedTitle(true);
                setTimeout(() => setCopiedTitle(false), 2000);
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex items-center gap-2"
            >
              {copiedTitle ? <Check className="w-4 h-4 text-green-500" /> : <Hash className="w-4 h-4" />}
              제목복사
            </button>
          </div>
        )}
`;

content = content.replace(
  '      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 w-full flex-1 overflow-hidden flex flex-col">',
  '      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 w-full flex-1 overflow-hidden flex flex-col">' + buttonsToAdd
);

fs.writeFileSync('src/pages/VideoEditor.tsx', content);
