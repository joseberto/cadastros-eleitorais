import {shown,type Person} from '@/lib/records';
export function Card({person:p,number}:{person:Person;number:number}) {
 return <article className="record-card"><h2>{String(number).padStart(2,'0')} {shown(p.name)}</h2><div className="record-lines">
  <p><b>Título:</b> {shown(p.title)}<span className="divider">|</span><b>Zona:</b> {p.zone}<span className="divider">|</span><b>Seção:</b> {p.section}</p>
  <p><b>Nascimento:</b> {shown(p.birth)}<span className="divider">|</span><b>Município/UF do título:</b> {p.city||p.uf?`${shown(p.city)}/${shown(p.uf)}`:'Não informado'}</p>
  <p><b>Endereço:</b> {shown(p.address)}</p>
  <p><b>CPF:</b> {shown(p.cpf)}<span className="divider">|</span><b>Celular:</b> {shown(p.phone)}</p>
  <p><b>Local de votação:</b> {shown(p.place)}</p>
 </div></article>;
}
