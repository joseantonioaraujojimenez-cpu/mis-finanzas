import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineAisFlow} from '../src/bbva-offline-flow.js';
import {PLANNED_CALLBACK} from '../src/enable-banking-contract.js';
const now=Date.parse('2026-11-22T10:00:00Z'),token='a'.repeat(64),other='b'.repeat(64),sessionId='11111111-1111-4111-8111-111111111111',accountId='22222222-2222-4222-8222-222222222222';
const provider={status:'AUTHORIZED',aspsp:{name:'BBVA',country:'ES'},access:{valid_until:new Date(now+3600000).toISOString()},accounts:[accountId]};
function fixture(bindBrowserReturn=false){
 const map=new Map([['session:'+token,{epoch:1,expires:now+900000}],['session:'+other,{epoch:1,expires:now+900000}],['session_epoch',1]]);
 const calls=[];let callbackUrl;let override;
 const storage={transaction:async fn=>fn({get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k)})};
 const transport=async(url,init)=>{
  const path=new URL(url).pathname;calls.push(path);let data;
  if(path==='/auth'){
   const {state}=JSON.parse(init.body);callbackUrl=PLANNED_CALLBACK+'?state='+state+'&code=fixture-code';data={url:'https://bank.example/authorize'};
  }else if(path==='/sessions'){data={session_id:sessionId};}
  else if(path==='/sessions/'+sessionId){data=provider;}
  else if(path.endsWith('/balances')){data={balances:[{balance_type:'closingBooked',balance_amount:{amount:'100.00',currency:'EUR'}}]};}
  else if(path.endsWith('/transactions')){data={transactions:[{entry_reference:'a1',status:'BOOK',credit_debit_indicator:'DBIT',booking_date:'2026-11-21',transaction_amount:{amount:'25.30',currency:'EUR'},remittance_information:['MERCADONA']}],continuation_key:null};}
  else throw Error('Unexpected fixture route');
  return {ok:true,status:200,json:async()=>override?override(path,data):data};
 };
 const flow=createOfflineAisFlow({storage,transport,jwt:'fixture',clock:()=>now,bindBrowserReturn});
 return {flow,map,calls,callback:()=>callbackUrl,override:fn=>{override=fn;}};
}
const readOptions={token,accountId,from:'2026-11-01',to:'2026-11-22',scope:'Personal'};
test('offline owner flow completes consent and reads a classified snapshot',async()=>{
 const f=fixture();assert.deepEqual(await f.flow.begin({token}),{authorizationUrl:'https://bank.example/authorize'});
 assert.deepEqual(await f.flow.complete({token,callbackUrl:f.callback()}),{source:'offline-test',bankConnected:false,consentVerified:true,accountCount:1});
 const result=await f.flow.read(readOptions);
 assert.equal(result.expenseCents,2530);assert.equal(result.balances[0].amountCents,10000);assert.equal(result.movements[0].category,'Alimentación y hogar');
 assert.equal(result.bankConnected,false);assert.equal(f.calls.length,6);
 assert.ok(!JSON.stringify(result).includes(sessionId));
});
test('owner authentication, callback binding and consent are required',async()=>{
 const f=fixture();await assert.rejects(f.flow.begin({token:'invalid'}));assert.equal(f.calls.length,0);
 await f.flow.begin({token});await assert.rejects(f.flow.complete({token:other,callbackUrl:f.callback()}));assert.equal(f.calls.length,1);
 await f.flow.complete({token,callbackUrl:f.callback()});await assert.rejects(f.flow.complete({token,callbackUrl:f.callback()}));
 await assert.rejects(f.flow.read({...readOptions,accountId:sessionId}));assert.equal(f.calls.length,3);
});
test('revoked consent during read never returns a snapshot',async()=>{
 const f=fixture();await f.flow.begin({token});await f.flow.complete({token,callbackUrl:f.callback()});
 f.override((path,data)=>{if(path.endsWith('/balances'))f.map.set('session_epoch',2);return data;});
 await assert.rejects(f.flow.read(readOptions),/Consent no longer active/);
 assert.ok(f.calls.at(-1).endsWith('/balances'));
});
test('browser return binds a single-use ticket to the original active Face ID session',async()=>{
 const f=fixture(true),start=await f.flow.begin({token});
 assert.match(start.returnTicket,/^[a-f0-9]{64}$/);
 await assert.rejects(f.flow.complete({token,callbackUrl:f.callback()}));
 const result=await f.flow.completeFromReturn({ticket:start.returnTicket,callbackUrl:f.callback()});
 assert.equal(result.consentVerified,true);
 await assert.rejects(f.flow.completeFromReturn({ticket:start.returnTicket,callbackUrl:f.callback()}));
 assert.equal(f.calls.length,3);
});
test('browser return does not exchange a code after session logout',async()=>{
 const f=fixture(true),start=await f.flow.begin({token});
 f.map.delete('session:'+token);
 await assert.rejects(f.flow.completeFromReturn({ticket:start.returnTicket,callbackUrl:f.callback()}));
 assert.equal(f.calls.length,1);
});
