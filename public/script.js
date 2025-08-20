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
function generateMockContent(_prompt) {
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
async function generateMockTTS() {
  return new Promise(async (resolve, reject) => {
    try {
      // 模拟TTS延迟
      setTimeout(async () => {
        try {
          // 根据当前选择的语音类型返回不同的音频
          const voiceType = state.voiceType || 'zh_male_shenyeboke_moon_bigtts';
          
          // 尝试加载demo音频文件
          const response = await fetch('/demo-sounds/女性.mp3');
          if (response.ok) {
            const audioBlob = await response.blob();
            
            // 根据语音类型模拟不同的音频效果
            console.log(`测试模式：使用${getVoiceTypeName(voiceType)}生成音频`);
            
            resolve({
              data: await blobToBase64(audioBlob),
              encoding: 'mp3',
              voice_type: voiceType,
              mode: 'test'
            });
          } else {
            // 如果demo文件不存在，生成简单的音调作为备选
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const sampleRate = audioContext.sampleRate;
            const duration = 3;
            const numSamples = sampleRate * duration;
            const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);

            // 根据语音类型生成不同频率的音调
            const frequency = getFrequencyByVoiceType(voiceType);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < numSamples; i++) {
              channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1;
            }

            const wavBlob = audioBufferToWav(audioBuffer);
            resolve({
              data: await blobToBase64(wavBlob),
              encoding: 'wav',
              voice_type: voiceType,
              mode: 'test'
            });
          }
        } catch (error) {
          reject(error);
        }
      }, 1000 + Math.random() * 1000); // 1-2秒随机延迟
    } catch (error) {
      reject(error);
    }
  });
}

// 根据语音类型获取显示名称
function getVoiceTypeName(voiceType) {
  const voiceNames = {
    'zh_female_roumeinvyou_emo_v2_mars_bigtts': '柔美女友（多情感）',
    'zh_female_shuangkuaisisi_emo_v2_mars_bigtts': '爽快思思（多情感）',
    'zh_male_yangguangqingnian_emo_v2_mars_bigtts': '阳光青年（多情感）'
  };
  return voiceNames[voiceType] || '默认语音';
}

// 根据语音类型获取不同的音调频率（用于备选音频生成）
function getFrequencyByVoiceType(voiceType) {
  const frequencies = {
    'zh_female_roumeinvyou_emo_v2_mars_bigtts': 440,  // 中音（柔美女友）
    'zh_female_shuangkuaisisi_emo_v2_mars_bigtts': 520, // 中高音（爽快思思）
    'zh_male_yangguangqingnian_emo_v2_mars_bigtts': 330  // 中低音（阳光青年）
  };
  return frequencies[voiceType] || 440;
}

