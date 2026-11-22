// Atomic state coordinator for the single-owner WebAuthn flow.
// All registration and challenge mutations must go through this Durable Object.
// Do not use KV get()+delete() for one-time challenges.
import { DurableObject } from 'cloudflare:workers';
import {transitionDemoConsent} from './demo-consent.js';
import {consumeOwnerState} from './bbva-owner-state.js';
import {issueRehearsalTicket,consumeRehearsalTicket,cancelRehearsalTicket} from './bbva-rehearsal-return.js';
import {liveAisEnabled,openLiveAisFlow} from './bbva-live-gate.js';
import {readVerifiedConsent} from './bbva-consent-vault.js';
import {readLiveReturnCookie} from './bbva-live-flow.js';
import {callbackSafetyCheck} from './bbva-production-readiness.js';
import {budgetPreferences,calculateBudgetProgress} from './finance-budget.js';

export class PasskeyCoordinator extends DurableObject {
 async fetch(request) {
  const path=new URL(request.url).pathname;
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  let input;
  try{input=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  const store=this.ctx.storage;
  const now=Date.now();
  if(path==='/finance/budget'){
   if(!liveAisEnabled(this.env))return Response.json({error:'Finance unavailable'},{status:403});
   try{return Response.json(await store.transaction(tx=>budgetPreferences(tx,{...input,now:Date.now()})));}catch{return Response.json({error:'Budget unavailable'},{status:400});}
  }
  if(['/bbva/live/start','/bbva/live/complete','/bbva/live/status','/bbva/live/read','/bbva/live/disconnect'].includes(path)){
   if(!liveAisEnabled(this.env))return Response.json({error:'Live AIS disabled'},{status:403});
   try{
    if(path==='/bbva/live/complete'){
     const ticket=readLiveReturnCookie(input.cookieHeader),parsed=callbackSafetyCheck(input.callbackUrl);
     if(!ticket||parsed.status!=='requires_authenticated_one_time_exchange')return Response.json({error:'Return unavailable'},{status:400});
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ticket))),b=>b.toString(16).padStart(2,'0')).join('');
     const binding=await store.get('bbva:ais:return:'+digest);
     if(!binding||binding.state!==parsed.state||binding.expiresAt<=Date.now())return Response.json({error:'Return unavailable'},{status:400});
     const flow=await openLiveAisFlow({env:this.env,storage:store,transport:fetch});
     return Response.json(await flow.complete({cookieHeader:input.cookieHeader,callbackUrl:input.callbackUrl}));
    }
    const token=input.token;
    if(typeof token!=='string'||token.length<32||token.length>256)return Response.json({error:'Owner authentication required'},{status:401});
    const authenticated=await store.transaction(async tx=>{const session=await tx.get('session:'+token),epoch=(await tx.get('session_epoch'))||0;return Boolean(session&&session.epoch===epoch&&session.expires>Date.now());});
    if(!authenticated)return Response.json({error:'Owner authentication required'},{status:401});
    const consent=await store.transaction(tx=>readVerifiedConsent(tx,{token,now:Date.now()}));
    if(path==='/bbva/live/status'){
     const stored=await store.get('bbva:ais:consent');
     return Response.json({consentStored:Boolean(consent),accountCount:consent?.accountIds.length||0,revocationPending:stored?.revoking===true});
    }
    const flow=await openLiveAisFlow({env:this.env,storage:store,transport:fetch});
    if(path==='/bbva/live/start')return Response.json(await flow.start({token}));
    if(path==='/bbva/live/disconnect')return Response.json(await flow.disconnect({token}));
    if(!consent||!Number.isInteger(input.accountIndex)||input.accountIndex<0||input.accountIndex>=consent.accountIds.length)return Response.json({error:'Account not authorized'},{status:403});
    const data=await flow.read({token,accountId:consent.accountIds[input.accountIndex],from:input.from,to:input.to,scope:input.scope});
    const {accountId,movements,...summary}=data;
    let budget=null;
    if(typeof input.from==='string'&&input.from.endsWith('-01')&&input.from.slice(0,7)===input.to?.slice(0,7)){
     const month=input.from.slice(0,7),[year,monthNumber]=month.split('-').map(Number),daysInMonth=new Date(Date.UTC(year,monthNumber,0)).getUTCDate(),daysElapsed=Number(input.to.slice(8));
     const preferences=await store.transaction(tx=>budgetPreferences(tx,{token,accountIndex:input.accountIndex,scope:input.scope,month,action:'get',now:Date.now()}));
     budget={...preferences,...calculateBudgetProgress({...preferences,expenseCents:data.expenseCents,incomeCents:data.incomeCents,daysElapsed,daysInMonth})};
    }
    return Response.json({...summary,budget,source:'bbva-ais',bankConnected:true,movements:movements.map(({accountId,id,...movement})=>movement)});
   }catch{return Response.json({error:'Live AIS unavailable'},{status:400});}
  }
  if(path==='/bbva/rehearsal/issue')return Response.json({ticket:await issueRehearsalTicket(store,input.token,now)});
  if(path==='/bbva/rehearsal/consume')return Response.json({verified:await consumeRehearsalTicket(store,input.ticket,now)});
  if(path==='/bbva/rehearsal/cancel')return Response.json({cancelled:await cancelRehearsalTicket(store,input.token)});
  // Internal AIS state operations only. No public Worker route calls these yet.
  // They must not be exposed until the caller is bound to an authenticated owner session.
  if(path==='/bbva/ais/state/save'){
   // The authenticated owner session must be live at the same atomic commit.
   // Only a digest is stored with the state, never the bearer token.
   if(typeof input.token!=='string'||input.token.length<32||input.token.length>256)
    return Response.json({saved:false},{status:403});
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.token))),b=>b.toString(16).padStart(2,'0')).join('');
   try{
    const saved=await store.transaction(async tx=>{
     const session=await tx.get('session:'+input.token),epoch=(await tx.get('session_epoch'))||0;
     if(!session||session.expires<=Date.now()||session.epoch!==epoch)return false;
     const record=input.record;
     if(!record||typeof record.state!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.state)||record.consumed!==false||!Number.isFinite(record.expiresAt)||record.expiresAt<=Date.now()||record.expiresAt>Date.now()+600000||record.callback!=='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback')return false;
     const key='bbva:ais:state:'+record.state;
     if(await tx.get(key))return false;
     await tx.put(key,{state:record.state,expiresAt:record.expiresAt,callback:record.callback,consumed:false,ownerSessionDigest:digest,ownerEpoch:epoch});
     return true;
    });
    return Response.json({saved});
   }catch{return Response.json({saved:false},{status:400});}
  }
  if(path==='/bbva/ais/state/consume'){
   // No exchange unless the SAME Face ID session remains valid.
   if(typeof input.token!=='string'||input.token.length<32||input.token.length>256)
    return Response.json({record:null},{status:403});
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.token))),b=>b.toString(16).padStart(2,'0')).join('');
   try{
    const record=await store.transaction(async tx=>consumeOwnerState(tx,{state:input.state,token:input.token,digest,now:Date.now()}));
    return Response.json({record});
   }catch{return Response.json({record:null},{status:400});}
  }
  if(path==='/health/check'){
   return Response.json({ok:true});
  }
  if(path==='/rate/check'){
   const action=input.action;
   if(!['register','login'].includes(action))return Response.json({error:'Invalid action'},{status:400});
   const limit=action==='register'?5:12;
   const windowMs=action==='register'?900000:300000;
   const key='rate:'+action;
   const allowed=await store.transaction(async tx=>{
    const previous=await tx.get(key);
    const record=previous&&previous.until>now?previous:{count:0,until:now+windowMs};
    if(record.count>=limit)return false;
    record.count+=1;
    await tx.put(key,record);
    return true;
   });
   return Response.json({allowed});
  }
  if(path==='/challenge/create'){
   if(!['register','login'].includes(input.kind) || typeof input.challenge!=='string' || input.challenge.length<16 || input.challenge.length>1024)
    return Response.json({error:'Invalid challenge'},{status:400});
   const id=crypto.randomUUID();
   await store.put('challenge:'+id,{kind:input.kind,challenge:input.challenge,expires:now+300000});
   return Response.json({id});
  }
  if(path==='/challenge/consume'){
   if(typeof input.id!=='string'||input.id.length>128||!['register','login'].includes(input.kind))
    return Response.json({error:'Invalid request'},{status:400});
   const result=await store.transaction(async tx=>{
    const key='challenge:'+input.id;
    const item=await tx.get(key);
    if(!item)return null;
    await tx.delete(key);
    if(item.kind!==input.kind||item.expires<=Date.now())return null;
    return item.challenge;
   });
   return Response.json({challenge:result});
  }
  if(path==='/credential/get'){
   const result=await store.transaction(async tx=>({credential:(await tx.get('owner_credential'))||null,epoch:(await tx.get('session_epoch'))||0}));
   return Response.json(result);
  }
  if(path==='/credential/enroll'){
   // First-writer-wins. A fresh bootstrap secret is still required at the Worker layer.
   if(!input.credential || typeof input.credential.id!=='string' || input.credential.id.length<1 || input.credential.id.length>1024 || !Array.isArray(input.credential.publicKey) || input.credential.publicKey.length<32 || input.credential.publicKey.length>4096 || !input.credential.publicKey.every(x=>Number.isInteger(x)&&x>=0&&x<=255) || !Number.isSafeInteger(input.credential.counter) || input.credential.counter<0 || (input.credential.transports!==undefined && (!Array.isArray(input.credential.transports) || input.credential.transports.length>8 || !input.credential.transports.every(x=>typeof x==='string' && ['ble','hybrid','internal','nfc','usb','smart-card'].includes(x)))))
    return Response.json({error:'Invalid credential'},{status:400});
   const enrolled=await store.transaction(async tx=>{
    if(await tx.get('owner_credential'))return false;
    await tx.put('owner_credential',input.credential);
    return true;
   });
   return Response.json({enrolled});
  }
  if(path==='/credential/counter'){
   const updated=await store.transaction(async tx=>{
    const c=await tx.get('owner_credential');
    if(!c||c.id!==input.id||!Number.isSafeInteger(input.counter)||input.counter<0)return false;
    // Zero counters are allowed for authenticators that do not support counters.
    if(c.counter>0&&input.counter<=c.counter)return false;
    c.counter=input.counter;
    await tx.put('owner_credential',c);
    return true;
   });
   return Response.json({updated});
  }
  // Internal-only recovery-code primitives. No public recovery routes are enabled.
  // The Worker must generate a high-entropy code and SHA-256 digest; plaintext is never stored.
  if(path==='/recovery/store'){
   if(typeof input.digest!=='string'||!/^[a-f0-9]{64}$/.test(input.digest))
    return Response.json({error:'Invalid recovery digest'},{status:400});
   const stored=await store.transaction(async tx=>{
    if(await tx.get('recovery_digest'))return false;
    await tx.put('recovery_digest',{digest:input.digest,created:Date.now()});
    return true;
   });
   return Response.json({stored});
  }
  // Internal recovery phase 1: validate the code without consuming it.
  // A short-lived random ticket binds the eventual replacement to this attempt.
  if(path==='/recovery/prepare'){
   if(typeof input.digest!=='string'||!/^[a-f0-9]{64}$/.test(input.digest))
    return Response.json({prepared:false,limited:false});
   const result=await store.transaction(async tx=>{
    const rateKey='recovery_attempts', previous=await tx.get(rateKey);
    const rate=previous&&previous.until>Date.now()?previous:{count:0,until:Date.now()+900000};
    if(rate.count>=5)return {prepared:false,limited:true};
    rate.count++;
    await tx.put(rateKey,rate);
    const current=await tx.get('recovery_digest');
    if(!current)return {prepared:false,limited:false};
    let diff=0;
    for(let i=0;i<64;i++)diff|=current.digest.charCodeAt(i)^input.digest.charCodeAt(i);
    if(diff!==0)return {prepared:false,limited:false};
    const ticket=crypto.randomUUID()+crypto.randomUUID();
    await tx.delete('recovery_challenge');
    await tx.delete('recovery_challenge_consumed');
    await tx.put('recovery_ticket',{ticket,expires:Date.now()+300000,digest:current.digest});
    return {prepared:true,limited:false,ticket};
   });
   return Response.json(result);
  }
  // Recovery-specific WebAuthn challenge bound to the active recovery ticket.
  // This is an internal primitive; the Worker must verify the signed response.
  if(path==='/recovery/challenge/create'){
   if(typeof input.ticket!=='string'||typeof input.challenge!=='string'||input.challenge.length<16||input.challenge.length>1024)
    return Response.json({created:false});
   const created=await store.transaction(async tx=>{
    const pending=await tx.get('recovery_ticket');
    if(!pending||pending.ticket!==input.ticket||pending.expires<=Date.now())return false;
    // A consumed challenge cannot be reset to allow a second replacement attempt.
    if(await tx.get('recovery_challenge_consumed'))return false;
    if(await tx.get('recovery_challenge'))return false;
    await tx.put('recovery_challenge',{ticket:input.ticket,challenge:input.challenge,expires:Math.min(pending.expires,Date.now()+300000)});
    return true;
   });
   return Response.json({created});
  }
  if(path==='/recovery/challenge/consume'){
   if(typeof input.ticket!=='string')return Response.json({challenge:null});
   const challenge=await store.transaction(async tx=>{
    const pending=await tx.get('recovery_ticket'),item=await tx.get('recovery_challenge');
    if(!pending||!item||pending.ticket!==input.ticket||item.ticket!==input.ticket||pending.expires<=Date.now()||item.expires<=Date.now())return null;
    await tx.delete('recovery_challenge');
    await tx.put('recovery_challenge_consumed',{ticket:input.ticket,expires:item.expires});
    return item.challenge;
   });
   return Response.json({challenge});
  }
  // Internal recovery phase 2: called ONLY after successful WebAuthn verification
  // by the Worker. One transaction replaces the credential, invalidates all
  // existing sessions, and burns the recovery code and ticket together.
  if(path==='/recovery/finalize'){
   const c=input.credential;
   if(typeof input.ticket!=='string'||input.ticket.length!==72||!c||typeof c.id!=='string'||c.id.length<1||c.id.length>1024||!Array.isArray(c.publicKey)||c.publicKey.length<32||c.publicKey.length>4096||!c.publicKey.every(x=>Number.isInteger(x)&&x>=0&&x<=255)||!Number.isSafeInteger(c.counter)||c.counter<0||(c.transports!==undefined&&(!Array.isArray(c.transports)||c.transports.length>8||!c.transports.every(x=>typeof x==='string'&&['ble','hybrid','internal','nfc','usb','smart-card'].includes(x)))))
    return Response.json({replaced:false});
   const replaced=await store.transaction(async tx=>{
    const pending=await tx.get('recovery_ticket');
    const current=await tx.get('recovery_digest');
    const consumed=await tx.get('recovery_challenge_consumed');
    if(!pending||!current||!consumed||pending.expires<=Date.now()||consumed.expires<=Date.now()||consumed.ticket!==input.ticket||pending.ticket!==input.ticket||pending.digest!==current.digest)return false;
    await tx.put('owner_credential',c);
    await tx.put('session_epoch',((await tx.get('session_epoch'))||0)+1);
    await tx.delete('recovery_digest');
    await tx.delete('recovery_ticket');
    await tx.delete('recovery_challenge');
    await tx.delete('recovery_challenge_consumed');
    await tx.delete('recovery_attempts');
    return true;
   });
   return Response.json({replaced});
  }
  if(path==='/session/authenticate'){
   const token=crypto.randomUUID()+crypto.randomUUID();
   const accepted=await store.transaction(async tx=>{
    const c=await tx.get('owner_credential'),epoch=(await tx.get('session_epoch'))||0;
    if(!c||epoch!==input.epoch||c.id!==input.id||c.counter!==input.previousCounter||!Number.isSafeInteger(input.counter)||input.counter<0)return false;
    if(c.counter>0&&input.counter<=c.counter)return false;
    c.counter=input.counter;
    await tx.put('owner_credential',c);
    await tx.put('session:'+token,{expires:Date.now()+900000,epoch});
    return true;
   });
   return Response.json({token:accepted?token:null});
  }
  if(path==='/session/create'){
   const token=crypto.randomUUID()+crypto.randomUUID();
   // Creating a session and reading its epoch must be atomic with global revocation.
   await store.transaction(async tx=>{
    const epoch=(await tx.get('session_epoch'))||0;
    await tx.put('session:'+token,{expires:now+900000,epoch});
   });
   return Response.json({token,expiresIn:900});
  }
  if(path==='/session/revoke-all'){
   // Incrementing the epoch invalidates every existing session, including
   // sessions created on other devices, without enumerating storage keys.
   const epoch=await store.transaction(async tx=>{
    const next=((await tx.get('session_epoch'))||0)+1;
    await tx.put('session_epoch',next);
    return next;
   });
   return Response.json({revokedAll:true,epoch});
  }
  if(path==='/session/revoke'){
   if(typeof input.token!=='string'||input.token.length>256)return Response.json({revoked:false});
   await store.delete('session:'+input.token);
   return Response.json({revoked:true});
  }
  if(path==='/session/validate'){
   if(typeof input.token!=='string'||input.token.length>256)return Response.json({valid:false});
   const key='session:'+input.token;
   // Validate expiry and the global revocation epoch in one transaction.
   const valid=await store.transaction(async tx=>{
    const record=await tx.get(key);
    if(record&&record.expires<=Date.now()){
     await tx.delete(key);
     return false;
    }
    const epoch=(await tx.get('session_epoch'))||0;
    return Boolean(record)&&record.epoch===epoch;
   });
   return Response.json({valid});
  }
  if(path==='/demo/consent'){
   if(typeof input.token!=='string'||input.token.length>256||!['status','grant','revoke','sync'].includes(input.action))return Response.json({authorized:false});
   const result=await store.transaction(async tx=>{
    const session=await tx.get('session:'+input.token),epoch=(await tx.get('session_epoch'))||0,now=Date.now();
    if(!session||session.expires<=now||session.epoch!==epoch)return {authorized:false};
    const key='demo_consent';const previous=await tx.get(key);
    const {record,result}=transitionDemoConsent(previous,input.action,now);
    if(record)await tx.put(key,record);else if(previous)await tx.delete(key);
    return {authorized:true,...result};
   });
   return Response.json(result);
  }
  return Response.json({error:'Not found'},{status:404});
 }
}
