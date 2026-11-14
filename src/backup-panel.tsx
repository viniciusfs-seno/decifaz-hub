import {useMemo,useRef,useState} from 'react'
import {backupLimit,backupSections,parseBackup,type BackupMetadata} from './backup'
import {backupDiff} from './backup-diff'
import type {Data} from './domain'
import {exportData} from './repository'
import {Dialog} from './ui'

export function BackupPanel({current,restore,undoCopy,undo,stale}:{current:Data;restore:(data:Data)=>boolean;undoCopy?:Data;undo:()=>boolean;stale:boolean}){
 const [undoOpen,setUndoOpen]=useState(false)
 const [open,setOpen]=useState(false)
 const [raw,setRaw]=useState('')
 const [incoming,setIncoming]=useState<Data>()
 const [metadata,setMetadata]=useState<BackupMetadata>()
 const [error,setError]=useState('')
 const [confirm,setConfirm]=useState(false)
 const diff=useMemo(()=>incoming?backupDiff(current,incoming):[],[current,incoming])
 const request=useRef(0)
 function reset(){
  request.current++
  setIncoming(undefined)
  setMetadata(undefined)
  setError('')
  setConfirm(false)
 }
 function validate(contents:string){
  reset()
  const parsed=parseBackup(contents)
  if('error'in parsed)setError(parsed.error)
  else {setIncoming(parsed.data);setMetadata(parsed.metadata)}
 }
 return <><button className="button" disabled={stale} onClick={()=>setOpen(true)}>Restaurar backup</button>
 {open&&<Dialog title="Restaurar backup" wide onClose={()=>{reset();setRaw('');setOpen(false)}}><div className="dialog-body">
 <label className="field"><span>Arquivo JSON do Decifaz Hub</span><input type="file" accept=".json,application/json" onChange={async e=>{
  const file=e.currentTarget.files?.[0]
  reset();setRaw('')
  if(!file)return
  if(file.size>backupLimit){setError('Use um arquivo JSON de até 5 MB.');return}
  const token=request.current
  try{const contents=await file.text();if(token===request.current)validate(contents)}
  catch{if(token===request.current)setError('Não foi possível ler o arquivo.')}
 }}/></label>
 <details><summary>Colar conteúdo JSON</summary><label className="field"><span>Conteúdo do backup</span><textarea value={raw} onChange={e=>{reset();setRaw(e.target.value)}}/></label><button className="button" onClick={()=>validate(raw)}>Validar JSON</button></details>
 {error&&<p className="error" role="alert">{error}</p>}
 {incoming&&<><h3>Prévia da restauração</h3><p className="muted">{metadata?'Backup v'+metadata.formatVersion+' · Exportado em '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(metadata.exportedAt)):'Backup antigo · Data de exportação indisponível'}</p><div className="table-wrap"><table><thead><tr><th>Registros</th><th>Neste navegador</th><th>No backup</th></tr></thead><tbody>{backupSections.map(([key,label])=><tr key={key}><td>{label}</td><td>{current[key]?.length??0}</td><td>{incoming[key]?.length??0}</td></tr>)}</tbody></table></div>
 <section aria-label="Alterações por registro"><h3>Alterações por registro</h3>
 {diff.some(group=>group.added.length||group.changed.length||group.removed.length)?diff.filter(group=>group.added.length||group.changed.length||group.removed.length).map(group=><details key={group.key} className="closure-record"><summary>{group.label} · {group.added.length} adicionados · {group.changed.length} alterados · {group.removed.length} removidos</summary>
 {([['Adicionados',group.added],['Alterados',group.changed],['Removidos',group.removed]] as const).filter(([,rows])=>rows.length).map(([label,rows])=><div key={label}><h4>{label}</h4><ul>{rows.map(row=><li key={row.id}>{'fields'in row?<details><summary>{row.name||row.id}</summary><div className="table-wrap backup-comparison"><table><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{row.fields.map(field=><tr key={field.key}><td className="backup-field-name"><b>{field.label}</b></td><td className="backup-field-value"><span className="backup-mobile-label" aria-hidden="true">Antes</span>{field.before}</td><td className="backup-field-value"><span className="backup-mobile-label" aria-hidden="true">Depois</span>{field.after}</td></tr>)}</tbody></table></div></details>:row.name||row.id}</li>)}</ul></div>)}</details>):<p className="muted">Os registros do backup coincidem com os dados atuais.</p>}
 </section>
 <p>Restaurar substitui os dados deste navegador pelos registros do backup.</p>
 <div><button className="button" onClick={()=>exportData(current)}>Baixar backup dos dados atuais</button></div>
 <label className="checkline"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirmo a substituição dos dados deste navegador.</label>
 <div><button className="button primary" disabled={!confirm||stale} onClick={()=>{
  if(!restore(incoming)){setError('Não foi possível gravar o backup neste navegador.');return}
  reset();setRaw('');setOpen(false)
 }}>Confirmar restauração</button></div></>}
 </div></Dialog>}
 {undoCopy&&<button className="button" disabled={stale} onClick={()=>{reset();setUndoOpen(true)}}>Desfazer última restauração</button>}
 {undoOpen&&<Dialog title="Desfazer última restauração" onClose={()=>{reset();setUndoOpen(false)}}><div className="dialog-body">
 <p>Isso recupera a cópia anterior à última restauração e substitui os dados atuais, incluindo alterações feitas depois dela.</p>
 <button className="button" onClick={()=>exportData(current)}>Baixar backup dos dados atuais</button>
 <label className="checkline"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirmo a substituição dos dados atuais.</label>
 {error&&<p className="error" role="alert">{error}</p>}
 <button className="button primary" disabled={!confirm||stale} onClick={()=>{if(!undo()){setError('Não foi possível desfazer a restauração. Confira se os dados mudaram em outra aba.');return}reset();setUndoOpen(false)}}>Confirmar desfazer</button>
 </div></Dialog>}</>
}
