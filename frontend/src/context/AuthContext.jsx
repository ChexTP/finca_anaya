import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, getToken, removeToken, saveToken } from "../utils/api";
import { setPrintUser, buildPrintAudit, printAuditStyles } from "../utils/printAudit";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPrintUser(user);
    const beforePrint = () => {
      if (!document.querySelector('.document-print-audit')) {
        const container = document.createElement('div');
        container.id = 'page-print-audit';
        container.innerHTML = `${printAuditStyles}${buildPrintAudit()}`;
        document.body.appendChild(container);
      }
    };
    const afterPrint = () => document.getElementById('page-print-audit')?.remove();
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      setPrintUser(null);
      afterPrint();
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [user]);

  useEffect(() => {
    const loadUser = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const profile = await apiRequest("/auth/me");
        setUser(profile);
      } catch (error) {
        removeToken();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async ({ username, password }) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    saveToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
