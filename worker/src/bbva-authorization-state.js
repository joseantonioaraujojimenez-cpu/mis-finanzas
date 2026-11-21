// Internal-only one-time AIS authorization state lifecycle.
// Storage is injected for offline tests. This is not exposed as an HTTP endpoint.
// A production integration must use a transactional durable store and bind the
// state to the authenticated owner's session before enabling any callback.
export async function consumeAuthorizationState({storage,state,now=Date.now()}){
 if(!storage||typeof storage.transaction!=='function')throw new Error('Transactional storage required');
 if(typeof state!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(state))return null;
 return storage.transaction(async tx=>{
  const key='bbva:ais:state:'+state;
  const record=await tx.get(key);
  if(!record)return null;
  await tx.delete(key); // Burn even expired/invalid attempts.
  if(record.state!==state||record.consumed!==false||!Number.isFinite(record.expiresAt)||record.expiresAt<=now||record.callback!=='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback')return null;
  return {state:record.state,expiresAt:record.expiresAt,callback:record.callback};
 });
}
export async function saveAuthorizationState({storage,record,now=Date.now()}){
 if(!storage||typeof storage.transaction!=='function')throw new Error('Transactional storage required');
 if(!record||typeof record.state!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.state)||record.consumed!==false||!Number.isFinite(record.expiresAt)||record.expiresAt<=now||record.expiresAt>now+600000||record.callback!=='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback')throw new Error('Invalid AIS state');
 return storage.transaction(async tx=>{
  const key='bbva:ais:state:'+record.state;
  if(await tx.get(key))return false;
  await tx.put(key,{state:record.state,expiresAt:record.expiresAt,callback:record.callback,consumed:false});
  return true;
 });
}
