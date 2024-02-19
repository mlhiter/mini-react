function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createDom(fiber) {
  const dom =
    fiber.type == 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)

  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name]
    })

  return dom
}

const isEvent = (key) => key.startsWith('on') //事件侦听器
const isProperty = (key) => key !== 'children' && !isEvent(key) //属性
const isNew = (prev, next) => (key) => prev[key] !== next[key]
const isGone = (prev, next) => (key) => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })
  // TODO Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = ''
    })

  // TODO Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // TODO Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

function commitRoot() {
  // TODO add node to dom
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) return

  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, //上一个fiber的链接
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

// 下一个单元的工作
let nextUnitOfWork = null
// 正在工作中的根,用来标记正在工作中的根，之后用作提交，目的是为了防止逻辑中断后丢失根的问题
let wipRoot = null
// 当前根：我们提交给dom的最后一个fiber树
let currentRoot = null
// 我们想要删除的节点
let deletions = null

function workLoop(deadline) {
  // 是否应该停止
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// 执行工作并且返回下一个工作单元
function performUnitOfWork(fiber) {
  // TODO check if it is a function component
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // TODO return next unit of work
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

let wipFiber = null
let hookIndex = null

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// React Hooks: useState
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = { state: oldHook ? oldHook.state : initial, queue: [] }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })

  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++

  return [hook.state, setState]
}

function updateHostComponent(fiber) {
  // TODO add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  // TODO create new fibers
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)
}

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null
    // TODO compare oldFiber to element

    const sameType = oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      // TODO update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE', //将在提交阶段使用
      }
    }

    if (element && !sameType) {
      // TODO add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT', //将在提交阶段使用
      }
    }

    if (oldFiber && !sameType) {
      // TODO delete the oldFiber's node
      oldFiber.effectTag = 'DELETION' //将在提交阶段使用
      deletions.push(oldFiber)
    }

    // 第一个子项设置为子项，其余项设置为兄弟项
    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
    prevSibling = newFiber
    index++
  }
}

const React = {
  createElement,
  render,
  useState,
}

/**@jsx React.createElement */
function Counter() {
  const [state, setState] = React.useState(1)
  return <h1 onClick={() => setState((c) => c + 1)}>Count: {state}</h1>
}

// Function component 的fiber没有dom节点，并且children来自运行function而不是直接来自props

const element = <Counter />
const container = document.getElementById('root')
React.render(element, container)
