import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Language = 'en' | 'zh'

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  t: (text: string) => string
}

const STORAGE_KEY = 'freellmapi_language'

const zh: Record<string, string> = {
  'Playground': '调试台',
  'Keys': '密钥',
  'Fallback': '回退',
  'Fallback chain': '回退链',
  'Analytics': '数据分析',
  'Sign out': '退出登录',
  'Toggle theme': '切换主题',
  'Switch to Chinese': '切换为中文',
  'Switch to English': '切换为英文',
  'Create your account': '创建账号',
  'Sign in': '登录',
  'Set the account and password that will protect this dashboard.': '设置用于保护管理面板的账号和密码。',
  'Sign in to manage your keys, routing, and analytics.': '登录后管理密钥、路由和数据分析。',
  'Account': '账号',
  'Password': '密码',
  'at least 8 characters': '至少 8 个字符',
  'your password': '输入密码',
  'Creating…': '创建中…',
  'Signing in…': '登录中…',
  'Create account': '创建账号',
  'Loading…': '加载中…',
  "Can't reach the server. Make sure the backend is running": '无法连接服务端。请确认后端正在运行',
  'Send a chat completion through the router and see which provider serves it.': '通过路由发送一次聊天补全请求，并查看实际由哪个 Provider 响应。',
  'Auto (fallback chain)': '自动（回退链）',
  'Clear': '清空',
  'Send a message to get started.': '发送一条消息开始测试。',
  'Using': '当前使用',
  'Switch models in the selector above.': '可在上方选择器切换模型。',
  'Type a message… (⏎ to send, ⇧⏎ for newline)': '输入消息…（Enter 发送，Shift+Enter 换行）',
  'Sending…': '发送中…',
  'Send': '发送',
  'Error': '错误',
  'Unknown error': '未知错误',
  'Streaming response body is not available': '无法读取流式响应内容',
  'No response content': '没有返回内容',
  'fallback': '次回退',
  'fallbacks': '次回退',
  'Provider credentials and the unified API key your apps connect with.': '管理 Provider 凭据，以及应用连接时使用的统一 API 密钥。',
  'Your unified API key': '统一 API 密钥',
  'Use this as your OpenAI': '将它作为 OpenAI',
  'it authenticates requests to this proxy.': '使用；它用于认证发往此代理的请求。',
  'Regenerate': '重新生成',
  "Can't reach the server on": '无法连接该服务：',
  'Make sure the backend is running': '请确认后端正在运行',
  'starts both, and the server logs print under the': '会同时启动前后端，服务端日志会输出在',
  'prefix.': '前缀下。',
  'Hide': '隐藏',
  'Show': '显示',
  'Copied': '已复制',
  'Copy': '复制',
  'Base URL': '基础 URL',
  'Endpoint': '接口路径',
  'Add a custom OpenAI-compatible model': '添加自定义 OpenAI 兼容模型',
  "Point at any OpenAI-compatible endpoint — llama.cpp, LM Studio, vLLM, a local Ollama, or a remote gateway. Add each model you want routed; they all share the one endpoint. The API key is optional (most local servers don't need one).": '指向任意 OpenAI 兼容端点，例如 llama.cpp、LM Studio、vLLM、本地 Ollama 或远程网关。把需要参与路由的模型逐个添加进来；它们会共用同一个端点。API 密钥可选，大多数本地服务不需要填写。',
  'Model': '模型',
  'Display name': '显示名称',
  'optional': '可选',
  'Adding…': '添加中…',
  'Add model': '添加模型',
  'Check all': '全部检查',
  'Checking…': '检查中…',
  'Add a provider key': '添加 Provider 密钥',
  'Platform': '平台',
  'Select provider': '选择平台',
  'Account ID': '账号 ID',
  'API token': 'API 令牌',
  'API key': 'API 密钥',
  'Bearer token': 'Bearer token',
  'paste key here': '在此粘贴密钥',
  'Label': '标签',
  'Add key': '添加密钥',
  'Configured providers': '已配置 Provider',
  'No provider keys yet. Add one above to start routing.': '还没有 Provider 密钥。请先在上方添加一个密钥以开始路由。',
  'key': '个密钥',
  'keys': '个密钥',
  'healthy': '健康',
  'rate-limited': '已限流',
  'invalid': '无效',
  'error': '错误',
  'unchecked': '未检查',
  'Check': '检查',
  'Remove': '移除',
  'Custom (OpenAI-compatible)': '自定义（OpenAI 兼容）',
  'Kilo Gateway (anon ok)': 'Kilo Gateway（可匿名）',
  'Pollinations (anon ok)': 'Pollinations（可匿名）',
  'Drag to reorder. Requests try models top-to-bottom until one succeeds.': '拖拽调整顺序。请求会从上到下依次尝试模型，直到有一个成功。',
  'Sort by intelligence': '按能力排序',
  'Sort by speed': '按速度排序',
  'Sort by budget': '按预算排序',
  'Monthly token budget': '月度 token 预算',
  'remaining': '剩余',
  'of': '占',
  'Used': '已使用',
  'Drag to reorder': '拖拽调整顺序',
  'Accepts image input': '支持图片输入',
  'Vision': '视觉',
  'penalty': '惩罚分',
  'Intel': '能力',
  'Speed': '速度',
  'tok/mo': 'token/月',
  'No models available. Add API keys on the': '当前没有可用模型。请先到',
  'Keys page': '密钥页面',
  'first.': '添加 API 密钥。',
  'Discard': '放弃',
  'Saving…': '保存中…',
  'Save order': '保存顺序',
  'Hidden (no keys):': '已隐藏（无密钥）：',
  'Request volume, latency, token usage, and failures.': '查看请求量、延迟、token 用量和失败情况。',
  'Requests': '请求数',
  'Success rate': '成功率',
  'Input tokens': '输入 token',
  'Output tokens': '输出 token',
  'Avg latency': '平均延迟',
  'Est. savings': '估算节省',
  'Requests by provider': '按 Provider 统计请求',
  'No data yet': '暂无数据',
  'Avg latency by provider': '按 Provider 统计平均延迟',
  'Latency (ms)': '延迟（ms）',
  'Requests over time': '请求趋势',
  'Success': '成功',
  'Failures': '失败',
  'Per-model breakdown': '按模型明细',
  'Provider': 'Provider',
  'Latency': '延迟',
  'In tokens': '输入 token',
  'Out tokens': '输出 token',
  'Errors by provider': '按 Provider 统计错误',
  'No errors': '暂无错误',
  'Recent errors': '最近错误',
  'Message': '错误信息',
  'Time': '时间',
  'Invalid account or password': '账号或密码不正确',
  'Too many failed attempts. Try again later.': '失败次数过多，请稍后再试。',
  'Authentication required': '需要先登录',
}

const I18nContext = createContext<I18nContextValue | null>(null)

function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'zh' ? 'zh' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  const setLanguage = (next: Language) => {
    setLanguageState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'zh' ? 'en' : 'zh'),
    t: (text: string) => (language === 'zh' ? zh[text] ?? text : text),
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside LanguageProvider')
  return context
}
