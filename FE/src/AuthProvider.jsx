import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { getCurrentUser, loginUser, logoutUser, registerUser, updateCurrentUser, uploadUserAvatar } from "./services/authSV";
import { clearSensorCache } from "./services/dataSensorSV";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSessionExpired = () => { clearSensorCache(); setUser(null); setLoading(false); };
    window.addEventListener("iot:session-expired", handleSessionExpired);
    const controller = new AbortController();
    getCurrentUser(controller.signal)
      .then((currentUser) => setUser(currentUser))
      .catch(() => {
        if (!controller.signal.aborted) setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener("iot:session-expired", handleSessionExpired);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(data) {
      const result = await loginUser(data);
      setUser(result);
      return result;
    },
    async register(data) {
      const result = await registerUser(data);
      setUser(result);
      return result;
    },
    async updateProfile(data) {
      const result = await updateCurrentUser(data);
      setUser(result);
      return result;
    },
    async uploadAvatar(file) {
      const result = await uploadUserAvatar(file);
      setUser(result);
      return result;
    },
    async logout() {
      await logoutUser();
      clearSensorCache();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
