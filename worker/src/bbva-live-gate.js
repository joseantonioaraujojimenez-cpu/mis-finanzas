import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK} from './bbva-production-readiness.js';
import {checkProductionIdentity} from './bbva-production-identity.js';
import {createLiveAisFlow} from './bbva-live-flow.js';
export function liveAisEnabled(env){
 return env?.FACEID_TEST_MODE==='enabled'&&env.ENABLE_REAL_AIS==='explicitly-authorized'&&env.ENABLE_PRODUCTION_RESTRICTED==='confirmed'&&env.ENABLE_PRODUCTION_APP_ID===PRODUCTION_APP_ID&&typeof env.ENABLE_PRODUCTION_PRIVATE_KEY==='string'&&env.ENABLE_PRODUCTION_PRIVATE_KEY.length>0;
}
export async function openLiveAisFlow({env,storage,transport}){
 if(!liveAisEnabled(env)||typeof transport!=='function')throw Error('Live AIS disabled');
 const appId=env.ENABLE_PRODUCTION_APP_ID,pem=env.ENABLE_PRODUCTION_PRIVATE_KEY;
 const identity=await checkProductionIdentity({appId,pem,transport});
 if(!identity.verified)throw Error('Production AIS identity not verified');
 // Restricted mode is not present in the provider application API response.
 // It must be confirmed separately in the control panel by the owner.
 return createLiveAisFlow({storage,transport,appId,pem,enabled:env.ENABLE_REAL_AIS,readiness:{environment:'PRODUCTION',active:true,restricted:true,services:['AIS'],redirectUrls:[PRODUCTION_CALLBACK]}});
}
