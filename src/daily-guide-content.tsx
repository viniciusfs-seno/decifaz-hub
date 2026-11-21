import {dailyGuide} from './daily-guide'
import {Disclosure} from './portal-patterns'
import {norm} from './domain'
type Block=typeof dailyGuide.blocks[number]
const intro:Block[]=[],sections:{title:string;blocks:Block[]}[]=[]
for(const block of dailyGuide.blocks){if(block.kind==='heading')sections.push({title:block.text??'',blocks:[]});else if(sections.length)sections.at(-1)!.blocks.push(block);else intro.push(block)}
export function DailyGuideContent({query=''}:{query?:string}){
 const term=norm(query.trim())
 return <>{intro.map((b,i)=><p key={i}>{b.text}</p>)}{sections.map((s,i)=>{const match=term.length>=3&&norm(s.title+' '+s.blocks.map(b=>b.text).join(' ')).includes(term);return <Disclosure key={s.title+String(match)} title={s.title} defaultOpen={i===0||match}>{s.blocks.map((b,j)=>b.kind==='bullet'?<p className="article-bullet" key={j}>{b.text}</p>:<p key={j}>{b.text}</p>)}</Disclosure>})}</>
}
