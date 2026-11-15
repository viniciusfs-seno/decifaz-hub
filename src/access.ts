export type Role='admin'|'commercial'|'operations'|'finance'
export type Module='commercial'|'projects'|'finance'
export function can(role:Role|undefined,module:Module,write=false){
 if(!role)return false
 if(module==='finance')return role==='admin'||role==='finance'
 return !write||role==='admin'||role===(module==='commercial'?'commercial':'operations')
}
