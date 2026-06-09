// background/gemini.js — Google Gemini API client

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function getKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['geminiKey'], (result) => {
      if (!result.geminiKey) return reject(new Error('No Gemini API key configured'));
      resolve(result.geminiKey);
    });
  });
}

function getModel() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['geminiModel'], (result) => {
      resolve(result.geminiModel || DEFAULT_MODEL);
    });
  });
}

function buildUrl(model) {
  return 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
}

async function callGemini(systemPrompt, userPrompt, temperature, maxTokens, responseSchema) {
  const key = await getKey();
  const model = await getModel();
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens || 400, temperature: temperature ?? 0.7 },
  };
  if (responseSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = responseSchema;
  }

  const url = buildUrl(model) + '?key=' + key;
  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (e) {
    console.error('[Crosslister:bg] Gemini fetch error:', e.message);
    throw new Error('Gemini API request failed: ' + e.message);
  }
  const candidate = (data.candidates && data.candidates[0]) || null;
  const finishReason = candidate ? candidate.finishReason : 'no-candidates';
  const text = (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) || '';
  console.log('[Crosslister:bg] callGemini status=' + res.status + ' error=' + (data.error ? data.error.message : 'none') + ' finishReason=' + finishReason + ' textLen=' + text.length);
  if (data.error) throw new Error(data.error.message);
  if (!text && finishReason !== 'STOP') {
    console.log('[Crosslister:bg] callGemini empty text with finishReason=' + finishReason + ' — may be truncated by maxOutputTokens. Full candidate:', JSON.stringify(candidate).substring(0, 500));
  }
  if (text) console.log('[Crosslister:bg] callGemini preview:', text.substring(0, 200));
  return text;
}

// Transform an eBay description for a target platform's tone
async function transformDescription(description, platformName) {
  const prompts = {
    depop: 'You are a Depop listing assistant. Rewrite the description in a casual, trendy tone with relevant hashtags. Keep it under 1000 characters.',
    poshmark: 'You are a Poshmark listing assistant. Rewrite the description in a clean, professional, detail-oriented style. Mention measurements, fabric, and fit. Keep it under 1000 characters.',
    mercari: 'You are a Mercari listing assistant. Rewrite the description in a friendly, straightforward style. Highlight key features and condition. Keep it under 1000 characters.',
  };
  const systemPrompt = prompts[platformName] || prompts.depop;
  return callGemini(systemPrompt, `Original description:\n${description}`, 0.7, 400);
}

// Batch match multiple unmatched fields using structured output
async function batchMatch(unmatchedFields, platformName) {
  if (!unmatchedFields || unmatchedFields.length === 0) return [];

  const fieldsText = unmatchedFields.map(u =>
    `Field: ${u.field}\nSource value: "${u.sourceValue}"${u.context ? `\nContext: ${u.context}` : ''}\nOptions:\n${u.options.map((o, i) => `${i}: ${o}`).join('\n')}`
  ).join('\n\n');

  const systemPrompt = `You are a product listing assistant matching values across marketplaces. Given a source value and a list of target options, pick the best matching index.

The "Source value" is the primary determinant — it comes directly from the original listing's category or attribute and carries the most reliable signal. Match against it first.

"Context" (title, description, item specifics) is supplementary. Only use context to break ties or when the source value alone is insufficient to decide among the options. Do not let context override a clear signal from the source value.`;

  var userPrompt = `Match each field below to the closest option. Return a JSON array with the matched index for each field.\n\n`;
  if (unmatchedFields.some(function(u) { return u.field === 'category' || u.field === 'twoLevelSub' || u.field === 'subcategory'; })) {
    userPrompt += `For category fields: prioritize the Source value (eBay category path). Context is only for tie-breaking.\n\n`;
  }
  userPrompt += fieldsText;

  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        matchedIndex: { type: 'integer' },
        confidence: { type: 'number' }
      },
      required: ['field', 'matchedIndex']
    }
  };

  console.log('[Crosslister:bg] batchMatch sending', unmatchedFields.length, 'fields:', unmatchedFields.map(function(u) { return u.field + '=' + u.sourceValue + '(' + u.options.length + ' opts)'; }));
  const text = await callGemini(systemPrompt, userPrompt, 0, 1000, schema);
  console.log('[Crosslister:bg] batchMatch raw text:', text);
  try {
    var result = JSON.parse(text);
    console.log('[Crosslister:bg] batchMatch parsed:', JSON.stringify(result));
    return result;
  } catch (e) {
    console.log('[Crosslister:bg] batchMatch parse error:', e.message);
    return [];
  }
}
