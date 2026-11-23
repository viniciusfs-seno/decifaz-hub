import {sql} from '../e2e/helpers/local-db.mjs'
import {checked} from '../e2e/helpers/operational-fixture.mjs'
export async function noticePreviewFixture(f){
 await checked(f.owner.client.rpc('hub_set_member_label',{w:f.workspace,u:f.owner.id,n:'Marina · fictícia',expected_revision:0}))
 await checked(f.owner.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Caio · fictício',expected_revision:0}))
 // Defaults remain email OFF. Local-only generation does not activate jobs.
 sql(`select hub_private.generate_notices('${f.workspace}',clock_timestamp());`)
 const cleanup=f.cleanup;f.cleanup=async()=>{sql(`delete from hub_private.notice_runs where workspace_id='${f.workspace}';`);await cleanup()}
}
