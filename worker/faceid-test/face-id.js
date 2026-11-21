'use strict';
const $=id=>document.getElementById(id);
let token=null,ready=false,busy=false,expires=0,displayed=false,consentUntil=0;
const show=message=>{$('status').textContent=message;};
function render(){
 $('register').disabled=!ready||busy||!!token;
 $('login').disabled=!ready||busy||!!token;
 $('check').disabled=busy||!token;
 $('logout').disabled=busy||!token;
 const consentActive=consentUntil>Date.now();
 $('sync').disabled=busy||!token||!displayed||!consentActive;
 $('consentGrant').disabled=busy||!token||!displayed||consentActive||!$('consentAccept').checked;
 $('consentRevoke').disabled=busy||!token||!displayed||!consentActive;
 $('consentAccept').disabled=busy||!token||consentActive;
 $('consentStatus').textContent=consentActive?'Consentimiento simulado activo hasta '+new Date(consentUntil).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'Sin consentimiento simulado activo.';
 $('locked').hidden=!!token&&displayed;
 $('dashboard').hidden=!token||!displayed||document.hidden;
 $('sandboxCard').hidden=!token||!displayed||document.hidden;
 $('sandboxCheck').disabled=busy||!token||!displayed;
}
function reset(){token=null;expires=0;displayed=false;consentUntil=0;$('consentAccept').checked=false;for(const id of ['demoIncome','demoExpense','demoBalance','demoCount','demoCategories','demoMoves','sessionTime','syncSummary','sandboxResult'])$(id).replaceChildren();render();}
const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n);
function element(tag,text,klass){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(klass)e.className=klass;return e;}
function showDemo(data){
 if(data.demo!==true||data.bankConnected!==false||data.source!=='simulated'||!Array.isArray(data.movements))throw Error('Datos de prueba no disponibles.');
 const movements=data.movements;
 $('demoIncome').textContent=euro(data.incomeCents/100);$('demoExpense').textContent=euro(data.expenseCents/100);$('demoBalance').textContent=euro(data.balanceCents/100);$('demoCount').textContent=movements.length;
 $('syncSummary').textContent=`${movements.length} movimientos únicos · ${data.duplicates} duplicados evitados · ${data.reviewCount} pendientes de clasificar`;
 const groups=new Map();for(const m of movements.filter(m=>m.amount<0))groups.set(m.category,(groups.get(m.category)||0)-m.amount);
 $('demoCategories').replaceChildren();for(const [name,value] of [...groups].sort((a,b)=>b[1]-a[1])){const row=element('div',undefined,'row'),label=element('div',name),amount=element('strong',euro(value));row.append(label,amount);$('demoCategories').append(row);}
 $('demoMoves').replaceChildren();for(const m of [...movements].reverse()){const row=element('div',undefined,'row'),details=element('div',m.concept);details.append(element('small',`${m.date} · ${m.category} · ${m.scope}`));row.append(details,element('span',euro(m.amount),`amount ${m.amount>0?'positive':'negative'}`));$('demoMoves').append(row);}
 displayed=true;render();
}
function showConsent(data){if(data.demo!==true||data.bankConnected!==false||data.consent?.simulated!==true||data.consent.payments!==false)throw Error('Consentimiento de prueba no disponible.');consentUntil=data.consent.active?data.consent.expires:0;render();}
async function consentAction(action){const session=token;const data=await api('/auth/demo/consent',{action},session);if(!session||token!==session||Date.now()>=expires)throw Error('Sesión caducada.');showConsent(data);return data;}
async function loadDemo(){const session=token;const data=await api('/auth/demo',{},session);if(!session||token!==session||Date.now()>=expires)throw Error('Sesión caducada.');await consentAction('status');if(token!==session||Date.now()>=expires)throw Error('Sesión caducada.');showDemo(data);}
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
 token=result.token;expires=Date.now()+result.expiresIn*1000;
 try{await loadDemo();show('Sesión activa durante 15 minutos.');}catch(e){reset();throw e;}
});
$('check').onclick=()=>run(async()=>{const result=await api('/auth/status',{},token);if(!result.authenticated)reset();show(result.authenticated?'Sesión activa.':'Sesión caducada o revocada.');});
$('consentAccept').onchange=render;
$('consentGrant').onclick=()=>run(async()=>{if(!$('consentAccept').checked)return;await consentAction('grant');$('consentAccept').checked=false;show('Consentimiento simulado activado. BBVA real sigue desconectado.');});
$('consentRevoke').onclick=()=>run(async()=>{await consentAction('revoke');$('consentAccept').checked=false;show('Consentimiento simulado revocado.');});
$('sandboxCheck').onclick=()=>run(async()=>{const session=token;$('sandboxResult').textContent='Verificando aplicación…';try{const result=await api('/auth/sandbox/check',{},session);if(!session||session!==token||Date.now()>=expires)return;const messages={ready:'✅ Sandbox verificado. BBVA España disponible para pruebas.',bbva_not_listed:'Sandbox verificado, pero BBVA España no aparece en el listado.',missing_configuration:'Faltan los secretos de Sandbox en el servidor.',sandbox_validation_failed:'La aplicación no cumple los requisitos de Sandbox y solo lectura.',provider_check_failed:'No se ha podido verificar la aplicación. Revisa su configuración.'};$('sandboxResult').textContent=messages[result.reason]||'Verificación no disponible.';}catch(e){if(session===token)$('sandboxResult').textContent='No se ha podido completar la verificación.';throw e;}});
$('sync').onclick=()=>run(async()=>{try{const data=await consentAction('sync');showDemo(data);show('Movimientos simulados actualizados sin duplicados.');}catch(e){try{await consentAction('status');}catch{reset();}throw e;}});
$('logout').onclick=()=>run(async()=>{const session=token;reset();await api('/auth/logout',{},session);show('Sesión cerrada.');});
setInterval(()=>{if(token&&Date.now()>=expires){reset();show('Sesión caducada.');}else if(token&&displayed){const seconds=Math.max(0,Math.ceil((expires-Date.now())/1000));$('sessionTime').textContent=`Sesión restante: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(consentUntil&&consentUntil<=Date.now()){consentUntil=0;render();}}},1000);
document.addEventListener('visibilitychange',async()=>{if(document.hidden){render();return;}if(token){displayed=false;render();try{await loadDemo();}catch(e){reset();show('Sesión no disponible. Vuelve a entrar.');}}});
window.addEventListener('pagehide',()=>{$('bootstrap').value='';reset();});
(async()=>{try{
 const r=await fetch('/',{cache:'no-store'});const status=await r.json();
 if(!r.ok||status.isolated!==true||status.bank_connected!==false||status.passkeys!=='enabled')throw Error('Entorno de pruebas no habilitado.');
 if(!window.isSecureContext||!window.PublicKeyCredential||!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())throw Error('No hay autenticador de dispositivo disponible. Abre esta página en Safari con Face ID o código activado.');
 ready=true;show('Entorno preparado. Si ya has registrado tu iPhone, entra con Face ID.');
 }catch(e){show(e.message||'Servidor no disponible.');}finally{render();}})();
