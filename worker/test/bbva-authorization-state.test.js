import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAuthorization} from '../src/bbva-authorization-preflight.js';
import {saveAuthorizationState,consumeAuthorizationState} from '../src/bbva-authorization-state.js';
const state='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-11-21T12:00:00Z');
const storage=()=>{
 const map=new Map();
 return {transaction:async fn=>fn({get:async key=>map.get(key),put:async(key,value)=>{map.set(key,value)},delete:async key=>{map.delete(key)}})};
};
test('AIS state is saved once and consumed once',async()=>{
 const s=storage(),{record}=prepareAuthorization({state,now,validUntil:now+3600000});
 assert.equal(await saveAuthorizationState({storage:s,record,now}),true);
 assert.equal(await saveAuthorizationState({storage:s,record,now}),false);
 assert.equal((await consumeAuthorizationState({storage:s,state,now:now+1000})).state,state);
 assert.equal(await consumeAuthorizationState({storage:s,state,now:now+1001}),null);
});
test('expired AIS state is burned and cannot be replayed',async()=>{
 const s=storage(),{record}=prepareAuthorization({state,now,validUntil:now+3600000});
 await saveAuthorizationState({storage:s,record,now});
 assert.equal(await consumeAuthorizationState({storage:s,state,now:record.expiresAt}),null);
 assert.equal(await consumeAuthorizationState({storage:s,state,now:now+1}),null);
});
test('state helpers reject nontransactional stores, invalid callbacks and invalid identifiers',async()=>{
 const {record}=prepareAuthorization({state,now,validUntil:now+3600000});
 await assert.rejects(saveAuthorizationState({storage:{},record,now}));
 await assert.rejects(saveAuthorizationState({storage:storage(),record:{...record,callback:'https://example.org/'},now}));
 assert.equal(await consumeAuthorizationState({storage:storage(),state:'invalid',now}),null);
});
