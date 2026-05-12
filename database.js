const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://qvpzfbmjokdesipdqdvn.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_x6oO-xEYquBWKgbitTYK_A_MknMXJ4M';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase
};