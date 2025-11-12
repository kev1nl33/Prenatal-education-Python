/**
 * 收藏功能UI逻辑
 * 这个文件需要在 script.js 之后加载
 */

import {
  getAllFavorites,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  toggleFavorite,
  clearAllFavorites,
  getFavoritesStats,
  exportFavorites,
  importFavorites
} from './utils/favorites.js';

// 当前内容对象（用于收藏）
let currentContent = null;

/**
 * 设置当前内容（当生成新内容时调用）
 */
export function setCurrentContent(content) {
  currentContent = content;
  updateFavoriteButton();
}

/**
 * 更新收藏按钮状态
 */
function updateFavoriteButton() {
  const favoriteBtn = document.getElementById('favoriteBtn');
  const favoriteIcon = document.getElementById('favoriteIcon');
  const favoriteText = document.getElementById('favoriteText');

  if (!currentContent || !currentContent.id) {
    return;
  }

  const isFav = isFavorite(currentContent.id);

  if (isFav) {
    favoriteIcon.textContent = '⭐';
    favoriteText.textContent = '已收藏';
    favoriteBtn.style.color = '#ffd700';
    favoriteBtn.style.borderColor = '#ffd700';
  } else {
    favoriteIcon.textContent = '☆';
    favoriteText.textContent = '收藏';
    favoriteBtn.style.color = '';
    favoriteBtn.style.borderColor = '';
  }
}

/**
 * 处理收藏按钮点击
 */
function handleFavoriteClick() {
  if (!currentContent || !currentContent.id) {
    showError('没有可收藏的内容');
    return;
  }

  const result = toggleFavorite(currentContent);

  if (result.success) {
    showSuccess(result.message);
    updateFavoriteButton();
    // 刷新收藏列表（如果模态框是打开的）
    if (document.getElementById('historyModal').style.display === 'block') {
      renderFavoritesList();
    }
  } else {
    showError(result.message);
  }
}

/**
 * 标签页切换
 */
function switchTab(tabName) {
  // 更新标签按钮状态
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
      btn.style.borderBottom = '3px solid #667eea';
      btn.style.color = '#667eea';
    } else {
      btn.classList.remove('active');
      btn.style.borderBottom = '3px solid transparent';
      btn.style.color = '#666';
    }
  });

  // 切换内容区域
  const historyTab = document.getElementById('historyTab');
  const favoritesTab = document.getElementById('favoritesTab');

  if (tabName === 'history') {
    historyTab.style.display = 'block';
    favoritesTab.style.display = 'none';
  } else if (tabName === 'favorites') {
    historyTab.style.display = 'none';
    favoritesTab.style.display = 'block';
    renderFavoritesList();
    renderFavoritesStats();
  }
}

/**
 * 渲染收藏列表
 */
function renderFavoritesList() {
  const favoritesList = document.getElementById('favoritesList');
  const favorites = getAllFavorites();

  if (favorites.length === 0) {
    favoritesList.innerHTML = '<p class="empty-state">暂无收藏内容</p>';
    return;
  }

  favoritesList.innerHTML = favorites.map(item => `
    <div class="history-item favorite-item" data-id="${item.id}">
      <div class="item-header">
        <span class="item-type">${getTypeLabel(item.type)}</span>
        <span class="item-date">${formatDate(item.favoriteTime)}</span>
      </div>
      <div class="item-content">
        ${item.text ? item.text.substring(0, 100) + (item.text.length > 100 ? '...' : '') : '无内容'}
      </div>
      <div class="item-actions" style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-sm btn-outline view-favorite-btn" data-id="${item.id}">查看</button>
        <button class="btn btn-sm btn-outline remove-favorite-btn" data-id="${item.id}">取消收藏</button>
      </div>
    </div>
  `).join('');

  // 绑定事件
  document.querySelectorAll('.view-favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      viewFavoriteContent(id);
    });
  });

  document.querySelectorAll('.remove-favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      handleRemoveFavorite(id);
    });
  });
}

/**
 * 渲染收藏统计
 */
