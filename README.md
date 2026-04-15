# 🚀 MicroVue 7.3 — Stable Release

MicroVue is a lightweight, directive-first reactive JavaScript framework inspired by Vue, designed for **performance, simplicity, and flexibility**.

It delivers modern reactive UI capabilities with a minimal footprint—perfect for developers who want control without heavy abstractions.

---

## ✨ Features

- ⚛️ Reactive state system (Proxy + Reflect)
- 🧩 Directive-first architecture (`v-model`, `v-if`, `v-for`, etc.)
- 🔁 Lifecycle hooks (`mounted`, `updated`, `unmounted`)
- 🧱 Component system (props + slots)
- ⚡ Optimized scheduler (batched updates)
- 🔌 Custom directive API
- 🛡️ Secure expression sandbox
- 🎯 Custom prefix support (`v-`, `uk-`, etc.)
- 🧹 Automatic cleanup (events, effects, observers)

---

## 📦 Installation

### CDN

```html
<script src="microvue-7.3.js"></script>
```

## 🚀 Quick Start
```html
<div v-scope="{ count: 0 }">
  <button @click="count++">Increment</button>
  <p>{{ count }}</p>
</div>

<script>
  MicroVue.createApp().mount();
</script>
```

## ⚛️ Reactivity Example
```html
<div v-scope="{ name: 'John' }">
  <input v-model="name">
  <p>Hello {{ name }}</p>
</div>
```

## 🧩 Built-in Directives
```html
v-model
<input v-model="name">

v-if / v-else
<div v-if="isAdmin">Admin</div>
<div v-else>User</div>

v-for
<li v-for="item in list" :key="item.id">
  {{ item.name }}
</li>

v-bind
<img :src="imageUrl">

v-on
<button @click="submit()">Submit</button>
```

##🔌 Custom Directive
```js
const app = MicroVue.createApp();

app.directive("focus", {
  mounted(el) {
    el.focus();
  }
});

app.mount();
```
```html
<input v-focus>
```

## 🔁 Lifecycle Hooks
```js
const app = MicroVue.createApp();

app.onMounted((el, state) => {
  console.log("Mounted:", el);
});

app.onUpdated(() => {
  console.log("Updated");
});

app.onUnmounted((el) => {
  console.log("Destroyed:", el);
});

app.mount();
```

## 🧱 Component Example
```js
MicroVue.component("counter", () => ({
  state: {
    count: 0
  },

  template: `
    <div>
      <button @click="count++">+</button>
      {{ count }}
    </div>
  `,

  mounted() {
    console.log("Component mounted");
  }
}));
```
```html
<counter></counter>
```

## 🧩 Props
```html
<user-card :name="username"></user-card>
```
```js
MicroVue.component("user-card", () => ({
  template: `<div>{{ props.name }}</div>`
}));
```
## 🧩 Slots
```html
<card>
  <p>Hello Slot</p>
</card>
```
```js
MicroVue.component("card", () => ({
  template: `
    <div class="card">
      <slot></slot>
    </div>
  `
}));
```

## 🔄 Pipes (Filters)
```js
MicroVue.pipe("upper", v => v.toUpperCase());
```
```html
<p>{{ name | upper }}</p>
```


---

## 🔥 Compound Example (Real App)

A complete example combining state, directives, components, and reactivity.

### ✅ Features used:
- `v-model`
- `v-if`
- `v-for`
- computed
- events
- component
- custom directive

---

### 🧩 App Code

```html
<div v-scope="app">

  <h2>📝 Todo App</h2>

  <!-- Input -->
  <input v-model="newTodo" placeholder="Add todo">
  <button @click="addTodo()">Add</button>

  <!-- Toggle -->
  <button @click="show = !show">
    {{ show ? 'Hide' : 'Show' }} List
  </button>

  <!-- List -->
  <ul v-if="show">
    <li v-for="(todo, i) in todos" :key="i">

      <input type="checkbox" v-model="todo.done">

      <span :style="todo.done ? 'text-decoration: line-through' : ''">
        {{ todo.text }}
      </span>

      <button @click="remove(i)">❌</button>

    </li>
  </ul>

  <!-- Computed -->
  <p>Total: {{ total }}</p>
  <p>Completed: {{ completed }}</p>

  <!-- Component -->
  <counter-box></counter-box>

</div>

<script>
const app = MicroVue.createApp();

// ✅ Custom Directive
app.directive("focus", {
  mounted(el) {
    el.focus();
  }
});

// ✅ Component
MicroVue.component("counter-box", () => ({
  state: { count: 0 },

  template: `
    <div>
      <h3>Counter Component</h3>
      <button @click="count++">+</button>
      {{ count }}
    </div>
  `
}));

// ✅ App State
const state = {
  newTodo: "",
  show: true,
  todos: [
    { text: "Learn MicroVue", done: false }
  ],

  get total() {
    return this.todos.length;
  },

  get completed() {
    return this.todos.filter(t => t.done).length;
  },

  addTodo() {
    if (!this.newTodo) return;

    this.todos.push({
      text: this.newTodo,
      done: false
    });

    this.newTodo = "";
  },

  remove(i) {
    this.todos.splice(i, 1);
  }
};

document.querySelector('[v-scope]').setAttribute("v-scope", "state");

app.mount();
</script>
```

## ⚙️ Configuration
```js
MicroVue.createApp({
  prefix: "uk-"
}).mount();
```
```html
<input uk-model="name">
<div uk-show="isVisible"></div>
```

## 🛡️ Security

MicroVue includes:
- Expression sandboxing
- Unsafe keyword blocking
- HTML sanitization (v-html)

## 🧹 Cleanup System

MicroVue automatically handles:

- Event listeners
- Reactive effects
- Directive cleanup
- Observers


## 🏁 Status

- Version: 7.3
- Channel: Stable
- Status: Production Ready

## 🎯 Philosophy
**Build powerful reactive apps with minimal complexity.**

MicroVue focuses on:
- Simplicity over abstraction
- Performance over overhead
- Flexibility over rigidity

## 📄 License
MIT License

## ❤️ Contributing
- Contributions are welcome!
- Feel free to open issues or submit pull requests.

## ⭐ Support

If you like MicroVue, consider giving it a ⭐ on GitHub!

