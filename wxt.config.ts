import { defineConfig } from 'wxt'

const matches = ['*://zhipin.com/*', '*://*.zhipin.com/*']

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  manifest: {
    name: 'Boss 人审助手',
    description: '扫描 Boss 岗位，生成打招呼语，并由用户人工审核发送。',
    permissions: ['storage', 'notifications'],
    host_permissions: ['*://zhipin.com/*', '*://*.zhipin.com/*', 'https://api.deepseek.com/*'],
    web_accessible_resources: [
      {
        resources: ['main-world.js'],
        matches,
      },
    ],
  },
  hooks: {
    'build:manifestGenerated': (_, manifest) => {
      manifest.content_scripts ??= []
      const hasBossContentStyles = manifest.content_scripts.some((script) => {
        const scriptMatches = script.matches ?? []
        return matches.every((match) => scriptMatches.includes(match)) && script.css?.length
      })

      if (hasBossContentStyles) return

      manifest.content_scripts.push({
        matches,
        css: ['/assets/main.css'],
      })
    },
  },
})
