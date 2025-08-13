// 简易本地存储封装
const storage = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

// 全局状态
const state = {
  textApiKey: storage.get('ve_text_api_key', ''),
  modelEndpoint: storage.get('ve_model_endpoint', ''),
  ttsAppId: storage.get('ve_tts_appid', ''),
  accessToken: storage.get('ve_access_token', ''),
  voiceType: storage.get('ve_voice_type', 'BV001_streaming'),
  lastContent: '',
  lastAudioBlob: null,
  history: storage.get('ve_history', []),
};

// DOM 元素
const el = {
  textApiKey: document.getElementById('textApiKey'),
  modelEndpoint: document.getElementById('modelEndpoint'),
  ttsAppId: document.getElementById('appId'),
  accessToken: document.getElementById('accessToken'),
  voiceType: document.getElementById('voiceType'),
  saveConfig: document.getElementById('saveConfig'),
  contentType: document.getElementById('contentType'),
  mood: document.getElementById('mood'),
  duration: document.getElementById('duration'),
  generateContent: document.getElementById('generateContent'),
  resultSection: document.getElementById('resultSection'),
  contentText: document.getElementById('contentText'),
  generateAudio: document.getElementById('generateAudio'),
  audioPlayer: document.getElementById('audioPlayer'),
  audioElement: document.getElementById('audioElement'),
  downloadAudio: document.getElementById('downloadAudio'),
  historyList: document.getElementById('historyList'),
};

// 初始化
function init() {
  el.textApiKey.value = state.textApiKey;
  el.modelEndpoint.value = state.modelEndpoint;
  el.ttsAppId.value = state.ttsAppId;
  el.accessToken.value = state.accessToken;
  el.voiceType.value = state.voiceType;
  renderHistory();
}

// 保存配置
el.saveConfig.addEventListener('click', () => {
  state.textApiKey = el.textApiKey.value.trim();
  state.modelEndpoint = el.modelEndpoint.value.trim();
  state.ttsAppId = el.ttsAppId.value.trim();
  state.accessToken = el.accessToken.value.trim();
  state.voiceType = el.voiceType.value;

  if (!state.textApiKey || !state.accessToken) {
    alert('请至少填写文本API Key和Access Token');
    return;
  }
  storage.set('ve_text_api_key', state.textApiKey);
  storage.set('ve_model_endpoint', state.modelEndpoint);
  storage.set('ve_tts_appid', state.ttsAppId);
  storage.set('ve_access_token', state.accessToken);
  storage.set('ve_voice_type', state.voiceType);
  alert('配置已保存');
});

// 生成胎教内容
el.generateContent.addEventListener('click', async () => {
  if (!state.textApiKey) {
    alert('请先在上方保存文本大模型API Key');
    return;
  }
  const payload = buildPrompt();
  setLoading(el.generateContent, true);
  try {
    const text = await callVolcTextAPI(payload, state.textApiKey, state.modelEndpoint);
    state.lastContent = text;
    el.contentText.textContent = text;
    el.resultSection.style.display = 'block';
    el.audioPlayer.style.display = 'none';
    addHistory({
      type: el.contentType.value,
      mood: el.mood.value,
      duration: el.duration.value,
      text,
      time: Date.now(),
    });
  } catch (e) {
    console.error(e);
    alert('生成内容失败：' + (e.message || '请稍后重试'));
  } finally {
    setLoading(el.generateContent, false);
  }
});

// 生成语音
el.generateAudio.addEventListener('click', async () => {
  if (!state.accessToken) {
    alert('请先在上方保存Access Token');
    return;
  }
  if (!state.lastContent) {
    alert('请先生成文本内容');
    return;
  }
  setLoading(el.generateAudio, true);
  try {
    const { blob } = await callVolcTTS(state.lastContent, state.ttsAppId, state.accessToken, state.voiceType || 'BV421_streaming');
    state.lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    el.audioElement.src = url;
    el.audioPlayer.style.display = 'flex';
  } catch (e) {
    console.error(e);
    alert('生成语音失败：' + (e.message || '请稍后重试'));
  } finally {
    setLoading(el.generateAudio, false);
  }
});

// 下载音频
el.downloadAudio.addEventListener('click', () => {
  if (!state.lastAudioBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(state.lastAudioBlob);
  a.download = `胎教音频_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.mp3`;
  a.click();
});

function buildPrompt() {
  const type = el.contentType.value;
  const mood = el.mood.value;
  const duration = el.duration.value;

  const moodMap = {
    calm: '平静放松',
    happy: '愉悦开心',
    peaceful: '安详宁静',
    warm: '温暖关爱',
    energetic: '活力充沛',
  };

  const durationMap = {
    short: '约400-600字',
    medium: '约800-1200字',
    long: '约1500-2000字',
  };

  const typeMap = {
    story: '创作一个适合孕妈妈和胎宝宝的温柔故事，语言简洁、画面感强，避免刺激内容',
    music: '设计一段音乐胎教引导词，包含呼吸放松、轻柔引导，配合背景音乐想象',
    poetry: '创作一组温柔的现代诗歌或古诗改编，适合柔声朗读',
    nature: '撰写一段自然声景的引导词，如森林、海边、清晨，帮助放松身心',
    wisdom: '提供一段科学温暖的育儿智慧，以亲切语气，避免焦虑和过度建议',
  };

  return `请以温柔、积极、安定的语气，面向孕妈妈，生成${typeMap[type]}。整体基调为“${moodMap[mood]}”，篇幅${durationMap[duration]}。要求：\n- 用词轻柔、避免刺激、避免负面暗示\n- 建议分为自然小段，便于朗读\n- 适当加入呼吸/放松/想象引导\n- 面向中文语境读者，使用简体中文`;
}

// 调用火山引擎文本生成API (Ark Chat Completions)
async function callVolcTextAPI(prompt, apiKey, endpointId) {
  if (!apiKey) {
    throw new Error('请先配置文本大模型API Key');
  }
  const model = (endpointId && endpointId.trim()) ? endpointId.trim() : 'doubao-1.5-pro-32k-250115';
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个专业的胎教内容创作助手，擅长生成温馨、积极、有益的胎教内容。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API请求失败: ${response.status} ${response.statusText}${errorData.error ? ` - ${errorData.error.message || errorData.error}` : ''}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error('API返回格式异常');
    }
  } catch (error) {
    console.error('调用文本API失败:', error);
    throw new Error(`文本生成失败: ${error.message}`);
  }
}

