const API_BASE = ""; // 同源，不要写域名

// 简易本地存储封装
const storage = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

// 历史记录管理
const HISTORY_KEY = 'prenatal_history';



// 显示成功提示
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2ed573;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(46, 213, 115, 0.3);
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(successDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// 显示错误提示
function showError(message) {
    // 创建错误提示元素
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4757;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    // 添加动画样式
    if (!document.querySelector('#error-animation-style')) {
        const style = document.createElement('style');
        style.id = 'error-animation-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}

// Ark文本生成API封装
async function arkGenerate(prompt, model) {
    try {
        const response = await fetch(`${API_BASE}/api/ark`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, model })
        });
        
        const data = await response.json();
        
        // 添加调试信息
        console.log('API Response:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // 验证响应格式
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('API响应格式错误：缺少choices数组');
        }
        
        if (!data.choices[0].message || !data.choices[0].message.content) {
            throw new Error('API响应格式错误：缺少message.content');
        }
        
        return data;
    } catch (error) {
        console.error('arkGenerate error:', error);
        showError(`文本生成失败: ${error.message}`);
        throw error;
    }
}

// TTS语音合成API封装
async function ttsSynthesize(payload) {
    try {
        const response = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
    } catch (error) {
        showError(`语音合成失败: ${error.message}`);
        throw error;
    }
}

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

  if (!state.textApiKey) {
    alert('请至少填写文本API Key');
    return;
  }
  storage.set('ve_text_api_key', state.textApiKey);
  storage.set('ve_model_endpoint', state.modelEndpoint);
  storage.set('ve_tts_appid', state.ttsAppId);
  storage.set('ve_access_token', state.accessToken);
  storage.set('ve_voice_type', state.voiceType);

  showSuccess('配置已保存');
});

// 生成胎教内容
el.generateContent.addEventListener('click', async () => {
  if (!state.textApiKey) {
    alert('请先在上方保存文本大模型API Key');
    return;
  }
  const prompt = buildPrompt();
  setLoading(el.generateContent, true);
  try {
    const model = (state.modelEndpoint && state.modelEndpoint.trim()) ? state.modelEndpoint.trim() : 'doubao-1.5-pro-32k-250115';
    const data = await arkGenerate(prompt, model);
    const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
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
  // 移除 accessToken 检查，因为后端已不再需要验证
  // if (!state.accessToken) {
  //   alert('请先在上方保存Access Token');
  //   return;
  // }
  if (!state.lastContent) {
    alert('请先生成文本内容');
    return;
  }
  setLoading(el.generateAudio, true);
  try {
    const payload = {
      text: state.lastContent,
      appid: state.ttsAppId,
      voice_type: state.voiceType || 'BV421_streaming',
      encoding: "mp3",
      speed_ratio: 1.0,
      volume_ratio: 1.0,
      pitch_ratio: 1.0,
      uid: "test_user_001",
      cluster: "volcano_tts",
      reqid: Date.now().toString(),
      text_type: "plain",
      operation: "query",
      with_frontend: 1,
      frontend_type: "unitTson"
    };
    const data = await ttsSynthesize(payload);
    if (!data || !data.data || !data.data.audio) {
      throw new Error('TTS返回格式异常');
    }
    const audioBytes = base64ToBytes(data.data.audio);
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
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
