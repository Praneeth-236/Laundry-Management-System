import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshCsrfToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function reloadUser() {
    const result = await api.get("/auth/me");
    setUser(result.user);
    return result.user;
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshCsrfToken();
        const result = await api.get("/auth/me");
        if (active) setUser(result.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function authenticate(endpoint, credentials) {
    await api.post(`/auth/${endpoint}`, credentials);
    await refreshCsrfToken();
    await reloadUser();
  }

  async function signOut() {
    await api.post("/auth/logout", {});
    setUser(null);
    await refreshCsrfToken();
  }

  const value = useMemo(() => ({
    user,
    isLoading,
    signIn: (credentials) => authenticate("login", credentials),
    signUp: (credentials) => authenticate("register", credentials),
    signOut,
    reloadUser,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
