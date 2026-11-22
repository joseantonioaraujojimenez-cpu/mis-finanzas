// Safe browser landing for a production AIS callback.
// This page never includes the authorization code, state, or provider error
// in its HTML, scripts, redirect targets, or loggable response body.
// The callback exchange remains disabled until server-side atomic binding is complete.
import {callbackSafetyCheck} from './bbva-production-readiness.js';
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
export function safeBankCallbackLanding(url){
 let valid=false;
 try{valid=callbackSafetyCheck(url).status==='requires_authenticated_one_time_exchange';}catch{}
 // Do not echo any query parameter or authorization code to the browser.
 const text=valid?'La respuesta de BBVA ha llegado, pero el intercambio de autorización aún no está habilitado. Vuelve a MIS FINANZAS.':'La autorización no se ha completado. Vuelve a MIS FINANZAS.';
 return new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MIS FINANZAS · BBVA</title></head><body><main><h1>Conexión BBVA</h1><p>'+text+'</p><p>No introduzcas aquí contraseñas ni claves bancarias.</p></main></body></html>',{status:valid?202:400,headers});
}
