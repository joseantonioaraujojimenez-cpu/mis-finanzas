import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const web=readFileSync(new URL('../../passkey-test.html',import.meta.url),'utf8');

test('passkey registration and login remain disabled until review',()=>{
 assert.match(worker,/FAIL CLOSED/);
 for(const route of ['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'])
  assert.ok(worker.includes("'"+route+"'"),route+' must be disabled');
 assert.match(worker,/pending integration tests and security review/);
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

test('Durable Object rate limiting is atomic and applied before passkey options',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/path==='\/rate\/check'/);
 assert.match(coordinator,/const allowed=await store\.transaction/);
 assert.match(worker,/state\(env,'\/rate\/check'/);
 assert.match(worker,/Too many attempts/);
});

test('rate limits cover both options and verification endpoints',()=>{
 for(const route of ['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'])
  assert.ok(worker.includes("'"+route+"'"),route);
 assert.match(worker,/\['\/auth\/register\/options','\/auth\/register\/verify','\/auth\/login\/options','\/auth\/login\/verify'\]\.includes\(url\.pathname\)/);
});
test('worker requires JSON and exact origin for authentication',()=>{
 assert.match(worker,/origin!==ORIGIN/);
 assert.match(worker,/application\/json/);
 assert.match(worker,/JSON required/);
});

test('authenticator counter cannot decrease or reset to zero',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/c\.counter>0&&input\.counter<=c\.counter/);
});

test('logout revokes the server-side session rather than only hiding the UI',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(worker,/url\.pathname==='\/auth\/logout'/);
 assert.match(worker,/state\(env,'\/session\/revoke'/);
 assert.match(coordinator,/path==='\/session\/revoke'/);
 assert.match(coordinator,/await store\.delete\('session:'\+input\.token\)/);
});

test('expired or mismatched challenges are removed atomically',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/if\(!item\)return null;\s*await tx\.delete\(key\);/);
 assert.match(coordinator,/item\.expires<=Date\.now\(\)/);
});

test('production config has no placeholder KV namespace',()=>{
 const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
 assert.doesNotMatch(config,/REPLACE_WITH_EXISTING_KV_NAMESPACE_ID/);
 assert.doesNotMatch(config,/"AUTH_KV"/);
});

test('expired sessions are removed and never treated as authenticated',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/record&&record\.expires<=Date\.now\(\)/);
 assert.match(coordinator,/await tx\.delete\(key\)/);
 assert.match(coordinator,/const valid=await store\.transaction\(async tx/);
 assert.match(coordinator,/record\.epoch===epoch/);
});

test('coordinator bounds untrusted challenge, flow and session token sizes',()=>{
 const coordinator=readFileSync(new URL('../src/passkey-coordinator.js',import.meta.url),'utf8');
 assert.match(coordinator,/input\.challenge\.length<16/);
 assert.match(coordinator,/input\.challenge\.length>1024/);
 assert.match(coordinator,/input\.id\.length>128/);
 assert.match(coordinator,/input\.token\.length>256/);
});

test('unsupported HTTP methods are rejected at entry point',()=>{
 assert.match(worker,/request\.method!=='GET' && request\.method!=='POST'/);
 assert.match(worker,/Method not allowed/);
});

test('public service status reports passkeys disabled until review',()=>{
 assert.match(worker,/passkeys:'disabled pending review'/);
 assert.match(worker,/request\.method==='GET'/);
});

test('authentication responses carry defensive browser headers',()=>{
 for(const header of ['Referrer-Policy','X-Frame-Options','Content-Security-Policy','X-Content-Type-Options'])
  assert.ok(worker.includes(header),header);
});

test('only explicitly listed authentication routes are recognized',()=>{
 assert.match(worker,/if\(!\['\/auth\/register\/options'/);
 assert.match(worker,/url\.pathname\)\)return json\(\{error:'Not found'\},404,h\)/);
});

test('authentication JSON body is bounded in UTF-8 bytes and must be an object',()=>{
 assert.match(worker,/new TextEncoder\(\)\.encode\(body\)\.byteLength>16384/);
 assert.match(worker,/Array\.isArray\(parsed\)/);
 assert.match(worker,/JSON object required/);
});

test('bootstrap secret is compared as UTF-8 bytes, not UTF-16 code units',()=>{
 assert.match(worker,/new TextEncoder\(\)\.encode\(a\)/);
 assert.match(worker,/new TextEncoder\(\)\.encode\(b\)/);
 assert.match(worker,/diff=aa\.length\^bb\.length/);
});


