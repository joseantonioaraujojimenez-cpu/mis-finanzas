import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveAisFlow,liveReturnCookie,readLiveReturnCookie} from '../src/bbva-live-flow.js';
test('live flow cannot initialize without explicit activation',()=>{
 assert.throws(()=>createLiveAisFlow({}),/Live AIS disabled/);
});
test('live return cookie is isolated to the actual callback and cleared explicitly',()=>{
 const ticket='a'.repeat(64),cookie=liveReturnCookie(ticket),pair=cookie.split(';')[0];
 assert.match(cookie,/Path=\/bank\/callback; Max-Age=600; Secure; HttpOnly; SameSite=Lax/);
 assert.equal(readLiveReturnCookie(pair),ticket);
 assert.equal(readLiveReturnCookie(pair+'; '+pair),null);
 assert.match(liveReturnCookie(null),/Max-Age=0/);
});
