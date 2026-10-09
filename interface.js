/* Interface state is independent of document pixels and project files. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id), E=window.ContourEditor, I=window.ContourI18n;
  const defaults={layout:'auto',language: I?.language||'ru',theme:document.documentElement.dataset.theme||'dark',density:'standard',finger:'draw',cursor:true,crosshair:false,loupe:true,offset:0,pressure:'size',pressureMin:10,quickShape:true,fillPreview:true,grid:true};
  let saved={};try{saved=JSON.parse(localStorage.getItem('contour-settings'))||{};}catch{}
  const prefs={...defaults};for(const k of Object.keys(defaults))if(typeof saved[k]===typeof defaults[k])prefs[k]=saved[k];
  for(const [key,values] of Object.entries({layout:['auto','mobile','desktop'],language:['ru','en'],theme:['dark','light','system'],density:['standard','large'],finger:['draw','pan'],pressure:['off','size','opacity','both']}))if(!values.includes(prefs[key]))prefs[key]=defaults[key];
  prefs.offset=Math.max(0,Math.min(80,prefs.offset));prefs.pressureMin=Math.max(1,Math.min(100,prefs.pressureMin));
  const root=document.documentElement, tools=document.querySelector('.tools'),sidebar=document.querySelector('.sidebar'),options=document.querySelector('.options-bar'),top=document.querySelector('.topbar'),history=document.querySelector('.history');
  const icon=(name)=>({settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M9 3h6l1 3 3 1 2 4-2 3v3l-4 2-3-1-3 1-4-2v-3l-2-3 2-4 3-1Z',menu:'M4 6h16M4 12h16M4 18h16',layers:'M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',color:'M12 3C7 8 5 11 5 15a7 7 0 0 0 14 0c0-4-2-7-7-12Z',options:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',view:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'}[name]||'M5 12h14M12 5v14');
  function button(id,label,kind){const b=document.createElement('button');b.id=id;b.type='button';b.setAttribute('aria-label',label);b.title=label;b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon(kind)+'"/></svg>';return b;}
  function save(){try{localStorage.setItem('contour-settings',JSON.stringify(prefs));}catch{}}
  function apply(){
    const mobile=prefs.layout==='mobile'||prefs.layout==='auto'&&innerWidth<800;
    const before=root.dataset.layout,view=before?E.captureView():null;root.dataset.layout=mobile?'mobile':'desktop';root.dataset.density=prefs.density;root.dataset.grid=String(prefs.grid);root.dataset.crosshair=String(prefs.crosshair);
    const light=prefs.theme==='system'?(window.matchMedia?.('(prefers-color-scheme: light)').matches||false):prefs.theme==='light';E.theme(light?'light':'dark');
    $('quickShapeEnabled').checked=prefs.quickShape;if($('fillPreviewEnabled').checked!==prefs.fillPreview){$('fillPreviewEnabled').checked=prefs.fillPreview;$('fillPreviewEnabled').dispatchEvent(new Event('change'));}
    if(before&&before!==root.dataset.layout){closePanel();if(view)E.restoreView(view);}sync();
  }
  const fileButton=button('fileMenuButton','Файл','menu'),viewButton=button('viewMenuButton','Вид','view'),settingsButton=button('settingsButton','Настройки','settings');
  const fileMenu=document.createElement('div');fileMenu.id='fileMenu';fileMenu.className='interface-menu';fileMenu.hidden=true;
  const viewMenu=document.createElement('div');viewMenu.id='viewMenu';viewMenu.className='interface-menu';viewMenu.hidden=true;
  const nav=top.querySelector('nav');for(const id of ['newDoc','openImage','importLayer','resizeCanvas'])fileMenu.append($(id));
  for(const id of ['referenceToggle','mirrorView','zoomOut','zoom100','zoomIn','fit'])viewMenu.append($(id));
  nav.prepend(fileButton);nav.append(viewButton);top.append(history,settingsButton);document.body.append(fileMenu,viewMenu);$('themeToggle').hidden=true;$('fillPreviewEnabled').closest('label').hidden=true;document.querySelector('.file-actions').hidden=true;
  function openMenu(menu,anchor){const opening=menu.hidden;fileMenu.hidden=viewMenu.hidden=true;if(!opening)return;closePanel();menu.hidden=false;const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-230,r.left))+'px';menu.style.top=r.bottom+6+'px';}
  fileButton.onclick=()=>openMenu(fileMenu,fileButton);viewButton.onclick=()=>openMenu(viewMenu,viewButton);
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#fileMenu,#viewMenu,#fileMenuButton,#viewMenuButton'))fileMenu.hidden=viewMenu.hidden=true;},true);
  fileMenu.addEventListener('click',e=>{if(e.target.closest('button'))fileMenu.hidden=true;});
  const panelHeading=document.createElement('header');panelHeading.className='mobile-panel-heading';panelHeading.innerHTML='<button id="panelExpand" type="button" aria-label="Развернуть панель">↕</button><span id="panelTitle"></span><button id="panelClose" type="button" aria-label="Закрыть панель">×</button>';
  const panel=document.createElement('section');panel.id='mobilePanel';panel.hidden=true;panel.setAttribute('aria-label','Рабочая панель');panel.append(panelHeading);document.body.append(panel);
  // All controls keep their original nodes and event handlers when moved.
  const homes=new Map();function moveInto(node){if(!homes.has(node)){const marker=document.createComment('panel-home');node.before(marker);homes.set(node,marker);}panel.append(node);}
  let panelKind=null;
  function closePanel(){for(const [node,marker]of homes)marker.after(node);panel.hidden=true;panel.classList.remove('expanded');panelKind=null;root.dataset.panel='';sync();}
  function showPanel(kind){if(root.dataset.layout!=='mobile')return;const same=kind===panelKind;closePanel();if(same)return;fileMenu.hidden=viewMenu.hidden=true;panelKind=kind;root.dataset.panel=kind;panel.hidden=false;$('panelTitle').textContent={color:'Цвет',layers:'Слои',tools:'Инструменты',options:'Параметры инструмента'}[kind];
    if(kind==='tools')moveInto(tools);else if(kind==='color')moveInto(document.querySelector('.color-panel'));else if(kind==='layers')moveInto(document.querySelector('.layer-panel'));else if(kind==='options'){moveInto(options);moveInto(document.querySelector('.selection-panel'));}
    sync();I?.refresh(panel);
  }
  $('panelClose').onclick=closePanel;$('panelExpand').onclick=()=>panel.classList.toggle('expanded');
  const dock=document.createElement('nav');dock.id='mobileDock';dock.setAttribute('aria-label','Рабочие инструменты');
  for(const [id,label,tool]of [['mobileBrush','Кисть','brush'],['mobileFill','Заливка','fill'],['mobileSelect','Выделение','colorSelect']]){const b=button(id,label,'options'),source=tools.querySelector('[data-tool="'+tool+'"]');b.replaceChildren(source.querySelector('svg').cloneNode(true));b.onclick=()=>{E.selectTool(tool);closePanel();};dock.append(b);}
  for(const [id,label,kind,ico]of [['mobileTools','Инструменты','tools','menu'],['mobileColor','Цвет','color','color'],['mobileLayers','Слои','layers','layers'],['mobileOptions','Параметры инструмента','options','options']]){const b=button(id,label,ico);b.onclick=()=>showPanel(kind);dock.append(b);}
  document.body.append(dock);
  tools.addEventListener('click',e=>{if(e.target.closest('[data-tool]')&&root.dataset.layout==='mobile')closePanel();});
  const paletteExtras=document.createElement('details');paletteExtras.className='compact-actions palette-extras';paletteExtras.innerHTML='<summary aria-label="Действия с палитрой">⋯</summary>';for(const id of ['palettePick','newPalette','editPalette'])paletteExtras.append($(id));document.querySelector('.palette-controls').append(paletteExtras);
  const layerExtras=document.createElement('details');layerExtras.className='compact-actions layer-extras';layerExtras.innerHTML='<summary>Действия со слоем</summary>';for(const cl of ['.layer-actions','.layer-merge-actions'])layerExtras.append(document.querySelector(cl));document.querySelector('.layer-background-action').before(layerExtras);const rename=document.createElement('button');rename.type='button';rename.textContent='Переименовать слой';rename.onclick=E.renameLayer;layerExtras.append(rename);
  const selectionActions=document.querySelector('.selection-actions');for(const [id,label,action]of [['clearSelection','Очистить',()=>E.deletePixels()],['moveSelection','Переместить выделение',null]]){const b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;if(action)b.onclick=action;else{b.setAttribute('aria-pressed','false');b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';E.selectionMove(on);b.setAttribute('aria-pressed',String(on));};}selectionActions.append(b);}for(const [label,action]of [['Копировать',()=>E.copyPixels()],['Вырезать',()=>E.copyPixels(true)],['Вставить',E.pastePixels]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;selectionActions.append(b);}
  const fillMultiple=document.createElement('label');fillMultiple.innerHTML='<input id="fillMultiple" type="checkbox">Несколько областей';$('fillOptions').append(fillMultiple);
  const touchCommands=document.createElement('div');touchCommands.className='touch-commands';
  for(const [id,label,ico,mode]of [['temporaryPicker','Удерживать: пипетка','color','picker'],['temporaryEraser','Удерживать: ластик','options','eraser']]){const b=button(id,label,ico);const stop=()=>{E.temporary(mode,false);b.setAttribute('aria-pressed','false');};b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);E.temporary(mode,true);b.setAttribute('aria-pressed','true');};b.onpointerup=b.onpointercancel=b.onlostpointercapture=stop;touchCommands.append(b);}options.append(touchCommands);
  const loupe=document.createElement('canvas');loupe.id='touchLoupe';loupe.width=loupe.height=120;loupe.hidden=true;document.body.append(loupe);
  function showLoupe(e,p){if(!prefs.loupe||e.pointerType!=='touch'||root.dataset.layout!=='mobile'){loupe.hidden=true;return;}const c=loupe.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,120,120);const scale=5;c.drawImage($('display'),p.x-12,p.y-12,24,24,0,0,120,120);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(58,58,5,5);c.strokeStyle='#111';c.lineWidth=1;c.strokeRect(58,58,5,5);loupe.style.left=Math.max(8,Math.min(innerWidth-128,e.clientX-60))+'px';loupe.style.top=Math.max(8,e.clientY-prefs.offset-155)+'px';loupe.hidden=false;}
  const dialog=document.createElement('dialog');dialog.id='settingsDialog';dialog.innerHTML=`<form method="dialog"><h2>Настройки</h2><div class="settings-grid">
    <label>Интерфейс<select id="settingLayout"><option value="auto">Авто</option><option value="mobile">Мобильный</option><option value="desktop">Обычный</option></select></label>
    <label>Язык<select id="settingLanguage"><option value="ru" lang="ru" data-user-text>Русский</option><option value="en" lang="en" data-user-text>English</option></select></label>
    <label>Тема<select id="settingTheme"><option value="dark">Тёмная</option><option value="light">Светлая</option><option value="system">Системная</option></select></label>
    <label>Элементы<select id="settingDensity"><option value="standard">Стандартные</option><option value="large">Увеличенные</option></select></label>
    <label>Пальцем<select id="settingFinger"><option value="draw">Рисовать</option><option value="pan">Перемещать</option></select></label>
    <label>Нажатие стилуса<select id="settingPressure"><option value="size">Размер</option><option value="opacity">Непрозрачность</option><option value="both">Размер и непрозрачность</option><option value="off">Выключено</option></select></label>
    <label>Минимальный размер, %<input id="settingPressureMin" type="number" min="1" max="100"></label>
    <label>Смещение касания, px<input id="settingOffset" type="number" min="0" max="80"></label>
    <label><input id="settingCursor" type="checkbox">Отпечаток кисти</label><label><input id="settingCrosshair" type="checkbox">Перекрестие</label>
    <label><input id="settingLoupe" type="checkbox">Лупа при касании</label><label><input id="settingQuickShape" type="checkbox">Автофигура</label>
    <label><input id="settingFillPreview" type="checkbox">Предпросмотр заливки</label><label><input id="settingGrid" type="checkbox">Сетка рабочей области</label></div>
    <p class="muted">Нажатие работает, если стилус и браузер передают его силу. Мышь и палец используют обычный размер. Изменение непрозрачности включается отдельно.</p>
    <details><summary>Управление и справка</summary><p>Два пальца — масштаб и перемещение. Один палец — выбранный инструмент. Удерживайте кнопку пипетки или ластика для временного включения. На компьютере доступны горячие клавиши.</p><button id="settingsHelp" type="button">Горячие клавиши</button></details>
    <details><summary>Черновик</summary><p id="settingsDraftState"></p><p class="muted">Черновик хранится в этом браузере. Для переноса и продолжения работы со слоями сохраните проект .contour.</p><button id="settingsRestoreDraft" type="button">Проверить черновик</button></details>
    <details><summary>О программе</summary><p>Контур · 0.7.2</p><p class="muted">Изображения обрабатываются на вашем устройстве.</p></details>
    <div class="dialog-actions"><button id="resetSettings" type="button">Сбросить настройки</button><button class="accent">Закрыть</button></div></form>`;
  document.body.append(dialog);
  const settingFields={Layout:'layout',Language:'language',Theme:'theme',Density:'density',Finger:'finger',Pressure:'pressure',PressureMin:'pressureMin',Offset:'offset',Cursor:'cursor',Crosshair:'crosshair',Loupe:'loupe',QuickShape:'quickShape',FillPreview:'fillPreview',Grid:'grid'};
  function fillSettings(){for(const [suffix,key]of Object.entries(settingFields)){const el=$('setting'+suffix);if(el.type==='checkbox')el.checked=prefs[key];else el.value=prefs[key];}$('settingsDraftState').textContent=$('draftStatus').textContent;}
  settingsButton.onclick=()=>{closePanel();fileMenu.hidden=viewMenu.hidden=true;fillSettings();dialog.showModal();};
  for(const [suffix,key]of Object.entries(settingFields))$('setting'+suffix).onchange=e=>{const el=e.target;prefs[key]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;if(key==='pressureMin')prefs[key]=Math.max(1,Math.min(100,prefs[key]||10));if(key==='offset')prefs[key]=Math.max(0,Math.min(80,prefs[key]||0));if(key==='language')I?.setLanguage(prefs.language);save();apply();fillSettings();E.refreshCursor();};
  $('resetSettings').onclick=()=>{Object.assign(prefs,defaults);I?.setLanguage(prefs.language);save();apply();fillSettings();};
  $('settingsHelp').onclick=()=>{dialog.close();$('helpDialog').showModal();};$('settingsRestoreDraft').onclick=()=>{dialog.close();E.findDraft();};
  $('draftStatus').onclick=()=>settingsButton.click();$('draftStatus').setAttribute('role','button');$('draftStatus').tabIndex=0;$('draftStatus').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();settingsButton.click();}};
  function sync(){
    const state=E.state();root.dataset.tool=state.tool;root.dataset.selection=String(state.selection);$('clearSelection').disabled=$('moveSelection').disabled=!state.selection;
    const activeButton=tools.querySelector('[data-tool].selected');for(const [id,value]of [['mobileBrush',['brush','pencil'].includes(state.tool)],['mobileFill',state.tool==='fill'],['mobileSelect',['colorSelect','rect','lasso'].includes(state.tool)]])$(id).setAttribute('aria-pressed',String(value));
    const more=$('mobileTools');if(activeButton){const label=activeButton.getAttribute('aria-label');more.title=more.getAttribute('aria-label')===label?label:label;more.setAttribute('aria-label',label);if(!['brush','pencil','fill','colorSelect','rect','lasso'].includes(state.tool)){const svg=activeButton.querySelector('svg');if(more.dataset.tool!==state.tool){more.replaceChildren(svg.cloneNode(true));more.dataset.tool=state.tool;}}else if(more.dataset.tool){more.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon('menu')+'"/></svg>';delete more.dataset.tool;}}
    $('mobileColor').style.setProperty('--chosen-color',$('color').value);$('mobileColor').setAttribute('aria-pressed',String(panelKind==='color'));$('mobileLayers').setAttribute('aria-pressed',String(panelKind==='layers'));$('mobileOptions').setAttribute('aria-pressed',String(panelKind==='options'));
    const pane=document.querySelector('.selection-panel');pane.classList.toggle('relevant',state.selection||['colorSelect','rect','lasso'].includes(state.tool));
  }
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!dialog.open){closePanel();fileMenu.hidden=viewMenu.hidden=true;}});
  let resizePending=false;window.addEventListener('resize',()=>{if(resizePending)return;resizePending=true;requestAnimationFrame(()=>{resizePending=false;apply();});});window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(prefs.theme==='system')apply();});
  // A hold explains an icon; ordinary taps continue to select its tool.
  let hintTimer=null,hint=null;tools.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const b=e.target.closest('button');if(!b)return;hintTimer=setTimeout(()=>{hint=document.createElement('div');hint.className='touch-hint';hint.textContent=b.title||b.getAttribute('aria-label');document.body.append(hint);I?.refresh(hint);},550);});
  function clearHint(){clearTimeout(hintTimer);hint?.remove();hint=null;}for(const type of ['pointerup','pointercancel','pointermove'])tools.addEventListener(type,clearHint);
  let layerDrag=null;const layerList=$('layers');
  layerList.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||!e.target.closest('.layer-drag'))return;const row=e.target.closest('.layer-row');e.preventDefault();e.stopPropagation();row.classList.add('touch-dragging');layerDrag={id:row.dataset.id,pointerId:e.pointerId};e.target.setPointerCapture(e.pointerId);});
  layerList.addEventListener('pointermove',e=>{if(!layerDrag)return;e.preventDefault();const row=document.elementFromPoint?.(e.clientX,e.clientY)?.closest('.layer-row');for(const r of layerList.children)r.classList.remove('drop-above','drop-below');if(row&&row.dataset.id!==layerDrag.id)row.classList.add(e.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2?'drop-above':'drop-below');});
  layerList.addEventListener('pointerup',e=>{if(!layerDrag||e.pointerId!==layerDrag.pointerId)return;e.preventDefault();const drag=layerDrag;layerDrag=null;const row=document.elementFromPoint?.(e.clientX,e.clientY)?.closest('.layer-row');if(row)E.reorderLayer(drag.id,row.dataset.id,e.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);for(const r of layerList.children)r.classList.remove('touch-dragging','drop-above','drop-below');});
  layerList.addEventListener('pointercancel',()=>{layerDrag=null;for(const r of layerList.children)r.classList.remove('touch-dragging','drop-above','drop-below');});
  window.ContourInterface={prefs,sync,showLoupe,hideLoupe:()=>loupe.hidden=true,closePanel};apply();I?.setLanguage(prefs.language);I?.refresh(document.body);
})();
