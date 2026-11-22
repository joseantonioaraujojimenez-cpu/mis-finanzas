import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetPreferences,calculateBudgetProgress} from '../src/finance-budget.js';
const now=Date.parse('2026-11-22T10:00:00Z'),token='fixture-token',accountId='11111111-1111-4111-8111-111111111111';
function fixture(){const map=new Map([['session:'+token,{expires:now+900000,epoch:1}],['session_epoch',1],['bbva:ais:consent',{sessionId:'fixture',expiresAt:now+3600000,accountIds:[accountId],ownerEpoch:1}]]);const tx={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v)};return {map,tx};}
const input={token,accountIndex:0,scope:'Personal',month:'2026-11',now};
test('budgets persist separately for month, account and scope',async()=>{
 const {tx}=fixture();assert.deepEqual(await budgetPreferences(tx,{...input,action:'get'}),{budgetCents:0,savingsGoalCents:0});
 await budgetPreferences(tx,{...input,action:'save',budgetCents:120000,savingsGoalCents:50000});
 assert.deepEqual(await budgetPreferences(tx,{...input,action:'get'}),{budgetCents:120000,savingsGoalCents:50000});
 assert.equal((await budgetPreferences(tx,{...input,scope:'Compartido',action:'get'})).budgetCents,0);
 assert.equal((await budgetPreferences(tx,{...input,month:'2026-10',action:'get'})).budgetCents,0);
});
test('budget preferences require a current authorized account and exact integer cents',async()=>{
 const {tx,map}=fixture();
 await assert.rejects(budgetPreferences(tx,{...input,accountIndex:1,action:'get'}));
 await assert.rejects(budgetPreferences(tx,{...input,action:'save',budgetCents:1.5,savingsGoalCents:0}));
 map.set('session_epoch',2);await assert.rejects(budgetPreferences(tx,{...input,action:'get'}));
});
test('budget and forecast reflect exact amounts and over-budget state',()=>{
 assert.deepEqual(calculateBudgetProgress({expenseCents:100000,incomeCents:140000,budgetCents:90000,savingsGoalCents:50000,daysElapsed:20,daysInMonth:30}),{remainingCents:-10000,savingsRemainingCents:10000,forecastExpenseCents:150000,overBudget:true});
 assert.equal(calculateBudgetProgress({expenseCents:1000,incomeCents:2000,budgetCents:0,savingsGoalCents:0,daysElapsed:30,daysInMonth:30}).forecastExpenseCents,1000);
});
