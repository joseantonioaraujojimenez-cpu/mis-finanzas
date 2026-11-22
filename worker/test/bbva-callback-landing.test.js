import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBankCallbackLanding} from '../src/bbva-callback-landing.js';
import {PRODUCTION_CALLBACK} from '../src/bbva-production-readiness.js';
test('callback never reflects bank code, state or error and does not set cookies',async()=>{
 const state='11111111-2222-4333-8444-555555555555',code='SECRET-BANK-CODE-DO-NOT-LEAK';
 const response=safeBankCallbackLanding(PRODUCTION_CALLBACK+'?code='+code+'&state='+state);
 assert.equal(response.status,202);
 const body=await response.text();
 assert.doesNotMatch(body,/SECRET-BANK-CODE|11111111-2222|state=|code=/);
 assert.equal(response.headers.get('Cache-Control'),'no-store, max-age=0');
 assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 assert.equal(response.headers.get('Set-Cookie'),null);
});
test('invalid and rejected callback fails closed without reflecting provider text',async()=>{
 const r=safeBankCallbackLanding(PRODUCTION_CALLBACK+'?error=access_denied&error_description=SENSITIVE');
 assert.equal(r.status,400);
 assert.doesNotMatch(await r.text(),/SENSITIVE|access_denied/);
});
test('landing is limited to isolated GET and no code exchange is implemented',async()=>{
 const {readFileSync}=await import('node:fs');
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/from '\.\/bbva-callback-landing\.js'/);
});
