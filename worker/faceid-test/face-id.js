'use strict';
const $=id=>document.getElementById(id);
let token=null,ready=false,busy=false,expires=0,displayed=false,consentUntil=0;
let aisFlow=null;
let liveAvailable=false,liveAccountCount=0,liveRevoking=false;
let diagnosticsVisible=false,liveSnapshot=null;
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
 $('sandboxCard').hidden=!token||!displayed||document.hidden||(liveAvailable&&!diagnosticsVisible);
 $('sandboxCheck').disabled=busy||!token||!displayed;
 $('productionCard').hidden=!token||!displayed||document.hidden||(liveAvailable&&!diagnosticsVisible);
 $('productionCheck').disabled=busy||!token||!displayed;
 $('aisFlowCard').hidden=!token||!displayed||document.hidden||(liveAvailable&&!diagnosticsVisible);
 $('aisFlowStart').disabled=busy||!token||!displayed||!!aisFlow;
 $('aisFlowReturn').disabled=busy||!token||!displayed||!aisFlow;
 $('aisFlowCancel').disabled=busy||!token||!displayed||!aisFlow;
 $('liveBankCard').hidden=!token||!displayed||document.hidden;
 $('liveBankAccept').disabled=!liveAvailable||busy||!token||liveAccountCount>0||liveRevoking;
 $('liveBankStart').disabled=!liveAvailable||busy||!token||liveAccountCount>0||liveRevoking||!$('liveBankAccept').checked;
 $('liveBankAccount').disabled=!liveAvailable||busy||!token||!liveAccountCount;
 $('liveBankRead').disabled=!liveAvailable||busy||!token||!liveAccountCount;
 $('liveBankDisconnect').disabled=!liveAvailable||busy||!token||(!liveAccountCount&&!liveRevoking);
 $('liveBankMonth').disabled=!liveAvailable||busy||!token||!liveAccountCount;
 $('liveBankScope').disabled=!liveAvailable||busy||!token||!liveAccountCount;
 for(const card of [...$('dashboard').children].slice(0,-1))card.hidden=liveAvailable&&!diagnosticsVisible;
 $('diagnosticsToggle').textContent=diagnosticsVisible?'Ocultar herramientas de prueba':'Mostrar herramientas de prueba';
}
function reset(){token=null;expires=0;displayed=false;consentUntil=0;aisFlow=null;liveAccountCount=0;liveRevoking=false;diagnosticsVisible=false;liveSnapshot=null;$('liveBankAccept').checked=false;$('liveBankStatus').textContent=liveAvailable?'Vuelve a entrar con Face ID.':'Conexión real desactivada.';$('aisFlowResult').textContent='Ensayo no iniciado.';$('consentAccept').checked=false;for(const id of ['demoIncome','demoExpense','demoBalance','demoCount','demoCategories','demoMoves','sessionTime','syncSummary','sandboxResult','productionResult','liveBankAccount','liveBankData'])$(id).replaceChildren();render();}
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
 try{await loadDemo();if(liveAvailable)await loadLiveStatus();show('Sesión activa durante 15 minutos.');}catch(e){reset();throw e;}
});
$('check').onclick=()=>run(async()=>{const result=await api('/auth/status',{},token);if(!result.authenticated)reset();show(result.authenticated?'Sesión activa.':'Sesión caducada o revocada.');});
$('consentAccept').onchange=render;
$('consentGrant').onclick=()=>run(async()=>{if(!$('consentAccept').checked)return;await consentAction('grant');$('consentAccept').checked=false;show('Consentimiento simulado activado. BBVA real sigue desconectado.');});
$('consentRevoke').onclick=()=>run(async()=>{await consentAction('revoke');$('consentAccept').checked=false;show('Consentimiento simulado revocado.');});
$('sandboxCheck').onclick=()=>run(async()=>{const session=token;$('sandboxResult').textContent='Verificando aplicación…';try{const result=await api('/auth/sandbox/check',{},session);if(!session||session!==token||Date.now()>=expires)return;const messages={ready:'✅ Sandbox verificado. BBVA España disponible para pruebas.',bbva_not_listed:'Sandbox verificado, pero BBVA España no aparece en el listado.',missing_configuration:'Faltan los secretos de Sandbox en el servidor.',invalid_app_id:'El identificador Sandbox no tiene formato UUID válido.',invalid_private_key:'PEM-01: no se reconocen las líneas BEGIN y END de la clave.',invalid_pem_body:'PEM-02: el contenido de la clave está incompleto o no es Base64 válido.',rsa_import_failed:'PEM-03: el servidor no puede importar el formato criptográfico de la clave.',rsa_sign_failed:'PEM-04: el servidor pudo importar la clave, pero no pudo firmar.',provider_unauthorized:'Enable Banking rechaza la autenticación (401). Comprueba que la clave y el ID pertenecen a la misma aplicación Sandbox.',provider_forbidden:'Enable Banking rechaza el permiso (403). Comprueba que la aplicación Sandbox esté activa.',provider_not_found:'Enable Banking no encuentra la aplicación (404). Comprueba su ID.',provider_rate_limited:'Enable Banking ha limitado las peticiones (429). Inténtalo más tarde.',provider_unavailable:'Enable Banking devolvió un error HTTP.',provider_redirect:'Enable Banking ha respondido con una redirección inesperada.',provider_network_error:'No se pudo establecer la conexión de red con Enable Banking (causa no identificada).',provider_dns_error:'No se pudo resolver el dominio de Enable Banking (DNS).',provider_connection_error:'La conexión con Enable Banking fue rechazada o interrumpida.',provider_tls_error:'No se pudo verificar la conexión segura TLS con Enable Banking.',provider_timeout:'Enable Banking no respondió en 10 segundos.',provider_invalid_response:'Enable Banking ha devuelto una respuesta inesperada.',sandbox_validation_failed:'La aplicación no cumple los requisitos de Sandbox y solo lectura.'};$('sandboxResult').textContent=(messages[result.reason]||'Verificación no disponible.')+(result.stage?' Etapa: '+result.stage+'.':'')+(Number.isInteger(result.httpStatus)?' HTTP '+result.httpStatus+'.':'')+(Array.isArray(result.failedChecks)&&result.failedChecks.length?' Requisitos pendientes: '+result.failedChecks.map(k=>({app_id:'identificador',environment:'entorno Sandbox',active:'aplicación activa',read_only:'permiso AIS de solo lectura',callback:'URL de retorno'}[k]||'configuración')).join(', ')+'.':'')+(result.additionalServices?' Aviso: Enable Banking también tiene otros servicios habilitados; esta prueba solo consulta AIS y no autoriza pagos.':'')+(result.serviceDiagnostic? ' Detalle AIS: '+({additional_services:'AIS está presente, pero hay otros servicios habilitados.',ais_missing:'AIS no está habilitado.',unexpected_format:'La lista de servicios tiene un formato inesperado.'}[result.serviceDiagnostic]||'No disponible'):'');}catch(e){if(session===token)$('sandboxResult').textContent='No se ha podido completar la verificación.';throw e;}});
$('productionCheck').onclick=()=>run(async()=>{
 const session=token;
 $('productionResult').textContent='Comprobando credenciales de producción…';
 try{
  const result=await api('/auth/production/check',{},session);
  if(session!==token||Date.now()>=expires)return;
  const messages={production_ais_identity_verified:'✅ Enable Banking reconoce la aplicación de producción y acepta su firma. Todavía no hay sesión de cuenta bancaria.',missing_or_invalid_configuration:'Falta la clave privada o el identificador correcto en el Worker de pruebas.',invalid_signing_key:'La clave privada no se puede utilizar para firmar. Revisa el formato PEM sin compartirlo.',provider_rejected_credentials:'Enable Banking ha rechazado las credenciales (401/403). Revisa que la clave corresponda a la aplicación de producción.',provider_unavailable:'Enable Banking no ha podido completar la verificación.',application_configuration_mismatch:'La aplicación responde, pero no coincide con los requisitos de producción, AIS o la URL de retorno.',provider_connection_failed:'No se ha podido establecer la conexión segura con Enable Banking.'};
  $('productionResult').textContent=messages[result.reason]||'Resultado de verificación no reconocido.';
 }catch(e){if(session===token)$('productionResult').textContent='No se ha podido completar la verificación.';throw e;}
});
// Same-origin rehearsal. No provider request, bank URL or code exchange.
$('aisFlowStart').onclick=()=>run(async()=>{
 const session=token;
 const status=await api('/auth/rehearsal/start',{},session);
 if(status.rehearsal!==true||status.bankConnected!==false||session!==token||Date.now()>=expires)throw Error('Inicia sesión con Face ID.');
 aisFlow={session,expiresAt:Math.min(expires,Date.now()+120000)};
 $('aisFlowResult').textContent='Paso 1/2: solicitud simulada creada. En una conexión real se abriría el consentimiento del banco. No se ha contactado con BBVA.';
});
$('aisFlowReturn').onclick=()=>run(async()=>{
 const flow=aisFlow;
 if(!flow||flow.session!==token||Date.now()>=flow.expiresAt){aisFlow=null;throw Error('Ensayo caducado. Vuelve a empezar.');}
 window.location.assign('/bank/rehearsal-return');
});
$('aisFlowCancel').onclick=()=>run(async()=>{await api('/auth/rehearsal/cancel',{},token);aisFlow=null;$('aisFlowResult').textContent='Ensayo cancelado. No se ha enviado información bancaria.';render();});
async function loadLiveStatus(){
 const session=token,data=await api('/auth/bank/status',{},session);
 if(session!==token||Date.now()>=expires)return;
 liveAccountCount=data.consentStored===true&&Number.isInteger(data.accountCount)&&data.accountCount>0&&data.accountCount<=50?data.accountCount:0;
 liveRevoking=data.revocationPending===true;
 $('liveBankStatus').textContent=liveRevoking?'Desconexión pendiente de confirmar. No se permiten consultas.':liveAccountCount?'Consentimiento registrado. Consulta tus cuentas.':'Sin consentimiento bancario registrado.';
 const previous=$('liveBankAccount').value;$('liveBankAccount').replaceChildren();for(let i=0;i<liveAccountCount;i++){const option=element('option','Cuenta '+(i+1));option.value=String(i);$('liveBankAccount').append(option);}if(previous!==''&&Number(previous)<liveAccountCount)$('liveBankAccount').value=previous;render();
}
$('diagnosticsToggle').onclick=()=>{diagnosticsVisible=!diagnosticsVisible;render();};
$('liveBankAccept').onchange=render;
$('liveBankStart').onclick=()=>run(async()=>{
 if(!liveAvailable||!$('liveBankAccept').checked||!token)return;
 const session=token,result=await api('/auth/bank/start',{confirmReadOnly:true},session);
 if(session!==token||Date.now()>=expires)return;
 const target=new URL(result.authorizationUrl);
 if(target.protocol!=='https:'||target.port||!(target.hostname==='enablebanking.com'||target.hostname.endsWith('.enablebanking.com')))throw Error('Destino no autorizado.');
 window.location.assign(target.href);
});
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function clearLiveData(){liveSnapshot=null;$('liveBankData').replaceChildren();}
function renderLiveSnapshot(data,period){
 const box=$('liveBankData');box.replaceChildren();box.append(element('p',`Cuenta ${Number($('liveBankAccount').value)+1} · ${$('liveBankScope').value} · ${period}`,'note'));
 for(const b of data.balances)box.append(element('p',`Saldo actual (${b.type}): ${euro(b.amountCents/100)}`,'live-note'));
 const metrics=element('div',undefined,'grid real-summary');
 for(const [label,value,kind] of [['Ingresos',euro(data.incomeCents/100),'positive'],['Gastos',euro(data.expenseCents/100),'negative'],['Saldo del periodo',euro(data.balanceCents/100),data.balanceCents>=0?'positive':'negative'],['Movimientos',data.movements.length,'']]){const item=element('div',undefined,'metric');item.append(element('small',label),element('strong',value,kind));metrics.append(item);}box.append(metrics);
 box.append(element('p',`${data.reviewCount} pendientes de clasificar · ${data.duplicates} duplicados evitados`,'note'));
 box.append(element('h2','Gastos por categoría','section-divider'));
 for(const c of data.categories){const wrapper=element('div',undefined,'section-title'),row=element('div',undefined,'row');row.append(element('div',c.category),element('strong',euro(c.amountCents/100)));wrapper.append(row);const bar=element('div',undefined,'bar'),fill=element('span');fill.style.width=`${Math.min(100,Math.max(0,data.expenseCents?100*c.amountCents/data.expenseCents:0))}%`;bar.append(fill);wrapper.append(bar);box.append(wrapper);}
 if(!data.categories.length)box.append(element('p','No hay gastos en el periodo.','note'));
 box.append(element('h2','Movimientos','section-divider'));
 const filter=element('div',undefined,'live-filter'),search=document.createElement('input'),category=document.createElement('select'),list=element('div');search.type='search';search.placeholder='Buscar concepto';search.setAttribute('aria-label','Buscar movimientos');category.setAttribute('aria-label','Filtrar categoría');
 for(const c of ['Todas las categorías',...new Set(data.movements.map(m=>m.category))]){const option=element('option',c);option.value=c;category.append(option);}filter.append(search,category);box.append(filter,list);
 const draw=()=>{list.replaceChildren();const query=search.value.trim().toLocaleLowerCase('es');const matches=[...data.movements].reverse().filter(m=>(category.value==='Todas las categorías'||m.category===category.value)&&m.concept.toLocaleLowerCase('es').includes(query));for(const m of matches){const row=element('div',undefined,'row'),details=element('div',m.concept||'Sin concepto','row-details');details.append(element('small',`${m.date} · ${m.category}${m.review?' · Revisar':''}`));row.append(details,element('strong',euro(m.amountCents/100),`amount ${m.amountCents>0?'positive':'negative'}`));list.append(row);}if(!matches.length)list.append(element('p','No hay movimientos para este filtro.','note'));};search.oninput=draw;category.onchange=draw;draw();
}
for(const id of ['liveBankAccount','liveBankScope','liveBankMonth'])$(id).onchange=clearLiveData;
$('liveBankRead').onclick=()=>run(async()=>{
 const session=token;if(!liveAvailable||!session||!liveAccountCount)return;
 clearLiveData();
 const today=new Date(),period=$('liveBankMonth').value||localDate(today).slice(0,7);
 if(!/^\d{4}-\d{2}$/.test(period)||period>localDate(today).slice(0,7))throw Error('Selecciona un mes válido.');
 const [year,month]=period.split('-').map(Number);if(year<2000||month<1||month>12)throw Error('Selecciona un mes válido.');
 const from=period+'-01',to=period===localDate(today).slice(0,7)?localDate(today):localDate(new Date(year,month,0));
 const data=await api('/auth/bank/read',{accountIndex:Number($('liveBankAccount').value),scope:$('liveBankScope').value,from,to},session);
 if(session!==token||Date.now()>=expires||document.hidden)return;
 if(data.source!=='bbva-ais'||data.bankConnected!==true||!Array.isArray(data.balances)||!Array.isArray(data.movements)||!Array.isArray(data.categories))throw Error('Datos bancarios no disponibles.');
 liveSnapshot=data;renderLiveSnapshot(liveSnapshot,period);
});
$('liveBankDisconnect').onclick=()=>run(async()=>{
 if(!window.confirm('¿Desconectar BBVA y revocar el consentimiento de lectura?'))return;
 clearLiveData();
 try{await api('/auth/bank/disconnect',{confirmDisconnect:true},token);}finally{await loadLiveStatus();}
});
$('sync').onclick=()=>run(async()=>{try{const data=await consentAction('sync');showDemo(data);show('Movimientos simulados actualizados sin duplicados.');}catch(e){try{await consentAction('status');}catch{reset();}throw e;}});
$('logout').onclick=()=>run(async()=>{const session=token;reset();await api('/auth/logout',{},session);show('Sesión cerrada.');});
setInterval(()=>{if(token&&Date.now()>=expires){reset();show('Sesión caducada.');}else if(token&&displayed){const seconds=Math.max(0,Math.ceil((expires-Date.now())/1000));$('sessionTime').textContent=`Sesión restante: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(consentUntil&&consentUntil<=Date.now()){consentUntil=0;render();}}},1000);
document.addEventListener('visibilitychange',async()=>{if(document.hidden){clearLiveData();render();return;}if(token){displayed=false;render();try{await loadDemo();if(liveAvailable)await loadLiveStatus();}catch(e){reset();show('Sesión no disponible. Vuelve a entrar.');}}});
window.addEventListener('pagehide',()=>{$('bootstrap').value='';reset();});
(async()=>{try{
 const r=await fetch('/',{cache:'no-store'});const status=await r.json();
 if(!r.ok||status.isolated!==true||status.bank_connected!==false||status.passkeys!=='enabled')throw Error('Entorno de pruebas no habilitado.');
 if(!window.isSecureContext||!window.PublicKeyCredential||!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())throw Error('No hay autenticador de dispositivo disponible. Abre esta página en Safari con Face ID o código activado.');
 liveAvailable=status.liveAisAvailable===true;$('liveBankMonth').value=localDate(new Date()).slice(0,7);$('liveBankMonth').max=$('liveBankMonth').value;ready=true;show('Entorno preparado. Si ya has registrado tu iPhone, entra con Face ID.');
 }catch(e){show(e.message||'Servidor no disponible.');}finally{render();}})();
