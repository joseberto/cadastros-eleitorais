import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Printer,
  ArrowDownAZ,
  ArrowUpAZ,
  UsersRound,
  Pencil,
  Trash2,
  Download,
  Upload,
  ArrowLeft,
  FileText,
  ShieldCheck,
  X,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Search,
  RotateCcw
} from 'lucide-react';
import { Card } from '@/app/report-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  blank,
  fields,
  mask,
  shown,
  states,
  validate,
  sortRecords,
  extractImportRecords,
  normalizeImportRecord,
  recordIdentity,
  type Field,
  type Person,
  type RecordData,
  type SortKey
} from '@/lib/records';
import initialCadastros from '../cadastros.json';

const STORAGE_KEY = 'cadastros_eleitorais_data_v1';

const labels: Record<Field, string> = {
  name: 'Nome completo',
  title: 'Título de eleitor',
  zone: 'Zona',
  section: 'Seção',
  birth: 'Nascimento',
  city: 'Município do título',
  uf: 'UF do título',
  address: 'Endereço',
  cpf: 'CPF',
  phone: 'Celular',
  place: 'Local de votação',
  indication: 'Indicação'
};

const orderLabels: Record<SortKey, string> = {
  name: 'Nome',
  title: 'Número do título',
  zone: 'Zona',
  section: 'Seção',
  indication: 'Indicação'
};

const slots = [93.63, 221.87, 351.54, 483.18, 619.50];
type PrintItem = { person: Person; number: number; top: number };
type ImportRow = { index: number; data?: RecordData; error?: string; duplicate?: boolean };

