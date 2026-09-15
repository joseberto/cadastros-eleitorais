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
    Check,
    CheckCheck,
    Circle,
    Search,
    RotateCcw,
    ChevronDown,
    Filter,
    Database,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    SlidersHorizontal
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
    indication: 'Indicação',
    marked: 'Marcados'
};

const slots = [93.63, 221.87, 351.54, 483.18, 619.50];
type PrintItem = { person: Person; number: number; top: number };
type ImportRow = { index: number; data?: RecordData & { marked?: boolean }; error?: string; duplicate?: boolean; alreadyMarked?: boolean };

export default function App() {
    const [records, setRecords] = useState<Person[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [notice, setNotice] = useState('');
    const [sort, setSort] = useState<SortKey>('name');
    const [desc, setDesc] = useState(false);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<RecordData>({ ...blank });
    const [draftMarked, setDraftMarked] = useState(false);
    const [editing, setEditing] = useState<Person | null>(null);
    const [formError, setFormError] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [unmarkTarget, setUnmarkTarget] = useState<{ id?: string; name?: string; count?: number } | null>(null);

    const [printMode, setPrintMode] = useState(false);
    const [pages, setPages] = useState<PrintItem[][]>([]);
    const [printReady, setPrintReady] = useState(false);

    const [importOpen, setImportOpen] = useState(false);
    const [importRows, setImportRows] = useState<ImportRow[]>([]);
    const [importName, setImportName] = useState('');
    const [importError, setImportError] = useState('');

    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);

    const measure = useRef<HTMLDivElement>(null);
    const importInput = useRef<HTMLInputElement>(null);

    // Fechar menu de opções ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
                setOptionsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Carregar registros do LocalStorage ou do cadastros.json inicial
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const sanitized = parsed.map(item => ({ ...blank, marked: false, ...item }));
                    setRecords(sanitized);
                    return;
                }
            }
        } catch (e) {
            console.error('Erro ao ler LocalStorage:', e);
        }
        // Caso não haja nada salvo, utiliza a lista inicial
        const baseList = ((initialCadastros as Person[]) || []).map(item => ({ ...blank, marked: false, ...item }));
        setRecords(baseList);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(baseList));
        } catch { }
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

    // Alternar status marcado de um registro individual
    const toggleMarkPerson = useCallback((id: string) => {
        updateRecords(old =>
            old.map(x => (x.id === id ? { ...x, marked: !x.marked, updated: new Date().toISOString() } : x))
        );
    }, [updateRecords]);

    // Manipular clique de marcar/desmarcar individual com confirmação para desmarcar
    const handleToggleMark = useCallback((p: Person) => {
        if (p.marked) {
            setUnmarkTarget({ id: p.id, name: p.name });
        } else {
            toggleMarkPerson(p.id);
        }
    }, [toggleMarkPerson]);

    const [selectedIndication, setSelectedIndication] = useState<string>('all');
    const [selectedMarkedFilter, setSelectedMarkedFilter] = useState<'all' | 'marked' | 'unmarked'>('all');
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [hoveredIndication, setHoveredIndication] = useState<string | null>(null);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    // Fechar menu de filtro ao clicar fora
    useEffect(() => {
        function handleClickOutsideFilter(event: MouseEvent) {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setFilterMenuOpen(false);
                setHoveredIndication(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutsideFilter);
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideFilter);
        };
    }, []);

    const uniqueIndications = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => {
            const ind = (r.indication || '').trim();
            if (ind) set.add(ind);
        });
        const c = new Intl.Collator('pt-BR', { sensitivity: 'base' });
        return Array.from(set).sort((a, b) => c.compare(a, b));
    }, [records]);

    const hasUnassigned = useMemo(() => records.some(r => !(r.indication || '').trim()), [records]);

    const indicationFilterItems = useMemo(() => {
        const totalRecords = records.length;
        const markedTotal = records.filter(r => r.marked).length;
        const unmarkedTotal = totalRecords - markedTotal;

        const items: Array<{
            key: string;
            label: string;
            total: number;
            marked: number;
            unmarked: number;
        }> = [
                {
                    key: 'all',
                    label: 'Todas as indicações',
                    total: totalRecords,
                    marked: markedTotal,
                    unmarked: unmarkedTotal
                }
            ];

        uniqueIndications.forEach(ind => {
            const matching = records.filter(r => (r.indication || '').trim().toLowerCase() === ind.toLowerCase());
            const total = matching.length;
            const marked = matching.filter(r => r.marked).length;
            items.push({
                key: ind,
                label: ind,
                total,
                marked,
                unmarked: total - marked
            });
        });

        if (hasUnassigned) {
            const matching = records.filter(r => !(r.indication || '').trim());
            const total = matching.length;
            const marked = matching.filter(r => r.marked).length;
            items.push({
                key: 'none',
                label: 'Sem indicação',
                total,
                marked,
                unmarked: total - marked
            });
        }

        return items;
    }, [records, uniqueIndications, hasUnassigned]);

    const filteredRecords = useMemo(() => {
        let list = records;
        if (selectedIndication === 'none') {
            list = list.filter(p => !(p.indication || '').trim());
        } else if (selectedIndication !== 'all') {
            list = list.filter(p => (p.indication || '').trim().toLowerCase() === selectedIndication.toLowerCase());
        }

        if (selectedMarkedFilter === 'marked') {
            list = list.filter(p => !!p.marked);
        } else if (selectedMarkedFilter === 'unmarked') {
            list = list.filter(p => !p.marked);
        }

        if (!searchTerm.trim()) return list;
        const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return list.filter(p => {
            const searchable = `${p.name} ${p.title} ${p.zone} ${p.section} ${p.phone} ${p.address} ${p.city} ${p.cpf} ${p.indication || ''}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return searchable.includes(term);
        });
    }, [records, selectedIndication, selectedMarkedFilter, searchTerm]);

    const activeFilterLabel = useMemo(() => {
        let name = 'Todas as indicações';
        if (selectedIndication === 'none') {
            name = 'Sem indicação';
        } else if (selectedIndication !== 'all') {
            name = selectedIndication;
        }

        if (selectedMarkedFilter === 'marked') {
            return `${name} · Marcados (${filteredRecords.length})`;
        }
        if (selectedMarkedFilter === 'unmarked') {
            return `${name} · Não marcados (${filteredRecords.length})`;
        }
        return `${name} (${filteredRecords.length})`;
    }, [selectedIndication, selectedMarkedFilter, filteredRecords.length]);

    // Marcar ou desmarcar todos os registros filtrados
    const markFilteredRecords = useCallback((mark: boolean) => {
        const targetIds = new Set(filteredRecords.map(r => r.id));
        if (!targetIds.size) return;
        updateRecords(
            old =>
                old.map(x => (targetIds.has(x.id) ? { ...x, marked: mark, updated: new Date().toISOString() } : x)),
            `${targetIds.size} cadastro(s) ${mark ? 'marcado(s)' : 'desmarcado(s)'} com sucesso.`
        );
    }, [filteredRecords, updateRecords]);

    const sorted = useMemo(() => sortRecords(filteredRecords, sort, desc), [filteredRecords, sort, desc]);

    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const totalPages = useMemo(() => Math.ceil(sorted.length / pageSize) || 1, [sorted.length, pageSize]);

    // Retorna à página 1 caso os filtros, ordenação ou tamanho de página mudem
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedIndication, selectedMarkedFilter, sort, desc, pageSize]);

    // Garante que a página atual seja válida caso o número total de páginas diminua
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const paginatedRecords = useMemo(() => {
        const startIdx = (currentPage - 1) * pageSize;
        return sorted.slice(startIdx, startIdx + pageSize);
    }, [sorted, currentPage, pageSize]);

    const start = useCallback((person?: Person) => {
        setEditing(person || null);
        setDraft(person ? (Object.fromEntries(fields.map(k => [k, person[k] || ''])) as RecordData) : { ...blank });
        setDraftMarked(person ? !!person.marked : false);
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
                marked: draftMarked,
                revision: (editing.revision || 1) + 1,
                updated: new Date().toISOString()
            };
            updateRecords(old => old.map(x => (x.id === editing.id ? updatedPerson : x)), 'Cadastro atualizado com sucesso.');
        } else {
            const newPerson: Person = {
                id: crypto.randomUUID(),
                ...validatedData,
                marked: draftMarked,
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

    const exportData = useCallback((dataToExport: Person[], filenameSuffix: string, label: string) => {
        if (!dataToExport.length) {
            setNotice(`Nenhum cadastro para exportar (${label}).`);
            return;
        }
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `cadastros-${filenameSuffix}-${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setNotice(`${dataToExport.length} cadastro(s) exportado(s) com sucesso (${label}).`);
    }, []);

    const exportAll = useCallback(() => {
        exportData(records, 'todos', 'Todos os cadastros');
    }, [exportData, records]);

    const exportMarked = useCallback(() => {
        const markedRecords = records.filter(r => r.marked);
        if (!markedRecords.length) {
            setNotice('Nenhum cadastro marcado para exportar.');
            return;
        }
        exportData(markedRecords, 'marcados', 'Cadastros marcados');
    }, [exportData, records]);

    const exportFiltered = useCallback(() => {
        if (!filteredRecords.length) {
            setNotice('Nenhum cadastro no filtro atual para exportar.');
            return;
        }
        let suffix = selectedIndication !== 'all' && selectedIndication !== 'none'
            ? `filtro-${selectedIndication.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
            : selectedIndication === 'none'
                ? 'filtro-sem_indicacao'
                : 'filtrados';
        if (selectedMarkedFilter === 'marked') suffix += '-marcados';
        else if (selectedMarkedFilter === 'unmarked') suffix += '-nao_marcados';
        exportData(filteredRecords, suffix, 'Filtro atual');
    }, [exportData, filteredRecords, selectedIndication, selectedMarkedFilter]);

    function resetToDefault() {
        if (window.confirm('Deseja restaurar a lista original de cadastros? Alterações não exportadas serão sobrescritas.')) {
            const baseList = ((initialCadastros as Person[]) || []).map(item => ({ ...blank, marked: false, ...item }));
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
            const markedIdentities = new Set(
                records.filter(r => r.marked).map(recordIdentity).filter(Boolean)
            );

            const rows: ImportRow[] = [];
            list.forEach((raw, index) => {
                try {
                    const norm = normalizeImportRecord(raw);
                    const validated = validate(norm) as RecordData & { marked?: boolean };
                    validated.marked = norm.marked;

                    const key = recordIdentity(validated);
                    const duplicate = !!key && known.has(key);
                    const alreadyMarked = !!norm.marked || (!!key && markedIdentities.has(key));

                    if (key && !duplicate) known.add(key);
                    rows.push({ index: index + 1, data: validated, duplicate, alreadyMarked });
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
        const ready = importRows
            .filter(r => r.data && !r.duplicate && !r.alreadyMarked)
            .map(r => r.data as RecordData & { marked?: boolean });
        if (!ready.length) return;

        const newPersons: Person[] = ready.map(d => ({
            id: crypto.randomUUID(),
            ...d,
            marked: false,
            revision: 1,
            updated: new Date().toISOString()
        }));

        updateRecords(
            old => [...old, ...newPersons],
            `${newPersons.length} cadastro(s) importado(s) com sucesso. Cadastros marcados foram ignorados.`
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
                            <div
                                ref={optionsMenuRef}
                                className="options-dropdown-container"
                                onMouseEnter={() => setOptionsMenuOpen(true)}
                                onMouseLeave={() => setOptionsMenuOpen(false)}
                            >
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => setOptionsMenuOpen(prev => !prev)}
                                    aria-expanded={optionsMenuOpen}
                                    aria-haspopup="true"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <SlidersHorizontal size={17} />
                                    <span>Opções</span>
                                    <ChevronDown
                                        size={15}
                                        style={{
                                            transform: optionsMenuOpen ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.2s ease'
                                        }}
                                    />
                                </Button>

                                {optionsMenuOpen && (
                                    <div className="options-dropdown-menu" role="menu">
                                        <button
                                            type="button"
                                            className="options-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                setOptionsMenuOpen(false);
                                                importInput.current?.click();
                                            }}
                                        >
                                            <Upload size={16} color="#127c80" />
                                            <span>Importar JSON</span>
                                        </button>

                                        <div className="options-dropdown-divider" />

                                        <button
                                            type="button"
                                            className="options-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                setOptionsMenuOpen(false);
                                                exportAll();
                                            }}
                                        >
                                            <Download size={16} color="#127c80" />
                                            <span>Exportar todos ({records.length})</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="options-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                setOptionsMenuOpen(false);
                                                exportMarked();
                                            }}
                                        >
                                            <CheckCircle2 size={16} color="#059669" />
                                            <span>Exportar somente os marcados ({records.filter(r => r.marked).length})</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="options-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                setOptionsMenuOpen(false);
                                                exportFiltered();
                                            }}
                                        >
                                            <Filter size={16} color="#0284c7" />
                                            <span>Exportar somente o filtro ({filteredRecords.length})</span>
                                        </button>
                                    </div>
                                )}
                            </div>
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

                        <div className="sortbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span>Filtrar por indicação</span>

                                <div
                                    ref={filterDropdownRef}
                                    className="filter-dropdown-container"
                                >
                                    <button
                                        type="button"
                                        className="filter-trigger-btn"
                                        onClick={() => {
                                            setFilterMenuOpen(p => !p);
                                            setHoveredIndication(null);
                                        }}
                                        aria-expanded={filterMenuOpen}
                                    >
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                            <Filter size={14} color="#127c80" />
                                            <span style={{ fontWeight: 600 }}>{activeFilterLabel}</span>
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            style={{
                                                color: '#64748b',
                                                transform: filterMenuOpen ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.2s ease',
                                                flexShrink: 0
                                            }}
                                        />
                                    </button>

                                    {filterMenuOpen && (
                                        <div
                                            className="filter-dropdown-menu"
                                            role="menu"
                                            onMouseLeave={() => setHoveredIndication(null)}
                                        >
                                            {indicationFilterItems.map(item => {
                                                const isIndicationSelected = selectedIndication.toLowerCase() === item.key.toLowerCase();
                                                const hasSubmenu = item.marked > 0;

                                                if (!hasSubmenu) {
                                                    // Se não houver nenhum cadastro marcado nesta indicação, exibe opção direta
                                                    return (
                                                        <button
                                                            key={item.key}
                                                            type="button"
                                                            className={`filter-item ${isIndicationSelected ? 'active' : ''}`}
                                                            role="menuitem"
                                                            onClick={() => {
                                                                setSelectedIndication(item.key);
                                                                setSelectedMarkedFilter('all');
                                                                setFilterMenuOpen(false);
                                                                setHoveredIndication(null);
                                                            }}
                                                            onMouseEnter={() => setHoveredIndication(null)}
                                                        >
                                                            <div className="filter-item-content">
                                                                <span>{item.label}</span>
                                                                <span className="filter-item-badge">({item.total})</span>
                                                            </div>
                                                            {isIndicationSelected && <Check size={14} className="filter-item-check" />}
                                                        </button>
                                                    );
                                                }

                                                // Se houver cadastros marcados, exibe com submenu ao passar o mouse
                                                const isHovered = hoveredIndication === item.key;
                                                return (
                                                    <div
                                                        key={item.key}
                                                        className="filter-parent-item-container"
                                                        onMouseEnter={() => setHoveredIndication(item.key)}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={`filter-item ${isIndicationSelected ? 'active' : ''}`}
                                                            role="menuitem"
                                                            onClick={() => {
                                                                setSelectedIndication(item.key);
                                                                setSelectedMarkedFilter('all');
                                                                setFilterMenuOpen(false);
                                                                setHoveredIndication(null);
                                                            }}
                                                        >
                                                            <div className="filter-item-content">
                                                                <span>{item.label}</span>
                                                                <span className="filter-item-badge">({item.total})</span>
                                                            </div>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {isIndicationSelected && <Check size={14} className="filter-item-check" />}
                                                                <ChevronRight size={14} className="filter-item-arrow" />
                                                            </div>
                                                        </button>

                                                        {/* Submenu com Todos, Marcados e Não Marcados */}
                                                        {isHovered && (
                                                            <div
                                                                className="filter-submenu"
                                                                role="menu"
                                                                onMouseEnter={() => setHoveredIndication(item.key)}
                                                            >
                                                                <div style={{ padding: '4px 10px 6px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f1f5f9' }}>
                                                                    {item.label}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className={`filter-subitem ${isIndicationSelected && selectedMarkedFilter === 'all' ? 'active' : ''}`}
                                                                    role="menuitem"
                                                                    onClick={() => {
                                                                        setSelectedIndication(item.key);
                                                                        setSelectedMarkedFilter('all');
                                                                        setFilterMenuOpen(false);
                                                                        setHoveredIndication(null);
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                                                                        <UsersRound size={14} color="#127c80" />
                                                                        <span>Todos ({item.total})</span>
                                                                    </div>
                                                                    {isIndicationSelected && selectedMarkedFilter === 'all' && <Check size={14} />}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className={`filter-subitem ${isIndicationSelected && selectedMarkedFilter === 'marked' ? 'active' : ''}`}
                                                                    role="menuitem"
                                                                    onClick={() => {
                                                                        setSelectedIndication(item.key);
                                                                        setSelectedMarkedFilter('marked');
                                                                        setFilterMenuOpen(false);
                                                                        setHoveredIndication(null);
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                                                                        <CheckCircle2 size={14} color="#059669" />
                                                                        <span style={{ color: '#047857' }}>Marcados ({item.marked})</span>
                                                                    </div>
                                                                    {isIndicationSelected && selectedMarkedFilter === 'marked' && <Check size={14} color="#059669" />}
                                                                </button>

                                                                {item.unmarked > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className={`filter-subitem ${isIndicationSelected && selectedMarkedFilter === 'unmarked' ? 'active' : ''}`}
                                                                        role="menuitem"
                                                                        onClick={() => {
                                                                            setSelectedIndication(item.key);
                                                                            setSelectedMarkedFilter('unmarked');
                                                                            setFilterMenuOpen(false);
                                                                            setHoveredIndication(null);
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                                                                            <Circle size={14} color="#94a3b8" />
                                                                            <span>Não marcados ({item.unmarked})</span>
                                                                        </div>
                                                                        {isIndicationSelected && selectedMarkedFilter === 'unmarked' && <Check size={14} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Botões para Marcar e Desmarcar registros filtrados */}
                                {filteredRecords.length > 0 && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        {/* Botão Marcar: só aparece se houver pelo menos um registro NÃO marcado */}
                                        {filteredRecords.some(r => !r.marked) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => markFilteredRecords(true)}
                                                style={{
                                                    height: '32px',
                                                    fontSize: '12px',
                                                    padding: '0 10px',
                                                    color: '#0f766e',
                                                    borderColor: '#99f6e4',
                                                    backgroundColor: '#f0fdfa',
                                                    fontWeight: 600
                                                }}
                                                title={`Marcar cadastros filtrados`}
                                            >
                                                <CheckCheck size={15} style={{ marginRight: '4px' }} /> Marcar
                                            </Button>
                                        )}
                                        {/* Botão Desmarcar: só aparece se houver registros marcados */}
                                        {filteredRecords.some(r => r.marked) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setUnmarkTarget({ count: filteredRecords.filter(r => r.marked).length })}
                                                style={{
                                                    height: '32px',
                                                    fontSize: '12px',
                                                    padding: '0 8px',
                                                    color: '#64748b'
                                                }}
                                                title={`Desmarcar cadastros filtrados`}
                                            >
                                                Desmarcar
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {(selectedIndication !== 'all' || selectedMarkedFilter !== 'all') && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedIndication('all');
                                            setSelectedMarkedFilter('all');
                                        }}
                                        style={{ fontSize: '12px', color: '#667c8a', padding: '0 8px', height: '32px' }}
                                        title="Limpar filtro"
                                    >
                                        <X size={14} style={{ marginRight: '4px' }} /> Limpar
                                    </Button>
                                )}
                            </div>
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
                                    <TableHead className="action-col" style={{ width: '130px', textAlign: 'center' }}>
                                        Ações
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedRecords.map((p, i) => {
                                    const rowNumber = (currentPage - 1) * pageSize + i + 1;
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell className="row-number">{String(rowNumber).padStart(2, '0')}</TableCell>
                                            <TableCell className={'person-name ' + (!p.name ? 'missing' : '')}>{shown(p.name)}</TableCell>
                                            <TableCell className={'mono ' + (!p.title ? 'missing' : '')}>{shown(p.title)}</TableCell>
                                            <TableCell>
                                                <span className="zone-badge">{p.zone}</span>
                                            </TableCell>
                                            <TableCell className="mono">{p.section}</TableCell>
                                            <TableCell className={!p.phone ? 'missing' : 'mono'}>{shown(p.phone)}</TableCell>
                                            <TableCell className={!p.indication ? 'missing' : ''}>{shown(p.indication)}</TableCell>
                                            <TableCell style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={(p.marked ? 'Desmarcar ' : 'Marcar ') + shown(p.name)}
                                                        title={p.marked ? 'Marcado (clique para desmarcar)' : 'Não marcado (clique para marcar)'}
                                                        onClick={() => handleToggleMark(p)}
                                                        style={{ color: p.marked ? '#059669' : '#94a3b8' }}
                                                    >
                                                        {p.marked ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" aria-label={'Editar ' + shown(p.name)} title="Editar cadastro" onClick={() => start(p)}>
                                                        <Pencil size={15} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={'Excluir ' + shown(p.name)}
                                                        title="Excluir cadastro"
                                                        style={{ color: '#c53030' }}
                                                        onClick={() => setDeleteConfirmId(p.id)}
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>

                        {/* Controles de Paginação */}
                        {sorted.length > 0 && (
                            <div
                                className="pagination-bar"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    padding: '14px 20px',
                                    background: '#f8fafc',
                                    borderTop: '1px solid #e2e8f0'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#475569', flexWrap: 'wrap' }}>
                                    <span>Itens por página:</span>
                                    <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                                        <SelectTrigger className="sort-select" style={{ width: '85px', height: '32px' }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 20, 50, 100, 200].map(size => (
                                                <SelectItem key={size} value={String(size)}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <span style={{ color: '#64748b' }}>
                                        Exibindo <strong>{(currentPage - 1) * pageSize + 1}</strong>–
                                        <strong>{Math.min(currentPage * pageSize, sorted.length)}</strong> de <strong>{sorted.length}</strong>
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(1)}
                                        title="Primeira página"
                                        style={{ height: '32px', width: '32px', padding: 0 }}
                                    >
                                        <ChevronsLeft size={16} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        title="Página anterior"
                                        style={{ height: '32px', width: '32px', padding: 0 }}
                                    >
                                        <ChevronLeft size={16} />
                                    </Button>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', padding: '0 8px' }}>
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        title="Próxima página"
                                        style={{ height: '32px', width: '32px', padding: 0 }}
                                    >
                                        <ChevronRight size={16} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(totalPages)}
                                        title="Última página"
                                        style={{ height: '32px', width: '32px', padding: 0 }}
                                    >
                                        <ChevronsRight size={16} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!sorted.length && (
                            <div className="empty">
                                <span className="empty-icon">
                                    <UsersRound size={30} />
                                </span>
                                <h3>
                                    {selectedIndication !== 'all'
                                        ? `Nenhum cadastro encontrado para "${selectedIndication === 'none' ? 'Sem indicação' : selectedIndication}"`
                                        : searchTerm
                                            ? 'Nenhum resultado encontrado'
                                            : 'Sua lista está vazia'}
                                </h3>
                                <p>
                                    {selectedIndication !== 'all' || searchTerm
                                        ? 'Tente alterar os filtros ou limpar a pesquisa.'
                                        : 'Adicione o primeiro cadastro ou importe um arquivo JSON.'}
                                </p>
                                {selectedIndication !== 'all' && (
                                    <Button variant="outline" onClick={() => { setSelectedIndication('all'); setSearchTerm(''); }}>
                                        Limpar filtros
                                    </Button>
                                )}
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
                                {selectedIndication !== 'all' && ` · Filtrado por: "${selectedIndication === 'none' ? 'Sem indicação' : selectedIndication}" (${sorted.length})`}
                                {searchTerm && ` (${sorted.length} na busca)`}
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
                                <div className="field full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '6px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        id="draftMarked"
                                        checked={draftMarked}
                                        onChange={e => setDraftMarked(e.target.checked)}
                                        style={{ width: '18px', height: '18px', accentColor: '#127c80', cursor: 'pointer' }}
                                    />
                                    <Label htmlFor="draftMarked" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                                        Marcar este cadastro (marcado com "V" na lista)
                                    </Label>
                                </div>
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

            {/* Modal de Confirmação de Desmarcação */}
            <Dialog open={!!unmarkTarget} onOpenChange={v => !v && setUnmarkTarget(null)}>
                <DialogContent style={{ maxWidth: '420px', padding: '24px' }}>
                    <DialogHeader>
                        <DialogTitle>Confirmar Desmarcação</DialogTitle>
                        <DialogDescription>
                            {unmarkTarget?.name ? (
                                <>
                                    Deseja realmente desmarcar o cadastro de <strong>{unmarkTarget.name}</strong>?
                                </>
                            ) : (
                                <>
                                    Deseja realmente desmarcar <strong>{unmarkTarget?.count}</strong> cadastro(s) filtrado(s)?
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                        <Button variant="outline" onClick={() => setUnmarkTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="default"
                            style={{ backgroundColor: '#0f766e', color: '#fff' }}
                            onClick={() => {
                                if (unmarkTarget?.id) {
                                    toggleMarkPerson(unmarkTarget.id);
                                } else if (unmarkTarget?.count) {
                                    markFilteredRecords(false);
                                }
                                setUnmarkTarget(null);
                            }}
                        >
                            Confirmar e Desmarcar
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
                                    <strong>{importRows.filter(r => r.data && !r.duplicate && !r.alreadyMarked).length}</strong> prontos (não marcados)
                                </span>
                                {importRows.some(r => r.alreadyMarked) && (
                                    <span style={{ color: '#b45309', background: '#fef3c7', borderColor: '#fde68a' }}>
                                        <AlertTriangle size={18} />
                                        <strong>{importRows.filter(r => r.alreadyMarked).length}</strong> já marcados (ignorados)
                                    </span>
                                )}
                                <span>
                                    <strong>{importRows.filter(r => r.duplicate && !r.alreadyMarked).length}</strong> repetidos
                                </span>
                                <span className={importRows.some(r => r.error) ? 'warn' : ''}>
                                    <AlertTriangle size={18} />
                                    <strong>{importRows.filter(r => r.error).length}</strong> inválidos
                                </span>
                            </div>
                            <p className="import-help">
                                Apenas cadastros <strong>não marcados</strong> são importados. Registros repetidos ou já marcados são ignorados automaticamente.
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
                                                    ) : row.alreadyMarked ? (
                                                        <span style={{ color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-block' }}>
                                                            Ignorado (Marcado)
                                                        </span>
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
                                disabled={!importRows.some(r => r.data && !r.duplicate && !r.alreadyMarked)}
                                onClick={runImport}
                            >
                                {`Importar ${importRows.filter(r => r.data && !r.duplicate && !r.alreadyMarked).length}`}
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
                                {selectedIndication !== 'all' ? ` · Indicação: ${selectedIndication === 'none' ? 'Sem indicação' : selectedIndication}` : ''}
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
