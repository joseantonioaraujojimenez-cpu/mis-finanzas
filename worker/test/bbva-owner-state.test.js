import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeOwnerState} from '../src/bbva-owner-state.js';
const state='11111111-1111-4111-8111-111111111111',key='bbva:ais:state:'+state,now=1000;
const callback='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/bank/callback';
function fixture(){
 const map=new Map([[key,{state,callback,consumed:false,expiresAt:2000,ownerEpoch:2,ownerSessionDigest:'owner'}],['session_epoch',2],['session:one',{expires:3000,epoch:2}],['session:two',{expires:3000,epoch:2}]]);
 const tx={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v)};
 return {map,consume:(overrides={})=>consumeOwnerState(tx,{state,token:'one',digest:'owner',now,...overrides})};
}
test('only original live owner session can consume state exactly once',async()=>{
 const {map,consume}=fixture();
 assert.equal(await consume({token:'two',digest:'other'}),null);
 assert.equal(map.get(key).consumed,false);
 assert.deepEqual(await consume(),{state,callback,expiresAt:2000});
 assert.equal(await consume(),null);
 assert.equal(map.get(key).ownerSessionDigest,undefined);
});
test('revoked and expired sessions cannot consume state',async()=>{
 const {map,consume}=fixture();
 map.set('session_epoch',3);
 assert.equal(await consume(),null);
 assert.equal(map.get(key).consumed,false);
 map.set('session_epoch',2);
 map.delete('session:one');
 assert.equal(await consume(),null);
 map.set('session:one',{expires:now,epoch:2});
 assert.equal(await consume(),null);
});
test('expired state is retired without returning authorization data',async()=>{
 const {map,consume}=fixture();
 assert.equal(await consume({now:2000}),null);
 assert.equal(map.get(key).consumed,true);
});
