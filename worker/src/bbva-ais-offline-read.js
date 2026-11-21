// Read-only, offline AIS response validation. No bank connection or public routes.
import {balancesSpec,transactionsSpec} from './enable-banking-contract.js';
const MAX_MOVEMENTS=500;
const money=/^-?\d{1,15}(?:\.\d{1,5})?$/;
function amount(value){
 if(!value||typeof value!=='object'||typeof value.amount!=='string'||!money.test(value.amount)||value.currency!=='EUR')throw Error('Invalid EUR amount');
 const n=Number(value.amount);
 if(!Number.isFinite(n))throw Error('Invalid amount');
 return Math.round(n*100);
}
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid booking date');
 return value;
}
export function parseBalances(payload){
 if(!payload||!Array.isArray(payload.balances)||payload.balances.length>30)throw Error('Invalid balance response');
 return payload.balances.map(b=>{
  if(typeof b.balance_type!=='string'||b.balance_type.length>80)throw Error('Invalid balance type');
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
