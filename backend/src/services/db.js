const { createClient } = require('@supabase/supabase-js');
const { createMemoryDb } = require('./memoryDb');
const logger = require('../utils/logger');

let _client = null;
let _initialized = false;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key && url !== 'https://your-project.supabase.co') {
    _client = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
    logger.info('Supabase connected');
    return _client;
  }

  if (!_initialized) {
    logger.warn('Supabase not configured — using in-memory database');
    _initialized = true;
  }
  _client = createMemoryDb();
  return _client;
}

module.exports = { get supabase() { return getClient(); }, getClient };
