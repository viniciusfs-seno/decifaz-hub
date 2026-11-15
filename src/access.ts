export type Role='admin'|'commercial'|'operations'|'finance'
export type Module='commercial'|'projects'|'finance'
export function hasRole(roles:readonly Role[]|Role|undefined,role:Role){
 return roles===role||(typeof roles!=='string'&&roles?.includes(role)===true)
}
export function can(roles:readonly Role[]|Role|undefined,module:Module,write=false){
 if(!(['admin','commercial','operations','finance'] as const).some(role=>hasRole(roles,role)))return false
 if(hasRole(roles,'admin'))return true
 if(module==='finance')return hasRole(roles,'finance')
 return !write||hasRole(roles,module==='commercial'?'commercial':'operations')
}
