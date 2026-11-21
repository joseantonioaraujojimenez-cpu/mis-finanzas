// Runs against a local Wrangler test Worker, never the production service.
const base=process.env.TEST_COORDINATOR_URL||'http://127.0.0.1:8788/test/coordinator';
async function op(path,payload={}){
 const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,payload})});
 if(!r.ok)throw Error(path+' returned '+r.status+': '+await r.text());
 return r.json();
}
function check(ok,message){if(!ok)throw Error(message)}
const challenge='A'.repeat(32);
const a=await op('/challenge/create',{kind:'login',challenge});
check(typeof a.id==='string','challenge ID missing');
const consumed=await op('/challenge/consume',{kind:'login',id:a.id});
check(consumed.challenge===challenge,'challenge not returned');
check((await op('/challenge/consume',{kind:'login',id:a.id})).challenge===null,'challenge replay allowed');
const concurrent=await op('/challenge/create',{kind:'login',challenge});
const parallel=await Promise.all(Array.from({length:8},()=>op('/challenge/consume',{kind:'login',id:concurrent.id})));
check(parallel.filter(x=>x.challenge===challenge).length===1,'concurrent challenge replay allowed');
const b=await op('/challenge/create',{kind:'register',challenge});
check((await op('/challenge/consume',{kind:'login',id:b.id})).challenge===null,'wrong challenge kind accepted');
check((await op('/challenge/consume',{kind:'register',id:b.id})).challenge===null,'wrong kind did not consume');
check((await op('/credential/get')).credential===null,'credential already exists in isolated test storage');
for(const invalid of [{id:'',publicKey:Array(32).fill(1),counter:0},{id:'bad',publicKey:[1,2],counter:0},{id:'bad',publicKey:Array(32).fill(256),counter:0},{id:'bad',publicKey:Array(32).fill(1),counter:-1}]){
 const rejected=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/credential/enroll',payload:{credential:invalid}})});
 check(rejected.status===400,'malformed credential accepted');
}
check((await op('/credential/get')).credential===null,'invalid credential stored');
check((await op('/credential/enroll',{credential:{id:'test-id',publicKey:Array(32).fill(1),counter:1}})).enrolled===true,'first enrollment failed');
check((await op('/credential/enroll',{credential:{id:'attacker-id',publicKey:Array(32).fill(3),counter:1}})).enrolled===false,'second enrollment accepted');
check((await op('/credential/get')).credential.id==='test-id','original credential overwritten');
check((await op('/credential/counter',{id:'test-id',counter:2})).updated===true,'counter advance rejected');
check((await op('/credential/counter',{id:'test-id',counter:2})).updated===false,'counter replay accepted');
check((await op('/credential/counter',{id:'attacker-id',counter:3})).updated===false,'wrong credential counter accepted');
const counterRace=await Promise.all(Array.from({length:8},()=>op('/credential/counter',{id:'test-id',counter:3})));
check(counterRace.filter(x=>x.updated).length===1,'concurrent counter replay accepted');
const session=await op('/session/create');
check(typeof session.token==='string'&&session.token.length>=64,'session token missing');
check((await op('/session/validate',{token:session.token})).valid===true,'session not valid');
check((await op('/session/revoke',{token:session.token})).revoked===true,'session not revoked');
check((await op('/session/validate',{token:session.token})).valid===false,'revoked session accepted');
for(let i=0;i<5;i++)check((await op('/rate/check',{action:'register'})).allowed===true,'registration limit too early');
check((await op('/rate/check',{action:'register'})).allowed===false,'registration limit not enforced');
for(let i=0;i<12;i++)check((await op('/rate/check',{action:'login'})).allowed===true,'login limit too early');
check((await op('/rate/check',{action:'login'})).allowed===false,'login limit not enforced');
// Concurrent requests must not exceed the registration quota.
// The initial five requests above already exhausted this window.
const rateRace=await Promise.all(Array.from({length:16},()=>op('/rate/check',{action:'register'})));
check(rateRace.every(x=>x.allowed===false),'concurrent requests bypassed rate limit');
// Invalid or missing session tokens must never authenticate.
check((await op('/session/validate',{token:'not-a-real-token'})).valid===false,'unknown token authenticated');
check((await op('/session/validate',{token:''})).valid===false,'empty token authenticated');
check((await op('/session/validate',{token:'x'.repeat(300)})).valid===false,'oversized token authenticated');
console.log('Durable Object integration: challenges, enrollment, counters, sessions, rate limits OK');
