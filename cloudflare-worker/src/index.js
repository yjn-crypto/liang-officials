/**
 * Cloudflare Worker — 梁代职官查询系统 API 代理
 *
 * 作用：前端 → Cloudflare Worker → DeepSeek API
 * 前端代码中不包含任何 API Key，Key 存在 Cloudflare 环境变量中
 *
 * 部署方式：
 *   1. npx wrangler deploy
 *   2. npx wrangler secret put DEEPSEEK_API_KEY   # 输入你的 DeepSeek API Key
 *   3. 把输出的 Worker URL 填到前端 index.html 的 WORKER_URL 变量中
 */

// 允许跨域访问的来源（前端部署的域名）
const ALLOWED_ORIGINS = [
  'https://你的用户名.github.io',          // GitHub Pages
  'http://localhost:5500',                  // 本地开发
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'null',                                   // file:// 协议本地打开
];

export default {
  async fetch(request, env, ctx) {
    // ========== CORS 预检请求 ==========
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // ========== 仅接受 POST ==========
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // ========== 解析请求 ==========
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const { mode, query } = body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return jsonResponse({ error: 'Missing or empty "query"' }, 400);
    }

    // ========== 检查 API Key ==========
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'Server: DEEPSEEK_API_KEY not configured' }, 500);
    }

    // ========== 按模式分发 ==========
    try {
      switch (mode) {
        case 'extract_offices':
          return await handleExtractOffices(query.trim(), apiKey);
        case 'extract_governor':
          return await handleExtractGovernor(query.trim(), apiKey);
        case 'query':
          return await handleQuery(query.trim(), apiKey);
        default:
          // 默认走单条查询
          return await handleQuery(query.trim(), apiKey);
      }
    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ error: 'Internal server error: ' + err.message }, 500);
    }
  },
};

// ===================== 各模式处理函数 =====================

/** 模式1：从文本中提取所有可能的官职/将军号 */
async function handleExtractOffices(text, apiKey) {
  const prompt = `你是一位精通南朝梁官制的专家。请从以下文本中，提取出所有可能是南朝梁官职、将军号的名词。
文本中可能含有人名、地名、官职名、将军号等混合内容。
请只提取官职和将军号，不要提取人名、地名。
以JSON数组形式返回，例如：["尚书令","征东将军","湘东王长史"]
如果找不到任何官职，返回空数组 []。

文本内容：
${text}`;

  const result = await callDeepSeek(prompt, apiKey);
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return jsonResponse(JSON.parse(jsonMatch[0]));
    } catch {
      return jsonResponse([]);
    }
  }
  return jsonResponse([]);
}

/** 模式2：从史料中提取刺史任命信息 */
async function handleExtractGovernor(text, apiKey) {
  const prompt = `你是一位精通南朝梁史的专家。请从以下文本中，提取所有可能与州刺史任命相关的信息。
对于每一条任命，请提取：年份、州名、新任刺史的姓名和爵位、以及可能的身份线索（如是否为皇弟、皇子、嗣王等）。
以JSON数组形式返回，每条记录包含字段：year, region, governor, identity, rawText。
如果无法确定某个字段，可以留空字符串。
只提取，不推测，文本中未提及的不要补充。

文本内容：
${text}`;

  const result = await callDeepSeek(prompt, apiKey);
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return jsonResponse(JSON.parse(jsonMatch[0]));
    } catch {
      return jsonResponse([]);
    }
  }
  return jsonResponse([]);
}

/** 模式3：单条官职查询（DeepSeek 推理） */
async function handleQuery(text, apiKey) {
  const prompt = `你是一个精通南朝梁官制的专家。请根据用户的输入官职，判断它在梁武帝十八班官制中的班次和等级。
如果无法确定，请返回"无法确定"。
请以JSON格式输出，如：{"result": "十三班第2位（共五位）"}
用户输入：${text}`;

  const result = await callDeepSeek(prompt, apiKey);
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return jsonResponse([parsed]);
    } catch {
      // ignore
    }
  }
  return jsonResponse([{ result: result }]);
}

// ===================== 通用函数 =====================

/** 调用 DeepSeek API */
async function callDeepSeek(prompt, apiKey) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/** 返回 JSON 响应（含 CORS 头） */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/** 处理 CORS 预检请求 */
function handleCORS(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.github.io');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed ? origin : '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
