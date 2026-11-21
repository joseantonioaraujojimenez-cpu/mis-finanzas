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
    'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'", ...extra }
});
const secureEq = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa=new TextEncoder().encode(a), bb=new TextEncoder().encode(b);
  // Compare the full byte strings even on length mismatch.
  let diff=aa.length^bb.length;
  for(let i=0;i<Math.max(aa.length,bb.length);i++)diff|=(aa[i]||0)^(bb[i]||0);
  return diff===0;
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
  const body=await req.text(); if(new TextEncoder().encode(body).byteLength>16384)throw Error('Body too large');
  const parsed=JSON.parse(body);
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))throw Error('JSON object required');
  return parsed;
};
export default {
 async fetch(request,env) {
  const url=new URL(request.url), origin=request.headers.get('Origin'), h=cors(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:origin===ORIGIN?204:403,headers:{'Cache-Control':'no-store',...h}});
  if(request.method!=='GET' && request.method!=='POST')return json({error:'Method not allowed'},405,h);
  if(url.pathname==='/')return request.method==='GET'
    ? json({service:'Mis Finanzas',bank_connected:false,passkeys:'disabled pending review'},200,h)
    : json({error:'Method not allowed'},405,h);
  if(!url.pathname.startsWith('/auth/'))return json({error:'Not found'},404,h);
  if(!['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify','/auth/status','/auth/logout'].includes(url.pathname))return json({error:'Not found'},404,h);
  // FAIL CLOSED: WebAuthn integration and recovery have not been audited or tested
  // with a real authenticator. Banking and passkey enrollment remain disabled.
  if(['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'].includes(url.pathname))
    return json({error:'Passkey enrollment/login disabled pending integration tests and security review'},503,h);
  if(origin!==ORIGIN)return json({error:'Forbidden origin'},403,h);
  if(request.headers.get('Content-Type')?.split(';')[0]?.trim()!=='application/json')return json({error:'JSON required'},415,h);
  if(!env.PASSKEY_COORDINATOR)return json({error:'Authentication storage unavailable'},503,h);
  if(request.method!=='POST')return json({error:'Method not allowed'},405,h);
  try {
   if(['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'].includes(url.pathname)) {
    const action=url.pathname.includes('register')?'register':'login';
    const {allowed}=await state(env,'/rate/check',{action});
    if(!allowed)return json({error:'Too many attempts. Try later.'},429,h);
   }
   if(url.pathname==='/auth/register/options') {
    // Registration is closed unless an owner-created bootstrap secret is supplied.
    if((await state(env,'/credential/get')).credential)return json({error:'Registration closed'},403,h);
    const body=await readBody(request);
    if(!env.PASSKEY_BOOTSTRAP_SECRET || !secureEq(body.bootstrap,env.PASSKEY_BOOTSTRAP_SECRET))
      return json({error:'Registration forbidden'},403,h);
    const options=await generateRegistrationOptions({
      rpName:RP_NAME,rpID:RP_ID,userName:'propietario',userDisplayName:'Propietario',
      attestationType:'none',authenticatorSelection:{userVerification:'required',residentKey:'required'},
      excludeCredentials:[]
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
   if(url.pathname==='/auth/logout'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if(!token)return json({loggedOut:true},200,h);
    await state(env,'/session/revoke',{token});
    return json({loggedOut:true},200,h);
   }
   if(url.pathname==='/auth/status')return json({authenticated:await isAuthorized(request,env)},200,h);
   return json({error:'Not found'},404,h);
  } catch(e) {
   // Never include input, credentials, tokens or banking information in errors.
   return json({error:'Authentication request failed'},400,h);
  }
 }
};
