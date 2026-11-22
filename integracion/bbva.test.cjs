// Ejecutar: node --test integracion/bbva.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./bbva-movimientos.js');
require('./bbva-api.js');
const {normalize,merge}=globalThis.MisFinanzasBBVA;
const {transactions,accounts,validMonth}=globalThis.MisFinanzasBanco;
test('importe negativo en formato Enable Banking',()=>{const x=normalize({booking_date:'2026-10-20',transaction_amount:{amount:'-12.35'},transaction_id:'a'},'cuenta');assert.equal(x.kind,'expense');assert.equal(x.amount,12.35)});
test('importe positivo en formato español',()=>{const x=normalize({date:'2026-10-20',amount:'1.234,56'},'cuenta');assert.equal(x.amount,1234.56);assert.equal(x.kind,'income')});
test('fecha inexistente rechazada',()=>assert.throws(()=>normalize({date:'2026-02-30',amount:1},'c')));
test('cuenta obligatoria',()=>assert.throws(()=>normalize({date:'2026-10-20',amount:1},'')));
test('duplicados no se insertan dos veces',()=>{const row={date:'2026-10-20',amount:-20,transaction_id:'ref'};const a=merge([], [row,row], 'c');assert.equal(a.added,1);assert.equal(a.moves.length,1)});
test('mes inválido rechazado',()=>{assert.equal(validMonth('2026-13'),false);assert.equal(validMonth('2026-10'),true)});
test('sin sesión no hace petición',async()=>{let called=false;await assert.rejects(transactions('','c','2026-10',{fetcher:()=>{called=true}}));assert.equal(called,false)});
test('solo histórico, sin refresh por defecto',async()=>{let request;const fetcher=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({transactions:[]})}};await transactions('sesion','c','2026-10',{fetcher});assert.equal(JSON.parse(request.options.body).refresh,false);assert.equal(request.options.cache,'no-store')});
test('limitación bancaria visible',async()=>{const fetcher=async()=>({status:429,ok:false});await assert.rejects(transactions('sesion','c','2026-10',{fetcher}),/limitado/)});
test('cuentas validadas',async()=>{const fetcher=async()=>({ok:true,json:async()=>({accounts:[{id:'c'}]})});assert.equal((await accounts('sesion',fetcher)).length,1)});

test('concepto bancario como cadena se conserva entero',()=>{const x=normalize({date:'2026-10-20',amount:-5,remittance_information:'Compra supermercado'},'c');assert.equal(x.description,'Compra supermercado')});
test('concepto bancario como lista se concatena',()=>{const x=normalize({date:'2026-10-20',amount:-5,remittance_information:['COMPRA','SUPERMERCADO']},'c');assert.equal(x.description,'COMPRA SUPERMERCADO')});
test('no sobrescribe categoría y ámbito existentes',()=>{const row={date:'2026-10-20',amount:-5,transaction_id:'r'};const old={...normalize(row,'c'),scope:'shared',category:'Hogar'};const merged=merge([old],[row],'c');assert.equal(merged.added,0);assert.equal(merged.moves[0].scope,'shared');assert.equal(merged.moves[0].category,'Hogar')});
