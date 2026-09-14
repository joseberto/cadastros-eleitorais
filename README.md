# Cadastros eleitorais

Sistema de cadastro com banco de dados compartilhado entre os dispositivos da mesma conta, acesso privado e impressão A4 inspirada no arquivo de referência fornecido pelo usuário.

## Uso

1. Abra o sistema e entre com a mesma conta ChatGPT em cada dispositivo.
2. Clique em **Novo cadastro**. Somente **zona** e **seção** são obrigatórias. Nome também é opcional, conforme solicitado.
3. Informe os demais dados disponíveis e clique em **Salvar cadastro**.
4. Para editar, clique no lápis na linha correspondente.
5. Escolha nome, título, zona ou seção em **Ordenar por**. O padrão é nome em ordem alfabética portuguesa. Clique no botão ao lado para inverter a ordem. Valores ausentes ficam no fim.
6. Clique em **Imprimir fichas**, confira a prévia e use **Imprimir / Salvar PDF**. Selecione A4, escala 100%, nenhuma margem, sem cabeçalhos/rodapés do navegador e com gráficos de fundo.

A impressão usa a fonte DejaVu Sans, as cores, margens, sequência dos campos e posições das cinco fichas do modelo. Textos extensos aumentam a ficha e podem reduzir a quantidade de fichas por página para evitar cortes. A paginação mantém a mesma ordem da lista.

## Campos

Nome completo, título, zona, seção, nascimento, município do título, UF do título, endereço, CPF, celular e local de votação. Campos opcionais vazios aparecem como **Não informado**. Datas são verificadas no cliente e no servidor. CPF e título têm máscaras e validação de comprimento; o sistema não confirma autenticidade documental ou situação eleitoral.

## Arquitetura e hospedagem

React/TypeScript, Vinext e Cloudflare Workers, com banco D1. `.openai/hosting.json` declara o banco lógico `DB`. O ambiente Sites aplica as migrações e fornece a autenticação e o banco. Os registros são isolados por conta autenticada; acessar em outro aparelho com a mesma conta recupera os mesmos registros. Alterações concorrentes são detectadas por revisão para impedir sobrescrita silenciosa.

**GitHub armazena o código. GitHub Pages sozinho não executa esta aplicação nem fornece o banco.** Esta versão depende do ambiente Sites para execução e autenticação. Publicá-la diretamente em outro provedor exige configurar um banco D1 e adaptar a camada de autenticação para esse provedor. Nunca confie em cabeçalhos de autenticação enviados livremente pela internet.

O repositório novo pretendido é `joseberto/cadastros-eleitorais`. Nenhum arquivo de `ficha-whatsapp-vanda` é usado ou alterado. A criação e sincronização desse novo repositório dependem da conexão GitHub correta.

## Desenvolvimento

Use Node.js 22.13 ou superior e o gerenciador indicado em `package.json` (pnpm). Preserve o arquivo de lock.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

O projeto contém os utilitários de build e o adaptador de ambiente do starter. As migrações estão em `drizzle/` e o esquema em `db/schema.ts`. O sistema não inclui os dados pessoais do PDF como dados iniciais nem os envia ao repositório. A lista começa vazia.

## Verificações realizadas

- Compilação da aplicação e checagem TypeScript.
- Máscaras, datas inválidas, campos obrigatórios e ordenação alfabética/numérica.
- Migração SQLite, isolamento por conta e controle de revisão para alterações concorrentes.
- O teste interativo em navegador não foi executado nesta entrega. A ferramenta WebMCP opcional é detectada por recurso e não é necessária para o funcionamento normal.
