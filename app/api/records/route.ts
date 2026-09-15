import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/database';
import { extractImportRecords, fields, normalizeImportRecord, recordIdentity, validate, type Person } from '@/lib/records';

export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const columns='id,name,title,zone,section,birth,city,uf,address,cpf,phone,place,revision,updated';

type Existing={id:string;name:string;title:string;zone:string;section:string;cpf:string};

export async function POST(request:Request) {
 const user=await getChatGPTUser(); if(!user) return json({error:'Entre na sua conta para importar.'},401);
 if(request.headers.get('sec-fetch-site')==='cross-site') return json({error:'Origem não permitida.'},403);
 if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Formato inválido.'},415);
 let payload:unknown;
 try { const raw=await request.text(); if(raw.length>2_000_000)return json({error:'Arquivo JSON muito grande. Limite: 2 MB.'},413); payload=JSON.parse(raw); }
 catch { return json({error:'O arquivo não contém um JSON válido.'},400); }
 let source:unknown[];
 try { source=extractImportRecords(payload); }
 catch(e){ return json({error:(e as Error).message},400); }
 if(!source.length) return json({error:'O JSON não contém cadastros.'},400);
 if(source.length>1000) return json({error:'Importe no máximo 1.000 cadastros por arquivo.'},413);

 const valid:{index:number;data:ReturnType<typeof validate>}[]=[];
 const invalid:{index:number;error:string}[]=[];
 source.forEach((item,index)=>{try{valid.push({index,data:validate(normalizeImportRecord(item))});}catch(e){invalid.push({index:index+1,error:(e as Error).message});}});
 if(!valid.length) return json({error:'Nenhum cadastro válido para importar.',invalid},400);

 try {
  const db=database();
  const {results}=await db.prepare('SELECT id,name,title,zone,section,cpf FROM records WHERE owner = ?').bind(user.userId).all<Existing>();
  const identities=new Set((results||[]).map(recordIdentity).filter(Boolean));
  const accepted:{index:number;data:ReturnType<typeof validate>;id:string}[]=[];
  const duplicates:{index:number;reason:string}[]=[];
  for(const item of valid){
   const key=recordIdentity(item.data);
   if(key&&identities.has(key)){duplicates.push({index:item.index+1,reason:'Cadastro já existente ou repetido no próprio arquivo.'});continue;}
   if(key)identities.add(key);
   accepted.push({...item,id:crypto.randomUUID()});
  }
  const updated=new Date().toISOString();
  for(let start=0;start<accepted.length;start+=100){
   const chunk=accepted.slice(start,start+100);
   if(!chunk.length)continue;
   await db.batch(chunk.map(item=>db.prepare(`INSERT INTO records (id,owner,${fields.join(',')},updated) VALUES (${Array(fields.length+3).fill('?').join(',')})`).bind(item.id,user.userId,...fields.map(k=>item.data[k]),updated)));
  }
  let created:Person[]=[];
  if(accepted.length){
   const ids=accepted.map(x=>x.id); const marks=ids.map(()=>'?').join(',');
   const rows=await db.prepare(`SELECT ${columns} FROM records WHERE owner = ? AND id IN (${marks})`).bind(user.userId,...ids).all<Person>();
   created=(rows.results||[]) as Person[];
  }
  return json({created,createdCount:created.length,duplicateCount:duplicates.length,invalidCount:invalid.length,duplicates,invalid,total:source.length},201);
 }catch(e){console.error('records-import',e);return json({error:'Não foi possível concluir a importação. Nenhum dado do arquivo foi alterado fora desta operação.'},503);}
}
