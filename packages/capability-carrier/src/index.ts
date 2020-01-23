import { CarrierMiddleware, CarrierMiddlewareApp } from 'iopa-carrier'

export default class CarrierCapability {
  private app: CarrierMiddlewareApp

  constructor(app: CarrierMiddlewareApp) {
    this.app = app

    app.use(CarrierMiddleware, 'CarrierMiddleware')

    app.carrier.onTurnError = async (context, err) => {
      console.error(err)
      void context.response.end()
    }

    app.post(app.carrier.getBaseUrlPath(), async (context, next) => {
      try {
        await app.carrier.invokeActivity(context, next)
      } catch (ex) {
        console.error(ex)
      }
    })
  }
}