export default function App() {
  const [records, setRecords] = useState<Person[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [desc, setDesc] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RecordData>({ ...blank });
  const [editing, setEditing] = useState<Person | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [printMode, setPrintMode] = useState(false);
  const [pages, setPages] = useState<PrintItem[][]>([]);
  const [printReady, setPrintReady] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState('');

  const measure = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  // Carregar registros do LocalStorage ou do cadastros.json inicial
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecords(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Erro ao ler LocalStorage:', e);
    }
    // Caso não haja nada salvo, utiliza a lista inicial
    const baseList = (initialCadastros as Person[]) || [];
    setRecords(baseList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(baseList));
    } catch {}
  }, []);

  // Salvar no LocalStorage e atualizar estado
  const updateRecords = useCallback((updater: (prev: Person[]) => Person[], message?: string) => {
    setRecords(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Erro ao salvar no LocalStorage:', e);
      }
      return next;
    });
    if (message) setNotice(message);
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return records.filter(p => {
      const searchable = `${p.name} ${p.title} ${p.zone} ${p.section} ${p.phone} ${p.address} ${p.city} ${p.cpf} ${p.indication || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return searchable.includes(term);
    });
  }, [records, searchTerm]);

  const sorted = useMemo(() => sortRecords(filteredRecords, sort, desc), [filteredRecords, sort, desc]);

  const start = useCallback((person?: Person) => {
    setEditing(person || null);
    setDraft(person ? (Object.fromEntries(fields.map(k => [k, person[k] || ''])) as RecordData) : { ...blank });
    setFormError('');
    setOpen(true);
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    let validatedData: RecordData;
    try {
      validatedData = validate(draft);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }

    if (editing) {
      const updatedPerson: Person = {
        ...editing,
        ...validatedData,
        revision: (editing.revision || 1) + 1,
        updated: new Date().toISOString()
      };
      updateRecords(old => old.map(x => (x.id === editing.id ? updatedPerson : x)), 'Cadastro atualizado com sucesso.');
    } else {
      const newPerson: Person = {
        id: crypto.randomUUID(),
        ...validatedData,
        revision: 1,
        updated: new Date().toISOString()
      };
      updateRecords(old => [newPerson, ...old], 'Novo cadastro salvo com sucesso.');
    }
    setOpen(false);
  }

  function removePerson(id: string) {
    updateRecords(old => old.filter(x => x.id !== id), 'Cadastro removido.');
    setDeleteConfirmId(null);
  }

  function exportBackup() {
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cadastros-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Backup baixado com sucesso (${records.length} cadastros).`);
  }

  function resetToDefault() {
    if (window.confirm('Deseja restaurar a lista original de 18 cadastros? Alterações não exportadas serão sobrescritas.')) {
      const baseList = (initialCadastros as Person[]) || [];
      updateRecords(() => baseList, 'Lista restaurada para os dados padrão.');
    }
  }

  async function chooseImport(file?: File) {
    if (!file) return;
    setImportError('');
    setImportRows([]);
    setImportName(file.name);
    if (file.size > 3_000_000) {
      setImportError('O arquivo ultrapassa 3 MB.');
      setImportOpen(true);
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const list = extractImportRecords(payload);
      if (!list.length) throw new Error('O JSON não contém cadastros.');
      if (list.length > 5000) throw new Error('O limite é de 5.000 cadastros por arquivo.');

      const known = new Set(records.map(recordIdentity).filter(Boolean));
      const rows: ImportRow[] = [];
      list.forEach((raw, index) => {
        try {
          const data = validate(normalizeImportRecord(raw));
          const key = recordIdentity(data);
          const duplicate = !!key && known.has(key);
          if (key) known.add(key);
          rows.push({ index: index + 1, data, duplicate });
        } catch (err) {
          rows.push({ index: index + 1, error: (err as Error).message });
        }
      });
      setImportRows(rows);
      setImportOpen(true);
    } catch (err) {
      setImportError((err as Error).message || 'Não foi possível ler o arquivo JSON.');
      setImportOpen(true);
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  function runImport() {
    const ready = importRows.filter(r => r.data && !r.duplicate).map(r => r.data as RecordData);
    if (!ready.length) return;

    const newPersons: Person[] = ready.map(d => ({
      id: crypto.randomUUID(),
      ...d,
      revision: 1,
      updated: new Date().toISOString()
    }));

    updateRecords(
      old => [...old, ...newPersons],
      `${newPersons.length} cadastro(s) importado(s) com sucesso.`
    );
    setImportOpen(false);
    setImportRows([]);
  }

  useEffect(() => {
    if (!printMode) return;
    let active = true;
    setPrintReady(false);
    void document.fonts.ready.then(() => {
      if (!active || !measure.current) return;
      const elements = Array.from(measure.current.children) as HTMLElement[];
      const out: PrintItem[][] = [];
      let page: PrintItem[] = [];
      let next = slots[0];
      elements.forEach((el, i) => {
        const height = el.getBoundingClientRect().height * 0.75;
        let top = Math.max(slots[page.length] ?? next, next);
        if (page.length >= 5 || top + height > 800) {
          out.push(page);
          page = [];
          next = slots[0];
          top = next;
        }
        page.push({ person: sorted[i], number: i + 1, top });
        next = top + height + 20;
      });
      if (page.length) out.push(page);
      setPages(out);
      setPrintReady(true);
    });
    return () => {
      active = false;
    };
  }, [printMode, sorted]);

  const input = (k: Field, span = '') => (
    <div className={'field ' + span} key={k}>
      <Label htmlFor={k}>
        {labels[k]}
        {(k === 'zone' || k === 'section') && <span className="required"> *</span>}
      </Label>
      <Input
        id={k}
        value={draft[k]}
        onChange={e => setDraft({ ...draft, [k]: mask(k, e.target.value) })}
        required={k === 'zone' || k === 'section'}
        inputMode={['title', 'zone', 'section', 'birth', 'cpf', 'phone'].includes(k) ? 'numeric' : 'text'}
        maxLength={k === 'address' ? 400 : k === 'place' ? 300 : k === 'name' ? 160 : k === 'city' ? 120 : 100}
        placeholder={
          ({
            title: '0000 0000 0000',
            zone: '000',
            section: '0000',
            birth: 'DD/MM/AAAA',
            cpf: '000.000.000-00',
            phone: '(00) 00000-0000',
            indication: 'Nome de quem indicou / Liderança'
          } as Partial<Record<Field, string>>)[k] || 'Não informado'
        }
        autoComplete="off"
      />
    </div>
  );

  return (
    <>
      <div className={'app-shell ' + (printMode ? 'hide-on-print' : '')} hidden={printMode}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">
              <FileText size={23} />
            </span>
            <span>
              Fichas<span className="brand-light"> / Cadastros eleitorais</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="private-label">
              <ShieldCheck size={16} /> Armazenamento Seguro Local
            </span>
          </div>
        </header>

        <main className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CADASTROS</p>
              <h1>Seus cadastros, organizados.</h1>
              <p className="subheading">Consulte, atualize, importe e imprima suas fichas individuais.</p>
            </div>
            <div className="heading-actions">
              <input
                ref={importInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={e => void chooseImport(e.target.files?.[0])}
              />
              <Button size="lg" variant="outline" onClick={() => importInput.current?.click()}>
                <Upload size={17} /> Importar JSON
              </Button>
              <Button size="lg" variant="outline" onClick={exportBackup} title="Baixar arquivo JSON com todos os cadastros">
                <Download size={17} /> Exportar Backup
              </Button>
              <Button size="lg" onClick={() => start()}>
                <Plus size={18} /> Novo cadastro
              </Button>
            </div>
          </div>

          <section className="listing">
            <div className="list-toolbar">
              <div className="list-title">
                <UsersRound size={21} />
                <h2>Lista de cadastros</h2>
                <span className="counter">{records.length}</span>
              </div>
              <div className="tools" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Input
                    placeholder="Buscar pessoa, título, zona..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '32px', height: '36px', fontSize: '13px' }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#8898aa' }} />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '8px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#8898aa'
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={!records.length}
                  onClick={() => setPrintMode(true)}
                >
                  <Printer size={16} /> Imprimir fichas
                </Button>
              </div>
            </div>

            <div className="sortbar">
              <span>Ordenar por</span>
              <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                <SelectTrigger aria-label="Ordenar por" className="sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={desc ? 'Usar ordem crescente' : 'Usar ordem decrescente'}
                title={desc ? 'Ordem decrescente' : 'Ordem crescente'}
                onClick={() => setDesc(!desc)}
              >
                {desc ? <ArrowUpAZ /> : <ArrowDownAZ />}
              </Button>
              <span className="sort-summary">{desc ? 'Ordem decrescente' : 'Ordem crescente'}</span>
            </div>

            {notice && (
              <div role="status" className="notice">
                {notice}
                <button onClick={() => setNotice('')} aria-label="Fechar aviso">
                  <X size={16} />
                </button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="number-col">Nº</TableHead>
                  {(['name', 'title', 'zone', 'section'] as SortKey[]).map(k => (
                    <TableHead key={k} aria-sort={sort === k ? (desc ? 'descending' : 'ascending') : 'none'}>
                      <button
                        className="column-sort"
                        onClick={() => {
                          if (sort === k) setDesc(!desc);
                          else {
                            setSort(k);
                            setDesc(false);
                          }
                        }}
                      >
                        {k === 'name' ? 'Nome completo' : orderLabels[k]}
                        {sort === k && <span>{desc ? '↓' : '↑'}</span>}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>Celular</TableHead>
                  <TableHead aria-sort={sort === 'indication' ? (desc ? 'descending' : 'ascending') : 'none'}>
                    <button
                      className="column-sort"
                      onClick={() => {
                        if (sort === 'indication') setDesc(!desc);
                        else {
                          setSort('indication');
                          setDesc(false);
                        }
                      }}
                    >
                      Indicação
                      {sort === 'indication' && <span>{desc ? '↓' : '↑'}</span>}
                    </button>
                  </TableHead>
                  <TableHead className="action-col">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="row-number">{String(i + 1).padStart(2, '0')}</TableCell>
                    <TableCell className={'person-name ' + (!p.name ? 'missing' : '')}>{shown(p.name)}</TableCell>
                    <TableCell className={'mono ' + (!p.title ? 'missing' : '')}>{shown(p.title)}</TableCell>
                    <TableCell>
                      <span className="zone-badge">{p.zone}</span>
                    </TableCell>
                    <TableCell className="mono">{p.section}</TableCell>
                    <TableCell className={!p.phone ? 'missing' : 'mono'}>{shown(p.phone)}</TableCell>
                    <TableCell className={!p.indication ? 'missing' : ''}>{shown(p.indication)}</TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button variant="ghost" size="icon" aria-label={'Editar ' + shown(p.name)} onClick={() => start(p)}>
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={'Excluir ' + shown(p.name)}
                          style={{ color: '#c53030' }}
                          onClick={() => setDeleteConfirmId(p.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!sorted.length && (
              <div className="empty">
                <span className="empty-icon">
                  <UsersRound size={30} />
                </span>
                <h3>{searchTerm ? 'Nenhum resultado encontrado' : 'Sua lista está vazia'}</h3>
                <p>
                  {searchTerm
                    ? `Não encontramos registros para "${searchTerm}".`
                    : 'Adicione o primeiro cadastro ou importe um arquivo JSON.'}
                </p>
                {!records.length && (
                  <Button onClick={() => start()}>
                    <Plus /> Cadastrar pessoa
                  </Button>
                )}
              </div>
            )}

            <footer className="table-footer">
              <span>
                {records.length} {records.length === 1 ? 'cadastro' : 'cadastros'}
                {searchTerm && ` (${sorted.length} exibidos na busca)`}
              </span>
              <button
                onClick={resetToDefault}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667c8a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <RotateCcw size={13} /> Restaurar dados iniciais
              </button>
            </footer>
          </section>
        </main>

        <footer className="app-footer">
          <span>Fichas individuais · GitHub Pages</span>
          <span>Dados salvos de forma privada no seu dispositivo.</span>
        </footer>
      </div>

      {/* Modal de Criação / Edição */}
      <Dialog
        open={open}
        onOpenChange={v => {
          setOpen(v);
        }}
      >
        <DialogContent className="registration-modal" showCloseButton={false}>
          <DialogHeader>
            <div className="modal-heading">
              <div>
                <DialogTitle>{editing ? 'Editar cadastro' : 'Novo cadastro'}</DialogTitle>
                <DialogDescription>
                  Preencha os dados disponíveis. <strong>Zona e seção são obrigatórias.</strong>
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fechar cadastro" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={save}>
            <fieldset>
              <div className="form-grid">
                {input('name', 'full')}
                {input('title', 'half')}
                {input('zone')}
                {input('section')}
                {input('birth', 'half')}
                {input('city')}
                <div className="field">
                  <Label htmlFor="uf">UF do título</Label>
                  <Select value={draft.uf || 'empty'} onValueChange={v => setDraft({ ...draft, uf: v === 'empty' ? '' : v })}>
                    <SelectTrigger id="uf">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empty">Não informado</SelectItem>
                      {states.map(s => (
                        <SelectItem value={s} key={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {input('address', 'full')}
                {input('cpf', 'half')}
                {input('phone', 'half')}
                {input('place', 'full')}
                {input('indication', 'full')}
              </div>
            </fieldset>
            {formError && (
              <p className="error-box" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-footer">
              <span>* Campos obrigatórios</span>
              <div>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar cadastro</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={v => !v && setDeleteConfirmId(null)}>
        <DialogContent style={{ maxWidth: '420px', padding: '24px' }}>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir este cadastro? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && removePerson(deleteConfirmId)}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação JSON */}
      <Dialog open={importOpen} onOpenChange={v => setImportOpen(v)}>
        <DialogContent className="import-modal" showCloseButton={false}>
          <DialogHeader>
            <div className="modal-heading">
              <div>
                <DialogTitle>Importar cadastros por JSON</DialogTitle>
                <DialogDescription>
                  {importName ? (
                    <>
                      Arquivo: <strong>{importName}</strong>
                    </>
                  ) : (
                    <>Selecione um arquivo JSON com os cadastros.</>
                  )}
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fechar importação" onClick={() => setImportOpen(false)}>
                <X />
              </Button>
            </div>
          </DialogHeader>
          {importError && (
            <p className="error-box" role="alert">
              {importError}
            </p>
          )}
          {!!importRows.length && (
            <>
              <div className="import-summary">
                <span>
                  <FileJson size={18} />
                  <strong>{importRows.length}</strong> no arquivo
                </span>
                <span className="ok">
                  <CheckCircle2 size={18} />
                  <strong>{importRows.filter(r => r.data && !r.duplicate).length}</strong> prontos
                </span>
                <span>
                  <strong>{importRows.filter(r => r.duplicate).length}</strong> repetidos
                </span>
                <span className={importRows.some(r => r.error) ? 'warn' : ''}>
                  <AlertTriangle size={18} />
                  <strong>{importRows.filter(r => r.error).length}</strong> inválidos
                </span>
              </div>
              <p className="import-help">
                Registros repetidos são ignorados automaticamente para evitar duplicações.
              </p>
              <div className="import-preview">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Seção</TableHead>
                      <TableHead>Indicação</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.slice(0, 100).map(row => (
                      <TableRow key={row.index}>
                        <TableCell>{row.index}</TableCell>
                        <TableCell>{row.data ? shown(row.data.name) : '—'}</TableCell>
                        <TableCell className="mono">{row.data ? shown(row.data.title) : '—'}</TableCell>
                        <TableCell>{row.data?.zone || '—'}</TableCell>
                        <TableCell>{row.data?.section || '—'}</TableCell>
                        <TableCell>{row.data?.indication || '—'}</TableCell>
                        <TableCell>
                          {row.error ? (
                            <span className="status-error">{row.error}</span>
                          ) : row.duplicate ? (
                            <span className="status-dup">Repetido</span>
                          ) : (
                            <span className="status-ok">Pronto</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importRows.length > 100 && (
                  <p className="preview-more">Prévia dos 100 primeiros de {importRows.length}.</p>
                )}
              </div>
            </>
          )}
          <div className="modal-footer import-footer">
            <span>
              Campos aceitos: nome, título, zona, seção, nascimento, município, UF, endereço, CPF, celular, local de votação e indicação.
            </span>
            <div>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!importRows.some(r => r.data && !r.duplicate)}
                onClick={runImport}
              >
                {`Importar ${importRows.filter(r => r.data && !r.duplicate).length}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualização de Impressão A4 */}
      {printMode && (
        <main className="print-view">
          <div className="print-toolbar">
            <Button variant="ghost" onClick={() => setPrintMode(false)}>
              <ArrowLeft /> Voltar à lista
            </Button>
            <div>
              <strong>Prévia de impressão</strong>
              <span>
                {sorted.length} fichas · {pages.length} páginas · {orderLabels[sort]}
              </span>
            </div>
            <Button disabled={!printReady} onClick={() => window.print()}>
              <Printer /> Imprimir / Salvar PDF
            </Button>
          </div>
          <p className="print-help">
            Papel A4 · Escala 100% · Margens: nenhuma · Desative os cabeçalhos e rodapés do navegador e ative os gráficos de fundo.
          </p>
          <div className="print-measure" ref={measure} aria-hidden="true">
            {sorted.map((p, i) => (
              <Card key={p.id} person={p} number={i + 1} />
            ))}
          </div>
          <div className="pages">
            {pages.map((items, i) => (
              <section className="paper" key={i} aria-label={'Página ' + (i + 1)}>
                <div className="paper-stripe" />
                <header className="paper-header">
                  <h1>Levantamento de títulos eleitorais</h1>
                  <p>Fichas individuais</p>
                </header>
                {items.map(item => (
                  <div className="positioned-card" key={item.person.id} style={{ top: item.top + 'pt' }}>
                    <Card person={item.person} number={item.number} />
                  </div>
                ))}
                <div className="paper-footer" />
              </section>
            ))}
          </div>
        </main>
      )}
    </>
  );
}
