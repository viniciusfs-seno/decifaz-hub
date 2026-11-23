import {test} from 'node:test'
import assert from 'node:assert/strict'
import {workerConfig,sameSecret,processNotices} from '../supabase/functions/_shared/notice-worker.mjs'
test('Avisos começam desligados; sandbox recusa API remota, remetente real e portal com credencial',async()=>{
 assert.equal(workerConfig({}).mode,'off')
 assert.deepEqual(await processNotices(null,workerConfig({})),{claimed:0,accepted:0,delivered:0,suppressed:0,retry:0,failed:0,uncertain:0})
 const env={HUB_NOTICE_MODE:'mailpit',SUPABASE_URL:'http://127.0.0.1:54321'}
 for(const extra of [{SUPABASE_URL:'https://example.supabase.co'},{HUB_NOTICE_MAILPIT_URL:'https://example.invalid'},{HUB_NOTICE_FROM:'real@example.com'},{HUB_NOTICE_PORTAL_URL:'https://user:password@example.invalid/'}])assert.throws(()=>workerConfig({...env,...extra}))
 assert.throws(()=>workerConfig({HUB_NOTICE_MODE:'resend'}))
 assert.equal(sameSecret('short','short'),false);assert.equal(sameSecret('a'.repeat(32),'b'.repeat(32)),false);assert.equal(sameSecret('a'.repeat(32),'a'.repeat(32)),true)
})
