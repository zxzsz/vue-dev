import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // 判断是否通过new操作符调用。
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用原型的_init方法，传入我们使用vue时new Vue所传的对象。
  this._init(options)
}

initMixin(Vue) // 在原型添加_init方法。
stateMixin(Vue) // 在原型上添加$data、$props属性，并将其代理到this._data、this._props上，在原型上添加了$set、$delete、$watch方法。
eventsMixin(Vue) // 在原型上添加了$on、$once、$off、$emit方法。
lifecycleMixin(Vue) // 在原型上添加了_update、$forceUpdate、$destroy方法。
renderMixin(Vue) // 在原型上添加了$nextTick、_render以及渲染时相关的方法。

export default Vue
