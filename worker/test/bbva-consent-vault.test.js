import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeOwnerState} from '../src/bbva-owner-state.js';
import {commitVerifiedConsent,readVerifiedConsent,clearVerifiedConsent,beginConsentRevocation,finishConsentRevocation} from '../src/bbva-consent-vault.js';
const state='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',account='33333333-3333-4333-8333-333333333333';
const now=Date.parse('2026-11-22T10:00:00Z'),digest='a'.repeat(64),token='test-session';
const provider={sessionId,status:'AUTHORIZED',aspsp:{name:'BBVA',country:'ES'},access:{valid_until:new Date(now+3600000).toISOString()},accounts:[account]};
function fixture(){
 const map=new Map([['session:'+token,{expires:now+900000,epoch:1}],['session_epoch',1],['bbva:ais:state:'+state,{state,callback:'https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback',consumed:false,expiresAt:now+600000,ownerEpoch:1,ownerSessionDigest:digest}]]);
 const tx={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k)};
 const input={state,token,digest,provider,now};
 return {map,tx,input,commit:(changes={})=>commitVerifiedConsent(tx,{...input,...changes}),read:()=>readVerifiedConsent(tx,{token,now})};
}
test('verified consent is accepted only after the matching owner state is consumed',async()=>{
 const f=fixture();
 assert.equal(await f.commit(),false);
 assert.ok(await consumeOwnerState(f.tx,f.input));
 assert.equal(await f.commit({digest:'b'.repeat(64)}),false);
 assert.equal(await f.commit(),true);
 assert.deepEqual(await f.read(),{sessionId,expiresAt:now+3600000,accountIds:[account]});
 assert.equal(await f.commit(),false);
 assert.equal(f.map.has('bbva:ais:receipt:'+state),false);
});
test('invalid bank, consent date, duplicate accounts or missing owner fail closed',async()=>{
 const f=fixture();await consumeOwnerState(f.tx,f.input);
 for(const p of [{...provider,aspsp:{name:'Other',country:'ES'}},{...provider,accounts:[account,account]},{...provider,access:{valid_until:new Date(now).toISOString()}},{...provider,sessionId:'invalid'}])assert.equal(await f.commit({provider:p}),false);
 f.map.set('session_epoch',2);
 assert.equal(await f.commit(),false);
 assert.equal(await f.read(),null);
});
test('consent is inaccessible after global revocation or local disconnect',async()=>{
 const f=fixture();await consumeOwnerState(f.tx,f.input);assert.equal(await f.commit(),true);
 assert.equal(await clearVerifiedConsent(f.tx,{token:'invalid',now}),false);
 assert.equal(await clearVerifiedConsent(f.tx,{token,now}),true);
 assert.equal(await f.read(),null);
 const g=fixture();await consumeOwnerState(g.tx,g.input);await g.commit();g.map.set('session_epoch',2);
 assert.equal(await g.read(),null);
});
test('pending provider revocation immediately prevents reading and can be retried',async()=>{
 const f=fixture();await consumeOwnerState(f.tx,f.input);await f.commit();
 assert.equal(await beginConsentRevocation(f.tx,{token,now}),sessionId);
 assert.equal(await f.read(),null);
 assert.equal(await beginConsentRevocation(f.tx,{token,now}),sessionId);
 assert.equal(await finishConsentRevocation(f.tx,{sessionId:account}),false);
 assert.equal(await finishConsentRevocation(f.tx,{sessionId}),true);
 assert.equal(await f.read(),null);
});
