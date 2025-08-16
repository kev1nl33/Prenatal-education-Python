const API_BASE = ''; // 同源，不要写域名

// 简易本地存储封装
const storage = {
  get(key, def) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? def;
    } catch {
      return def;
    }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
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

// 生成模拟响应（测试模式）
function generateMockResponse(prompt) {
  return new Promise((resolve) => {
    // 模拟API延迟
    setTimeout(() => {
      const mockContent = generateMockContent(prompt);
      resolve({
        choices: [{
          message: {
            content: mockContent
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150
        }
      });
    }, 1000 + Math.random() * 1000); // 1-2秒随机延迟
  });
}

// 生成模拟内容
function generateMockContent(prompt) {
  const contentType = el.contentType.value;

  const templates = {
    'story': [
      '从前有一个小兔子，它住在森林深处的一个温暖的洞穴里。每天早晨，小兔子都会跳出洞穴，在草地上快乐地蹦跳。它最喜欢的事情就是收集五颜六色的花朵，然后把它们编成美丽的花环。有一天，小兔子发现了一朵特别的七彩花，这朵花会在夜晚发出温柔的光芒，照亮整个森林。',
      '在一个遥远的王国里，住着一位善良的公主。她有着金色的长发和温柔的笑容。公主最喜欢在花园里照顾各种各样的花朵，她相信每一朵花都有自己的故事。每当夜晚来临，公主会轻抚着花瓣，倾听它们诉说着关于爱与希望的美丽传说。',
      '小熊维尼今天要去蜂蜜树那里探险。他背着小背包，里面装着他最喜欢的蜂蜜罐。一路上，他遇到了许多朋友：跳跳虎、小猪、小驴屹耳。大家一起在阳光下嬉戏，分享着甜蜜的蜂蜜和温暖的友谊。'
    ],
    'poetry': [
      '小星星眨眼睛，\n月亮船儿轻轻摇，\n宝宝睡在摇篮里，\n梦里开满小花朵。\n\n风儿轻轻吹，\n云朵慢慢飘，\n妈妈的爱如春雨，\n滋润着小心苗。\n\n夜空中的星星，\n为宝宝唱摇篮曲，\n甜甜的梦境里，\n有彩虹和小天使。',
      '彩虹桥弯弯，\n连接天和地，\n小鸟飞过去，\n带来好消息。\n\n花儿对我笑，\n草儿向我招，\n阳光暖洋洋，\n心情真美好。\n\n蝴蝶翩翩舞，\n蜜蜂嗡嗡唱，\n大自然的怀抱，\n充满了希望。',
      '小雨点滴答，\n敲打着窗台，\n就像在弹琴，\n奏响爱的旋律。\n\n妈妈的怀抱，\n是最温暖的港湾，\n宝宝在这里，\n快乐每一天。\n\n爱的种子发芽，\n在心田里生长，\n未来的日子，\n充满阳光。'
    ],
    'wisdom': [
      '亲爱的宝宝，妈妈想告诉你关于成长的秘密。每个人都像一颗种子，需要阳光、雨露和爱的nourishment才能茁壮成长。在你还没有来到这个世界之前，妈妈就在为你准备最好的土壤——那就是一个充满爱的家庭。记住，无论遇到什么困难，爱总是最强大的力量。',
      '宝宝，妈妈想和你分享关于友谊的智慧。真正的朋友就像星星，即使在最黑暗的夜晚也会为你闪闪发光。学会善待他人，用真诚的心去交朋友，你会发现这个世界充满了美好的人。记住，给予比接受更快乐，分享会让快乐加倍。',
      '我的小宝贝，妈妈想告诉你关于勇气的故事。勇气不是不害怕，而是即使害怕也要去做正确的事情。每个人心中都有一个小小的勇士，当你遇到挑战时，记得唤醒他。相信自己，你比想象中更强大、更勇敢。'
    ],
    'nature': [
      '清晨的第一缕阳光透过窗帘洒进房间，就像妈妈温柔的手轻抚着你的脸颊。外面的世界正在苏醒：小鸟在枝头欢快地歌唱，花朵在晨露中绽放，微风轻柔地摇摆着绿叶。这是大自然给我们的美好礼物，宝宝，你将会看到这个世界所有的美丽。',
      '春天来了，万物复苏。嫩绿的小草从土地里探出头来，樱花树上开满了粉色的花朵，就像天空中飘落的云彩。蝴蝶在花丛中翩翩起舞，蜜蜂忙碌地采集花蜜。这个季节充满了生机和希望，就像你即将到来的生命一样珍贵。',
      '夜晚的星空是如此美丽，无数颗星星在天空中闪烁，就像钻石撒在深蓝色的丝绸上。月亮像一艘银色的小船，载着美好的梦想在云海中航行。宝宝，当你看到这片星空时，要记得每一颗星星都在为你祝福。'
    ],
    'emotion': [
      '我的小宝贝，妈妈想告诉你，你是我生命中最珍贵的礼物。从知道你存在的那一刻起，我的心就被无尽的爱填满了。每一天，我都在期待着与你的相遇，想象着你的小手、你的笑容、你的第一声啼哭。你还没有出生，但你已经是我整个世界的中心。',
      '宝宝，爸爸妈妈为你准备了一个充满爱的家。我们会用最温柔的声音为你唱摇篮曲，用最温暖的怀抱给你安全感，用最真挚的爱陪伴你成长。无论你将来成为什么样的人，我们都会无条件地爱你、支持你、保护你。',
      '亲爱的小天使，你知道吗？你的到来让我们的生活变得如此美好。每当感受到你在妈妈肚子里的小动作，我们的心就充满了喜悦和感动。你是我们爱情的结晶，是我们希望的延续，是我们未来最美好的期待。'
    ],
    'learning': [
      '宝宝，我们一起认识颜色的世界吧！红色像苹果一样鲜艳，黄色像太阳一样温暖，蓝色像天空一样广阔，绿色像草地一样清新。每种颜色都有自己的魅力，就像每个人都自己的特点。当你睁开眼睛看世界时，会发现生活是如此多彩。',
      '数字是很有趣的朋友呢！1像一根蜡烛直直地站着，2像一只小鸭子在水中游泳，3像两个小耳朵在听故事，4像一面小旗子在风中飘扬，5像一个小钩子可以挂东西。宝宝，学会数数后，你就能数出妈妈给你的吻有多少个了！',
      '形状的世界真奇妙！圆形像太阳、像月亮、像妈妈温柔的脸庞；方形像积木、像窗户、像爸爸结实的肩膀；三角形像小山、像帽子、像小鸟的嘴巴。每个形状都有自己的故事，等你长大了，我们一起去发现更多有趣的形状吧！'
    ]
  };

  // 根据当前选择的内容类型获取模板
  const selectedTemplates = templates[contentType] || templates['story'];

  // 随机选择一个模板
  const randomIndex = Math.floor(Math.random() * selectedTemplates.length);
  return selectedTemplates[randomIndex];
}

// 模拟TTS合成（测试模式）
function generateMockTTS() {
  return new Promise((resolve) => {
    // 模拟TTS延迟
    setTimeout(() => {
      // 生成一个简单的音频blob（静音）
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 3; // 3秒
      const numSamples = sampleRate * duration;
      const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);

      // 生成简单的音调
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < numSamples; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1; // 440Hz音调，低音量
      }

      // 转换为WAV格式
      const wavBlob = audioBufferToWav(audioBuffer);
      resolve(wavBlob);
    }, 2000 + Math.random() * 1000); // 2-3秒随机延迟
  });
}

