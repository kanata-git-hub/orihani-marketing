import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.email === "kanata840@gmail.com") {
          setIsAdmin(true);
          setUser(currentUser);
          setLoading(false);
        } else {
          try {
            const q = query(collection(db, "approved_users"), where("email", "==", currentUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setIsAdmin(false);
              setUser(currentUser);
              setLoading(false);
            } else {
              await signOut(auth);
              setUser(null);
              setIsAdmin(false);
              setLoading(false);
              alert("승인된 사용자만 로그인할 수 있습니다. 관리자에게 승인을 요청하세요.");
            }
          } catch (error) {
            console.error("Auth verification failed", error);
            await signOut(auth);
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            alert("로그인 권한 확인 중 오류가 발생했습니다.");
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return unsubscribe;
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
