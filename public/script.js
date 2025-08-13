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
  if (!state.lastContent) {
    alert('请先生成文本内容');
    return;
  }
  setLoading(el.generateAudio, true);
  try {
    const payload = {
      text: state.lastContent,
      appid: state.ttsAppId,
      access_token: state.accessToken, // 传给后端
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
    
    // 根据火山引擎TTS文档，音频数据位于 data 字段中，且已经是base64编码
    let audioBase64;
    if (data.data && typeof data.data === 'string') {
      // 直接的base64字符串
      audioBase64 = data.data;
    } else if (data.data && data.data.audio) {
      // 嵌套在data.audio中
      audioBase64 = data.data.audio;
    } else if (data.audio) {
      // 直接在audio字段中
      audioBase64 = data.audio;
    } else {
      throw new Error('TTS返回格式异常：未找到音频数据');
    }
    
    const audioBytes = base64ToBytes(audioBase64);
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    state.lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    el.audioElement.src = url;
    el.audioPlayer.style.display = 'flex';
    
    showSuccess('语音生成成功！');
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
    if (!spinner) return;
    spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    text.style.display = 'inline';
    if (!spinner) return;
    spinner.style.display = 'none';
  }
}

function addHistory(item) {
  // 限制历史记录长度
  const MAX_HISTORY = 50;
  const history = storage.get('ve_history', []);
  history.unshift(item);
  while (history.length > MAX_HISTORY) history.pop();
  storage.set('ve_history', history);
  renderHistory();
}

function renderHistory() {
  const history = storage.get('ve_history', []);
  el.historyList.innerHTML = '';
  if (history.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = '暂无历史记录';
    el.historyList.appendChild(p);
    return;
  }
  for (const item of history) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-meta">
        <span class="badge">${escapeHtml(item.type)}</span>
        <span class="badge">${escapeHtml(item.mood)}</span>
        <span class="badge">${escapeHtml(item.duration)}</span>
        <span class="time">${new Date(item.time).toLocaleString()}</span>
      </div>
      <div class="history-text">${escapeHtml(item.text)}</div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm reload-text" data-text="${escapeHtml(item.text)}">
          <span class="btn-text">载入文本</span>
        </button>
        <button class="btn btn-primary btn-sm generate-audio" data-text="${escapeHtml(item.text)}">
          <span class="btn-text">生成语音</span>
          <span class="loading-spinner" style="display: none;">⏳</span>
        </button>
      </div>
    `;
    el.historyList.appendChild(div);
  }
  
  // 为历史记录按钮添加事件监听器
  el.historyList.querySelectorAll('.reload-text').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      state.lastContent = text;
      el.contentText.textContent = text;
      el.resultSection.style.display = 'block';
      el.audioPlayer.style.display = 'none';
      showSuccess('文本已载入，可以直接生成语音');
    });
  });
  
  el.historyList.querySelectorAll('.generate-audio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-text');
      setLoading(btn, true);
      try {
        await generateAudioForHistoryItem(text);
      } finally {
        setLoading(btn, false);
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 生成静音占位音频
async function synthSilence(seconds = 2) {
  const sampleRate = 44100;
  const numChannels = 2;
  const length = seconds * sampleRate;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = audioContext.createBuffer(numChannels, length, sampleRate);
  const audioData = audioBufferToWav(buffer);
  return new Blob([audioData], { type: 'audio/wav' });
}

function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let offset = 0;
  let pos = 0;

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt "
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) { // interleave channels
      const sample = Math.max(-1, Math.min(1, channels[i][offset]));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
    offset++;
  }

  function setUint16(data) {
    view.setUint16(pos, data, true); pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true); pos += 4;
  }

  return bufferArray;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function base64ToBytes(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

init();



// 为历史记录项生成语音
async function generateAudioForHistoryItem(text) {
  if (!state.ttsAppId || !state.accessToken) {
    alert('请先在配置区域保存TTS设置');
    return;
  }
  
  try {
    const payload = {
      text: text,
      appid: state.ttsAppId,
      access_token: state.accessToken,
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
    
    // 根据火山引擎TTS文档，音频数据位于 data 字段中
    let audioBase64;
    if (data.data && typeof data.data === 'string') {
      audioBase64 = data.data;
    } else if (data.data && data.data.audio) {
      audioBase64 = data.data.audio;
    } else if (data.audio) {
      audioBase64 = data.audio;
    } else {
      throw new Error('TTS返回格式异常：未找到音频数据');
    }
    
    const audioBytes = base64ToBytes(audioBase64);
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    state.lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    el.audioElement.src = url;
    el.audioPlayer.style.display = 'flex';
    
    // 将历史记录的文本设置为当前内容
    state.lastContent = text;
    el.contentText.textContent = text;
    el.resultSection.style.display = 'block';
    
    showSuccess('历史记录语音生成成功！');
  } catch (e) {
    console.error(e);
    alert('生成语音失败：' + (e.message || '请稍后重试'));
  }
}
