// Offline server-side consent storage primitives. No public routes or fetch.
// The provider session must be verified by the caller before committing.
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const KEY='bbva:ais:consent';
const validId=value=>typeof value==='string'&&UUID.test(value);
async function liveOwner(tx,token,now){
 if(typeof token!=='string'||!token||!Number.isFinite(now))return null;
 const session=await tx.get('session:'+token),epoch=(await tx.get('session_epoch'))||0;
 return session&&Number.isFinite(session.expires)&&session.expires>now&&session.epoch===epoch?{epoch}:null;
}
function normalizeVerifiedSession(provider,now){
 if(!provider||!validId(provider.sessionId)||provider.status!=='AUTHORIZED'||provider.aspsp?.name!=='BBVA'||provider.aspsp?.country!=='ES')return null;
 const expiresAt=Date.parse(provider.access?.valid_until);
 if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+86400000||!Array.isArray(provider.accounts)||provider.accounts.length<1||provider.accounts.length>50||!provider.accounts.every(validId)||new Set(provider.accounts).size!==provider.accounts.length)return null;
 return {sessionId:provider.sessionId,expiresAt,accountIds:[...provider.accounts]};
}
export async function commitVerifiedConsent(tx,{state,token,digest,provider,now}){
 if(!validId(state)||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))return false;
 const owner=await liveOwner(tx,token,now),receiptKey='bbva:ais:receipt:'+state,receipt=await tx.get(receiptKey);
 if(!owner||!receipt||receipt.ownerEpoch!==owner.epoch||receipt.ownerSessionDigest!==digest||!Number.isFinite(receipt.expiresAt)||receipt.expiresAt<=now)return false;
 const normalized=normalizeVerifiedSession(provider,now);
 if(!normalized)return false;
 // Never silently replace an active consent. Disconnect first.
 const current=await tx.get(KEY);
 if(current&&current.ownerEpoch===owner.epoch&&(current.revoking===true||current.expiresAt>now))return false;
 await tx.put(KEY,{...normalized,ownerEpoch:owner.epoch});
 await tx.delete(receiptKey);
 return true;
}
// This return value is server-internal only. Do not serialize to a browser.
export async function readVerifiedConsent(tx,{token,now}){
 const owner=await liveOwner(tx,token,now),stored=await tx.get(KEY);
 if(!owner||!stored||stored.revoking===true||stored.ownerEpoch!==owner.epoch||!Number.isFinite(stored.expiresAt)||stored.expiresAt<=now)return null;
 return {sessionId:stored.sessionId,expiresAt:stored.expiresAt,accountIds:[...stored.accountIds]};
}
export async function beginConsentRevocation(tx,{token,now}){
 const owner=await liveOwner(tx,token,now),stored=await tx.get(KEY);
 if(!owner||!stored||stored.ownerEpoch!==owner.epoch||!validId(stored.sessionId))return null;
 await tx.put(KEY,{...stored,revoking:true});
 return stored.sessionId;
}
export async function finishConsentRevocation(tx,{sessionId}){
 const stored=await tx.get(KEY);
 if(!stored||stored.revoking!==true||stored.sessionId!==sessionId)return false;
 await tx.delete(KEY);return true;
}
// Local disconnect only; provider revocation requires a separate verified call.
export async function clearVerifiedConsent(tx,{token,now}){
 if(!await liveOwner(tx,token,now))return false;
 await tx.delete(KEY);
 return true;
}
