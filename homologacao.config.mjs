import {defineConfig,devices} from '@playwright/test'
export default defineConfig({
 testDir:'./homologacao',workers:1,retries:0,timeout:180000,
 reporter:[['list']],outputDir:'.validation/external-results',
 use:{baseURL:process.env.HUB_HML_PREVIEW_URL,timezoneId:'America/Fortaleza',trace:'off',video:'off',screenshot:'off'},
 projects:[{name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000},launchOptions:{args:['--auto-select-desktop-capture-source=Entire screen','--enable-usermedia-screen-capturing']}}},{name:'webkit-celular',use:{...devices['iPhone 13']}}],
})
