// background/gemini.js — Google Gemini API client

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['geminiKey'], (result) => {
      if (!result.geminiKey) return reject(new Error('No Gemini API key configured'));
      resolve(result.geminiKey);
    });
  });
}

async function callGemini(systemPrompt, userPrompt, temperature, maxTokens, responseSchema) {
  const key = await getKey();
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens || 400, temperature: temperature ?? 0.7 },
  };
  if (responseSchema) {
    body.generationConfig.response_mime_type = 'application/json';
    body.generationConfig.response_schema = responseSchema;
  }

  const res = await fetch(`${GEMINI_BASE}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

  const systemPrompt = `You are a product listing assistant matching values across marketplaces. Given a source value and a list of target options, pick the best matching index. Consider sizing conventions, category differences, and regional variations specific to ${platformName}.`;
  const userPrompt = `Match each field below to the closest option. Return a JSON array with the matched index for each field.\n\n${fieldsText}`;

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

  const text = await callGemini(systemPrompt, userPrompt, 0.1, 200, schema);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}
