export { PasskeyCoordinator } from './passkey-coordinator.js';
import {demoBankSnapshot} from './bank-demo.js';
import {checkSandbox} from './enable-sandbox-check.js';
import {checkProductionIdentity} from './bbva-production-identity.js';
import {safeBankCallbackLanding} from './bbva-callback-landing.js';
import {RETURN_PATH,rehearsalCookie,readRehearsalCookie,rehearsalLanding} from './bbva-rehearsal-return.js';
import {liveAisEnabled} from './bbva-live-gate.js';
import {liveReturnCookie,readLiveReturnCookie} from './bbva-live-flow.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';

const ORIGIN = 'https://joseantonioaraujojimenez-cpu.github.io';
const RP_ID = 'joseantonioaraujojimenez-cpu.github.io';
const RP_NAME = 'Mis Finanzas';
const TEST_ORIGIN = 'https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev';
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
const cors = (origin,allowedOrigin) => origin === allowedOrigin ? {
  'Access-Control-Allow-Origin':allowedOrigin, 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
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
  const url=new URL(request.url), origin=request.headers.get('Origin');
  const isolated=env.FACEID_TEST_MODE==='enabled' && url.origin===TEST_ORIGIN;
  const allowedOrigin=isolated?TEST_ORIGIN:ORIGIN;
  const rpID=isolated?new URL(TEST_ORIGIN).hostname:RP_ID;
  const ready=isolated && Boolean(env.PASSKEY_COORDINATOR) && typeof env.PASSKEY_BOOTSTRAP_SECRET==='string' && env.PASSKEY_BOOTSTRAP_SECRET.length>=32;
  const liveReady=ready&&liveAisEnabled(env);
  const h=cors(origin,allowedOrigin);
  if(isolated && request.method==='GET' && ['/face-id','/face-id.js'].includes(url.pathname) && env.TEST_ASSETS){
   const asset=await env.TEST_ASSETS.fetch(new Request(TEST_ORIGIN+(url.pathname==='/face-id'?'/face-id.html':'/face-id.js')));
   const headers=new Headers(asset.headers);
   headers.set('Cache-Control','no-store');
   headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
   headers.set('X-Content-Type-Options','nosniff');
   headers.set('Referrer-Policy','no-referrer');
   headers.set('X-Frame-Options','DENY');
   return new Response(asset.body,{status:asset.status,headers});
  }
  // Isolated callback landing only: authorization codes are deliberately discarded.
  // Never expose this route on the production Worker or exchange a code here.
  if(isolated && url.pathname==='/bank/callback' && request.method==='GET'){
   if(!liveReady)return safeBankCallbackLanding(url.href);
   const cookieHeader=request.headers.get('Cookie');
   let verified=false;
   if(readLiveReturnCookie(cookieHeader))try{verified=(await state(env,'/bbva/live/complete',{cookieHeader,callbackUrl:url.href})).consentVerified===true;}catch{}
   const page=verified?'Consentimiento registrado. Vuelve a entrar con Face ID.':'No se ha completado la autorización. Vuelve a entrar con Face ID.';
   return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>MIS FINANZAS</title><h1>BBVA</h1><p>'+page+'</p><a href="/face-id">Volver a MIS FINANZAS</a></html>',{status:verified?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",'Set-Cookie':liveReturnCookie(null)}});
  }
  if(ready && url.pathname===RETURN_PATH && request.method==='GET'){
   const ticket=readRehearsalCookie(request.headers.get('Cookie'));
   let verified=false;
   if(ticket)try{verified=(await state(env,'/bbva/rehearsal/consume',{ticket})).verified===true;}catch{}
   return rehearsalLanding(verified);
  }
  if(request.method==='OPTIONS')return new Response(null,{status:origin===allowedOrigin?204:403,headers:{'Cache-Control':'no-store',...h}});
  if(request.method!=='GET' && request.method!=='POST')return json({error:'Method not allowed'},405,h);
  if(url.pathname==='/')return request.method==='GET'
    ? json({service:'Mis Finanzas',bank_connected:false,passkeys:ready?'enabled':'disabled pending review',isolated,liveAisAvailable:liveReady},200,h)
    : json({error:'Method not allowed'},405,h);
  if(!url.pathname.startsWith('/auth/'))return json({error:'Not found'},404,h);
  if(!['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify','/auth/status','/auth/logout','/auth/demo','/auth/demo/consent','/auth/sandbox/check','/auth/production/check','/auth/rehearsal/start','/auth/rehearsal/cancel','/auth/bank/start','/auth/bank/status','/auth/bank/read','/auth/bank/disconnect','/auth/bank/budget'].includes(url.pathname))return json({error:'Not found'},404,h);
  if(url.pathname.startsWith('/auth/bank/')&&!liveReady)return json({error:'Not found'},404,h);
  if(['/auth/rehearsal/start','/auth/rehearsal/cancel'].includes(url.pathname) && !ready)return json({error:'Not found'},404,h);
  if(url.pathname==='/auth/production/check' && !ready)return json({error:'Not found'},404,h);
  if(url.pathname==='/auth/sandbox/check' && !ready)return json({error:'Not found'},404,h);
  if(url.pathname==='/auth/demo' && !ready)return json({error:'Not found'},404,h);
  if(url.pathname==='/auth/demo/consent' && !ready)return json({error:'Not found'},404,h);
  // FAIL CLOSED: WebAuthn integration and recovery have not been audited or tested
  // with a real authenticator. Banking and passkey enrollment remain disabled.
  if(!ready && ['/auth/register/options','/auth/register/verify','/auth/login/options','/auth/login/verify'].includes(url.pathname))
    return json({error:'Passkey enrollment/login disabled pending integration tests and security review'},503,h);
  if(origin!==allowedOrigin)return json({error:'Forbidden origin'},403,h);
  if(request.headers.get('Content-Type')?.split(';')[0]?.trim()!=='application/json')return json({error:'JSON required'},415,h);
  if(!env.PASSKEY_COORDINATOR)return json({error:'Authentication storage unavailable'},503,h);
  if(request.method!=='POST')return json({error:'Method not allowed'},405,h);
  try {
   if(url.pathname.startsWith('/auth/bank/')){
    if(!await isAuthorized(request,env))return json({error:'Session expired or invalid'},401,h);
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    const body=await readBody(request);
    if(url.pathname==='/auth/bank/start'){
     if(body.confirmReadOnly!==true)return json({error:'Read-only confirmation required'},400,h);
     const result=await state(env,'/bbva/live/start',{token});
     return json({authorizationUrl:result.authorizationUrl},200,{...h,'Set-Cookie':result.setCookie});
    }
    if(url.pathname==='/auth/bank/status')return json(await state(env,'/bbva/live/status',{token}),200,h);
    if(url.pathname==='/auth/bank/budget')return json(await state(env,'/finance/budget',{token,accountIndex:body.accountIndex,scope:body.scope,month:body.month,action:body.action,budgetCents:body.budgetCents,savingsGoalCents:body.savingsGoalCents}),200,h);
    if(url.pathname==='/auth/bank/disconnect'){
     if(body.confirmDisconnect!==true)return json({error:'Disconnect confirmation required'},400,h);
     return json(await state(env,'/bbva/live/disconnect',{token}),200,h);
    }
    return json(await state(env,'/bbva/live/read',{token,accountIndex:body.accountIndex,scope:body.scope,from:body.from,to:body.to}),200,h);
   }
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
      rpName:RP_NAME+' · Pruebas',rpID,userName:'propietario',userDisplayName:'Propietario',
      attestationType:'none',authenticatorSelection:{userVerification:'required',residentKey:'required',authenticatorAttachment:'platform'},
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
      response:body.response,expectedChallenge:challenge,expectedOrigin:allowedOrigin,
      expectedRPID:rpID,requireUserVerification:true
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
      rpID,userVerification:'required',
      allowCredentials:[{id:credential.id,transports:credential.transports}]
    });
    const {id:flow}=await state(env,'/challenge/create',{kind:'login',challenge:options.challenge});
    return json({options,flow},200,h);
   }
   if(url.pathname==='/auth/login/verify') {
    const body=await readBody(request);
    const {challenge:expectedChallenge}=await state(env,'/challenge/consume',{kind:'login',id:body.flow});
    const {credential:c,epoch}=await state(env,'/credential/get');
    if(!expectedChallenge||!c||body.response?.id!==c.id)
      return json({error:'Invalid or expired login'},401,h);
    const result=await verifyAuthenticationResponse({
      response:body.response,expectedChallenge,expectedOrigin:allowedOrigin,expectedRPID:rpID,
      requireUserVerification:true,
      credential:{id:c.id,publicKey:new Uint8Array(c.publicKey),counter:c.counter,transports:c.transports}
    });
    if(!result.verified)return json({error:'Authentication failed'},401,h);
    const {token}=await state(env,'/session/authenticate',{id:c.id,epoch,previousCounter:c.counter,counter:result.authenticationInfo.newCounter});
    if(!token)return json({error:'Authentication state changed'},401,h);
    return json({authenticated:true,token,expiresIn:900},200,h);
   }
   if(url.pathname==='/auth/logout'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if(!token)return json({loggedOut:true},200,h);
    await state(env,'/session/revoke',{token});
    return json({loggedOut:true},200,h);
   }
   if(url.pathname==='/auth/status')return json({authenticated:await isAuthorized(request,env)},200,h);
   if(url.pathname==='/auth/rehearsal/start'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    const {ticket}=await state(env,'/bbva/rehearsal/issue',{token});
    if(!ticket)return json({error:'Session expired or invalid'},401,h);
    return json({rehearsal:true,bankConnected:false},200,{...h,'Set-Cookie':rehearsalCookie(ticket)});
   }
   if(url.pathname==='/auth/rehearsal/cancel'){
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if(!await isAuthorized(request,env))return json({error:'Session expired or invalid'},401,h);
    await state(env,'/bbva/rehearsal/cancel',{token});
    return json({rehearsal:true,bankConnected:false},200,{...h,'Set-Cookie':rehearsalCookie(null)});
   }
   if(url.pathname==='/auth/production/check'){
    if(!await isAuthorized(request,env))return json({error:'Session expired or invalid'},401,h);
    const result=await checkProductionIdentity({appId:env.ENABLE_PRODUCTION_APP_ID,pem:env.ENABLE_PRODUCTION_PRIVATE_KEY});
    return json(result,200,h);
   }
   if(url.pathname==='/auth/sandbox/check'){
    if(!await isAuthorized(request,env))return json({error:'Session expired or invalid'},401,h);
    const result=await checkSandbox({appId:env.ENABLE_SANDBOX_APP_ID,pem:env.ENABLE_SANDBOX_PRIVATE_KEY});
    return json({sandbox:true,bankConnected:false,...result},200,h);
   }
   if(url.pathname==='/auth/demo/consent'){
    const {action}=await readBody(request);
    if(!['status','grant','revoke','sync'].includes(action))return json({error:'Invalid simulated consent action'},400,h);
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    const consent=await state(env,'/demo/consent',{token,action});
    if(!consent.authorized)return json({error:'Session expired or invalid'},401,h);
    if(action==='sync'&&!consent.canSync)return json({error:'Simulated consent required'},403,h);
    return json({demo:true,bankConnected:false,consent,...(action==='sync'?demoBankSnapshot():{})},200,h);
   }
   if(url.pathname==='/auth/demo'){
    if(!await isAuthorized(request,env))return json({error:'Session expired or invalid'},401,h);
    // Entirely fictional entries; no banking API, account or database is used.
    return json({demo:true,bankConnected:false,...demoBankSnapshot()},200,h);
   }
   return json({error:'Not found'},404,h);
  } catch(e) {
   // Never include input, credentials, tokens or banking information in errors.
   return json({error:'Authentication request failed'},400,h);
  }
 }
};
