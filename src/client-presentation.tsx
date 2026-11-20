import {useState} from 'react'
import {money,type Lead,type Meeting,type Proposal} from './domain'
import type {Solution} from './shared-catalog'
import {MeetingPresentation} from './meeting-presentation'

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function presentationHtml(title:string,solutions:Pick<Solution,'name'|'description'|'scope_items'>[],values:string[]=[]){
 return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decifaz · Apresentação</title><style>body{font:20px system-ui;background:#f5f6fa;color:#1f2433;margin:0}main{max-width:1000px;margin:auto;padding:40px 24px}h1{font-size:clamp(30px,5vw,54px)}article{background:white;padding:28px;margin:22px 0;border:1px solid #d9d9d9;border-radius:14px}small{color:#3a4a6f;letter-spacing:.12em}p,li{line-height:1.6}</style><main><h1>'+escape(title)+'</h1>'+solutions.map(s=>'<article><h2>'+escape(s.name)+'</h2><p>'+escape(s.description)+'</p><ul>'+s.scope_items.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul></article>').join('')+values.map(v=>'<article>'+escape(v)+'</article>').join('')+'</main></html>'
}
export function ClientPresentation({lead,meeting,solutions,proposals,financial}:{lead:Lead;meeting?:Meeting;solutions:Solution[];proposals:Proposal[];financial:boolean}){
 const [chosen,setChosen]=useState<string[]>([]),[prices,setPrices]=useState<string[]>([]),[error,setError]=useState('')
 const rows=solutions.filter(s=>s.active),quotes=proposals.filter(p=>p.leadId===lead.id&&p.setup!==undefined)
 function open(){const child=window.open('','_blank');if(!child){setError('Permita a abertura da janela de apresentação neste navegador.');return}child.opener=null;child.document.write(presentationHtml(lead.name,rows.filter(s=>chosen.includes(s.id)),financial?quotes.filter(p=>prices.includes(p.id)).map(p=>p.title+' · Implantação '+money(p.setup)+' · Mensalidade '+money(p.monthly)):[]));child.document.close();setError('')}
 return <section className="panel client-presentation"><h2>Apresentação selecionada</h2><p>Escolha o conteúdo e abra uma janela limpa para apresentar. Notas internas, respostas, histórico e condições comerciais ficam fora dela.</p><div className="team-roles">{rows.map(s=><label key={s.id}><input type="checkbox" checked={chosen.includes(s.id)} onChange={e=>setChosen(e.target.checked?[...chosen,s.id]:chosen.filter(i=>i!==s.id))}/>{s.name}</label>)}</div>
  {financial&&<fieldset><legend>Valores opcionais · seleção explícita</legend>{quotes.map(p=><label className="checkline" key={p.id}><input type="checkbox" checked={prices.includes(p.id)} onChange={e=>setPrices(e.target.checked?[...prices,p.id]:prices.filter(id=>id!==p.id))}/>Mostrar valores de {p.title} · v{p.version}</label>)}</fieldset>}
  <button type="button" className="button primary" disabled={!chosen.length&&!prices.length} onClick={open}>Abrir apresentação selecionada</button>{error&&<p role="alert">{error}</p>}
  <p className="muted">Na videochamada externa, use “Compartilhar tela” e escolha a janela “Decifaz · Apresentação”. Evite compartilhar a ficha interna. A prévia abaixo é local e não transmite para outros participantes pelo Hub.</p>
  <MeetingPresentation meetings={meeting?[meeting]:[]} leads={[lead]}/>
 </section>
}
