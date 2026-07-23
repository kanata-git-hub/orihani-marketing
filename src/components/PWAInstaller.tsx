import { useEffect, useState } from "react";

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore
      const isIOSStandalone = window.navigator.standalone === true;
      return isStandaloneMedia || isIOSStandalone;
    };
    
    setIsStandalone(checkStandalone());

    // Android/Chrome
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsStandalone(false); // Definitely not standalone if this fires
    });

    // iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !checkStandalone()) {
      setShowIOSPrompt(true);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback message if deferredPrompt is not available (e.g. browser doesn't support or already dismissed)
      alert("브라우저 메뉴(⋮)에서 '홈 화면에 추가'를 선택해주세요.");
    }
  };

  if (isStandalone || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white shadow-xl rounded-2xl p-4 flex items-center justify-between z-[9000] border border-slate-100">
      <div className="flex-1 pr-4">
        <h3 className="font-semibold text-slate-800">앱 설치하기</h3>
        <p className="text-sm text-slate-500">
          {showIOSPrompt
            ? "공유 버튼을 누르고 '홈 화면에 추가'를 선택하세요."
            : "바탕화면에 아이콘을 추가하여 더 편하게 이용하세요."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {!showIOSPrompt && (
          <button
            onClick={handleInstallClick}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition shrink-0"
          >
            설치
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 p-2 shrink-0"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
