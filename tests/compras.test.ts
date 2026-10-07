import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
const key='10000000-0000-0000-0000-000000000001';
const datos={codmod:'1',colcom:'Azul',cancom:3};
async function entorno(fn: (request: any, calls: any[]) => Promise<void>, resultado: any={data:{creada:true,compra:{codcom:'1'}},error:null}) {
  const calls: any[]=[];
  const factory=(token:string)=>({
    auth:{getUser:async()=>({data:{user:token==='expired'?null:{id:token}},error:null})},
    rpc:async(name:string,args:any)=>{
      if(name==='hu007_usuario_actual') return {data:token==='inactive'?null:{codusu:'1',uuidusu:token,rol:token},error:null};
      calls.push({name,args,token}); return resultado;
    }
  } as unknown as SupabaseClient);
  const server=crearApp(factory).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const port=(server.address() as {port:number}).port;
  const request=async(method='GET',path='',body?:unknown,role:string|undefined='Gerente',clave:string|undefined=key)=>{
    const r=await fetch(`http://127.0.0.1:${port}/api/compras${path}`,{method,
      headers:{'Content-Type':'application/json',...(role?{Authorization:`Bearer ${role}`} : {}),...(clave?{'Idempotency-Key':clave}:{})},
      body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  };
  try{await fn(request,calls);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
test('HU034: gerente y administradora crean con clave y sin autor enviado',async()=>entorno(async(request,calls)=>{
  for(const role of ['Gerente','Administradora']) assert.equal((await request('POST','',{...datos,colcom:'  Azul   claro '},role)).status,201);
  assert.deepEqual(calls[0].args,{p_codmod:'1',p_colcom:'Azul claro',p_cancom:3,p_idempotencia:key});
}));
test('HU034: rechaza campos inválidos, series y autor falsificado antes del RPC',async()=>entorno(async(request,calls)=>{
  for(const body of [null,[],{}, {...datos,codmod:0},{...datos,codmod:1.5},{...datos,codmod:'9223372036854775808'},
    {...datos,colcom:''},{...datos,colcom:' '},{...datos,colcom:2},{...datos,colcom:'a'.repeat(51)},
    {...datos,cancom:0},{...datos,cancom:-1},{...datos,cancom:1.5},{...datos,cancom:'3'},{...datos,cancom:2147483648},
    {...datos,codusu:2},{...datos,estcom:'Identificada'},{...datos,nummotuni:'inventado'},{...datos,chauni:'inventado'}])
    assert.equal((await request('POST','',body)).status,400);
  assert.equal((await request('POST','',datos,'Gerente','')).status,400);
  assert.equal((await request('POST','',datos,'Gerente','invalid')).status,400);
  assert.equal(calls.length,0);
}));
test('HU034: permisos de escritura y sesiones',async()=>entorno(async(request)=>{
  assert.equal((await request('POST','',datos,'Vendedor')).status,403);
  assert.equal((await request('GET','',undefined,'')).status,401);
  assert.equal((await request('GET','',undefined,'expired')).status,401);
  assert.equal((await request('GET','',undefined,'inactive')).status,403);
}));
test('HU034: lista paginada y detalle usan funciones de proyección comercial',async()=>entorno(async(request,calls)=>{
  assert.equal((await request('GET','?limite=10&offset=20',undefined,'Vendedor')).status,200);
  assert.deepEqual(calls[0].args,{p_limite:10,p_offset:20});
  assert.equal((await request('GET','/9223372036854775807')).status,200);
  assert.equal(calls[1].args.p_codcom,'9223372036854775807');
  for(const path of ['/-1','/1.5','?limite=0','?limite=101','?offset=-1','?limite=abc']) assert.equal((await request('GET',path)).status,400);
}));
test('HU034: reintento responde 200 con la compra original',async()=>entorno(async request=>{
  const r=await request('POST','',datos);assert.equal(r.status,200);assert.equal(r.body.data.codcom,'42');
},{data:{creada:false,compra:{codcom:'42'}},error:null}));
for(const [code,status] of [['PT409',409],['PT422',400],['PT404',404],['42501',403],['XX000',500]])
  test(`HU034: error ${code} responde ${status} sin detalles privados`,async()=>entorno(async request=>{
    const r=await request('POST','',datos);assert.equal(r.status,status);assert.ok(!JSON.stringify(r.body).includes('privado'));
  },{data:null,error:{code,message:'detalle privado'}}));
