import { openWorkspace, closeWorkspaceIfChanged } from '../accountWorkspace';
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocsFromServer, doc, setDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const attempt = ++revision;
      const current = () => attempt === revision && auth.currentUser?.uid === currentUser?.uid;
      setUser(null);
      setIsAdmin(false);
      if (closeWorkspaceIfChanged(currentUser?.uid ?? null)) {
        // Drop previous React state, object URLs and any queued authenticated work.
        window.location.reload();
        return;
      }
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      const admin = currentUser.email === "kanata840@gmail.com";
      try {
        if (!currentUser.emailVerified || !currentUser.email) throw Error('확인된 이메일로 로그인해주세요.');
        if (!admin) {
          const q = query(collection(db, "approved_users"), where("email", "==", currentUser.email));
          const approvals = await getDocsFromServer(q);
          if (!current()) return;
          if (approvals.empty) throw Error('승인된 사용자만 로그인할 수 있습니다.');
          await setDoc(doc(db, 'approved_access', currentUser.uid), { approvalId: approvals.docs[0].id }).catch(error => {
            if (error.code !== 'permission-denied') throw error;
          });
        }
        if (!current()) return;
        openWorkspace(currentUser.uid);
        setUser(currentUser);
        setIsAdmin(admin);
        setLoading(false);
      } catch {
        if (!current()) return;
        await signOut(auth);
        alert("로그인 권한을 확인하지 못했습니다. 계정과 연결 상태를 확인해주세요.");
      }
    });
    return () => { revision++; unsubscribe(); };
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === "auth/unauthorized-domain") {
        alert("Firebase Console에 도메인을 추가해야 합니다 (Authentication > Settings > Authorized domains)");
      } else {
        alert("로그인 중 오류가 발생했습니다.");
      }
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
