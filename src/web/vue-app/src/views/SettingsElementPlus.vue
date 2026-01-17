<template>
  <div class="settings-page">
    <!-- 页面标题 -->
    <div class="page-header glass-card">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <el-icon class="title-icon" :size="32"><Setting /></el-icon>
            <span class="title-gradient">系统设置</span>
          </h1>
          <p class="page-subtitle">配置系统参数和通知服务</p>
        </div>
      </div>
    </div>

    <!-- 设置内容区 - 左侧菜单 + 右侧内容 -->
    <div class="settings-container">
      <!-- 左侧分类菜单 -->
      <aside class="settings-sidebar glass-card">
        <div class="sidebar-title">配置分类</div>
        <nav class="category-menu">
          <a
            v-for="category in categories"
            :key="category.key"
            :class="['category-item', { active: activeCategory === category.key }]"
            @click="activeCategory = category.key"
          >
            <span class="category-icon">{{ category.icon }}</span>
            <div class="category-info">
              <div class="category-name">{{ category.name }}</div>
              <div class="category-desc">{{ category.desc }}</div>
            </div>
            <el-badge
              v-if="getCategoryConfigCount(category.key) > 0"
              :value="getCategoryConfigCount(category.key)"
              class="category-badge"
            />
          </a>
        </nav>
      </aside>

      <!-- 右侧配置内容 -->
      <main class="settings-content">
        <!-- 通知配置 -->
        <div v-if="activeCategory === 'notification'" class="category-section">
          <div class="section-header">
            <h2>通知配置</h2>
            <p>配置系统告警通知渠道</p>
          </div>

          <!-- SMTP邮件配置 -->
          <HolographicCard class="config-card" :border="true" :hover="true">
            <template #header>
              <div class="card-header">
                <h3>
                  <el-icon><Message /></el-icon>
                  SMTP邮件配置
                </h3>
                <GlowingTag :type="smtpConfigured ? 'success' : 'info'" :text="smtpConfigured ? '已配置' : '未配置'" />
              </div>
            </template>

            <el-form :model="smtpForm" label-width="140px" class="config-form">
              <el-alert
                title="💡 配置说明"
                type="info"
                :closable="false"
                class="config-tip"
              >
                SMTP配置用于发送告警邮件。配置后，告警系统可以向指定邮箱发送通知。
              </el-alert>

              <el-form-item label="SMTP服务器">
                <el-input v-model="smtpForm.host" placeholder="例如: smtp.qq.com" clearable>
                  <template #prepend>
                    <el-icon><Connection /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">常用: smtp.qq.com / smtp.163.com / smtp.gmail.com</div>
              </el-form-item>

              <el-form-item label="SMTP端口">
                <el-input-number v-model="smtpForm.port" :min="1" :max="65535" style="width: 200px" />
                <div class="form-tip">常用: 587 (STARTTLS) / 465 (SSL) / 25 (163邮箱)</div>
              </el-form-item>

              <el-form-item label="发件人邮箱">
                <el-input v-model="smtpForm.user" placeholder="例如: alert@company.com" clearable>
                  <template #prepend>
                    <el-icon><User /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">用于发送告警邮件的邮箱账号</div>
              </el-form-item>

              <el-form-item label="SMTP授权码">
                <el-input
                  v-model="smtpForm.pass"
                  type="password"
                  placeholder="不是邮箱密码，是SMTP授权码"
                  show-password
                  clearable
                >
                  <template #prepend>
                    <el-icon><Lock /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">
                  <strong>QQ邮箱获取方式:</strong> 设置 → 账户 → POP3/SMTP → 生成授权码
                </div>
              </el-form-item>

              <el-form-item label="测试接收邮箱">
                <el-input v-model="testEmail" placeholder="用于测试邮件发送" clearable>
                  <template #prepend>
                    <el-icon><Message /></el-icon>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item>
                <div class="button-group">
                  <NeonButton type="primary" @click="saveSMTPConfig" :loading="saving">
                    保存配置
                  </NeonButton>
                  <NeonButton @click="testSMTP" :loading="testing" :disabled="!smtpConfigured && !hasFormData">
                    测试邮件
                  </NeonButton>
                  <NeonButton @click="resetForm" v-if="hasFormData">
                    重置
                  </NeonButton>
                </div>
              </el-form-item>
            </el-form>
          </HolographicCard>

          <!-- 钉钉通知配置 -->
          <HolographicCard class="config-card" :border="true" :hover="true">
            <template #header>
              <div class="card-header">
                <h3>
                  <el-icon><ChatDotRound /></el-icon>
                  钉钉通知配置
                </h3>
                <GlowingTag :type="dingtalkConfigured ? 'success' : 'info'" :text="dingtalkConfigured ? '已配置' : '未配置'" />
              </div>
            </template>

            <el-form :model="dingtalkForm" label-width="140px" class="config-form">
              <el-alert
                title="💡 配置说明"
                type="info"
                :closable="false"
                class="config-tip"
              >
                钉钉通知配置用于发送告警消息到钉钉群。需要先创建钉钉群机器人并获取Webhook地址。
              </el-alert>

              <el-form-item label="Webhook地址">
                <el-input v-model="dingtalkForm.webhook" placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." clearable>
                  <template #prepend>
                    <el-icon><Link /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">钉钉群设置 → 智能群助手 → 添加机器人 → 自定义</div>
              </el-form-item>

              <el-form-item label="加签密钥">
                <el-input
                  v-model="dingtalkForm.secret"
                  type="password"
                  placeholder="选填：如果启用了加签，请填写密钥"
                  show-password
                  clearable
                >
                  <template #prepend>
                    <el-icon><Lock /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">安全设置中启用"加签"后需要填写此项</div>
              </el-form-item>

              <el-form-item>
                <div class="button-group">
                  <NeonButton type="primary" @click="saveDingTalkConfig" :loading="savingDingTalk">
                    保存配置
                  </NeonButton>
                  <NeonButton @click="testDingTalk" :loading="testingDingTalk" :disabled="!dingtalkConfigured && !hasDingTalkData">
                    测试消息
                  </NeonButton>
                  <NeonButton @click="resetDingTalkForm" v-if="hasDingTalkData">
                    重置
                  </NeonButton>
                </div>
              </el-form-item>
            </el-form>
          </HolographicCard>

          <!-- 企业微信通知配置 -->
          <HolographicCard class="config-card" :border="true" :hover="true">
            <template #header>
              <div class="card-header">
                <h3>
                  <el-icon><ChatLineRound /></el-icon>
                  企业微信通知配置
                </h3>
                <GlowingTag :type="wechatConfigured ? 'success' : 'info'" :text="wechatConfigured ? '已配置' : '未配置'" />
              </div>
            </template>

            <el-form :model="wechatForm" label-width="140px" class="config-form">
              <el-alert
                title="💡 配置说明"
                type="info"
                :closable="false"
                class="config-tip"
              >
                企业微信通知配置用于发送告警消息到企业微信群。需要先创建企业微信群机器人并获取Webhook地址。
              </el-alert>

              <el-form-item label="Webhook地址">
                <el-input v-model="wechatForm.webhook" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." clearable>
                  <template #prepend>
                    <el-icon><Link /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">企业微信群 → 添加群机器人 → 复制Webhook地址</div>
              </el-form-item>

              <el-form-item>
                <div class="button-group">
                  <NeonButton type="primary" @click="saveWeChatConfig" :loading="savingWeChat">
                    保存配置
                  </NeonButton>
                  <NeonButton @click="testWeChat" :loading="testingWeChat" :disabled="!wechatConfigured && !hasWeChatData">
                    测试消息
                  </NeonButton>
                  <NeonButton @click="resetWeChatForm" v-if="hasWeChatData">
                    重置
                  </NeonButton>
                </div>
              </el-form-item>
            </el-form>
          </HolographicCard>

          <!-- Webhook通知配置 -->
          <HolographicCard class="config-card" :border="true" :hover="true">
            <template #header>
              <div class="card-header">
                <h3>
                  <el-icon><Connection /></el-icon>
                  Webhook通知配置
                </h3>
                <GlowingTag :type="webhookConfigured ? 'success' : 'info'" :text="webhookConfigured ? '已配置' : '未配置'" />
              </div>
            </template>

            <el-form :model="webhookForm" label-width="140px" class="config-form">
              <el-alert
                title="💡 配置说明"
                type="info"
                :closable="false"
                class="config-tip"
              >
                Webhook通知配置用于发送告警消息到自定义的HTTP接口。系统会以POST方式发送JSON格式的告警数据。
              </el-alert>

              <el-form-item label="Webhook URL">
                <el-input v-model="webhookForm.url" placeholder="https://your-domain.com/api/alerts/webhook" clearable>
                  <template #prepend>
                    <el-icon><Link /></el-icon>
                  </template>
                </el-input>
                <div class="form-tip">接收告警通知的HTTP接口地址（支持HTTP/HTTPS）</div>
              </el-form-item>

              <el-form-item>
                <div class="button-group">
                  <NeonButton type="primary" @click="saveWebhookConfig" :loading="savingWebhook">
                    保存配置
                  </NeonButton>
                  <NeonButton @click="testWebhook" :loading="testingWebhook" :disabled="!webhookConfigured && !hasWebhookData">
                    测试消息
                  </NeonButton>
                  <NeonButton @click="resetWebhookForm" v-if="hasWebhookData">
                    重置
                  </NeonButton>
                </div>
              </el-form-item>
            </el-form>
          </HolographicCard>
        </div>

        <!-- 系统参数 -->
        <div v-if="activeCategory === 'system'" class="category-section">
          <div class="section-header">
            <h2>系统参数</h2>
            <p>配置系统运行参数</p>
          </div>
          <HolographicCard class="config-card" :border="true">
            <el-empty description="功能开发中，敬请期待" :image-size="120" />
          </HolographicCard>
        </div>

        <!-- 安全设置 -->
        <div v-if="activeCategory === 'security'" class="category-section">
          <div class="section-header">
            <h2>安全设置</h2>
            <p>配置系统安全策略</p>
          </div>
          <HolographicCard class="config-card" :border="true">
            <el-empty description="功能开发中，敬请期待" :image-size="120" />
          </HolographicCard>
        </div>

        <!-- 数据库配置 -->
        <div v-if="activeCategory === 'database'" class="category-section">
          <div class="section-header">
            <h2>数据库配置</h2>
            <p>配置数据库连接参数</p>
          </div>
          <HolographicCard class="config-card" :border="true">
            <el-empty description="功能开发中，敬请期待" :image-size="120" />
          </HolographicCard>
        </div>

        <!-- 配置历史 -->
        <div v-if="activeCategory === 'history'" class="category-section">
          <div class="section-header">
            <h2>配置历史</h2>
            <p>查看最近的配置变更记录</p>
          </div>
          <HolographicCard class="config-card" :border="true">
            <el-timeline v-if="configHistory.length > 0">
              <el-timeline-item
                v-for="item in configHistory"
                :key="item.id"
                :timestamp="formatTime(item.updated_at)"
                placement="top"
              >
                <div class="history-item">
                  <div class="history-title">{{ item.description }}</div>
                  <div class="history-detail">配置键: {{ item.setting_key }}</div>
                </div>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else description="暂无配置历史" />
          </HolographicCard>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Setting, Message, Connection, User, Lock, Clock, ChatDotRound, ChatLineRound, Link } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'

