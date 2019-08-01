/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  // 定义get、set方法。
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  // 代理。
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props) // 初始化props。*****
  if (opts.methods) initMethods(vm, opts.methods) // 初始化methods。*
  if (opts.data) {
    initData(vm) // 初始化data。***
  } else {
    // 如果没有定义data，则把data设为空对象。
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed) // 初始化computed。***
  if (opts.watch && opts.watch !== nativeWatch) { //firefox 中Object.prototy上有一个watch函数。
    initWatch(vm, opts.watch) // 初始化watch。
  }
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key) // 把props的每个key存入keys数组。
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  // 如果data是函数则执行该函数获取data，否则直接获取data，没有则为空对象。
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // data中不能与props、methods中出现相同的key。
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) { // methods中存在这个key了。
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) { // props中存在这个key了。
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key) // 把vm.key的访问代理到vm._data.key,这就使得可以直接使用this.key访问data。
    }
  }
  // observe data
  // 调用observe对数据添加getter/setter。
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    // 执行data函数获取data对象。
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true } // 创建计算属性Watcher时传入的标志。

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // computed可以是一个函数也可以是对象，如果是对象则要获取get函数。
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 没有这个函数则报错。
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建Watcher对象，保存在watchers[key]中，这里由于是计算属性的Watcher，所以会添加computedWatcherOptions配置，有lazy：true标志。
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef) // 把计算属性定义到vm实例上。
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) { // computed 的值不能在data中存在。
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) { // computed 的值不能在props中存在。
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() // 非服务端渲染时均未true。
  if (typeof userDef === 'function') {// computed是函数的情况。
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key) // get函数为createComputedGetter(key)返回的另一个函数，这个函数将在访问到这个计算属性时触发。
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop // set为空函数。
  } else {
    // computed是如下这种写法时走这里。
    // computed: {get() {}, cache: }。
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false // 需要判断没有在computed配置cache: false
        ? createComputedGetter(key) // 与前面分支处理一样。
        : createGetterInvoker(userDef.get) // 设置cache: false时走这个分支。
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
        // 如果没有手动给计算属性写set函数，则对其set将报此错误。
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 把这个计算属性定义到vm实例上。
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 此函数返回的函数是计算属性的get函数，一旦访问到某个计算属性，就会调用这个函数。
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 如果computed中设置了cache：false，则设置此处返回的函数为其getter函数。
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') { // methods不是函数报错。
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) { // props 存在该key。
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) { // Vue实例中存在这个方法名。
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 不是function则设置为空函数，否则使用bind绑定到vm实例上，可通过this.xx访问方法。
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化watch，watch合并后示例： 
// watch: {
//   a: [function() {}, {handle: function() {}}, 'handle1','handle2']
// }
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    // 拿到watch的值，对其调用createWatcher方法。
    const handler = watch[key]
    if (Array.isArray(handler)) {
      // 对于上面这种watch写法，会遍历数组对每个值都调用createWatcher。
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 对象写法需要从对象中取出handle函数。
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 如果是string，则是当前实例methods中的方法，直接从vm中拿该函数。
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // watch的最终处理也是调用$watch方法。
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // $watch方法的实现。
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 我们写$watch可以写成vm.$watch('a', function() {}), 也可以写成vm.$watch('a', {handle: function() {}})
    // 如果是对象，需要调用createWatcher方法取出handle函数，保证这里的cb是函数。
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    // $watch 可以写配置：vm.$watch('a', function() {}, {deep: true, immediate: true}),如果没写，则设为{user: true}。
    options = options || {}
    options.user = true
    // 创建watcher对象。
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 如果配置了immediate: true，则在做完监听后立即调用一次回调函数。
    if (options.immediate) {
      try {
        // 调用回调函数，传入的值为刚刚在求完的值。
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 最后返回一个函数，调用返回的函数即可取消对其监听。
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
