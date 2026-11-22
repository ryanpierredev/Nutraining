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

- Cadastro, login e perfil com foto. Em Ajustes, escolha o tema e veja ou encerre sessões de outros dispositivos.
- Início com atividades concluídas do dia, hidratação e último registro de peso.
- Treinos com exercícios, séries, repetições, descanso e marcação de conclusão diária.
- Planos alimentares com horários, alimentos/porções e registro de cada refeição.
- Evolução com gráficos de peso e cintura, filtros por período e edição do histórico.
- Vínculo autorizado pelo aluno com personal/nutricionista via código profissional.
- Profissionais acompanham apenas alunos vinculados e criam planos da própria especialidade.

Os dados vêm da API e persistem no PostgreSQL. Não são inseridos planos ou prescrições automáticas. Veja [funcionalidades e validação](docs/FUNCIONALIDADES.md).

Nunca versione senhas, tokens, chaves privadas ou arquivos .env locais.

## Administração e atualizações

Em **Ajustes → Área do administrador**, o administrador pode criar contas, consultar a origem do cadastro e filtrar contas com sessões ativas. Em **Treino**, **Dieta** e **Evolução**, pode selecionar a própria conta ou um aluno. Cada pessoa pode ter um treino fixo e uma dieta fixa em destaque na rotina diária.

Consulte [atualização do EC2 pelo GitHub](docs/EC2.md) para migrações, criação do primeiro administrador e comandos de atualização. Todas as alterações de código e banco são versionadas; configurações e segredos locais não vão para o Git.

Para gerar e instalar o APK atualizado a partir do Git, consulte [Android](docs/ANDROID.md).
