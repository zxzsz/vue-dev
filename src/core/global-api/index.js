/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config

  // 对Vue.config做代理，不允许对其做set操作。
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)
  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.

  // Vue.util提供了四个可使用的api，但不建议使用。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 添加Vue全局方法set、delete、nextTick.
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API

  // 全局方法obserable。
  Vue.observable = (obj: T): T => {
    observe(obj)
    return obj
  }

  // 创建Vue.options空对象，随后在该对象中添加了components、directives、filters三个属性，其值为空对象。
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.

  // 在options对象中添加_base属性。
  Vue.options._base = Vue

  // extend方法把第二个参数中的属性扩展到第一个参数中，这里将keep-alive添加到Vue.options.components中。
  extend(Vue.options.components, builtInComponents)

  initUse(Vue) // 添加Vue.use方法。
  initMixin(Vue) // 添加Vue.mixin方法。
  initExtend(Vue) // 添加Vue.extend方法。
  initAssetRegisters(Vue) // 添加Vue.component、Vue.directive、Vue.filter方法。
}
