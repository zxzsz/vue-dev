/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value // __ob__对象中存入data。
    this.dep = new Dep() // 用于收集依赖，dep对象有一个id属性，一个subs数组。
    this.vmCount = 0
    def(value, '__ob__', this) // 把当前new的对象定义到data.__ob__属性上。
    if (Array.isArray(value)) { // 数组数据的处理。
      if (hasProto) { // 判断对象是否有__proto__属性。
        protoAugment(value, arrayMethods) // 如果是数组数据，则把重写的7个数组变异方法添加到__proto__属性上。
      } else {
        copyAugment(value, arrayMethods, arrayKeys) // 如果不支持__proto__属性，则使用Object.defineProperty添加。
      }
      this.observeArray(value) // 对数组的每一项再调用observe方法。
    } else {
      this.walk(value) // walk方法对data中的每一项调用defineReactive方法，为对象添加setter/getter。
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 对data的每一项调用difineReactive方法添加getter/setter。
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 如果data中有数组数据，则对数组中的每一项再次调用observe方法。
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果不是对象类型的值，则直接return，不需要设置响应式。
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 判断data中是否已经存在__ob__属性，若存在则说明已经是响应式数据了。直接返回__ob__属性。
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve && // shouldObserve属性用来控制是否进行observe操作，如果不想对某个对象做observe，则只需要调用toggleObserve方法把shouldObserve设置为false。
    !isServerRendering() && // 非服务端渲染相关。
    (Array.isArray(value) || isPlainObject(value)) && // 对象或数组数据。
    Object.isExtensible(value) &&
    !value._isVue // 不是Vue实例。
  ) {
    ob = new Observer(value) // ob为Observer类的对象，传入data。
  }
  // 如果这个data是一个根data则说明又定义了一个实例，ob.vmCount++。
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep() // 每个对象类型的data都通过闭包引用这个dep对象。

  // 如果一个对象的configurable为false，则直接return。
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 如果某个data原本就是用getter取值，需要先拿到该getter。
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key] // data本身没getter则直接赋值给val。
  }
  
  // !shallow表示对深层次的数据也需要做响应式，对每个属性再递归调用ovserve方法。
  let childOb = !shallow && observe(val)
  // 给data的每个属性定义get/set方法，至此该方法结束，get、set方法需要在获取对象值与设置对象值时触发。
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 当访问到某个数据时，触发此处get函数。
    get: function reactiveGetter () {
      // 获取值，因为有可能数据本身就有getter函数，所有这里需要判断是否有getter，有则通过getter函数获取值。
      const value = getter ? getter.call(obj) : val
      // 在new Watcher时会把正在求值的watcher放到Dep.target中。
      if (Dep.target) {
        // 当前属性通过闭包引用的dep调用depend方法。
        dep.depend()
        if (childOb) {
          // 对深层次的数据继续做依赖收集。
          childOb.dep.depend()
          if (Array.isArray(value)) { // 如果是数组则对每一项调用dep.depend.
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
