/*!
 * MicroVue Validation Plugin v3.3
 */

(function(global){

  const MV = global.MicroVue;

  function ValidationPlugin(app, options = {}){

    const rules = {};
    const config = {
      prefix: options.prefix || app?.config?.prefix || 'v-',
      errorClass: "is-invalid",
      successClass: "is-valid",
      pendingClass: "mv-pending",
      errorTextClass: "mv-error-text",
      ...options
    };

    const attr = (el, name) => el.getAttribute(config.prefix + name);
    const has  = (el, name) => el.hasAttribute(config.prefix + name);

    // =========================
    // RULES
    // =========================
    function defineRule(name, fn){ rules[name] = fn; }

    // =========================
    // FIELD
    // =========================
    function createField(el, state){

      const raw = attr(el,"validate")?.split("|") || [];
      const name = el.getAttribute("name");

      const field = MV.reactive({
        el, errors: [], touched:false, dirty:false, pending:false,
        group: el.getAttribute("data-group")
      });

      const errorEl = document.createElement("div");
      errorEl.className = config.errorTextClass;
      el.after(errorEl);

      let token = 0;

      async function validate(){
        const t = ++token;
        field.pending = true;
        field.errors.length = 0;

        el.classList.add(config.pendingClass);

        for(let r of raw){
          const [n,p] = r.split(":");
          const rule = rules[n];
          if(!rule) continue;

          const res = await rule(el.value, p, field);
          if(t !== token) return;

          if(res !== true) field.errors.push(res || "Invalid");
        }

        field.pending = false;
        el.classList.remove(config.pendingClass);
        updateUI();
        return field.errors;
      }

      function updateUI(){
        el.classList.remove(config.errorClass, config.successClass);

        if(field.errors.length){
          if(field.touched || field.dirty){
            el.classList.add(config.errorClass);
          }
        }else if(field.dirty){
          el.classList.add(config.successClass);
        }

        errorEl.textContent = field.errors[0] || "";
      }

      const onInput = ()=>{ field.dirty = true; validate(); };
      const onBlur  = ()=>{ field.touched = true; validate(); };

      el.addEventListener("input", onInput);
      el.addEventListener("blur", onBlur);

      field.validate = validate;
      field.isValid = ()=> field.errors.length === 0;

      field.reset = ()=>{
        field.errors.length = 0;
        field.touched = false;
        field.dirty = false;
        errorEl.textContent = "";
        updateUI();
      };

      // ✅ Lifecycle cleanup (6.5 aligned)
      field.destroy = ()=>{
        el.removeEventListener("input", onInput);
        el.removeEventListener("blur", onBlur);
        errorEl.remove();
        delete el.__field;
      };

      el.__field = field;

      // expose to template
      if(name && state){
        state.$errors = state.$errors || MV.reactive({});
        state.$errors[name] = field;
      }

      return field;
    }

    // =========================
    // FORM
    // =========================
    function createForm(el){

      const selector = `[${config.prefix}validate]`;

      const form = {

        async validate(opts = {}){
          const group = opts.group;

          const fields = [...el.querySelectorAll(selector)]
            .map(i => i.__field)
            .filter(Boolean);

          const errors = [];

          for(let f of fields){
            if(!group || f.group === group){
              const e = await f.validate();
              if(e.length) errors.push({ el:f.el, errors:e });
            }
          }

          return errors;
        },

        async isValid(opts = {}){
          return (await this.validate(opts)).length === 0;
        },

        reset(){
          el.querySelectorAll(selector)
            .forEach(i => i.__field?.reset());
        }
      };

      el.__form = form;
      return form;
    }

    // =========================
    // DEFAULT RULES
    // =========================
    defineRule("required", v => (v && v.trim() !== "" ? true : "Required"));
    defineRule("email", v => (!v || /^\S+@\S+\.\S+$/.test(v) ? true : "Invalid email"));
    defineRule("min", (v,p) => (v.length >= p ? true : `Min ${p} chars`));
    defineRule("number", v => (!v || !isNaN(v) ? true : "Must be number"));

    // =========================
    // INSTALL
    // =========================
    app.use(function(el, state){

      if(has(el,"validate")){
        createField(el, state);
      }

      if(el.tagName === "FORM" && has(el,"form")){
        createForm(el);
      }

    });

    app.$validation = { defineRule };
  }

  global.MicroVueValidation = ValidationPlugin;

})(window);