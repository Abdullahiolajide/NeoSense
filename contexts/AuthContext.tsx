import type { Profile } from '@/constants/Types';
import { getProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (userId: string) => {
        try {
            const p = await getProfile(userId);
            setProfile(p);
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user?.id) {
            await loadProfile(user.id);
        }
    }, [user?.id, loadProfile]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
                loadProfile(s.user.id).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, s) => {
                setSession(s);
                setUser(s?.user ?? null);
                if (s?.user) {
                    loadProfile(s.user.id);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [loadProfile]);

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
