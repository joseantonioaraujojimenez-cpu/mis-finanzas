import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAisPreview} from '../src/bbva-ais-preview.js';
const accountId='11111111-1111-4111-8111-111111111111';
const a={id:'a',date:'2026-11-21',amountCents:-2530,description:'MERCADONA'};
const b={id:'b',date:'2026-11-20',amountCents:240000,description:'NOMINA'};
test('AIS preview maps income and expense and categorizes without mixing demo data',()=>{
 const p=buildAisPreview({accountId,pages:[{movements:[a,b]}]});
 assert.equal(p.source,'ais-preview');
 assert.equal(p.bankConnected,false);
 assert.equal(p.requiresReview,true);
 assert.equal(p.incomeCents,240000);
 assert.equal(p.expenseCents,2530);
 assert.equal(p.movements.find(m=>m.id==='a').category,'Alimentación y hogar');
 assert.equal(p.movements.find(m=>m.id==='b').category,'Ingresos');
});
test('AIS pagination deduplicates identical movements and rejects conflicts',()=>{
 const p=buildAisPreview({accountId,pages:[{movements:[a]},{movements:[a,b]}]});
 assert.equal(p.duplicates,1);
 assert.equal(p.movements.length,2);
 assert.throws(()=>buildAisPreview({accountId,pages:[{movements:[a]},{movements:[{...a,amountCents:-2600}]}]}));
});
test('unknown expense stays reviewable and scope must be explicit',()=>{
 const p=buildAisPreview({accountId,scope:'Compartido',pages:[{movements:[{...a,description:'OTRO COMERCIO'}]}]});
 assert.equal(p.reviewCount,1);
 assert.equal(p.movements[0].scope,'Compartido');
 assert.throws(()=>buildAisPreview({accountId,scope:'Other',pages:[{movements:[a]}]}));
});
test('invalid monetary values and oversized pages are rejected',()=>{
 assert.throws(()=>buildAisPreview({accountId,pages:[{movements:[{...a,amountCents:NaN}]}]}));
 assert.throws(()=>buildAisPreview({accountId,pages:Array.from({length:25},()=>({movements:[]}))}));
});
test('aggregate monetary values must remain exactly representable',()=>{
 const movements=Array.from({length:100},(_,i)=>({...b,id:String(i),amountCents:100000000000000}));
 assert.throws(()=>buildAisPreview({accountId,pages:[{movements}]}),/safe range/);
});
test('category summary uses exact cents and excludes income',()=>{
 const p=buildAisPreview({accountId,pages:[{movements:[a,b,{...a,id:'c',amountCents:-100,description:'IBERDROLA'},{...a,id:'d',amountCents:-250,description:'MERCADONA'},{...a,id:'e',amountCents:-70,description:'OTRO COMERCIO'}]}]});
 assert.deepEqual(p.categories,[{category:'Alimentación y hogar',amountCents:2780,count:2},{category:'Suministros',amountCents:100,count:1},{category:'Por clasificar',amountCents:70,count:1}]);
 assert.equal(p.categories.reduce((n,c)=>n+c.amountCents,0),p.expenseCents);
 assert.equal(p.reviewCount,1);
});
