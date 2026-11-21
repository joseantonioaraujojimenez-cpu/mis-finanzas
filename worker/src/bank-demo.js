// Local fixture only. No external provider calls, credentials or real accounts.
const fixture=[
 ['01','2026-11-01','2400.00','NÓMINA DE EJEMPLO','personal'],
 ['02','2026-11-03','-620.00','HIPOTECA DEMO','shared'],
 ['03','2026-11-14','-86.50','SUPERMERCADO DEMO','shared'],
 ['04','2026-11-17','-49.90','GASOLINA DEMO','personal'],
 ['05','2026-11-20','-28.00','PÁDEL DEMO','personal'],
 ['06','2026-11-20','-17.35','COMERCIO SIN CLASIFICAR DEMO','personal'],
 ['03','2026-11-14','-86.50','SUPERMERCADO DEMO','shared']
].map(([id,date,amount,concept,scope])=>({id,date,amount,concept,scope,currency:'EUR'}));
const rules=[[/\b(hipoteca|alquiler)\b/,'Vivienda'],[/\b(supermercado|alimentacion)\b/,'Alimentación y hogar'],[/\b(gasolina|transporte)\b/,'Transporte'],[/\b(padel|deporte|ocio)\b/,'Ocio y deporte'],[/\b(mascotas|veterinario)\b/,'Familia y mascotas'],[/\b(prestamo|comision)\b/,'Finanzas y otros']];
function cents(value){
 if(typeof value!=='string'||!/^[-+]?\d{1,9}\.\d{2}$/.test(value))throw Error('Invalid amount');
 const [whole,fraction]=value.replace(/^[-+]/,'').split('.');return (Number(whole)*100+Number(fraction))*(value.startsWith('-')?-1:1);
}
function classify(concept,amount){
 if(amount>0)return {category:'Ingresos',review:false};
 const normalized=concept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const result=rules.find(([pattern])=>pattern.test(normalized));
 return result?{category:result[1],review:false}:{category:'Por clasificar',review:true};
}
export function normalizeDemo(rows){
 const entries=new Map();let duplicates=0;
 for(const row of rows){
  if(!row||typeof row.id!=='string'||!row.id||row.currency!=='EUR'||typeof row.concept!=='string'||!row.concept.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!['personal','shared'].includes(row.scope))throw Error('Invalid demo transaction');
  const amount=cents(row.amount);if(!amount)throw Error('Invalid zero amount');
  const item={id:row.id,date:row.date,concept:row.concept,amount:amount/100,amountCents:amount,scope:row.scope==='shared'?'Compartido':'Personal',...classify(row.concept,amount)};
  if(entries.has(row.id)){if(JSON.stringify(entries.get(row.id))!==JSON.stringify(item))throw Error('Conflicting duplicate');duplicates++;continue;}
  entries.set(row.id,item);
 }
 const movements=[...entries.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const incomeCents=movements.reduce((sum,m)=>sum+Math.max(0,m.amountCents),0),expenseCents=movements.reduce((sum,m)=>sum+Math.max(0,-m.amountCents),0);
 return {movements,duplicates,reviewCount:movements.filter(m=>m.review).length,incomeCents,expenseCents,balanceCents:incomeCents-expenseCents};
}
export function demoBankSnapshot(){return {source:'simulated',...normalizeDemo(fixture)};}
