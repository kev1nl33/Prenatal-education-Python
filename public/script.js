import { parseTtsFetchResponse } from './utils/tts.js';
import {
  isAuthenticated,
  showPasswordDialog,
  logout,
  toggleLogoutButton,
  getAuthToken,
  getAuthTokenAsync
} from './utils/auth.js';
import {
  getAllFavorites,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  toggleFavorite,
  clearAllFavorites,
  getFavoritesByType,
  searchFavorites,
  getFavoritesStats,
  exportFavorites,
  importFavorites
} from './utils/favorites.js';

const API_BASE = ''; // 同源，不要写域名

// 引入音频处理工具函数
// 注意：在HTML中需要先加载 utils/audio.js

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

// 错误类型枚举
const ErrorTypes = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  AUTH: 'auth',
  CONFIG: 'config',
  API: 'api',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

// 分析错误类型
function analyzeError(error) {
  const message = error.message || error.toString();
  
  if (message.includes('超时') || message.includes('timeout') || message.includes('504')) {
    return {
      type: ErrorTypes.TIMEOUT,
      userMessage: '请求超时，请稍后重试或尝试缩短文本长度',
      suggestion: '建议：1. 检查网络连接 2. 缩短输入文本 3. 稍后重试'
    };
  }
  
  if (message.includes('401') || message.includes('认证') || message.includes('token')) {
    return {
      type: ErrorTypes.AUTH,
      userMessage: '认证失败，请检查API配置',
      suggestion: '建议：1. 检查TTS API Key是否正确 2. 确认账户余额充足'
    };
  }
  
  if (message.includes('403') || message.includes('权限')) {
    return {
      type: ErrorTypes.AUTH,
      userMessage: '权限不足，请检查API权限配置',
      suggestion: '建议：1. 确认API密钥有相应权限 2. 检查服务是否已开通'
    };
  }
  
  if (message.includes('网络') || message.includes('连接') || message.includes('fetch')) {
    return {
      type: ErrorTypes.NETWORK,
      userMessage: '网络连接失败，请检查网络状态',
      suggestion: '建议：1. 检查网络连接 2. 确认服务器状态正常 3. 稍后重试'
    };
  }
  
  if (message.includes('配置') || message.includes('参数')) {
    return {
      type: ErrorTypes.CONFIG,
      userMessage: '配置错误，请检查相关设置',
      suggestion: '建议：1. 检查API配置是否完整 2. 确认参数格式正确'
    };
  }
  
  if (message.includes('API') || message.includes('服务')) {
    return {
      type: ErrorTypes.API,
      userMessage: 'API服务异常，请稍后重试',
      suggestion: '建议：1. 稍后重试 2. 检查服务状态 3. 联系技术支持'
    };
  }
  
  return {
    type: ErrorTypes.UNKNOWN,
    userMessage: message.length > 100 ? message.substring(0, 100) + '...' : message,
    suggestion: '建议：1. 刷新页面重试 2. 检查网络连接 3. 联系技术支持'
  };
}

// 显示错误提示（增强版）
function showError(error, options = {}) {
  const errorInfo = typeof error === 'string' ? 
    { type: ErrorTypes.UNKNOWN, userMessage: error, suggestion: '' } : 
    analyzeError(error);
  
  // 创建错误提示元素
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message enhanced';
  
  // 根据错误类型选择图标和颜色
  const errorConfig = {
    [ErrorTypes.TIMEOUT]: { icon: '⏱️', color: '#ff6b6b' },
    [ErrorTypes.AUTH]: { icon: '🔐', color: '#ff4757' },
    [ErrorTypes.NETWORK]: { icon: '🌐', color: '#ff6348' },
    [ErrorTypes.CONFIG]: { icon: '⚙️', color: '#ff7675' },
    [ErrorTypes.API]: { icon: '🔧', color: '#fd79a8' },
    [ErrorTypes.VALIDATION]: { icon: '⚠️', color: '#fdcb6e' },
    [ErrorTypes.UNKNOWN]: { icon: '❌', color: '#ff4757' }
  };
  
  const config = errorConfig[errorInfo.type] || errorConfig[ErrorTypes.UNKNOWN];
  
  errorDiv.innerHTML = `
    <div class="error-header">
      <span class="error-icon">${config.icon}</span>
      <span class="error-title">操作失败</span>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
    <div class="error-content">
      <div class="error-message-text">${errorInfo.userMessage}</div>
      ${errorInfo.suggestion ? `<div class="error-suggestion">${errorInfo.suggestion}</div>` : ''}
    </div>
    ${options.showRetry ? '<button class="error-retry-btn" onclick="' + (options.retryAction || '') + '">重试</button>' : ''}
  `;
  
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-left: 4px solid ${config.color};
    padding: 0;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 350px;
    min-width: 280px;
    animation: slideIn 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // 添加样式
  if (!document.querySelector('#enhanced-error-style')) {
    const style = document.createElement('style');
    style.id = 'enhanced-error-style';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .error-message.enhanced .error-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #e9ecef;
      }
      .error-message.enhanced .error-icon {
        margin-right: 8px;
        font-size: 16px;
      }
      .error-message.enhanced .error-title {
        flex: 1;
        font-weight: 600;
        color: #495057;
        font-size: 14px;
      }
      .error-message.enhanced .error-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #6c757d;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .error-message.enhanced .error-close:hover {
        color: #495057;
      }
      .error-message.enhanced .error-content {
        padding: 16px;
      }
      .error-message.enhanced .error-message-text {
        color: #495057;
        font-size: 14px;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      .error-message.enhanced .error-suggestion {
        color: #6c757d;
        font-size: 12px;
        line-height: 1.3;
        background: #f8f9fa;
        padding: 8px;
        border-radius: 4px;
        margin-top: 8px;
      }
      .error-message.enhanced .error-retry-btn {
        background: #007bff;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
      }
      .error-message.enhanced .error-retry-btn:hover {
        background: #0056b3;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(errorDiv);

  // 自动移除（可配置时间）
  const autoRemoveTime = options.autoRemove !== false ? (options.duration || 5000) : 0;
  if (autoRemoveTime > 0) {
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, autoRemoveTime);
  }
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
    'zh_female_tianmeitaozi_mars_bigtts': '甜美桃子（多情感）',
    'zh_female_roumeinvyou_emo_v2_mars_bigtts': '柔美女友（多情感）',
    'zh_female_shuangkuaisisi_emo_v2_mars_bigtts': '爽快思思（多情感）',
    'ICL_zh_female_huoponvhai_tobzh_male_yangguangqingnian_emo_v2_mars_bigtts': '活泼女孩'
  };
  
  // 检查是否为复刻声音
  if (voiceType && !voiceNames[voiceType]) {
    // 尝试从复刻声音列表中查找
    const clonedVoice = voiceClone.clonedVoices.find(voice => voice.speaker_id === voiceType);
    if (clonedVoice) {
      return `🎤 ${clonedVoice.name} (已复刻)`;
    }
    
    // 尝试从语音选择器中查找
    const option = Array.from(el.voiceSelector.options).find(opt => opt.value === voiceType);
    if (option) {
      return option.textContent;
    }
  }
  
  return voiceNames[voiceType] || '默认语音';
}

