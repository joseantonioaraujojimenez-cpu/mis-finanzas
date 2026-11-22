// Read-only, offline AIS response validation. No bank connection or public routes.
import {balancesSpec,transactionsSpec} from './enable-banking-contract.js';
import {buildAisPreview} from './bbva-ais-preview.js';
const MAX_MOVEMENTS=500;
const money=/^-?\d{1,13}(?:\.\d{1,5})?$/;
function amount(value){
 if(!value||typeof value!=='object'||typeof value.amount!=='string'||!money.test(value.amount)||value.currency!=='EUR')throw Error('Invalid EUR amount');
 const negative=value.amount.startsWith('-');
 const [whole,fraction='']=value.amount.replace(/^-/, '').split('.');
 const padded=fraction.padEnd(3,'0');
 const cents=BigInt(whole)*100n+BigInt(padded.slice(0,2))+(Number(padded[2])>=5?1n:0n);
 if(cents>100000000000000n)throw Error('Amount exceeds safe range');
 return Number(negative?-cents:cents);
}
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid booking date');
 return value;
}
export function parseBalances(payload){
 if(!payload||!Array.isArray(payload.balances)||payload.balances.length>30)throw Error('Invalid balance response');
 return payload.balances.map(b=>{
  if(!b||typeof b.balance_type!=='string'||!b.balance_type||b.balance_type.length>80)throw Error('Invalid balance type');
  return Object.freeze({type:b.balance_type,amountCents:amount(b.balance_amount)});
 });
}
export function parseTransactions(payload){
 if(!payload||!Array.isArray(payload.transactions)||payload.transactions.length>MAX_MOVEMENTS)throw Error('Invalid transaction response');
 const seen=new Set();
 const movements=payload.transactions.map(t=>{
  if(!t||typeof t.transaction_id!=='string'||t.transaction_id.length<1||t.transaction_id.length>256||seen.has(t.transaction_id))throw Error('Invalid or duplicate transaction');
  seen.add(t.transaction_id);
  const cents=amount(t.transaction_amount);
  const booked=date(t.booking_date);
  const description=typeof t.remittance_information==='string'?t.remittance_information.slice(0,300):'';
  return Object.freeze({id:t.transaction_id,date:booked,amountCents:cents,description});
 });
 const continuation=payload.continuation_key;
 if(continuation!==undefined&&(typeof continuation!=='string'||continuation.length<1||continuation.length>2048))throw Error('Invalid pagination');
 return Object.freeze({movements,continuation:continuation||null});
}
export async function readMockableAccount({session,accountId,now,from,to,transport,jwt}){
 if(typeof transport!=='function'||typeof jwt!=='string'||!jwt)throw Error('AIS read transport disabled');
 const requests=[balancesSpec(session,accountId,now),transactionsSpec(session,accountId,{from,to},now)];
 const responses=[];
 for(const spec of requests){
  const response=await transport('https://api.enablebanking.com'+spec.path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'manual'});
  if(!response||response.ok!==true||response.status!==200||typeof response.json!=='function')throw Error('AIS provider rejected read');
  responses.push(await response.json());
 }
 return {balances:parseBalances(responses[0]),...parseTransactions(responses[1])};
}

// Complete, bounded read for tests. No partial snapshot is returned if a page
// fails, the consent expires, or the provider repeats a continuation key.
export async function readMockableAccountSnapshot({session,accountId,from,to,scope,transport,jwt,clock,maxPages=24}){
 if(typeof transport!=='function'||typeof jwt!=='string'||!jwt||typeof clock!=='function')throw Error('AIS read transport disabled');
 if(!['Personal','Compartido'].includes(scope)||!Number.isInteger(maxPages)||maxPages<1||maxPages>24)throw Error('Invalid snapshot options');
 const request=async spec=>{
  const response=await transport('https://api.enablebanking.com'+spec.path,{method:'GET',headers:{Authorization:'Bearer '+jwt,Accept:'application/json'},redirect:'manual'});
  if(!response||response.ok!==true||response.status!==200||typeof response.json!=='function')throw Error('AIS provider rejected read');
  const type=response.headers?.get?.('content-type');
  if(type!=null&&!/^application\/json(?:;|$)/i.test(type))throw Error('Unexpected provider response');
  return response.json();
 };
 // Validate both request contracts before the first read.
 const start=clock();
 const balanceRequest=balancesSpec(session,accountId,start);
 transactionsSpec(session,accountId,{from,to},start);
 const balances=parseBalances(await request(balanceRequest));
 const pages=[],seen=new Set();let continuation;
 do{
  if(pages.length>=maxPages)throw Error('AIS pagination limit exceeded');
  const page=parseTransactions(await request(transactionsSpec(session,accountId,{from,to,continuation},clock())));
  if(page.movements.some(m=>m.date<from||m.date>to))throw Error('Movement outside requested interval');
  pages.push(page);
  continuation=page.continuation||undefined;
  if(continuation){if(seen.has(continuation))throw Error('Repeated continuation');seen.add(continuation);}
 }while(continuation);
 balancesSpec(session,accountId,clock());
 return {balances,...buildAisPreview({pages,accountId,scope})};
}
