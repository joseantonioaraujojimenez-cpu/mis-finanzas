import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAuthorization,verifyCallback} from '../src/bbva-authorization-preflight.js';
import {PLANNED_CALLBACK} from '../src/enable-banking-contract.js';
const state='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-11-21T12:00:00Z');
const start=()=>prepareAuthorization({state,now,validUntil:now+3600000});
test('preflight prepares fixed BBVA AIS-only request and short callback expiry',()=>{
 const {request,record}=start();
 assert.equal(request.body.redirect_url,PLANNED_CALLBACK);
 assert.deepEqual(request.body.aspsp,{name:'BBVA',country:'ES'});
 assert.equal(record.expiresAt,now+600000);
 assert.equal(record.consumed,false);
});
test('callback accepts one matching state and code without making a network request',()=>{
 const {record}=start();
 const spec=verifyCallback({callbackUrl:PLANNED_CALLBACK+'?state='+state+'&code=demo-code',record,now:now+1000});
 assert.deepEqual(spec,{method:'POST',path:'/sessions',body:{code:'demo-code'}});
});
test('callback rejects expiry, replay, mismatch, duplicates, errors and foreign origin',()=>{
 const {record}=start();
 const base=PLANNED_CALLBACK+'?state='+state+'&code=demo-code';
 for(const args of [
  {callbackUrl:base,record,now:record.expiresAt},
  {callbackUrl:base,record:{...record,consumed:true},now:now+1000},
  {callbackUrl:PLANNED_CALLBACK+'?state=22222222-2222-4222-8222-222222222222&code=x',record,now:now+1000},
  {callbackUrl:base+'&state='+state,record,now:now+1000},
  {callbackUrl:base+'&code=x',record,now:now+1000},
  {callbackUrl:base+'&error=access_denied',record,now:now+1000},
  {callbackUrl:'https://example.org/bank/callback?state='+state+'&code=x',record,now:now+1000},
  {callbackUrl:PLANNED_CALLBACK+'?state='+state,record,now:now+1000}
 ])assert.throws(()=>verifyCallback(args));
});
