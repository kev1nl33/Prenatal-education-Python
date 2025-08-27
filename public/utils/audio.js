/**
 * 音频处理工具函数
 * 用于处理TTS音频数据的Base64解码、MIME类型检测和URL创建
 */

/**
 * 安全地将Base64字符串解码为Uint8Array
 * @param {string} base64 - Base64编码的字符串
 * @returns {Uint8Array} 解码后的字节数组
 * @throws {Error} 当Base64字符串无效时抛出错误
 */
function safeBase64ToBytes(base64) {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Base64字符串不能为空且必须是字符串类型');
  }

  try {
    // 清理Base64字符串，移除可能的空白字符和换行符
    const cleanBase64 = base64.replace(/\s/g, '');
    
    // 验证Base64格式
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      throw new Error('Base64字符串格式无效');
    }

    // 使用atob解码为二进制字符串
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    // 转换为Uint8Array
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.info('Base64解码成功:', {
      originalLength: base64.length,
      cleanedLength: cleanBase64.length,
      bytesLength: bytes.length
    });
    
    return bytes;
  } catch (error) {
    console.error('Base64解码失败:', {
      error: error.message,
      base64Length: base64.length,
      base64Preview: base64.substring(0, 50) + '...'
    });
    throw new Error(`Base64解码失败: ${error.message}`);
  }
}

/**
 * 根据响应头检测音频MIME类型
 * @param {string|null} contentTypeHeader - HTTP响应的Content-Type头
 * @param {string} fallback - 默认的MIME类型
 * @returns {string} 检测到的MIME类型
 */
function detectAudioMimeType(contentTypeHeader, fallback = "audio/wav") {
  if (!contentTypeHeader) {
    console.info('未提供Content-Type头，使用默认类型:', fallback);
    return fallback;
  }

  const contentType = contentTypeHeader.toLowerCase();
  
  // 检查是否包含audio/*类型
  if (contentType.includes('audio/')) {
    // 提取具体的音频类型
    const audioTypeMatch = contentType.match(/audio\/([^;\s]+)/);
    if (audioTypeMatch) {
      const detectedType = `audio/${audioTypeMatch[1]}`;
      console.info('从Content-Type检测到音频类型:', detectedType);
      return detectedType;
    }
  }
  
  // 检查常见的音频相关Content-Type
  const audioMappings = {
    'application/octet-stream': 'audio/wav',
    'binary/octet-stream': 'audio/wav',
    'application/wav': 'audio/wav',
    'application/x-wav': 'audio/wav',
    'application/mpeg': 'audio/mpeg',
    'application/mp3': 'audio/mpeg'
  };
  
  for (const [key, value] of Object.entries(audioMappings)) {
    if (contentType.includes(key)) {
      console.info('通过映射检测到音频类型:', value, '来源:', key);
      return value;
    }
  }
  
  console.info('无法从Content-Type检测音频类型，使用默认:', fallback, '原始头:', contentTypeHeader);
  return fallback;
}

/**
 * 从字节数组创建音频URL
 * @param {Uint8Array} bytes - 音频字节数组
 * @param {string} mime - MIME类型
 * @returns {string} 可用于audio元素的URL
 * @throws {Error} 当参数无效时抛出错误
 */
function buildAudioUrlFromBytes(bytes, mime) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    throw new Error('bytes参数必须是Uint8Array类型');
  }
  
  if (!mime || typeof mime !== 'string') {
    throw new Error('mime参数必须是非空字符串');
  }
  
  if (bytes.length === 0) {
    throw new Error('音频字节数组不能为空');
  }
  
  try {
    // 创建Blob对象
    const blob = new Blob([bytes], { type: mime });
    
    // 创建对象URL
    const url = URL.createObjectURL(blob);
    
    console.info('音频URL创建成功:', {
      bytesLength: bytes.length,
      mimeType: mime,
      blobSize: blob.size,
      url: url.substring(0, 50) + '...'
    });
    
    return url;
  } catch (error) {
    console.error('创建音频URL失败:', {
      error: error.message,
      bytesLength: bytes.length,
      mimeType: mime
    });
    throw new Error(`创建音频URL失败: ${error.message}`);
  }
}

/**
 * 安全地撤销对象URL，避免内存泄漏
 * @param {string} url - 要撤销的URL
 */
function revokeAudioUrl(url) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
      console.info('音频URL已撤销:', url.substring(0, 50) + '...');
    } catch (error) {
      console.warn('撤销音频URL失败:', error.message);
    }
  }
}

/**
 * 检测音频数据的实际格式（通过魔数）
 * @param {Uint8Array} bytes - 音频字节数组
 * @returns {string} 检测到的音频格式
 */
function detectAudioFormat(bytes) {
  if (!bytes || bytes.length < 4) {
    return 'unknown';
  }
  
  // WAV格式检测 (RIFF...WAVE)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes.length >= 12 && 
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return 'wav';
    }
  }
  
  // MP3格式检测 (ID3 tag或MP3 frame header)
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3v2
      (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) { // MP3 frame header
    return 'mp3';
  }
  
  // OGG格式检测
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'ogg';
  }
  
  return 'unknown';
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    safeBase64ToBytes,
    detectAudioMimeType,
    buildAudioUrlFromBytes,
    revokeAudioUrl,
    detectAudioFormat
  };
}