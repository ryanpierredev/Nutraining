# APK Android a partir do Git

A configuração do aplicativo, o ícone e o perfil `preview` estão versionados. O stash antigo do EC2 pode continuar guardado; não execute `git stash pop` para preparar o build.

Após o merge na main, execute no checkout do EC2:

```bash
cd ~/apps/nutraining-git
git pull --ff-only origin main
source scripts/node-runtime.sh
cd mobile
npm ci
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview
```

Caso não esteja autenticado no Expo, use `npx eas-cli@latest login` no terminal (nunca envie senha ou token pelo chat). A conta precisa ter acesso ao projeto `5d036e55-3f79-4b3b-8b47-6807529bfd4a`. Use o projeto já vinculado; não crie outro com `eas init`. Reutilize a chave de assinatura Android existente no EAS; não gere uma chave nova para atualizar o APK já instalado.

O perfil preview gera um APK interno, com `EXPO_PUBLIC_API_URL=https://3.142.79.208:9443` incorporado no bundle. Essa URL é pública e não é um segredo. Não desative a validação HTTPS. O aplicativo exige um certificado válido. Confira se não há variável conflitante para a mesma chave nas configurações do projeto Expo.

Ao terminar, abra o link de instalação fornecido pelo EAS no celular e instale a atualização. Esta versão se identifica como 1.1.0 (versionCode 3). O pacote continua `com.ryanpierredev.nutrainingmobile`. Atualizar a API ou executar git pull não atualiza o APK do telefone. A geração na nuvem exige conectividade com Expo e pode consumir a cota de builds da conta.

Antes de builds futuros, incremente version/versionCode no Git conforme necessário. Se o Android recusar a atualização, registre o erro e confira assinatura/versionCode; não desinstale automaticamente, pois isso remove os dados locais.

## Conferir no celular

1. Abra `https://3.142.79.208:9443/health` e confirme status ok com database connected.
2. No APK novo, use “Ainda não tenho conta” para registrar uma conta normal.
3. Promova o primeiro administrador pelo comando documentado em EC2.md, usando o mesmo e-mail; saia e entre novamente.
4. Confira se o painel de administração aparece.

O acesso ao health no navegador valida essa conexão no navegador; não comprova sozinho que login/cadastro funciona no APK. Se persistir o erro, registre a etapa exata e examine os logs da API (`sudo journalctl -u nutraining-api.service -n 50 --no-pager`) sem compartilhar senhas ou tokens.
