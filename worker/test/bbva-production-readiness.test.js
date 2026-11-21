import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK,checkProductionReadiness,callbackSafetyCheck} from '../src/bbva-production-readiness.js';
const state='11111111-1111-4111-8111-111111111111';
test('production readiness requires restricted, active, AIS-only and exact callback',()=>{
 const args={appId:PRODUCTION_APP_ID,environment:'PRODUCTION',active:true,restricted:true,services:['AIS'],redirectUrls:[PRODUCTION_CALLBACK]};
 assert.deepEqual(checkProductionReadiness(args),{ready:true,failures:[],realBankConnected:false});
 assert.deepEqual(checkProductionReadiness({...args,services:['AIS','PIS']}).failures,['ais_only']);
 assert.deepEqual(checkProductionReadiness({...args,redirectUrls:['https://example.org']}).failures,['callback']);
 assert.deepEqual(checkProductionReadiness({...args,active:false}).failures,['inactive']);
});
test('callback preflight never returns the bank authorization code',()=>{
 const result=callbackSafetyCheck(PRODUCTION_CALLBACK+'?state='+state+'&code=super-secret');
 assert.deepEqual(result,{status:'requires_authenticated_one_time_exchange',state});
 assert.doesNotMatch(JSON.stringify(result),/super-secret/);
});
test('callback preflight rejects altered hosts, duplicate state and fragments',()=>{
 assert.throws(()=>callbackSafetyCheck('https://evil.example/bank/callback?state='+state+'&code=x'));
 assert.throws(()=>callbackSafetyCheck(PRODUCTION_CALLBACK+'?state='+state+'&state='+state+'&code=x'));
 assert.throws(()=>callbackSafetyCheck(PRODUCTION_CALLBACK+'?state='+state+'&code=x#fragment'));
 assert.deepEqual(callbackSafetyCheck(PRODUCTION_CALLBACK+'?error=access_denied'),{status:'rejected'});
});
