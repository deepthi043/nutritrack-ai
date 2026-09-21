import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authService from "../services/authService";
import { setUnauthorizedHandler, getApiErrorMessage } from "../services/api";
import { getToken, setToken, clearToken } from "../storage/secureStorage";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Persistent login: rehydrate from the securely stored token on
    // launch, verifying it against the backend rather than trusting a
    // cached user blindly (mirrors the web app's AuthContext).
    (async () => {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await authService.fetchCurrentUser();
        setUser(currentUser);
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();

    // Any 401 from the API (expired/invalid token) logs the user out
    // locally so protected screens redirect to login immediately.
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await authService.loginUser(email, password);
      await setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  }

  async function register(email: string, password: string, fullName?: string) {
    try {
      const response = await authService.registerUser(email, password, fullName);
      await setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
