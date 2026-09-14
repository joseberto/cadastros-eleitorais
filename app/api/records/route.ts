import { getChatGPTUser } from '../../chatgpt-auth';
import { database } from '@/lib/database';
import { fields, validate } from '@/lib/records';
export const dynamic = 'force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const columns='id,name,title,zone,section,birth,city,uf,address,cpf,phone,place,revision,updated';
export async function GET() {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta para acessar os cadastros.'},401);
 try {
  const {results}=await database().prepare(`SELECT ${columns} FROM records WHERE owner = ?`).bind(user.userId).all();
  return json({records:results});
 }catch(e){console.error('records-read',e);return json({error:'Não foi possível carregar os cadastros. Tente novamente.'},503);}
}
async function write(request:Request,editing:boolean) {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta para salvar.'},401);
 if(request.headers.get('sec-fetch-site')==='cross-site') return json({error:'Origem não permitida.'},403);
 if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Formato inválido.'},415);
 let body:Record<string,unknown>,data;
 try {const raw=await request.text();if(raw.length>12000)return json({error:'Cadastro muito grande.'},413);body=JSON.parse(raw);data=validate(body);}
 catch(e){return json({error:e instanceof Error?e.message:'Cadastro inválido.'},400);}
 const id=body.id;
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'Identificador inválido.'},400);
 if(editing&&(!Number.isInteger(body.revision)||Number(body.revision)<1)) return json({error:'Versão inválida.'},400);
 const updated=new Date().toISOString();
 try {
  const db=database(); let row;
  if(editing) {
   row=await db.prepare(`UPDATE records SET ${fields.map(k=>k+' = ?').join(', ')}, updated = ?, revision = revision + 1 WHERE id = ? AND owner = ? AND revision = ? RETURNING ${columns}`).bind(...fields.map(k=>data[k]),updated,id,user.userId,body.revision).first();
   if(!row)return json({error:'Este cadastro foi alterado em outro dispositivo. Feche a janela e atualize a lista antes de editar novamente.'},409);
  }else {
   row=await db.prepare(`INSERT INTO records (id,owner,${fields.join(',')},updated) VALUES (${Array(fields.length+3).fill('?').join(',')}) ON CONFLICT(id) DO NOTHING RETURNING ${columns}`).bind(id,user.userId,...fields.map(k=>data[k]),updated).first();
   if(!row)row=await db.prepare(`SELECT ${columns} FROM records WHERE id = ? AND owner = ?`).bind(id,user.userId).first();
   if(!row)return json({error:'Não foi possível salvar. Abra um novo cadastro.'},409);
  }
  return json({record:row},editing?200:201);
 }catch(e){console.error('records-write',e);return json({error:'Não foi possível salvar. Seus dados continuam no formulário; tente novamente.'},503);}
}
export async function POST(r:Request){return write(r,false);}
export async function PUT(r:Request){return write(r,true);}
