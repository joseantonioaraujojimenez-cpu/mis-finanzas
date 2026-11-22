// Server-side bridge for the future isolated AIS routes. Never expose raw
// return tickets, provider IDs or codes in browser JSON. Not enabled by config.
import {createRestrictedAisTransport} from './bbva-live-transport.js';
import {createOfflineAisFlow} from './bbva-offline-flow.js';
const NAME='__Secure-mf-ais-return',HEX=/^[a-f0-9]{64}$/;
export function liveReturnCookie(ticket){
 if(ticket!==null&&(typeof ticket!=='string'||!HEX.test(ticket)))throw Error('Invalid return ticket');
 return `${NAME}=${ticket||''}; Path=/bank/callback; Max-Age=${ticket?600:0}; Secure; HttpOnly; SameSite=Lax`;
}
export function readLiveReturnCookie(header){
 if(typeof header!=='string'||header.length>8192)return null;
 const values=header.split(';').map(s=>s.trim()).filter(s=>s.startsWith(NAME+'='));
 if(values.length!==1)return null;
 const ticket=values[0].slice(NAME.length+1);return HEX.test(ticket)?ticket:null;
}
export function createLiveAisFlow({storage,clock=Date.now,...options}){
 const transport=createRestrictedAisTransport({...options,clock});
 const flow=createOfflineAisFlow({storage,clock,transport,jwt:'server-managed',bindBrowserReturn:true});
 return Object.freeze({
  async start({token}){
   const {authorizationUrl,returnTicket}=await flow.begin({token});
   return {authorizationUrl,setCookie:liveReturnCookie(returnTicket)};
  },
  async complete({cookieHeader,callbackUrl}){
   const ticket=readLiveReturnCookie(cookieHeader);
   if(!ticket)throw Error('Browser authorization unavailable');
   const result=await flow.completeFromReturn({ticket,callbackUrl});
   return {consentVerified:result.consentVerified,accountCount:result.accountCount,setCookie:liveReturnCookie(null)};
  },
  async read(input){return flow.read(input);}
 });
}
