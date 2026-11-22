// Internal-only authorization state transition. Called inside a durable transaction.
export async function consumeOwnerState(tx,{state,token,digest,now}){
 if(typeof state!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(state))return null;
 const key='bbva:ais:state:'+state,stored=await tx.get(key);
 if(!stored||stored.consumed!==false)return null;
 const session=await tx.get('session:'+token),epoch=(await tx.get('session_epoch'))||0;
 if(!session||session.expires<=now||session.epoch!==epoch||stored.ownerEpoch!==epoch||stored.ownerSessionDigest!==digest)return null;
 if(stored.state!==state||stored.callback!=='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback'||!Number.isFinite(stored.expiresAt))return null;
 await tx.put(key,{state,consumed:true,expiresAt:stored.expiresAt});
 if(stored.expiresAt<=now)return null;
 // A short-lived server-only receipt allows the later verified provider
 // result to be associated with this exact owner session, once.
 await tx.put('bbva:ais:receipt:'+state,{ownerSessionDigest:digest,ownerEpoch:epoch,expiresAt:stored.expiresAt});
 return {state,expiresAt:stored.expiresAt,callback:stored.callback};
}
