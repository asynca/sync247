# Async Platform Edge Worker

## About

This is the core logic that implements all the cloud-edge capabilities of the Sync247 Platform.   It runs as a Cloudflare Worker or Firebase Cloud Function.

The instructions below are for Cloudflare.  Make sure you already have a workers account setup.

## Pre-requisites

Please make sure the following are installed prior to `lerna bootstrap` on the mono repository that contains this package

```bash
npm install -g @cloudflare/wrangler
npm install -g ngrok
```

Install [Google cloud gsutil](https://cloud.google.com/storage/docs/gsutil_install)

```bash
curl https://sdk.cloud.google.com | bash
```

Restart your shell

Initialize and login to gcloud

```bash
gcloud init
```

## Set Cloudflare configuration `wrangler.toml` in `./packages/worker` root

Either copy `wrangler.toml.default` to `wrangler.toml` replacing the following variables:

-   CF_ACCOUNT_ID
-   CF_ZONE_ID
-   CF_HOSTNAME (e.g., sync247.app)

Or download the previously saved one from Google Firebase Storage

```bash
yarn download-toml
```

## Set wrangler API key for cloudflare

```bash
wrangler config
```

## Set up secrets in Cloudflare

```bash
 wrangler kv:namespace create "SECRETS_DEV"
 wrangler kv:namespace create "SECRETS_STAGING"
 wrangler kv:namespace create "SECRETS_PROD"
```

or download previously saved secrets

```bash
yarn download
```

## Save secrets

```bash
yarn upload
```

## Save cloudflare `wrangler.toml` configuration to Google Firebase Storage

```bash
yarn upload-toml
```

## Deploy in Development (locally and with deployed worker that does Cloudflare forward)

WARNING: This opens a tunnel to your localhost on port 3000

The development enviornment is achieved using ngrok and a cloudflare redirect.

Running the script `./scripts/ngrok.js` spawns a child process with ngrok (using the node `ngrok` module which is linked in the node_modules of this repository), captures the URL
of the temporary ngrok tunnel, updates the env-secrets with the host name, and then uploads
this script to the development API on cloudflare.

```bash
yarn ngrok
yarn start
```

## Deploy to Staging

```bash
yarn deploy-staging
```

## Deploy to Production

```bash
yarn deploy-prod
```