// 根据语音类型获取不同的音调频率（用于备选音频生成）
function getFrequencyByVoiceType(voiceType) {
  const frequencies = {
    'zh_female_tianmeitaozi_mars_bigtts': 460,  // 中高音（甜美桃子）
    'zh_female_roumeinvyou_emo_v2_mars_bigtts': 440,  // 中音（柔美女友）
    'zh_female_shuangkuaisisi_emo_v2_mars_bigtts': 520, // 中高音（爽快思思）
    'ICL_zh_female_huoponvhai_tob': 330  // 活泼女孩
  };
  return frequencies[voiceType] || 440;
}

// 验证语音配置
function validateVoiceConfiguration() {
  const currentVoice = state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts';
  const isClonedVoice = currentVoice && !currentVoice.startsWith('zh_');
  
  const validation = {
    hasVoiceType: !!currentVoice,
    hasEmotion: !!el.mood.value,
    isValidVoiceType: currentVoice && currentVoice.length > 0,
    isValidEmotion: ['happy', 'neutral'].includes(el.mood.value),
    // 在prod模式下不需要检查ttsApiKey，因为使用火山引擎的APP_ID和ACCESS_TOKEN
    hasTTSConfig: state.testMode ? !!state.ttsApiKey : true
  };
  
  const issues = [];
  
  if (!validation.hasVoiceType || !validation.isValidVoiceType) {
    issues.push('语音类型无效');
  }
  
  if (!validation.hasEmotion || !validation.isValidEmotion) {
    issues.push('情绪设置无效');
  }
  
  // 只在测试模式下检查TTS API Key配置
  if (!isClonedVoice && !validation.hasTTSConfig) {
    issues.push('TTS配置缺失（需要TTS API Key）');
  }
  
  console.log('🔍 配置验证结果:', {
    validation,
    issues,
    isValid: issues.length === 0
  });
  
  return {
    isValid: issues.length === 0,
    issues,
    validation
  };
}

