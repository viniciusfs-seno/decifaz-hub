import {useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {importFields,importRowId,mappedBody,parseCsv,type ImportBody} from './csv-import'
import {Empty,Page} from './ui'
type Match={id:string;name:string;city:string;revision:number}
type Line={index:number;body:ImportBody;operation:string;status:string;errors:string[];matches:Match[];decision:string;target:string;done?:boolean}
const labels:Record<string,string>={ready:'Pronta para criar',review:'Possível duplicidade: escolha uma ação',invalid:'Corrigir linha',created:'Criada',updated:'Atualizada',skipped:'Ignorada',conflict:'Registro mudou: revise novamente',error:'Falha: pode tentar novamente'}
export function LeadImport({client,workspace,allowed,saved}:{client:SupabaseClient;workspace:string;allowed:boolean;saved:()=>void}){
 const [source,setSource]=useState(''),[file,setFile]=useState<ReturnType<typeof parseCsv>>(),[mapping,setMapping]=useState<Record<string,string>>({}),[lines,setLines]=useState<Line[]>([]),[stage,setStage]=useState('Identificado'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState('')
 function download(text:string,name:string){const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function read(input:File|undefined){
  if(!input)return;setError('');setLines([])
  try{if(input.size>2e6)throw Error('Arquivo deve ter até 2 MB.');const bytes=await input.arrayBuffer();let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('windows-1252').decode(bytes)}const parsed=parseCsv(text);setSource(text);setFile(parsed);const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();setMapping(Object.fromEntries(importFields.map(([key,label])=>{const index=parsed.columns.findIndex(c=>norm(c)===norm(label)||norm(c)===norm(key));return [key,index<0?'':String(index)]})));setProgress('')}catch(e){setFile(undefined);setError((e as Error).message)}
 }
 async function preview(){
  if(!file||busy)return;setBusy(true);setError('');setLines([])
  try{const user=(await client.auth.getUser()).data.user;if(!user)throw Error('Sessão indisponível.');const result:Line[]=[]
   for(let index=0;index<file.rows.length;index++){
    const body=mappedBody(file.rows[index],mapping),operation=await importRowId(workspace,user.id,source+'|'+JSON.stringify(mapping)+'|'+stage,index)
    const r=await client.rpc('hub_import_lead',{w:workspace,operation_id:operation,body,initial_stage:stage})
    if(r.error)throw Error('Não foi possível validar no servidor. Confira seu acesso e tente novamente.')
    result.push({index,body,operation,status:r.data.status,errors:r.data.errors??[],matches:r.data.matches??[],decision:r.data.status==='ready'?'create':'',target:'',done:['created','updated','skipped'].includes(r.data.status)});setProgress(`Validadas ${index+1} de ${file.rows.length} linhas`)
   }setLines(result)
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function execute(){
  if(busy)return;setBusy(true);setError('');let count=0
  try{for(const line of lines){if(line.done||line.status==='invalid'||!line.decision)continue
    const match=line.matches.find(m=>m.id===line.target)
    if(line.decision==='update'&&!match)continue
    const r=await client.rpc('hub_import_lead',{w:workspace,operation_id:line.operation,body:line.body,initial_stage:stage,decision:line.decision,target:match?.id??null,expected_revision:match?.revision??null,acknowledged:line.decision==='create'?line.matches.map(m=>m.id):[]})
    const status=r.error?'error':r.data.status,done=['created','updated','skipped'].includes(status)
    setLines(rows=>rows.map(row=>row.index===line.index?{...row,status,done,decision:done?row.decision:'',matches:r.data?.matches??(status==='conflict'?[r.data.current]:row.matches),errors:r.data?.errors??[]}:row));count++;setProgress(`${count} linhas processadas nesta tentativa`)
   }saved()
  }catch{setError('Conexão interrompida. Retome as linhas pendentes; as confirmadas não serão duplicadas.')}finally{setBusy(false)}
 }
 function rejected(){const quote=(v:string)=>'"'+(/^\s*[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';const pending=lines.filter(l=>!l.done&&l.status!=='skipped');download([importFields.map(([,label])=>quote(label)).join(';'),...pending.map(l=>importFields.map(([key])=>quote(String(key in l.body?l.body[key as keyof ImportBody]??'':l.body.profile[key]??''))).join(';'))].join('\r\n'),'decifaz-corrigir.csv')}
 return <Page title="Importar estabelecimentos" description="Prévia assistida: nenhuma linha é gravada antes da sua confirmação.">
  <p>Somente cadastro inicial. Interesse, orçamento, diagnóstico confirmado, aceite e Ganho continuam nos fluxos com evidências. Necessidades importadas são informações a verificar.</p>
  <button className="button" onClick={()=>download('Nome;Segmento;Cidade;WhatsApp;Site;Origem\r\nEstabelecimento fictício;Serviços;Fortaleza;(85) 99999-9999;https://example.invalid;Pesquisa fictícia','modelo-estabelecimentos.csv')}>Baixar modelo CSV</button>
  {!allowed?<p role="alert">Importar exige Administração ou Comercial ativo neste espaço.</p>:<fieldset disabled={busy}>
  <label>Arquivo CSV<input type="file" accept=".csv,text/csv" onChange={e=>void read(e.target.files?.[0])}/></label><p>UTF-8 ou Windows-1252; separador ponto e vírgula, vírgula ou tabulação; até 1000 linhas / 2 MB. Aspas preservam separadores e quebras de linha.</p>
  {file&&<><h2>Escolha as colunas</h2><div className="fields">{importFields.map(([field,label])=><label key={field}>{label}<select value={mapping[field]??''} onChange={e=>{setMapping({...mapping,[field]:e.target.value});setLines([])}}><option value="">Não importar</option>{file.columns.map((c,i)=><option key={i} value={i}>{c}</option>)}</select></label>)}</div><label>Estágio inicial<select value={stage} onChange={e=>{setStage(e.target.value);setLines([])}}><option>Identificado</option><option>Em pesquisa</option></select></label><button className="button" onClick={()=>void preview()} disabled={mapping.name===''}>Validar e mostrar prévia</button></>}
  </fieldset>}
  {error&&<p role="alert">{error}</p>}{progress&&<p role="status">{progress}</p>}
  {lines.length>0&&<><h2>Prévia e decisões por linha</h2><p>Mesmo nome e cidade normalizados, WhatsApp ou site iguais são indícios verificáveis, não confirmação automática. Atualizar mescla os campos mapeados, inclusive vazios, sem mudar a etapa nem os demais dados. Criar separado exige a sua escolha explícita. Cada linha é uma transação; falhas não desfazem linhas já confirmadas.</p><div className="table-wrap card"><table><thead><tr><th>Linha / estabelecimento</th><th>Dados a gravar</th><th>Validação</th><th>Decisão</th></tr></thead><tbody>{lines.map(line=><tr key={line.index}><td>{line.index+2} · {line.body.name||'Nome ausente'}<p>{line.body.city}</p></td><td><details><summary>Conferir campos</summary><dl>{Object.entries({...line.body,...line.body.profile}).filter(([key])=>key!=='profile').map(([key,v])=><div key={key}><dt>{importFields.find(([f])=>f===key)?.[1]??key}</dt><dd>{String(v)||'(vazio)'}</dd></div>)}</dl></details></td><td>{labels[line.status]??line.status}{line.errors.map(e=><p key={e}>{e}</p>)}</td><td>{!line.done&&line.status!=='invalid'&&<><label>Ação da linha {line.index+2}<select disabled={busy} value={line.decision} onChange={e=>setLines(rows=>rows.map(r=>r.index===line.index?{...r,decision:e.target.value}:r))}><option value="">Revisar antes de confirmar</option><option value="create">{line.matches.length?'Criar separado, mesmo com possível duplicidade':'Criar novo'}</option>{line.matches.length>0&&<option value="update">Atualizar cadastro existente</option>}<option value="skip">Ignorar linha</option></select></label>{line.decision==='update'&&<label>Cadastro a atualizar na linha {line.index+2}<select disabled={busy} value={line.target} onChange={e=>setLines(rows=>rows.map(r=>r.index===line.index?{...r,target:e.target.value}:r))}><option value="">Escolher cadastro</option>{line.matches.map(m=><option key={m.id} value={m.id}>{m.name} · {m.city} · revisão {m.revision}</option>)}</select></label>}</>}</td></tr>)}</tbody></table></div><div className="actions"><button className="button primary" disabled={busy} onClick={()=>void execute()}>Confirmar linhas selecionadas</button><button className="button" disabled={busy} onClick={rejected}>Baixar linhas para corrigir</button></div></>}
  {!file&&<Empty title="Selecione um CSV para começar" detail="Use o modelo ou mapeie as colunas do seu arquivo."/>}
 </Page>
}
