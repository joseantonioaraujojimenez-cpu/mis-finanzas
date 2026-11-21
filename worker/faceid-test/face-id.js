'use strict';
const $=id=>document.getElementById(id);
let token=null,ready=false,busy=false,expires=0;
const show=message=>{$('status').textContent=message;};
function render(){
 $('register').disabled=!ready||busy||!!token;
 $('login').disabled=!ready||busy||!!token;
 $('check').disabled=busy||!token;
 $('logout').disabled=busy||!token;
}
function reset(){token=null;expires=0;render();}
async function api(path,body,session){
 const r=await fetch(path,{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session}:{})},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Error del servidor');return data;
}
async function run(fn){if(busy)return;busy=true;render();try{await fn()}catch(e){show(e.name==='NotAllowedError'?'Verificación cancelada o no disponible.':e.message||'No se ha completado la prueba.')}finally{busy=false;render();}}
function decode(value){const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(binary,c=>c.charCodeAt(0));}
function encode(value){return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function creationOptions(o){return {...o,challenge:decode(o.challenge),user:{...o.user,id:decode(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(c=>({...c,id:decode(c.id)}))};}
function requestOptions(o){return {...o,challenge:decode(o.challenge),allowCredentials:(o.allowCredentials||[]).map(c=>({...c,id:decode(c.id)}))};}
function serialize(c,registration){
 const r=c.response;
 const response={clientDataJSON:encode(r.clientDataJSON)};
 if(registration){response.attestationObject=encode(r.attestationObject);if(r.getTransports)response.transports=r.getTransports();}
 else {response.authenticatorData=encode(r.authenticatorData);response.signature=encode(r.signature);if(r.userHandle)response.userHandle=encode(r.userHandle);}
 return {id:c.id,rawId:encode(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment||undefined,clientExtensionResults:c.getClientExtensionResults(),response};
}
$('register').onclick=()=>run(async()=>{
 const bootstrap=$('bootstrap').value;$('bootstrap').value='';
 if(!bootstrap)throw Error('Introduce la clave de alta inicial.');
 const {options,flow}=await api('/auth/register/options',{bootstrap});
 const c=await navigator.credentials.create({publicKey:creationOptions(options)});
 const result=await api('/auth/register/verify',{bootstrap,flow,response:serialize(c,true)});
 show(result.verified?'Passkey registrada. Ahora puedes iniciar sesión.':'Registro no confirmado.');
});
$('login').onclick=()=>run(async()=>{
 const {options,flow}=await api('/auth/login/options',{});
 const c=await navigator.credentials.get({publicKey:requestOptions(options)});
 const result=await api('/auth/login/verify',{flow,response:serialize(c,false)});
 if(!result.authenticated||!result.token)throw Error('Acceso no confirmado.');
 token=result.token;expires=Date.now()+result.expiresIn*1000;show('Sesión activa durante 15 minutos.');
});
$('check').onclick=()=>run(async()=>{const result=await api('/auth/status',{},token);if(!result.authenticated)reset();show(result.authenticated?'Sesión activa.':'Sesión caducada o revocada.');});
$('logout').onclick=()=>run(async()=>{await api('/auth/logout',{},token);reset();show('Sesión cerrada.');});
setInterval(()=>{if(token&&Date.now()>=expires){reset();show('Sesión caducada.');}},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token&&Date.now()>=expires){reset();show('Sesión caducada.');}});
window.addEventListener('pagehide',()=>{$('bootstrap').value='';reset();});
(async()=>{try{
 const r=await fetch('/',{cache:'no-store'});const status=await r.json();
 if(!r.ok||status.isolated!==true||status.bank_connected!==false||status.passkeys!=='enabled')throw Error('Entorno de pruebas no habilitado.');
 if(!window.isSecureContext||!window.PublicKeyCredential||!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())throw Error('No hay autenticador de dispositivo disponible. Abre esta página en Safari con Face ID o código activado.');
 ready=true;show('Entorno preparado. Registra la passkey la primera vez.');
 }catch(e){show(e.message||'Servidor no disponible.');}finally{render();}})();
