'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Printer,ArrowDownAZ,ArrowUpAZ,UsersRound,Pencil,RefreshCw,ArrowLeft,FileText,ShieldCheck,X,Upload,FileJson,AlertTriangle,CheckCircle2,Check,CheckCheck,Trash2} from 'lucide-react';
import {Card} from './report-card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {blank,fields,mask,shown,states,validate,sortRecords,extractImportRecords,normalizeImportRecord,recordIdentity,type Field,type Person,type RecordData,type SortKey} from '@/lib/records';
const labels:Record<Field,string>={name:'Nome completo',title:'Título de eleitor',zone:'Zona',section:'Seção',birth:'Nascimento',city:'Município do título',uf:'UF do título',address:'Endereço',cpf:'CPF',phone:'Celular',place:'Local de votação',indication:'Indicação'};
const orderLabels:Record<SortKey,string>={name:'Nome',title:'Número do título',zone:'Zona',section:'Seção',indication:'Indicação',marked:'Marcados'};
const slots=[93.63,221.87,351.54,483.18,619.50];
type PrintItem={person:Person;number:number;top:number};
type ImportRow={index:number;data?:RecordData & {marked?: boolean};error?:string;duplicate?:boolean;alreadyMarked?:boolean};
export default function Cadastros() {
 const [records,setRecords]=useState<Person[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sort,setSort]=useState<SortKey>('name'),[desc,setDesc]=useState(false);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<RecordData>({...blank}),[draftMarked,setDraftMarked]=useState(false),[editing,setEditing]=useState<Person|null>(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState('');
 const id=useRef(''); const [printMode,setPrintMode]=useState(false),[pages,setPages]=useState<PrintItem[][]>([]),[printReady,setPrintReady]=useState(false);
 const [importOpen,setImportOpen]=useState(false),[importRows,setImportRows]=useState<ImportRow[]>([]),[importName,setImportName]=useState(''),[importError,setImportError]=useState(''),[importing,setImporting]=useState(false);
 const measure=useRef<HTMLDivElement>(null),importInput=useRef<HTMLInputElement>(null);
 const sorted=useMemo(()=>sortRecords(records,sort,desc),[records,sort,desc]);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch('/api/records',{cache:'no-store'});const j=await r.json() as {error?:string;records:Person[]};if(!r.ok)throw new Error(j.error);setRecords(j.records.map(x=>({...x,marked:!!x.marked})));}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar. Tente novamente.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const onFocus=()=>{if(!open&&!printMode)void load();};window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);},[open,printMode,load]);
 const start=useCallback((person?:Person)=>{setEditing(person||null);setDraft(person?Object.fromEntries(fields.map(k=>[k,person[k]||''])) as RecordData:{...blank});setDraftMarked(person?!!person.marked:false);id.current=person?.id||crypto.randomUUID();setFormError('');setOpen(true);},[]);
 
 const toggleMarkPerson = useCallback((personId: string) => {
  setRecords(old => old.map(x => x.id === personId ? {...x, marked: !x.marked} : x));
 }, []);

 const markAllRecords = useCallback((mark: boolean) => {
  setRecords(old => old.map(x => ({...x, marked: mark})));
  setNotice(`${records.length} cadastro(s) ${mark ? 'marcados' : 'desmarcados'}.`);
 }, [records.length]);

 async function save(e:React.FormEvent){e.preventDefault();setFormError('');let data;try{data=validate(draft);}catch(e){setFormError((e as Error).message);return;}setSaving(true);
  try{const r=await fetch('/api/records',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id:id.current,revision:editing?.revision,marked:draftMarked})});const j=await r.json() as {error?:string;record:Person};if(!r.ok)throw new Error(j.error);setRecords(old=>[...old.filter(x=>x.id!==j.record.id),{...j.record,marked:draftMarked}]);setOpen(false);setNotice(editing?'Cadastro atualizado.':'Cadastro salvo.');}
  catch(e){setFormError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');}finally{setSaving(false);}
 }
 async function chooseImport(file?:File){
  if(!file)return; setImportError('');setImportRows([]);setImportName(file.name);
  if(file.size>3_000_000){setImportError('O arquivo ultrapassa 3 MB.');setImportOpen(true);return;}
  try{
   const payload=JSON.parse(await file.text()) as unknown; const list=extractImportRecords(payload); if(!list.length)throw new Error('O JSON não contém cadastros.'); if(list.length>5000)throw new Error('O limite é de 5.000 cadastros por arquivo.');
   const known=new Set(records.map(recordIdentity).filter(Boolean));
   const markedIdentities=new Set(records.filter(r=>r.marked).map(recordIdentity).filter(Boolean));
   const rows:ImportRow[]=[];
   list.forEach((raw,index)=>{try{const norm=normalizeImportRecord(raw);const data=validate(norm) as RecordData & {marked?: boolean};data.marked=norm.marked;const key=recordIdentity(data);const duplicate=!!key&&known.has(key);const alreadyMarked=!!norm.marked||(!!key&&markedIdentities.has(key));if(key&&!duplicate)known.add(key);rows.push({index:index+1,data,duplicate,alreadyMarked});}catch(e){rows.push({index:index+1,error:(e as Error).message});}});
   setImportRows(rows);setImportOpen(true);
  }catch(e){setImportError(e instanceof Error?e.message:'Não foi possível ler o arquivo JSON.');setImportOpen(true);}
  finally{if(importInput.current)importInput.current.value='';}
 }
 async function runImport(){
  const ready=importRows.filter(r=>r.data&&!r.duplicate&&!r.alreadyMarked).map(r=>r.data as RecordData); if(!ready.length)return; setImporting(true);setImportError('');
  try{const r=await fetch('/api/records/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:ready})});const j=await r.json() as {error?:string;created?:Person[];createdCount?:number;duplicateCount?:number;invalidCount?:number};if(!r.ok)throw new Error(j.error);const created=(j.created||[]).map(x=>({...x,marked:false}));setRecords(old=>[...old,...created]);setImportOpen(false);setImportRows([]);setNotice(`${j.createdCount??created.length} cadastro(s) importado(s) com sucesso. Cadastros marcados foram ignorados.`);}
  catch(e){setImportError(e instanceof Error?e.message:'Não foi possível importar. Tente novamente.');}finally{setImporting(false);}
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
   <main className="workspace"><div className="page-heading"><div><p className="eyebrow">CADASTROS</p><h1>Seus cadastros, organizados.</h1><p className="subheading">Consulte, atualize, importe e imprima suas fichas individuais.</p></div><div className="heading-actions"><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e=>void chooseImport(e.target.files?.[0])}/><Button size="lg" variant="outline" onClick={()=>importInput.current?.click()}><Upload/> Importar JSON</Button><Button size="lg" onClick={()=>start()}><Plus/> Novo cadastro</Button></div></div>
    <section className="listing"><div className="list-toolbar"><div className="list-title"><UsersRound size={21}/><h2>Lista de cadastros</h2><span className="counter">{records.length}</span></div><div className="tools"><Button variant="ghost" size="icon" title="Atualizar lista" aria-label="Atualizar lista" disabled={loading} onClick={()=>void load()}><RefreshCw className={loading?'spin':''}/></Button><Button variant="outline" disabled={!records.length||loading||!!error} onClick={()=>setPrintMode(true)}><Printer/> Imprimir fichas</Button></div></div>
     <div className="sortbar"><span>Ordenar por</span><Select value={sort} onValueChange={v=>setSort(v as SortKey)}><SelectTrigger aria-label="Ordenar por" className="sort-select"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(orderLabels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" aria-label={desc?'Usar ordem crescente':'Usar ordem decrescente'} title={desc?'Ordem decrescente':'Ordem crescente'} onClick={()=>setDesc(!desc)}>{desc?<ArrowUpAZ/>:<ArrowDownAZ/>}</Button><span className="sort-summary">{desc?'Ordem decrescente':'Ordem crescente'}</span>
      {records.length > 0 && <div style={{display:'inline-flex',gap:'6px',marginLeft:'12px'}}><Button variant="outline" size="sm" onClick={()=>markAllRecords(true)} style={{height:'32px',fontSize:'12px',color:'#0f766e'}}><CheckCheck size={14} style={{marginRight:'4px'}}/> Marcar todos</Button><Button variant="ghost" size="sm" onClick={()=>markAllRecords(false)} style={{height:'32px',fontSize:'12px',color:'#64748b'}}>Desmarcar</Button></div>}
     </div>
     {error&&<div role="alert" className="error-box">{error} <Button variant="outline" onClick={()=>void load()}>Tentar novamente</Button></div>}
     {notice&&<div role="status" className="notice">{notice}<button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
     <Table><TableHeader><TableRow><TableHead className="number-col">Nº</TableHead><TableHead style={{width:'80px',textAlign:'center'}}>Marcado</TableHead>{(['name','title','zone','section'] as SortKey[]).map(k=><TableHead key={k} aria-sort={sort===k?(desc?'descending':'ascending'):'none'}><button className="column-sort" onClick={()=>{if(sort===k)setDesc(!desc);else{setSort(k);setDesc(false);}}}>{k==='name'?'Nome completo':orderLabels[k]}{sort===k&&<span>{desc?'↓':'↑'}</span>}</button></TableHead>)}<TableHead>Celular</TableHead><TableHead className="action-col" style={{width:'110px'}}>Ações</TableHead></TableRow></TableHeader><TableBody>
      {sorted.map((p,i)=><TableRow key={p.id}><TableCell className="row-number">{String(i+1).padStart(2,'0')}</TableCell><TableCell style={{textAlign:'center'}}><button type="button" onClick={()=>toggleMarkPerson(p.id)} title={p.marked?'Marcado - clique para alternar':'Não marcado - clique para alternar'} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'28px',height:'28px',borderRadius:'6px',backgroundColor:p.marked?'#ecfdf5':'#f8fafc',color:p.marked?'#059669':'#94a3b8',border:`1px solid ${p.marked?'#a7f3d0':'#e2e8f0'}`,cursor:'pointer'}}>{p.marked?<Check size={17} strokeWidth={3}/>:<X size={15} strokeWidth={2.5}/>}</button></TableCell><TableCell className={'person-name '+(!p.name?'missing':'')}>{shown(p.name)}</TableCell><TableCell className={'mono '+(!p.title?'missing':'')}>{shown(p.title)}</TableCell><TableCell><span className="zone-badge">{p.zone}</span></TableCell><TableCell className="mono">{p.section}</TableCell><TableCell className={!p.phone?'missing':'mono'}>{shown(p.phone)}</TableCell><TableCell><div style={{display:'flex',gap:'4px'}}><Button variant="ghost" size="icon" aria-label={(p.marked?'Desmarcar ':'Marcar ')+shown(p.name)} title={p.marked?'Marcado':'Não marcado'} onClick={()=>toggleMarkPerson(p.id)} style={{color:p.marked?'#059669':'#64748b'}}>{p.marked?<CheckCircle2 size={16}/>:<Check size={16}/>}</Button><Button variant="ghost" size="icon" aria-label={'Editar '+shown(p.name)} onClick={()=>start(p)}><Pencil size={15}/></Button></div></TableCell></TableRow>)}
     </TableBody></Table>
     {!records.length&&!error&&<div className="empty"><span className="empty-icon"><UsersRound size={30}/></span><h3>{loading?'Carregando cadastros…':'Sua lista começa aqui'}</h3><p>{loading?'Aguarde um instante.':'Adicione o primeiro cadastro. Só zona e seção são obrigatórias.'}</p>{!loading&&<Button onClick={()=>start()}><Plus/> Cadastrar pessoa</Button>}</div>}
     <footer className="table-footer"><span>{records.length} {records.length===1?'cadastro':'cadastros'}</span><span>Campos sem preenchimento: Não informado</span></footer>
    </section>
   </main><footer className="app-footer"><span>Fichas individuais</span><span>Os cadastros ficam disponíveis na sua conta.</span></footer>
  </div>
  <Dialog open={open} onOpenChange={v=>{if(!saving)setOpen(v);}}><DialogContent className="registration-modal" showCloseButton={false}><DialogHeader><div className="modal-heading"><div><DialogTitle>{editing?'Editar cadastro':'Novo cadastro'}</DialogTitle><DialogDescription>Preencha os dados disponíveis. <strong>Zona e seção são obrigatórias.</strong></DialogDescription></div><Button variant="ghost" size="icon" aria-label="Fechar cadastro" disabled={saving} onClick={()=>setOpen(false)}><X/></Button></div></DialogHeader><form onSubmit={save}><fieldset disabled={saving}><div className="form-grid">{input('name','full')}{input('title','half')}{input('zone')}{input('section')}{input('birth','half')}{input('city')}
   <div className="field"><Label htmlFor="uf">UF do título</Label><Select value={draft.uf||'empty'} onValueChange={v=>setDraft({...draft,uf:v==='empty'?'':v})}><SelectTrigger id="uf"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="empty">Não informado</SelectItem>{states.map(s=><SelectItem value={s} key={s}>{s}</SelectItem>)}</SelectContent></Select></div>
   {input('address','full')}{input('cpf','half')}{input('phone','half')}{input('place','full')}<div className="field full" style={{display:'flex',flexDirection:'row',alignItems:'center',gap:'10px',marginTop:'4px'}}><input type="checkbox" id="draftMarkedCad" checked={draftMarked} onChange={e=>setDraftMarked(e.target.checked)} style={{width:'18px',height:'18px',accentColor:'#127c80',cursor:'pointer'}}/><Label htmlFor="draftMarkedCad" style={{cursor:'pointer',margin:0,fontWeight:600}}>Marcar este cadastro</Label></div></div></fieldset>{formError&&<p className="error-box" role="alert">{formError}</p>}<div className="modal-footer"><span>* Campos obrigatórios</span><div><Button type="button" variant="outline" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar cadastro'}</Button></div></div></form></DialogContent></Dialog>
  <Dialog open={importOpen} onOpenChange={v=>{if(!importing)setImportOpen(v);}}><DialogContent className="import-modal" showCloseButton={false}><DialogHeader><div className="modal-heading"><div><DialogTitle>Importar cadastros por JSON</DialogTitle><DialogDescription>{importName?<>Arquivo: <strong>{importName}</strong></>:<>Selecione um arquivo JSON com os cadastros.</>}</DialogDescription></div><Button variant="ghost" size="icon" aria-label="Fechar importação" disabled={importing} onClick={()=>setImportOpen(false)}><X/></Button></div></DialogHeader>
   {importError&&<p className="error-box" role="alert">{importError}</p>}
   {!!importRows.length&&<><div className="import-summary"><span><FileJson size={18}/><strong>{importRows.length}</strong> no arquivo</span><span className="ok"><CheckCircle2 size={18}/><strong>{importRows.filter(r=>r.data&&!r.duplicate&&!r.alreadyMarked).length}</strong> prontos</span>{importRows.some(r=>r.alreadyMarked)&&<span style={{color:'#b45309',background:'#fef3c7'}}><AlertTriangle size={18}/><strong>{importRows.filter(r=>r.alreadyMarked).length}</strong> já marcados</span>}<span><strong>{importRows.filter(r=>r.duplicate&&!r.alreadyMarked).length}</strong> repetidos</span><span className={importRows.some(r=>r.error)?'warn':''}><AlertTriangle size={18}/><strong>{importRows.filter(r=>r.error).length}</strong> inválidos</span></div><p className="import-help">Registros repetidos ou já marcados são ignorados automaticamente.</p><div className="import-preview"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nome</TableHead><TableHead>Título</TableHead><TableHead>Zona</TableHead><TableHead>Seção</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{importRows.slice(0,100).map(row=><TableRow key={row.index}><TableCell>{row.index}</TableCell><TableCell>{row.data?shown(row.data.name):'—'}</TableCell><TableCell className="mono">{row.data?shown(row.data.title):'—'}</TableCell><TableCell>{row.data?.zone||'—'}</TableCell><TableCell>{row.data?.section||'—'}</TableCell><TableCell>{row.error?<span className="status-error">{row.error}</span>:row.alreadyMarked?<span style={{color:'#b45309',fontWeight:600,background:'#fef3c7',padding:'2px 6px',borderRadius:'4px',fontSize:'11px'}}>Ignorado (Marcado)</span>:row.duplicate?<span className="status-dup">Repetido</span>:<span className="status-ok">Pronto</span>}</TableCell></TableRow>)}</TableBody></Table>{importRows.length>100&&<p className="preview-more">Prévia dos 100 primeiros de {importRows.length}.</p>}</div></>}
   <div className="modal-footer import-footer"><span>Campos aceitos: nome, título, zona, seção, nascimento, município, UF, endereço, CPF, celular e local de votação.</span><div><Button type="button" variant="outline" disabled={importing} onClick={()=>setImportOpen(false)}>Cancelar</Button><Button type="button" disabled={importing||!importRows.some(r=>r.data&&!r.duplicate&&!r.alreadyMarked)} onClick={()=>void runImport()}>{importing?'Importando…':`Importar ${importRows.filter(r=>r.data&&!r.duplicate&&!r.alreadyMarked).length}`}</Button></div></div>
  </DialogContent></Dialog>
  {printMode&&<main className="print-view"><div className="print-toolbar"><Button variant="ghost" onClick={()=>setPrintMode(false)}><ArrowLeft/> Voltar à lista</Button><div><strong>Prévia de impressão</strong><span>{records.length} fichas · {pages.length} páginas · {orderLabels[sort]}</span></div><Button disabled={!printReady} onClick={()=>window.print()}><Printer/> Imprimir / Salvar PDF</Button></div><p className="print-help">Papel A4 · Escala 100% · Margens: nenhuma · Desative os cabeçalhos e rodapés do navegador e ative os gráficos de fundo.</p>
   <div className="print-measure" ref={measure} aria-hidden="true">{sorted.map((p,i)=><Card key={p.id} person={p} number={i+1}/>)}</div>
   <div className="pages">{pages.map((items,i)=><section className="paper" key={i} aria-label={'Página '+(i+1)}><div className="paper-stripe"/><header className="paper-header"><h1>Levantamento de títulos eleitorais</h1><p>Fichas individuais</p></header>{items.map(item=><div className="positioned-card" key={item.person.id} style={{top:item.top+'pt'}}><Card person={item.person} number={item.number}/></div>)}<div className="paper-footer"/></section>)}</div>
  </main>}
 </>;
}

