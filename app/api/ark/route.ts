import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  const start = Date.now();

  try {
    const body = await request.json();
    const prompt = (body.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json(
        { ok: false, errorCode: 'INVALID_PARAMETER', message: 'prompt 不能为空', requestId },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const arkApiKey = process.env.ARK_API_KEY;
    const model = process.env.ARK_MODEL || 'doubao-seed-1-6-flash-250715';

    // 无 API key 时返回 mock
    if (!arkApiKey || arkApiKey === 'your_ark_api_key_here') {
      return NextResponse.json({
        ok: true,
        choices: [{ message: { content: '这是一个测试早教故事。小熊宝宝今天学会了一个新本领——认识颜色！红红的苹果、黄黄的香蕉、绿绿的树叶...' } }],
        cost: 0,
        requestId,
        provider: 'mock',
        latency: (Date.now() - start) / 1000
      }, { headers: CORS_HEADERS });
    }

    const arkRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arkApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个专业的婴幼儿早教内容创作助手，擅长为0-36个月宝宝生成适龄、温馨、有趣的早教内容，包括睡前故事、儿歌童谣、认知启蒙、语言发展、感官探索和亲子互动游戏。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 5000,
        temperature: 0.7,
      }),
    });

    if (!arkRes.ok) {
      const errText = await arkRes.text();
      return NextResponse.json(
        { ok: false, errorCode: 'ARK_API_ERROR', message: errText, requestId },
        { status: arkRes.status, headers: CORS_HEADERS }
      );
    }

    const arkData = await arkRes.json();
    return NextResponse.json({
      ok: true,
      choices: arkData.choices || [],
      cost: 0,
      requestId,
      provider: 'volcengine_ark',
      latency: (Date.now() - start) / 1000
    }, { headers: CORS_HEADERS });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      { ok: false, errorCode: 'INTERNAL_ERROR', message, requestId },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
