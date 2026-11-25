import fs from 'node:fs'
import {createHash} from 'node:crypto'
const source='https://servicodados.ibge.gov.br/api/v1/localidades/municipios'
const response=await fetch(source);if(!response.ok)throw Error('IBGE indisponível; snapshot existente preservado')
const data=await response.json(),rows=data.map(r=>({id:String(r.id),name:r.nome,uf:r['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla??r.microrregiao?.mesorregiao?.UF?.sigla})).sort((a,b)=>a.id.localeCompare(b.id))
if(rows.length<5500||rows.some(r=>!/^\d{7}$/.test(r.id)||!r.name||!r.uf)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Referência oficial incompleta')
const payload=JSON.stringify(rows);fs.mkdirSync('public/referencias',{recursive:true});fs.writeFileSync('public/referencias/municipios-ibge.json',payload)
fs.writeFileSync('public/referencias/municipios-ibge.meta.json',JSON.stringify({source,retrievedAt:new Date().toISOString(),count:rows.length,sha256:createHash('sha256').update(payload).digest('hex'),usage:'Nomes, códigos e UF oficiais; não contém dados de empresas.'},null,2));console.log('Snapshot oficial validado: '+rows.length+' municípios; revisão explícita antes de atualizar a migração.')
