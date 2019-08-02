/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 把参数转换成数组。
    const args = toArray(arguments, 1)
    args.unshift(this)
    // 调用插件的install方法或pulgin方法。
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 把插件保存到Vue._installedPlugins数组中。
    installedPlugins.push(plugin)
    return this
  }
}