console.log('✅ Settings Element Plus 组件已加载')

// 当前激活的分类
const activeCategory = ref('notification')

// 分类配置
const categories = [
  {
    key: 'notification',
    name: '通知配置',
    desc: '邮件、钉钉、微信等',
    icon: '📢'
  },
  {
    key: 'system',
    name: '系统参数',
    desc: '运行参数配置',
    icon: '⚙️'
  },
  {
    key: 'security',
    name: '安全设置',
    desc: '访问控制与安全',
    icon: '🔒'
  },
  {
    key: 'database',
    name: '数据库配置',
    desc: '数据库连接设置',
    icon: '💾'
  },
  {
    key: 'history',
    name: '配置历史',
    desc: '查看变更记录',
    icon: '📜'
  }
]

// 获取分类已配置数量
const getCategoryConfigCount = (categoryKey) => {
  if (categoryKey === 'notification') {
    let count = 0
    if (smtpConfigured.value) count++
    if (dingtalkConfigured.value) count++
    if (wechatConfigured.value) count++
    if (webhookConfigured.value) count++
    return count
  }
  return 0
}

// SMTP表单
const smtpForm = ref({
  host: '',
  port: 587,
  user: '',
  pass: ''
})

// 钉钉表单
const dingtalkForm = ref({
  webhook: '',
  secret: ''
})

