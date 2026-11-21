import {PLANNED_CALLBACK} from './enable-banking-contract.js';
import {createPrivateKey,sign,constants} from 'node:crypto';
const API='https://api.enablebanking.com';
const ID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode=value=>b64url(new TextEncoder().encode(JSON.stringify(value)));
export async function signSandboxRequest(appId,pem,now=Date.now()){
 if(typeof appId!=='string'||!ID.test(appId)||typeof pem!=='string'||pem.length>16384)throw Error('Sandbox configuration invalid');
 const normalized=pem.replace(/\\n/g,'\n').trim();
 if(!/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----$/.test(normalized))throw Error('Expected RSA private key');
 const key=createPrivateKey(normalized);
 if(key.asymmetricKeyType!=='rsa')throw Error('Expected RSA private key');
 const iat=Math.floor(now/1000),input=encode({typ:'JWT',alg:'RS256',kid:appId})+'.'+encode({iss:'enablebanking.com',aud:'api.enablebanking.com',iat,exp:iat+120});
 return input+'.'+b64url(sign('RSA-SHA256',new TextEncoder().encode(input),{key,padding:constants.RSA_PKCS1_PADDING}));
}
export function validateSandboxApplication(app,expectedId){
 return Boolean(app&&app.kid===expectedId&&app.environment==='SANDBOX'&&app.active===true&&Array.isArray(app.services)&&app.services.length===1&&app.services[0]==='AIS'&&Array.isArray(app.redirect_urls)&&app.redirect_urls.includes(PLANNED_CALLBACK));
}
// Deliberately limited to two configuration/discovery endpoints; no bank authorization.
export async function checkSandbox({appId,pem,transport=fetch}){
 if(!appId||!pem)return {configured:false,verified:false,bbvaAvailable:false,reason:'missing_configuration'};
 const failure=reason=>({configured:true,verified:false,bbvaAvailable:false,reason});
 if(typeof appId!=='string'||!ID.test(appId.trim()))return failure('invalid_app_id');
 appId=appId.trim();let jwt;
 try{jwt=await signSandboxRequest(appId,pem);}catch{return failure('invalid_private_key');}
 try{
  const get=async path=>{const r=await transport(API+path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok){const reason=r.status===401?'provider_unauthorized':r.status===403?'provider_forbidden':r.status===404?'provider_not_found':r.status===429?'provider_rate_limited':'provider_unavailable';return {error:reason};}try{return {value:await r.json()};}catch{return {error:'provider_invalid_response'};}};
  const app=await get('/application');if(app.error)return failure(app.error);
  if(!validateSandboxApplication(app.value,appId))return failure('sandbox_validation_failed');
  const banks=await get('/aspsps?country=ES&psu_type=personal&service=AIS');if(banks.error)return failure(banks.error);
  if(!Array.isArray(banks.value?.aspsps))return failure('provider_invalid_response');
  const bbvaAvailable=banks.value.aspsps.some(bank=>bank.country==='ES'&&typeof bank.name==='string'&&bank.name.toUpperCase()==='BBVA');
  return {configured:true,verified:true,bbvaAvailable,reason:bbvaAvailable?'ready':'bbva_not_listed'};
 }catch{return failure('provider_unavailable');}
}