// 更新语音状态显示
function updateVoiceStatusDisplay() {
  const currentVoice = state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts';
  const currentEmotion = el.mood.value || 'neutral';
  const voiceName = getVoiceTypeName(currentVoice);
  const emotionName = currentEmotion === 'happy' ? '开心' : '中性';
  const isCloned = currentVoice && !currentVoice.startsWith('zh_');
  
  // 查找或创建状态显示元素
  let statusDisplay = document.getElementById('voiceStatusDisplay');
  if (!statusDisplay) {
    statusDisplay = document.createElement('div');
    statusDisplay.id = 'voiceStatusDisplay';
    statusDisplay.style.cssText = `
      margin: 10px 0;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      font-size: 14px;
      color: #fff;
      border-left: 3px solid #4CAF50;
    `;
    
    // 插入到语音设置区域
    const voiceSettings = document.querySelector('.voice-settings');
    if (voiceSettings) {
      voiceSettings.appendChild(statusDisplay);
    }
  }
  
  statusDisplay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-weight: bold;">当前设置:</span>
      <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">
        ${isCloned ? '🎤' : '🎵'} ${voiceName}
      </span>
      <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">
        😊 ${emotionName}
      </span>
    </div>
  `;
  
  console.log('🔄 状态显示已更新:', {
    voice: voiceName,
    emotion: emotionName,
    isCloned,
    timestamp: new Date().toISOString()
  });
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
      'Content-Type': 'application/json',
      'X-Auth-Token': await getAuthTokenAsync() // 使用异步Token获取函数
    };


    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ prompt, model }),
      cache: 'no-store' // 明确禁用缓存
    });

    const data = await response.json();

    // 添加调试信息
    console.log('API Response:', data);

    if (!response.ok) {
      // 处理401鉴权错误
      if (response.status === 401) {
        const friendlyMessage = '访问令牌无效或缺失，请联系管理员获取有效的访问令牌';
        showError(friendlyMessage);
        throw new Error(friendlyMessage);
      }
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
// 带超时和重试的fetch函数
async function fetchWithTimeoutAndRetry(url, options, timeout = 60000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store' // 明确禁用缓存，解决POST请求缓存错误
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`请求超时 (尝试 ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) {
          throw new Error(`请求超时：服务器响应时间超过${timeout/1000}秒，请稍后重试`);
        }
      } else if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
        console.warn(`服务器超时 (尝试 ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) {
          throw new Error('服务器处理超时，请尝试缩短文本长度或稍后重试');
        }
      } else {
        throw error;
      }
      
      // 重试前等待
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最大5秒
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// 文本分段处理函数
function segmentText(text, maxLength = 800) {
  if (!text || text.length <= maxLength) {
    return [text];
  }
  
  const segments = [];
  const sentences = text.split(/[。！？；\n]/);
  let currentSegment = '';
  
  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;
    
    // 如果单个句子就超过最大长度，强制分割
    if (sentence.length > maxLength) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = '';
      }
      // 按逗号分割长句子
      const parts = sentence.split('，');
      let tempSegment = '';
      for (let part of parts) {
        if ((tempSegment + part).length > maxLength) {
          if (tempSegment) {
            segments.push(tempSegment.trim());
          }
          tempSegment = part;
        } else {
          tempSegment += (tempSegment ? '，' : '') + part;
        }
      }
      if (tempSegment) {
        segments.push(tempSegment.trim());
      }
      continue;
    }
    
    // 检查添加当前句子是否会超过长度限制
    const testSegment = currentSegment + (currentSegment ? '。' : '') + sentence;
    if (testSegment.length > maxLength && currentSegment) {
      segments.push(currentSegment.trim());
      currentSegment = sentence;
    } else {
      currentSegment = testSegment;
    }
  }
  
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }
  
  return segments.filter(seg => seg.length > 0);
}

// 分段TTS合成函数
async function synthesizeSegmentedText(text, voiceType, emotion = 'neutral', quality = 'draft', onProgress = null) {
  const segments = segmentText(text, 800); // 800字符为一段
  console.log(`文本分为 ${segments.length} 段进行处理`);
  
  const audioSegments = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`正在处理第 ${i + 1}/${segments.length} 段，长度: ${segment.length} 字符`);
    
    if (onProgress) {
      onProgress(i + 1, segments.length, `正在生成第 ${i + 1}/${segments.length} 段语音...`);
    }
    
    try {
      const payload = {
        text: segment,
        voice_type: voiceType,
        emotion: emotion,
        quality: quality
      };
      
      const data = await ttsSynthesize(payload);
      audioSegments.push(data);
      
      // 段间延迟，避免请求过于频繁
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`第 ${i + 1} 段处理失败:`, error);
      throw new Error(`第 ${i + 1} 段语音生成失败: ${error.message}`);
    }
  }
  
  return audioSegments;
}

async function ttsSynthesize(payload) {
  try {
    // 检查是否为测试模式
    if (state.testMode) {
      console.warn('运行在测试模式，将生成模拟音频');
      return await generateMockTTS();
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-Token': await getAuthTokenAsync()
    };

    const response = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    // 统一调用解析函数
    return await parseTtsFetchResponse(response);
    
  } catch (error) {
    console.error('TTS API调用失败:', error);
    // 向上抛出错误，由调用方处理UI提示
    throw error;
  }
}

// 全局状态
const state = {
  // 移除API密钥配置，改为后端托管
  voiceType: storage.get('ve_voice_type', 'zh_female_tianmeitaozi_mars_bigtts'),
  testMode: storage.get('ve_test_mode', false),
  lastContent: '',
  lastAudioBlob: null,
  lastAudioUrl: null, // 添加URL跟踪
  lastPreviewUrl: null, // 试听音频URL跟踪
  history: storage.get('ve_history', []),
  audioPlaylist: null, // 音频播放列表
  currentSegmentIndex: 0, // 当前播放段落索引
  autoPlay: storage.get('ve_auto_play', true) // 自动播放下一段开关
};

// DOM 元素
const el = {
  // 移除API配置相关的DOM元素
  contentType: document.getElementById('contentType'),
  contentCards: document.querySelectorAll('.content-card'),
  voiceSelector: document.getElementById('voiceSelector'),
  mood: document.getElementById('mood'),
  duration: document.getElementById('duration'),
  testVoiceSettings: document.getElementById('testVoiceSettings'),
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
  // 历史记录模态框相关元素
  openHistoryBtn: document.getElementById('openHistoryBtn'),
  historyModal: document.getElementById('historyModal'),
  closeHistoryModal: document.getElementById('closeHistoryModal'),
  closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
  clearAllHistory: document.getElementById('clearAllHistory'),
  // 展开按钮
  expandBtn: document.getElementById('expandBtn')
};

// 移除设置模态框相关函数

// 初始化密码保护
async function initPasswordProtection() {
  if (!isAuthenticated()) {
    try {
      await showPasswordDialog();
      showSuccess('验证成功，欢迎使用胎教语音生成服务！');
    } catch (error) {
      document.body.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-family: Arial, sans-serif;
          text-align: center;
        ">
          <div>
            <h1>🔒 访问被拒绝</h1>
            <p>您需要输入正确的密码才能访问此服务</p>
            <button onclick="location.reload()" style="
              background: white;
              color: #667eea;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              margin-top: 20px;
            ">重新验证</button>
          </div>
        </div>
      `;
      return false;
    }
  }
  return true;
}

