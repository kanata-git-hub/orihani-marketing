import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={user?.photoURL || "/icon.png"} alt="Profile" className="w-12 h-12 rounded-full" />
            <div>
              <p className="text-sm text-slate-500">접속 중인 계정</p>
              <h2 className="font-medium text-slate-800">{user?.email}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition"
              >
                관리자 모드
              </button>
            )}
            <button
              onClick={logout}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition"
            >
              로그아웃
            </button>
          </div>
        </div>

        <div className="mt-8 text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-medium text-slate-800 mb-2">메인 서비스 화면</h3>
          <p className="text-slate-500">여기에 앱의 핵심 기능이 들어갑니다.</p>
        </div>
      </div>
    </div>
  );
}
