/**
 * 认证工具模块 - 使用后端API进行安全认证
 */

const API_BASE = '';

// 认证配置
const AUTH_CONFIG = {
  storageKey: 'prenatal_auth_verified',
  tokenKey: 'prenatal_auth_token'
};

/**
 * 检查用户是否已通过密码验证
 */
export function isAuthenticated() {
  const verified = localStorage.getItem(AUTH_CONFIG.storageKey);
  const token = localStorage.getItem(AUTH_CONFIG.tokenKey);
  return verified === 'true' && !!token;
}

/**
 * 验证密码（通过后端API）
 */
async function verifyPasswordWithAPI(password) {
  try {
    const response = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'login',
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '密码验证失败');
    }

    if (data.ok && data.token) {
      return data.token;
    } else {
      throw new Error(data.message || '密码错误');
    }
  } catch (error) {
    console.error('密码验证错误:', error);
    throw error;
  }
}

/**
 * 验证token是否有效（通过后端API）
 */
async function verifyTokenWithAPI(token) {
  try {
    const response = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'verify',
        token: token
      })
    });

    const data = await response.json();
    return data.ok && data.valid;
  } catch (error) {
    console.error('Token验证错误:', error);
    return false;
  }
}

/**
 * 显示密码输入对话框
 */
export function showPasswordDialog() {
  return new Promise((resolve, reject) => {
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

    // 创建密码输入框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      text-align: center;
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">🔐 访问验证</h2>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">请输入访问密码以使用胎教语音生成服务</p>
      <input type="password" id="passwordInput" placeholder="请输入密码" style="
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        margin-bottom: 20px;
        box-sizing: border-box;
      ">
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmBtn" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          min-width: 80px;
        ">确认</button>
        <button id="cancelBtn" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          min-width: 80px;
        ">取消</button>
      </div>
      <div id="errorMsg" style="
        color: #f44336;
        margin-top: 15px;
        font-size: 14px;
        display: none;
      "></div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const passwordInput = dialog.querySelector('#passwordInput');
    const confirmBtn = dialog.querySelector('#confirmBtn');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorMsg = dialog.querySelector('#errorMsg');

    // 聚焦到密码输入框
    setTimeout(() => passwordInput.focus(), 100);

    // 验证密码
    async function verifyPassword() {
      const password = passwordInput.value.trim();

      if (!password) {
        errorMsg.textContent = '密码不能为空';
        errorMsg.style.display = 'block';
        return;
      }

      // 禁用按钮，显示加载状态
      confirmBtn.disabled = true;
      confirmBtn.textContent = '验证中...';
      errorMsg.style.display = 'none';

      try {
        // 调用后端API验证密码
        const token = await verifyPasswordWithAPI(password);

        // 密码正确，保存验证状态和token
        localStorage.setItem(AUTH_CONFIG.storageKey, 'true');
        localStorage.setItem(AUTH_CONFIG.tokenKey, token);

        document.body.removeChild(overlay);

        // 显示退出登录按钮
        setTimeout(() => toggleLogoutButton(), 100);

        resolve(token);
      } catch (error) {
        // 密码错误或验证失败
        errorMsg.textContent = error.message || '密码错误，请重试';
        errorMsg.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();

        // 恢复按钮状态
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认';
      }
    }

    // 事件监听
    confirmBtn.addEventListener('click', verifyPassword);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyPassword();
      }
    });

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      reject(new Error('用户取消了密码验证'));
    });
  });
}

/**
 * 退出登录
 */
export async function logout() {
  if (confirm('确定要退出登录吗？退出后需要重新输入密码才能使用。')) {
    const token = localStorage.getItem(AUTH_CONFIG.tokenKey);

    // 通知后端退出登录（可选）
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'logout',
            token: token
          })
        });
      } catch (error) {
        console.error('退出登录失败:', error);
      }
    }

    localStorage.removeItem(AUTH_CONFIG.storageKey);
    localStorage.removeItem(AUTH_CONFIG.tokenKey);
    location.reload(); // 刷新页面重新验证
  }
}

/**
 * 显示/隐藏退出登录按钮
 */
export function toggleLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (isAuthenticated()) {
      logoutBtn.style.display = 'flex';
    } else {
      logoutBtn.style.display = 'none';
    }
  }
}

/**
 * 获取认证Token
 */
export function getAuthToken() {
  if (!isAuthenticated()) {
    throw new Error('未通过密码验证，请先登录');
  }
  return localStorage.getItem(AUTH_CONFIG.tokenKey);
}

/**
 * 异步获取认证Token（用于需要密码验证的场景）
 */
export async function getAuthTokenAsync() {
  // 先检查本地是否有token
  if (isAuthenticated()) {
    const token = getAuthToken();

    // 验证token是否仍然有效
    const isValid = await verifyTokenWithAPI(token);
    if (isValid) {
      return token;
    } else {
      // token已过期，清除本地存储
      localStorage.removeItem(AUTH_CONFIG.storageKey);
      localStorage.removeItem(AUTH_CONFIG.tokenKey);
    }
  }

  // 显示密码对话框
  try {
    return await showPasswordDialog();
  } catch (error) {
    throw new Error('密码验证失败：' + error.message);
  }
}
