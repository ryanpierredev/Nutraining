# Perfil, segurança e gestão — 1.2.0

## Onde encontrar

A aba **Perfil** reúne foto, nome, biografia, acompanhamento e acesso às **Configurações**. O administrador também encontra atalhos para passar treinos/dietas e abrir a gestão.

Em **Configurações**:

- **Segurança**: alteração de senha com confirmação da senha atual; 12 a 128 caracteres. A troca revoga todos os tokens anteriores e cria uma nova sessão para o dispositivo atual.
- **Dispositivos e sessões**: início, última atividade, expiração e indicação da sessão atual. Permite encerrar um acesso ou todos os outros acessos. Logout permanece em Perfil.
- **Aparência**: claro, escuro ou seguir sistema; preferência persistida neste dispositivo (AsyncStorage). Tokens continuam no SecureStore, não nesse armazenamento de preferências.
- **Administração**, somente para administradores: indicadores, cadastros, sessões e atividade. Essa restrição também é aplicada na API.

## Atribuir treino e dieta

Como administrador, abra Treinos ou Alimentação, selecione o aluno e crie o plano. Não é necessário vínculo profissional para o administrador. Os planos ficam imediatamente disponíveis para o aluno ao atualizar a tela.

Na gestão de cadastros e na lista de usuários há atalhos **Passar treino** e **Passar dieta**, que já selecionam o aluno. Outros perfis continuam com as permissões anteriores: personal e nutricionista precisam do vínculo do aluno e atuam na própria especialidade.

## Foto

A foto é escolhida na biblioteca do telefone, recortada e convertida em JPEG de 256×256. O limite é 40 KB de imagem (antes de base64), compatível com os limites existentes de 64 KB da API/Nginx. A imagem fica no PostgreSQL, não exige diretório de uploads nem mudança no proxy. A foto pode ser removida e só é devolvida ao titular em uma rota autenticada. Não são solicitadas permissões de câmera ou microfone.

## Indicadores administrativos

- Total de contas e novos cadastros nos últimos 7 dias.
- Contas por perfil, treinos/dietas ativos e vínculos.
- Sessões ainda válidas e usuários com atividade recente (últimos 15 minutos).
- Cadastros com data, origem (app ou administrador), último login e quantidade de sessões válidas.
- Sessões com usuário, identificação informada pelo dispositivo, início, última atividade e validade; o administrador pode encerrar acessos, exceto a própria sessão atual.
- Histórico de novos cadastros, contas criadas pelo administrador, logins, troca de senha e revogação de sessões, com data e autor. Busca por nome/e-mail e paginação de 25 itens.

Sessões válidas não significam usuários online neste instante. A última atividade é atualizada nas requisições autenticadas, em intervalos de até um minuto; não há rastreamento em segundo plano. Nomes de dispositivos são informados pelo cliente. Eventos anteriores à migração não são reconstruídos: cadastros antigos mostram origem/último login desconhecidos até haver novo evento aplicável. Nenhum token, hash de senha ou senha é retornado nos relatórios.

## Atualizar pelo Git

Faça backup do banco, integre esta entrega à main e execute no EC2:

```bash
cd ~/apps/nutraining-git
git pull --ff-only origin main
bash scripts/update-ec2.sh
source scripts/node-runtime.sh
cd mobile
npm ci
npx eas-cli@latest build --platform android --profile preview
```

A migração **004_profile_security.sql** preserva usuários/sessões existentes e adiciona os campos de perfil, identificação das sessões e histórico. O script de atualização aplica as migrações e reinicia a API. Nginx e segredos locais são preservados. Instale o APK novo (1.2.0, versionCode 4), mantendo a assinatura Android já usada. Responda não à instalação em emulador no EC2.

As novas bibliotecas nativas de seleção/manipulação de imagens e armazenamento do tema exigem esse novo APK. Atualizar apenas a API não adiciona essas telas ao aplicativo instalado.

## Validação

Em banco isolado, depois de `node migrate.mjs` e de iniciar a API na porta 3101 com as mesmas variáveis PG:

```bash
NUTRAINING_TEST_DB=1 node test-account.mjs
```

O teste cobre atualização do perfil sem alteração de papel, isolamento da foto, validação do upload, propriedade das sessões, revogação, senha incorreta, rotação de token, acesso administrativo, relatórios sem credenciais e atribuição dos dois tipos de plano pelo administrador. Execute também os testes anteriores de autenticação, administração e funcionalidades; nunca contra o banco de produção.
