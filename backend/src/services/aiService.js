const { supabase } = require('./db');
const axios = require('axios');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const cb = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 30000 });

// 内置 Prompt 模板——不依赖数据库也可工作
const DEFAULT_PROMPT = {
  system_prompt: '你是社区事务分类助手。根据用户描述判断问题类别。类别：停车占位/报修/环境卫生/失物招领/宠物相关/小区通知/其他。优先级：normal或urgent。',
  user_prompt_template: '用户描述：{{description}}\n用户选定分类（如有）：{{category}}\n请只返回JSON：{"category":"分类","priority":"优先级","tags":["标签"]}',
  model: 'deepseek-chat',
  temperature: 0.3,
  max_tokens: 300,
};

async function getTemplate() {
  if (!supabase) return DEFAULT_PROMPT;
  try {
    const { data } = await supabase
      .from('ai_prompt_templates')
      .select('*').eq('scene', 'classify').eq('is_active', 1)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    return data || DEFAULT_PROMPT;
  } catch {
    return DEFAULT_PROMPT;
  }
}

async function logCall(data) {
  if (!supabase) return;
  try { await supabase.from('ai_call_logs').insert(data); } catch {}
}

async function classifyTicket(description, categoryName) {
  if (!cb.canExecute()) {
    logger.warn('AI circuit breaker open, skipping classification');
    return null;
  }

  const template = await getTemplate();
  const userPrompt = template.user_prompt_template
    .replace('{{description}}', description)
    .replace('{{category}}', categoryName || '');

  const startTime = Date.now();
  const model = template.model;

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

    if (!apiKey) {
      logger.warn('No DEEPSEEK_API_KEY configured');
      return null;
    }

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: template.system_prompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: template.temperature,
        max_tokens: template.max_tokens,
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
    );

    const latency = Date.now() - startTime;
    const content = response.data.choices[0].message.content.trim();

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      logger.warn('AI response parse failed', { content: content.slice(0, 200) });
      cb.recordFailure();
      return null;
    }

    cb.recordSuccess();
    await logCall({
      scene: 'classify',
      prompt_tokens: response.data.usage?.prompt_tokens || 0,
      completion_tokens: response.data.usage?.completion_tokens || 0,
      latency_ms: latency, model, success: 1,
    });

    logger.info('AI classify success', { category: result.category, priority: result.priority, latency_ms: latency });
    return {
      category: result.category || null,
      priority: result.priority || 'normal',
      tags: result.tags || [],
    };

  } catch (err) {
    const latency = Date.now() - startTime;
    cb.recordFailure();
    await logCall({
      scene: 'classify', latency_ms: latency, model, success: 0,
      error_msg: String(err.message).slice(0, 500),
    });
    logger.error('AI classify failed', { error: err.message });
    return null;
  }
}

async function getCategoryId(name) {
  if (!name || !supabase) return null;
  try {
    const { data } = await supabase
      .from('categories').select('id').ilike('name', `%${name.trim()}%`).maybeSingle();
    return data?.id || null;
  } catch { return null; }
}

module.exports = { classifyTicket, getCategoryId };