// 企业微信表单
const wechatForm = ref({
  webhook: ''
})

// Webhook表单
const webhookForm = ref({
  url: ''
})

// 测试邮箱
const testEmail = ref('')

// 状态
const saving = ref(false)
const testing = ref(false)
const smtpConfigured = ref(false)

const savingDingTalk = ref(false)
const testingDingTalk = ref(false)
const dingtalkConfigured = ref(false)

const savingWeChat = ref(false)
const testingWeChat = ref(false)
const wechatConfigured = ref(false)

const savingWebhook = ref(false)
const testingWebhook = ref(false)
const webhookConfigured = ref(false)

const configHistory = ref([])

// 是否有表单数据
const hasFormData = computed(() => {
  return smtpForm.value.host || smtpForm.value.user || smtpForm.value.pass
})

const hasDingTalkData = computed(() => {
  return dingtalkForm.value.webhook
})

const hasWeChatData = computed(() => {
  return wechatForm.value.webhook
})

const hasWebhookData = computed(() => {
  return webhookForm.value.url
})

// 加载SMTP配置
async function loadSMTPConfig() {
  try {
    const response = await api.get('/api/settings/smtp')
    if (response.success && response.data) {
      smtpForm.value = {
        host: response.data.host || '',
        port: response.data.port || 587,
        user: response.data.user || '',
        pass: response.data.pass || ''
      }
      smtpConfigured.value = true
      console.log('✅ SMTP配置已加载')
    }
  } catch (error) {
    console.log('ℹ️ 未找到SMTP配置')
  }
}

