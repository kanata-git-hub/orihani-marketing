import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full text-center space-y-6">
        <img src="/icon.png" alt="Logo" className="w-24 h-24 mx-auto rounded-2xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 mb-2">환영합니다</h1>
          <p className="text-sm text-slate-500">서비스를 이용하려면 로그인하세요.</p>
        </div>
        <button
          onClick={login}
          className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition"
        >
          Google 계정으로 시작하기
        </button>
      </div>
    </div>
  );
}
