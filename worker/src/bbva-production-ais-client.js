// Production AIS-only transport boundary. Not imported by the deployed Worker.
// The caller must explicitly supply an authenticated, restricted production application.
// No browser credentials, payment endpoints, implicit fetch or secret persistence.
import {signSandboxRequest} from './enable-sandbox-check.js';
import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK,checkProductionReadiness} from './bbva-production-readiness.js';
const API='https://api.enablebanking.com';
const allowedPath=/^\/(?:application|sessions\/[0-9a-f-]{36}|accounts\/[0-9a-f-]{36}\/(?:balances|transactions))(?:\?[a-z0-9_=&%.-]+)?$/i;
export async function createProductionAisClient({appId,pem,readiness,transport}){
 if(typeof transport!=='function')throw Error('Production transport not configured');
 if(appId!==PRODUCTION_APP_ID||!checkProductionReadiness({...readiness,appId}).ready)throw Error('Production AIS not verified');
 if(typeof pem!=='string'||!pem.includes('PRIVATE KEY'))throw Error('Production signing key not configured');
 const request=async (method,path)=>{
  if(method!=='GET'||typeof path!=='string'||!allowedPath.test(path)||path.includes('..'))throw Error('AIS read-only route required');
  const jwt=await signSandboxRequest(appId,pem);
  const response=await transport(API+path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'manual'});
  if(!response||response.ok!==true||response.status!==200||typeof response.json!=='function')throw Error('AIS read failed');
  const type=response.headers?.get?.('content-type');
  if(type!==undefined&&type!==null&&!/^application\/json(?:;|$)/i.test(type))throw Error('Unexpected provider response');
  return response.json();
 };
 return Object.freeze({readApplication:()=>request('GET','/application'),readSession:id=>request('GET','/sessions/'+id),readBalances:id=>request('GET','/accounts/'+id+'/balances')});
}
export {PRODUCTION_CALLBACK};
