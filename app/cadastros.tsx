'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Printer,ArrowDownAZ,ArrowUpAZ,UsersRound,Pencil,RefreshCw,ArrowLeft,FileText,ShieldCheck,X} from 'lucide-react';
import {Card} from './report-card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {blank,fields,mask,shown,states,validate,sortRecords,type Field,type Person,type RecordData,type SortKey} from '@/lib/records';
const labels:Record<Field,string>={name:'Nome completo',title:'Título de eleitor',zone:'Zona',section:'Seção',birth:'Nascimento',city:'Município do título',uf:'UF do título',address:'Endereço',cpf:'CPF',phone:'Celular',place:'Local de votação'};
const orderLabels:Record<SortKey,string>={name:'Nome',title:'Número do título',zone:'Zona',section:'Seção'};
const slots=[93.63,221.87,351.54,483.18,619.50];
type PrintItem={person:Person;number:number;top:number};
export default function Cadastros() {
 const [records,setRecords]=useState<Person[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sort,setSort]=useState<SortKey>('name'),[desc,setDesc]=useState(false);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<RecordData>({...blank}),[editing,setEditing]=useState<Person|null>(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState('');
 const id=useRef(''); const [printMode,setPrintMode]=useState(false),[pages,setPages]=useState<PrintItem[][]>([]),[printReady,setPrintReady]=useState(false);
 const measure=useRef<HTMLDivElement>(null);
 const sorted=useMemo(()=>sortRecords(records,sort,desc),[records,sort,desc]);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch('/api/records',{cache:'no-store'});const j=await r.json() as {error?:string;records:Person[]};if(!r.ok)throw new Error(j.error);setRecords(j.records);}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar. Tente novamente.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const onFocus=()=>{if(!open&&!printMode)void load();};window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);},[open,printMode,load]);
 const start=useCallback((person?:Person)=>{setEditing(person||null);setDraft(person?Object.fromEntries(fields.map(k=>[k,person[k]])) as RecordData:{...blank});id.current=person?.id||crypto.randomUUID();setFormError('');setOpen(true);},[]);
 useEffect(()=>{
  type MC={registerTool:(t:unknown,o:unknown)=>unknown};
  const context=(document as Document&{modelContext?:MC}).modelContext;if(!context?.registerTool)return;
  const ctl=new AbortController();
  try{Promise.resolve(context.registerTool({name:'abrir_novo_cadastro',title:'Abrir novo cadastro',description:'Abre o formulário vazio de cadastro. Não salva dados.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:(value:unknown)=>{if(!value||typeof value!=='object'||Object.keys(value).length)throw new Error('Nenhum parâmetro é aceito.');start();return{formulario:'aberto',salvo:false};}},{signal:ctl.signal})).catch(()=>{});}catch{}
  return()=>ctl.abort();
 },[start]);
 async function save(e:React.FormEvent){e.preventDefault();setFormError('');let data;try{data=validate(draft);}catch(e){setFormError((e as Error).message);return;}setSaving(true);
  try{const r=await fetch('/api/records',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id:id.current,revision:editing?.revision})});const j=await r.json() as {error?:string;record:Person};if(!r.ok)throw new Error(j.error);setRecords(old=>[...old.filter(x=>x.id!==j.record.id),j.record]);setOpen(false);setNotice(editing?'Cadastro atualizado.':'Cadastro salvo.');}
  catch(e){setFormError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');}finally{setSaving(false);}
 }
 useEffect(()=>{if(!printMode)return;let active=true;setPrintReady(false);
  void document.fonts.ready.then(()=>{if(!active||!measure.current)return;const elements=Array.from(measure.current.children) as HTMLElement[];const out:PrintItem[][]=[];let page:PrintItem[]=[];let next=slots[0];
   elements.forEach((el,i)=>{const height=el.getBoundingClientRect().height*0.75;
    let top=Math.max(slots[page.length]??next,next);
    if(page.length>=5 || top+height>800){out.push(page);page=[];next=slots[0];top=next;}
    page.push({person:sorted[i],number:i+1,top});next=top+height+20;
   });if(page.length)out.push(page);setPages(out);setPrintReady(true);
  });return()=>{active=false;};
 },[printMode,sorted]);
 const input=(k:Field,span='')=><div className={'field '+span} key={k}><Label htmlFor={k}>{labels[k]}{(k==='zone'||k==='section')&&<span className="required"> *</span>}</Label><Input id={k} value={draft[k]} onChange={e=>setDraft({...draft,[k]:mask(k,e.target.value)})} required={k==='zone'||k==='section'} inputMode={['title','zone','section','birth','cpf','phone'].includes(k)?'numeric':'text'} maxLength={k==='address'?400:k==='place'?300:k==='name'?160:k==='city'?120:100} placeholder={({title:'0000 0000 0000',zone:'000',section:'0000',birth:'DD/MM/AAAA',cpf:'000.000.000-00',phone:'(00) 00000-0000'} as Partial<Record<Field,string>>)[k]||'Não informado'} autoComplete="off" /></div>;
 return <>
  <div className={'app-shell '+(printMode?'hide-on-print':'')} hidden={printMode}>
   <header className="topbar"><div className="brand"><span className="brand-icon"><FileText size={23}/></span><span>Fichas<span className="brand-light"> / Cadastros eleitorais</span></span></div><span className="private-label"><ShieldCheck size={16}/> Acesso privado</span></header>
   <main className="workspace"><div className="page-heading"><div><p className="eyebrow">CADASTROS</p><h1>Seus cadastros, organizados.</h1><p className="subheading">Consulte, atualize e imprima suas fichas individuais.</p></div><Button size="lg" onClick={()=>start()}><Plus/> Novo cadastro</Button></div>
    <section className="listing"><div className="list-toolbar"><div className="list-title"><UsersRound size={21}/><h2>Lista de cadastros</h2><span className="counter">{records.length}</span></div><div className="tools"><Button variant="ghost" size="icon" title="Atualizar lista" aria-label="Atualizar lista" disabled={loading} onClick={()=>void load()}><RefreshCw className={loading?'spin':''}/></Button><Button variant="outline" disabled={!records.length||loading||!!error} onClick={()=>setPrintMode(true)}><Printer/> Imprimir fichas</Button></div></div>
     <div className="sortbar"><span>Ordenar por</span><Select value={sort} onValueChange={v=>setSort(v as SortKey)}><SelectTrigger aria-label="Ordenar por" className="sort-select"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(orderLabels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" aria-label={desc?'Usar ordem crescente':'Usar ordem decrescente'} title={desc?'Ordem decrescente':'Ordem crescente'} onClick={()=>setDesc(!desc)}>{desc?<ArrowUpAZ/>:<ArrowDownAZ/>}</Button><span className="sort-summary">{desc?'Ordem decrescente':'Ordem crescente'}</span></div>
     {error&&<div role="alert" className="error-box">{error} <Button variant="outline" onClick={()=>void load()}>Tentar novamente</Button></div>}
     {notice&&<div role="status" className="notice">{notice}<button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
     <Table><TableHeader><TableRow><TableHead className="number-col">Nº</TableHead>{(['name','title','zone','section'] as SortKey[]).map(k=><TableHead key={k} aria-sort={sort===k?(desc?'descending':'ascending'):'none'}><button className="column-sort" onClick={()=>{if(sort===k)setDesc(!desc);else{setSort(k);setDesc(false);}}}>{k==='name'?'Nome completo':orderLabels[k]}{sort===k&&<span>{desc?'↓':'↑'}</span>}</button></TableHead>)}<TableHead>Celular</TableHead><TableHead className="action-col">Editar</TableHead></TableRow></TableHeader><TableBody>
      {sorted.map((p,i)=><TableRow key={p.id}><TableCell className="row-number">{String(i+1).padStart(2,'0')}</TableCell><TableCell className={'person-name '+(!p.name?'missing':'')}>{shown(p.name)}</TableCell><TableCell className={'mono '+(!p.title?'missing':'')}>{shown(p.title)}</TableCell><TableCell><span className="zone-badge">{p.zone}</span></TableCell><TableCell className="mono">{p.section}</TableCell><TableCell className={!p.phone?'missing':'mono'}>{shown(p.phone)}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label={'Editar '+shown(p.name)} onClick={()=>start(p)}><Pencil/></Button></TableCell></TableRow>)}
     </TableBody></Table>
     {!records.length&&!error&&<div className="empty"><span className="empty-icon"><UsersRound size={30}/></span><h3>{loading?'Carregando cadastros…':'Sua lista começa aqui'}</h3><p>{loading?'Aguarde um instante.':'Adicione o primeiro cadastro. Só zona e seção são obrigatórias.'}</p>{!loading&&<Button onClick={()=>start()}><Plus/> Cadastrar pessoa</Button>}</div>}
     <footer className="table-footer"><span>{records.length} {records.length===1?'cadastro':'cadastros'}</span><span>Campos sem preenchimento: Não informado</span></footer>
    </section>
   </main><footer className="app-footer"><span>Fichas individuais</span><span>Os cadastros ficam disponíveis na sua conta.</span></footer>
  </div>
  <Dialog open={open} onOpenChange={v=>{if(!saving)setOpen(v);}}><DialogContent className="registration-modal" showCloseButton={false}><DialogHeader><div className="modal-heading"><div><DialogTitle>{editing?'Editar cadastro':'Novo cadastro'}</DialogTitle><DialogDescription>Preencha os dados disponíveis. <strong>Zona e seção são obrigatórias.</strong></DialogDescription></div><Button variant="ghost" size="icon" aria-label="Fechar cadastro" disabled={saving} onClick={()=>setOpen(false)}><X/></Button></div></DialogHeader><form onSubmit={save}><fieldset disabled={saving}><div className="form-grid">{input('name','full')}{input('title','half')}{input('zone')}{input('section')}{input('birth','half')}{input('city')}
   <div className="field"><Label htmlFor="uf">UF do título</Label><Select value={draft.uf||'empty'} onValueChange={v=>setDraft({...draft,uf:v==='empty'?'':v})}><SelectTrigger id="uf"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="empty">Não informado</SelectItem>{states.map(s=><SelectItem value={s} key={s}>{s}</SelectItem>)}</SelectContent></Select></div>
   {input('address','full')}{input('cpf','half')}{input('phone','half')}{input('place','full')}</div></fieldset>{formError&&<p className="error-box" role="alert">{formError}</p>}<div className="modal-footer"><span>* Campos obrigatórios</span><div><Button type="button" variant="outline" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar cadastro'}</Button></div></div></form></DialogContent></Dialog>
  {printMode&&<main className="print-view"><div className="print-toolbar"><Button variant="ghost" onClick={()=>setPrintMode(false)}><ArrowLeft/> Voltar à lista</Button><div><strong>Prévia de impressão</strong><span>{records.length} fichas · {pages.length} páginas · {orderLabels[sort]}</span></div><Button disabled={!printReady} onClick={()=>window.print()}><Printer/> Imprimir / Salvar PDF</Button></div><p className="print-help">Papel A4 · Escala 100% · Margens: nenhuma · Desative os cabeçalhos e rodapés do navegador e ative os gráficos de fundo.</p>
   <div className="print-measure" ref={measure} aria-hidden="true">{sorted.map((p,i)=><Card key={p.id} person={p} number={i+1}/>)}</div>
   <div className="pages">{pages.map((items,i)=><section className="paper" key={i} aria-label={'Página '+(i+1)}><div className="paper-stripe"/><header className="paper-header"><h1>Levantamento de títulos eleitorais</h1><p>Fichas individuais</p></header>{items.map(item=><div className="positioned-card" key={item.person.id} style={{top:item.top+'pt'}}><Card person={item.person} number={item.number}/></div>)}<div className="paper-footer"/></section>)}</div>
  </main>}
 </>;
}
