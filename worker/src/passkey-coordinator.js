// Atomic state coordinator for the single-owner WebAuthn flow.
// All registration and challenge mutations must go through this Durable Object.
// Do not use KV get()+delete() for one-time challenges.
import { DurableObject } from 'cloudflare:workers';

export class PasskeyCoordinator extends DurableObject {
 async fetch(request) {
  const path=new URL(request.url).pathname;
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  let input;
  try{input=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  const store=this.ctx.storage;
  const now=Date.now();
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
   if(!['register','login'].includes(input.kind) || typeof input.challenge!=='string')
    return Response.json({error:'Invalid challenge'},{status:400});
   const id=crypto.randomUUID();
   await store.put('challenge:'+id,{kind:input.kind,challenge:input.challenge,expires:now+300000});
   return Response.json({id});
  }
  if(path==='/challenge/consume'){
   if(typeof input.id!=='string'||!['register','login'].includes(input.kind))
    return Response.json({error:'Invalid request'},{status:400});
   const result=await store.transaction(async tx=>{
    const key='challenge:'+input.id;
    const item=await tx.get(key);
    if(!item||item.kind!==input.kind||item.expires<Date.now())return null;
    await tx.delete(key);
    return item.challenge;
   });
   return Response.json({challenge:result});
  }
  if(path==='/credential/get'){
   const credential=await store.get('owner_credential');
   return Response.json({credential:credential||null});
  }
  if(path==='/credential/enroll'){
   // First-writer-wins. A fresh bootstrap secret is still required at the Worker layer.
   if(!input.credential || typeof input.credential.id!=='string')
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
  if(path==='/session/create'){
   const token=crypto.randomUUID()+crypto.randomUUID();
   await store.put('session:'+token,{expires:now+900000});
   return Response.json({token,expiresIn:900});
  }
  if(path==='/session/revoke'){
   if(typeof input.token!=='string'||input.token.length>256)return Response.json({revoked:false});
   await store.delete('session:'+input.token);
   return Response.json({revoked:true});
  }
  if(path==='/session/validate'){
   if(typeof input.token!=='string')return Response.json({valid:false});
   const record=await store.get('session:'+input.token);
   return Response.json({valid:Boolean(record&&record.expires>now)});
  }
  return Response.json({error:'Not found'},{status:404});
 }
}
