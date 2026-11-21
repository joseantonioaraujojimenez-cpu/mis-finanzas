import test from 'node:test';
import assert from 'node:assert/strict';
import {demoBankSnapshot,normalizeDemo} from '../src/bank-demo.js';

test('simulated import classifies entries, deduplicates and calculates cents exactly',()=>{
 const data=demoBankSnapshot();assert.equal(data.source,'simulated');assert.equal(data.movements.length,6);assert.equal(data.duplicates,1);assert.equal(data.reviewCount,1);assert.equal(data.incomeCents,240000);assert.equal(data.expenseCents,80175);assert.equal(data.balanceCents,159825);
 assert.equal(data.movements.find(m=>m.id==='05').category,'Ocio y deporte');assert.equal(data.movements.find(m=>m.id==='06').category,'Por clasificar');
});
test('refreshing a demo snapshot is deterministic and does not accumulate duplicates',()=>assert.deepEqual(demoBankSnapshot(),demoBankSnapshot()));
test('normalization refuses unsupported currencies and malformed amounts',()=>{
 const sample={id:'1',date:'2026-11-21',concept:'Demo',amount:'-1.23',currency:'EUR',scope:'personal'};
 assert.throws(()=>normalizeDemo([{...sample,currency:'USD'}]));assert.throws(()=>normalizeDemo([{...sample,amount:'1.234'}]));
});
test('ambiguous entries are flagged for review and same-id conflicts are rejected',()=>{
 const sample={id:'1',date:'2026-11-21',concept:'Demo',amount:'-1.23',currency:'EUR',scope:'personal'};
 assert.equal(normalizeDemo([sample]).movements[0].review,true);
 assert.throws(()=>normalizeDemo([sample,{...sample,amount:'-1.24'}]));
});
