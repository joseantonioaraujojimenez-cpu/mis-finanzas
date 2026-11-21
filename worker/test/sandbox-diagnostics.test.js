import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {checkSandbox} from '../src/enable-sandbox-check.js';
import {PLANNED_CALLBACK} from '../src/enable-banking-contract.js';

const appId='12345678-1234-1234-1234-123456789abc';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
const app={kid:appId,environment:'SANDBOX',active:true,services:['AIS'],redirect_urls:[PLANNED_CALLBACK]};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});

test('unexpected Sandbox bank listing reports ASPSP stage and HTTP status without leaking secrets',async()=>{
 const urls=[];
 const transport=async(url,options)=>{
  urls.push(url);
  assert.match(options.headers.Authorization,/^Bearer /);
  return url.endsWith('/application')?response(app):response({unexpected:[]});
 };
 const result=await checkSandbox({appId,pem,transport});
 assert.deepEqual(result,{configured:true,verified:false,bbvaAvailable:false,reason:'provider_invalid_response',stage:'aspsps',httpStatus:200});
 assert.equal(urls.length,2);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE KEY|Bearer /);
});

test('malformed JSON from Sandbox application reports application stage',async()=>{
 const result=await checkSandbox({appId,pem,transport:async()=>({ok:true,status:200,json:async()=>{throw Error('invalid JSON');}})});
 assert.deepEqual(result,{configured:true,verified:false,bbvaAvailable:false,reason:'provider_invalid_response',stage:'application',httpStatus:200});
});