// Ark文本生成API封装
async function arkGenerate(prompt, model) {
  try {
    // 检查是否为测试模式
    if (state.testMode) {
      return generateMockResponse(prompt);
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    // 添加认证头（如果配置了API密钥）
    if (state.textApiKey) {
      headers['X-Auth-Token'] = state.textApiKey;
    }

    const response = await fetch(`${API_BASE}/api/ark`, {
      method: 'POST',
      headers: headers,
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
    // 检查是否为测试模式
    if (state.testMode) {
      console.warn('运行在测试模式，将生成模拟音频');
      return await generateMockTTS();
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    // 检查运行模式并显示警告
    if (data.mode && data.mode !== 'prod') {
      console.warn(`TTS运行在${data.mode}模式，可能生成占位音频`);
      if (data.warning) {
        console.warn(`警告: ${data.warning}`);
      }
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
  voiceType: storage.get('ve_voice_type', 'zh_male_shenyeboke_moon_bigtts'),
  testMode: storage.get('ve_test_mode', false),
  lastContent: '',
  lastAudioBlob: null,
  history: storage.get('ve_history', [])
};

// DOM 元素
const el = {
  textApiKey: document.getElementById('textApiKey'),
  modelEndpoint: document.getElementById('modelEndpoint'),
  ttsAppId: document.getElementById('appId'),
  accessToken: document.getElementById('accessToken'),
  testMode: document.getElementById('testMode'),
  saveConfig: document.getElementById('saveConfig'),
  contentType: document.getElementById('contentType'),
  contentCards: document.querySelectorAll('.content-card'),
  voiceSelector: document.getElementById('voiceSelector'),
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
  // 设置模态框相关元素
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeModal: document.getElementById('closeModal'),
  cancelConfig: document.getElementById('cancelConfig'),
  // 历史记录模态框相关元素
  openHistoryBtn: document.getElementById('openHistoryBtn'),
  historyModal: document.getElementById('historyModal'),
  closeHistoryModal: document.getElementById('closeHistoryModal'),
  closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
  clearAllHistory: document.getElementById('clearAllHistory')
};

// 模态框控制函数
function showSettingsModal() {
  el.settingsModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideSettingsModal() {
  el.settingsModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// 检查是否为首次使用
function isFirstTimeUser() {
  return !state.textApiKey || !state.modelEndpoint;
}

// 初始化
function init() {
  el.textApiKey.value = state.textApiKey;
  el.modelEndpoint.value = state.modelEndpoint;
  el.ttsAppId.value = state.ttsAppId;
  el.accessToken.value = state.accessToken;
  el.testMode.checked = state.testMode;

  // 初始化内容卡片选择
  initContentCards();

  // 初始化语音选择器（下拉框）
  initVoiceSelector();

  // 初始化历史记录功能
  initHistoryModal();

  renderHistory();

  // 首次使用时自动弹出设置模态框
  if (isFirstTimeUser()) {
    showSettingsModal();
  }
}

// 初始化内容卡片
function initContentCards() {
  // 设置默认选中的卡片
  const defaultCard = document.querySelector('.content-card[data-type="story"]');
  if (defaultCard) {
    defaultCard.classList.add('selected');
  }

  // 为每个卡片添加点击事件
  el.contentCards.forEach(card => {
    card.addEventListener('click', () => {
      selectContentCard(card);
    });
  });
}

// 选择内容卡片
function selectContentCard(selectedCard) {
  // 移除所有卡片的选中状态
  el.contentCards.forEach(card => {
    card.classList.remove('selected');
  });

  // 添加选中状态到当前卡片
  selectedCard.classList.add('selected');

  // 更新隐藏的input值
  const contentType = selectedCard.getAttribute('data-type');
  el.contentType.value = contentType;

  // 可选：添加选择反馈
  selectedCard.style.transform = 'scale(0.98)';
  setTimeout(() => {
    selectedCard.style.transform = '';
  }, 150);
}

// 初始化语音选择器（下拉框）
function initVoiceSelector() {
  // 设置当前选中的语音
  el.voiceSelector.value = state.voiceType || 'zh_male_shenyeboke_moon_bigtts';

  // 添加change事件监听器
  el.voiceSelector.addEventListener('change', (e) => {
    const selectedVoice = e.target.value;
    state.voiceType = selectedVoice;

    // 保存到localStorage
    storage.set('ve_voice_type', selectedVoice);
  });
}

// 初始化历史记录模态框
function initHistoryModal() {
  // 打开历史记录模态框
  el.openHistoryBtn.addEventListener('click', showHistoryModal);

  // 关闭历史记录模态框
  el.closeHistoryModal.addEventListener('click', hideHistoryModal);
  el.closeHistoryModalBtn.addEventListener('click', hideHistoryModal);

  // 点击模态框背景关闭
  el.historyModal.addEventListener('click', (e) => {
    if (e.target === el.historyModal) {
      hideHistoryModal();
    }
  });

  // 清空所有历史记录
  el.clearAllHistory.addEventListener('click', () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      clearAllHistoryRecords();
    }
  });
}

// 显示历史记录模态框
function showHistoryModal() {
  el.historyModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderHistoryInModal();
}

// 隐藏历史记录模态框
function hideHistoryModal() {
  el.historyModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// 在模态框中渲染历史记录
function renderHistoryInModal() {
  const historyList = el.historyList;

  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">暂无历史记录</p>';
    return;
  }

  historyList.innerHTML = state.history.map((item, index) => {
    const type = item.contentType || item.type || 'unknown';
    const timestamp = item.timestamp || item.time || Date.now();
    const text = (item.content != null ? item.content : item.text) || '';
    const preview = text.substring(0, 100);
    return `
    <div class="history-item" data-index="${index}">
      <div class="history-content">
        <div class="history-meta">
          <span class="history-type">${getContentTypeLabel(type)}</span>
          <span class="history-date">${new Date(timestamp).toLocaleString()}</span>
        </div>
        <div class="history-text">${escapeHtml(preview)}${text.length > 100 ? '...' : ''}</div>
      </div>
      <div class="history-actions">
        <button class="btn btn-sm btn-outline" onclick="loadHistoryItem(${index})">加载</button>
        <button class="btn btn-sm btn-danger" onclick="deleteHistoryItem(${index})">删除</button>
      </div>
    </div>
  `;
  }).join('');
}

// 获取内容类型标签
function getContentTypeLabel(type) {
  const labels = {
    'story': '温馨故事',
    'poetry': '诗歌朗诵',
    'wisdom': '育儿智慧',
    'nature': '自然描述',
    'emotion': '情感表达',
    'learning': '启蒙认知'
  };
  return labels[type] || type;
}

// 加载历史记录项
function loadHistoryItem(index) {
  const item = state.history[index];
  if (!item) {
    return;
  }

  const type = item.contentType || item.type || 'story';
  const text = (item.content != null ? item.content : item.text) || '';

  // 设置内容类型
  selectContentCardByType(type);

  // 同步到状态，确保后续可直接生成语音
  state.lastContent = text;

  // 显示内容
  el.contentText.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
  el.resultSection.style.display = 'block';

  // 如果有音频，设置音频；否则隐藏播放器并清空上一次的音频状态
  if (item.audioBlob) {
    state.lastAudioBlob = item.audioBlob;
    const audioUrl = URL.createObjectURL(item.audioBlob);
    el.audioElement.src = audioUrl;
    el.audioPlayer.style.display = 'block';
  } else {
    state.lastAudioBlob = null;
    el.audioElement.removeAttribute('src');
    el.audioPlayer.style.display = 'none';
  }

  // 关闭模态框
  hideHistoryModal();

  // 滚动到结果区域
  el.resultSection.scrollIntoView({ behavior: 'smooth' });

  showSuccess('历史记录已加载');
}

// 根据类型选择内容卡片
function selectContentCardByType(type) {
  const targetCard = document.querySelector(`.content-card[data-type="${type}"]`);
  if (targetCard) {
    selectContentCard(targetCard);
  }
}

// 删除历史记录项
function deleteHistoryItem(index) {
  if (confirm('确定要删除这条历史记录吗？')) {
    state.history.splice(index, 1);
    storage.set('ve_history', state.history);
    renderHistoryInModal();
    // 同时更新主页面的历史记录显示
    renderHistory();
    showSuccess('历史记录已删除');
  }
}

// 清空所有历史记录
function clearAllHistoryRecords() {
  state.history = [];
  storage.set('ve_history', state.history);
  renderHistoryInModal();
  // 同时更新主页面的历史记录显示
  renderHistory();
  showSuccess('所有历史记录已清空');
}

// 模态框事件监听器
el.settingsBtn.addEventListener('click', showSettingsModal);
el.closeModal.addEventListener('click', hideSettingsModal);
el.cancelConfig.addEventListener('click', hideSettingsModal);

// 点击模态框背景关闭
el.settingsModal.addEventListener('click', (e) => {
  if (e.target === el.settingsModal) {
    hideSettingsModal();
  }
});

// ESC键关闭模态框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (el.settingsModal.style.display === 'flex') {
      hideSettingsModal();
    } else if (el.historyModal.style.display === 'flex') {
      hideHistoryModal();
    }
  }
});

// 保存配置
el.saveConfig.addEventListener('click', () => {
  state.textApiKey = el.textApiKey.value.trim();
  state.modelEndpoint = el.modelEndpoint.value.trim();
  state.ttsAppId = el.ttsAppId.value.trim();
  state.accessToken = el.accessToken.value.trim();
  // 语音类型现在从voiceSelector获取
  state.voiceType = el.voiceSelector.value;
  state.testMode = el.testMode.checked;

  // 在非测试模式下验证必要的配置
  if (!state.testMode && !state.textApiKey) {
    showError('请输入文本API密钥或启用测试模式');
    return;
  }

  // 保存到localStorage
  storage.set('ve_text_api_key', state.textApiKey);
  storage.set('ve_model_endpoint', state.modelEndpoint);
  storage.set('ve_tts_appid', state.ttsAppId);
  storage.set('ve_access_token', state.accessToken);
  storage.set('ve_voice_type', state.voiceType);
  storage.set('ve_test_mode', state.testMode);

  const modeText = state.testMode ? '（测试模式已启用）' : '';
  showSuccess(`配置已保存${modeText}`);
  hideSettingsModal(); // 保存后关闭模态框
});

// 生成胎教内容
el.generateContent.addEventListener('click', async() => {
  if (!state.testMode && !state.textApiKey) {
    if (confirm('未配置文本API密钥，是否打开设置或启用测试模式？')) {
      showSettingsModal();
    }
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
      time: Date.now()
    });
  } catch (e) {
    console.error(e);
    alert('生成内容失败：' + (e.message || '请稍后重试'));
  } finally {
    setLoading(el.generateContent, false);
  }
});

