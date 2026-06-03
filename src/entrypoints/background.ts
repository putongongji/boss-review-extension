import { defineBackground } from 'wxt/utils/define-background'

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon/128.png',
      title: 'Boss 人审助手已安装',
      message: '打开 Boss 职位页后可在右侧使用审核面板。',
    })
  })
})
