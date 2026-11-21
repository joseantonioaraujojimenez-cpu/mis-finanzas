// Strictly offline AIS authorization orchestration.
// Transport must be explicitly injected by tests; never defaults to fetch.
// This module is not wired to any public Worker route.
import {prepareAuthorization,verifyCallback} from './bbva-authorization-preflight.js';
const API='https://api.enablebanking.com';
function safeResponse(response,label){
 if(!response||response.ok!==true||response.status!==200||typeof response.json!=='function')throw Error(label+' rejected');
 const type=response.headers?.get?.('content-type');
 if(type!==undefined&&type!==null&&!/^application\/json(?:;|$)/i.test(type))throw Error(label+' returned unexpected content');
 return response;
}
export async function requestMockableAuthorization({state,now,validUntil,transport,jwt}){
 if(typeof transport!=='function')throw Error('Authorization transport disabled');
 if(typeof jwt!=='string'||!jwt)throw Error('Missing server authorization');
 const {request,record}=prepareAuthorization({state,now,validUntil});
 const response=await transport(API+request.path,{
  method:request.method,
  headers:{Authorization:'Bearer '+jwt,Accept:'application/json','Content-Type':'application/json'},
  body:JSON.stringify(request.body),
  redirect:'manual'
 });
 safeResponse(response,'Authorization provider');
 const result=await response.json();
 if(!result||typeof result.url!=='string')throw Error('Provider authorization URL missing');
 const target=new URL(result.url);
 if(target.protocol!=='https:'||target.username||target.password||target.hash||target.href.length>4096||!target.hostname.includes('.'))throw Error('Unsafe provider authorization URL');
 return {authorizationUrl:target.href,record};
}
export async function exchangeMockableCallback({callbackUrl,record,now,transport,jwt}){
 if(typeof transport!=='function')throw Error('Code exchange transport disabled');
 if(typeof jwt!=='string'||!jwt)throw Error('Missing server authorization');
 // Caller must have already atomically consumed state in authenticated storage.
 if(!record||record.consumed!==true)throw Error('One-time state must be consumed first');
 const spec=verifyCallback({callbackUrl,record:{...record,consumed:false},now});
 const response=await transport(API+spec.path,{
  method:spec.method,
  headers:{Authorization:'Bearer '+jwt,Accept:'application/json','Content-Type':'application/json'},
  body:JSON.stringify(spec.body),
  redirect:'manual'
 });
 safeResponse(response,'Session exchange');
 const result=await response.json();
 if(!result||typeof result.session_id!=='string'||!result.session_id||result.session_id.length>256)throw Error('Invalid provider session');
 return {sessionId:result.session_id};
}
