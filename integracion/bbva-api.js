/* Integración aislada, sin tocar la aplicación publicada.
   La sesión debe provenir de Face ID; nunca se persiste en localStorage. */
(function(global){
 'use strict';
 const ORIGIN='https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev';
 function validMonth(month){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)}
 async function request(path,token,payload,fetcher=fetch){
   if(typeof token!=='string'||!token.trim())throw Error('Sesión Face ID necesaria');
   const response=await fetcher(ORIGIN+path,{
     method:'POST',cache:'no-store',credentials:'omit',
     headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
     body:JSON.stringify(payload)
   });
   if(response.status===401||response.status===403)throw Error('Sesión caducada o no autorizada');
   if(response.status===429)throw Error('BBVA ha limitado temporalmente las consultas');
   if(!response.ok)throw Error('No se pudo obtener la información ('+response.status+')');
   return response.json();
 }
 async function accounts(token,fetcher){
   const result=await request('/bank/accounts',token,{},fetcher);
   if(!Array.isArray(result.accounts))throw Error('Respuesta de cuentas inválida');
   return result.accounts;
 }
 async function transactions(token,accountId,month,{refresh=false,fetcher}={}){
   if(typeof accountId!=='string'||!accountId.trim())throw Error('Selecciona una cuenta');
   if(!validMonth(month))throw Error('Mes inválido');
   const result=await request('/bank/transactions',token,{accountId,month,refresh:refresh===true},fetcher);
   if(!Array.isArray(result.transactions))throw Error('Respuesta de movimientos inválida');
   return result;
 }
 global.MisFinanzasBanco={accounts,transactions,validMonth};
})(typeof globalThis!=='undefined'?globalThis:this);
