### Tutorial

This is a tutorial to build a mini-react.

Learn from this website.[build-your-own-react](https://pomb.us/build-your-own-react/)

The following is a flat structure, it is recommended to read the linear structure in the tutorial.

The following is just reference.

### Principle

#### 1，JSX

react使用jsx描述界面。

jsx的形式：return后面的html代码，其实就是js里的html

```js
function Counter() {
  const [state, setState] = React.useState(1)
  return <h1 onClick={() => setState((c) => c + 1)}>Count: {state}</h1>
}
```

浏览器不认识jsx，所以我们需要转换jsx成为浏览器认识的样子。

通过babel可以将jsx转换为我们想要的东西。比如react是将jsx转换为createElement函数调用形成的树。

```jsx
const element =  <h1 data>hello world!</h1>
//transform by babel
const element = React.createElement("h1",null,'Hello world!')
```

默认Babel将jsx转换为react的createElement，也可以自己自定义函数。

比如我项目代码里：这个注释的意思就是告诉babel转换为**我自己定义的**React.createElement

```jsx
/**@jsx React.createElement */
function Counter() {
  const [state, setState] = React.useState(1)
  return <h1 onClick={() => setState((c) => c + 1)}>Count: {state}</h1>
}
```

转换为函数调用之后，通过React.render()将其转换为真实DOM元素。

#### 2，API

项目里就设计了三个react的API：createElement用于babel转换jsx；render渲染真实DOM；useState是React Hooks的一个例子。

##### 2.1 createElement

**作用**：提供给babel的一个工具函数，告诉babel应该转换成为什么样子。

这里项目逻辑是将children放入props里并对文本child进行标记。

```jsx
// @param {string} type -元素的类型，例如p，div
// @param {Object} props -要传递给元素的属性对象，例如id，className
// @param ...children 任意数量子元素，null/undefined/false，string，calling of React.createElement
function createElement(type,props,...children){
  return xxx
}
```

##### 2.2 render

**作用**：calling of React.createElement 转换为真实DOM

```jsx
// @param {ReactElement} element -要挂载的react元素
// @param {HTMLElement} container -将element挂载到的父元素
function render(element,container){
}
```

##### 2.3 useState

**作用**：基本hook一个

```jsx
// @param initial -初始值
// @return useState,setState
function useState(initial){
  return [state,setState]
}
```

#### 3，React特性（难点）

##### 3.1 并发模式

**背景：**

在常规思路下我们在render函数里会递归调用子元素的render渲染。一旦我们开始渲染，递归不会停止直到渲染出完整的元素树。如果元素树很大就会阻塞主线程导致浏览器无法执行优先级更高的行为（比如用户输入或者流畅的动画），他们必须等待渲染完成之后才能进行。

**使用技术：**

项目里使用：[requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback)，这个函数会在浏览器主线程空闲时期被调用。具体参考代码和MDN，比较简单的一个函数。

React现在实际使用：react之前使用requestIdleCallback，后来改为使用专门的调度包。

**基本流程：**

```jsx
function workLoop(deadline) {
  let shouldYield = false // 是否应该停止

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1 //预估剩余时间少于1ms，几乎可以断定只剩最后一次
  }

  // 当没有下一个工作单元并且存在工作根时提交结果，否则继续执行
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}
```

##### 3.2 Fiber

**背景：**

当我们处于并发模式时，我们通过工作单元的方式进行。之前常规做法我们使用循环不需要考虑执行顺序，但是这时我们就需要考虑工作单元的执行顺序，此时我们就需要数据结构发挥作用了。

**数据结构：Fiber Tree**

每个element配备一个fiber，每个fiber都会是一个工作单元。

在**performUnitOfWork**过程中，我们的每个工作单元的任务有三件事：

1. 将元素添加到DOM
2. 为元素的子元素创建fiber
3. 选择下一个工作单元
   1. 如果有child，选择第一个child
   2. 如果没有child，选择第一个sibling
   3. 如果没有child也没有sibling，选择第一个叔叔（parent的第一个sibling），没有则向上继续查找叔叔
   4. 如果查找到根，render所有工作完成

```jsx
//fiber structure
interface Fiber{
  type:string //element.type
  props:string //element.props
  parent?:Fiber //parent fiber
  child?:Fiber //child fiber
  sibling?:Fiber //sibling fiber(next one)
  dom?: HTMLElement //dom tree,function component fiber donnot have dom
  alternate:Fiber // previous fiber
  effectTag:"UPDATE"||"PLACEMENT"||"DELETION" //tag
}
```

##### 3.3 Function Components

**与DOM不同之处：**

- fiber来自function component而不是DOM node,简单的理解就是外面包了一层没有dom的fiber
- children来自运行该函数而不是来自静态props

```jsx
function updateFunctionComponent(fiber) {
  const children = [fiber.type(fiber.props)] //type为函数组件这个函数
  reconcileChildren(fiber, children)
}
```

之后还需要在commitWork函数里处理找不到DOM的情况

- 当前找不到DOM则向上找
- 删除时找不到DOM则向下找

##### 3.4 Hooks

```jsx
// React Hooks: useState
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = { state: oldHook ? oldHook.state : initial, queue: [] }

  // 上一个render里定义的操作在当前render执行
  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })

  // 点击之后就会触发监视器循环的继续进行进而rerender
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
```













