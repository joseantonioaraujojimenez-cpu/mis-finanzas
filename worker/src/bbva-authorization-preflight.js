// Offline, fail-closed preparation for an AIS-only authorization callback.
// Not imported by public Worker routes. No bank requests are made here.
import {PLANNED_CALLBACK,authorizationSpec,exchangeSpec} from './enable-banking-contract.js';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function prepareAuthorization({state,now=Date.now(),validUntil}){
 if(typeof state!=='string'||!UUID.test(state))throw new Error('Invalid authorization state');
 const request=authorizationSpec({state,now,validUntil});
 return Object.freeze({request,record:Object.freeze({state,createdAt:now,expiresAt:Math.min(now+600000,validUntil),consumed:false,callback:PLANNED_CALLBACK})});
}
export function verifyCallback({callbackUrl,record,now=Date.now()}){
 if(!record||record.consumed||!Number.isFinite(record.expiresAt)||now>=record.expiresAt)throw new Error('Authorization expired or consumed');
 const url=new URL(callbackUrl);
 const expected=new URL(PLANNED_CALLBACK);
 if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.hash||url.username||url.password)throw new Error('Unexpected callback');
 if(url.searchParams.has('error'))throw new Error('Bank authorization rejected');
 if(url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1)throw new Error('Invalid callback parameters');
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');
 if(state!==record.state||!code||code.length>2048)throw new Error('Invalid callback state or code');
 return exchangeSpec({code,state,expectedState:record.state,expires:record.expiresAt,now});
}
// The server-side coordinator must atomically consume the stored state BEFORE exchange.
// This helper deliberately does not mutate the record or perform the exchange.
