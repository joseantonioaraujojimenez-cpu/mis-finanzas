export { PasskeyCoordinator } from './passkey-coordinator.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';

const ORIGIN = 'https://joseantonioaraujojimenez-cpu.github.io';
const RP_ID = 'joseantonioaraujojimenez-cpu.github.io';
const RP_NAME = 'Mis Finanzas';
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff', ...extra }
});
const secureEq = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d=0; for(let i=0;i<a.length;i++)d |= a.charCodeAt(i)^b.charCodeAt(i); return d===0;
};
const cors = (origin) => origin === ORIGIN ? {
  'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Vary':'Origin'
} : {};
const state = async (env,path,body={}) => {
 const id=env.PASSKEY_COORDINATOR.idFromName('owner');
 const stub=env.PASSKEY_COORDINATOR.get(id);
 const response=await stub.fetch('https://coordinator.internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error('Coordinator unavailable');
 return response.json();
};
const isAuthorized = async (req,env) => {
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
 return token ? (await state(env,'/session/validate',{token})).valid : false;
};
const readBody = async req => {
  if (Number(req.headers.get('content-length')||0)>16384) throw Error('Body too large');
  const body=await req.text(); if(body.length>16384)throw Error('Body too large');
  return JSON.parse(body);
};
export default {
 async fetch(request,env) {
  const url=new URL(request.url), origin=request.headers.get('Origin'), h=cors(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:origin===ORIGIN?204:403,headers:h});
  if(url.pathname==='/')return json({service:'Mis Finanzas',bank_connected:false,passkeys:'backend available'},200,h);
  if(!url.pathname.startsWith('/auth/'))return json({error:'Not found'},404,h);
  // FAIL CLOSED: KV cannot atomically consume WebAuthn challenges or enforce single enrollment.
  // The bank integration must remain inaccessible until an atomic Durable Object implementation is reviewed.
  if(['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'].includes(url.pathname))
    return json({error:'Passkey enrollment/login disabled pending atomic storage implementation'},503,h);
  if(origin!==ORIGIN)return json({error:'Forbidden origin'},403,h);
  if(!env.PASSKEY_COORDINATOR)return json({error:'Authentication storage unavailable'},503,h);
  if(request.method!=='POST')return json({error:'Method not allowed'},405,h);
  try {
   if(url.pathname==='/auth/register/options') {
    // Registration is closed unless an owner-created bootstrap secret is supplied.
    if((await state(env,'/credential/get')).credential)return json({error:'Registration closed'},403,h);
    const body=await readBody(request);
    if(!env.PASSKEY_BOOTSTRAP_SECRET || !secureEq(body.bootstrap,env.PASSKEY_BOOTSTRAP_SECRET))
      return json({error:'Registration forbidden'},403,h);
    const options=await generateRegistrationOptions({
      rpName:RP_NAME,rpID:RP_ID,userName:'propietario',userDisplayName:'Propietario',
      attestationType:'none',authenticatorSelection:{userVerification:'required',residentKey:'required'}
    });
    const {id:flow}=await state(env,'/challenge/create',{kind:'register',challenge:options.challenge});
    return json({options,flow},200,h);
   }
   if(url.pathname==='/auth/register/verify') {
    const body=await readBody(request);
    if((await state(env,'/credential/get')).credential)return json({error:'Registration closed'},403,h);
    if(!env.PASSKEY_BOOTSTRAP_SECRET || !secureEq(body.bootstrap,env.PASSKEY_BOOTSTRAP_SECRET))
      return json({error:'Registration forbidden'},403,h);
    const {challenge}=await state(env,'/challenge/consume',{kind:'register',id:body.flow});
    if(!challenge)return json({error:'Expired challenge'},400,h);
    const result=await verifyRegistrationResponse({
      response:body.response,expectedChallenge:challenge,expectedOrigin:ORIGIN,
      expectedRPID:RP_ID,requireUserVerification:true
    });
    if(!result.verified || !result.registrationInfo)return json({error:'Verification failed'},401,h);
    const c=result.registrationInfo.credential;
    const {enrolled}=await state(env,'/credential/enroll',{credential:{id:c.id,publicKey:Array.from(c.publicKey),counter:c.counter,transports:c.transports||[]}});
    if(!enrolled)return json({error:'Already registered'},409,h);
    return json({verified:true},200,h);
   }
   if(url.pathname==='/auth/login/options') {
    const credential=(await state(env,'/credential/get')).credential;
    if(!credential)return json({error:'No passkey enrolled'},409,h);
    const options=await generateAuthenticationOptions({
      rpID:RP_ID,userVerification:'required',
      allowCredentials:[{id:credential.id,transports:credential.transports}]
    });
    const {id:flow}=await state(env,'/challenge/create',{kind:'login',challenge:options.challenge});
    return json({options,flow},200,h);
   }
   if(url.pathname==='/auth/login/verify') {
    const body=await readBody(request);
    const {challenge:expectedChallenge}=await state(env,'/challenge/consume',{kind:'login',id:body.flow});
    const c=(await state(env,'/credential/get')).credential;
    if(!expectedChallenge||!c||body.response?.id!==c.id)
      return json({error:'Invalid or expired login'},401,h);
    const result=await verifyAuthenticationResponse({
      response:body.response,expectedChallenge,expectedOrigin:ORIGIN,expectedRPID:RP_ID,
      requireUserVerification:true,
      credential:{id:c.id,publicKey:new Uint8Array(c.publicKey),counter:c.counter,transports:c.transports}
    });
    if(!result.verified)return json({error:'Authentication failed'},401,h);
    const {updated}=await state(env,'/credential/counter',{id:c.id,counter:result.authenticationInfo.newCounter});
    if(!updated)return json({error:'Counter rejected'},401,h);
    const {token}=await state(env,'/session/create');
    return json({authenticated:true,token,expiresIn:900},200,h);
   }
   if(url.pathname==='/auth/status')return json({authenticated:await isAuthorized(request,env)},200,h);
   return json({error:'Not found'},404,h);
  } catch(e) {
   // Never include input, credentials, tokens or banking information in errors.
   return json({error:'Authentication request failed'},400,h);
  }
 }
};
