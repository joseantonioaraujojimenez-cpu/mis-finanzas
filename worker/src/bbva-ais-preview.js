// Offline adapter: parsed AIS movements -> MIS FINANZAS review-ready model.
// Never combines simulated/demo data with a real provider dataset.
// No network calls, account persistence or public endpoints.
const rules=[
 [/\b(hipoteca|alquiler)\b/,'Vivienda'],
 [/\b(supermercado|alimentacion|mercadona|carrefour|lidl)\b/,'Alimentación y hogar'],
 [/\b(gasolina|gasolinera|repsol|cepsa|transporte)\b/,'Transporte'],
 [/\b(padel|deporte|gimnasio|ocio)\b/,'Ocio y deporte'],
 [/\b(mascotas|veterinario)\b/,'Familia y mascotas'],
 [/\b(prestamo|comision|cuota)\b/,'Finanzas y otros']
];
function classify(description,amountCents){
 if(amountCents>0)return {category:'Ingresos',review:false};
 const normalized=description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const rule=rules.find(([pattern])=>pattern.test(normalized));
 return rule?{category:rule[1],review:false}:{category:'Por clasificar',review:true};
}
export function buildAisPreview({pages,accountId,scope='Personal'}){
 if(typeof accountId!=='string'||!accountId||accountId.length>256)throw Error('Invalid account');
 if(!['Personal','Compartido'].includes(scope))throw Error('Invalid scope');
 if(!Array.isArray(pages)||pages.length<1||pages.length>24)throw Error('Invalid pages');
 const items=new Map();let duplicates=0;
 for(const page of pages){
  if(!page||!Array.isArray(page.movements)||page.movements.length>500)throw Error('Invalid page');
  for(const m of page.movements){
   if(!m||typeof m.id!=='string'||!m.id||m.id.length>256||typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isSafeInteger(m.amountCents)||Math.abs(m.amountCents)>1e14||typeof m.description!=='string'||m.description.length>300)throw Error('Invalid movement');
   const key=JSON.stringify([accountId,m.id]);
   const previous=items.get(key);
   if(previous){
    if(previous.date!==m.date||previous.amountCents!==m.amountCents||previous.concept!==m.description)throw Error('Conflicting duplicate');
    duplicates++;continue;
   }
   items.set(key,{id:m.id,accountId,date:m.date,concept:m.description,amount:m.amountCents/100,amountCents:m.amountCents,scope,...classify(m.description,m.amountCents)});
  }
 }
 const movements=[...items.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const safeAdd=(a,b)=>{const result=a+b;if(!Number.isSafeInteger(result))throw Error('Total exceeds safe range');return result;};
 const incomeCents=movements.reduce((n,m)=>safeAdd(n,Math.max(0,m.amountCents)),0);
 const expenseCents=movements.reduce((n,m)=>safeAdd(n,Math.max(0,-m.amountCents)),0);
 return {source:'ais-preview',bankConnected:false,requiresReview:true,accountId,movements,duplicates,reviewCount:movements.filter(m=>m.review).length,incomeCents,expenseCents,balanceCents:incomeCents-expenseCents};
}
