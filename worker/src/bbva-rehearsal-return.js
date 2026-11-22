// Isolated rehearsal only. This ticket is not an authentication credential
// for normal API routes and does not authorize any bank operation.
const COOKIE='__Secure-mf-ais-rehearsal';
export const RETURN_PATH='/bank/rehearsal-return';
const HEX=/^[a-f0-9]{64}$/;
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const live=(session,epoch,now)=>session&&Number.isFinite(session.expires)&&session.expires>now&&session.epoch===epoch;
export async function issueRehearsalTicket(storage,token,now=Date.now()){
 if(typeof token!=='string'||token.length<32||token.length>256)return null;
 const ticket=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const key='bbva:rehearsal:'+await digest(ticket);
 return storage.transaction(async tx=>{
  const session=await tx.get('session:'+token),epoch=(await tx.get('session_epoch'))||0;
  if(!live(session,epoch,now))return null;
  const pointer='bbva:rehearsal:active:'+token;
  const previous=await tx.get(pointer);if(previous)await tx.delete(previous);
  await tx.put(key,{sessionKey:'session:'+token,pointer,epoch,expiresAt:Math.min(session.expires,now+120000)});
  await tx.put(pointer,key);
  return ticket;
 });
}
export async function consumeRehearsalTicket(storage,ticket,now=Date.now()){
 if(typeof ticket!=='string'||!HEX.test(ticket))return false;
 const key='bbva:rehearsal:'+await digest(ticket);
 return storage.transaction(async tx=>{
  const record=await tx.get(key);if(!record)return false;
  await tx.delete(key);
  if(await tx.get(record.pointer)!==key)return false;
  await tx.delete(record.pointer);
  const epoch=(await tx.get('session_epoch'))||0;
  return record.epoch===epoch&&record.expiresAt>now&&Boolean(live(await tx.get(record.sessionKey),epoch,now));
 });
}
export async function cancelRehearsalTicket(storage,token){
 if(typeof token!=='string'||token.length<32||token.length>256)return false;
 return storage.transaction(async tx=>{
  const pointer='bbva:rehearsal:active:'+token,key=await tx.get(pointer);
  if(key)await tx.delete(key);
  await tx.delete(pointer);return true;
 });
}
export function rehearsalCookie(ticket){
 if(ticket!==null&&!HEX.test(ticket))throw Error('Invalid rehearsal ticket');
 return `${COOKIE}=${ticket||''}; Path=${RETURN_PATH}; Max-Age=${ticket?120:0}; Secure; HttpOnly; SameSite=Lax`;
}
export function readRehearsalCookie(header){
 if(typeof header!=='string'||header.length>8192)return null;
 const values=header.split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
 if(values.length!==1)return null;
 const value=values[0].slice(COOKIE.length+1);
 return HEX.test(value)?value:null;
}
export function rehearsalLanding(verified){
 const message=verified?'Retorno de ensayo verificado. La sesión original sigue activa en el servidor.':'Retorno de ensayo no disponible o caducado.';
 return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MIS FINANZAS · Ensayo</title><h1>Ensayo de retorno</h1><p>${message}</p><p>No se ha conectado ningún banco.</p><a href="/face-id">Volver e iniciar sesión con Face ID</a></html>`,{status:verified?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",'Set-Cookie':rehearsalCookie(null)}});
}
