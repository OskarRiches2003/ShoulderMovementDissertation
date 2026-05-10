import type { ComputedRef, MaybeRef } from 'vue'
export type LayoutKey = string
declare module "../../node_modules/.pnpm/nuxt@3.15.4_@parcel+watcher_4ddc92af450e02907b87960190efdc5d/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}