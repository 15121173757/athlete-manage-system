import type { Config } from 'tailwindcss';

/**
 * Tailwind 主题配置 —— 运动员管理系统（AMS）
 *
 * 设计理念：专业运动数据台（深色专业）
 * - 深蓝黑底模拟体育实验室监测中心质感
 * - 荧光橙作为强调色，用于关键操作与品牌识别
 * - 青绿/琥珀/珊瑚红三色状态系统，对应正常/警告/危险
 *
 * 扩展点：如需新增主题色，请在 colors.ams 命名空间下扩展，
 * 避免直接使用 Tailwind 默认色板，保持设计语言一致性。
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // AMS 品牌色系（深色专业运动数据台）
        ams: {
          // 背景层
          background: '#0A1929',        // 主背景：深蓝黑
          surface: '#132F4C',           // 卡片背景：深蓝灰
          'surface-hover': '#1A3A5C',   // 卡片悬停
          border: '#1E3A5F',            // 边框：深灰蓝

          // 强调色
          primary: '#FF6B35',           // 荧光橙：关键操作、品牌
          'primary-hover': '#FF8555',   // 荧光橙悬停

          // 状态色
          success: '#00E5A0',           // 青绿：正常/成功/达标
          warning: '#FFB800',           // 琥珀：警告/接近超标
          danger: '#FF4D6D',            // 珊瑚红：危险/超标/伤病

          // 文字层
          'text-primary': '#E6EDF3',    // 主文字：浅灰白
          'text-secondary': '#8B98A9',  // 次文字：中灰
          'text-muted': '#5A6A7A',      // 弱化文字
        },
      },
      fontFamily: {
        // 优先使用系统字体栈，保证中文渲染清晰
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        // 等宽字体用于数据展示
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      // 运动数据场景常用圆角
      borderRadius: {
        'ams-sm': '6px',
        'ams': '8px',
        'ams-lg': '12px',
      },
      // 图表与卡片阴影
      boxShadow: {
        'ams-card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'ams-card-hover': '0 4px 16px rgba(255, 107, 53, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
