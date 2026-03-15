import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "pharmacist" | "doctor" | "specialist";

interface Profile {
  full_name: string;
  facility: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfileAndRole(
  userId: string,
  setProfile: (p: Profile | null) => void,
  setRole: (r: string | null) => void,
  setLoading: (v: boolean) => void
) {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, facility")
    .eq("user_id", userId)
    .single();

  if (profileData) setProfile(profileData);

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (roleData) setRole(roleData.role as AppRole);
  setLoading(false);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingForUser = useRef<string | null>(null);

  useEffect(() => {
    function handleSession(sess: Session | null) {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess?.user) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        loadingForUser.current = null;
        return;
      }
      const uid = sess.user.id;
      if (loadingForUser.current === uid) return;
      loadingForUser.current = uid;
      loadProfileAndRole(uid, setProfile, setRole, setLoading);
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
