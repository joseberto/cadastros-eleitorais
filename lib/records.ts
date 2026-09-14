export const fields = ['name','title','zone','section','birth','city','uf','address','cpf','phone','place','indication'] as const;
export type Field = typeof fields[number];
export type RecordData = { [K in Field]: string };
export type Person = RecordData & {id:string; revision:number; updated:string; marked?: boolean};
export const blank = Object.fromEntries(fields.map(k=>[k,''])) as RecordData;
export const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const digits = (v?: string | null) => (typeof v === 'string' ? v.replace(/\D/g,'') : '');
export const shown = (v?: string | null) => (typeof v === 'string' ? v.trim() : '') || 'Não informado';

export function mask(field:Field, value?: string | null) {
 if(!value || typeof value !== 'string') return '';
 if(field==='title') return digits(value).slice(0,12).replace(/(\d{4})(?=\d)/g,'$1 ');
 if(field==='zone') return digits(value).slice(0,3);
 if(field==='section') return digits(value).slice(0,4);
 if(field==='birth') return digits(value).slice(0,8).replace(/^(\d{2})(\d)/,'$1/$2').replace(/^(\d{2}\/\d{2})(\d)/,'$1/$2');
 if(field==='cpf') return digits(value).slice(0,11).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3}\.\d{3})(\d)/,'$1.$2').replace(/(\.\d{3})(\d)/,'$1-$2');
 if(field==='phone') { const d=digits(value).slice(0,11); if(d.length<3) return d?'('+d:''; const tail=d.slice(2),n=d.length>10?5:4; return '('+d.slice(0,2)+') '+tail.slice(0,n)+(tail.length>n?'-'+tail.slice(n):''); }
 return value;
}

export function validate(input:unknown):RecordData {
 if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Cadastro inválido.');
 const data={...blank}, source=input as Record<string,unknown>;
 const limits:Partial<Record<Field,number>>={name:160,city:120,address:400,place:300,indication:160};
 for(const k of fields) {
  if(source[k]!==undefined && typeof source[k]!=='string') throw new Error('Campo inválido: '+k);
  data[k]=(source[k] as string || '').trim();
  if(data[k].length>(limits[k]||100)) throw new Error('Texto muito longo.');
 }
 if(!/^\d{1,3}$/.test(data.zone)||+data.zone<1) throw new Error('Informe uma zona válida, com até 3 dígitos.');
 if(!/^\d{1,4}$/.test(data.section)||+data.section<1) throw new Error('Informe uma seção válida, com até 4 dígitos.');
 if(data.title && !/^\d{12}$/.test(digits(data.title))) throw new Error('O título deve ter 12 dígitos.');
 if(data.cpf && !/^\d{11}$/.test(digits(data.cpf))) throw new Error('O CPF deve ter 11 dígitos.');
 if(data.phone && !/^\d{10,11}$/.test(digits(data.phone))) throw new Error('Informe o celular com DDD e 10 ou 11 dígitos.');
 if(data.uf && !states.includes(data.uf)) throw new Error('Selecione uma UF válida.');
 if(data.birth) {
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(data.birth)) throw new Error('Use DD/MM/AAAA no nascimento.');
  const [d,m,y]=data.birth.split('/').map(Number), date=new Date(Date.UTC(y,m-1,d));
  if(y<1900||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d||date.getTime()>Date.now()) throw new Error('Informe uma data de nascimento válida.');
 }
 for(const k of ['title','cpf','phone','birth'] as Field[]) data[k]=mask(k,data[k]);
 data.zone=data.zone.padStart(3,'0'); data.section=data.section.padStart(4,'0');
 return data;
}

