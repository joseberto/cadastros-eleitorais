export const fields = ['name','title','zone','section','birth','city','uf','address','cpf','phone','place'] as const;
export type Field = typeof fields[number];
export type RecordData = { [K in Field]: string };
export type Person = RecordData & {id:string; revision:number; updated:string};
export const blank = Object.fromEntries(fields.map(k=>[k,''])) as RecordData;
export const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const digits = (v:string) => v.replace(/\D/g,'');
export const shown = (v:string) => v.trim() || 'Não informado';
export function mask(field:Field, value:string) {
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
 const limits:Partial<Record<Field,number>>={name:160,city:120,address:400,place:300};
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
export type SortKey = 'name'|'title'|'zone'|'section';
export function sortRecords(records:Person[],key:SortKey,descending=false) {
 const c=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
 return [...records].sort((a,b)=>{
  if(!a[key]&&b[key]) return 1; if(a[key]&&!b[key]) return -1;
  const cmp=key==='name'?c.compare(a.name,b.name):Number(digits(a[key]))-Number(digits(b[key]));
  return (cmp||c.compare(a.name,b.name)||a.id.localeCompare(b.id))*(descending?-1:1);
 });
}
