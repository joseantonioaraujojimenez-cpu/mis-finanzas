// Offline request contract. Not imported by the running Worker; no network or keys.
// The owner must approve the separate sandbox setup before any transport is connected.
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
export const PLANNED_CALLBACK='https://mis-finanzas-faceid-test.joseantonioaraurojimenez.workers.dev/bank/callback';
function requireId(value){if(typeof value!=='string'||!uuid.test(value))throw Error('Invalid provider identifier');return value;}
function requireDate(value){if(typeof value!=='string'||!date.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid date');return value;}
function spec(method,path,body){return Object.freeze({method,path,...(body===undefined?{}:{body})});}
export function authorizationSpec({state,now,validUntil}){
 requireId(state);
 if(!Number.isFinite(now)||!Number.isFinite(validUntil)||validUntil<=now||validUntil-now>86400000)throw Error('Invalid requested consent duration');
 return spec('POST','/auth',{access:{valid_until:new Date(validUntil).toISOString()},aspsp:{name:'BBVA',country:'ES'},state,redirect_url:PLANNED_CALLBACK,psu_type:'personal',language:'es'});
}
// Called only after the future server-side callback has consumed its one-time state.
export function exchangeSpec({code,state,expectedState,expires,now}){
 if(typeof state!=='string'||!uuid.test(state)||state!==expectedState||!Number.isFinite(now)||!Number.isFinite(expires)||expires<=now)throw Error('Invalid authorization state');
 if(typeof code!=='string'||!code.trim()||code.length>2048)throw Error('Invalid authorization code');
 return spec('POST','/sessions',{code});
}
export function sessionStatusSpec(sessionId){return spec('GET','/sessions/'+requireId(sessionId));}
export function revokeSessionSpec(sessionId){return spec('DELETE','/sessions/'+requireId(sessionId));}
function authorizedAccount(session,accountId,now){
 requireId(accountId);
 if(!session||session.status!=='AUTHORIZED'||!Number.isFinite(now)||!Number.isFinite(Date.parse(session.access?.valid_until))||Date.parse(session.access.valid_until)<=now||session.aspsp?.name!=='BBVA'||session.aspsp?.country!=='ES'||!Array.isArray(session.accounts)||!session.accounts.includes(accountId))throw Error('Account not authorized');
 return accountId;
}
export function balancesSpec(session,accountId,now){return spec('GET','/accounts/'+authorizedAccount(session,accountId,now)+'/balances');}
export function transactionsSpec(session,accountId,{from,to,continuation},now){
 const id=authorizedAccount(session,accountId,now);requireDate(from);requireDate(to);
 if(from>to||Date.parse(to)-Date.parse(from)>31*86400000)throw Error('Invalid transaction interval');
 const q=new URLSearchParams({date_from:from,date_to:to});
 if(continuation!==undefined){if(typeof continuation!=='string'||!continuation||continuation.length>2048)throw Error('Invalid continuation');q.set('continuation_key',continuation);}
 return spec('GET','/accounts/'+id+'/transactions?'+q.toString());
}
