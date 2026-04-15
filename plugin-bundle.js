/*
 * MicroVue Plugin Bundle (Selective Loader)
 * Version: 1.2.0
 */

(function(global){

  const VERSION = "1.2.0";
  const NAME = "MicroVuePlugins";

  const installed = new WeakSet();

  function resolveConfig(app, options = {}){
    return {
      prefix: options.prefix || app?.config?.prefix || 'v-'
    };
  }

  function attr(el, name, config){
    return el.getAttribute(config.prefix + name);
  }

  function has(el, name, config){
    return el.hasAttribute(config.prefix + name);
  }

  function findAttr(el, name, config){
    return [...el.attributes].find(a=>a.name.startsWith(config.prefix + name));
  }

  const pluginMap = {

    focus(app, config){
      app.use(function(el){
        if(has(el,"focus",config)){
          setTimeout(()=>el.focus(),0);
        }
      });
    },

    cloak(app, config){
      app.use(function(el){
        if(has(el,"cloak",config)){
          el.removeAttribute(config.prefix + "cloak");
        }
      });
    },

    text(app, config){
      app.use(function(el,state){
        const exp = attr(el,"text",config);
        if(!exp) return;

        MicroVue.bindEffect(el, ()=>{
          el.textContent = MicroVue.evaluate(exp,state) ?? "";
        });
      });
    },

    debounce(app, config){
      app.use(function(el,state){
        const attrNode = findAttr(el,"debounce",config);
        if(!attrNode) return;

        const delay = Number(attrNode.name.split(".")[1]) || 300;
        let timer;

        const modelAttr = findAttr(el,"model",config);
        if(!modelAttr) return;

        const key = modelAttr.value;

        el.addEventListener("input", e=>{
          clearTimeout(timer);
          timer = setTimeout(() => MicroVue.set(state, key, e.target.value), delay);
        });
      });
    },

    loading(app, config){
      app.use(function(el,state){
        const exp = attr(el,"loading",config);
        if(!exp) return;

        MicroVue.bindEffect(el, ()=>{
          const val = MicroVue.evaluate(exp,state);
          el.disabled = !!val;
          el.style.opacity = val ? "0.6" : "1";
        });
      });
    },

    clickOutside(app, config){
      app.use(function(el,state){
        const exp = attr(el,"click-outside",config);
        if(!exp) return;

        const handler = (e)=>{
          if(!el.contains(e.target)){
            MicroVue.executeEvent(exp,state,e);
          }
        };

        document.addEventListener("click", handler);

        el.__handlers = el.__handlers || new Map();
        el.__handlers.set("click-outside", handler);
      });
    },

    visible(app, config){
      app.use(function(el,state){
        const exp = attr(el,"visible",config);
        if(!exp) return;

        const observer = new IntersectionObserver(entries=>{
          if(entries[0].isIntersecting){
            MicroVue.executeEvent(exp,state);
          }
        });

        observer.observe(el);

        // ✅ store reference for cleanup
        el.__observer = observer;

        // ✅ auto cleanup when element removed from DOM
        MicroVue.bindEffect(el, ()=>{
          if(!document.contains(el)){
            try{ observer.disconnect(); }catch{}
          }
        });
      });
    },

    storage(app, config){
      app.use(function(el,state){
        const key = attr(el,"storage",config);
        if(!key) return;

        try{
          const saved = localStorage.getItem(key);
          if(saved) MicroVue.set(state, key, JSON.parse(saved));
        }catch{}

        MicroVue.bindEffect(el, ()=>{
          try{
            localStorage.setItem(key, JSON.stringify(MicroVue.get(state,key)));
          }catch{}
        });
      });
    },

    fade(app, config){
      app.use(function(el,state){
        const exp = attr(el,"fade",config);
        if(!exp) return;

        MicroVue.bindEffect(el, ()=>{
          const show = MicroVue.evaluate(exp,state);
          el.style.transition = "opacity 0.3s";
          el.style.opacity = show ? "1" : "0";
        });
      });
    }

  };

  const presets = {
    core: ["text", "cloak"],
    ui: ["focus", "loading", "fade"],
    full: Object.keys(pluginMap)
  };

  function MicroVuePlugins(app, selected = null, options = {}){

    if(installed.has(app)){
      console.warn(`[${NAME}] already installed on this app`);
      return;
    }

    installed.add(app);

    const config = resolveConfig(app, options);

    if(typeof selected === "string"){
      selected = presets[selected];
    }

    if(!selected){
      Object.entries(pluginMap).forEach(([_, fn])=> fn(app, config));
      return;
    }

    selected.forEach(name=>{
      const plugin = pluginMap[name];
      if(plugin){
        plugin(app, config);
      }else{
        console.warn(`[${NAME}] Unknown plugin: ${name}`);
      }
    });
  }

  MicroVuePlugins.version = VERSION;
  MicroVuePlugins.name = NAME;
  MicroVuePlugins.available = Object.keys(pluginMap);
  MicroVuePlugins.presets = Object.keys(presets);

  global.MicroVuePlugins = MicroVuePlugins;



  // =============================
  // 🔁 LIFECYCLE EXTENSION (6.5+)
  // =============================

  // Lightweight lifecycle wrapper
  function withLifecycle(plugin){
    return function(app, config){
      app.use(function(el, state){

        // mounted
        if(plugin.mounted){
          plugin.mounted(el, state, config);
        }

        // track cleanup
        if(plugin.unmounted){
          el.__cleanup = el.__cleanup || [];
          el.__cleanup.push(()=>plugin.unmounted(el, state, config));
        }

      });
    }
  }

  // Example: visible plugin rewritten with lifecycle
  pluginMap.visible = withLifecycle({
    mounted(el, state, config){
      const exp = attr(el, "visible", config);
      if(!exp) return;

      const observer = new IntersectionObserver(entries=>{
        if(entries[0].isIntersecting){
          MicroVue.executeEvent(exp, state);
        }
      });

      observer.observe(el);
      el.__observer = observer;
    },

    unmounted(el){
      if(el.__observer){
        try{ el.__observer.disconnect(); }catch{}
      }
    }
  });

  // Patch destroy to support lifecycle cleanup
  const originalDestroy = global.MicroVue?.destroy;
  if(!global.MicroVue.destroy){
    global.MicroVue.destroy = function(n){
      if(!n || n.nodeType !== 1) return;

      // run plugin cleanup
      if(n.__cleanup){
        n.__cleanup.forEach(fn=>{
          try{ fn(); }catch{}
        });
      }

      n.__handlers?.forEach((h,e)=>n.removeEventListener(e,h));
      delete n.__handlers;

      n.__effects?.forEach(e=>{e.active=false;});

      [...n.childNodes||[]].forEach(global.MicroVue.destroy);
    };
  }

})(window);
