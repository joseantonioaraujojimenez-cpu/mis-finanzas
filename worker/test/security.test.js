import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const web=readFileSync(new URL('../../passkey-test.html',import.meta.url),'utf8');

test('passkey registration and login are disabled pending atomic challenge storage',()=>{
 assert.match(worker,/FAIL CLOSED/);
 for(const route of ['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'])
  assert.ok(worker.includes("'"+route+"'"),route+' must be disabled');
 assert.match(worker,/pending atomic storage implementation/);
});
test('no BBVA endpoints exposed in unfinished worker',()=>{
 assert.doesNotMatch(worker,/\/api\/transactions|\/api\/accounts|\/api\/balances/);
});
test('private key and API access token never embedded in public page',()=>{
 assert.doesNotMatch(web,/ENABLE_PRIVATE_KEY|API_ACCESS_TOKEN|BEGIN PRIVATE KEY/);
});
test('web app uses configured github pages origin as WebAuthn RP',()=>{
 assert.match(worker,/const RP_ID = 'joseantonioaraujojimenez-cpu.github.io'/);
 assert.match(worker,/const ORIGIN = 'https:\/\/joseantonioaraujojimenez-cpu.github.io'/);
});

test('Durable Object has transactional challenge consumption and first enrollment',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/store\.transaction\(async tx/);
 assert.match(coordinator,/await tx\.delete\(key\)/);
 assert.match(coordinator,/if\(await tx\.get\('owner_credential'\)\)return false/);
});
test('Cloudflare declares Durable Object and SQLite migration',()=>{
 const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
 assert.match(config,/"PASSKEY_COORDINATOR"/);
 assert.match(config,/"new_sqlite_classes"/);
});
