import createServerlessApp from '@iopa-edge/host-cloudflare'
import mainMiddlewareApp from './index'

const app = createServerlessApp()
app.use(mainMiddlewareApp, 'entry-cloudflare')
app.build()
