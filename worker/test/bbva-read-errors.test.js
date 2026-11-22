import test from 'node:test';
import assert from 'node:assert/strict';
import {readErrorMessage,providerReadError,safeReadCode} from '../src/bbva-read-errors.js';
test('bank errors distinguish consent, provider limits and unknown responses without exposing details',async()=>{
 for(const [error,status,expected] of [['EXPIRED_SESSION',403,'BANK_CONSENT'],['WRONG_TRANSACTIONS_PERIOD',422,'BANK_PERIOD'],['ASPSP_RATE_LIMIT_EXCEEDED',429,'BANK_RATE'],['ASPSP_TIMEOUT',408,'BANK_TIMEOUT'],['SECRET',400,'BANK_UNAVAILABLE']]){
  const result=await providerReadError({status,json:async()=>({error,detail:'private details'})});
  assert.equal(safeReadCode(result),expected);assert.doesNotMatch(result.message,/private details|SECRET/);
 }
 assert.equal(readErrorMessage('SECRET'),readErrorMessage('BANK_UNAVAILABLE'));
});
