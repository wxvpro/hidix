/* pass-button.js
 * Добавляет кнопку "Pass" в тулбар редактора Publii.
 * Работает и для визуального редактирования (contenteditable), и для HTML (CodeMirror/textarea).
 */
(function(){
  const BTN_ID = 'publii-pass-btn';

  // Простое модальное окно
  function askPassword() {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:999999';
      wrap.innerHTML = `
        <div style="background:#111;color:#eee;padding:16px 18px;border-radius:10px;min-width:280px;max-width:420px;border:1px solid #333;font-family:system-ui,Segoe UI,Roboto,Arial">
          <div style="font-size:16px;margin-bottom:10px">Введите пароль для скрытия выделенного:</div>
          <input type="password" id="pb_pw" style="width:100%;padding:8px;border-radius:8px;border:1px solid #444;background:#000;color:#eee">
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button id="pb_cancel" style="padding:.45rem .8rem;border-radius:8px;border:0;background:#333;color:#ddd;cursor:pointer">Отмена</button>
            <button id="pb_ok" style="padding:.45rem .8rem;border-radius:8px;border:0;background:#4caf50;color:#fff;cursor:pointer">ОК</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const input = wrap.querySelector('#pb_pw');
      input.focus();
      function close(val){ wrap.remove(); resolve(val); }
      wrap.querySelector('#pb_cancel').onclick = ()=>close(null);
      wrap.querySelector('#pb_ok').onclick = ()=>close(input.value || '');
      input.addEventListener('keydown', e=>{
        if(e.key==='Escape') close(null);
        if(e.key==='Enter') close(input.value || '');
      });
    });
  }

  // Обертка текста в теги lock
  function wrapWithLock(text, pw){
    return `{{#lock pw="${pw.replace(/"/g,'&quot;')}"}}` + text + `{{/lock}}`;
  }

  // Получение/замена выделения для разных редакторов
  function getEditorSelection(){
    // 1) HTML-режим: CodeMirror
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      const cm = cmEl.CodeMirror;
      const sel = cm.getSelection();
      return { type:'cm', cm, text: sel };
    }
    // 2) Текстовая textarea (иногда используется)
    const ta = document.querySelector('textarea[name="content"], textarea#content, textarea.PostContent, .editor textarea');
    if (ta) {
      const { selectionStart:s, selectionEnd:e, value:v } = ta;
      return {
        type:'textarea',
        el: ta,
        text: v.substring(s,e),
        replace: (newText)=>{
          ta.value = v.substring(0,s) + newText + v.substring(e);
          // восстановим выделение примерно на новый блок
          ta.setSelectionRange(s, s + newText.length);
          ta.dispatchEvent(new Event('input', {bubbles:true}));
        }
      };
    }
    // 3) Визуальный редактор: contenteditable
    const ce = document.querySelector('[contenteditable="true"], .ce-block, .editor__content');
    if (ce) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        const html = container.innerHTML;
        return {
          type:'contenteditable',
          range,
          html,
          replace: (newHtml)=>{
            range.deleteContents();
            const frag = range.createContextualFragment(newHtml);
            range.insertNode(frag);
          }
        };
      }
    }
    return null;
  }

  function installButton(){
    // ищем тулбар редактора
    const toolbars = document.querySelectorAll('.toolbar, .tools, .editor__toolbar, .post-tools, .g-editor-toolbar');
    let bar = null;
    for (const tb of toolbars){ if (tb && tb.querySelector('*')) { bar = tb; break; } }
    if (!bar || document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = 'Скрыть выделенное по паролю (Pass)';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .6rem;margin-left:.35rem;border:1px solid #3a3a3a;border-radius:8px;background:#1a1a1a;color:#eee;cursor:pointer';
    btn.innerHTML = `<span style="font-weight:600">Pass</span> 🔒`;
    btn.onclick = async ()=>{
      const ctx = getEditorSelection();
      if (!ctx || (!ctx.text && !ctx.html)) {
        alert('Сначала выделите текст/HTML в редакторе.');
        return;
      }
      const pw = await askPassword();
      if (!pw) return;

      const selected = (ctx.text ?? ctx.html ?? '').trim();
      const wrapped = wrapWithLock(selected, pw);

      if (ctx.type === 'cm') {
        const cm = ctx.cm;
        cm.replaceSelection(wrapped, 'around');
        cm.focus();
      } else if (ctx.type === 'textarea') {
        ctx.replace(wrapped);
      } else if (ctx.type === 'contenteditable') {
        // В визуальном режиме вставим как «сырой» handlebars в HTML
        ctx.replace(wrapped);
      } else {
        alert('Не удалось определить тип редактора.');
      }
    };

    // вставляем кнопку в конец найденного тулбара
    bar.appendChild(btn);
  }

  // Пробуем установить кнопку сразу и при изменениях DOM
  const obs = new MutationObserver(()=>installButton());
  obs.observe(document.documentElement, {childList:true, subtree:true});
  installButton();
})();