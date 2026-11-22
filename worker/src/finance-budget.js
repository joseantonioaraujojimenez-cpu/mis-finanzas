import {readVerifiedConsent} from './bbva-consent-vault.js';
const MONTH=/^20\d{2}-(0[1-9]|1[0-2])$/;
const validAmount=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
export async function budgetPreferences(tx,{token,accountIndex,scope,month,action,budgetCents,savingsGoalCents,now=Date.now()}){
 if(!Number.isInteger(accountIndex)||accountIndex<0||!['Personal','Compartido'].includes(scope)||typeof month!=='string'||!MONTH.test(month)||!['get','save'].includes(action))throw Error('Invalid budget preferences');
 const consent=await readVerifiedConsent(tx,{token,now});
 if(!consent||accountIndex>=consent.accountIds.length)throw Error('Account not authorized');
 const key=`finance:budget:${consent.accountIds[accountIndex]}:${scope}:${month}`;
 if(action==='save'){
  if(!validAmount(budgetCents)||!validAmount(savingsGoalCents))throw Error('Invalid budget amount');
  const record={budgetCents,savingsGoalCents};await tx.put(key,record);return record;
 }
 const stored=await tx.get(key);
 return stored&&validAmount(stored.budgetCents)&&validAmount(stored.savingsGoalCents)?stored:{budgetCents:0,savingsGoalCents:0};
}
export function calculateBudgetProgress({expenseCents,incomeCents,budgetCents,savingsGoalCents,daysElapsed,daysInMonth}){
 if(![expenseCents,incomeCents].every(n=>Number.isSafeInteger(n)&&n>=0)||!validAmount(budgetCents)||!validAmount(savingsGoalCents)||!Number.isInteger(daysElapsed)||!Number.isInteger(daysInMonth)||daysElapsed<1||daysElapsed>daysInMonth||daysInMonth<28||daysInMonth>31)throw Error('Invalid budget inputs');
 const balanceCents=incomeCents-expenseCents;
 const estimate=BigInt(expenseCents)*BigInt(daysInMonth)/BigInt(daysElapsed);
 const savingsRemaining=savingsGoalCents?Math.max(0,savingsGoalCents-balanceCents):null;
 return {remainingCents:budgetCents?budgetCents-expenseCents:null,savingsRemainingCents:Number.isSafeInteger(savingsRemaining)?savingsRemaining:null,forecastExpenseCents:estimate<=BigInt(Number.MAX_SAFE_INTEGER)?Number(estimate):null,overBudget:budgetCents>0&&expenseCents>budgetCents};
}