// 加载钉钉配置
async function loadDingTalkConfig() {
  try {
    const response = await api.get('/api/settings/dingtalk')
    if (response.success && response.data) {
      dingtalkForm.value = {
        webhook: response.data.webhook || '',
        secret: response.data.secret || ''
      }
      dingtalkConfigured.value = !!response.data.webhook
      console.log('✅ 钉钉配置已加载')
    }
  } catch (error) {
    console.log('ℹ️ 未找到钉钉配置')
  }
}

// 加载企业微信配置
async function loadWeChatConfig() {
  try {
    const response = await api.get('/api/settings/wechat')
    if (response.success && response.data) {
      wechatForm.value = {
        webhook: response.data.webhook || ''
      }
      wechatConfigured.value = !!response.data.webhook
      console.log('✅ 企业微信配置已加载')
    }
  } catch (error) {
    console.log('ℹ️ 未找到企业微信配置')
  }
}

// 加载Webhook配置
async function loadWebhookConfig() {
  try {
    const response = await api.get('/api/settings/webhook')
    if (response.success && response.data) {
      webhookForm.value = {
        url: response.data.url || ''
      }
      webhookConfigured.value = !!response.data.url
      console.log('✅ Webhook配置已加载')
    }
  } catch (error) {
    console.log('ℹ️ 未找到Webhook配置')
  }
}

