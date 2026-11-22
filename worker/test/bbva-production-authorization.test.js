import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareProductionAuthorization} from '../src/bbva-production-authorization.js';
import {PRODUCTION_APP_ID} from '../src/bbva-production-readiness.js';
test('production authorization cannot execute without a server transport and matching app',async()=>{
 const state='11111111-2222-4333-8444-555555555555';
 await assert.rejects(prepareProductionAuthorization({appId:PRODUCTION_APP_ID,state,pem:'secret'}));
 await assert.rejects(prepareProductionAuthorization({appId:'11111111-2222-4333-8444-555555555555',state,pem:'secret',transport:async()=>{throw Error('Should not run')}}));
});
test('production authorization source remains disconnected from public Worker',async()=>{
 const {readFileSync}=await import('node:fs');
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/bbva-production-authorization.js',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/from '\.\/bbva-production-authorization\.js'/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|\/payments|\/transfers/);
 assert.match(source,/authorizationSpec/);
 assert.match(source,/signSandboxRequest/);
});
