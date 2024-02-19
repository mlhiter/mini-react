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

  const isProperty = (key) => key !== 'children'
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name]
    })

  return dom
}

function render(element, container) {}

// 下一个单元的工作
let nextUnitOfWork = null

function workLoop(deadline) {
  // 是否应该停止
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// 执行工作并且返回下一个工作单元
function performUnitOfWork(unitOfWork) {
  // TODO
}

const React = {
  createElement,
  render,
}

/**@jsx React.createElement */
const element = (
  <div id="foo">
    <a>Hello World!</a>
    <b />
  </div>
)

const container = document.getElementById('root')
React.render(element, container)