// 添加退出登录按钮到页面
function addLogoutButton() {
  // 检查是否已存在退出按钮
  if (document.getElementById('logoutBtn')) return;
  
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logoutBtn';
  logoutBtn.innerHTML = '🚪 退出登录';
  logoutBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f44336;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
  `;
  
  logoutBtn.addEventListener('click', () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
    }
  });
  
  document.body.appendChild(logoutBtn);
}

// 初始化
async function init() {
  // 首先进行密码验证
  const authSuccess = await initPasswordProtection();
  if (!authSuccess) return;
  
  // 显示退出登录按钮并绑定事件
  toggleLogoutButton();
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // 移除API配置初始化，改为后端托管
  
  // 初始化内容卡片选择
  initContentCards();

  // 初始化语音选择器（下拉框）
  initVoiceSelector();
  
  // 加载复刻声音到语音选择器
  loadClonedVoicesToSelector();

  // 初始化历史记录功能
  initHistoryModal();

  // 初始化文本展开功能
  initTextExpansion();

  renderHistory();
  
  // 初始化状态显示
  updateVoiceStatusDisplay();
}

// 显示开发中提示对话框
function showDevelopmentAlert(message) {
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // 创建提示框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 450px;
    width: 90%;
    text-align: center;
    position: relative;
  `;
  
  dialog.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
    <h2 style="margin: 0 0 16px 0; color: #333; font-size: 24px; font-weight: 600;">功能开发中</h2>
    <p style="margin: 0 0 24px 0; color: #666; line-height: 1.6; white-space: pre-line;">${message}</p>
    <button id="developmentOkBtn" style="
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.3s ease;
    ">我知道了</button>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  const okBtn = dialog.querySelector('#developmentOkBtn');
  
  // 关闭对话框
  function closeDialog() {
    document.body.removeChild(overlay);
  }
  
  // 事件监听
  okBtn.addEventListener('click', closeDialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
    }
  });
  
  // 按ESC键关闭
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
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
  // 检查是否为禁用的卡片
  if (selectedCard.classList.contains('disabled')) {
    const contentType = selectedCard.getAttribute('data-type');
    
    // 显示开发中提示
    if (contentType === 'music') {
      showDevelopmentAlert('音乐引导功能正在开发中，敬请期待！\n\n我们正在努力为您打造更好的音乐引导体验，包括：\n• 专业的胎教音乐库\n• 个性化音乐推荐\n• 智能节拍调节\n\n请先体验其他精彩功能。');
    }
    return; // 阻止选择禁用的卡片
  }

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
  el.voiceSelector.value = state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts';

  // 添加change事件监听器
  el.voiceSelector.addEventListener('change', (e) => {
    const selectedVoice = e.target.value;
    const voiceName = e.target.options[e.target.selectedIndex].textContent;
    const isClonedVoice = selectedVoice && !selectedVoice.startsWith('zh_');
    
    // 详细调试日志
    console.log('🎵 语音选择器变更 - 详细信息:', {
      selectedVoice,
      voiceName,
      isClonedVoice,
      previousVoiceType: state.voiceType,
      currentEmotion: el.mood.value,
      timestamp: new Date().toISOString()
    });
    
    // 更新state
    const oldVoiceType = state.voiceType;
    state.voiceType = selectedVoice;

    // 保存到localStorage
    storage.set('ve_voice_type', selectedVoice);
    
    // 验证保存是否成功
    const savedVoice = storage.get('ve_voice_type');
    console.log('💾 语音保存验证:', {
      intended: selectedVoice,
      saved: savedVoice,
      success: savedVoice === selectedVoice
    });
    
    // 显示当前选择的语音
    showSuccess(`已选择语音：${voiceName}`);
    
    // 更新状态显示
    updateVoiceStatusDisplay();
    
    console.log('✅ 语音切换完成:', {
      from: oldVoiceType,
      to: selectedVoice,
      type: isClonedVoice ? '复刻声音' : '预设声音'
    });
  });
  
  // 为情绪选择器添加change事件监听器
  el.mood.addEventListener('change', (e) => {
    const selectedEmotion = e.target.value;
    const emotionName = selectedEmotion === 'happy' ? '开心' : '中性';
    
    console.log('😊 情绪选择器变更:', {
      selectedEmotion,
      emotionName,
      currentVoice: state.voiceType,
      timestamp: new Date().toISOString()
    });
    
    // 更新状态显示
    updateVoiceStatusDisplay();
    
    showSuccess(`已选择情绪：${emotionName}`);
   });
   
   // 为测试按钮添加事件监听器
   el.testVoiceSettings.addEventListener('click', testCurrentVoiceSettings);
}

// 测试当前语音设置
async function testCurrentVoiceSettings() {
  const testTexts = [
    '这是一段测试语音，用来验证当前的语音设置是否正常工作。',
    '亲爱的宝贝，妈妈在这里陪着你。',
    '今天天气真好，阳光温暖地照在身上。'
  ];
  const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];

  setLoading(el.testVoiceSettings, true);
  try {
    const payload = {
      text: randomText,
      voice_type: state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts',
      emotion: el.mood.value || 'neutral',
      quality: 'draft'
    };
    console.log('🧪 测试payload:', payload);
    showSuccess('正在测试语音设置...');

    // --- 统一调用流程 ---
    const response = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await getAuthTokenAsync() },
        body: JSON.stringify(payload)
    });

    const parsed = await parseTtsFetchResponse(response);
    console.log('🧪 测试API响应解析结果:', parsed);

    // --- 播放音频 ---
    const tempAudio = new Audio(parsed.audioUrl);
    tempAudio.play().catch(err => {
        console.error('测试音频自动播放失败:', err);
        showError('测试音频播放失败，可能已被浏览器阻止。');
    });

    const voiceName = getVoiceTypeName(payload.voice_type);
    showSuccess(`✅ 语音测试成功！正在播放：${voiceName}`);

    // 播放结束后释放URL资源
    tempAudio.addEventListener('ended', () => URL.revokeObjectURL(parsed.audioUrl));

  } catch (error) {
    console.error('❌ 语音测试失败:', error);
    showError(`语音测试失败: ${error.message}`);
  } finally {
    setLoading(el.testVoiceSettings, false);
  }
}

