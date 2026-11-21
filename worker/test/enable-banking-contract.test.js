import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../src/enable-banking-contract.js';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',now=Date.parse('2026-11-21T12:00:00Z');
const session={status:'AUTHORIZED',aspsp:{name:'BBVA',country:'ES'},access:{valid_until:'2026-11-22T12:00:00Z'},accounts:[id]};
test('authorization contract is limited to BBVA Spain and a fixed callback',()=>{
 const r=client.authorizationSpec({state:id,now,validUntil:now+3600000});
 assert.equal(r.path,'/auth');assert.deepEqual(r.body.aspsp,{name:'BBVA',country:'ES'});assert.equal(r.body.redirect_url,client.PLANNED_CALLBACK);assert.equal(r.body.psu_type,'personal');assert.equal(r.body.credentials,undefined);assert.equal(r.body.payment,undefined);
 assert.throws(()=>client.authorizationSpec({state:id,now,validUntil:now+86400001}));
});
test('callback contract requires matching unexpired state before code exchange',()=>{
 const request={code:'mock-code',state:id,expectedState:id,expires:now+1000,now};assert.equal(client.exchangeSpec(request).path,'/sessions');
 assert.throws(()=>client.exchangeSpec({...request,state:other}));assert.throws(()=>client.exchangeSpec({...request,expires:now}));
});
test('account reads are limited to an authorized session, bank and account',()=>{
 assert.equal(client.balancesSpec(session,id,now).method,'GET');
 assert.throws(()=>client.balancesSpec(session,other,now));assert.throws(()=>client.balancesSpec({...session,status:'REVOKED'},id,now));assert.throws(()=>client.balancesSpec(session,id,Date.parse(session.access.valid_until)));
 assert.throws(()=>client.balancesSpec({...session,aspsp:{name:'Other',country:'ES'}},id,now));
});
test('transactions contract restricts dates and supports pagination',()=>{
 const r=client.transactionsSpec(session,id,{from:'2026-11-01',to:'2026-11-21',continuation:'next page'},now);
 assert.equal(r.method,'GET');assert.match(r.path,/continuation_key=next\+page/);assert.throws(()=>client.transactionsSpec(session,id,{from:'2026-11-31',to:'2026-12-01'},now));
});
test('session revocation is separate from account reads; no payment functions exist',()=>{
 assert.deepEqual(client.revokeSessionSpec(id),{method:'DELETE',path:'/sessions/'+id});assert.equal(client.sessionStatusSpec(id).method,'GET');
 assert.equal(Object.keys(client).some(name=>/payment|transfer/i.test(name)),false);
});

test('BBVA authorization request cannot select payment services or arbitrary destinations',()=>{
 const request=client.authorizationSpec({state:id,now,validUntil:now+3600000});
 assert.equal(request.method,'POST');
 assert.equal(request.path,'/auth');
 assert.equal(request.body.redirect_url,client.PLANNED_CALLBACK);
 assert.deepEqual(request.body.aspsp,{name:'BBVA',country:'ES'});
 assert.equal(Object.keys(request.body).some(key=>/payment|creditor|iban|amount|transfer/i.test(key)),false);
 assert.equal(Object.keys(client).some(key=>/initiatePayment|createPayment|transferFunds/i.test(key)),false);
});
test('authorization callback rejects a mismatched, missing or expired state',()=>{
 const base={code:'sandbox-code',state:id,expectedState:id,expires:now+60000,now};
 for(const invalid of [{...base,state:other},{...base,expectedState:other},{...base,state:undefined},{...base,expires:now},{...base,code:''}]){
  assert.throws(()=>client.exchangeSpec(invalid));
 }
});
