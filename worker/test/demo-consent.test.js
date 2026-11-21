import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionDemoConsent,DEMO_CONSENT_TTL} from '../src/demo-consent.js';

test('simulated read-only consent is initially absent and cannot sync',()=>{
 const {record,result}=transitionDemoConsent(null,'sync',1000);
 assert.equal(record,null);assert.equal(result.canSync,false);assert.equal(result.payments,false);assert.deepEqual(result.scope,['balances','transactions']);
});
test('explicit simulated grant allows sync without extending expiry',()=>{
 const {record}=transitionDemoConsent(null,'grant',1000);
 assert.equal(record.expires,1000+DEMO_CONSENT_TTL);
 assert.equal(transitionDemoConsent(record,'sync',1001).result.canSync,true);
 assert.deepEqual(transitionDemoConsent(record,'grant',1002).record,record);
});
test('expiry and revocation close simulated sync',()=>{
 const {record}=transitionDemoConsent(null,'grant',1000);
 assert.equal(transitionDemoConsent(record,'sync',record.expires).result.canSync,false);
 const revoked=transitionDemoConsent(record,'revoke',1001);
 assert.equal(revoked.record,null);assert.equal(revoked.result.active,false);
 assert.equal(transitionDemoConsent(revoked.record,'sync',1002).result.canSync,false);
});
test('no action exists for payments or transfers',()=>assert.throws(()=>transitionDemoConsent(null,'payment',1000)));
