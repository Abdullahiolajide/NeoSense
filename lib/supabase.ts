import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Use localStorage for web (with SSR guard), AsyncStorage for native
const storage = Platform.OS === 'web'
    ? {
        getItem: (key: string) => {
            if (typeof window !== 'undefined') {
                return Promise.resolve(window.localStorage.getItem(key));
            }
            return Promise.resolve(null);
        },
        setItem: (key: string, value: string) => {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, value);
            }
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(key);
            }
            return Promise.resolve();
        },
    }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});
