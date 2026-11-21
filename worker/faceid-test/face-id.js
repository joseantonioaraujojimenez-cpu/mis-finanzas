'use strict';
const $=id=>document.getElementById(id);
let token=null,ready=false,busy=false,expires=0,displayed=false;
const show=message=>{$('status').textContent=message;};
function render(){
 $('register').disabled=!ready||busy||!!token;
 $('login').disabled=!ready||busy||!!token;
 $('check').disabled=busy||!token;
 $('logout').disabled=busy||!token;
 $('sync').disabled=busy||!token||!displayed;
 $('locked').hidden=!!token&&displayed;
 $('dashboard').hidden=!token||!displayed||document.hidden;
}
function reset(){token=null;expires=0;displayed=false;for(const id of ['demoIncome','demoExpense','demoBalance','demoCount','demoCategories','demoMoves','sessionTime','syncSummary'])$(id).replaceChildren();render();}
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
async function loadDemo(){const session=token;const data=await api('/auth/demo',{},session);if(!session||token!==session||Date.now()>=expires)throw Error('Sesión caducada.');showDemo(data);}
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
$('sync').onclick=()=>run(async()=>{try{await loadDemo();show('Movimientos simulados actualizados sin duplicados.');}catch(e){reset();throw e;}});
$('logout').onclick=()=>run(async()=>{const session=token;reset();await api('/auth/logout',{},session);show('Sesión cerrada.');});
setInterval(()=>{if(token&&Date.now()>=expires){reset();show('Sesión caducada.');}else if(token&&displayed){const seconds=Math.max(0,Math.ceil((expires-Date.now())/1000));$('sessionTime').textContent=`Sesión restante: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}},1000);
document.addEventListener('visibilitychange',async()=>{if(document.hidden){render();return;}if(token){displayed=false;render();try{await loadDemo();}catch(e){reset();show('Sesión no disponible. Vuelve a entrar.');}}});
window.addEventListener('pagehide',()=>{$('bootstrap').value='';reset();});
(async()=>{try{
 const r=await fetch('/',{cache:'no-store'});const status=await r.json();
 if(!r.ok||status.isolated!==true||status.bank_connected!==false||status.passkeys!=='enabled')throw Error('Entorno de pruebas no habilitado.');
 if(!window.isSecureContext||!window.PublicKeyCredential||!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())throw Error('No hay autenticador de dispositivo disponible. Abre esta página en Safari con Face ID o código activado.');
 ready=true;show('Entorno preparado. Si ya has registrado tu iPhone, entra con Face ID.');
 }catch(e){show(e.message||'Servidor no disponible.');}finally{render();}})();
