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
    node --env-file=.env server.mjs

A migração 001 deve ser executada uma única vez em um banco novo.
O banco atual do EC2 já foi preparado.

## Estado atual

Cadastro, login, identificação do perfil e logout implementados.
Os módulos completos de treino, nutrição e acompanhamento ainda estão pendentes.

Nunca versione senhas, tokens, chaves privadas ou arquivos .env locais.
