import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestrictedAisTransport} from '../src/bbva-live-transport.js';
import {PRODUCTION_APP_ID,PRODUCTION_CALLBACK} from '../src/bbva-production-readiness.js';
import {authorizationSpec} from '../src/enable-banking-contract.js';
const now=Date.parse('2026-11-22T10:00:00Z'),accountId='11111111-1111-4111-8111-111111111111',base='https://api.enablebanking.com';
const readiness={environment:'PRODUCTION',active:true,restricted:true,services:['AIS'],redirectUrls:[PRODUCTION_CALLBACK]};
function fixture(){const calls=[];let signed=0;const options={enabled:'explicitly-authorized',appId:PRODUCTION_APP_ID,pem:'fixture',readiness,clock:()=>now,signer:async()=>`fixture-${++signed}`,transport:async(url,init)=>{calls.push({url,init});return {ok:true,status:200};}};return {options,calls,signed:()=>signed};}
test('live transport requires explicit activation and only AIS application readiness',()=>{
 const {options,calls}=fixture();
 assert.throws(()=>createRestrictedAisTransport({...options,enabled:undefined}));
 assert.throws(()=>createRestrictedAisTransport({...options,readiness:{...readiness,services:['AIS','PIS']}}));
 assert.throws(()=>createRestrictedAisTransport({...options,readiness:{...readiness,restricted:false}}));
 assert.equal(calls.length,0);
});
test('authorized read transport signs fresh requests and disregards caller headers',async()=>{
 const {options,calls}=fixture(),send=createRestrictedAisTransport(options);
 await send(base+'/accounts/'+accountId+'/balances',{method:'GET',headers:{Authorization:'untrusted'}});
 await send(base+'/accounts/'+accountId+'/transactions?date_from=2026-11-01&date_to=2026-11-21&transaction_status=BOOK',{method:'GET'});
 assert.equal(calls[0].init.headers.Authorization,'Bearer fixture-1');assert.equal(calls[1].init.headers.Authorization,'Bearer fixture-2');
 assert.ok(calls.every(c=>c.init.redirect==='manual'&&c.init.signal));
});
test('only expected AIS authorization and exchange bodies are accepted',async()=>{
 const {options,calls}=fixture(),send=createRestrictedAisTransport(options);
 const spec=authorizationSpec({state:accountId,now,validUntil:now+3600000});
 await send(base+spec.path,{method:spec.method,body:JSON.stringify(spec.body)});
 await send(base+'/sessions',{method:'POST',body:JSON.stringify({code:'fixture'})});
 assert.equal(calls.length,2);
});
test('consent revocation uses only the session deletion endpoint',async()=>{
 const {options,calls}=fixture(),send=createRestrictedAisTransport(options);
 await send(base+'/sessions/'+accountId,{method:'DELETE'});
 assert.equal(calls[0].init.method,'DELETE');
 assert.equal(calls.length,1);
});
test('production transport has no public wiring or deployment activation',async()=>{
 const {readFileSync}=await import('node:fs');
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 const config=readFileSync(new URL('../wrangler.faceid-test.jsonc',import.meta.url),'utf8');
 assert.doesNotMatch(worker+coordinator,/bbva-live-transport/);
 assert.doesNotMatch(config,/explicitly-authorized/);
});
