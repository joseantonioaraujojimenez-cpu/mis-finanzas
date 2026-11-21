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
const random = () => crypto.randomUUID() + crypto.randomUUID();
const secureEq = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d=0; for(let i=0;i<a.length;i++)d |= a.charCodeAt(i)^b.charCodeAt(i); return d===0;
};
const cors = (origin) => origin === ORIGIN ? {
  'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Vary':'Origin'
} : {};
const isAuthorized = async (req,env) => {
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if (!token) return false;
  const key=await env.AUTH_KV.get('session:'+token);
  return key === 'valid';
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
  if(!env.AUTH_KV)return json({error:'Authentication storage unavailable'},503,h);
  if(request.method!=='POST')return json({error:'Method not allowed'},405,h);
  try {
   if(url.pathname==='/auth/register/options') {
    // Registration is closed unless an owner-created bootstrap secret is supplied.
    if(await env.AUTH_KV.get('owner_credential'))return json({error:'Registration closed'},403,h);
    const body=await readBody(request);
    if(!env.PASSKEY_BOOTSTRAP_SECRET || !secureEq(body.bootstrap,env.PASSKEY_BOOTSTRAP_SECRET))
      return json({error:'Registration forbidden'},403,h);
    const options=await generateRegistrationOptions({
      rpName:RP_NAME,rpID:RP_ID,userName:'propietario',userDisplayName:'Propietario',
      attestationType:'none',authenticatorSelection:{userVerification:'required',residentKey:'required'}
    });
    const flow=random();
    await env.AUTH_KV.put('reg:'+flow,JSON.stringify({challenge:options.challenge}),{expirationTtl:300});
    return json({options,flow},200,h);
   }
   if(url.pathname==='/auth/register/verify') {
    const body=await readBody(request);
    if(await env.AUTH_KV.get('owner_credential'))return json({error:'Registration closed'},403,h);
    if(!env.PASSKEY_BOOTSTRAP_SECRET || !secureEq(body.bootstrap,env.PASSKEY_BOOTSTRAP_SECRET))
      return json({error:'Registration forbidden'},403,h);
    const saved=await env.AUTH_KV.get('reg:'+body.flow,'json');
    await env.AUTH_KV.delete('reg:'+body.flow);
    if(!saved)return json({error:'Expired challenge'},400,h);
    const result=await verifyRegistrationResponse({
      response:body.response,expectedChallenge:saved.challenge,expectedOrigin:ORIGIN,
      expectedRPID:RP_ID,requireUserVerification:true
    });
    if(!result.verified || !result.registrationInfo)return json({error:'Verification failed'},401,h);
    const c=result.registrationInfo.credential;
    // KV is eventually consistent; bootstrap is also required. For stronger atomic enrollment,
    // replace this with a Durable Object before handling live bank credentials.
    await env.AUTH_KV.put('owner_credential',JSON.stringify({
      id:c.id,publicKey:Array.from(c.publicKey),counter:c.counter,transports:c.transports||[]
    }));
    return json({verified:true},200,h);
   }
   if(url.pathname==='/auth/login/options') {
    const credential=await env.AUTH_KV.get('owner_credential','json');
    if(!credential)return json({error:'No passkey enrolled'},409,h);
    const options=await generateAuthenticationOptions({
      rpID:RP_ID,userVerification:'required',
      allowCredentials:[{id:credential.id,transports:credential.transports}]
    });
    const flow=random();
    await env.AUTH_KV.put('login:'+flow,options.challenge,{expirationTtl:300});
    return json({options,flow},200,h);
   }
   if(url.pathname==='/auth/login/verify') {
    const body=await readBody(request);
    const expectedChallenge=await env.AUTH_KV.get('login:'+body.flow);
    await env.AUTH_KV.delete('login:'+body.flow);
    const c=await env.AUTH_KV.get('owner_credential','json');
    if(!expectedChallenge||!c||body.response?.id!==c.id)
      return json({error:'Invalid or expired login'},401,h);
    const result=await verifyAuthenticationResponse({
      response:body.response,expectedChallenge,expectedOrigin:ORIGIN,expectedRPID:RP_ID,
      requireUserVerification:true,
      credential:{id:c.id,publicKey:new Uint8Array(c.publicKey),counter:c.counter,transports:c.transports}
    });
    if(!result.verified)return json({error:'Authentication failed'},401,h);
    c.counter=result.authenticationInfo.newCounter;
    await env.AUTH_KV.put('owner_credential',JSON.stringify(c));
    const token=random();
    await env.AUTH_KV.put('session:'+token,'valid',{expirationTtl:900});
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
