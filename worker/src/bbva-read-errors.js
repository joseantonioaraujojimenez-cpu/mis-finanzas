// Only fixed, non-sensitive error codes are allowed across the browser boundary.
const descriptions={
 BANK_PERIOD:'BBVA no permite consultar este periodo de fechas. Prueba otro mes.',
 BANK_CONSENT:'El consentimiento bancario ha caducado o ya no está activo. Comprueba la conexión BBVA.',
 BANK_RATE:'BBVA ha limitado temporalmente las consultas. Inténtalo más tarde.',
 BANK_TIMEOUT:'BBVA no ha respondido a tiempo. Inténtalo de nuevo.',
 BANK_DATA:'BBVA devolvió movimientos que no se pueden interpretar con seguridad. No se han mostrado cifras incompletas.',
 BANK_PAGES:'No se ha podido completar todas las páginas del histórico. No se han mostrado cifras incompletas.',
 BANK_UNAVAILABLE:'No se ha podido completar la consulta bancaria. Comprueba la conexión e inténtalo de nuevo.',
 OWNER_SESSION:'La sesión de Face ID ha caducado. Vuelve a iniciar sesión.'
};
export function readErrorMessage(code){return Object.hasOwn(descriptions,code)?descriptions[code]:descriptions.BANK_UNAVAILABLE;}
export class BankReadError extends Error{constructor(code){super(readErrorMessage(code));this.code=Object.hasOwn(descriptions,code)?code:'BANK_UNAVAILABLE';}}
export function safeReadCode(error){return error instanceof BankReadError?error.code:'BANK_UNAVAILABLE';}
export async function providerReadError(response){
 let code;try{code=(await response?.json?.())?.error;}catch{}
 if(['WRONG_TRANSACTIONS_PERIOD','WRONG_DATE_INTERVAL','DATE_FROM_IN_FUTURE'].includes(code))return new BankReadError('BANK_PERIOD');
 if(['EXPIRED_SESSION','REVOKED_SESSION','CLOSED_SESSION','SESSION_DOES_NOT_EXIST','ASPSP_PSU_ACTION_REQUIRED'].includes(code))return new BankReadError('BANK_CONSENT');
 if(response?.status===429||code==='ASPSP_RATE_LIMIT_EXCEEDED')return new BankReadError('BANK_RATE');
 if(response?.status===408||code==='ASPSP_TIMEOUT')return new BankReadError('BANK_TIMEOUT');
 return new BankReadError('BANK_UNAVAILABLE');
}
