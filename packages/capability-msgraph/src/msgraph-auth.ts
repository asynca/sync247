/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const fetch: any

export async function getToken(): Promise<AuthToken> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${process.env.MSAPP_TENANT}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `client_id=${process.env.GRAPH_MSAPP_ID}
&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default
&client_secret=${process.env.GRAPH_MSAPP_SECRET}
&grant_type=client_credentials`
      }
    )

    const json = await response.json()

    if (json.error) {
      const errorResponse = json as ErrorResponse
      const error = new Error(errorResponse.error_description)
      Object.assign(error, {
        name: errorResponse.error,
        code: JSON.stringify(errorResponse.error_codes, null, 0),
        timestamp: errorResponse.timestamp,
        traceId: errorResponse.trace_id,
        correlationId: errorResponse.correlation_id,
        errorUri: errorResponse.error_uri
      })

      throw error
    } else {
      const tokenResponse = json as AuthToken
      return tokenResponse
    }
  } catch (ex) {
    console.error(ex)
    throw ex
  }
}

export interface AuthToken {
  token_type: string
  expires_in: number
  ext_expires_in: number
  access_token: string
}

interface ErrorResponse {
  error: string
  error_description: string
  error_codes: string[]
  timestamp: string
  trace_id: string
  correlation_id: string
  error_uri: string
}
