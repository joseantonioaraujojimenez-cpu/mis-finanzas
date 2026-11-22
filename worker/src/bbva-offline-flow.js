// Integration boundary for the offline AIS workflow. No public routes, no
// default transport, no production credentials. All persistence is transactional.
import {prepareAuthorization,verifyCallback} from './bbva-authorization-preflight.js';
import {requestMockableAuthorization,exchangeMockableCallback} from './bbva-ais-offline-transport.js';
import {consumeOwnerState} from './bbva-owner-state.js';
import {commitVerifiedConsent,readVerifiedConsent} from './bbva-consent-vault.js';
import {sessionStatusSpec} from './enable-banking-contract.js';
import {readMockableAccountSnapshot} from './bbva-ais-offline-read.js';
import {BankReadError,providerReadError} from './bbva-read-errors.js';
const API='https://api.enablebanking.com';
async function digestToken(token){
 if(typeof token!=='string'||token.length<32||token.length>256)throw Error('Owner authentication required');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
}
export function createOfflineAisFlow({storage,transport,jwt,clock,bindBrowserReturn=false}){
 if(typeof storage?.transaction!=='function'||typeof transport!=='function'||typeof jwt!=='string'||!jwt||typeof clock!=='function')throw Error('Offline AIS configuration required');
 const tx=fn=>storage.transaction(fn);
 async function verifySession(sessionId){
  const spec=sessionStatusSpec(sessionId);
  const response=await transport(API+spec.path,{method:'GET',redirect:'manual',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'}});
  if(!response||response.ok!==true||response.status!==200||typeof response.json!=='function')throw await providerReadError(response);
  const type=response.headers?.get?.('content-type');
  if(type!=null&&!/^application\/json(?:;|$)/i.test(type))throw Error('Unexpected session response');
  const body=await response.json();
  return {...body,sessionId};
 }
 async function finish({token,digest,state,record,callbackUrl}){
  if(!record)throw Error('Authorization unavailable');
  const {sessionId}=await exchangeMockableCallback({callbackUrl,record:{...record,consumed:true},now:clock(),transport,jwt});
  const provider=await verifySession(sessionId);
  const committed=await tx(t=>commitVerifiedConsent(t,{state,token,digest,provider,now:clock()}));
  if(!committed)throw Error('Consent could not be verified');
  return {source:'offline-test',bankConnected:false,consentVerified:true,accountCount:provider.accounts.length};
 }
 return Object.freeze({
  async begin({token}){
   const digest=await digestToken(token),state=crypto.randomUUID(),now=clock(),validUntil=now+86400000;
   const {record}=prepareAuthorization({state,now,validUntil});
   const ticket=bindBrowserReturn?Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''):null;
   const ticketKey=ticket?'bbva:ais:return:'+await digestToken(ticket):null;
   const saved=await tx(async t=>{
    const session=await t.get('session:'+token),epoch=(await t.get('session_epoch'))||0;
    const existing=await t.get('bbva:ais:consent');
    if(!session||session.epoch!==epoch||session.expires<=clock()||(existing?.ownerEpoch===epoch&&(existing.revoking===true||existing.expiresAt>clock())))return false;
    const key='bbva:ais:state:'+state;if(await t.get(key))return false;
    await t.put(key,{...record,ownerSessionDigest:digest,ownerEpoch:epoch});
    if(ticketKey){
     const pointer='bbva:ais:return-active:'+digest,previous=await t.get(pointer);
     if(previous)await t.delete(previous);
     await t.put(ticketKey,{state,token,digest,epoch,expiresAt:Math.min(record.expiresAt,session.expires),pointer});
     await t.put(pointer,ticketKey);
    }
    return true;
   });
   if(!saved)throw Error('Owner authentication or consent unavailable');
   const result=await requestMockableAuthorization({state,now,validUntil,transport,jwt});
   return {authorizationUrl:result.authorizationUrl,...(ticket?{returnTicket:ticket}:{})};
  },
  async complete({token,callbackUrl}){
   if(bindBrowserReturn)throw Error('Browser return required');
   const digest=await digestToken(token),url=new URL(callbackUrl),state=url.searchParams.get('state');
   const record=await tx(async t=>{
    const saved=await t.get('bbva:ais:state:'+state);
    // Check callback syntax before consuming, then atomically verify ownership.
    verifyCallback({callbackUrl,record:saved,now:clock()});
    return consumeOwnerState(t,{state,token,digest,now:clock()});
   });
   return finish({token,digest,state,record,callbackUrl});
  },
  async completeFromReturn({ticket,callbackUrl}){
   if(!bindBrowserReturn||typeof ticket!=='string'||!/^[a-f0-9]{64}$/.test(ticket))throw Error('Browser return unavailable');
   const key='bbva:ais:return:'+await digestToken(ticket),state=new URL(callbackUrl).searchParams.get('state');
   const consumed=await tx(async t=>{
    const binding=await t.get(key);
    if(!binding||binding.state!==state||binding.expiresAt<=clock()||await t.get(binding.pointer)!==key)return null;
    const saved=await t.get('bbva:ais:state:'+state);
    verifyCallback({callbackUrl,record:saved,now:clock()});
    const record=await consumeOwnerState(t,{state,token:binding.token,digest:binding.digest,now:clock()});
    if(!record)return null;
    await t.delete(key);await t.delete(binding.pointer);
    return {record,token:binding.token,digest:binding.digest};
   });
   if(!consumed)throw Error('Browser return unavailable');
   return finish({...consumed,state,callbackUrl});
  },
  async read({token,accountId,from,to,scope}){
   await digestToken(token);
   const getConsent=()=>tx(t=>readVerifiedConsent(t,{token,now:clock()}));
   const original=await getConsent();
   if(!original||!original.accountIds.includes(accountId))throw Error('Account not authorized');
   const provider=await verifySession(original.sessionId);
   if(provider.status!=='AUTHORIZED'||Date.parse(provider.access?.valid_until)<=clock())throw new BankReadError('BANK_CONSENT');
   const guardedTransport=async(url,init)=>{
    const current=await getConsent();
    if(!current||current.sessionId!==original.sessionId||!current.accountIds.includes(accountId))throw Error('Consent no longer active');
    return transport(url,init);
   };
   const snapshot=await readMockableAccountSnapshot({session:provider,accountId,from,to,scope,transport:guardedTransport,jwt,clock});
   const current=await getConsent();
   if(!current||current.sessionId!==original.sessionId||!current.accountIds.includes(accountId))throw Error('Consent no longer active');
   return snapshot;
  }
 });
}
