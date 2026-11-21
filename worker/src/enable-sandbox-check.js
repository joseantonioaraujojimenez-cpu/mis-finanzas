import {PLANNED_CALLBACK} from './enable-banking-contract.js';
import {createPrivateKey,sign,constants} from 'node:crypto';
const API='https://api.enablebanking.com';
const ID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode=value=>b64url(new TextEncoder().encode(JSON.stringify(value)));
class KeyDiagnostic extends Error {constructor(reason){super(reason);this.reason=reason;}}
export async function signSandboxRequest(appId,pem,now=Date.now()){
 if(typeof appId!=='string'||!ID.test(appId)||typeof pem!=='string'||pem.length>16384)throw Error('Sandbox configuration invalid');
 const normalized=pem.replace(/\\n/g,'\n').replace(/\\r/g,'\r').trim();
 const match=normalized.match(/^-----BEGIN (PRIVATE KEY|RSA PRIVATE KEY)-----([\s\S]+)-----END \1-----$/);
 if(!match)throw new KeyDiagnostic('invalid_private_key');
 const body=match[2].replace(/\s/g,'');let bytes;
 try{if(!/^[A-Za-z0-9+/]+={0,2}$/.test(body))throw Error();bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));if(bytes.length<256||bytes[0]!==48)throw Error();}catch{throw new KeyDiagnostic('invalid_pem_body');}
 const iat=Math.floor(now/1000),input=encode({typ:'JWT',alg:'RS256',kid:appId})+'.'+encode({iss:'enablebanking.com',aud:'api.enablebanking.com',iat,exp:iat+120});
 const message=new TextEncoder().encode(input);
 if(match[1]==='PRIVATE KEY'){
  let key;try{key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);}catch{throw new KeyDiagnostic('rsa_import_failed');}
  try{return input+'.'+b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,message));}catch{throw new KeyDiagnostic('rsa_sign_failed');}
 }
 let key;try{key=createPrivateKey(normalized);if(key.asymmetricKeyType!=='rsa')throw Error();}catch{throw new KeyDiagnostic('rsa_import_failed');}
 try{return input+'.'+b64url(sign('RSA-SHA256',message,{key,padding:constants.RSA_PKCS1_PADDING}));}catch{throw new KeyDiagnostic('rsa_sign_failed');}
}
export function validateSandboxApplication(app,expectedId){
 return Boolean(app&&app.kid===expectedId&&app.environment==='SANDBOX'&&app.active===true&&Array.isArray(app.services)&&app.services.length===1&&app.services[0]==='AIS'&&Array.isArray(app.redirect_urls)&&app.redirect_urls.includes(PLANNED_CALLBACK));
}
// Deliberately limited to two configuration/discovery endpoints; no bank authorization.
export async function checkSandbox({appId,pem,transport=fetch}){
 if(!appId||!pem)return {configured:false,verified:false,bbvaAvailable:false,reason:'missing_configuration'};
 const failure=(reason,stage,httpStatus)=>({configured:true,verified:false,bbvaAvailable:false,reason,...(stage?{stage}:{}),...(Number.isInteger(httpStatus)?{httpStatus}:{})});
 if(typeof appId!=='string'||!ID.test(appId.trim()))return failure('invalid_app_id');
 appId=appId.trim();let jwt;
 try{jwt=await signSandboxRequest(appId,pem);}catch(e){return failure(e instanceof KeyDiagnostic?e.reason:'invalid_private_key');}
 let stage='application';
 try{
  const get=async path=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{const r=await transport(API+path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'error',signal:controller.signal});if(!r.ok){const reason=r.status===401?'provider_unauthorized':r.status===403?'provider_forbidden':r.status===404?'provider_not_found':r.status===429?'provider_rate_limited':'provider_unavailable';return {error:reason,status:r.status};}try{return {value:await r.json()};}catch{return {error:'provider_invalid_response',status:r.status};}}catch{return {error:controller.signal.aborted?'provider_timeout':'provider_network_error'};}finally{clearTimeout(timer);}};
  const app=await get('/application');if(app.error)return failure(app.error,stage,app.status);
  if(!validateSandboxApplication(app.value,appId))return failure('sandbox_validation_failed');
  stage='aspsps';const banks=await get('/aspsps?country=ES&psu_type=personal&service=AIS');if(banks.error)return failure(banks.error,stage,banks.status);
  if(!Array.isArray(banks.value?.aspsps))return failure('provider_invalid_response',stage,200);
  const bbvaAvailable=banks.value.aspsps.some(bank=>bank.country==='ES'&&typeof bank.name==='string'&&bank.name.toUpperCase()==='BBVA');
  return {configured:true,verified:true,bbvaAvailable,reason:bbvaAvailable?'ready':'bbva_not_listed'};
 }catch{return failure('provider_unavailable',stage);}
}
