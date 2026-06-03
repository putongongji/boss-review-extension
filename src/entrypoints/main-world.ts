import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'

import App from '@/app/App.vue'

const ROOT_ID = 'boss-review-sender-root'

function mountApp() {
  if (document.getElementById(ROOT_ID)) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  document.body.append(root)

  const app = createApp(App)
  app.use(createPinia())
  app.mount(root)
}

export default defineUnlistedScript(() => {
  mountApp()
})