// 加载复刻声音到语音选择器
function loadClonedVoicesToSelector() {
  // 获取已保存的复刻声音列表
  const clonedVoices = storage.get('ve_cloned_voices', []);
  
  // 为每个复刻声音添加选项
  clonedVoices.forEach(voice => {
    // 检查是否已存在该选项
    const existingOption = Array.from(el.voiceSelector.options).find(opt => opt.value === voice.speaker_id);
    if (!existingOption) {
      const option = document.createElement('option');
      option.value = voice.speaker_id;
      option.textContent = `🎤 ${voice.name} (已复刻)`;
      el.voiceSelector.appendChild(option);
    }
  });
  
  // 重新设置当前选中的语音（确保复刻声音能正确选中）
  if (state.voiceType) {
    el.voiceSelector.value = state.voiceType;
  }
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
    // 统一使用与renderHistory相同的字段
    const type = item.type || 'unknown';
    const mood = item.mood || 'neutral';
    const duration = item.duration || 'short';
    const timestamp = item.time || Date.now();
    const text = item.text || '';
    const preview = text.substring(0, 100);
    return `
    <div class="history-item" data-index="${index}">
      <div class="history-content">
        <div class="history-meta">
          <span class="badge">${escapeHtml(type)}</span>
          <span class="badge">${escapeHtml(mood)}</span>
          <span class="badge">${escapeHtml(duration)}</span>
          <span class="time">${new Date(timestamp).toLocaleString()}</span>
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

// getContentTypeLabel函数已删除，因为现在直接使用原始type值

// 加载历史记录项
function loadHistoryItem(index) {
  try {
    const item = state.history && state.history[index];
    if (!item) {
      showError('未找到该条历史记录');
      return;
    }
    // 统一使用text字段
    const text = item.text || '';

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

// ESC键关闭模态框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (el.historyModal.style.display === 'flex') {
      hideHistoryModal();
    }
  }
});

// 配置保存逻辑已移除，所有配置现在由后端托管

// 生成胎教内容
// 清理文本中的井号字符，避免朗读时听到"井号"发音
function cleanTextForReading(text) {
  if (!text) return text;
  // 移除markdown标题格式的井号
  return text.replace(/^#{1,6}\s*/gm, '').trim();
}

el.generateContent.addEventListener('click', async() => {
  const prompt = buildPrompt();
  setLoading(el.generateContent, true);
  try {
    const model = (state.modelEndpoint && state.modelEndpoint.trim()) ? state.modelEndpoint.trim() : 'doubao-1.5-pro-32k-250115';
    const data = await arkGenerate(prompt, model);
    const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    // 清理文本中的井号字符
    const cleanedText = cleanTextForReading(text);
    state.lastContent = cleanedText;
    el.contentText.textContent = cleanedText;
    checkTextLength(cleanedText); // 检查文本长度并显示/隐藏展开按钮
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
  const currentText = state.lastContent || el.contentText.textContent.trim();
  if (!currentText) {
    showError('请先输入或生成文本内容');
    return;
  }
  
  setLoading(el.previewAudio, true);
  try {
    const previewText = currentText.substring(0, 10);
    if (previewText.length < 5) throw new Error('内容太短，无法试听');

    const payload = {
      text: previewText,
      voice_type: state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts',
      emotion: el.mood.value || 'neutral',
      quality: 'draft'
    };
    
    const response = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await getAuthTokenAsync() },
        body: JSON.stringify(payload)
    });
    const parsed = await parseTtsFetchResponse(response);

    if (state.lastPreviewUrl) URL.revokeObjectURL(state.lastPreviewUrl);
    state.lastPreviewUrl = parsed.audioUrl;

    const audio = el.previewAudioElement;
    audio.src = parsed.audioUrl;
    audio.load();

    el.previewText.textContent = `"${previewText}${currentText.length > 10 ? '...' : ''}"`;    
    el.previewPlayer.style.display = 'block';
    showSuccess('试听已就绪，请点击播放。');

  } catch (e) {
    showError(`试听失败: ${e.message}`);
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
    showError('请先生成文本内容');
    return;
  }
  
  const textLength = state.lastContent.length;
  const voiceType = state.voiceType || 'zh_female_tianmeitaozi_mars_bigtts';
  const emotion = el.mood.value || 'neutral';
  
  setLoading(el.generateAudio, true);
  
  try {
    // 如果文本较短（小于800字符），使用原有的单次请求方式
    if (textLength <= 800) {
      console.log(`文本长度 ${textLength} 字符，使用单次请求模式`);
      const payload = {
        text: state.lastContent,
        voice_type: voiceType,
        emotion: emotion,
        quality: 'draft'
      };

      const response = await fetch(`${API_BASE}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await getAuthTokenAsync() },
          body: JSON.stringify(payload)
      });
      const parsed = await parseTtsFetchResponse(response);

      if (state.lastAudioUrl) URL.revokeObjectURL(state.lastAudioUrl);
      
      state.lastAudioBlob = parsed.blob;
      state.lastAudioUrl = parsed.audioUrl;
      
      el.audioElement.src = parsed.audioUrl;
      el.audioPlayer.style.display = 'flex';
      el.audioElement.load();
      el.audioElement.play().catch(err => {
        console.warn('Audio autoplay blocked:', err);
        showError('浏览器阻止了自动播放，请手动点击播放按钮。');
      });
      showSuccess(`语音生成成功！当前语音：${getVoiceTypeName(payload.voice_type)}`);
    } else {
      // 长文本使用分段处理
      console.log(`文本长度 ${textLength} 字符，使用分段处理模式`);
      
      const audioSegments = await synthesizeSegmentedText(
        state.lastContent,
        voiceType,
        emotion,
        'draft',
        (current, total, message) => {
          const btn = el.generateAudio.querySelector('.btn-text');
          if (btn) {
            btn.textContent = message;
          }
        }
      );
      
      // 创建音频播放列表
      await createAudioPlaylist(audioSegments, voiceType);
      showSuccess(`长文本语音生成成功！共 ${audioSegments.length} 段，当前语音：${getVoiceTypeName(voiceType)}`);
    }

  } catch (e) {
    console.error('语音生成失败:', e);
    showError(`生成语音失败: ${e.message}`);
  } finally {
    setLoading(el.generateAudio, false);
    // 恢复按钮文本
    const btn = el.generateAudio.querySelector('.btn-text');
    if (btn) {
      btn.textContent = '生成语音';
    }
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

  return `请以温柔、积极、安定的语气，面向孕妈妈，生成${typeMap[type]}。整体基调为"${moodMap[mood]}"，篇幅${durationMap[duration]}。要求：\n- 用词轻柔、避免刺激、避免负面暗示\n- 建议分为自然小段，便于朗读\n- 适当加入呼吸/放松/想象引导\n- 面向中文语境读者，使用简体中文\n- 请使用自然流畅的叙述格式，不要使用markdown标题格式（如#、##、###等）`;
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
      // 清理文本中的井号字符
      const cleanedText = cleanTextForReading(text);
      state.lastContent = cleanedText;
      el.contentText.textContent = cleanedText;
      checkTextLength(cleanedText); // 检查文本长度并显示/隐藏展开按钮
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



// 将原始 PCM 数据转换为 WAV 格式
function pcmToWav(pcmData, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // WAV 文件头
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // 复制 PCM 数据
  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);
  
  return buffer;
}

