import {PLANNED_CALLBACK} from './enable-banking-contract.js';
const API='https://api.enablebanking.com';
const ID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode=value=>b64url(new TextEncoder().encode(JSON.stringify(value)));
export async function signSandboxRequest(appId,pem,now=Date.now()){
 if(typeof appId!=='string'||!ID.test(appId)||typeof pem!=='string'||pem.length>16384)throw Error('Sandbox configuration invalid');
 const match=pem.trim().match(/^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)-----END PRIVATE KEY-----$/);
 if(!match)throw Error('Expected PKCS#8 private key');
 const keyBytes=Uint8Array.from(atob(match[1].replace(/\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',keyBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const iat=Math.floor(now/1000),input=encode({typ:'JWT',alg:'RS256',kid:appId})+'.'+encode({iss:'enablebanking.com',aud:'api.enablebanking.com',iat,exp:iat+120});
 return input+'.'+b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input)));
}
export function validateSandboxApplication(app,expectedId){
 return Boolean(app&&app.kid===expectedId&&app.environment==='SANDBOX'&&app.active===true&&Array.isArray(app.services)&&app.services.length===1&&app.services[0]==='AIS'&&Array.isArray(app.redirect_urls)&&app.redirect_urls.includes(PLANNED_CALLBACK));
}
// Deliberately limited to two configuration/discovery endpoints; no bank authorization.
export async function checkSandbox({appId,pem,transport=fetch}){
 if(!appId||!pem)return {configured:false,verified:false,bbvaAvailable:false,reason:'missing_configuration'};
 try{
  const jwt=await signSandboxRequest(appId,pem);
  const get=async path=>{const r=await transport(API+path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Provider unavailable');return r.json();};
  const app=await get('/application');
  if(!validateSandboxApplication(app,appId))return {configured:true,verified:false,bbvaAvailable:false,reason:'sandbox_validation_failed'};
  const banks=await get('/aspsps?country=ES&psu_type=personal&service=AIS');
  if(!Array.isArray(banks.aspsps))throw Error('Invalid provider response');
  const bbvaAvailable=banks.aspsps.some(bank=>bank.country==='ES'&&typeof bank.name==='string'&&bank.name.toUpperCase()==='BBVA');
  return {configured:true,verified:true,bbvaAvailable,reason:bbvaAvailable?'ready':'bbva_not_listed'};
 }catch{return {configured:true,verified:false,bbvaAvailable:false,reason:'provider_check_failed'};}
}