const keyName=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,Field>={
 name:'name',nome:'name',nomecompleto:'name',
 title:'title',titulo:'title',titulodeeleitor:'title',numerodotitulo:'title',numerotitulo:'title',inscricao:'title',
 zone:'zone',zona:'zone',
 section:'section',secao:'section',sessao:'section',
 birth:'birth',nascimento:'birth',datadenascimento:'birth',datanascimento:'birth',
 city:'city',cidade:'city',municipio:'city',municipiodotitulo:'city',
 uf:'uf',estado:'uf',ufdotitulo:'uf',
 address:'address',endereco:'address',
 cpf:'cpf',
 phone:'phone',celular:'phone',telefone:'phone',fone:'phone',
 place:'place',local:'place',localdevotacao:'place',locavotacao:'place',
 indication:'indication',indicacao:'indication',indicadopor:'indication',indicado:'indication',indicador:'indication',referencia:'indication',lideranca:'indication',
};
// Corrige a entrada "estado" sem aceitar valores fora das UFs.
aliases.estado='uf';

function cleanImportedValue(value:unknown):string {
 if(value===null||value===undefined) return '';
 const text=String(value).trim();
 return /^(nao informado|não informado|n\/a|null|undefined|-|—)$/i.test(text)?'':text;
}

export function isMarkedValue(value:unknown):boolean {
 if(typeof value==='boolean') return value;
 if(typeof value==='number') return value===1;
 if(typeof value==='string') {
  const s=value.trim().toLowerCase();
  return ['true','sim','s','1','v','marcado','ok','checked','check','atendido','sim/marcado'].includes(s);
 }
 return false;
}

export function normalizeImportRecord(input:unknown):RecordData & {marked?: boolean} {
 if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('O item não é um cadastro válido.');
 const out={...blank} as RecordData & {marked?: boolean};
 let marked = false;
 for(const [rawKey,value] of Object.entries(input as Record<string,unknown>)) {
  const normKey = keyName(rawKey);
  if(['marcado','marked','marcar','status','atendido','concluido','check','checked'].includes(normKey)) {
   if(isMarkedValue(value)) marked = true;
  }
  const field=aliases[normKey];
  if(field) out[field]=cleanImportedValue(value);
 }
 if(out.uf) out.uf=out.uf.toUpperCase();
 for(const k of ['title','zone','section','birth','cpf','phone'] as Field[]) out[k]=mask(k,out[k]);
 if(marked) out.marked = true;
 return out;
}

export function extractImportRecords(payload:unknown):unknown[] {
 if(Array.isArray(payload)) return payload;
 if(!payload||typeof payload!=='object') throw new Error('O JSON precisa conter uma lista de cadastros.');
 const obj=payload as Record<string,unknown>;
 for(const key of ['records','cadastros','registros','data','dados','pessoas']) if(Array.isArray(obj[key])) return obj[key] as unknown[];
 throw new Error('Não encontrei a lista. Use um array ou uma propriedade "records"/"cadastros".');
}

export function recordIdentity(input:Pick<RecordData,'name'|'title'|'zone'|'section'|'cpf'>):string {
 const title=digits(input.title); if(title.length===12) return 'T:'+title;
 const cpf=digits(input.cpf); if(cpf.length===11) return 'C:'+cpf;
 const name=input.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
 return name?'N:'+name+'|'+digits(input.zone)+'|'+digits(input.section):'';
}

export type SortKey = 'name'|'title'|'zone'|'section'|'indication'|'marked';
export function sortRecords(records:Person[],key:SortKey,descending=false) {
 const c=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
 return [...records].sort((a,b)=>{
  if(key==='marked') {
   const valA = a.marked ? 1 : 0;
   const valB = b.marked ? 1 : 0;
   const cmp = valB - valA;
   return (cmp || c.compare(a.name, b.name) || a.id.localeCompare(b.id)) * (descending ? -1 : 1);
  }
  const valA = a[key] || '';
  const valB = b[key] || '';
  if(!valA && valB) return 1;
  if(valA && !valB) return -1;
  const cmp = ['name', 'indication'].includes(key)
    ? c.compare(valA, valB)
    : Number(digits(valA)) - Number(digits(valB));
  return (cmp || c.compare(a.name, b.name) || a.id.localeCompare(b.id)) * (descending ? -1 : 1);
 });
}