// 附加：将原始音频字节或源 Blob 解码为 WAV，并返回可播放的 URL
async function decodeAudioBytesToWavUrl(audioBytes, srcBlob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('当前浏览器不支持WebAudio');

  // 构造候选 ArrayBuffer：优先使用字节数据，其次使用源 Blob
  const candidates = [];
  if (audioBytes && audioBytes.buffer) {
    try {
      const abFromBytes = audioBytes.buffer.slice(
        audioBytes.byteOffset,
        audioBytes.byteOffset + audioBytes.byteLength
      );
      candidates.push(abFromBytes);
    } catch (e) {
      console.warn('从字节获取ArrayBuffer失败', e);
    }
  }
  if (srcBlob && typeof srcBlob.arrayBuffer === 'function') {
    try {
      const abFromBlob = await srcBlob.arrayBuffer();
      candidates.push(abFromBlob);
    } catch (e) {
      console.warn('从Blob读取ArrayBuffer失败', e);
    }
  }
  if (candidates.length === 0) {
    throw new Error('没有可用的音频数据用于解码');
  }

  let lastErr;
  for (const ab of candidates) {
    const ctx = new AudioCtx();
    try {
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
      const decoded = await new Promise((resolve, reject) => {
        try {
          const maybePromise = ctx.decodeAudioData(ab, resolve, reject);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });
      const wavBuffer = audioBufferToWav(decoded);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      const wavUrl = URL.createObjectURL(wavBlob);
      try { await ctx.close(); } catch {}
      return wavUrl;
    } catch (err) {
      lastErr = err;
      try { await ctx.close(); } catch {}
      continue;
    }
  }
  throw lastErr || new Error('音频解码失败');
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

// 新增：规范化并安全解码 Base64，处理 URL-safe 与缺失的 padding
function normalizeBase64(str) {
  if (!str) return '';
  const idx = str.indexOf('base64,');
  if (idx !== -1) {
    str = str.slice(idx + 7);
  }
  str = str.trim().replace(/[\r\n\s]/g, '');
  // URL-safe 转标准
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) {
    str += '='.repeat(4 - pad);
  }
  return str;
}

function safeBase64ToBytes(b64) {
  const normalized = normalizeBase64(b64);
  try {
    return base64ToBytes(normalized);
  } catch (err) {
    console.error('Base64解码失败', err, { length: b64 ? b64.length : 0 });
    throw new Error('音频数据解码失败，请稍后重试');
  }
}

// 检测音频数据的MIME类型
function detectAudioMimeType(audioBytes, serverEncoding = null) {
  // 优先使用服务器返回的编码信息
  if (serverEncoding) {
    const encodingMap = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg', 
      'mpeg': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'opus': 'audio/ogg',
      'mp4': 'audio/mp4',
      'aac': 'audio/mp4',
      'pcm': 'audio/wav'  // PCM数据应该已转换为WAV
    };
    let mimeType = encodingMap[serverEncoding.toLowerCase()];
    if (mimeType) {
      console.log(`使用服务器指定的音频格式: ${serverEncoding} -> ${mimeType}`);
      return mimeType;
    }
  }

  if (!audioBytes || audioBytes.length < 12) {
    console.warn('音频数据太小，默认使用WAV格式');
    return 'audio/wav';
  }

  // WAV 文件检测 RIFF....WAVE（优先检测，因为后端会转换PCM为WAV）
  if (audioBytes[0] === 0x52 && audioBytes[1] === 0x49 &&
      audioBytes[2] === 0x46 && audioBytes[3] === 0x46 &&
      audioBytes[8] === 0x57 && audioBytes[9] === 0x41 &&
      audioBytes[10] === 0x56 && audioBytes[11] === 0x45) {
    console.log('检测到WAV格式音频');
    return 'audio/wav';
  }

  // MP3 文件检测（帧同步或 ID3 头）
  if (audioBytes[0] === 0xFF && (audioBytes[1] & 0xE0) === 0xE0) {
    console.log('检测到MP3格式音频（帧同步）');
    return 'audio/mpeg';
  }
  if (audioBytes[0] === 0x49 && audioBytes[1] === 0x44 && audioBytes[2] === 0x33) {
    console.log('检测到MP3格式音频（ID3标签）');
    return 'audio/mpeg';
  }

  // OGG 文件检测 OggS
  if (audioBytes[0] === 0x4F && audioBytes[1] === 0x67 &&
      audioBytes[2] === 0x67 && audioBytes[3] === 0x53) {
    console.log('检测到OGG格式音频');
    return 'audio/ogg';
  }

  // M4A/AAC/MP4 容器 ftyp
  if (audioBytes[4] === 0x66 && audioBytes[5] === 0x74 &&
      audioBytes[6] === 0x79 && audioBytes[7] === 0x70) {
    console.log('检测到MP4格式音频');
    return 'audio/mp4';
  }

  // 如果没有识别到特定格式头，默认为WAV
  console.warn('无法识别音频格式，默认使用WAV');
  return 'audio/wav';
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
      'Content-Type': 'application/json',
      'X-Auth-Token': await getAuthTokenAsync() // 使用异步Token获取函数
    };

    const payload = {
      action: action,
      ...data
    };

    const response = await fetch(`${API_BASE}/api/voice_clone`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      cache: 'no-store' // 明确禁用缓存
    });

    const result = await response.json();

    if (!response.ok) {
      // 处理401鉴权错误
      if (response.status === 401) {
        const friendlyMessage = '访问令牌无效或缺失，请联系管理员获取有效的访问令牌';
        showError(friendlyMessage);
        throw new Error(friendlyMessage);
      }
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
    const headers = {
      'X-Auth-Token': await getAuthTokenAsync() // 使用异步Token获取函数
    };
    const response = await fetch(`${API_BASE}/api/voice_clone?action=list`, { 
      headers,
      cache: 'no-store' // 明确禁用缓存
    });
    const data = await response.json();
    
    if (!response.ok) {
      // 处理401鉴权错误
      if (response.status === 401) {
        const friendlyMessage = '访问令牌无效或缺失，请联系管理员获取有效的访问令牌';
        showError(friendlyMessage);
        throw new Error(friendlyMessage);
      }
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
    const headers = {
      'X-Auth-Token': await getAuthTokenAsync() // 使用异步Token获取函数
    };
    const response = await fetch(`${API_BASE}/api/voice_clone?action=status&speaker_id=${speakerId}`, { 
      headers,
      cache: 'no-store' // 明确禁用缓存
    });
    const data = await response.json();
    
    if (!response.ok) {
      // 处理401鉴权错误
      if (response.status === 401) {
        const friendlyMessage = '访问令牌无效或缺失，请联系管理员获取有效的访问令牌';
        showError(friendlyMessage);
        throw new Error(friendlyMessage);
      }
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

// 声音复刻专用TTS函数（简化版，直接使用统一的TTS接口）
async function voiceCloneTTSSynthesize(payload) {
  try {
    // 检查是否为复刻声音
    const isClonedVoice = payload.voice_type && !payload.voice_type.startsWith('zh_');
    
    console.log('调用TTS接口:', {
      voice_type: payload.voice_type,
      is_cloned: isClonedVoice,
      text_length: payload.text ? payload.text.length : 0
    });
    
    // 直接使用统一的TTS接口，后端会根据voice_type自动判断处理方式
    return await ttsSynthesize(payload);
    
  } catch (error) {
    console.error('声音复刻TTS失败:', error);
    
    // 提供更友好的错误信息
    if (error.message.includes('timeout')) {
      throw new Error('请求超时，请稍后重试');
    } else if (error.message.includes('network')) {
      throw new Error('网络连接失败，请检查网络设置');
    } else if (error.message.includes('403')) {
      throw new Error('访问被拒绝，请检查API配置或声音ID是否正确');
    } else if (error.message.includes('409')) {
      throw new Error('声音尚未训练完成，请等待训练完成后再试');
    } else {
      throw new Error(`语音合成失败: ${error.message}`);
    }
  }
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
    
    // 判断是否为复刻声音
    const isClonedVoice = speakerId && !speakerId.startsWith('zh_');
    console.log('试听声音参数:', payload);
    console.log('是否为复刻声音:', isClonedVoice);
    
    // 根据语音类型选择合适的TTS函数
    const data = isClonedVoice ? 
      await voiceCloneTTSSynthesize(payload) : 
      await ttsSynthesize(payload);
    
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
    
    const audioBytes = safeBase64ToBytes(audioBase64);
    let mimeType = data.encoding ? (data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg') : detectAudioMimeType(audioBytes);
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
    console.log(`[TEST] 开始测试声音连接: ${speakerId}`);
    
    // 检查是否为复刻声音
    const isClonedVoice = speakerId && !speakerId.startsWith('zh_');
    
    // 验证复刻声音ID格式
    if (isClonedVoice) {
      if (!speakerId.startsWith('S_')) {
        return { 
          success: false, 
          message: '复刻声音ID格式错误：应以"S_"开头' 
        };
      }
      if (speakerId.length < 5 || speakerId.length > 50) {
        return { 
          success: false, 
          message: '复刻声音ID长度错误：应为5-50个字符' 
        };
      }
    }
    
    const payload = {
      text: testText,
      voice_type: speakerId,
      emotion: 'neutral',
      quality: 'draft'
    };
    
    console.log(`[TEST] 测试参数:`, payload);
    console.log(`[TEST] 是否为复刻声音:`, isClonedVoice);
    
    // 根据语音类型选择合适的TTS函数
    const data = isClonedVoice ? 
      await voiceCloneTTSSynthesize(payload) : 
      await ttsSynthesize(payload);
    
    console.log(`[TEST] API响应:`, data);
    
    // 验证返回数据
    if (data.data || data.audio) {
      const message = isClonedVoice ? 
        '复刻声音连接测试成功！声音ID有效且可正常使用。' : 
        '预设声音连接测试成功！';
      return { success: true, message };
    } else {
      return { 
        success: false, 
        message: '声音连接测试失败：API未返回音频数据，请检查配置' 
      };
    }
    
  } catch (error) {
    console.error('声音连接测试失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = error.message || '未知错误';
    
    if (errorMessage.includes('Voice clone server error')) {
      errorMessage = '复刻声音服务器错误：声音ID可能无效、已过期或未完成训练';
    } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('Voice clone authentication failed')) {
      errorMessage = '认证失败：请检查API配置或声音复刻权限';
    } else if (errorMessage.includes('Invalid voice clone request')) {
      errorMessage = '复刻声音请求无效：请检查声音ID格式和参数';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = '请求超时：服务器响应时间过长，请稍后重试';
    } else if (errorMessage.includes('500')) {
      errorMessage = '服务器内部错误：复刻声音可能无效或服务暂时不可用';
    }
    
    return { 
      success: false, 
      message: `声音连接测试失败: ${errorMessage}` 
    };
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
    state.voiceType = 'zh_female_tianmeitaozi_mars_bigtts';
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

// 设置用户的专属复刻声音为默认
function setDefaultClonedVoice() {
  const personalVoiceId = 'S_DrtguyIB1';
  const personalVoiceName = '我的专属声音';

  // 确保声音在列表中
  const isAlreadyAdded = voiceClone.clonedVoices.some(v => v.speaker_id === personalVoiceId);
  if (!isAlreadyAdded) {
    console.log(`将个人声音ID ${personalVoiceId} 添加到列表中。`);
    
    const newVoice = {
      speaker_id: personalVoiceId,
      name: personalVoiceName,
      language: 'zh',
      model_type: 1,
      created_at: Date.now()
    };

    voiceClone.clonedVoices.push(newVoice);
    storage.set('ve_cloned_voices', voiceClone.clonedVoices);
    renderVoicesList();
    useClonedVoice(personalVoiceId, personalVoiceName);
  }

  // 设置为默认选项
  console.log(`设置默认语音为: ${personalVoiceId}`);
  state.voiceType = personalVoiceId;
  storage.set('ve_voice_type', personalVoiceId);
  
  // 更新UI
  if (el.voiceSelector) {
    if (Array.from(el.voiceSelector.options).some(opt => opt.value === personalVoiceId)) {
      el.voiceSelector.value = personalVoiceId;
    }
  }
  updateVoiceStatusDisplay();
}

// 异步初始化应用
(async () => {
  try {
    await init();
    // 初始化声音复刻功能
    initVoiceClone();
    // 设置用户的专属声音为默认
    setDefaultClonedVoice();
  } catch (error) {
    console.error('应用初始化失败:', error);
    showError('应用初始化失败，请刷新页面重试');
  }
})();

// 创建音频播放列表
async function createAudioPlaylist(audioSegments, voiceType) {
  if (audioSegments.length === 1) {
    // 单段音频，直接播放
    const parsed = audioSegments[0];
    if (state.lastAudioUrl) URL.revokeObjectURL(state.lastAudioUrl);
    
    state.lastAudioBlob = parsed.blob;
    state.lastAudioUrl = parsed.audioUrl;
  
    el.audioElement.src = parsed.audioUrl;
    el.audioPlayer.style.display = 'flex';
    el.audioElement.load();
    el.audioElement.play().catch(err => {
      console.warn('Audio autoplay blocked:', err);
      showError('浏览器阻止了自动播放，请手动点击播放按钮。');
    });
    return;
  }
  
  // 多段音频，创建播放列表
  state.audioPlaylist = audioSegments.map(segment => ({
    blob: segment.blob,
    url: segment.audioUrl
  }));
  state.currentSegmentIndex = 0;
  
  // 播放第一段
  playSegment(0);
  
  // 显示播放控制界面
  el.audioPlayer.style.display = 'flex';
  updatePlaylistUI();
}

// 播放指定段落
function playSegment(index) {
  if (!state.audioPlaylist || index >= state.audioPlaylist.length) return;
  
  const segment = state.audioPlaylist[index];
  state.currentSegmentIndex = index;
  
  if (state.lastAudioUrl) URL.revokeObjectURL(state.lastAudioUrl);
  
  state.lastAudioBlob = segment.blob;
  state.lastAudioUrl = segment.url;
  
  el.audioElement.src = segment.url;
  el.audioElement.load();
  el.audioElement.play().catch(err => {
    console.warn('Audio autoplay blocked:', err);
    showError('浏览器阻止了自动播放，请手动点击播放按钮。');
  });
  
  // 根据设置决定是否自动播放下一段
  el.audioElement.onended = () => {
    if (state.autoPlay && index + 1 < state.audioPlaylist.length) {
      playSegment(index + 1);
    }
  };
  
  updatePlaylistUI();
}

// 更新播放列表UI
function updatePlaylistUI() {
  if (!state.audioPlaylist || state.audioPlaylist.length <= 1) return;
  
  // 如果还没有播放列表控制器，创建一个
  let playlistControls = document.getElementById('playlistControls');
  if (!playlistControls) {
    playlistControls = document.createElement('div');
    playlistControls.id = 'playlistControls';
    playlistControls.innerHTML = `
      <div class="playlist-info">
        <span id="segmentInfo">第 1 段 / 共 1 段</span>
        <div class="playlist-buttons">
          <button id="prevSegment" class="btn btn-outline btn-sm">上一段</button>
          <button id="nextSegment" class="btn btn-outline btn-sm">下一段</button>
        </div>
      </div>
      <div class="playlist-controls">
        <label class="auto-play-toggle">
          <input type="checkbox" id="autoPlayToggle" ${state.autoPlay ? 'checked' : ''}>
          <span class="toggle-text">🔄 自动播放下一段</span>
        </label>
      </div>
    `;
    el.audioPlayer.appendChild(playlistControls);
    
    // 绑定事件
    document.getElementById('prevSegment').addEventListener('click', () => {
      if (state.currentSegmentIndex > 0) {
        playSegment(state.currentSegmentIndex - 1);
      }
    });
    
    document.getElementById('nextSegment').addEventListener('click', () => {
      if (state.currentSegmentIndex < state.audioPlaylist.length - 1) {
        playSegment(state.currentSegmentIndex + 1);
      }
    });
    
    // 绑定自动播放开关事件
    document.getElementById('autoPlayToggle').addEventListener('change', (e) => {
      state.autoPlay = e.target.checked;
      storage.set('ve_auto_play', state.autoPlay);
      console.log('自动播放设置已更新:', state.autoPlay ? '开启' : '关闭');
    });
  }
  
  // 更新显示信息
  const segmentInfo = document.getElementById('segmentInfo');
  const prevBtn = document.getElementById('prevSegment');
  const nextBtn = document.getElementById('nextSegment');
  
  if (segmentInfo) {
    segmentInfo.textContent = `第 ${state.currentSegmentIndex + 1} 段 / 共 ${state.audioPlaylist.length} 段`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = state.currentSegmentIndex === 0;
  }
  
  if (nextBtn) {
    nextBtn.disabled = state.currentSegmentIndex === state.audioPlaylist.length - 1;
  }
}

// 为历史记录项生成语音
async function generateAudioForHistoryItem(text) {
  try {
    // 清理文本中的井号字符
    const cleanedText = cleanTextForReading(text);
    const textLength = cleanedText.length;
    const voiceType = state.voiceType || 'default';
    
    if (textLength <= 800) {
      // 短文本，单次请求
      const payload = {
        text: cleanedText,
        voice_type: voiceType,
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

       const audioBytes = safeBase64ToBytes(audioBase64);
       let mimeType = detectAudioMimeType(audioBytes, data.encoding);
       const blob = new Blob([audioBytes], { type: mimeType });
       
       if (state.lastAudioUrl) {
         URL.revokeObjectURL(state.lastAudioUrl);
       }
       
       state.lastAudioBlob = blob;
       const url = URL.createObjectURL(blob);
       state.lastAudioUrl = url;
       
       el.audioElement.src = url;
       el.audioPlayer.style.display = 'flex';
       el.audioElement.load();

       state.lastContent = cleanedText;
       el.contentText.textContent = cleanedText;
       checkTextLength(cleanedText);
       el.resultSection.style.display = 'block';

       showSuccess('历史记录语音生成成功！');
     } else {
       // 长文本，使用分段处理
       console.log(`历史记录长文本处理，长度: ${textLength} 字符`);
       
       const audioSegments = await synthesizeSegmentedText(
         cleanedText,
         voiceType,
         'neutral',
         'draft'
       );
       
       await createAudioPlaylist(audioSegments, voiceType);
       
       state.lastContent = cleanedText;
       el.contentText.textContent = cleanedText;
       checkTextLength(cleanedText);
       el.resultSection.style.display = 'block';

       showSuccess(`历史记录长文本语音生成成功！共 ${audioSegments.length} 段`);
     }
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
