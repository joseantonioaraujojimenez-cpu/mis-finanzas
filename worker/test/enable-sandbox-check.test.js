import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify,createPrivateKey} from 'node:crypto';
import {signSandboxRequest,validateSandboxApplication,checkSandbox} from '../src/enable-sandbox-check.js';
import {PLANNED_CALLBACK} from '../src/enable-banking-contract.js';
const id='11111111-1111-4111-8111-111111111111';
const app={kid:id,environment:'SANDBOX',active:true,services:['AIS'],redirect_urls:[PLANNED_CALLBACK]};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
test('sandbox JWT uses a short-lived valid RS256 signature',async()=>{
 const jwt=await signSandboxRequest(id,privateKey,1700000000000),[header,payload,signature]=jwt.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')),{typ:'JWT',alg:'RS256',kid:id});
 const p=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(p.aud,'api.enablebanking.com');assert.equal(p.exp-p.iat,120);
 assert.equal(createVerify('RSA-SHA256').update(header+'.'+payload).verify(publicKey,Buffer.from(signature,'base64url')),true);
});
test('sandbox check does not read bank data or initiate authorization',async()=>{
 const calls=[];const transport=async(url,init)=>{calls.push({url,method:init.method,redirect:init.redirect});return {ok:true,json:async()=>calls.length===1?app:{aspsps:[{country:'ES',name:'BBVA'}]}};};
 const result=await checkSandbox({appId:id,pem:privateKey,transport});assert.equal(result.verified,true);assert.equal(result.bbvaAvailable,true);assert.deepEqual(calls.map(c=>c.method),['GET','GET']);assert.equal(calls[0].url,'https://api.enablebanking.com/application');assert.match(calls[1].url,/\/aspsps\?country=ES/);assert.ok(calls.every(c=>c.redirect==='error'));
});
test('production, missing callback and non-AIS apps are rejected before discovery',async()=>{
 for(const invalid of [{...app,environment:'PRODUCTION'},{...app,redirect_urls:[]},{...app,services:['AIS','PIS']}]){
  assert.equal(validateSandboxApplication(invalid,id),false);let calls=0;const result=await checkSandbox({appId:id,pem:privateKey,transport:async()=>{calls++;return {ok:true,json:async()=>invalid};}});assert.equal(result.verified,false);assert.equal(calls,1);
 }
});
test('missing configuration makes no network request',async()=>{
 const result=await checkSandbox({transport:async()=>{throw Error('Unexpected call');}});assert.equal(result.configured,false);
});
test('both PKCS#8 and PKCS#1 RSA keys are accepted without modifying the original',async()=>{
 const pkcs1=createPrivateKey(privateKey).export({type:'pkcs1',format:'pem'});
 assert.equal(await signSandboxRequest(id,pkcs1,1700000000000),await signSandboxRequest(id,privateKey,1700000000000));
 assert.equal(await signSandboxRequest(id,privateKey.replace(/\n/g,'\\n'),1700000000000),await signSandboxRequest(id,privateKey,1700000000000));
});
test('diagnostics distinguish invalid configuration and sanitized provider status',async()=>{
 const unused=async()=>{throw Error('Unexpected call');};
 assert.equal((await checkSandbox({appId:'invalid',pem:privateKey,transport:unused})).reason,'invalid_app_id');
 assert.equal((await checkSandbox({appId:id,pem:'invalid',transport:unused})).reason,'invalid_private_key');
 for(const [status,reason] of [[401,'provider_unauthorized'],[403,'provider_forbidden'],[404,'provider_not_found'],[429,'provider_rate_limited'],[500,'provider_unavailable']]){
  const result=await checkSandbox({appId:id,pem:privateKey,transport:async()=>({ok:false,status})});assert.equal(result.reason,reason);assert.equal(result.verified,false);
 }
});
