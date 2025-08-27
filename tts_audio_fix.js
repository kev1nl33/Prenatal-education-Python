// TTS音频播放修复方案
// 解决Base64解码和音频播放问题的完整JavaScript代码

/**
 * 方案1：完整的TTS音频处理函数（推荐）
 * 从/api/tts接口获取JSON，正确解码Base64并播放音频
 */
async function playTTSAudio(text, voiceType = 'zh_female_roumeinvyou_emo_v2_mars_bigtts') {
  try {
    // 1. 调用TTS API
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如果需要认证，添加相应的header
        // 'X-Auth-Token': 'your-api-key'
      },
      body: JSON.stringify({
        text: text,
        voice_type: voiceType,
        emotion: 'neutral',
        quality: 'draft'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 2. 解析JSON响应
    const data = await response.json();
    console.log('TTS API响应:', data);

    if (data.error) {
      throw new Error(data.error);
    }

    // 3. 提取Base64音频数据
    let audioBase64;
    if (data.data && typeof data.data === 'string') {
      audioBase64 = data.data;
    } else if (data.audio && typeof data.audio === 'string') {
      audioBase64 = data.audio;
    } else {
      throw new Error('未找到音频数据');
    }

    // 4. Base64解码为二进制数据
    const audioBytes = base64ToUint8Array(audioBase64);
    console.log('音频数据长度:', audioBytes.length);

    // 5. 创建Blob对象
    const mimeType = data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const blob = new Blob([audioBytes], { type: mimeType });

    // 6. 创建可播放的URL
    const audioUrl = URL.createObjectURL(blob);

    // 7. 播放音频
    const audioElement = document.getElementById('previewAudioElement');
    if (audioElement) {
      // 清理旧的URL
      if (audioElement.src && audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src);
      }
      
      audioElement.src = audioUrl;
      audioElement.load();
      
      // 添加事件监听
      audioElement.onloadeddata = () => {
        console.log('音频加载成功，时长:', audioElement.duration);
        audioElement.play();
      };
      
      audioElement.onerror = (e) => {
        console.error('音频播放失败:', e);
        URL.revokeObjectURL(audioUrl);
      };
    }

    return {
      success: true,
      audioUrl: audioUrl,
      blob: blob,
      mimeType: mimeType
    };

  } catch (error) {
    console.error('TTS音频播放失败:', error);
    throw error;
  }
}

/**
 * 方案2：使用Data URL直接播放（简单方案）
 */
async function playTTSAudioWithDataURL(text, voiceType = 'zh_female_roumeinvyou_emo_v2_mars_bigtts') {
  try {
    // 1. 调用TTS API
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice_type: voiceType,
        emotion: 'neutral',
        quality: 'draft'
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // 2. 提取Base64数据
    const audioBase64 = data.data || data.audio;
    if (!audioBase64) {
      throw new Error('未找到音频数据');
    }

    // 3. 构建Data URL
    const mimeType = data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const dataURL = `data:${mimeType};base64,${audioBase64}`;

    // 4. 直接设置给audio元素
    const audioElement = document.getElementById('previewAudioElement');
    if (audioElement) {
      audioElement.src = dataURL;
      audioElement.load();
      audioElement.play();
    }

    return {
      success: true,
      dataURL: dataURL
    };

  } catch (error) {
    console.error('TTS音频播放失败:', error);
    throw error;
  }
}

/**
 * 辅助函数：Base64转Uint8Array
 */
function base64ToUint8Array(base64) {
  try {
    // 规范化Base64字符串
    const normalized = normalizeBase64(base64);
    
    // 使用atob解码
    const binaryString = atob(normalized);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    console.error('Base64解码失败:', error);
    throw new Error('音频数据解码失败');
  }
}

/**
 * 辅助函数：规范化Base64字符串
 */
function normalizeBase64(base64) {
  if (!base64) return '';
  
  // 移除可能的前缀
  let normalized = base64.replace(/^data:[^;]+;base64,/, '');
  
  // 移除空白字符
  normalized = normalized.replace(/\s/g, '');
  
  // 处理URL-safe Base64
  normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
  
  // 添加必要的padding
  while (normalized.length % 4) {
    normalized += '=';
  }
  
  return normalized;
}

/**
 * 使用示例1：完整方案
 */
function exampleUsage1() {
  const testText = "亲爱的宝贝，妈妈在这里陪着你。";
  
  playTTSAudio(testText)
    .then(result => {
      console.log('音频播放成功:', result);
    })
    .catch(error => {
      console.error('播放失败:', error.message);
      alert('音频播放失败: ' + error.message);
    });
}

/**
 * 使用示例2：Data URL方案
 */
function exampleUsage2() {
  const testText = "亲爱的宝贝，妈妈在这里陪着你。";
  
  playTTSAudioWithDataURL(testText)
    .then(result => {
      console.log('音频播放成功:', result);
    })
    .catch(error => {
      console.error('播放失败:', error.message);
      alert('音频播放失败: ' + error.message);
    });
}

/**
 * 修复现有previewContent函数的关键部分
 */
function fixedAudioHandling(data) {
  try {
    // 提取Base64音频数据
    let audioBase64;
    if (data.data && typeof data.data === 'string') {
      audioBase64 = data.data;
    } else if (data.audio && typeof data.audio === 'string') {
      audioBase64 = data.audio;
    } else {
      throw new Error('未找到音频数据');
    }

    // 正确解码Base64
    const audioBytes = base64ToUint8Array(audioBase64);
    
    // 创建正确的Blob
    const mimeType = data.encoding === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const blob = new Blob([audioBytes], { type: mimeType });
    
    // 创建URL并播放
    const url = URL.createObjectURL(blob);
    const audioElement = document.getElementById('previewAudioElement');
    
    if (audioElement) {
      // 清理旧URL
      if (audioElement.src && audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src);
      }
      
      audioElement.src = url;
      audioElement.load();
      
      // 添加事件监听
      audioElement.onloadeddata = () => {
        console.log('音频加载成功');
        audioElement.play();
      };
      
      audioElement.onerror = (e) => {
        console.error('音频播放失败:', e);
        URL.revokeObjectURL(url);
      };
    }
    
    return { success: true, url, blob };
    
  } catch (error) {
    console.error('音频处理失败:', error);
    throw error;
  }
}

// 导出函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    playTTSAudio,
    playTTSAudioWithDataURL,
    base64ToUint8Array,
    normalizeBase64,
    fixedAudioHandling
  };
}