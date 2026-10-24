// expect: none
import { server } from '@/lib/supabase/server';
import { send } from '@/lib/email/send';
export const aService = { server, send };
