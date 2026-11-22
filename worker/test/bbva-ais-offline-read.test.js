import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBalances,parseTransactions,readMockableAccount,readMockableAccountSnapshot} from '../src/bbva-ais-offline-read.js';
const account='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-11-21T12:00:00Z');
const session={status:'AUTHORIZED',aspsp:{name:'BBVA',country:'ES'},access:{valid_until:'2026-11-22T12:00:00Z'},accounts:[account]};
const balance={balances:[{balance_type:'closingBooked',balance_amount:{amount:'1025.50',currency:'EUR'}}]};
const transactions={transactions:[{transaction_id:'t-1',booking_date:'2026-11-21',transaction_amount:{amount:'-25.30',currency:'EUR'},remittance_information:'Compra'}],continuation_key:'next'};
test('mocked EUR balances and debit movements are parsed into cents',()=>{
 assert.deepEqual(parseBalances(balance),[{type:'closingBooked',amountCents:102550}]);
 const result=parseTransactions(transactions);
 assert.equal(result.movements[0].amountCents,-2530);
 assert.equal(result.movements[0].description,'Compra');
 assert.equal(result.continuation,'next');
});
test('malformed balances, duplicate movements and non-EUR data fail closed',()=>{
 assert.throws(()=>parseBalances({balances:[{balance_type:'x',balance_amount:{amount:'1',currency:'USD'}}]}));
 assert.throws(()=>parseTransactions({transactions:[transactions.transactions[0],transactions.transactions[0]]}));
 assert.throws(()=>parseTransactions({transactions:[{...transactions.transactions[0],booking_date:'2026-02-30'}]}));
});
test('offline AIS read makes only two mocked GET requests',async()=>{
 const calls=[];
 const data=await readMockableAccount({session,accountId:account,now,from:'2026-11-01',to:'2026-11-21',jwt:'mock-jwt',transport:async(url,init)=>{
  calls.push({url,init});return {ok:true,status:200,json:async()=>calls.length===1?balance:transactions};
 }});
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.init.method==='GET'&&c.url.startsWith('https://api.enablebanking.com/accounts/')));
 assert.equal(data.movements.length,1);
});
test('unauthorized account and missing transport never contact the provider',async()=>{
 let calls=0;
 await assert.rejects(readMockableAccount({session,accountId:'22222222-2222-4222-8222-222222222222',now,from:'2026-11-01',to:'2026-11-21',jwt:'mock-jwt',transport:async()=>{calls++}}));
 await assert.rejects(readMockableAccount({session,accountId:account,now,from:'2026-11-01',to:'2026-11-21',jwt:'mock-jwt'}));
 assert.equal(calls,0);
});
const snapshotOptions={session,accountId:account,from:'2026-11-01',to:'2026-11-21',scope:'Personal',jwt:'fixture',clock:()=>now};
test('snapshot reads all pages and combines only the authorized account',async()=>{
 const calls=[];
 const snapshot=await readMockableAccountSnapshot({...snapshotOptions,transport:async(url,init)=>{
  calls.push({url,init});return {ok:true,status:200,json:async()=>calls.length===1?balance:calls.length===2?transactions:{transactions:[transactions.transactions[0]]}};
 }});
 assert.equal(calls.length,3);
 assert.equal(new URL(calls[2].url).searchParams.get('continuation_key'),'next');
 assert.equal(snapshot.movements.length,1);
 assert.equal(snapshot.duplicates,1);
 assert.equal(snapshot.expenseCents,2530);
 assert.equal(snapshot.bankConnected,false);
 assert.ok(calls.every(c=>c.init.method==='GET'));
});
test('snapshot does not return incomplete data on repeated pagination or page limit',async()=>{
 const transport=async url=>({ok:true,status:200,json:async()=>url.includes('/balances')?balance:transactions});
 await assert.rejects(readMockableAccountSnapshot({...snapshotOptions,transport}),/Repeated continuation/);
 await assert.rejects(readMockableAccountSnapshot({...snapshotOptions,transport,maxPages:1}),/pagination limit/);
});
test('snapshot stops reading when consent expires',async()=>{
 let calls=0;
 await assert.rejects(readMockableAccountSnapshot({...snapshotOptions,clock:()=>calls?Date.parse(session.access.valid_until):now,transport:async()=>{calls++;return {ok:true,status:200,json:async()=>balance};}}),/Account not authorized/);
 assert.equal(calls,1);
});
test('money is rounded symmetrically with exact decimal arithmetic',()=>{
 const amounts=['1.005','-1.005','0.004','9999999999999.99'];
 const balances=amounts.slice(0,3).map(amount=>({balance_type:'booked',balance_amount:{amount,currency:'EUR'}}));
 assert.deepEqual(parseBalances({balances}).map(x=>x.amountCents),[101,-101,0]);
 assert.throws(()=>parseBalances({balances:[{balance_type:'booked',balance_amount:{amount:amounts[3],currency:'EUR'}}]}),/safe range/);
});
