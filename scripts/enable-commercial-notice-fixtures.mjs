// Explicit fixture activation; never changes a remote scheduler or production.
import {sql} from '../e2e/helpers/local-db.mjs'
if(process.env.HUB_REAL_E2E!=='1'||process.env.VITE_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('Ativação somente em fixtures Supabase locais')
sql(`do $$begin if exists(select 1 from information_schema.columns where table_schema='hub_private' and table_name='notice_settings' and column_name='commercial_enabled') then update hub_private.notice_settings set commercial_enabled=true;end if;end $$;`)
console.log('Fontes comerciais ativadas somente no contêiner de fixtures local.')
