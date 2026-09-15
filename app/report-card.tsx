import { shown, shownClean, parseAddress, type Person } from '@/lib/records';

export function Card({ person: p, number }: { person: Person; number: number }) {
    return (
        <article className="record-card">
            <h2>{String(number).padStart(2, '0')} {shown(p.name)}</h2>
            <div className="record-lines">
                <p><b>Título:</b> {shown(p.title)}<span className="divider">|</span><b>Zona:</b> {p.zone}<span className="divider">|</span><b>Seção:</b> {p.section}</p>
                <p><b>Nascimento:</b> {shown(p.birth)}<span className="divider">|</span><b>Município/UF do título:</b> {p.city || p.uf ? `${shown(p.city)}/${shown(p.uf)}` : 'Não informado'}</p>
                <p><b>Endereço:</b> {shown(p.address)}</p>
                <p><b>CPF:</b> {shown(p.cpf)}<span className="divider">|</span><b>Celular:</b> {shown(p.phone)}</p>
                <p><b>Local de votação:</b> {shown(p.place)}</p>
                {p.indication && <p><b>Indicação:</b> {shown(p.indication)}</p>}
            </div>
        </article>
    );
}

export function DeiaCard({ person: p }: { person: Person; number?: number }) {
    const { street, neighborhood } = parseAddress(p.address);
    const phone = shownClean(p.phone);
    const title = shownClean(p.title);
    const zone = shownClean(p.zone);
    const section = shownClean(p.section);
    const name = shownClean(p.name);

    return (
        <article className="deia-record-card">
            <div className="deia-row">
                <div className="deia-col-full">
                    <span className="deia-label">NOME:</span>
                    <span className="deia-line-value">{name}</span>
                </div>
            </div>
            <div className="deia-row">
                <div className="deia-col-address">
                    <span className="deia-label">ENDEREÇO:</span>
                    <span className="deia-line-value">{street}</span>
                </div>
                <div className="deia-col-bairro">
                    <span className="deia-label">BAIRRO:</span>
                    <span className="deia-line-value">{neighborhood}</span>
                </div>
            </div>
            <div className="deia-row">
                <div className="deia-col-full">
                    <span className="deia-label">FONE:</span>
                    <span className="deia-line-value">{phone}</span>
                </div>
            </div>
            <div className="deia-row">
                <div className="deia-col-titulo">
                    <span className="deia-label">TITULO:</span>
                    <span className="deia-line-value mono">{title}</span>
                </div>
                <div className="deia-col-zona">
                    <span className="deia-label">ZONA:</span>
                    <span className="deia-line-value mono">{zone}</span>
                </div>
                <div className="deia-col-secao">
                    <span className="deia-label">SEÇÃO:</span>
                    <span className="deia-line-value mono">{section}</span>
                </div>
            </div>
        </article>
    );
}
