import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionAisClient} from '../src/bbva-production-ais-client.js';
import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK} from '../src/bbva-production-readiness.js';
const readiness={environment:'PRODUCTION',active:true,restricted:true,services:['AIS'],redirectUrls:[PRODUCTION_CALLBACK]};
test('production AIS client fails closed without verified configuration or signing key',async()=>{
 let called=0;
 const transport=async()=>{called++;throw Error('Must not be called')};
 await assert.rejects(createProductionAisClient({appId:PRODUCTION_APP_ID,readiness,transport}));
 await assert.rejects(createProductionAisClient({appId:PRODUCTION_APP_ID,readiness:{...readiness,restricted:false},pem:'-----BEGIN PRIVATE KEY-----',transport}));
 await assert.rejects(createProductionAisClient({appId:PRODUCTION_APP_ID,readiness:{...readiness,services:['AIS','PIS']},pem:'-----BEGIN PRIVATE KEY-----',transport}));
 await assert.rejects(createProductionAisClient({appId:PRODUCTION_APP_ID,readiness,pem:'-----BEGIN PRIVATE KEY-----'}));
 assert.equal(called,0);
});
test('client source exposes no payments, transfers, or implicit network transport',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/bbva-production-ais-client.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\/payments|\/transfers|transport=fetch|localStorage|sessionStorage/);
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/from '\.\/bbva-production-ais-client\.js'/);
});
