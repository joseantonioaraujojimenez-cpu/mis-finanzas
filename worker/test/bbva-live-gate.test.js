import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveAisEnabled,openLiveAisFlow} from '../src/bbva-live-gate.js';
import {PRODUCTION_APP_ID} from '../src/bbva-production-readiness.js';
const env={FACEID_TEST_MODE:'enabled',ENABLE_REAL_AIS:'explicitly-authorized',ENABLE_PRODUCTION_RESTRICTED:'confirmed',ENABLE_PRODUCTION_APP_ID:PRODUCTION_APP_ID,ENABLE_PRODUCTION_PRIVATE_KEY:'fixture'};
test('live AIS requires isolated mode, explicit activation, separate restriction confirmation and keys',async()=>{
 assert.equal(liveAisEnabled(env),true);
 for(const key of Object.keys(env)){
  const disabled={...env,[key]:undefined};let calls=0;
  assert.equal(liveAisEnabled(disabled),false);
  await assert.rejects(openLiveAisFlow({env:disabled,storage:{},transport:async()=>{calls++;}}));
  assert.equal(calls,0);
 }
});
test('published configuration has no live activation and routes are gated',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.faceid-test.jsonc',import.meta.url),'utf8'));
 assert.equal(liveAisEnabled(config.vars),false);
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(worker,/liveReady=ready&&liveAisEnabled\(env\)/);
 assert.match(worker,/startsWith\('\/auth\/bank\/'\)&&!liveReady/);
 assert.match(worker,/confirmReadOnly!==true/);
 assert.match(coordinator,/!liveAisEnabled\(this.env\)/);
});