// 保存SMTP配置
async function saveSMTPConfig() {
  // 验证
  if (!smtpForm.value.host) {
    ElMessage.warning('请填写SMTP服务器地址')
    return
  }
  if (!smtpForm.value.user) {
    ElMessage.warning('请填写发件人邮箱')
    return
  }
  if (!smtpForm.value.pass) {
    ElMessage.warning('请填写SMTP授权码')
    return
  }

  try {
    saving.value = true
    const response = await api.post('/api/settings/smtp', smtpForm.value)

    if (response.success) {
      ElMessage.success('SMTP配置已保存')
      smtpConfigured.value = true
      await loadConfigHistory()
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('保存SMTP配置失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// 保存钉钉配置
async function saveDingTalkConfig() {
  if (!dingtalkForm.value.webhook) {
    ElMessage.warning('请填写Webhook地址')
    return
  }

  try {
    savingDingTalk.value = true
    const response = await api.post('/api/settings/dingtalk', dingtalkForm.value)

    if (response.success) {
      ElMessage.success('钉钉配置已保存')
      dingtalkConfigured.value = true
      await loadConfigHistory()
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('保存钉钉配置失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    savingDingTalk.value = false
  }
}

// 保存企业微信配置
async function saveWeChatConfig() {
  if (!wechatForm.value.webhook) {
    ElMessage.warning('请填写Webhook地址')
    return
  }

  try {
    savingWeChat.value = true
    const response = await api.post('/api/settings/wechat', wechatForm.value)

    if (response.success) {
      ElMessage.success('企业微信配置已保存')
      wechatConfigured.value = true
      await loadConfigHistory()
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('保存企业微信配置失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    savingWeChat.value = false
  }
}

// 保存Webhook配置
async function saveWebhookConfig() {
  if (!webhookForm.value.url) {
    ElMessage.warning('请填写Webhook URL')
    return
  }

  try {
    savingWebhook.value = true
    const response = await api.post('/api/settings/webhook', webhookForm.value)

    if (response.success) {
      ElMessage.success('Webhook配置已保存')
      webhookConfigured.value = true
      await loadConfigHistory()
    } else {
      throw new Error(response.error || '保存失败')
    }
  } catch (error) {
    console.error('保存Webhook配置失败:', error)
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    savingWebhook.value = false
  }
}

// 测试SMTP
async function testSMTP() {
  if (!testEmail.value) {
    ElMessage.warning('请填写测试接收邮箱')
    return
  }

  // 如果表单有数据但未保存，提示先保存
  if (hasFormData.value && !smtpConfigured.value) {
    ElMessage.warning('请先保存SMTP配置')
    return
  }

  try {
    testing.value = true
    const response = await api.post('/api/settings/smtp/test', {
      email: testEmail.value
    })

    if (response.success) {
      ElMessage.success('测试邮件已发送，请检查邮箱（注意垃圾邮件箱）')
    } else {
      throw new Error(response.error || '发送失败')
    }
  } catch (error) {
    console.error('测试邮件发送失败:', error)
    ElMessage.error('发送失败: ' + (error.message || '未知错误'))
  } finally {
    testing.value = false
  }
}

// 测试钉钉
async function testDingTalk() {
  if (hasDingTalkData.value && !dingtalkConfigured.value) {
    ElMessage.warning('请先保存钉钉配置')
    return
  }

  try {
    testingDingTalk.value = true
    const response = await api.post('/api/settings/dingtalk/test')

    if (response.success) {
      ElMessage.success('测试消息已发送，请检查钉钉群')
    } else {
      throw new Error(response.error || '发送失败')
    }
  } catch (error) {
    console.error('测试钉钉消息失败:', error)
    ElMessage.error('发送失败: ' + (error.message || '未知错误'))
  } finally {
    testingDingTalk.value = false
  }
}

// 测试企业微信
async function testWeChat() {
  if (hasWeChatData.value && !wechatConfigured.value) {
    ElMessage.warning('请先保存企业微信配置')
    return
  }

  try {
    testingWeChat.value = true
    const response = await api.post('/api/settings/wechat/test')

    if (response.success) {
      ElMessage.success('测试消息已发送，请检查企业微信群')
    } else {
      throw new Error(response.error || '发送失败')
    }
  } catch (error) {
    console.error('测试企业微信消息失败:', error)
    ElMessage.error('发送失败: ' + (error.message || '未知错误'))
  } finally {
    testingWeChat.value = false
  }
}

// 测试Webhook
async function testWebhook() {
  if (hasWebhookData.value && !webhookConfigured.value) {
    ElMessage.warning('请先保存Webhook配置')
    return
  }

  try {
    testingWebhook.value = true
    const response = await api.post('/api/settings/webhook/test')

    if (response.success) {
      ElMessage.success('测试消息已发送')
    } else {
      throw new Error(response.error || '发送失败')
    }
  } catch (error) {
    console.error('测试Webhook消息失败:', error)
    ElMessage.error('发送失败: ' + (error.message || '未知错误'))
  } finally {
    testingWebhook.value = false
  }
}

// 重置表单
function resetForm() {
  smtpForm.value = {
    host: '',
    port: 587,
    user: '',
    pass: ''
  }
  testEmail.value = ''
}

function resetDingTalkForm() {
  dingtalkForm.value = {
    webhook: '',
    secret: ''
  }
}

function resetWeChatForm() {
  wechatForm.value = {
    webhook: ''
  }
}

function resetWebhookForm() {
  webhookForm.value = {
    url: ''
  }
}

// 加载配置历史
async function loadConfigHistory() {
  try {
    const response = await api.get('/api/settings/history')
    if (response.success) {
      configHistory.value = response.data || []
    }
  } catch (error) {
    console.error('加载配置历史失败:', error)
  }
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  loadSMTPConfig()
  loadDingTalkConfig()
  loadWeChatConfig()
  loadWebhookConfig()
  loadConfigHistory()
})
</script>

<style scoped lang="scss">
.settings-page {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-primary);
}

// 页面标题
.page-header {
  padding: 30px;
  margin-bottom: 20px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-section {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;

      .title-icon {
        filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
      }

      .title-gradient {
        color: var(--tech-cyan);
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }
    }

    .page-subtitle {
      color: var(--tech-text-secondary);
      font-size: 14px;
      margin: 0;
    }
  }
}

// 设置容器布局
.settings-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  align-items: start;
}

// 左侧分类菜单
.settings-sidebar {
  padding: 20px;
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;

  .sidebar-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 16px;
    padding: 0 8px;
  }
}

.category-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  position: relative;

  &:hover {
    background: rgba(0, 255, 255, 0.05);
    border-color: rgba(0, 255, 255, 0.2);
    transform: translateX(4px);
  }

  &.active {
    background: rgba(0, 255, 255, 0.1);
    border-color: var(--tech-cyan);
    box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);

    .category-name {
      color: var(--tech-cyan);
    }
  }

  .category-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .category-info {
    flex: 1;
    min-width: 0;
  }

  .category-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .category-desc {
    font-size: 12px;
    color: var(--text-muted);
  }

  .category-badge {
    flex-shrink: 0;
  }
}

// 右侧内容区
.settings-content {
  min-height: 400px;
}

.category-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  margin-bottom: 20px;

  h2 {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }
}

// 配置卡片
.config-card {
  margin-bottom: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
  }
}

// 配置表单
.config-form {
  .config-tip {
    margin-bottom: 20px;
  }

  .form-tip {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 5px;
  }

  .button-group {
    display: flex;
    gap: 10px;
  }
}

// 历史记录
.history-item {
  .history-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .history-detail {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

// 响应式布局
@media (max-width: 1024px) {
  .settings-container {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    position: relative;
    top: 0;
    max-height: none;
  }

  .category-menu {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .category-item {
    flex: 1;
    min-width: 150px;

    .category-desc {
      display: none;
    }
  }
}

@media (max-width: 768px) {
  .settings-page {
    padding: 10px;
  }

  .config-form {
    :deep(.el-form-item__label) {
      width: 100px !important;
    }
  }
}
</style>
