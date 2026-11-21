# Atualizações pelo GitHub

Código, migrações, scripts e documentação devem ser alterados no Git e revisados no GitHub. No EC2, apenas baixe a versão aprovada e execute os comandos versionados. Nunca edite JavaScript ou SQL diretamente no servidor. Senhas e configurações específicas da máquina permanecem no `api/.env` ignorado pelo Git; nunca as publique.

## Pré-requisitos existentes

- Checkout na branch `main`, sem alterações locais, com acesso de leitura ao GitHub.
- Node.js 24 e npm; PostgreSQL existente com backup antes da atualização.
- `api/.env` com PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD e PORT existentes.
- Usuário do banco com permissão para aplicar migrações (ALTER TABLE). Não execute testes no banco de produção.
- Unidade systemd existente executando `node --env-file=.env server.mjs` dentro de `api/`. O script não adivinha o nome nem modifica a configuração atual do serviço ou do proxy HTTPS.

## Atualizar o EC2

Após o merge no GitHub, dentro do checkout no servidor:

```bash
git pull --ff-only origin main
API_SERVICE=nome-real-do-servico bash scripts/update-ec2.sh
```

Substitua `nome-real-do-servico` pela unidade systemd da API. O script confirma a branch e o checkout limpo, atualiza pelo Git, instala as dependências com lockfile, aplica migrações pendentes, reinicia a unidade e verifica a API e sua conexão ao PostgreSQL. Precisa da permissão de reinício via sudo. O primeiro `git pull` baixa também a versão atual do próprio script.

As migrações têm transação e bloqueio contra execução simultânea. A 001 é ignorada no banco já preparado; a 002 acrescenta `admin` sem remover usuários. Não remova tabelas nem reaplique SQL manualmente. Se uma migração falhar, o script para antes do reinício. Investigue a falha antes de tentar novamente. Não há reversão automática de schema.

## Primeiro administrador

Cadastre sua conta pelo aplicativo e, uma única vez, execute no checkout do EC2:

```bash
cd api
node --env-file=.env bootstrap-admin.mjs seu-email@example.com
```

O comando promove a conta existente e revoga suas sessões. Faça login novamente para abrir o painel. Ele recusa nova promoção se já existir administrador. Depois, novos administradores são cadastrados pelo painel. Nenhuma senha é recebida pela linha de comando.

## Aplicativo

A atualização da API no EC2 não distribui uma nova versão do aplicativo. Para desenvolver a interface atualizada, no computador de desenvolvimento, baixe o mesmo Git:

```bash
git pull --ff-only origin main
cd mobile
npm ci
npx expo start
```

Configure `mobile/.env.local` com `EXPO_PUBLIC_API_URL` apontando para o HTTPS da API. A distribuição de um novo APK/build iOS segue o fluxo de publicação mobile, fora do script do EC2.

## Validação em banco isolado de desenvolvimento

Com as variáveis PG apontando para um banco local de teste:

```bash
cd api
node migrate.mjs
PORT=3101 node server.mjs
# Em outro terminal com as mesmas variáveis PG:
node test-admin.mjs
node test-auth.mjs
```

`test-admin.mjs` exige banco sem administradores; cria e remove suas próprias contas. Não o execute em produção. Valide também `npm run lint` e `npx tsc --noEmit` em `mobile/`.
