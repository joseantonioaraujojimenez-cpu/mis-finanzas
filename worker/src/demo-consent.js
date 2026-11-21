// Simulated consent only: not a bank grant or a provider credential.
export const DEMO_CONSENT_TTL=30*60*1000;
export function transitionDemoConsent(previous,action,now){
 if(!['status','grant','revoke','sync'].includes(action))throw Error('Unknown consent action');
 const active=Boolean(previous&&previous.expires>now);
 let record=active?previous:null;
 if(action==='grant'&&!active)record={granted:now,expires:now+DEMO_CONSENT_TTL};
 if(action==='revoke')record=null;
 return {record,result:{simulated:true,active:Boolean(record),expires:record?.expires||null,canSync:action==='sync'&&Boolean(record),scope:['balances','transactions'],payments:false}};
}
