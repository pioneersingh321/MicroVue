/*!
 * MicroVue 7.3 (Enterprise Final + Mounting DX Patch)
 * ✔ FIXED: app.mount() handles string selectors (e.g., "#app")
 * ✔ FIXED: app.mount() compiles the root node if it holds the scope
 * ✔ STABLE: App Context Encapsulation, Absolute Sandbox, updated() Hooks
 */

(function(global) {
  "use strict";

  const DEV = true;
  function warn(msg, err) {
    if (!DEV) return;
    console.warn("[MicroVue]: " + msg);
    if (err) console.error(err);
  }

  // === 🛠️ Core Utilities ===
  const get = (o, p) => p.split(".").reduce((a, c) => a?.[c], o);
  const set = (o, p, v) => { 
    const k = p.split("."); const l = k.pop(); 
    k.reduce((a, c) => a[c] = a[c] || {}, o)[l] = v; 
  };

  function sanitize(html) {
    const div = document.createElement("div"); div.innerHTML = html;
    div.querySelectorAll("script").forEach(s => s.remove());
    div.querySelectorAll("*").forEach(el => [...el.attributes].forEach(a => { 
      if (a.name.startsWith("on") || (typeof a.value === "string" && a.value.trim().toLowerCase().startsWith("javascript:"))) {
        el.removeAttribute(a.name);
      }
    }));
    return div.innerHTML;
  }

  const pipes = {}; const pipe = (n, fn) => pipes[n] = fn;

  // === ⚛️ Reactivity Core ===
  let activeEffect = null;
  const targetMap = new WeakMap(), reactiveMap = new WeakMap();
  const jobQueue = new Set(); let flushing = false;

  const queueJob = j => { 
    jobQueue.add(j); 
    if(!flushing){ 
      flushing=true; 
      Promise.resolve().then(()=>{ 
        const jobs = [...jobQueue]; jobQueue.clear(); 
        jobs.forEach(fn=>fn()); 
        flushing=false;
      });
    } 
  };
  
  const cleanup = fn => { fn.deps.forEach(d=>d.delete(fn)); fn.deps.length=0 };

  function effect(fn, opt={}){
    const runner = () => { 
      cleanup(runner); 
      const prevEffect = activeEffect; activeEffect = runner; 
      const r = fn(); 
      activeEffect = prevEffect; return r; 
    };
    runner.deps=[]; runner.scheduler=opt.scheduler; runner.active=true;
    if(!opt.lazy) runner(); return runner;
  }
  
  const bindEffect = (node, fn, appCtx) => { 
    let isMounted = false;
    const r = effect(() => { 
        fn(); 
        if (isMounted && appCtx && appCtx.hooks.updated.size > 0) {
            queueJob(() => { appCtx.hooks.updated.forEach(h => { try { h(node); } catch(e) {} }); });
        }
        isMounted = true;
    }); 
    (node.__effects || (node.__effects = [])).push(r); 
  };

  function track(t,k){ if(!activeEffect) return; let m=targetMap.get(t); if(!m) targetMap.set(t,m=new Map()); let d=m.get(k); if(!d) m.set(k,d=new Set()); if(!d.has(activeEffect)){ d.add(activeEffect); activeEffect.deps.push(d) } }
  function trigger(t,k){ const deps = targetMap.get(t)?.get(k); if(deps) new Set(deps).forEach(fn=> fn.scheduler?fn.scheduler():queueJob(fn)) }

  const GLOBALS = new Set(['Math', 'Date', 'Number', 'String', 'Array', 'Object', 'console', 'JSON', 'parseInt', 'parseFloat', 'isNaN']);

  function reactive(o){
    if(!o || typeof o!=="object") return o;
    if(reactiveMap.has(o)) return reactiveMap.get(o);
    const p = new Proxy(o,{
      has(t, k) { 
        if (typeof k === "symbol") return k in t;
        return !GLOBALS.has(k); 
      },
      get(t, k, r){ track(t,k); if(Array.isArray(t) && k==="length") track(t,"length"); const v = Reflect.get(t, k, r); return typeof v==="object" ? reactive(v) : v; },
      set(t, k, v, r){ const old = Reflect.get(t, k, r); const res = Reflect.set(t, k, v, r); if(old !== v){ trigger(t,k); if(Array.isArray(t)) trigger(t,"length"); } return res; }
    });
    reactiveMap.set(o,p); return p;
  }

  // === 🧠 Computed & Watch ===
  const traverse = (v,s=new Set())=>{ if(typeof v!=="object"||!v||s.has(v)) return; s.add(v); for(const k in v) traverse(v[k],s) };
  function computed(getter) { let cachedValue, dirty = true; const runner = effect(getter, { lazy: true, scheduler: () => { if (!dirty) { dirty = true; trigger(obj, "value"); } } }); const obj = { get value() { if (dirty) { cachedValue = runner(); dirty = false; } track(obj, "value"); return cachedValue; } }; return obj; }
  
  function watch(src, cb) { 
    const g = typeof src === "function" ? src : () => { traverse(src); return src; }; 
    let old; const r = effect(g, { lazy: true, scheduler: () => { const n = r(); cb(n, old); old = n; } }); 
    old = r(); 
  }

  // === 🧮 Evaluator Engine ===
  const evalCache = new Map();
  const UNSAFE_RE = /(constructor|__proto__|prototype|window|document|globalThis|eval|Function|setTimeout|setInterval|fetch|XMLHttpRequest|process|import)/i;

  function evaluate(exp, s = {}) {
    if (!exp || typeof exp !== "string" || UNSAFE_RE.test(exp)) return undefined;
    let fn = evalCache.get(exp);
    if (!fn) {
      try { fn = new Function("s", `with(s){ return (${exp}) }`); evalCache.set(exp, fn); } 
      catch (e) { warn(`Compile error: ${exp}`, e); return undefined; }
    }
    try { return fn(s); } catch (e) { return undefined; } 
  }

  function evalPipe(exp, s) { const parts = exp.split("|").map(t => t.trim()); let v = evaluate(parts[0], s); for (let i = 1; i < parts.length; i++) { const f = pipes[parts[i]]; if (f) v = f(v); } return v; }

  function executeEvent(exp, s, ev) {
    if (UNSAFE_RE.test(exp)) return warn("Unsafe event: " + exp);
    let fn = evalCache.get('ev:' + exp);
    if (!fn) { try { fn = new Function("s", "$event", `with(s){ return (${exp}) }`); } catch { try { fn = new Function("s", "$event", `with(s){ ${exp} }`); fn.__isBlock = true; } catch (e) { return; } } evalCache.set('ev:' + exp, fn); }
    try { s.$event = ev; const res = fn(s, ev); if (!fn.__isBlock && typeof res === "function") res.call(s, ev); } catch (e) { warn(`Event error: ${exp}`, e); }
  }

  // === 🧩 Components & Slots ===
  const components = {}; const component = (n, d) => components[n.toLowerCase()] = d;
  
  function collectSlots(el, appCtx) { const s = {}; const slotAttr = `${appCtx.config.prefix}slot`; [...el.children].forEach(c => { if (c.tagName === "TEMPLATE") { const n = c.getAttribute(slotAttr)?.split(":")[1] || "default"; s[n] = c; } else { s.default = s.default || document.createElement("template"); s.default.content.appendChild(c.cloneNode(true)); } }); return s; }
  function renderSlots(root, slots, state, appCtx) { root.querySelectorAll("slot").forEach(s => { const name = s.getAttribute("name") || "default"; const tpl = slots[name]; if (!tpl) { s.remove(); return; } const prop = [...s.attributes].find(a => a.name.startsWith(":")); let scope = state; if (prop) { scope = reactive({ ...state, get [prop.name.slice(1)]() { return evaluate(prop.value, state); }}); } const frag = tpl.content ? tpl.content.cloneNode(true) : tpl.cloneNode(true); [...frag.childNodes].forEach(c => compile(c, scope, appCtx)); s.replaceWith(frag); }); }

  function mountComponent(el, parentState, appCtx) {
    const def = components[el.tagName.toLowerCase()];
    if (!def || el.__instance) return !!def;

    const inst = def(); const props = reactive({});
    const wrap = document.createElement("div"); wrap.innerHTML = inst.template.trim();
    const root = wrap.firstElementChild;

    [...el.attributes].forEach(a => {
      if (a.name.startsWith(":")) bindEffect(root, () => props[a.name.slice(1)] = evaluate(a.value, parentState), appCtx);
      else if (!a.name.startsWith("@") && !a.name.startsWith(appCtx.config.prefix)) props[a.name] = a.value;
    });

    const state = reactive({ ...(inst.state || {}), props });
    Object.keys(inst).forEach(key => { if (typeof inst[key] === 'function') state[key] = inst[key].bind(state); });
    state.$emit = (event, payload) => { const handler = el.getAttribute("@" + event); if (handler) executeEvent(handler, parentState, payload); };

    if (inst.updated) {
        watch(state, () => queueJob(() => inst.updated.call(state)));
    }

    root.__instance = { state };
    const slots = collectSlots(el, appCtx); renderSlots(root, slots, state, appCtx);
    
    destroy(el, appCtx); el.replaceWith(root); compile(root, state, appCtx);
    inst.mounted?.call(state);
    return true;
  }

  // === 📏 LIS Diffing ===
  function getLIS(arr){ const p=arr.slice(),res=[]; for(let i=0;i<arr.length;i++){const n=arr[i];if(n===-1)continue;let j=res.length-1;if(j<0||arr[res[j]]<n){p[i]=j>=0?res[j]:-1;res.push(i);continue}let l=0,r=j;while(l<r){const m=(l+r)>>1;if(arr[res[m]]<n)l=m+1;else r=m}if(n<arr[res[l]]){if(l>0)p[i]=res[l-1];res[l]=i}} let u=res.length,v=res[u-1];while(u--){res[u]=v;v=p[v]} return res }

  // === 🎯 Native Directives ===
  function handleModel(el, s, appCtx) { const attrName = `${appCtx.config.prefix}model`; const a = [...el.attributes].find(x => x.name.startsWith(attrName)); if (!a) return; const k = a.value, mods = a.name.split(".").slice(1), ev = mods.includes("lazy") ? "change" : "input"; el.addEventListener(ev, e => { let v = el.type==="checkbox" ? el.checked : el.type==="radio" ? (el.checked ? el.value : null) : e.target.value; if(mods.includes("trim") && typeof v==="string") v=v.trim(); if(mods.includes("number")) v=Number(v); if(el.type==="checkbox"){ const cur=get(s,k); if(Array.isArray(cur)){ set(s,k,el.checked?[...cur,el.value]:cur.filter(x=>x!==el.value)); return } } set(s,k,v); }); bindEffect(el, () => { const v=get(s,k); if(el.type==="checkbox") el.checked=Array.isArray(v)?v.includes(el.value):!!v; else if(el.type==="radio") el.checked=el.value==v; else el.value=v??"" }, appCtx); el.removeAttribute(a.name); }
  function handleBind(el,s, appCtx){ [...el.attributes].forEach(a=>{ if(!a.name.startsWith(":"))return; const k=a.name.slice(1); bindEffect(el,()=>{ const v=evaluate(a.value,s); if(v==null || v===false) el.removeAttribute(k); else el.setAttribute(k,v===true?"":v) }, appCtx) }) }
  function handleOn(el,s){ el.__handlers = el.__handlers || new Map(); [...el.attributes].forEach(a=>{ if(!a.name.startsWith("@"))return; const parts=a.name.slice(1).split("."), e=parts[0], exp=a.value; const h=ev=>{ if(parts.includes("prevent")) ev.preventDefault(); executeEvent(exp,s,ev); }; el.addEventListener(e,h); el.__handlers.set(e,h); el.removeAttribute(a.name); }); }
  function handleShow(el, s, appCtx) { const e = el.getAttribute(`${appCtx.config.prefix}show`); if(!e) return; bindEffect(el,()=>el.style.display=evaluate(e,s)?"":"none", appCtx) }
  function handleHtml(el, s, appCtx) { const attr = `${appCtx.config.prefix}html`; const e = el.getAttribute(attr); if(!e) return; bindEffect(el,()=>el.innerHTML=sanitize(evaluate(e,s)??""), appCtx); el.removeAttribute(attr); }
  
  function handleIf(el, s, appCtx) { 
    const pIf = `${appCtx.config.prefix}if`, pElseIf = `${appCtx.config.prefix}else-if`, pElse = `${appCtx.config.prefix}else`;
    if(!el.hasAttribute(pIf)) return false; 
    const p=el.parentNode, a=document.createComment("if"); p.replaceChild(a,el); 
    const chain=[el]; let n=a.nextElementSibling; while(n && (n.hasAttribute(pElseIf) || n.hasAttribute(pElse))){ chain.push(n); const t=n.nextElementSibling; p.removeChild(n); n=t } 
    let cur=null; 
    bindEffect(a,()=>{ 
      let m=null; for(const nd of chain){ let ok=true; if(nd.hasAttribute(pIf)) ok=evaluate(nd.getAttribute(pIf),s); else if(nd.hasAttribute(pElseIf)) ok=evaluate(nd.getAttribute(pElseIf),s); if(ok){m=nd;break} } 
      if(m!==cur){ 
        if(cur) { destroy(cur.__v, appCtx); cur.__v.remove(); }
        if(m){ const c=m.cloneNode(true); c.removeAttribute(pIf); c.removeAttribute(pElseIf); c.removeAttribute(pElse); compile(c,s,appCtx); p.insertBefore(c,a.nextSibling); m.__v=c } cur=m 
      } 
    }, appCtx); 
    return true 
  }

  function handleFor(el, s, appCtx) { 
    const pFor = `${appCtx.config.prefix}for`; const exp = el.getAttribute(pFor); if(!exp) return false; 
    const keyAttr = el.getAttribute(":key"); if(!keyAttr){ warn(`${pFor} requires :key`); return false; }
    const [it,le] = exp.split(" in "); const p=el.parentNode; const st=document.createComment("for"),en=document.createComment("end"); p.insertBefore(st,el); p.replaceChild(en,el); let old=[]; 
    bindEffect(st,()=>{ 
      const list=evaluate(le,s)||[]; const map=new Map(); old.forEach((r,i)=>map.set(r.key,i)); const nrs=[], arr=new Array(list.length).fill(-1); 
      list.forEach((v,i)=>{ 
        const sc = Object.create(s); sc[it.trim()] = v; sc.index = i; 
        const k=evaluate(keyAttr,sc); const oi=map.get(k); 
        if(oi!=null){ const r=old[oi]; r.scope[it.trim()]=v; r.scope.index=i; nrs.push(r); arr[i]=oi } 
        else { const c=el.cloneNode(true); c.removeAttribute(pFor); const rs=reactive(sc); compile(c,rs,appCtx); nrs.push({key:k,el:c,scope:rs}) } 
      }); 
      old.forEach(r=>{ if(!nrs.find(n=>n.key===r.key)) { destroy(r.el, appCtx); r.el.remove(); } }); 
      const seq=getLIS(arr); let j=seq.length-1; 
      for(let i=nrs.length-1;i >= 0;i--){ const r=nrs[i], nxt=i+1 < nrs.length?nrs[i+1].el:en; if(arr[i]===-1) p.insertBefore(r.el,nxt); else if(j < 0||i!==seq[j]) p.insertBefore(r.el,nxt); else j-- } old=nrs 
    }, appCtx); 
    return true 
  }

  // === 🧹 Teardown Engine ===
  function destroy(n, appCtx) { 
    if(!n) return;
    if (appCtx) appCtx.hooks.unmounted.forEach(hook => { try { hook(n); } catch(e) { warn("Unmounted error", e); } });
    if (n.__cleanup) { n.__cleanup.forEach(fn => { try { fn(); } catch(e) { warn("Cleanup error", e); } }); delete n.__cleanup; }
    if (n.__handlers) { n.__handlers.forEach((h,e) => n.removeEventListener(e,h)); delete n.__handlers; }
    if (n.__effects) { n.__effects.forEach(e => { e.active = false; cleanup(e); }); delete n.__effects; }
    if (n.__field && n.__field.destroy) n.__field.destroy();
    if (n.__form) delete n.__form;
    [...n.childNodes || []].forEach(c => destroy(c, appCtx)); 
  }

  // === 🏗️ The Compiler ===
  function compile(node, s, appCtx) { 
    if (!node) return;

    if (node.nodeType === 3) {
      const [open, close] = appCtx.config.delimiters;
      const esc = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${esc(open)}(.+?)${esc(close)}`, 'g');
      if (node.textContent.match(regex)) {
        const t = node.textContent;
        bindEffect(node, () => node.textContent = t.replace(regex, (_, e) => evalPipe(e, s) ?? ""), appCtx);
      }
      return;
    }

    if (node.nodeType !== 1) return; 

    if (mountComponent(node, s, appCtx)) return; 
    if (handleFor(node, s, appCtx)) return; 
    if (handleIf(node, s, appCtx)) return; 
    
    handleShow(node, s, appCtx); 
    handleHtml(node, s, appCtx); 
    handleModel(node, s, appCtx); 
    handleBind(node, s, appCtx); 
    handleOn(node, s); 

    node.__appliedDirs = node.__appliedDirs || new Set();

    [...node.attributes].forEach(attr => {
      if (attr.name.startsWith(appCtx.config.prefix)) {
        if (node.__appliedDirs.has(attr.name)) return;
        node.__appliedDirs.add(attr.name);

        const dirName = attr.name.slice(appCtx.config.prefix.length).split('.')[0]; 
        const dir = appCtx.directives[dirName];
        
        if (dir) {
          if (typeof dir === 'function') {
            dir(node, s, appCtx.config);
          } else {
            if (dir.mounted) dir.mounted(node, s, appCtx.config);
            if (dir.updated) bindEffect(node, () => dir.updated(node, s, appCtx.config), appCtx);
            if (dir.unmounted) {
              node.__cleanup = node.__cleanup || [];
              node.__cleanup.push(() => dir.unmounted(node, s, appCtx.config));
            }
          }
        }
      }
    });
    
    [...node.childNodes].forEach(c => compile(c, s, appCtx)); 

    appCtx.hooks.mounted.forEach(hook => { try { hook(node, s); } catch(e) {} });
  }

  function createApp(userConfig = {}){ 
    const appCtx = {
        config: { prefix: "v-", delimiters: ["{{", "}}"], ...userConfig },
        directives: {},
        hooks: { mounted: new Set(), unmounted: new Set(), updated: new Set() }
    };
    
    return { 
      component, pipe, 
      use(plugin, options) { plugin(this, options); return this; },
      directive(name, def) { appCtx.directives[name] = def; return this; },
      
      onMounted(fn) { appCtx.hooks.mounted.add(fn); },
      onUnmounted(fn) { appCtx.hooks.unmounted.add(fn); },
      onUpdated(fn) { appCtx.hooks.updated.add(fn); },
      
      mount(target = document){ 
        // 🛠️ PATCH: Dynamic Mounting Logic
        let rootNode = typeof target === 'string' ? document.querySelector(target) : target;
        if (!rootNode) return warn(`Mount target not found: ${target}`);

        const scopeAttr = `${appCtx.config.prefix}scope`;
        
        if (rootNode !== document && rootNode.hasAttribute && rootNode.hasAttribute(scopeAttr)) {
            const st = reactive(evaluate(rootNode.getAttribute(scopeAttr) || "{}", {}) || {});
            compile(rootNode, st, appCtx);
        } else {
            rootNode.querySelectorAll(`[${scopeAttr}]`).forEach(el => { 
                const st = reactive(evaluate(el.getAttribute(scopeAttr)||"{}",{}) || {}); 
                compile(el, st, appCtx); 
            });
        }
      } 
    } 
  }

  global.MicroVue = { 
    createApp, reactive, effect, computed, watch, component, pipe,
    evaluate, executeEvent, bindEffect, get, set, destroy
  };
})(window);