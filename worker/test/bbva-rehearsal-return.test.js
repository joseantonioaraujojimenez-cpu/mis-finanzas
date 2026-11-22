import test from 'node:test';
import assert from 'node:assert/strict';
import {issueRehearsalTicket,consumeRehearsalTicket,cancelRehearsalTicket,rehearsalCookie,readRehearsalCookie,rehearsalLanding} from '../src/bbva-rehearsal-return.js';
const token='a'.repeat(64),now=1000;
function fixture(){
 const map=new Map([['session:'+token,{expires:now+900000,epoch:1}],['session_epoch',1]]);
 let tail=Promise.resolve();
 const storage={transaction(fn){const result=tail.then(()=>fn({get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k)}));tail=result.catch(()=>{});return result;}};
 return {map,storage};
}
test('rehearsal returns once using original active session without exposing its token',async()=>{
 const {storage,map}=fixture(),ticket=await issueRehearsalTicket(storage,token,now);
 assert.match(ticket,/^[a-f0-9]{64}$/);assert.notEqual(ticket,token);
 assert.ok(![...map.keys()].some(k=>k.includes(ticket)));
 const results=await Promise.all(Array.from({length:5},()=>consumeRehearsalTicket(storage,ticket,now+10)));
 assert.equal(results.filter(Boolean).length,1);
});
test('rehearsal is disabled by expiry, logout, cancellation and reissue',async()=>{
 for(const mode of ['expiry','logout','cancel','reissue','epoch']){
  const {storage,map}=fixture(),ticket=await issueRehearsalTicket(storage,token,now);
  if(mode==='logout')map.delete('session:'+token);
  if(mode==='epoch')map.set('session_epoch',2);
  if(mode==='cancel')await cancelRehearsalTicket(storage,token);
  if(mode==='reissue')await issueRehearsalTicket(storage,token,now);
  assert.equal(await consumeRehearsalTicket(storage,ticket,mode==='expiry'?now+120000:now+10),false);
 }
});
test('cookie is narrowly scoped, short-lived, HttpOnly and never echoed in landing',async()=>{
 const {storage}=fixture(),ticket=await issueRehearsalTicket(storage,token,now);
 const cookie=rehearsalCookie(ticket);
 assert.match(cookie,/Path=\/bank\/rehearsal-return; Max-Age=120; Secure; HttpOnly; SameSite=Lax/);
 const pair=cookie.split(';')[0];assert.equal(readRehearsalCookie(pair),ticket);
 assert.equal(readRehearsalCookie(pair+'; '+pair),null);assert.equal(readRehearsalCookie(null),null);
 const response=rehearsalLanding(true);assert.equal(response.status,200);
 assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.ok(!(await response.text()).includes(ticket));
});
