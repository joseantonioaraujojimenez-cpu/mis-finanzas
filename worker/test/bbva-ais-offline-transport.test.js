import test from 'node:test';
import assert from 'node:assert/strict';
import {requestMockableAuthorization,exchangeMockableCallback} from '../src/bbva-ais-offline-transport.js';
import {PLANNED_CALLBACK} from '../src/enable-banking-contract.js';
const state='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-11-21T12:00:00Z');
const options={state,now,validUntil:now+3600000,jwt:'mock-signed-jwt'};
test('offline AIS authorization makes one mocked /auth request and returns https redirect',async()=>{
 const calls=[];
 const result=await requestMockableAuthorization({...options,transport:async(url,init)=>{
  calls.push({url,init});return {ok:true,status:200,json:async()=>({url:'https://bank.example/authorize'})};
 }});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.enablebanking.com/auth');
 assert.equal(JSON.parse(calls[0].init.body).aspsp.name,'BBVA');
 assert.equal(result.authorizationUrl,'https://bank.example/authorize');
 assert.equal(result.record.state,state);
});
test('offline authorization fails closed without transport or with insecure redirect',async()=>{
 await assert.rejects(requestMockableAuthorization(options));
 await assert.rejects(requestMockableAuthorization({...options,transport:async()=>({ok:true,status:200,json:async()=>({url:'http://bank.example/'})})}));
});
test('offline callback requires previously consumed state and makes mocked /sessions request',async()=>{
 const record={state,expiresAt:now+600000,consumed:true};
 const calls=[];
 const result=await exchangeMockableCallback({callbackUrl:PLANNED_CALLBACK+'?state='+state+'&code=mock-code',record,now:now+1000,jwt:'mock-jwt',transport:async(url,init)=>{
  calls.push({url,init});return {ok:true,status:200,json:async()=>({session_id:'mock-session'})};
 }});
 assert.deepEqual(result,{sessionId:'mock-session'});
 assert.equal(calls[0].url,'https://api.enablebanking.com/sessions');
 assert.deepEqual(JSON.parse(calls[0].init.body),{code:'mock-code'});
});
test('offline callback refuses unconsumed or expired state before transport',async()=>{
 let calls=0;
 const transport=async()=>{calls++;return {ok:true,status:200,json:async()=>({session_id:'mock'})}};
 const base={callbackUrl:PLANNED_CALLBACK+'?state='+state+'&code=x',record:{state,expiresAt:now+600000,consumed:false},now:now+1000,jwt:'mock-jwt',transport};
 await assert.rejects(exchangeMockableCallback(base));
 await assert.rejects(exchangeMockableCallback({...base,record:{...base.record,consumed:true},now:now+600000}));
 assert.equal(calls,0);
});
