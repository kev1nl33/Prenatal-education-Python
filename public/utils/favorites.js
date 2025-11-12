/**
 * 收藏管理模块
 * 提供内容收藏的CRUD操作
 */

const FAVORITES_KEY = 'prenatal_favorites';
const HISTORY_KEY = 'prenatal_history';

/**
 * 获取所有收藏
 */
export function getAllFavorites() {
  try {
    const favorites = localStorage.getItem(FAVORITES_KEY);
    return favorites ? JSON.parse(favorites) : [];
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    return [];
  }
}

/**
 * 添加收藏
 */
export function addToFavorites(item) {
  try {
    const favorites = getAllFavorites();

    // 检查是否已收藏
    if (favorites.some(fav => fav.id === item.id)) {
      return { success: false, message: '已经收藏过了' };
    }

    // 添加收藏
    const favoriteItem = {
      ...item,
      favoriteTime: Date.now()
    };

    favorites.unshift(favoriteItem); // 添加到开头
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

    // 更新历史记录中的收藏状态
    updateHistoryFavoriteStatus(item.id, true);

    return { success: true, message: '收藏成功' };
  } catch (error) {
    console.error('添加收藏失败:', error);
    return { success: false, message: '收藏失败: ' + error.message };
  }
}

/**
 * 移除收藏
 */
export function removeFromFavorites(itemId) {
  try {
    const favorites = getAllFavorites();
    const filtered = favorites.filter(fav => fav.id !== itemId);

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));

    // 更新历史记录中的收藏状态
    updateHistoryFavoriteStatus(itemId, false);

    return { success: true, message: '已取消收藏' };
  } catch (error) {
    console.error('移除收藏失败:', error);
    return { success: false, message: '操作失败: ' + error.message };
  }
}

/**
 * 检查是否已收藏
 */
export function isFavorite(itemId) {
  const favorites = getAllFavorites();
  return favorites.some(fav => fav.id === itemId);
}

/**
 * 切换收藏状态
 */
export function toggleFavorite(item) {
  if (isFavorite(item.id)) {
    return removeFromFavorites(item.id);
  } else {
    return addToFavorites(item);
  }
}

/**
 * 清空所有收藏
 */
export function clearAllFavorites() {
  try {
    localStorage.removeItem(FAVORITES_KEY);

    // 清空历史记录中的所有收藏状态
    const history = getHistory();
    history.forEach(item => {
      item.isFavorite = false;
    });
    saveHistory(history);

    return { success: true, message: '已清空所有收藏' };
  } catch (error) {
    console.error('清空收藏失败:', error);
    return { success: false, message: '操作失败: ' + error.message };
  }
}

/**
 * 按类型筛选收藏
 */
export function getFavoritesByType(contentType) {
  const favorites = getAllFavorites();
  if (!contentType || contentType === 'all') {
    return favorites;
  }
  return favorites.filter(fav => fav.type === contentType);
}

/**
 * 搜索收藏
 */
export function searchFavorites(query) {
  const favorites = getAllFavorites();
  if (!query || query.trim() === '') {
    return favorites;
  }

  const lowerQuery = query.toLowerCase();
  return favorites.filter(fav => {
    return fav.text && fav.text.toLowerCase().includes(lowerQuery);
  });
}

/**
 * 获取收藏统计
 */
export function getFavoritesStats() {
  const favorites = getAllFavorites();

  const stats = {
    total: favorites.length,
    byType: {}
  };

  // 按类型统计
  favorites.forEach(fav => {
    const type = fav.type || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  return stats;
}

// ===== 辅助函数 =====

/**
 * 获取历史记录
 */
function getHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('获取历史记录失败:', error);
    return [];
  }
}

/**
 * 保存历史记录
 */
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
}

/**
 * 更新历史记录中的收藏状态
 */
function updateHistoryFavoriteStatus(itemId, isFavorite) {
  try {
    const history = getHistory();
    const item = history.find(h => h.id === itemId);

    if (item) {
      item.isFavorite = isFavorite;
      saveHistory(history);
    }
  } catch (error) {
    console.error('更新历史记录收藏状态失败:', error);
  }
}

/**
 * 导出收藏数据
 */
export function exportFavorites() {
  try {
    const favorites = getAllFavorites();
    const dataStr = JSON.stringify(favorites, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prenatal-favorites-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    return { success: true, message: '导出成功' };
  } catch (error) {
    console.error('导出收藏失败:', error);
    return { success: false, message: '导出失败: ' + error.message };
  }
}

/**
 * 导入收藏数据
 */
export function importFavorites(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        if (!Array.isArray(importedData)) {
          reject(new Error('导入的数据格式不正确'));
          return;
        }

        // 合并到现有收藏（去重）
        const existing = getAllFavorites();
        const existingIds = new Set(existing.map(f => f.id));

        const newFavorites = importedData.filter(item => !existingIds.has(item.id));
        const merged = [...existing, ...newFavorites];

        localStorage.setItem(FAVORITES_KEY, JSON.stringify(merged));

        resolve({
          success: true,
          message: `成功导入 ${newFavorites.length} 条收藏`,
          imported: newFavorites.length,
          skipped: importedData.length - newFavorites.length
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsText(file);
  });
}