// 将Blob转换为Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    // 类型检查：确保传入的参数是Blob类型
    if (!(blob instanceof Blob)) {
      // 如果是ArrayBuffer，转换为Blob
      if (blob instanceof ArrayBuffer) {
        blob = new Blob([blob], { type: 'audio/wav' });
      } else {
        reject(new Error(`blobToBase64函数期望接收Blob或ArrayBuffer类型，但实际接收到：${typeof blob}`));
        return;
      }
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // 移除data:audio/...;base64,前缀
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
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
  voiceType: storage.get('ve_voice_type', 'zh_female_roumeinvyou_emo_v2_mars_bigtts'),
  testMode: storage.get('ve_test_mode', false),
  lastContent: '',
  lastAudioBlob: null,
  lastAudioUrl: null, // 添加URL跟踪
  lastPreviewUrl: null, // 试听音频URL跟踪
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
  previewAudio: document.getElementById('previewAudio'),
  previewPlayer: document.getElementById('previewPlayer'),
  previewAudioElement: document.getElementById('previewAudioElement'),
  previewText: document.getElementById('previewText'),
  confirmPreview: document.getElementById('confirmPreview'),
  retryPreview: document.getElementById('retryPreview'),
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
  clearAllHistory: document.getElementById('clearAllHistory'),
  // 展开按钮
  expandBtn: document.getElementById('expandBtn')
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

  // 初始化文本展开功能
  initTextExpansion();

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
  el.voiceSelector.value = state.voiceType || 'zh_female_roumeinvyou_emo_v2_mars_bigtts';

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
  // 从localStorage重新加载最新的历史数据
  state.history = storage.get('ve_history', []);
  console.log('Loading history data:', state.history);
  
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
  console.log('Rendering history in modal, count:', state.history.length);
  console.log('History data:', state.history);

  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">暂无历史记录</p>';
    return;
  }

  historyList.innerHTML = state.history.map((item, index) => {
    const type = item.contentType || item.type || 'unknown';
    const timestamp = item.timestamp || item.time || Date.now();
    const text = (item.content !== null ? item.content : item.text) || '';
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
  try {
    const item = state.history && state.history[index];
    if (!item) {
      showError('未找到该条历史记录');
      return;
    }
    const text = (item.content !== null ? item.content : item.text) || '';

    state.lastContent = text;
    el.contentText.textContent = text;
    checkTextLength(text);
    el.resultSection.style.display = 'block';
    el.audioPlayer.style.display = 'none';

    hideHistoryModal();
    showSuccess('已载入历史文本，可以直接生成语音');
  } catch (e) {
    console.error(e);
    showError('载入历史记录失败');
  }
}

function deleteHistoryItem(index) {
  try {
    if (!Array.isArray(state.history)) state.history = storage.get('ve_history', []);
    if (index < 0 || index >= state.history.length) {
      showError('无法删除：索引无效');
      return;
    }

    // 删除并持久化
    state.history.splice(index, 1);
    storage.set('ve_history', state.history);

    // 重新渲染模态框与主列表
    renderHistoryInModal();
    renderHistory();
    showSuccess('已删除该条历史记录');
  } catch (e) {
    console.error(e);
    showError('删除历史记录失败');
  }
}

// 暴露到全局，供内联 onclick 调用
window.loadHistoryItem = loadHistoryItem;
window.deleteHistoryItem = deleteHistoryItem;
window.testVoicePreview = testVoicePreview;
window.previewContent = previewContent;
window.useClonedVoice = useClonedVoice;
window.deleteClonedVoice = deleteClonedVoice;

// 初始化文本展开功能
function initTextExpansion() {
  if (el.expandBtn) {
    el.expandBtn.addEventListener('click', toggleTextExpansion);
  }
}

// 切换文本展开/收起
function toggleTextExpansion() {
  const isExpanded = el.contentText.classList.contains('expanded');
  
  if (isExpanded) {
    el.contentText.classList.remove('expanded');
    el.expandBtn.textContent = '展开全文';
  } else {
    el.contentText.classList.add('expanded');
    el.expandBtn.textContent = '收起';
  }
}

// 检查文本长度并显示/隐藏展开按钮
function checkTextLength(text) {
  const maxLength = 500;
  if (text.length > maxLength) {
    el.expandBtn.style.display = 'block';
    return true;
  } else {
    el.expandBtn.style.display = 'none';
    el.contentText.classList.remove('expanded');
    return false;
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
    checkTextLength(text); // 检查文本长度并显示/隐藏展开按钮
    el.resultSection.style.display = 'block';
    el.audioPlayer.style.display = 'none';
    
    // 重置试听状态
    el.previewPlayer.style.display = 'none';
    el.generateAudio.disabled = true;
    if (state.lastPreviewUrl) {
      URL.revokeObjectURL(state.lastPreviewUrl);
      state.lastPreviewUrl = null;
    }
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

// 试听功能
async function previewContent() {
  if (!state.lastContent) {
    showError('请先生成文本内容');
    return;
  }
  
  setLoading(el.previewAudio, true);
  try {
    // 截取前30个字符作为试听内容
    const previewText = state.lastContent.substring(0, 30);
    if (previewText.length < 10) {
      throw new Error('生成的内容太短，无法进行试听');
    }
    
    // 如果使用复刻声音，先进行连接测试
    const isClonedVoice = state.voiceType && !state.voiceType.startsWith('zh_');
    if (isClonedVoice && !state.testMode) {
      showSuccess('正在测试声音连接...');
      const testResult = await testVoiceConnection(state.voiceType);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
    }
    
    const payload = {
      text: previewText,
      voice_type: state.voiceType || 'zh_female_roumeinvyou_emo_v2_mars_bigtts',
      emotion: el.mood.value === 'happy' ? 'happy' : 'neutral',
      quality: 'draft'
    };
    
    const data = await ttsSynthesize(payload);
    
    let audioBase64;
    let blob;
    
    // 处理测试模式和生产模式的不同返回格式
    if (state.testMode || (data.mode && data.mode === 'test')) {
      if (data.data && typeof data.data === 'string') {
        audioBase64 = data.data;
      } else {
        throw new Error('测试模式返回格式异常：未找到音频数据');
      }
      
      const audioBytes = base64ToBytes(audioBase64);
      const mimeType = data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg';
      blob = new Blob([audioBytes], { type: mimeType });
    } else {
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
      const mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
      blob = new Blob([audioBytes], { type: mimeType });
    }
    
    // 清理旧的试听音频URL
    if (state.lastPreviewUrl) {
      URL.revokeObjectURL(state.lastPreviewUrl);
    }
    
    const url = URL.createObjectURL(blob);
    state.lastPreviewUrl = url;
    
    // 显示试听内容
    el.previewText.textContent = `"${previewText}${state.lastContent.length > 30 ? '...' : ''}"`;
    el.previewAudioElement.src = url;
    el.previewPlayer.style.display = 'block';
    
    // 添加错误处理
    el.previewAudioElement.onerror = (e) => {
      console.error('试听音频加载失败:', e);
      showError('试听音频播放失败，请重试');
    };
    
    showSuccess('试听音频生成成功！请确认效果后生成完整语音');
    
  } catch (e) {
    console.error(e);
    showError('试听失败：' + (e.message || '请稍后重试'));
  } finally {
    setLoading(el.previewAudio, false);
  }
}

// 试听按钮事件
el.previewAudio.addEventListener('click', previewContent);

// 确认试听效果
el.confirmPreview.addEventListener('click', () => {
  el.generateAudio.disabled = false;
  el.previewPlayer.style.display = 'none';
  showSuccess('已确认试听效果，现在可以生成完整语音');
});

// 重新试听
el.retryPreview.addEventListener('click', () => {
  previewContent();
});

// 生成语音
el.generateAudio.addEventListener('click', async() => {
  if (!state.lastContent) {
    alert('请先生成文本内容');
    return;
  }
  setLoading(el.generateAudio, true);
  try {
    // 如果使用复刻声音，先进行连接测试
    const isClonedVoice = state.voiceType && !state.voiceType.startsWith('zh_');
    if (isClonedVoice && !state.testMode) {
      showSuccess('正在测试声音连接...');
      const testResult = await testVoiceConnection(state.voiceType);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
      showSuccess('声音连接测试通过，开始生成完整语音...');
    }
    
    const payload = {
      text: state.lastContent,
      voice_type: state.voiceType || 'zh_female_roumeinvyou_emo_v2_mars_bigtts',
      emotion: el.mood.value === 'happy' ? 'happy' : 'neutral',
      quality: 'draft'
    };
    const data = await ttsSynthesize(payload);

    let audioBase64;
    let blob;
    
    // 处理测试模式和生产模式的不同返回格式
    if (state.testMode || (data.mode && data.mode === 'test')) {
      // 测试模式：data已经是包含base64数据的对象
      if (data.data && typeof data.data === 'string') {
        audioBase64 = data.data;
      } else {
        throw new Error('测试模式返回格式异常：未找到音频数据');
      }
      
      const audioBytes = base64ToBytes(audioBase64);
      const mimeType = data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg';
      blob = new Blob([audioBytes], { type: mimeType });
      
      // 显示当前使用的语音类型
      const voiceTypeName = getVoiceTypeName(data.voice_type || state.voiceType);
      console.log(`使用语音类型：${voiceTypeName}`);
      showSuccess(`语音生成成功！当前语音：${voiceTypeName}`);
    } else {
      // 生产模式：按原有逻辑处理
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
      const mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
      blob = new Blob([audioBytes], { type: mimeType });
      
      const voiceTypeName = getVoiceTypeName(state.voiceType);
      showSuccess(`语音生成成功！当前语音：${voiceTypeName}`);
    }

    // 清理旧的blob URL
    if (state.lastAudioUrl) {
      URL.revokeObjectURL(state.lastAudioUrl);
    }
    
    state.lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    state.lastAudioUrl = url;
    
    // 添加错误处理
    el.audioElement.onerror = (e) => {
      console.error('音频加载失败:', e);
      showError('音频播放失败，请重试');
    };
    
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
    happy: '愉悦开心',
    neutral: '平中和性'
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
  if (!button) return;
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.loading-spinner');
  if (loading) {
    button.disabled = true;
    if (text) text.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    if (text) text.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
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
      checkTextLength(text); // 检查文本长度并显示/隐藏展开按钮
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

// 声音复刻功能相关变量
const voiceClone = {
  uploadedFile: null,
  trainingTasks: storage.get('ve_voice_clone_tasks', []),
  clonedVoices: storage.get('ve_cloned_voices', []),
  statusPollingInterval: null
};

// 声音复刻DOM元素
const voiceCloneEl = {
  uploadArea: document.getElementById('uploadArea'),
  audioFileInput: document.getElementById('audioFileInput'),
  uploadForm: document.getElementById('uploadForm'),
  speakerName: document.getElementById('speakerName'),
  voiceLanguage: document.getElementById('voiceLanguage'),
  modelType: document.getElementById('modelType'),
  startTraining: document.getElementById('startTraining'),
  cancelUpload: document.getElementById('cancelUpload'),
  statusEmpty: document.getElementById('statusEmpty'),
  statusList: document.getElementById('statusList'),
  voicesEmpty: document.getElementById('voicesEmpty'),
  voicesList: document.getElementById('voicesList'),
  refreshVoices: document.getElementById('refreshVoices')
};

// 声音复刻API调用函数
async function voiceCloneAPI(action, data = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    const payload = {
      action: action,
      ...data
    };

    const response = await fetch(`${API_BASE}/api/voice_clone`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error('Voice Clone API error:', error);
    throw error;
  }
}

// 获取已复刻声音列表
async function getClonedVoices() {
  try {
    const response = await fetch(`${API_BASE}/api/voice_clone?action=list`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data.voices || [];
  } catch (error) {
    console.error('获取声音列表失败:', error);
    return [];
  }
}

// 查询训练状态
async function getTrainingStatus(speakerId) {
  try {
    const response = await fetch(`${API_BASE}/api/voice_clone?action=status&speaker_id=${speakerId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('查询训练状态失败:', error);
    return null;
  }
}

// 初始化声音复刻功能
function initVoiceClone() {
  // 文件上传区域点击事件
  voiceCloneEl.uploadArea.addEventListener('click', () => {
    voiceCloneEl.audioFileInput.click();
  });

  // 文件拖拽上传
  voiceCloneEl.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    voiceCloneEl.uploadArea.classList.add('dragover');
  });

  voiceCloneEl.uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    voiceCloneEl.uploadArea.classList.remove('dragover');
  });

  voiceCloneEl.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    voiceCloneEl.uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  // 文件选择事件
  voiceCloneEl.audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // 开始训练按钮
  voiceCloneEl.startTraining.addEventListener('click', startVoiceTraining);

  // 取消上传按钮
  voiceCloneEl.cancelUpload.addEventListener('click', cancelUpload);

  // 刷新声音列表按钮
  voiceCloneEl.refreshVoices.addEventListener('click', refreshVoicesList);

  // 初始化显示
  renderTrainingStatus();
  renderVoicesList();
  
  // 开始状态轮询
  startStatusPolling();
}

// 处理文件选择
function handleFileSelect(file) {
  // 验证文件类型
  const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3'];
  if (!allowedTypes.includes(file.type)) {
    showError('请选择 WAV 或 MP3 格式的音频文件');
    return;
  }

  // 验证文件大小（限制为 50MB）
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    showError('文件大小不能超过 50MB');
    return;
  }

  voiceClone.uploadedFile = file;
  
  // 显示上传表单
  voiceCloneEl.uploadArea.style.display = 'none';
  voiceCloneEl.uploadForm.style.display = 'block';
  
  // 设置默认声音名称
  const defaultName = file.name.replace(/\.[^/.]+$/, ""); // 移除文件扩展名
  voiceCloneEl.speakerName.value = defaultName;
}

// 取消上传
function cancelUpload() {
  voiceClone.uploadedFile = null;
  voiceCloneEl.uploadArea.style.display = 'block';
  voiceCloneEl.uploadForm.style.display = 'none';
  voiceCloneEl.audioFileInput.value = '';
  voiceCloneEl.speakerName.value = '';
}

// 开始声音训练
async function startVoiceTraining() {
  if (!voiceClone.uploadedFile) {
    showError('请先选择音频文件');
    return;
  }

  const speakerName = voiceCloneEl.speakerName.value.trim();
  if (!speakerName) {
    showError('请输入声音名称');
    return;
  }

  setLoading(voiceCloneEl.startTraining, true);

  try {
    // 将文件转换为 base64
    const audioBase64 = await fileToBase64(voiceClone.uploadedFile);
    
    // 获取文件格式
    const audioFormat = voiceClone.uploadedFile.type.includes('wav') ? 'wav' : 'mp3';
    
    // 调用声音复刻API
    const result = await voiceCloneAPI('upload', {
      speaker_id: `speaker_${Date.now()}`,
      audio_data: audioBase64,
      audio_format: audioFormat,
      language: voiceCloneEl.voiceLanguage.value,
      model_type: parseInt(voiceCloneEl.modelType.value)
    });

    // 添加到训练任务列表
    const task = {
      speaker_id: result.speaker_id || `speaker_${Date.now()}`,
      name: speakerName,
      status: 'training',
      progress: 0,
      created_at: Date.now(),
      language: voiceCloneEl.voiceLanguage.value,
      model_type: parseInt(voiceCloneEl.modelType.value)
    };
    
    voiceClone.trainingTasks.push(task);
    storage.set('ve_voice_clone_tasks', voiceClone.trainingTasks);
    
    showSuccess('声音训练已开始，请等待训练完成');
    
    // 重置上传表单
    cancelUpload();
    
    // 更新显示
    renderTrainingStatus();
    
  } catch (error) {
    showError(`训练启动失败: ${error.message}`);
  } finally {
    setLoading(voiceCloneEl.startTraining, false);
  }
}

// 文件转 base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // 移除 data:audio/...;base64, 前缀
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 渲染训练状态
function renderTrainingStatus() {
  if (voiceClone.trainingTasks.length === 0) {
    voiceCloneEl.statusEmpty.style.display = 'block';
    voiceCloneEl.statusList.style.display = 'none';
    return;
  }

  voiceCloneEl.statusEmpty.style.display = 'none';
  voiceCloneEl.statusList.style.display = 'block';

  voiceCloneEl.statusList.innerHTML = voiceClone.trainingTasks.map(task => {
    const normalized = (task.status || '').toLowerCase();
    // 将未知/排队/等待状态统一按“训练中”样式展示
    const statusClass = (
      normalized === 'completed' ? 'status-completed' :
      normalized === 'failed' ? 'status-failed' :
      'status-training'
    );
    const statusText = {
      'training': '训练中',
      'processing': '训练中',
      'queued': '排队中',
      'pending': '排队中',
      'unknown': '处理中',
      'completed': '已完成',
      'failed': '失败'
    }[normalized] || '处理中';

    return `
      <div class="status-item">
        <div class="item-header">
          <h4 class="item-name">${escapeHtml(task.name)}</h4>
          <span class="item-status ${statusClass}">${statusText}</span>
        </div>
        ${normalized === 'training' || normalized === 'processing' || normalized === 'queued' || normalized === 'pending' || normalized === 'unknown' ? `
          <div class="item-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${task.progress || 0}%"></div>
            </div>
          </div>
        ` : ''}
        <div class="item-meta">
          <span>语言: ${task.language === 'zh' ? '中文' : '英文'}</span>
          <span>模型: ${getModelTypeName(task.model_type)}</span>
          <span>${new Date(task.created_at).toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

// 渲染已复刻声音列表
function renderVoicesList() {
  if (voiceClone.clonedVoices.length === 0) {
    voiceCloneEl.voicesEmpty.style.display = 'block';
    voiceCloneEl.voicesList.style.display = 'none';
    return;
  }

  voiceCloneEl.voicesEmpty.style.display = 'none';
  voiceCloneEl.voicesList.style.display = 'block';

  voiceCloneEl.voicesList.innerHTML = voiceClone.clonedVoices.map(voice => {
    return `
      <div class="voice-item">
        <div class="item-header">
          <h4 class="item-name">${escapeHtml(voice.name)}</h4>
          <span class="item-status status-completed">可用</span>
        </div>
        <div class="item-meta">
          <span>语言: ${voice.language === 'zh' ? '中文' : '英文'}</span>
          <span>模型: ${getModelTypeName(voice.model_type)}</span>
          <span>${new Date(voice.created_at).toLocaleString()}</span>
        </div>
        <div class="voice-actions">
          <button class="btn-preview" onclick="testVoicePreview('${voice.speaker_id}', '${escapeHtml(voice.name)}')">试听</button>
          <button class="btn-use" onclick="useClonedVoice('${voice.speaker_id}', '${escapeHtml(voice.name)}')">使用此声音</button>
          <button class="btn-delete" onclick="deleteClonedVoice('${voice.speaker_id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

// 获取模型类型名称
function getModelTypeName(modelType) {
  const names = {
    1: 'ICL',
    2: 'DiT 标准版',
    3: 'DiT 还原版'
  };
  return names[modelType] || `类型 ${modelType}`;
}

// 使用已复刻的声音
function useClonedVoice(speakerId, voiceName) {
  // 更新语音选择器
  const option = document.createElement('option');
  option.value = speakerId;
  option.textContent = `🎤 ${voiceName} (已复刻)`;
  
  // 检查是否已存在
  const existingOption = Array.from(el.voiceSelector.options).find(opt => opt.value === speakerId);
  if (!existingOption) {
    el.voiceSelector.appendChild(option);
  }
  
  // 选中这个声音
  el.voiceSelector.value = speakerId;
  state.voiceType = speakerId;
  storage.set('ve_voice_type', speakerId);
  
  showSuccess(`已切换到声音: ${voiceName}`);
}

// 声音试听功能
async function testVoicePreview(speakerId, voiceName) {
  const testText = "亲爱的宝贝，妈妈在这里陪着你，感受这温暖的声音。";
  
  try {
    showSuccess(`正在试听声音: ${voiceName}...`);
    
    const payload = {
      text: testText,
      voice_type: speakerId,
      emotion: 'neutral',
      quality: 'draft'
    };
    
    const data = await ttsSynthesize(payload);
    
    // 处理音频数据
    let audioBase64;
    if (data.data && typeof data.data === 'string') {
      audioBase64 = data.data;
    } else if (data.data && data.data.audio) {
      audioBase64 = data.data.audio;
    } else if (data.audio) {
      audioBase64 = data.audio;
    } else {
      throw new Error('未找到音频数据');
    }
    
    const audioBytes = base64ToBytes(audioBase64);
    const mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
    const blob = new Blob([audioBytes], { type: mimeType });
    
    // 创建临时音频播放器
    const tempAudio = new Audio();
    tempAudio.src = URL.createObjectURL(blob);
    tempAudio.play();
    
    showSuccess(`声音 "${voiceName}" 试听成功！`);
    
    // 清理资源
    tempAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(tempAudio.src);
    });
    
  } catch (error) {
    console.error('声音试听失败:', error);
    showError(`声音试听失败: ${error.message}`);
  }
}

// 测试声音连接功能
async function testVoiceConnection(speakerId) {
  const testText = "测试声音连接，这是一段简短的测试文本。";
  
  try {
    const payload = {
      text: testText,
      voice_type: speakerId,
      emotion: 'neutral',
      quality: 'draft'
    };
    
    const data = await ttsSynthesize(payload);
    
    // 验证返回数据
    if (data.data || data.audio) {
      return { success: true, message: '声音连接测试成功' };
    } else {
      return { success: false, message: '声音连接测试失败：未返回音频数据' };
    }
    
  } catch (error) {
    console.error('声音连接测试失败:', error);
    return { success: false, message: `声音连接测试失败: ${error.message}` };
  }
}

// 删除已复刻的声音
function deleteClonedVoice(speakerId) {
  if (!confirm('确定要删除这个声音吗？此操作不可撤销。')) {
    return;
  }
  
  // 从列表中移除
  voiceClone.clonedVoices = voiceClone.clonedVoices.filter(voice => voice.speaker_id !== speakerId);
  storage.set('ve_cloned_voices', voiceClone.clonedVoices);
  
  // 从语音选择器中移除
  const option = Array.from(el.voiceSelector.options).find(opt => opt.value === speakerId);
  if (option) {
    option.remove();
  }
  
  // 如果当前选中的是被删除的声音，切换到默认声音
  if (state.voiceType === speakerId) {
    state.voiceType = 'zh_female_roumeinvyou_emo_v2_mars_bigtts';
    el.voiceSelector.value = state.voiceType;
    storage.set('ve_voice_type', state.voiceType);
  }
  
  renderVoicesList();
  showSuccess('声音已删除');
}

// 刷新声音列表
async function refreshVoicesList() {
  try {
    setLoading(voiceCloneEl.refreshVoices, true);
    
    const voices = await getClonedVoices();
    voiceClone.clonedVoices = voices;
    storage.set('ve_cloned_voices', voices);
    
    renderVoicesList();
    showSuccess('声音列表已刷新');
  } catch (error) {
    showError(`刷新失败: ${error.message}`);
  } finally {
    setLoading(voiceCloneEl.refreshVoices, false);
  }
}

// 开始状态轮询
function startStatusPolling() {
  // 清除现有的轮询
  if (voiceClone.statusPollingInterval) {
    clearInterval(voiceClone.statusPollingInterval);
  }
  
  // 每30秒检查一次训练状态
  voiceClone.statusPollingInterval = setInterval(async () => {
    const trainingTasks = voiceClone.trainingTasks.filter(task => task.status === 'training');
    
    for (const task of trainingTasks) {
      try {
        const status = await getTrainingStatus(task.speaker_id);
        if (status) {
          // 更新任务状态
          const taskIndex = voiceClone.trainingTasks.findIndex(t => t.speaker_id === task.speaker_id);
          if (taskIndex !== -1) {
            voiceClone.trainingTasks[taskIndex].status = status.status;
            voiceClone.trainingTasks[taskIndex].progress = status.progress || 0;
            
            // 如果训练完成，添加到已复刻声音列表
            if (status.status === 'completed') {
              const completedVoice = {
                speaker_id: task.speaker_id,
                name: task.name,
                language: task.language,
                model_type: task.model_type,
                created_at: task.created_at
              };
              
              // 检查是否已存在
              const existingIndex = voiceClone.clonedVoices.findIndex(v => v.speaker_id === task.speaker_id);
              if (existingIndex === -1) {
                voiceClone.clonedVoices.push(completedVoice);
                storage.set('ve_cloned_voices', voiceClone.clonedVoices);
                renderVoicesList();
                showSuccess(`声音 "${task.name}" 训练完成！`);
              }
            }
            
            storage.set('ve_voice_clone_tasks', voiceClone.trainingTasks);
            renderTrainingStatus();
          }
        }
      } catch (error) {
        console.error(`检查任务 ${task.speaker_id} 状态失败:`, error);
      }
    }
  }, 30000); // 30秒
}

// 停止状态轮询
function stopStatusPolling() {
  if (voiceClone.statusPollingInterval) {
    clearInterval(voiceClone.statusPollingInterval);
    voiceClone.statusPollingInterval = null;
  }
}

// 页面卸载时停止轮询和清理资源
window.addEventListener('beforeunload', () => {
  stopStatusPolling();
  // 清理音频URL资源
  if (state.lastAudioUrl) {
    URL.revokeObjectURL(state.lastAudioUrl);
  }
  if (state.lastPreviewUrl) {
    URL.revokeObjectURL(state.lastPreviewUrl);
  }
});

init();

// 初始化声音复刻功能
initVoiceClone();

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
    
    // 清理旧的blob URL
    if (state.lastAudioUrl) {
      URL.revokeObjectURL(state.lastAudioUrl);
    }
    
    state.lastAudioBlob = blob;
    const url = URL.createObjectURL(blob);
    state.lastAudioUrl = url;
    
    // 添加错误处理
    el.audioElement.onerror = (e) => {
      console.error('音频加载失败:', e);
      showError('音频播放失败，请重试');
    };
    
    el.audioElement.src = url;
    el.audioPlayer.style.display = 'flex';

    // 将历史记录的文本设置为当前内容
    state.lastContent = text;
    el.contentText.textContent = text;
    checkTextLength(text); // 检查文本长度并显示/隐藏展开按钮
    el.resultSection.style.display = 'block';

    showSuccess('历史记录语音生成成功！');
  } catch (e) {
    console.error(e);
    alert('生成语音失败：' + (e.message || '请稍后重试'));
  }
}

// 扩展 voiceCloneEl 绑定新增的手动添加控件
voiceCloneEl.existingSpeakerId = document.getElementById('existingSpeakerId');
voiceCloneEl.existingSpeakerName = document.getElementById('existingSpeakerName');
voiceCloneEl.existingVoiceLanguage = document.getElementById('existingVoiceLanguage');
voiceCloneEl.existingModelType = document.getElementById('existingModelType');
voiceCloneEl.addExistingVoiceBtn = document.getElementById('addExistingVoiceBtn');

// 绑定点击事件：添加已有的声音ID
if (voiceCloneEl.addExistingVoiceBtn) {
  voiceCloneEl.addExistingVoiceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const speakerId = (voiceCloneEl.existingSpeakerId?.value || '').trim();
    const name = (voiceCloneEl.existingSpeakerName?.value || '').trim() || speakerId;
    const language = voiceCloneEl.existingVoiceLanguage?.value || 'zh';
    const model_type = parseInt(voiceCloneEl.existingModelType?.value || '1', 10);

    if (!speakerId) {
      showError('请先输入声音ID');
      return;
    }
    // 简单校验：S_ 开头更像平台ID，但不过分限制
    if (!/^S_[A-Za-z0-9]+/.test(speakerId)) {
      if (!confirm('该ID看起来不像平台生成的ID（通常以 S_ 开头），是否继续添加？')) {
        return;
      }
    }

    // 去重
    const exists = voiceClone.clonedVoices.some(v => v.speaker_id === speakerId);
    if (exists) {
      showError('该声音ID已在列表中');
      return;
    }

    const now = Date.now();
    const newVoice = {
      speaker_id: speakerId,
      name,
      language,
      model_type,
      created_at: now
    };

    voiceClone.clonedVoices.push(newVoice);
    storage.set('ve_cloned_voices', voiceClone.clonedVoices);
    renderVoicesList();

    // 同步到语音选择器并选中
    useClonedVoice(speakerId, name);

    // 清空输入框
    if (voiceCloneEl.existingSpeakerId) voiceCloneEl.existingSpeakerId.value = '';
    if (voiceCloneEl.existingSpeakerName) voiceCloneEl.existingSpeakerName.value = '';

    showSuccess('已添加到我的声音列表');
  });
}