// 生成语音
el.generateAudio.addEventListener('click', async() => {
  if (!state.lastContent) {
    alert('请先生成文本内容');
    return;
  }
  setLoading(el.generateAudio, true);
  try {
    const payload = {
      text: state.lastContent,
      voice_type: state.voiceType || 'default',
      quality: 'draft'
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
    // Determine correct MIME type from bytes or response info
    const mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
    const blob = new Blob([audioBytes], { type: mimeType });
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
  if (!state.lastAudioBlob) {
    return;
  }
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
    energetic: '活力充沛'
  };

  const durationMap = {
    short: '约400-600字',
    medium: '约800-1200字',
    long: '约1500-2000字'
  };

  const typeMap = {
    story: '创作一个温馨的胎教故事，内容积极正面，富有想象力，语言温柔优美，情节简单易懂，能够传递爱与希望，帮助孕妈妈和胎宝宝建立情感连接',
    music: '设计一段音乐胎教引导词，结合轻柔的音乐节拍，引导孕妈妈进行深度放松，包含呼吸调节、身心舒缓和与胎宝宝的心灵沟通',
    poetry: '创作优美的诗歌朗诵内容，可以是温柔的现代诗、经典古诗词改编或原创韵律诗，语言富有韵律感，适合轻声吟诵，营造宁静美好的氛围',
    nature: '描绘美丽的自然景象，如春日花园、静谧森林、温柔海浪、清晨阳光等，用生动的语言带领孕妈妈和胎宝宝感受大自然的美好与宁静',
    emotion: '表达对胎宝宝深深的爱意和美好期待，分享孕期的喜悦心情，传递温暖的母爱，增进亲子情感纽带，让胎宝宝感受到被爱和期待',
    learning: '提供温和的认知启蒙内容，如颜色、形状、数字、字母等基础概念，用简单有趣的方式介绍，为胎宝宝的早期智力发展奠定基础'
  };

  return `请以温柔、积极、安定的语气，面向孕妈妈，生成${typeMap[type]}。整体基调为“${moodMap[mood]}”，篇幅${durationMap[duration]}。要求：\n- 用词轻柔、避免刺激、避免负面暗示\n- 建议分为自然小段，便于朗读\n- 适当加入呼吸/放松/想象引导\n- 面向中文语境读者，使用简体中文`;
}





function setLoading(button, loading) {
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.loading-spinner');
  if (loading) {
    button.disabled = true;
    text.style.display = 'none';
    if (!spinner) {
      return;
    }
    spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    text.style.display = 'inline';
    if (!spinner) {
      return;
    }
    spinner.style.display = 'none';
  }
}

function addHistory(item) {
  // 限制历史记录长度
  const MAX_HISTORY = 50;
  const history = storage.get('ve_history', []);
  history.unshift(item);
  while (history.length > MAX_HISTORY) {
    history.pop();
  }
  storage.set('ve_history', history);

  // 同步更新state.history
  state.history = history;

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
      <div class="history-text">${escapeHtml(item.text || '')}</div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm reload-text" data-text="${escapeHtml(item.text || '')}">
          <span class="btn-text">载入文本</span>
        </button>
        <button class="btn btn-primary btn-sm generate-audio" data-text="${escapeHtml(item.text || '')}">
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
    btn.addEventListener('click', async() => {
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

// 生成静音占位音频（已移除，未使用）

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

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
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

// 检测音频数据的MIME类型
function detectAudioMimeType(audioBytes) {
  if (!audioBytes || audioBytes.length < 12) {
    return 'audio/mpeg'; // 默认回退
  }

  // MP3 文件检测（帧同步或 ID3 头）
  if (audioBytes[0] === 0xFF && (audioBytes[1] & 0xE0) === 0xE0) {
    return 'audio/mpeg';
  }
  if (audioBytes[0] === 0x49 && audioBytes[1] === 0x44 && audioBytes[2] === 0x33) {
    return 'audio/mpeg'; // ID3 tagged MP3
  }

  // WAV 文件检测 RIFF....WAVE
  if (audioBytes[0] === 0x52 && audioBytes[1] === 0x49 &&
      audioBytes[2] === 0x46 && audioBytes[3] === 0x46 &&
      audioBytes[8] === 0x57 && audioBytes[9] === 0x41 &&
      audioBytes[10] === 0x56 && audioBytes[11] === 0x45) {
    return 'audio/wav';
  }

  // OGG 文件检测 OggS
  if (audioBytes[0] === 0x4F && audioBytes[1] === 0x67 &&
      audioBytes[2] === 0x67 && audioBytes[3] === 0x53) {
    return 'audio/ogg';
  }

  // M4A/AAC/MP4 容器 ftyp
  if (audioBytes[4] === 0x66 && audioBytes[5] === 0x74 &&
      audioBytes[6] === 0x79 && audioBytes[7] === 0x70) {
    return 'audio/mp4';
  }

  return 'audio/mpeg'; // 默认回退
}

init();



// 为历史记录项生成语音
async function generateAudioForHistoryItem(text) {
  try {
    const payload = {
      text: text,
      voice_type: state.voiceType || 'default',
      quality: 'draft'
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
    // Determine correct MIME type from bytes or response info
    const mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
    const blob = new Blob([audioBytes], { type: mimeType });
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
