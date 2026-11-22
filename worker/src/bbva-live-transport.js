// Server-only AIS transport, deliberately disconnected from public routes.
// Production access requires a separate explicit activation and verified AIS application.
import {PRODUCTION_APP_ID,checkProductionReadiness} from './bbva-production-readiness.js';
import {signSandboxRequest} from './enable-sandbox-check.js';
import {authorizationSpec,sessionStatusSpec} from './enable-banking-contract.js';
const API='https://api.enablebanking.com';
const UUID='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const accountRoute=new RegExp('^/accounts/('+UUID+')/(balances|transactions)$','i');
const sessionRoute=new RegExp('^/sessions/('+UUID+')$','i');
function sameObject(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameObject(a[k],b[k]));}
function checkedRequest(url,init,now){
 const target=new URL(url),method=init?.method;
 if(target.origin!==API||target.username||target.password||target.hash||!['GET','POST'].includes(method))throw Error('AIS request not allowed');
 const path=target.pathname;
 if(method==='POST'){
  if(target.search||typeof init.body!=='string'||init.body.length>8192)throw Error('Invalid AIS request');
  const body=JSON.parse(init.body);
  if(path==='/auth'){
   const validUntil=Date.parse(body?.access?.valid_until);
   const expected=authorizationSpec({state:body?.state,now,validUntil});
   if(!sameObject(body,expected.body))throw Error('Unexpected AIS scope');
  }else if(path==='/sessions'){
   if(!body||Object.keys(body).length!==1||typeof body.code!=='string'||!body.code.trim()||body.code.length>2048)throw Error('Invalid AIS exchange');
  }else throw Error('AIS POST not allowed');
  return {url:API+path,method,body:JSON.stringify(body)};
 }
 if(init.body!==undefined)throw Error('AIS GET body not allowed');
 if(path==='/application'||sessionRoute.test(path)){
  if(target.search)throw Error('Unexpected AIS query');
  if(path!=='/application')sessionStatusSpec(path.slice('/sessions/'.length));
  return {url:API+path,method};
 }
 const match=path.match(accountRoute);if(!match)throw Error('AIS GET not allowed');
 // Scope validation also occurs in the caller against the verified session.
 if(match[2]==='balances'){if(target.search)throw Error('Unexpected balance query');}
 else{
  const params=target.searchParams,keys=[...params.keys()];
  if(keys.some(k=>!['date_from','date_to','transaction_status','continuation_key'].includes(k))||new Set(keys).size!==keys.length||params.get('transaction_status')!=='BOOK')throw Error('Invalid AIS transaction query');
  const from=params.get('date_from'),to=params.get('date_to'),continuation=params.get('continuation_key');
  const dateValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!dateValid(from)||!dateValid(to)||from>to||Date.parse(to)-Date.parse(from)>31*86400000||(continuation!==null&&(!continuation||continuation.length>2048)))throw Error('Invalid AIS transaction interval');
  const query=new URLSearchParams({date_from:from,date_to:to,transaction_status:'BOOK'});
  if(continuation!==null)query.set('continuation_key',continuation);
  return {url:API+path+'?'+query.toString(),method};
 }
 return {url:API+path,method};
}
export function createRestrictedAisTransport({enabled,appId,pem,readiness,transport,clock=Date.now,signer=signSandboxRequest}){
 if(enabled!=='explicitly-authorized'||appId!==PRODUCTION_APP_ID||!checkProductionReadiness({...readiness,appId}).ready||typeof pem!=='string'||!pem||typeof transport!=='function')throw Error('Live AIS disabled');
 return async(url,init)=>{
  const now=clock(),request=checkedRequest(url,init,now);
  const jwt=await signer(appId,pem,now);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   return await transport(request.url,{method:request.method,redirect:'manual',signal:controller.signal,headers:{Authorization:'Bearer '+jwt,Accept:'application/json',...(request.body===undefined?{}:{'Content-Type':'application/json'})},...(request.body===undefined?{}:{body:request.body})});
  }finally{clearTimeout(timer);}
 };
}
