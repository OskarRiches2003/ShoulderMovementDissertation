import type { NavigationGuard } from 'vue-router'
export type MiddlewareKey = "auth"
declare module "../../node_modules/.pnpm/nuxt@3.15.4_@parcel+watcher_4ddc92af450e02907b87960190efdc5d/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  }
}
declare module 'nitropack' {
  interface NitroRouteConfig {
    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>
  }
}