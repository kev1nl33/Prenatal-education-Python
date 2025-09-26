import { randomUUID } from 'node:crypto';

const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DEFAULT_MODEL = process.env.ARK_MODEL || 'doubao-seed-1-6-flash-250715';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-Auth-Token, X-Mode, X-Dry-Run, X-Max-Daily-Cost, X-Api-Resource-Id'
  );
}

function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch (error) {
      throw new Error('Invalid JSON body');
    }
  }

  return req.body;
}

function buildArkPayload(prompt, model, overrides = {}) {
  const payload = {
    model: model || DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的胎教内容创作助手，擅长生成温馨、积极、有益的胎教内容。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: overrides.max_tokens ?? 5000,
    temperature: overrides.temperature ?? 0.7
  };

  if (overrides.top_p !== undefined) {
    payload.top_p = overrides.top_p;
  }

  if (Array.isArray(overrides.stop)) {
    payload.stop = overrides.stop;
  }

  return payload;
}

function wrapSuccessResponse(data, requestId, latencySeconds) {
  const choices = Array.isArray(data?.choices) && data.choices.length > 0
    ? data.choices
    : [
        {
          message: {
            content: typeof data === 'string' ? data : JSON.stringify(data)
          }
        }
      ];

  return {
    ok: true,
    errorCode: null,
    message: 'Success',
    choices,
    cost: 0,
    fromCache: false,
    requestId,
    provider: 'volcengine_ark',
    latency: latencySeconds
  };
}

function wrapErrorResponse({
  status,
  code = 'ARK_API_ERROR',
  message = 'ARK API request failed',
  requestId,
  latency
}) {
  return {
    ok: false,
    errorCode: code,
    message,
    cost: 0,
    fromCache: false,
    requestId,
    provider: 'volcengine_ark',
    latency
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const start = Date.now();
  const requestId = randomUUID();

  try {
    const arkApiKey = process.env.ARK_API_KEY;
    if (!arkApiKey) {
      throw new Error('Missing ARK_API_KEY environment variable');
    }

    const payload = parseRequestBody(req);
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';

    if (!prompt) {
      const latency = Number(((Date.now() - start) / 1000).toFixed(3));
      res.status(400).json(
        wrapErrorResponse({
          status: 400,
          code: 'INVALID_PARAMETER',
          message: 'Prompt parameter is required and cannot be empty',
          requestId,
          latency
        })
      );
      return;
    }

    const arkPayload = buildArkPayload(prompt, payload.model, payload.options);

    const arkResponse = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arkApiKey}`
      },
      body: JSON.stringify(arkPayload)
    });

    const responseText = await arkResponse.text();
    const latency = Number(((Date.now() - start) / 1000).toFixed(3));

    let arkData;
    try {
      arkData = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      arkData = responseText;
    }

    if (!arkResponse.ok) {
      let errorCode = 'ARK_API_ERROR';
      let errorMessage = 'ARK API request failed';

      if (arkResponse.status === 401) {
        errorCode = 'AUTHENTICATION_ERROR';
        errorMessage = 'Invalid API credentials. Please check your ARK API key.';
      } else if (arkResponse.status === 403) {
        errorCode = 'PERMISSION_ERROR';
        errorMessage = 'Access denied. Please check your API permissions.';
      } else if (arkResponse.status === 429) {
        errorCode = 'RATE_LIMIT_ERROR';
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (arkResponse.status >= 500) {
        errorCode = 'SERVER_ERROR';
        errorMessage = 'ARK API server error. Please try again later.';
      }

      if (arkData && typeof arkData === 'object') {
        const detail = arkData.error?.message || arkData.message;
        if (detail) {
          errorMessage = detail;
        }
      }

      res
        .status(arkResponse.status)
        .json(
          wrapErrorResponse({
            status: arkResponse.status,
            code: errorCode,
            message: errorMessage,
            requestId,
            latency
          })
        );
      return;
    }

    const successPayload = wrapSuccessResponse(arkData, requestId, latency);
    res.status(200).json(successPayload);
  } catch (error) {
    const latency = Number(((Date.now() - start) / 1000).toFixed(3));
    res
      .status(500)
      .json(
        wrapErrorResponse({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error',
          requestId,
          latency
        })
      );
  }
}