function renderFavoritesStats() {
  const statsEl = document.getElementById('favoritesStats');
  const stats = getFavoritesStats();

  if (stats.total === 0) {
    statsEl.innerHTML = '<p style="margin: 0; color: #666; text-align: center;">还没有收藏任何内容</p>';
    return;
  }

  const typeStats = Object.entries(stats.byType)
    .map(([type, count]) => `${getTypeLabel(type)}: ${count}`)
    .join(' | ');

  statsEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>收藏统计：</strong>共 ${stats.total} 条
      </div>
      <div style="font-size: 14px; color: #666;">
        ${typeStats}
      </div>
    </div>
  `;
}

/**
 * 查看收藏内容
 */
function viewFavoriteContent(id) {
  const favorites = getAllFavorites();
  const item = favorites.find(f => f.id === id);

  if (!item) {
    showError('找不到该收藏');
    return;
  }

  // 关闭模态框
  document.getElementById('historyModal').style.display = 'none';

  // 在内容展示区域显示
  setCurrentContent(item);
  const contentText = document.getElementById('contentText');
  contentText.textContent = item.text || '无内容';

  // 显示结果区域
  const resultSection = document.getElementById('resultSection');
  resultSection.style.display = 'block';

  // 滚动到结果区域
  resultSection.scrollIntoView({ behavior: 'smooth' });

  showSuccess('已加载收藏内容');
}

/**
 * 处理取消收藏
 */
function handleRemoveFavorite(id) {
  if (!confirm('确定要取消收藏吗？')) {
    return;
  }

  const result = removeFromFavorites(id);

  if (result.success) {
    showSuccess(result.message);
    renderFavoritesList();
    renderFavoritesStats();
    updateFavoriteButton();
  } else {
    showError(result.message);
  }
}

/**
 * 处理清空收藏
 */
function handleClearAllFavorites() {
  if (!confirm('确定要清空所有收藏吗？此操作不可恢复！')) {
    return;
  }

  const result = clearAllFavorites();

  if (result.success) {
    showSuccess(result.message);
    renderFavoritesList();
    renderFavoritesStats();
    updateFavoriteButton();
  } else {
    showError(result.message);
  }
}

/**
 * 处理导出收藏
 */
function handleExportFavorites() {
  const result = exportFavorites();

  if (result.success) {
    showSuccess(result.message);
  } else {
    showError(result.message);
  }
}

/**
 * 处理导入收藏
 */
function handleImportFavorites() {
  const input = document.getElementById('importFavoritesInput');
  input.click();
}

/**
 * 处理文件选择
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const result = await importFavorites(file);
    showSuccess(`${result.message}（导入: ${result.imported}, 跳过: ${result.skipped}）`);
    renderFavoritesList();
    renderFavoritesStats();
  } catch (error) {
    showError('导入失败: ' + error.message);
  }

  // 清空文件输入
  event.target.value = '';
}

// ===== 辅助函数 =====

/**
 * 获取类型标签
 */
function getTypeLabel(type) {
  const typeMap = {
    story: '📖 温馨故事',
    poetry: '🌸 诗歌朗诵',
    nature: '🌿 自然描述',
    emotion: '💝 情感表达',
    learning: '🎨 启蒙认知',
    music: '🎵 音乐引导'
  };
  return typeMap[type] || '📄 其他';
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN');
}

/**
 * 显示成功提示（假设已在主脚本中定义）
 */
function showSuccess(message) {
  if (window.showSuccess) {
    window.showSuccess(message);
  } else {
    alert(message);
  }
}

/**
 * 显示错误提示（假设已在主脚本中定义）
 */
function showError(message) {
  if (window.showError) {
    window.showError(message);
  } else {
    alert(message);
  }
}

// ===== 初始化 =====

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFavoritesUI);
} else {
  initFavoritesUI();
}

function initFavoritesUI() {
  // 收藏按钮
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', handleFavoriteClick);
  }

  // 标签页切换
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // 收藏控制按钮
  const clearAllFavoritesBtn = document.getElementById('clearAllFavorites');
  if (clearAllFavoritesBtn) {
    clearAllFavoritesBtn.addEventListener('click', handleClearAllFavorites);
  }

  const exportFavoritesBtn = document.getElementById('exportFavorites');
  if (exportFavoritesBtn) {
    exportFavoritesBtn.addEventListener('click', handleExportFavorites);
  }

  const importFavoritesBtn = document.getElementById('importFavorites');
  if (importFavoritesBtn) {
    importFavoritesBtn.addEventListener('click', handleImportFavorites);
  }

  const importFavoritesInput = document.getElementById('importFavoritesInput');
  if (importFavoritesInput) {
    importFavoritesInput.addEventListener('change', handleFileSelect);
  }

  console.log('✅ 收藏功能UI已初始化');
}

// 导出供其他模块使用
window.FavoritesUI = {
  setCurrentContent,
  updateFavoriteButton
};
