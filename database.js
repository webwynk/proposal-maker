const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseConfig) {
  console.error('Missing Supabase credentials in .env file');
}

const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = {
  supabase,
  hasSupabaseConfig
};
