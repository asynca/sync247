# Sync247 Virtual Contact Center

Open source, local-first, privacy by design, asynchronous cloud-edge contact center and help desk

This is the meta repository for the Sync247 platform

## Status

Initial version as used in production for the Sync-247 capability.  There are no differences between this
open source repository and what we use in production.

## Features

### 360 Multi-channel communication with participants
- [x] SMS
- [x] Voice
- [ ] Fax
- [ ] Web chat
- [ ] Twitter DM

> Manage conversations across channels seamlessly from a single conversation thread

### 360 Multi-channel communication with teammates
- [x] SMS
- [x] Voice
- [ ] Fax
- [x] Microsoft Teams
- [ ] Slack

> No need to deploy additional mobile or web apps, use the interface your teammates are already familiar with 

### Self-provisioning using conversational user interface (AI bot)
- [x] Microsoft Teams
- [ ] Slack

> No need to use complicated carrier portals 

### Use multiple supported carriers for telephony
- [x] Twilio
- [x] SignalWire

> Get the lowest available pricing and highest redundancy

### Manage team-mate privacy with seamless two-way proxying of virtual channels and physical channels
- [x] Voice
- [x] SMS
- [x] Standardized professional voice-mail
- [ ] VOIP

> Let your team-mates bring their own mobile device and telephone number, but proxy anything through their dedicated corporate virtual number;  participants are only aware of the virtual number, but voice calls are routed directly to teammates and email/SMS/voice mail/call stats are delivered in the converged conversation thread of Microsoft Teams, Slack, etc.
> Screen all calls and route to voice mail if teammate is unable or chooses not to answer
> Integrate with line of business / CRM systems to provide user-enhanced profiles for each inbound / outbound contact

### Serverless / Edge-compute / Privacy by Design

Sync247 requires no servers or complicated databases to install, it runs in a cloud functions environment such as Firebase Cloud Functions or Cloudflare Workers.    Whether in the hosted enterprise or self-hosted community edition,  not data that does not need to be persisted on Sync247 is persisted;  instead bring your own collaboration host to keep conversation history and your own line of business applications to store user profiles and history (if needed)

## Getting started

The easiest way to try out Sync247 is at https://sync247.app.    This is a local-first / edge-compute environment, so even in the hosted model, you own and host the data on your collaboration and authentication provider.  Sync247 runs in 160 data centers around the world to assure the most rapid response to any SMS, voice, web or social inbounds and outbounds, and comes with integration to global and US telephony carriers, and as an installable app on Microsoft Teams or Slack.   Discord and web apps are coming.

Sync247 is also 100% open source (not just open core) with a permissive MIT license, so if you want to run on premise or on your own cloud provider instance, then with a bit of configuration work you can get it going.   If you're just evaluating features, we suggest you start with the hosted model. 

## Motivation

Moving as CIO from a $2B publicly traded company to a small startup, I was frustrated with the lack of low-cost tools for basic telephony, help desk, and customer support channels to run our business.   There are good tools in each category, but each one comes with a high per-user-per-month cost and generally requires lock-in and trust of venture-capital or big tech businesses that leave user privacy as an after-thought. 

At the same time, disruptive entrants such as Twilio and SignalWire provide programmable telephony as a service, and free collaboration software such as Slack, Microsoft Teams or Mattermost provide nearly all of the user interface needed.  So with an additional conversational user interface (bot) and integration between all the various components, a fully fledged virtual contact center is possible as a weekend side project.     That's what Sync247 represents.   

Since its not the core offering or competency of the contributors' businesses, its 100% open source and contributor supported.   However, to support small and medium enterprises who don't want to spend the time or effort configuring, hosting or supporting this platform, a very low cost hosted option is provided.   It operates at a slight margin over cost to cover the hosting and suppprt costs, but is targeted to be 10x cheaper than the for-profit venture-backed players. 

The added advantage of a low-cost open source capability without long term exit valuation goals is we can make a privacy promise that is differentiated from most of big tech.   Your data, your privacy, always.   No advertising or data-derived revenue models, ever.  

