import test from 'node:test';
import assert from 'node:assert/strict';
import {historyMonths,detectRecurring} from '../src/finance-recurring.js';
test('history selects three complete months including a year boundary',()=>{
 assert.deepEqual(historyMonths(new Date('2027-02-15T10:00:00Z')),[{from:'2026-11-01',to:'2026-11-30'},{from:'2026-12-01',to:'2026-12-31'},{from:'2027-01-01',to:'2027-01-31'}]);
});
const expense=(month,concept,amountCents,day='03')=>({date:`2026-${month}-${day}`,concept,amountCents,category:'Finanzas y otros'});
test('recurring candidates require three monthly observations of reasonably stable amounts',()=>{
 const snapshots=['08','09','10'].map((m,i)=>({movements:[expense(m,'CUOTA HIPOTECA',-60000),expense(m,'NETFLIX',-1299-i*10),expense(m,'PAGO',-300),expense(m,'INGRESO',5000),expense(m,'SUPERMERCADO',-500),expense(m,'SUPERMERCADO',-450,'10')]}));
 snapshots[0].movements.push(expense('08','Único',-500));
 const result=detectRecurring(snapshots);
 assert.equal(result.items.length,2);assert.equal(result.estimatedMonthlyCents,61309);assert.equal(result.items[0].concept,'CUOTA HIPOTECA');
});
test('unstable dates and amounts do not become recurring estimates',()=>{
 const snapshots=['08','09','10'].map((m,i)=>({movements:[expense(m,'COMERCIO',-1000-i*1000),expense(m,'OTRO',-1000,i===1?'20':'03')]}));
 assert.deepEqual(detectRecurring(snapshots),{items:[],estimatedMonthlyCents:0});
});