test('recovery code has 256 bits of random entropy and is never persisted as plaintext',async()=>{
 const {generateRecoveryCode,recoveryDigest}=await import('../src/recovery-code.js');
 const a=generateRecoveryCode(),b=generateRecoveryCode();
 assert.match(a,/^[a-f0-9]{8}(?:-[a-f0-9]{8}){7}$/);
 assert.notEqual(a,b);
 const digest=await recoveryDigest(a);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.equal(digest,await recoveryDigest(a.toUpperCase()));
 assert.notEqual(digest,await recoveryDigest(b));
 await assert.rejects(()=>recoveryDigest('1234'),TypeError);
 const source=readFileSync(new URL('../src/recovery-code.js',import.meta.url),'utf8');
 assert.match(source,/crypto\.getRandomValues\(bytes\)/);
 assert.match(source,/crypto\.subtle\.digest\('SHA-256'/);
});

// Recovery tickets alone are NOT proof of WebAuthn verification.
// Keep recovery unreachable from the public Worker until challenge-bound
// registration verification is implemented and independently reviewed.
test('recovery cannot be invoked from public Worker routes',()=>{
 const routes=worker.match(/if\(!\['\/auth\/register\/options'[\s\S]*?\.includes\(url\.pathname\)\)return json\(\{error:'Not found'\},404,h\);/);
 assert.ok(routes,'public route allowlist missing');
 assert.doesNotMatch(routes[0],/\/auth\/recovery|\/recovery\/prepare|\/recovery\/finalize/);
 assert.doesNotMatch(worker,/state\(env,'\/recovery\/(?:prepare|finalize)'/);
});

test('recovery verification requires real WebAuthn attestation and user verification',()=>{
 const recovery=readFileSync(new URL('../src/recovery-webauthn.js',import.meta.url),'utf8');
 assert.match(recovery,/verifyRegistrationResponse\(/);
 assert.match(recovery,/expectedChallenge:challenge/);
 assert.match(recovery,/expectedOrigin:origin/);
 assert.match(recovery,/expectedRPID:rpID/);
 assert.match(recovery,/requireUserVerification:true/);
 assert.match(recovery,/if\(!result\.verified\|\|!result\.registrationInfo\)/);
 assert.doesNotMatch(worker,/from '\.\/recovery-webauthn\.js'/);
});

test('internal recovery flow verifies WebAuthn before replacing credential',()=>{
 const flow=readFileSync(new URL('../src/recovery-flow.js',import.meta.url),'utf8');
 assert.match(flow,/verifyRecoveryRegistration\(\{response,challenge,origin,rpID\}\)/);
 assert.match(flow,/const credential=await verifyRecoveryRegistration/);
 assert.match(flow,/const \{replaced\}=await coordinator\('\/recovery\/finalize',\{ticket,credential\}\)/);
 assert.ok(flow.indexOf('await verifyRecoveryRegistration')<flow.indexOf("await coordinator('/recovery/finalize'"));
 assert.doesNotMatch(worker,/from '\.\/recovery-flow\.js'/);
});


test('recovery flow binds registration challenge to ticket and refuses finalize after failed attestation',async()=>{
 const {beginRecoveryRegistration,completeRecoveryRegistration}=await import('../src/recovery-flow.js');
 const calls=[];
 const coordinator=async(route,payload)=>{
  calls.push({route,payload});
  if(route==='/recovery/challenge/create')return {created:true};
  if(route==='/recovery/challenge/consume')return {challenge:'server-generated-recovery-challenge-123456'};
  if(route==='/recovery/finalize')return {replaced:true};
  throw new Error('Unexpected coordinator route');
 };
 const options=await beginRecoveryRegistration({ticket:'opaque-ticket',coordinator,rpID:'example.com',rpName:'Mis Finanzas'});
 assert.equal(typeof options.challenge,'string');
 assert.equal(calls[0].route,'/recovery/challenge/create');
 assert.equal(calls[0].payload.ticket,'opaque-ticket');
 assert.equal(calls[0].payload.challenge,options.challenge);
 await assert.rejects(()=>completeRecoveryRegistration({ticket:'opaque-ticket',response:{id:'forged'},coordinator,origin:'https://example.com',rpID:'example.com'}));
 assert.equal(calls.filter(x=>x.route==='/recovery/finalize').length,0,'failed WebAuthn must never finalize recovery');
});

test('recovery flow refuses to issue options for an invalid or expired ticket',async()=>{
 const {beginRecoveryRegistration}=await import('../src/recovery-flow.js');
 await assert.rejects(()=>beginRecoveryRegistration({ticket:'',coordinator:async()=>({created:false}),rpID:'example.com',rpName:'Mis Finanzas'}),TypeError);
 await assert.rejects(()=>beginRecoveryRegistration({ticket:'expired-ticket',coordinator:async()=>({created:false}),rpID:'example.com',rpName:'Mis Finanzas'}),/expired/);
});


test('recovery primitives remain unreachable from public Worker routes',()=>{
 assert.match(worker,/if\(!url\.pathname\.startsWith\('\/auth\/'\)\)return json\(\{error:'Not found'\},404,h\)/);
 assert.doesNotMatch(worker,/\/recovery\/(?:store|consume|prepare|challenge\/create|challenge\/consume|finalize)/);
 assert.doesNotMatch(worker,/from '\.\/recovery-flow\.js'/);
 assert.doesNotMatch(worker,/from '\.\/recovery-code\.js'/);
 assert.match(worker,/disabled pending integration tests and security review/);
});


test('staging Worker name cannot overwrite the existing production Worker',()=>{
 const config=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
 assert.match(config,/"name":\s*"mis-finanzas-auth-staging"/);
 assert.doesNotMatch(config,/"name":\s*"mis-finanzas-bbva"/);
});
