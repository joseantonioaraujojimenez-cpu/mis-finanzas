import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../faceid-test/face-id.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../faceid-test/face-id.js',import.meta.url),'utf8');
test('the real dashboard keeps its own month, account and scope filters',()=>{
 for(const id of ['liveBankMonth','liveBankAccount','liveBankScope','liveBankData','diagnosticsToggle'])assert.ok(html.includes(`id="${id}"`));
 assert.match(js,/data.source!=='bbva-ais'/);
 assert.match(js,/renderLiveSnapshot\(liveSnapshot,period\)/);
 assert.match(js,/liveAvailable&&!diagnosticsVisible/);
});
test('financial data is erased on backgrounding, session reset and filter changes',()=>{
 assert.match(js,/function clearLiveData\(\)\{liveSnapshot=null/);
 assert.match(js,/if\(document.hidden\)\{clearLiveData\(\)/);
 assert.match(js,/function reset\(\)\{[\s\S]*?liveSnapshot=null/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|innerHTML/);
});
