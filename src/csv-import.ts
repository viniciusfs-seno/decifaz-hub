export type ImportBody={name:string;segment?:string;city?:string;notes?:string;profile:Record<string,string>}
export const importFields=[['name','Nome'],['segment','Segmento'],['city','Cidade'],['region','Bairro / região'],['address','Endereço'],['whatsapp','WhatsApp'],['instagram','Instagram'],['website','Site'],['contact','Responsável do estabelecimento'],['contactInfo','Contato do responsável'],['origin','Origem'],['owner','Responsável Decifaz'],['needs','Necessidades a verificar'],['notes','Observações / evidências']] as const
export function parseCsv(text:string){
 const source=text.replace(/^\uFEFF/,'');const header=source.split(/\r?\n/,1)[0]
 const delimiter=([',',';','\t'].map(c=>[c,header.split(c).length] as const).sort((a,b)=>b[1]-a[1])[0][0])
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false
 for(let i=0;i<source.length;i++){
  const c=source[i]
  if(quoted){if(c==='"'){if(source[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
  if(c==='"'&&!value&&!closed){quoted=true;continue}
  if(c===delimiter){row.push(value);value='';closed=false;continue}
  if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';closed=false;continue}
  if(closed&&!/\s/.test(c))throw Error('Há texto fora de aspas. Corrija as aspas ou exporte novamente como CSV.')
  value+=c
 }
 if(quoted)throw Error('Há aspas sem fechamento no CSV.')
 row.push(value);if(row.some(v=>v.trim()))rows.push(row)
 if(rows.length<2)throw Error('Inclua cabeçalho e pelo menos uma linha de dados.')
 if(rows.length>1001)throw Error('Importe até 1000 linhas por arquivo. Divida o arquivo em lotes menores.')
 const columns=rows.shift()!.map(v=>v.trim());if(columns.some(v=>!v)||new Set(columns).size!==columns.length)throw Error('Use cabeçalhos preenchidos e únicos para mapear as colunas.')
 if(rows.some(r=>r.length!==columns.length))throw Error('Uma linha tem quantidade diferente de colunas. Confira separadores e campos entre aspas.')
 return {columns,rows}
}
export function mappedBody(row:string[],mapping:Record<string,string>):ImportBody{
 const body:ImportBody={name:'',profile:{}}
 for(const [field,column] of Object.entries(mapping)){if(column==='')continue;const value=(row[Number(column)]??'').trim();if(['name','segment','city','notes'].includes(field))Object.assign(body,{[field]:value});else body.profile[field]=value}
 return body
}
export async function importRowId(workspace:string,user:string,file:string,index:number){
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(workspace+'|'+user+'|'+file+'|'+index)))
 hash[6]=(hash[6]&15)|64;hash[8]=(hash[8]&63)|128;const hex=[...hash.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('')
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-')
}
