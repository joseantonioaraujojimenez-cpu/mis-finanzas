// Production AIS readiness checks, deliberately offline.
// This does NOT enable production access, send credentials or exchange a bank code.
export const PRODUCTION_CALLBACK='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback';
export const PRODUCTION_APP_ID='83998700-80dd-4597-a21c-ea58b41b966d';
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function checkProductionReadiness({appId,redirectUrls,services,environment,active,restricted}){
 const failures=[];
 if(typeof appId!=='string'||!UUID.test(appId)||appId!==PRODUCTION_APP_ID)failures.push('app_id');
 if(environment!=='PRODUCTION')failures.push('environment');
 if(active!==true)failures.push('inactive');
 if(restricted!==true)failures.push('not_restricted');
 if(!Array.isArray(services)||services.length!==1||services[0]!=='AIS')failures.push('ais_only');
 if(!Array.isArray(redirectUrls)||!redirectUrls.includes(PRODUCTION_CALLBACK))failures.push('callback');
 return Object.freeze({ready:failures.length===0,failures,realBankConnected:false});
}
export function callbackSafetyCheck(urlString){
 if(typeof urlString!=='string'||urlString.length>8192)throw Error('Invalid callback URL');
 const url=new URL(urlString);
 const expected=new URL(PRODUCTION_CALLBACK);
 if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.hash||url.username||url.password)throw Error('Unexpected callback origin');
 if(url.searchParams.has('error'))return Object.freeze({status:'rejected'});
 if(url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1)throw Error('Invalid callback parameters');
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');
 if(!UUID.test(state)||!code||code.length>2048)throw Error('Invalid callback values');
 // Never log, persist, return or expose the authorization code.
 return Object.freeze({status:'requires_authenticated_one_time_exchange',state});
}
