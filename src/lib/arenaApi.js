import { getAuthToken } from './api.js'
export const arenaKey = t => {try{return localStorage.getItem('sharpai_arena_'+t)||''}catch{return ''}}
export function saveArenaKey(t,k){localStorage.setItem('sharpai_arena_'+t,k)}
export async function arenaRequest(path,body,key=''){
 const headers={'Content-Type':'application/json'};if(key)headers['x-arena-key']=key;const auth=getAuthToken();if(auth)headers.authorization='Bearer '+auth
 const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not reach arena server.');return j
}
export async function streamArena(token,key,onState,signal){
 const headers={'Content-Type':'application/json','x-arena-key':key};const auth=getAuthToken();if(auth)headers.authorization='Bearer '+auth
 const r=await fetch('/api/arenas/'+token+'/stream',{method:'POST',headers,body:'{}',signal});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Live connection unavailable.')}
 const reader=r.body.getReader(),decoder=new TextDecoder();let buf=''
 try{while(true){const {done,value}=await reader.read();if(done)throw Error('Live connection closed.');buf+=decoder.decode(value,{stream:true});let end;while((end=buf.indexOf('\n\n'))>=0){const chunk=buf.slice(0,end);buf=buf.slice(end+2);if(chunk.startsWith('data: '))onState(JSON.parse(chunk.slice(6)))}}}finally{reader.releaseLock()}
}
export async function downloadArena(token,key){const r=await fetch('/api/arenas/'+token+'/card.png',{headers:{'x-arena-key':key}});if(!r.ok){const j=await r.json();throw Error(j.error)}const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='sharpai-arena-result.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
