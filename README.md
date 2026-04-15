## MicroVue 7.3 — Stable Release

MicroVue is a lightweight, directive-first reactive JavaScript framework inspired by Vue, designed for high performance, simplicity, and flexibility.

It provides a powerful reactive core, a clean directive system, and a minimal API surface—making it ideal for modern web applications without the overhead of large frameworks.

### ✨ Features

- ⚛️ Reactive state system (Proxy + Reflect)
- 🧩 Directive-first architecture (v-model, v-if, v-for, etc.)
- 🔁 Lifecycle hooks (mounted, updated, unmounted)
- 🧱 Component system with props & slots
- ⚡ Optimized scheduler (batched updates)
- 🔌 Custom directive API
- 🛡️ Secure expression sandbox
- 🎯 Custom prefix support (v-, uk-, etc.)
- 🧹 Automatic cleanup (events, effects, observers)

### 🚀 Example

```html
<div v-scope="{ count: 0 }">
  <button @click="count++">+</button>
  <p>{{ count }}</p>
</div>

<script>
  MicroVue.createApp().mount();
</script>
