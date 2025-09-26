const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

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

  try {
    const arkApiKey = process.env.ARK_API_KEY;
    if (!arkApiKey) {
      throw new Error('Missing ARK_API_KEY environment variable');
    }

    const payload = parseRequestBody(req);

    const arkResponse = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arkApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await arkResponse.text();
    const contentType = arkResponse.headers.get('content-type') || 'application/json';

    res.status(arkResponse.status);
    res.setHeader('Content-Type', contentType);
    res.send(responseText);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate content', message: error.message });
  }
}
