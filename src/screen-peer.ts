// Only standardized browser APIs; no public relay SDK or media storage.
export const screenIce:RTCConfiguration={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]}
export async function gathered(peer:RTCPeerConnection){
 if(peer.iceGatheringState==='complete')return
 await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',changed);resolve()},changed=()=>{if(peer.iceGatheringState==='complete')done()},timer=setTimeout(done,6000);peer.addEventListener('icegatheringstatechange',changed)})
}
export function screenSecret(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export type ScreenViewer={id:string;name:string;state:'pending'|'approved'|'denied';answer:RTCSessionDescriptionInit|null;epoch:number|null;seen_at:string}
export type HostScreen={state:'open'|'ended';epoch:number;invite_until:string;ends_at:string;viewers:ScreenViewer[]}
