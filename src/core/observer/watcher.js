/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      // 渲染Watcher保存在vm._watcher中。
      vm._watcher = this
    }
    // 把每个Watcher都保存在vm._watchers数组中。
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy // 计算属性专属标志，如果是计算属性，则此处为true。
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn // 把监听的表达式保存在this.getter中。
    } else {
      // 我们写$watch监听的表达式可以写成函数,也可以写成'a'或者'a.b.c'这样的形式。
      // 对于第二种情况，需要对他做解析也转化成函数。
      this.getter = parsePath(expOrFn)
      if (!this.getter) { // 如果表达式获取不到，则保错。
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 在new Watcher 时会根据lazy标志决定是否立即对表达式求值，在计算属性new Watcher时会带有lazy。
    this.value = this.lazy
      ? undefined
      : this.get() // 这里根据lazy标志决定是否求值，如果有lazy标志，则value为undefined，如果没有lazy，则立即调用get求值。
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // 对监听的表达式求值的过程。
  get () {
    // pushTarget把当前正在求值的那个watcher放到一个static 属性中，这样没访问到一个数据就能访问到该watcher进行依赖收集。
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 这里调用this.getter就是new Watcher时监听的表达式，在执行的过程中就会访问到依赖的属性。
      // 如： 假设监听的表达式是：function() {return this.a + this.b}
      // 执行这个表达式的过程中，肯定要访问到this.a和this.b,这一访问，即触发了之前initData时对这个属性设置的getter方法。
      // 这里将跳到表达式中所依赖属性的getter。
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      // 当前watcher依赖收集完毕，从target中抛出当前watcher。
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 通过id避免重复收集依赖。
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 把当前这个watcher存入到dep中。
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

// 响应式步骤：从触发数据get开始。
// 1.每个属性通过闭包引用一个Dep类的对象dep，触发get方法，调用dep.depend。
// 2.在dep.depend中又调用当前正在求值的watcher的addDep方法，并把this传入，this就是当前这个dep对象。
// 3.在addDep中首先会把这个dep对象和他的id保存到当前这个watcher的newDeps和newDepIds中，再调用dep.addSub。把当前这个watcher传入。
// 4.在dep.addSub中，把传入的watcher保存到自身的subs数组中，完成依赖收集。
