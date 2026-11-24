# Funcionalidades do Nutraining

## Uso

Depois de entrar, use as abas **Início**, **Treino**, **Dieta**, **Evolução**, **Perfil** e **Ajustes**. No Perfil, você pode editar o nome e escolher uma foto da galeria. Em Ajustes, pode escolher o tema escuro ou claro e ver o dispositivo, o início, a última atividade e a expiração de cada sessão válida. É possível encerrar uma sessão de outro dispositivo ou todas as outras de uma vez.

Cada sessão é encerrada após 15 minutos sem atividade. Ao voltar ao aplicativo depois desse período, entre novamente. A atividade em um dispositivo não prolonga a sessão de outro.

### Aluno

- Consulte os treinos e as dietas cadastrados por personal, nutricionista ou administrador.
- Em **Treino**, toque no título para abrir a ficha. Registre a carga em kg de cada exercício. Salvar novamente corrige a carga do dia, e **Ver histórico de cargas** mostra os últimos 30 registros do exercício. As cargas continuam disponíveis em **Ver treinos arquivados**.
- Marque/desmarque treinos e refeições realizados hoje. Repetir a marcação não duplica o registro.
- Registre água em incrementos de 250 ml; é possível desfazer. O registro é diário, sem meta médica automática.
- Registre peso, cintura opcional e observações por data. Um novo envio no mesmo dia corrige o registro. A tela mostra até 90 registros e permite filtrar os últimos 30 ou 90 dias. O gráfico alterna entre peso e cintura e mostra a variação no período.
- Em Perfil, insira o código do personal ou nutricionista para autorizar acompanhamento. Remover o vínculo revoga o acesso futuro desse profissional; os planos recebidos permanecem com o aluno.

### Personal e nutricionista

Na tela de login, toque em **Cadastrar como profissional** e escolha **Personal** ou **Nutricionista**. Contas de aluno são criadas por profissionais ou administradores logados.

Use **Ajustes → Cadastrar aluno** para criar uma conta. Compartilhe o código disponível em Perfil. Depois de o aluno se vincular, ele aparece no seletor de alunos.

Personal cria/consulta treinos; nutricionista cria/consulta planos alimentares. Ambos podem consultar a evolução de alunos vinculados. Os registros de conclusão pertencem ao aluno; profissionais não podem marcar atividades por ele. Alunos não vinculados são bloqueados na API, mesmo com um ID conhecido.

### Administrador

Em **Ajustes → Área do administrador**, consulte o total de contas, cadastros dos últimos sete dias e contas com pelo menos uma sessão válida. Busque por nome ou e-mail, filtre contas ativas e veja quando e por quem cada conta foi criada. A origem só está disponível para cadastros feitos após a migração 004.

Em **Treino**, **Dieta** ou **Evolução**, escolha **Para mim** ou selecione um aluno. Para um aluno, você também pode abrir essas abas diretamente pelo painel. Crie ou fixe um treino e uma dieta por pessoa. Os planos fixos aparecem na rotina diária e trocar o destaque mantém o plano anterior na lista. Nas suas próprias abas, você pode marcar atividades realizadas e registrar medidas. A promoção do primeiro administrador continua sendo feita pelo comando versionado `bootstrap-admin.mjs`, documentado em EC2.md.

## Atualizar EC2 e APK

Depois do merge na main e de fazer backup do PostgreSQL:

```bash
cd ~/apps/nutraining-git
git pull --ff-only origin main
bash scripts/update-ec2.sh
```

O script aplica as migrações pendentes e reinicia a API. Gere um novo APK para disponibilizar as telas novas e o seletor de fotos:

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

`test-app.mjs` exercita consentimento, isolamento entre alunos, especialidades, criação de planos, validações, conclusão idempotente, hidratação, evolução, revogação do vínculo e acesso administrativo. Os testes de autenticação e administração também cobrem foto, tema, revogação de sessões, origem de cadastros e contas ativas. As contas são temporárias e removidas ao final. `test-admin.mjs` exige banco sem administradores reais.

Em mobile, execute `npm run lint`, `npx tsc --noEmit` e `npx expo export --platform android`. A exportação valida o bundle; um APK nativo ainda precisa ser gerado pelo EAS e testado no dispositivo.

## Escopo desta versão

Os planos são preenchidos por profissionais e administradores. Não há geração automática de dietas, catálogo de alimentos/calorias, vídeos de exercícios, pagamentos, chat ou notificações push. A marcação de atividades usa a data local do aparelho. Peso/cintura não produzem diagnóstico nem metas automáticas. Os dados ficam no servidor, não há sincronização offline; erros de conexão têm opção de tentar novamente.
