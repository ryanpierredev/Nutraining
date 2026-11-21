# Nutraining

Aplicativo Expo SDK 58 e API Node.js com PostgreSQL.

## Estrutura

- mobile/: aplicativo Android e iOS.
- api/: autenticação, sessões e migrações PostgreSQL.

## Executar o aplicativo

Dentro de mobile/:

    cp .env.example .env.local
    npm ci
    npx expo lint
    npx tsc --noEmit
    npx expo start --tunnel

## Executar a API

Dentro de api/:

    cp .env.example .env
    chmod 600 .env

Configure a senha real do PostgreSQL somente nesse arquivo local.

    npm ci
    node --env-file=.env migrate.mjs
    node --env-file=.env server.mjs

O comando migrate aplica somente as migrações pendentes, com transação e bloqueio de concorrência. Faça backup antes de atualizar um banco existente.

## Estado atual

- Cadastro, login, sessão persistente e administração de usuários.
- Início com atividades concluídas do dia, hidratação e último registro de peso.
- Treinos com exercícios, séries, repetições, descanso e marcação de conclusão diária.
- Planos alimentares com horários, alimentos/porções e registro de cada refeição.
- Evolução com peso, cintura opcional, observações e correção/exclusão de registros.
- Vínculo autorizado pelo aluno com personal/nutricionista via código profissional.
- Profissionais acompanham apenas alunos vinculados e criam planos da própria especialidade.

Os dados vêm da API e persistem no PostgreSQL. Não são inseridos planos ou prescrições automáticas. Veja [funcionalidades e validação](docs/FUNCIONALIDADES.md).

Nunca versione senhas, tokens, chaves privadas ou arquivos .env locais.

## Administração e atualizações

O administrador pode listar usuários e cadastrar alunos, personal trainers, nutricionistas e outros administradores pelo aplicativo. O cadastro público nunca permite selecionar o perfil administrador.

Consulte [atualização do EC2 pelo GitHub](docs/EC2.md) para migrações, criação do primeiro administrador e comandos de atualização. Todas as alterações de código e banco são versionadas; configurações e segredos locais não vão para o Git.

Para gerar e instalar o APK atualizado a partir do Git, consulte [Android](docs/ANDROID.md).
