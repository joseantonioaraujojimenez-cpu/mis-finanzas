// Conservative detection on three complete calendar months of one account.
export function historyMonths(now=new Date()){
 const result=[];for(let i=3;i>=1;i--){const first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0));result.push({from:first.toISOString().slice(0,10),to:last.toISOString().slice(0,10)});}return result;
}
export function detectRecurring(snapshots){
 if(!Array.isArray(snapshots)||snapshots.length!==3)throw Error('Three complete months required');
 const groups=new Map();
 for(const [index,snapshot] of snapshots.entries()){
  if(!Array.isArray(snapshot.movements))throw Error('Invalid movements');
  for(const m of snapshot.movements){
   if(!Number.isSafeInteger(m.amountCents)||m.amountCents>=0||typeof m.concept!=='string')continue;
   const key=m.concept.normalize('NFKC').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
   if(key.length<3||/^(compra|pago|transferencia|recibo|tarjeta|bizum)$/.test(key))continue;
   const rows=groups.get(key)||[[],[],[]];rows[index].push(m);groups.set(key,rows);
  }
 }
 const result=[];
 for(const rows of groups.values()){
  if(!rows.every(r=>r.length===1))continue;
  const items=rows.flat(),amounts=items.map(m=>-m.amountCents),days=items.map(m=>Number(m.date.slice(8,10)));
  if(Math.max(...days)-Math.min(...days)>7)continue;
  const median=[...amounts].sort((a,b)=>a-b)[1];
  if(Math.max(...amounts)-Math.min(...amounts)>Math.max(100,median*0.15))continue;
  result.push({concept:items[2].concept,category:items[2].category,estimatedMonthlyCents:median,lastDate:items[2].date,occurrences:3});
 }
 result.sort((a,b)=>b.estimatedMonthlyCents-a.estimatedMonthlyCents);
 const total=result.reduce((sum,item)=>sum+BigInt(item.estimatedMonthlyCents),0n);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Total exceeds safe range');
 return {items:result,estimatedMonthlyCents:Number(total)};
}
