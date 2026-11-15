import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./e2e',testMatch:'transition-real.spec.mjs',workers:1,
 use:{baseURL:'http://127.0.0.1:4181',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
 webServer:[['.',4181],['.validation/previous',4182],['.validation/bridge',4183]].map(([root,port])=>({
  command:`node node_modules/vite/bin/vite.js ${root==='.'?'': 'preview'} ${root} --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,
 })),
})
