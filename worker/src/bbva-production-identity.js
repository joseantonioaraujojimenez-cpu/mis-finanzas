import {signSandboxRequest} from './enable-sandbox-check.js';
import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK} from './bbva-production-readiness.js';
const API='https://api.enablebanking.com/application';
export async function checkProductionIdentity({appId,pem,transport=fetch}){
 const fail=(reason)=>({configured:Boolean(appId&&pem),verified:false,reason,bankConnected:false});
 if(appId!==PRODUCTION_APP_ID||!pem)return fail('missing_or_invalid_configuration');
 let jwt;
 try{jwt=await signSandboxRequest(appId,pem);}catch{return fail('invalid_signing_key');}
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  let response;
  try{response=await transport(API,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'manual',signal:controller.signal});}
  finally{clearTimeout(timer);}
  if(response.status===401||response.status===403)return fail('provider_rejected_credentials');
  if(response.status!==200)return fail('provider_unavailable');
  const app=await response.json();
  if(app?.kid!==appId||app.environment!=='PRODUCTION'||app.active!==true||!Array.isArray(app.services)||app.services.length!==1||app.services[0]!=='AIS'||!Array.isArray(app.redirect_urls)||!app.redirect_urls.includes(PRODUCTION_CALLBACK))return fail('application_configuration_mismatch');
  return {configured:true,verified:true,reason:'production_ais_identity_verified',bankConnected:false};
 }catch{return fail('provider_connection_failed');}
}
