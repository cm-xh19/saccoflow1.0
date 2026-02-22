/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ⚠️  IMPORTANT: The service role key bypasses RLS and has full DB access.
// In production, this should ONLY be used in a server-side function (e.g. Supabase Edge Function).
// For local development / internal admin tools, this is acceptable.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

let adminClient: ReturnType<typeof createClient> | null = null;

if (serviceRoleKey && supabaseUrl && !supabaseUrl.includes('dummy')) {
    const url = supabaseUrl.startsWith('http') ? supabaseUrl : 'https://' + supabaseUrl;
    adminClient = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
} else {
    console.warn('Service role key not configured. User invitation emails will not work.');
}

export const supabaseAdmin = adminClient;
