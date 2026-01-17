/**
 * 主题配置系统
 * 管理亮色/深色主题切换
 */

export const themes = {
  light: {
    name: '亮色模式',
    key: 'light',
    icon: '☀️'
  },
  dark: {
    name: '深色模式',
    key: 'dark',
    icon: '🌙'
  }
};

/**
 * 获取当前主题
 * @returns {string} 'light' | 'dark'
 */
export function getCurrentTheme() {
  // 优先从localStorage读取
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
    return savedTheme;
  }

  // 如果没有保存，检查系统偏好（可选）
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  // 默认亮色
  return 'light';
}

/**
 * 设置 Element Plus CSS 变量
 * @param {string} theme - 'light' | 'dark'
 */
function setElementPlusCSSVars(theme) {
  const root = document.documentElement;

  if (theme === 'dark') {
    // 深色主题 Element Plus 变量
    root.style.setProperty('--el-bg-color', '#1a1a2e');
    root.style.setProperty('--el-bg-color-page', '#0a0e27');
    root.style.setProperty('--el-bg-color-overlay', '#1a1a2e');
    root.style.setProperty('--el-text-color-primary', '#ffffff');
    root.style.setProperty('--el-text-color-regular', '#e0e0e0');
    root.style.setProperty('--el-text-color-secondary', '#b0b0b0');
    root.style.setProperty('--el-text-color-placeholder', '#808080');
    root.style.setProperty('--el-border-color', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--el-border-color-light', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--el-border-color-lighter', 'rgba(255, 255, 255, 0.06)');
    root.style.setProperty('--el-fill-color', 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--el-fill-color-light', 'rgba(255, 255, 255, 0.03)');
    root.style.setProperty('--el-fill-color-lighter', 'rgba(255, 255, 255, 0.02)');
  } else {
    // 亮色主题 Element Plus 变量
    root.style.setProperty('--el-bg-color', '#d5d7e0');
    root.style.setProperty('--el-bg-color-page', '#c8cad3');
    root.style.setProperty('--el-bg-color-overlay', '#d5d7e0');
    root.style.setProperty('--el-text-color-primary', '#3d4451');
    root.style.setProperty('--el-text-color-regular', '#5a6270');
    root.style.setProperty('--el-text-color-secondary', '#707886');
    root.style.setProperty('--el-text-color-placeholder', '#8b92a0');
    root.style.setProperty('--el-border-color', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--el-border-color-light', 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--el-border-color-lighter', 'rgba(0, 0, 0, 0.06)');
    root.style.setProperty('--el-fill-color', '#cecfd9');
    root.style.setProperty('--el-fill-color-light', '#d5d7e0');
    root.style.setProperty('--el-fill-color-lighter', '#dfe1ea');
  }

  console.log('🎨 Element Plus CSS 变量已更新:', theme);
}

/**
 * 设置主题
 * @param {string} theme - 'light' | 'dark'
 */
export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') {
    console.warn('Invalid theme:', theme);
    return;
  }

  // 保存到localStorage
  localStorage.setItem('theme', theme);

  // 设置HTML的data-theme属性
  document.documentElement.setAttribute('data-theme', theme);

  // 🔥 设置 Element Plus CSS 变量
  setElementPlusCSSVars(theme);

  // 触发自定义事件，通知其他组件
  window.dispatchEvent(new CustomEvent('theme-changed', {
    detail: { theme }
  }));

  console.log('✅ 主题已切换:', theme);
}

/**
 * 初始化主题系统
 * 在应用启动时调用
 */
export function initTheme() {
  const theme = getCurrentTheme();
  setTheme(theme);
  console.log('🎨 主题系统初始化完成:', theme);
}

/**
 * 切换主题（亮色 <-> 深色）
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  const newTheme = current === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  return newTheme;
}

/**
 * 监听系统主题变化（可选功能）
 * @param {Function} callback - 回调函数
 */
export function watchSystemTheme(callback) {
  if (!window.matchMedia) return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e) => {
    const systemTheme = e.matches ? 'dark' : 'light';
    callback(systemTheme);
  };

  // 现代浏览器
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
  // 旧浏览器
  else {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }
}

/**
 * 获取主题信息
 * @param {string} themeKey - 'light' | 'dark'
 */
export function getThemeInfo(themeKey) {
  return themes[themeKey] || themes.light;
}
