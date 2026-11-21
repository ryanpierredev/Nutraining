# Nutraining 1.1.0

## Uso

Após login/cadastro, o app abre o início com navegação para Treinos, Alimentação, Evolução e Conta. Não depende de Metro/Expo Go no APK preview.

### Aluno

- Crie treinos informando título, orientações e até 30 exercícios (séries, repetições/duração e descanso).
- Crie planos alimentares com até 30 refeições, horário e descrição dos alimentos/porções.
- Marque/desmarque treinos e refeições realizados hoje. Repetir a marcação não duplica o registro.
- Arquive seus planos para tirá-los da lista ativa. Planos criados por um profissional só podem ser arquivados por ele ou por um administrador.
- Registre água em incrementos de 250 ml; é possível desfazer. O registro é diário, sem meta médica automática.
- Registre peso, cintura opcional e observações por data. Um novo envio no mesmo dia corrige o registro. A tela mostra os últimos 90 registros, a variação entre o primeiro/último exibido e permite excluir.
- Em Conta, insira o código do personal ou nutricionista para autorizar acompanhamento. Remover o vínculo revoga o acesso futuro desse profissional; os planos recebidos permanecem com o aluno.

### Personal e nutricionista

Compartilhe o código disponível em Conta. Depois de o aluno se vincular, ele aparece no seletor de alunos.

Personal cria/consulta treinos; nutricionista cria/consulta planos alimentares. Ambos podem consultar a evolução de alunos vinculados. Os registros de conclusão pertencem ao aluno; profissionais não podem marcar atividades por ele. Alunos não vinculados são bloqueados na API, mesmo com um ID conhecido.

### Administrador

Em Conta → Administrar usuários, liste/cadastre usuários dos quatro perfis. O administrador também pode consultar os alunos, criar planos e arquivá-los. A promoção do primeiro administrador continua sendo feita pelo comando versionado `bootstrap-admin.mjs`, documentado em EC2.md.

## Atualizar EC2 e APK

Depois do merge na main e de fazer backup do PostgreSQL:

```bash
cd ~/apps/nutraining-git
git pull --ff-only origin main
bash scripts/update-ec2.sh
```

Isso aplica a migração 003 e reinicia a API. O Nginx e os segredos locais não são alterados. Gere também o novo APK; o APK antigo não recebe telas novas só porque a API foi atualizada:

```bash
source scripts/node-runtime.sh
cd mobile
npm ci
npx eas-cli@latest build --platform android --profile preview
```

Reutilize a assinatura existente no EAS e instale o APK pelo link gerado. Responda não à instalação em emulador no EC2. O stash antigo permanece guardado; não o restaure por cima desta implementação.

## Validar em desenvolvimento

Use banco de testes isolado, nunca o banco de produção. Configure PGHOST, PGPORT, PGDATABASE, PGUSER e, se necessário, PGPASSWORD no ambiente local. Crie o banco antes das migrações:

```bash
cd api
node migrate.mjs
node migrate.mjs
PORT=3101 node server.mjs
# Outro terminal, com as mesmas variáveis PG:
NUTRAINING_TEST_DB=1 node test-app.mjs
node test-auth.mjs
node test-admin.mjs
```

`test-app.mjs` exercita consentimento, isolamento entre alunos, especialidades, criação de planos, validações, conclusão idempotente, hidratação, evolução, revogação do vínculo e acesso administrativo. As contas são temporárias e removidas ao final. `test-admin.mjs` exige banco sem administradores reais.

Em mobile, execute `npm run lint`, `npx tsc --noEmit` e `npx expo export --platform android`. A exportação valida o bundle; um APK nativo ainda precisa ser gerado pelo EAS e testado no dispositivo.

## Escopo desta versão

Os planos são preenchidos pelo usuário ou pelo profissional; não há geração automática de dietas, catálogo de alimentos/calorias, vídeos de exercícios, pagamentos, chat ou notificações push. A marcação de atividades usa a data local do aparelho. Peso/cintura não produzem diagnóstico nem metas automáticas. Os dados ficam no servidor, não há sincronização offline; erros de conexão têm opção de tentar novamente.
