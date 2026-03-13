import type { Profile, UserRole } from '@/constants/Types';
import { supabase } from './supabase';

export async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    institution?: string
) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Sign up failed — no user returned');

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        role,
        institution: institution || null,
    });

    if (profileError) throw profileError;

    return authData;
}

export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
    return supabase.auth.onAuthStateChange(callback);
}
