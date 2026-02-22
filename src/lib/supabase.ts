import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    supabaseUrl = 'https://' + supabaseUrl;
}

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-url.supabase.co')) {
    console.error("Supabase URL or Anon Key is missing or invalid. Please update your .env file!");
    // You MUST provide a real URL, but to prevent the app from completely whitescreening on load if setup is incomplete,
    // we set it to a dummy valid URL if it's currently invalid.
    if (!supabaseUrl || supabaseUrl.includes('your-project')) supabaseUrl = 'https://dummy.supabase.co';
}

export const supabase = createClient(supabaseUrl || 'https://dummy.supabase.co', supabaseAnonKey || 'dummy');
