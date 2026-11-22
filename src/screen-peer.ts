// Only standardized browser APIs; no public relay SDK or media storage.
import type {SupabaseClient} from '@supabase/supabase-js'
export const screenIce:RTCConfiguration={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]}
export async function screenConfiguration(client:SupabaseClient,args:{s:string;credential?:string;viewer?:string}):Promise<{config:RTCConfiguration;relay:boolean}>{
 try{
  const {data,error}=await client.functions.invoke('hub-screen-ice',{body:args,signal:AbortSignal.timeout(8000)})
  if(!error&&Array.isArray(data?.iceServers)&&data.iceServers.length)return {config:{iceServers:data.iceServers},relay:true}
 }catch{/* Optional relay unavailable: direct ICE and external call remain available. */}
 return {config:screenIce,relay:false}
}
export function screenSecret(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export function screenDescription(peer:RTCPeerConnection){const d=peer.localDescription;if(!d)throw Error('Negociação indisponível');return {type:d.type,sdp:d.sdp.split('\r\n').filter(line=>!line.startsWith('a=candidate:')&&!line.startsWith('a=end-of-candidates')).join('\r\n')}}
export async function receiveIce(peer:RTCPeerConnection,candidates:RTCIceCandidateInit[],seen:Set<string>){if(!peer.remoteDescription)return;for(const candidate of candidates){const key=JSON.stringify(candidate);if(seen.has(key))continue;try{await peer.addIceCandidate(candidate);seen.add(key)}catch{/* An unusable individual route must not discard later viable routes. */}}}
export type ScreenViewer={id:string;name:string;state:'pending'|'approved'|'denied';answer:RTCSessionDescriptionInit|null;candidates:RTCIceCandidateInit[];epoch:number|null;seen_at:string}
export type HostScreen={state:'open'|'ended';epoch:number;invite_until:string;ends_at:string;viewers:ScreenViewer[]}