Finally, the source code is written in modern TypeScript, so highly portable across cloud providers, and is slimmed down to run in lightweight V8 isolates such as Cloudflare workers, not thick Node.js environments (although it will run just fine there too).    Depedencies are kept to a minimum, and any persistent storage is managed using simple, distributed, highly scalable, eventually-consistent Key-Value stores, so no need to install SQLite, MongoDb, etc.  Innovations taken from the conversational user interface industry are leveraged to provide a developer-friendly (React like) modern user interface that works regardless of channel (e.g. Amazon Alexa, Google Home, plain old SMS).   All standards are open as well, leveraging and contributing to the [IOPA alliance](https://iopa.io).

## Local Development

A meta repository is used to develop locally a number of related and interdependent packages each with their own separate git repository.

Some of the repositories are in turn mono repositories, consisting of multiple local packages.

You can work with each repository in the `.meta` list independently, but if you want to be work on features that cross repository boundaries, then this meta repository is the easiest (and only place needed) to start.

### Pre-requisites

Make sure that yarn, lerna, wrangler and cloudflared are installed globally in node, and that you are running with node V10.7 or above. Some of these can be installed locally if you prefer or run with npx.  

```bash
npm i -g yarn
npm i -g lerna
npm i @cloudflare/wrangler -g
brew install cloudflare/cloudflare/cloudflared  
```

Run `wrangler config` to set your Cloudflare Global API key and email associated with the account

#### EnvKey

This application uses [EnvKey](https://www.envkey.com/) for managing secrets.   Download and get an invite before using.

### Installation

```bash
yarn
yarn build
```

### Development build & run

```bash
cd packages/worker
yarn dev && yarn start
```


### Environment Services and Secrets Required

#### Cloudflare 

Sync247 runs as a cloud serverless edge function on Cloudflare workers.  This gives very low latency and rapid startup times for responding to incoming calls, text messages, etc.

Set up a workers account on Cloudflare, and a Workers KV instance.  You will need the following secrets:

``` yaml
CF_ACCOUNT_ID=
CF_SERVERLESS_DB_ID=
CF_WORKER_NAME=
CF_WORKER_ROUTE=
CF_ZONE_ID=
```

#### Microsoft Graph 

Sync247 uses the Microsoft Graph API for interacting with Microsoft Teams.

You will need an Microsoft App in Azure Portal and the following secrets:

```yaml
GRAPH_MSAPP_ID=
GRAPH_MSAPP_SECRET=
MSAPP_ID=
MSAPP_TENANT=
```

Set MSBOT_API to the Azure cloud worker, for example: 
```yaml
MSBOT_API='https://api-dev.sync247.net/client/v1.0.0/msbot/api/messages'
```

Create an Microsft Teams App, administrative group (for administrators) and GUID of the system administrator/owner and a backup administrator/owner:

```yaml
MSTEAMS_ADMIN_GROUP_ID=
MSTEAMS_APP_ID=
MSTEAMS_GROUP_ID=
MSTEAMS_OWNER_ID=
MSTEAMS_OWNER_ID2=
```

#### Signalwire

Sync247 uses Signalwire as a low-cost alternative to Twilio.   Your mileage may vary, we have not found more numbers provisioned on Signalwire do not support machine-to-machine text messages, so Twilio while more expensive may be more useful even though  machine-to-machine SMS is not widely supported.   

You will need the following secrets:

```yaml
SIGNALWIRE_ACCOUNT_SID= 
SIGNALWIRE_ACCOUNT_TOKEN= 
SIGNALWIRE_ADDRESS_SID=
SIGNALWIRE_CALLBACK_APP_ID=
SIGNALWIRE_CALLBACK_TOKEN= 
SIGNALWIRE_ID= 
SIGNALWIRE_MIGRATE_TO_ACCOUNT_SID= # staging account SID when used in dev, production account SID for staging 
SIGNALWIRE_MIGRATE_TO_ADDRESS_SID= # staging address SID when used in dev, production address SID for staging
SIGNALWIRE_PROJECT= 
SIGNALWIRE_SPACE='myspace.signalwire.com'
SIGNALWIRE_TOKEN=
```

#### Twilio
Twilio is an easy to use carrier for voice and SMS numbers.  You will need the following secrets:

```yaml
TWILIO_ACCOUNT_SID=
TWILIO_ADDRESS_SID=
TWILIO_CALLBACK_APP_ID=
TWILIO_CALLBACK_TOKEN=
TWILIO_MIGRATE_TO_ACCOUNT_SID= # staging account SID when used in dev, production account SID for staging 
TWILIO_MIGRATE_TO_ADDRESS_SID= # staging account SID when used in dev, production account SID for staging 
TWILIO_PRIMARY_TOKEN=
TWILIO_PROJECT=
```


# License

MIT