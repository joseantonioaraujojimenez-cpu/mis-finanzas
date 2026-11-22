/* Mis Finanzas: adaptador de movimientos BBVA. No publica ni llama al banco.
 * El backend autenticado debe entregar un array de movimientos; nunca incluir secretos aquí.
 */
(function(global){
  'use strict';
  function cents(value){
    if(typeof value==='number' && Number.isFinite(value)) return Math.round(value*100);
    if(typeof value!=='string') throw Error('Importe inválido');
    const raw=value.trim().replace(/\s/g,'').replace(/€/g,'');
    const normalized=raw.includes(',') ? raw.replace(/\./g,'').replace(',','.') : raw;
    if(!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) throw Error('Importe inválido');
    return Math.round(Number(normalized)*100);
  }
  function normalize(row,accountId){
    if(!row || typeof row!=='object') throw Error('Movimiento inválido');
    const date=String(row.booking_date||row.bookingDate||row.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z'))) throw Error('Fecha inválida');
    const amountCents=cents(row.amount?.amount ?? row.amount ?? row.transaction_amount);
    const description=String(row.remittance_information?.[0]||row.description||row.concept||'').slice(0,250);
    const remoteId=String(row.transaction_id||row.transactionId||row.entry_reference||'').trim();
    const account=String(accountId||'').trim();
    if(!account) throw Error('Cuenta requerida');
    const identity=remoteId || [date,amountCents,description].join('|');
    return {id:'bbva:'+account+':'+identity,kind:amountCents<0?'expense':'income',amount:Math.abs(amountCents)/100,date,description,scope:'personal',source:'bbva',accountId:account};
  }
  function merge(existing,remote,accountId){
    if(!Array.isArray(existing)||!Array.isArray(remote)) throw Error('Lista inválida');
    const map=new Map(existing.map(m=>[m.id,m]));
    let added=0;
    for(const item of remote){
      const row=normalize(item,accountId);
      if(!map.has(row.id)){map.set(row.id,row);added++;}
    }
    return {moves:[...map.values()],added};
  }
  global.MisFinanzasBBVA={normalize,merge};
})(typeof globalThis!=='undefined'?globalThis:this);
