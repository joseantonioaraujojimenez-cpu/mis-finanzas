// Local integration-test entrypoint only. Never deploy this file.
import { PasskeyCoordinator } from '../src/passkey-coordinator.js';
export { PasskeyCoordinator };
export default {
 async fetch(req,env) {
  const url=new URL(req.url);
  if(url.pathname!=='/test/coordinator' || req.method!=='POST')return new Response('Not found',{status:404});
  const {path,payload}=await req.json();
  if(!['/health/check','/rate/check','/challenge/create','/challenge/consume','/credential/get','/credential/enroll','/credential/counter','/session/create','/session/validate','/session/revoke','/recovery/store','/recovery/consume'].includes(path))
   return Response.json({error:'Unknown test operation'},{status:400});
  const stub=env.PASSKEY_COORDINATOR.get(env.PASSKEY_COORDINATOR.idFromName('test-owner'));
  return stub.fetch('https://test.internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
 }
};