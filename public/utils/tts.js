// public/utils/tts.js
export async function parseTtsFetchResponse(response) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  console.log('[TTS] content-type =', ct);

  if (ct.startsWith('audio/')) {
    const blob = await response.blob();
    if (!blob || blob.size < 100) throw new Error('TTS音频流为空');
    const url = URL.createObjectURL(blob);
    return { ok: true, audioUrl: url, blob, mimeType: ct, source: 'binary' };
  }

  // 默认按 JSON 协议解析
  const data = await response.json().catch(() => ({}));
  if (!data || data.error || data.ok === false) {
    const msg = (data && (data.message || data.error)) || 'TTS服务返回错误';
    throw new Error(msg);
  }

  const base64 = data.audio_base64 || data.audio || (data.data && data.data.audio);
  const mime = data.mime_type || 'audio/wav';
  if (!base64) throw new Error('TTS返回缺少 audio_base64');

  // base64 → Uint8Array → Blob → URL
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  console.log('[TTS] audioUrl created, size=', blob.size, 'type=', blob.type);
  return { ok: true, audioUrl: url, blob, mimeType: mime, source: 'json' };
}
