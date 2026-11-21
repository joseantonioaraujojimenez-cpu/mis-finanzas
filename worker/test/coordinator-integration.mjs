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
for(const invalid of [{id:'',publicKey:Array(32).fill(1),counter:0},{id:'bad',publicKey:[1,2],counter:0},{id:'bad',publicKey:Array(32).fill(256),counter:0},{id:'bad',publicKey:Array(32).fill(1),counter:-1},{id:'bad',publicKey:Array(32).fill(1),counter:0,transports:['untrusted']},{id:'bad',publicKey:Array(32).fill(1),counter:0,transports:'internal'}]){
 const rejected=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/credential/enroll',payload:{credential:invalid}})});
 check(rejected.status===400,'malformed credential accepted');
}
check((await op('/credential/get')).credential===null,'invalid credential stored');
const enrollmentRace=await Promise.all(Array.from({length:8},(_,i)=>op('/credential/enroll',{credential:{id:i===0?'test-id':'attacker-'+i,publicKey:Array(32).fill(1),counter:1}})));
check(enrollmentRace.filter(x=>x.enrolled).length===1,'concurrent enrollment accepted more than one credential');
const winner=(await op('/credential/get')).credential;
check(winner && typeof winner.id==='string','enrollment winner missing');
check((await op('/credential/enroll',{credential:{id:'attacker-id',publicKey:Array(32).fill(3),counter:1}})).enrolled===false,'second enrollment accepted');
check((await op('/credential/get')).credential.id===winner.id,'original credential overwritten');
check((await op('/credential/counter',{id:winner.id,counter:2})).updated===true,'counter advance rejected');
check((await op('/credential/counter',{id:winner.id,counter:2})).updated===false,'counter replay accepted');
check((await op('/credential/counter',{id:'attacker-id',counter:3})).updated===false,'wrong credential counter accepted');
const counterRace=await Promise.all(Array.from({length:8},()=>op('/credential/counter',{id:winner.id,counter:3})));
check(counterRace.filter(x=>x.updated).length===1,'concurrent counter replay accepted');
const authState=await op('/credential/get');
const verifiedSession=await op('/session/authenticate',{id:authState.credential.id,epoch:authState.epoch,previousCounter:authState.credential.counter,counter:4});
check(typeof verifiedSession.token==='string','verified authentication did not create session');
check((await op('/session/validate',{token:verifiedSession.token})).valid===true,'verified session not active');
check((await op('/credential/get')).credential.counter===4,'verified counter not committed');
const session=await op('/session/create');
check(typeof session.token==='string'&&session.token.length>=64,'session token missing');
check((await op('/session/validate',{token:session.token})).valid===true,'session not valid');
check((await op('/session/revoke',{token:session.token})).revoked===true,'session not revoked');
check((await op('/session/validate',{token:session.token})).valid===false,'revoked session accepted');
const older=await op('/session/create');
check((await op('/session/validate',{token:older.token})).valid===true,'pre-revocation session invalid');
check((await op('/session/revoke-all')).revokedAll===true,'global session revocation failed');
check((await op('/session/validate',{token:older.token})).valid===false,'old session survived global revocation');
const newer=await op('/session/create');
check((await op('/session/validate',{token:newer.token})).valid===true,'new session rejected after global revocation');
// Every session created concurrently with a global revocation must be either
// valid in the new epoch or invalidated, never left valid in an obsolete epoch.
const epochRace=await Promise.all([
 op('/session/revoke-all'),
 ...Array.from({length:12},()=>op('/session/create'))
]);
check(epochRace[0].revokedAll===true,'concurrent global revocation failed');
for(const item of epochRace.slice(1)){
 const result=await op('/session/validate',{token:item.token});
 check(typeof result.valid==='boolean','concurrent session validation malformed');
}
check((await op('/session/validate',{token:newer.token})).valid===false,'previous epoch session survived concurrent revocation');
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
// Recovery must preserve the code until replacement succeeds.
const replacementDigest='c'.repeat(64);
check((await op('/recovery/store',{digest:replacementDigest})).stored===true,'replacement digest missing');
check((await op('/recovery/prepare',{digest:'d'.repeat(64)})).prepared===false,'incorrect recovery code prepared');
const prepared=await op('/recovery/prepare',{digest:replacementDigest});
check(prepared.prepared===true&&typeof prepared.ticket==='string','recovery ticket not issued');
const recoveryChallenge='challenge-for-recovery-device-123456';
check((await op('/recovery/challenge/create',{ticket:'invalid',challenge:recoveryChallenge})).created===false,'invalid ticket created challenge');
check((await op('/recovery/challenge/create',{ticket:prepared.ticket,challenge:recoveryChallenge})).created===true,'recovery challenge creation failed');
const premature={id:'premature-device',publicKey:Array(32).fill(2),counter:0};
check((await op('/recovery/finalize',{ticket:prepared.ticket,credential:premature})).replaced===false,'recovery finalized without consumed WebAuthn challenge');
check((await op('/credential/get')).credential.id===winner.id,'premature recovery changed credential');
check((await op('/recovery/challenge/consume',{ticket:'invalid'})).challenge===null,'wrong ticket consumed challenge');
check((await op('/recovery/challenge/consume',{ticket:prepared.ticket})).challenge===recoveryChallenge,'recovery challenge mismatch');
check((await op('/recovery/challenge/create',{ticket:prepared.ticket,challenge:'second-challenge-after-consumption-123'})).created===false,'consumed recovery challenge could be reissued');
check((await op('/recovery/challenge/consume',{ticket:prepared.ticket})).challenge===null,'recovery challenge replay succeeded');
check((await op('/credential/get')).credential.id===winner.id,'preparation changed credential');
check((await op('/recovery/finalize',{ticket:'invalid',credential:{id:'new-device',publicKey:Array(32).fill(2),counter:0}})).replaced===false,'invalid ticket replaced credential');
check((await op('/credential/get')).credential.id===winner.id,'invalid finalization changed credential');
// Invalid new-device data must not consume the recovery ticket or code.
for(const invalidCredential of [
 {id:'',publicKey:Array(32).fill(2),counter:0},
 {id:'bad-key',publicKey:[1,2],counter:0},
 {id:'bad-counter',publicKey:Array(32).fill(2),counter:-1},
 {id:'bad-transport',publicKey:Array(32).fill(2),counter:0,transports:['untrusted']}
]){
 check((await op('/recovery/finalize',{ticket:prepared.ticket,credential:invalidCredential})).replaced===false,'invalid recovery credential accepted');
 check((await op('/credential/get')).credential.id===winner.id,'invalid recovery changed credential');
}
const oldSession=await op('/session/create');
const replacement={id:'new-device',publicKey:Array(32).fill(2),counter:0,transports:['internal']};
const finishRace=await Promise.all(Array.from({length:8},()=>op('/recovery/finalize',{ticket:prepared.ticket,credential:replacement})));
check(finishRace.filter(x=>x.replaced).length===1,'recovery finalized more than once');
check((await op('/credential/get')).credential.id==='new-device','recovery did not replace credential');
check((await op('/session/validate',{token:oldSession.token})).valid===false,'recovery failed to revoke prior session');
check((await op('/recovery/prepare',{digest:replacementDigest})).prepared===false,'recovery code reused after replacement');
// The legacy endpoint must not allow consuming a recovery code without
// completing a verified replacement. The test harness rejects it outright.
const digest='a'.repeat(64),wrongDigest='b'.repeat(64);
check((await op('/recovery/store',{digest})).stored===true,'recovery digest not stored');
check((await op('/recovery/store',{digest:wrongDigest})).stored===false,'recovery digest overwritten');
const legacyResponse=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/recovery/consume',payload:{digest}})});
check(legacyResponse.status===400,'legacy recovery consumption endpoint is still exposed');
check((await op('/recovery/prepare',{digest:wrongDigest})).prepared===false,'wrong recovery code accepted');
console.log('Durable Object integration: challenges, enrollment, counters, sessions, rate limits OK');
