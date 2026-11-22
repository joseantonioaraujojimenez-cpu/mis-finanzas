// Production authorization request: server-only, no browser credentials.
// This module is intentionally not exposed as a public route until the callback
// and authenticated one-time code exchange are complete.
import {authorizationSpec} from './enable-banking-contract.js';
import {signSandboxRequest} from './enable-sandbox-check.js';
import {PRODUCTION_APP_ID} from './bbva-production-readiness.js';
const API='https://api.enablebanking.com';
export async function prepareProductionAuthorization({appId,pem,state,now=Date.now(),transport}){
 if(appId!==PRODUCTION_APP_ID||typeof pem!=='string'||typeof transport!=='function')throw Error('Production authorization unavailable');
 const spec=authorizationSpec({state,now,validUntil:now+86400000});
 const jwt=await signSandboxRequest(appId,pem,now);
 const response=await transport(API+spec.path,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(spec.body),redirect:'manual'});
 if(!response||response.status!==200||response.ok!==true||typeof response.json!=='function')throw Error('Authorization provider rejected request');
 const result=await response.json();
 if(typeof result?.url!=='string'||result.url.length>4096)throw Error('Missing authorization URL');
 const url=new URL(result.url);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.hostname==='localhost'||url.hostname.endsWith('.localhost'))throw Error('Invalid authorization destination');
 return Object.freeze({url:url.href,expiresAt:now+600000,state});
}
