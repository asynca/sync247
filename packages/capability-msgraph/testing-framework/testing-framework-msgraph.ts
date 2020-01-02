import { IopaApp } from 'iopa-types'
import { rest } from 'msw'
import { random } from '@iopa-edge/testing-framework'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function interceptMsGraphResponses(app: IopaApp) {
  return [
    rest.post(
      'https://login.microsoftonline.com/:tenantId/oauth2/v2.0/token',
      (req, res, ctx) => {
        console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)
        return res(
          ctx.json({
            token_type: 'Bearer',
            expires_in: 86399,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ext_expires_in: 86399,
            access_token:
              'DUMMYTOKEN.asdasdasdasdasd.B408Lfw5z8YOIx-f3DFzfuT2mW8Dtcoyrz5QHBEjULxjmMb7vMXY5rrNh4MYdqw-asdadasdasdasd-asdasdasdasd-asdasdasdasd'
          })
        )
      }
    ),
    rest.get(
      'https://graph.microsoft.com/v1.0/groups/:groupid/members/:uid?$select=id',
      (req, res, ctx) => {
        console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)
        const isAdmin: boolean = app.properties
          .get('server.Testing')
          .get('msgraph.isAdministrator')

        return res(
          ctx.json({
            id: isAdmin ? req.params.uid : null
          })
        )
      }
    ),
    rest.get('https://graph.microsoft.com/v1.0/users/:uid', (req, res, ctx) => {
      console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)

      return res(
        ctx.json({
          businessPhones: ['businessPhones-value'],
          displayName: 'displayName-value',
          givenName: 'givenName-value',
          jobTitle: 'jobTitle-value',
          mail: 'mail-value',
          mobilePhone: random('ddd-ddd-dddd'),
          officeLocation: 'officeLocation-value',
          preferredLanguage: 'preferredLanguage-value',
          surname: 'surname-value',
          userPrincipalName: 'userPrincipalName-value',
          id: req.params.uid
        })
      )
    }),
    // https://graph.microsoft.com/v1.0/users/b5a3568e-fb32-4e0a-abb5-9697f4b58800
    rest.patch(
      'https://graph.microsoft.com/v1.0/users/:uid',
      (req, res, ctx) => {
        console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)

        return res(
          ctx.json({
            businessPhones: ['businessPhones-value'],
            displayName: 'displayName-value',
            givenName: 'givenName-value',
            jobTitle: 'jobTitle-value',
            mail: 'mail-value',
            mobilePhone: random('ddd-ddd-dddd'),
            officeLocation: 'officeLocation-value',
            preferredLanguage: 'preferredLanguage-value',
            surname: 'surname-value',
            userPrincipalName: 'userPrincipalName-value',
            id: req.params.uid
          })
        )
      }
    ),
    // Create Team
    rest.post('https://graph.microsoft.com/beta/teams', (req, res, ctx) => {
      console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)

      const teamId = random()

      return res(
        ctx.status(202),
        ctx.set('Location', `/teams/${teamId}/operations/2342342424234`),
        ctx.set('Content-Location', `/teams/${teamId}`),
        ctx.set('Content-Length', '0')
      )
    }),
    // Check Team Operation
    // https://graph.microsoft.com/v1.0/teams/b5a8fc36-92d4-43d6-aebf-811fae4d2519/operations/2342342424234
    rest.get(
      'https://graph.microsoft.com/v1.0/teams/:teamId/operations/:operationId',
      (req, res, ctx) => {
        console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)

        return res(
          ctx.json({
            id: 'string',
            operationType: 'archiveTeam',
            createdDateTime: '2018-01-01T00:00:00.0000000Z',
            status: 'succeeded',
            lastActionDateTime: '2018-01-01T00:00:00.0000000Z',
            attemptsCount: 1,
            targetResourceId: 'fa4aa5a2-a75b-4769-86f4-9e2742a18fda',
            targetResourceLocation:
              "/groups('fa4aa5a2-a75b-4769-86f4-9e2742a18fda')/team",
            error: null
          })
        )
      }
    ),
    // Check for existing matching team with same displayName
    // https://graph.microsoft.com/beta/groups?$filter=resourceProvisioningOptions/Any(x:x%20eq%20%27Team%27)%20and%20startswith(displayName,%20%27sync%201%20(808)%20925-5327%20surname-value%27)
    rest.get('https://graph.microsoft.com/beta/groups', (req, res, ctx) => {
      console.log(`[MSW-GRAPH] ${req.method} ${req.url}`)

      return res(
        ctx.json([
          {
            id: '79968cd9-3333-413a-8633-ce580310c842',
            createdDateTime: '2020-06-08T13:48:42Z',
            createdByAppId: 'cc15fd57-2c6c-4117-gggg-83b1d56b4bbe',
            description:
              'Provisioned Sync24-7 environment for Guy Barnard, Chief Executive Officer',
            displayName: 'sync 1 (222) 222-2222 Barnard-staging',
            visibility: 'Private'
          }
        ])
      )
    })
  ]
}

export default interceptMsGraphResponses
