// Complete snapshots for dashboards, reports and record pickers. Every batch is
// ordered by a unique key by its caller; PostgREST's row cap must not truncate totals.
export async function allRows<T>(query:{range:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>}):Promise<{data:T[]|null;error:unknown}>{
 const rows:T[]=[]
 for(let from=0;;from+=500){const r=await query.range(from,from+499);if(r.error||!r.data)return {data:null,error:r.error??Error('Resposta incompleta')};rows.push(...r.data);if(r.data.length<500)return {data:rows,error:null}}
}
