# Atualizações pelo GitHub

Código, migrações, scripts e documentação devem ser alterados no Git e revisados no GitHub. No EC2, apenas baixe a versão aprovada e execute os comandos versionados. Nunca edite JavaScript ou SQL diretamente no servidor. Senhas e configurações específicas da máquina permanecem no `api/.env` ignorado pelo Git; nunca as publique.

## Pré-requisitos existentes

- Checkout na branch `main`, sem alterações locais, com acesso de leitura ao GitHub.
- Node.js 24 e npm; PostgreSQL existente com backup antes da atualização. Se o Node global for anterior à versão 24, execute `bash scripts/setup-node24.sh`. O script baixa o binário oficial de nodejs.org por HTTPS e verifica SHA-256; suporta Linux x64 e arm64. Instala em `.runtime/` (ignorado pelo Git), sem sudo, sem alterar `/usr/bin/node` e sem modificar o perfil do shell. Instalação e atualização da API selecionam esse runtime automaticamente.
- `api/.env` com PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD e PORT existentes.
- Usuário do banco com permissão para aplicar migrações (ALTER TABLE). Não execute testes no banco de produção.
- Nginx existente encaminhando para `127.0.0.1:3101`. O serviço abaixo fixa essa porta e não modifica Nginx, certificados ou outros aplicativos.

## Instalar o serviço pela primeira vez

Após integrar esta branch à `main`, em `/home/ubuntu/apps/nutraining-git`, como usuário `ubuntu`:

```bash
git pull --ff-only origin main
bash scripts/setup-node24.sh
bash scripts/install-ec2-service.sh
```

Faça backup do banco antes de executar. O instalador exige `api/.env` existente e checkout limpo, instala dependências, aplica migrações e instala a unidade `nutraining-api.service` a partir do template versionado em `deploy/`. Usa o caminho real do checkout e do Node, executa como o usuário atual e habilita a inicialização após reboot. Recusa sobrescrever uma unidade existente ou usar a porta 3101 se estiver ocupada. Não executa como root; solicita sudo apenas para configurar systemd.

A porta 3101 é fixada pelo serviço, independentemente do PORT no `.env`, pois é o destino do Nginx existente. O PostgreSQL continua usando as variáveis PG do `.env`. Nenhuma senha é escrita na unidade. Se a primeira inicialização falhar, consulte os logs abaixo e corrija a causa; use o script de atualização para tentar novamente com a unidade já instalada.

```bash
sudo systemctl status nutraining-api.service --no-pager
sudo journalctl -u nutraining-api.service -n 50 --no-pager
curl --fail http://127.0.0.1:3101/health
```

Atualizações da configuração da unidade também devem ser feitas no template pelo Git e instaladas explicitamente após revisão. O script de atualização comum reinicia a unidade existente; não reinstala o template.

## Atualizar o EC2

Após o merge no GitHub, dentro do checkout no servidor:

```bash
git pull --ff-only origin main
bash scripts/update-ec2.sh
```

O serviço padrão é `nutraining-api.service`; para outro serviço existente, passe `API_SERVICE=nome.service`. O script confirma a branch e o checkout limpo, atualiza pelo Git, instala as dependências com lockfile, aplica migrações pendentes, reinicia a unidade e verifica a API e sua conexão ao PostgreSQL. Precisa da permissão de reinício via sudo. O primeiro `git pull` baixa também a versão atual do próprio script.

As migrações têm transação e bloqueio contra execução simultânea. A 001 é ignorada no banco já preparado; a 002 acrescenta `admin` sem remover usuários. Não remova tabelas nem reaplique SQL manualmente. Se uma migração falhar, o script para antes do reinício. Investigue a falha antes de tentar novamente. Não há reversão automática de schema.

## Primeiro administrador

Cadastre sua conta pelo aplicativo e, uma única vez, execute no checkout do EC2:

```bash
cd api
../.runtime/node/bin/node --env-file=.env bootstrap-admin.mjs seu-email@example.com
```

Se optou por Node 24 global, use `node` em vez de `../.runtime/node/bin/node`. O comando promove a conta existente e revoga suas sessões. Faça login novamente para abrir o painel. Ele recusa nova promoção se já existir administrador. Depois, novos administradores são cadastrados pelo painel. Nenhuma senha é recebida pela linha de comando.

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