// 调用火山引擎TTS语音合成API  
async function callVolcTTS(text, apiKey, accessToken, voiceType = 'BV421_streaming') {
    if (!apiKey || !accessToken) {
        throw new Error('TTS配置不完整，请检查AppID和Access Token');
    }
    
    try {
        const response = await fetch('http://localhost:8013/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                headers: {
                    'Authorization': `Bearer;${accessToken}`
                },
                body: {
                    app: {
                        appid: apiKey,
                        token: accessToken,
                        cluster: "volcano_tts"
                    },
                    user: {
                        uid: "test_user_001"
                    },
                    audio: {
                        voice_type: voiceType,
                        encoding: "mp3",
                        speed_ratio: 1.0,
                        volume_ratio: 1.0,
                        pitch_ratio: 1.0
                    },
                    request: {
                        reqid: Date.now().toString(),
                        text: text,
                        text_type: "plain",
                        operation: "query",
                        with_frontend: 1,
                        frontend_type: "unitTson"
                    }
                }
            })
        });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`TTS API请求失败: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`);
    }

    const data = await response.json();
    if (data.code === 3000 && data.data) {
      const audioBase64 = data.data;
      const audioBytes = base64ToBytes(audioBase64);
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      return { blob };
    } else {
      throw new Error(data.message || data.Message || 'TTS合成失败');
    }
  } catch (error) {
    console.error('调用TTS API失败:', error);
    throw new Error(`语音合成失败: ${error.message}`);
  }
}

function setLoading(button, loading) {
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.loading-spinner');
  if (loading) {
    button.disabled = true;
    text.style.display = 'none';
    spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    text.style.display = 'inline-block';
    spinner.style.display = 'none';
  }
}

function addHistory(item) {
  state.history.unshift(item);
  state.history = state.history.slice(0, 20);
  storage.set('ve_history', state.history);
  renderHistory();
}

function renderHistory() {
  const list = el.historyList;
  list.innerHTML = '';
  if (!state.history.length) {
    list.innerHTML = '<p class="empty-state">暂无历史记录</p>';
    return;
  }
  for (const item of state.history) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-header">
        <div class="history-meta">类型：${item.type} · 情绪：${item.mood} · 长度：${item.duration}</div>
        <div class="history-actions">
          <button class="btn btn-outline btn-load">载入</button>
          <button class="btn btn-outline btn-copy">复制</button>
        </div>
      </div>
      <div class="history-text" style="white-space:pre-wrap; color:#334155; font-size:14px;">${escapeHtml((item.text||'').slice(0,300))}${item.text && item.text.length>300 ? '...':''}</div>
    `;
    div.querySelector('.btn-load').addEventListener('click', () => {
      state.lastContent = item.text;
      el.contentText.textContent = item.text;
      el.resultSection.style.display = 'block';
    });
    div.querySelector('.btn-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.text || '');
        alert('已复制到剪贴板');
      } catch {
        alert('复制失败');
      }
    });
    list.appendChild(div);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]|'/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[s]));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function synthSilence(seconds = 2) {
  const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100 * seconds, 44100);
  const buffer = audioCtx.createBuffer(1, 44100 * seconds, 44100);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  const rendered = await audioCtx.startRendering();
  const wav = audioBufferToWav(rendered);
  return new Blob([new DataView(wav)], { type: 'audio/wav' });
}

// 将 AudioBuffer 转为 WAV (PCM 16-bit)
function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let result;
  if (numOfChan === 2) {
    const channelL = buffer.getChannelData(0);
    const channelR = buffer.getChannelData(1);
    result = interleave(channelL, channelR);
  } else {
    result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChan * bytesPerSample;
  const bufferLength = result.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);

  /* RIFF identifier */ writeString(view, 0, 'RIFF');
  /* file length */ view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */ writeString(view, 8, 'WAVE');
  /* format chunk identifier */ writeString(view, 12, 'fmt ');
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, format, true);
  /* channel count */ view.setUint16(22, numOfChan, true);
  /* sample rate */ view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */ view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */ view.setUint16(32, blockAlign, true);
  /* bits per sample */ view.setUint16(34, bitDepth, true);
  /* data chunk identifier */ writeString(view, 36, 'data');
  /* data chunk length */ view.setUint32(40, bufferLength, true);

  floatTo16BitPCM(view, 44, result);

  return view.buffer;
}

function interleave(left, right) {
  const len = left.length + right.length;
  const result = new Float32Array(len);
  for (let i = 0, j = 0; i < len;) {
    result[i++] = left[j];
    result[i++] = right[j];
    j++;
  }
  return result;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

// 辅助函数：生成UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 辅助函数：base64转字节数组
function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 启动
init();