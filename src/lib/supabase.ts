import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hkzhksauilonqppipjyc.supabase.co';
const supabaseAnonKey = 'sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);