(() => {
  "use strict";
  const translations = {
    pt: {
      skip:"Pular para o conteúdo", language:"Idioma", navHome:"Início",navProducts:"Produtos",navStatus:"Status",account:"Minha conta",
      eyebrow:"SUA LOJA DIGITAL",heroTitle:"Seu próximo nível <em>começa aqui.</em>",heroLead:"Produtos para PC e mobile, planos claros e compra em poucos passos.",
      explore:"Ver produtos",checkStatus:"Ver status",trust1:"Pagamento seguro",trust2:"Suporte",trust3:"Atualizações",
      androidLive:"Android disponível",ourProducts:"ESCOLHA SEU PRODUTO",productsTitle:"Produtos",productsLead:"Escolha o produto e abra os planos disponíveis.",
      windows:"Windows",csSubtitle:"Planos para o projeto CS2 no Windows.",buy:"Comprar",
      androidAvailable:"Android disponível",iosPresale:"iOS em pré-venda",cfSubtitle:"Android disponível. Para iOS, a compra é uma pré-venda sem acesso imediato.",
      service:"DISPONIBILIDADE",statusTitle:"Status",statusLead:"Situação informada no painel administrativo.",
      help:"DÚVIDAS RÁPIDAS",faqLead:"O essencial antes da compra.",faqQ1:"Como escolho meu plano?",faqA1:"Clique em Comprar no produto desejado. Os planos aparecem antes de ir para o pagamento.",
      faqQ2:"Quais métodos de pagamento existem?",faqA2:"O site utiliza Mercado Pago, com Pix e cartão conforme a região. O canal Telegram Stars depende da ativação do bot.",
      faqQ3:"Como funciona o iOS?",faqA3:"iOS está em pré-venda. O aplicativo não foi lançado, não há acesso imediato e a data de lançamento ainda não está confirmada.",
      faqQ4:"Como consulto o status?",faqA4:"Abra Status para ver as informações publicadas pela administração.",
      selectPlan:"ESCOLHA SEU PLANO",platform:"Plataforma",presaleTitle:"Pré-venda iOS",iosNotice:"Você está comprando antecipadamente uma versão ainda não lançada. Não há acesso imediato e a data de lançamento não está confirmada.",
      pricingRegion:"Região de preços",intlCardUnavailable:"O cartão internacional ainda precisa da configuração de câmbio. Preços em USD são referências; nenhuma cobrança será feita enquanto essa configuração estiver ausente.",intlCardNote:"Os preços internacionais estão em USD; o Mercado Pago liquida em reais (BRL), com o valor exato mostrado no checkout.",cfFeatureToggle:"Ver todas as funções do Counter-Frame",viewPhotos:"Ver fotos reais do menu",realScreenshots:"CAPTURAS REAIS",realScreenshotsNote:"Fotos reais do menu durante o jogo. Consulte o status da sua plataforma.",payCard:"Continuar com Pix ou cartão",openTelegram:"Abrir bot do Telegram",noteStars:"O bot do Telegram ainda precisa ser ativado para processar pagamentos com Stars.",
      buyNote:"Selecione um plano para prosseguir.",checkoutUnavailable:"Pagamento online não configurado. Entre em contato com o suporte.",
      days:"dias",day:"dia",lifetime:"Vitalício",status_loading:"Consultando",status_online:"ONLINE",status_offline:"OFFLINE",status_maintenance:"MANUTENÇÃO",status_coming_soon:"EM BREVE",status_presale:"PRÉ-VENDA",
      statusGeneric_online:"Produto disponível conforme o painel.",statusGeneric_offline:"Produto indisponível.",statusGeneric_maintenance:"Produto em manutenção.",statusGeneric_coming_soon:"Lançamento em preparação.",statusGeneric_presale:"Pré-venda disponível; versão ainda não lançada.",
      iosRequired:"iOS é uma pré-venda: sem acesso imediato e sem data confirmada."
    },
    en: {
      skip:"Skip to content",language:"Language",navHome:"Home",navProducts:"Products",navStatus:"Status",account:"My account",
      eyebrow:"DIGITAL STORE",heroTitle:"Your next level <em>starts here.</em>",heroLead:"PC and mobile products, straightforward plans and a simple checkout.",
      explore:"Explore products",checkStatus:"Check status",trust1:"Secure payments",trust2:"Support",trust3:"Updates",
      androidLive:"Android available",ourProducts:"CHOOSE YOUR PRODUCT",productsTitle:"Products",productsLead:"Pick a product to see its plans.",
      windows:"Windows",csSubtitle:"Plans for the CS2 Windows product.",buy:"Buy now",
      androidAvailable:"Android available",iosPresale:"iOS pre-order",cfSubtitle:"Android is available. iOS orders are pre-orders with no immediate access.",
      service:"AVAILABILITY",statusTitle:"Status",statusLead:"Availability published by the admin team.",
      help:"QUICK ANSWERS",faqLead:"What you need to know before buying.",faqQ1:"How do I choose a plan?",faqA1:"Click Buy on the product you want. Plans will appear before checkout.",
      faqQ2:"Which payment methods are available?",faqA2:"The website uses Mercado Pago for Pix and cards where available. Telegram Stars depends on the bot being activated.",
      faqQ3:"What about iOS?",faqA3:"iOS is available for pre-order only. The app has not launched, access is not immediate and no release date is confirmed.",
      faqQ4:"How do I check the status?",faqA4:"Open Status to see availability updates from the admin team.",
      selectPlan:"CHOOSE YOUR PLAN",platform:"Platform",presaleTitle:"iOS pre-order",iosNotice:"You are pre-ordering an unreleased iOS version. Access is not immediate and there is no confirmed release date.",
      pricingRegion:"Pricing region",intlCardUnavailable:"International card checkout is pending exchange-rate configuration. USD prices are references; no payment will be taken until billing is ready.",intlCardNote:"International prices are listed in USD; Mercado Pago settles in Brazilian reais (BRL). The exact BRL charge is shown at checkout.",cfFeatureToggle:"View all Counter-Frame features",viewPhotos:"View real menu screenshots",realScreenshots:"REAL SCREENSHOTS",realScreenshotsNote:"Real menu screenshots taken during gameplay. Check your platform status.",payCard:"Continue with Pix or card",openTelegram:"Open Telegram bot",noteStars:"Telegram Stars payments are not active until the bot is deployed.",
      buyNote:"Select a plan to continue.",checkoutUnavailable:"Online checkout is not configured. Contact support.",
      days:"days",day:"day",lifetime:"Lifetime",status_loading:"Loading",status_online:"ONLINE",status_offline:"OFFLINE",status_maintenance:"MAINTENANCE",status_coming_soon:"COMING SOON",status_presale:"PRE-ORDER",
      statusGeneric_online:"Available as reported by the admin team.",statusGeneric_offline:"Currently unavailable.",statusGeneric_maintenance:"Temporarily under maintenance.",statusGeneric_coming_soon:"Launch in preparation.",statusGeneric_presale:"Pre-orders are open; the version has not been released.",
      iosRequired:"iOS is a pre-order: no immediate access and no confirmed release date."
    },
    es: {
      skip:"Saltar al contenido",language:"Idioma",navHome:"Inicio",navProducts:"Productos",navStatus:"Estado",account:"Mi cuenta",
      eyebrow:"TIENDA DIGITAL",heroTitle:"Tu próximo nivel <em>empieza aquí.</em>",heroLead:"Productos para PC y móvil, planes claros y compra en pocos pasos.",
      explore:"Ver productos",checkStatus:"Ver estado",trust1:"Pagos seguros",trust2:"Soporte",trust3:"Actualizaciones",
      androidLive:"Android disponible",ourProducts:"ELIGE TU PRODUCTO",productsTitle:"Productos",productsLead:"Elige el producto para ver sus planes.",
      windows:"Windows",csSubtitle:"Planes del producto CS2 para Windows.",buy:"Comprar",
      androidAvailable:"Android disponible",iosPresale:"iOS en preventa",cfSubtitle:"Android disponible. En iOS, la compra es una preventa sin acceso inmediato.",
      service:"DISPONIBILIDAD",statusTitle:"Estado",statusLead:"Información publicada por administración.",
      help:"RESPUESTAS RÁPIDAS",faqLead:"Lo esencial antes de comprar.",faqQ1:"¿Cómo elijo un plan?",faqA1:"Pulsa Comprar en el producto. Los planes se muestran antes del pago.",
      faqQ2:"¿Qué métodos de pago hay?",faqA2:"El sitio usa Mercado Pago, con Pix y tarjeta según la región. Telegram Stars requiere que el bot esté activo.",
      faqQ3:"¿Cómo funciona iOS?",faqA3:"iOS está en preventa. La aplicación aún no se lanzó, no hay acceso inmediato ni fecha confirmada.",
      faqQ4:"¿Cómo consulto el estado?",faqA4:"Abre Estado para ver la información publicada por administración.",
      selectPlan:"ELIGE TU PLAN",platform:"Plataforma",presaleTitle:"Preventa iOS",iosNotice:"Compras por adelantado una versión de iOS aún no publicada. No hay acceso inmediato ni fecha confirmada de lanzamiento.",
      pricingRegion:"Región de precios",intlCardUnavailable:"El pago internacional con tarjeta requiere configurar el tipo de cambio. Los precios en USD son referencias; no se cobrará hasta activarlo.",intlCardNote:"Los precios internacionales están en USD; Mercado Pago cobra en reales brasileños (BRL) y muestra el importe antes de pagar.",cfFeatureToggle:"Ver todas las funciones de Counter-Frame",viewPhotos:"Ver capturas reales del menú",realScreenshots:"CAPTURAS REALES",realScreenshotsNote:"Capturas reales del menú durante el juego. Consulta el estado de tu plataforma.",payCard:"Continuar con Pix o tarjeta",openTelegram:"Abrir bot de Telegram",noteStars:"Los pagos con Telegram Stars requieren activar el bot.",
      buyNote:"Selecciona un plan para continuar.",checkoutUnavailable:"El pago online no está configurado. Contacta con soporte.",
      days:"días",day:"día",lifetime:"De por vida",status_loading:"Cargando",status_online:"DISPONIBLE",status_offline:"SIN SERVICIO",status_maintenance:"MANTENIMIENTO",status_coming_soon:"PRÓXIMAMENTE",status_presale:"PREVENTA",
      statusGeneric_online:"Disponible según administración.",statusGeneric_offline:"No disponible actualmente.",statusGeneric_maintenance:"En mantenimiento temporal.",statusGeneric_coming_soon:"Lanzamiento en preparación.",statusGeneric_presale:"Preventa abierta; versión aún no lanzada.",
      iosRequired:"iOS es una preventa: sin acceso inmediato ni fecha confirmada."
    },
    ru: {
      skip:"Перейти к содержимому",language:"Язык",navHome:"Главная",navProducts:"Продукты",navStatus:"Статус",account:"Мой аккаунт",
      eyebrow:"ЦИФРОВОЙ МАГАЗИН",heroTitle:"Новый уровень <em>начинается здесь.</em>",heroLead:"Продукты для ПК и смартфонов, понятные тарифы и быстрая покупка.",
      explore:"Смотреть продукты",checkStatus:"Проверить статус",trust1:"Безопасная оплата",trust2:"Поддержка",trust3:"Обновления",
      androidLive:"Android доступен",ourProducts:"ВЫБЕРИТЕ ПРОДУКТ",productsTitle:"Продукты",productsLead:"Выберите продукт, чтобы увидеть тарифы.",
      windows:"Windows",csSubtitle:"Тарифы продукта CS2 для Windows.",buy:"Купить",
      androidAvailable:"Android доступен",iosPresale:"Предзаказ iOS",cfSubtitle:"Android доступен. Для iOS открыт предзаказ без мгновенного доступа.",
      service:"ДОСТУПНОСТЬ",statusTitle:"Статус",statusLead:"Информация от администрации.",
      help:"КРАТКИЕ ОТВЕТЫ",faqLead:"Важная информация перед покупкой.",faqQ1:"Как выбрать тариф?",faqA1:"Нажмите «Купить» у нужного продукта. Тарифы появятся до оплаты.",
      faqQ2:"Какие способы оплаты?",faqA2:"На сайте используется Mercado Pago (карта и Pix, где доступно). Telegram Stars заработает после запуска бота.",
      faqQ3:"Что с iOS?",faqA3:"Для iOS открыт только предзаказ. Приложение ещё не вышло, мгновенного доступа нет, дата релиза не объявлена.",
      faqQ4:"Где проверить статус?",faqA4:"Откройте раздел «Статус» для информации администрации.",
      selectPlan:"ВЫБЕРИТЕ ТАРИФ",platform:"Платформа",presaleTitle:"Предзаказ iOS",iosNotice:"Это предзаказ ещё не выпущенной версии для iOS. Мгновенного доступа нет, дата выпуска не подтверждена.",
      pricingRegion:"Регион цен",intlCardUnavailable:"Оплата иностранной картой ещё требует настройки обменного курса. Цены USD справочные, списаний пока нет.",intlCardNote:"Международные цены указаны в USD, но Mercado Pago списывает BRL. Сумма в реалах будет показана до оплаты.",cfFeatureToggle:"Все функции Counter-Frame",viewPhotos:"Реальные скриншоты меню",realScreenshots:"РЕАЛЬНЫЕ СНИМКИ",realScreenshotsNote:"Реальные снимки меню во время игры. Проверяйте статус платформы.",payCard:"Перейти к оплате картой или Pix",openTelegram:"Открыть Telegram-бота",noteStars:"Оплата через Telegram Stars будет доступна после запуска бота.",
      buyNote:"Выберите тариф для продолжения.",checkoutUnavailable:"Онлайн-оплата не настроена. Обратитесь в поддержку.",
      days:"дней",day:"день",lifetime:"Навсегда",status_loading:"Загрузка",status_online:"ДОСТУПНО",status_offline:"НЕДОСТУПНО",status_maintenance:"НА ОБСЛУЖИВАНИИ",status_coming_soon:"СКОРО",status_presale:"ПРЕДЗАКАЗ",
      statusGeneric_online:"Доступно по данным администрации.",statusGeneric_offline:"Сейчас недоступно.",statusGeneric_maintenance:"Временно на обслуживании.",statusGeneric_coming_soon:"Подготовка к запуску.",statusGeneric_presale:"Предзаказ открыт; приложение ещё не выпущено.",
      iosRequired:"iOS — предзаказ: мгновенного доступа нет, дата выхода не объявлена."
    }
  };


  // Only options actually visible in the user's ESP/Aimbot screenshots.
  const cfFeatures = {
    pt: [
      { title:"Visual • ESP", options:["Ativar ESP","Caixa (Box)","Esqueleto","Nome","Vida","Distância","Arma","Linha de mira"] },
      { title:"Configurações do ESP", options:["Tipo de caixa","Espessura","Arredondamento","Opacidade","Tamanho do texto"] },
      { title:"Mira • Aimbot", options:["Ativar mira","Círculo de FOV","Ativação: Sempre no FOV","Ativação: Só ao disparar","Hitbox: Cabeça","Hitbox: Pescoço","Hitbox: Peito"] },
      { title:"Ajustes da mira", options:["FOV","Suavidade","Força de assistência","Alcance máximo","Filtros da mira"] }
    ],
    en: [
      { title:"Visual • ESP", options:["Enable ESP","Box","Skeleton","Name","Health","Distance","Weapon","Aim line"] },
      { title:"ESP settings", options:["Box type","Thickness","Corner rounding","Opacity","Text size"] },
      { title:"Aim • Aimbot", options:["Enable aim","FOV circle","Activation: Always in FOV","Activation: Only when firing","Hitbox: Head","Hitbox: Neck","Hitbox: Chest"] },
      { title:"Aim settings", options:["FOV","Smoothing","Assist strength","Maximum range","Aim filters"] }
    ],
    es: [
      { title:"Visual • ESP", options:["Activar ESP","Caja (Box)","Esqueleto","Nombre","Vida","Distancia","Arma","Línea de mira"] },
      { title:"Ajustes de ESP", options:["Tipo de caja","Grosor","Redondeo de esquinas","Opacidad","Tamaño del texto"] },
      { title:"Mira • Aimbot", options:["Activar puntería","Círculo de FOV","Activación: Siempre en FOV","Activación: Solo al disparar","Hitbox: Cabeza","Hitbox: Cuello","Hitbox: Pecho"] },
      { title:"Ajustes de mira", options:["FOV","Suavizado","Fuerza de asistencia","Alcance máximo","Filtros de puntería"] }
    ],
    ru: [
      { title:"Визуал • ESP", options:["Включить ESP","Рамка (Box)","Скелет","Имя","Здоровье","Расстояние","Оружие","Линия прицеливания"] },
      { title:"Настройки ESP", options:["Тип рамки","Толщина","Скругление","Прозрачность","Размер текста"] },
      { title:"Прицел • Aimbot", options:["Включить прицел","Круг FOV","Всегда в FOV","Только при выстреле","Хитбокс: Голова","Хитбокс: Шея","Хитбокс: Грудь"] },
      { title:"Настройки прицела", options:["FOV","Плавность","Сила помощи","Максимальная дистанция","Фильтры прицеливания"] }
    ]
  };
  function renderCounterFrameFeatures() {
    const root=document.getElementById("cf-feature-content");
    if(!root)return;
    root.replaceChildren();
    for (const group of cfFeatures[lang] || cfFeatures.en) {
      const section=document.createElement("section");
      section.className="cf-feature-group";
      const h=document.createElement("h4");
      h.textContent=group.title;
      const list=document.createElement("ul");
      for (const name of group.options) {
        const item=document.createElement("li");
        item.textContent=name;
        list.appendChild(item);
      }
      section.append(h,list);
      root.appendChild(section);
    }
  }

  const pricesFallback = {
    cs2: [{key:"d1",days:1,priceCents:590},{key:"d7",days:7,priceCents:990},{key:"d15",days:15,priceCents:1490},{key:"d30",days:30,priceCents:1990},{key:"d90",days:90,priceCents:3990},{key:"d180",days:180,priceCents:6490},{key:"lifetime",lifetime:true,priceCents:10000}],
    counterframe: [{key:"d1",days:1,priceCents:490,usdPriceCents:150},{key:"d7",days:7,priceCents:1290,usdPriceCents:400},{key:"d15",days:15,priceCents:2190,usdPriceCents:700},{key:"d30",days:30,priceCents:3500,usdPriceCents:1000}]
  };
  const statuses = ["cs2","counterFrameAndroid","counterFrameIos"];
  const stateLabels = new Set(["online","offline","maintenance","coming_soon","presale"]);
  const statusNames = {"cs2":"CS2 • Windows","counterFrameAndroid":"Counter-Frame • Android","counterFrameIos":"Counter-Frame • iOS"};
  const langSelect = document.getElementById("site-language");
  const dlg = document.getElementById("purchase-dialog");
  const galleryDlg = document.getElementById("gallery-dialog");
  const productTitle = document.getElementById("purchase-title");
  const planGrid = document.getElementById("modal-plans");
  const platformChoice = document.getElementById("platform-choice");
  const marketChoice = document.getElementById("pricing-region-choice");
  const marketSelect = document.getElementById("pricing-region");
  const platformSelect = document.getElementById("purchase-platform");
  const iosNotice = document.getElementById("ios-notice");
  const cardBtn = document.getElementById("pay-card");
  const telegramBtn = document.getElementById("pay-stars");
  const checkoutNote = document.getElementById("checkout-note");
  let lang = "pt", selectedProduct = null, selectedPlan = "d30", loadedPlans = pricesFallback, checkoutAvailable = true, productStatuses = {};
  const savedMarket = localStorage.getItem("lb_store_market");
  let market = ["BR","INTL"].includes(savedMarket) ? savedMarket :
    ((navigator.languages?.[0] || navigator.language || "en").toLowerCase().startsWith("pt") ? "BR" : "INTL");
  marketSelect.value = market;

  function guessLanguage() {
    const param = new URLSearchParams(location.search).get("lang");
    if (param && translations[param]) return param;
    const saved = localStorage.getItem("lb_store_locale");
    if (saved && translations[saved]) return saved;
    const browserLang = (navigator.languages?.[0] || navigator.language || "en").toLowerCase().split("-")[0];
    return translations[browserLang] ? browserLang : "en";
  }
  function tr(key) { return translations[lang][key] ?? translations.pt[key] ?? key; }
  function applyLanguage(next, remember = false) {
    lang = translations[next] ? next : "en";
    document.documentElement.lang = {pt:"pt-BR",en:"en",es:"es",ru:"ru"}[lang];
    langSelect.value = lang;
    if (remember) localStorage.setItem("lb_store_locale",lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {el.textContent = tr(el.dataset.i18n);});
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {el.innerHTML = tr(el.dataset.i18nHtml);});
    document.title = "Legit Baratinho | " + tr("productsTitle");
    document.querySelector('#purchase-platform option[value="ios"]').textContent = "iOS — " + tr("status_presale");
    if (selectedProduct) renderPlans();
    renderStatuses();
    renderCounterFrameFeatures();
  }
  function money(cents) {
    return (Number(cents)/100).toLocaleString({pt:"pt-BR",en:"en-US",es:"es-ES",ru:"ru-RU"}[lang],{style:"currency",currency:"BRL"});
  }
  function priceForPlan(plan) {
    if(selectedProduct === "counterframe" && market === "INTL") {
      return plan.usdPriceCents != null ? "$" + (plan.usdPriceCents / 100).toFixed(2) + " USD" : "USD";
    }
    return money(plan.priceCents);
  }
  function planName(plan) {
    if (plan.lifetime) return tr("lifetime");
    return String(plan.days) + " " + tr(plan.days===1?"day":"days");
  }
  function purchaseLink() {
    const params = new URLSearchParams({product:selectedProduct,plan:selectedPlan,lang,market:market.toLowerCase()});
    if (selectedProduct==="counterframe") params.set("platform",platformSelect.value);
    return "/checkout?"+params;
  }
  function renderPlans() {
    if (!selectedProduct) return;
    const data = loadedPlans[selectedProduct] || pricesFallback[selectedProduct] || [];
    planGrid.replaceChildren();
    if (!data.find(p=>p.key===selectedPlan)) selectedPlan = "d30";
    for(const plan of data) {
      const button = document.createElement("button");
      button.type = "button";button.className = "plan-button" + (selectedPlan===plan.key?" selected":"");
      button.setAttribute("aria-pressed",String(selectedPlan===plan.key));
      const label = document.createElement("span");label.textContent=planName(plan);
      const price = document.createElement("strong");price.textContent=priceForPlan(plan);
      button.append(label,price);
      button.addEventListener("click",()=>{selectedPlan=plan.key;renderPlans();});
      planGrid.appendChild(button);
    }
    const ios = selectedProduct==="counterframe" && platformSelect.value==="ios";
    iosNotice.hidden = !ios;
    platformChoice.hidden = selectedProduct!=="counterframe";
    marketChoice.hidden = selectedProduct!=="counterframe";
    telegramBtn.hidden = selectedProduct!=="counterframe";
    cardBtn.disabled = !checkoutAvailable;
    const international = selectedProduct === "counterframe" && market === "INTL";
    const note = !checkoutAvailable
      ? (international ? tr("intlCardUnavailable") : tr("checkoutUnavailable"))
      : international ? tr("intlCardNote") + " " + tr("noteStars")
      : selectedProduct==="counterframe" ? tr("noteStars") : tr("buyNote");
    checkoutNote.textContent = ios ? tr("iosRequired")+" "+note : note;
    if (selectedProduct==="counterframe") {
      telegramBtn.href = "https://t.me/LegitCheatsCFBot?start=cf_"+platformSelect.value+"_"+selectedPlan;
    }
  }
  async function openPurchase(product) {
    selectedProduct = product;
    selectedPlan = "d30";
    productTitle.textContent = product==="cs2" ? "Counter-Strike 2" : "Counter-Frame";
    if (product==="counterframe") platformSelect.value="android";
    // MP readiness is verified on the payment page too.
    checkoutAvailable = true;
    try {
      const query = new URLSearchParams({product,market:market.toLowerCase()});
      const response = await fetch("/api/checkout/config?"+query, {cache:"no-store"});
      if(response.ok) {
        const config = await response.json();
        if(Array.isArray(config.plans) && config.plans.length) {
          loadedPlans[product] = config.plans;
        }
        checkoutAvailable = Boolean(config.configured);
      } else checkoutAvailable = false;
    } catch { checkoutAvailable = false; }
    renderPlans();
    if (!dlg.open) dlg.showModal();
  }
  async function refreshStatuses() {
    try {
      const response=await fetch("/api/product-statuses",{cache:"no-store"});
      if(!response.ok) throw Error("unavailable");
      productStatuses=await response.json();
    }catch{productStatuses={};}
    renderStatuses();
  }
  function renderStatuses() {
    for(const key of statuses){
      const button=document.querySelector('[data-status="'+key+'"]');
      const badge=button?.querySelector(".status-badge");
      if(!badge) continue;
      const value=productStatuses[key]?.status;
      const norm=stateLabels.has(value)?value:"loading";
      badge.dataset.value=norm;
      badge.textContent=norm==="loading"?tr("status_loading"):tr("status_"+norm);
    }
    const info=document.getElementById("status-info");
    if (!info.hidden && info.dataset.product) showStatus(info.dataset.product);
  }
  function showStatus(key) {
    const info=document.getElementById("status-info");
    info.dataset.product=key;
    info.hidden=false;
    document.getElementById("status-info-title").textContent=statusNames[key];
    const value=productStatuses[key];
    const code=stateLabels.has(value?.status)?value.status:"offline";
    const generic=tr("statusGeneric_"+code);
    document.getElementById("status-info-body").textContent=
      lang==="pt" && value?.message ? value.message : generic;
  }
  langSelect.addEventListener("change",()=>applyLanguage(langSelect.value,true));
  for(const button of document.querySelectorAll("[data-product]"))button.addEventListener("click",()=>openPurchase(button.dataset.product));
  for(const button of document.querySelectorAll("[data-status]"))button.addEventListener("click",()=>showStatus(button.dataset.status));
  document.getElementById("close-gallery").addEventListener("click",()=>galleryDlg.close());
  galleryDlg.addEventListener("click",(event)=>{if(event.target===galleryDlg)galleryDlg.close();});
  for(const opener of document.querySelectorAll("[data-gallery-open]")) {
    opener.addEventListener("click",()=>{if(!galleryDlg.open)galleryDlg.showModal();});
  }
  document.getElementById("close-dialog").addEventListener("click",()=>dlg.close());
  dlg.addEventListener("click",(event)=>{if(event.target===dlg) dlg.close();});
  platformSelect.addEventListener("change",renderPlans);
  marketSelect.addEventListener("change",()=>{
    market = marketSelect.value === "INTL" ? "INTL" : "BR";
    localStorage.setItem("lb_store_market",market);
    if(selectedProduct==="counterframe")openPurchase(selectedProduct);
  });
  cardBtn.addEventListener("click",()=>{if(selectedProduct&&checkoutAvailable)location.assign(purchaseLink());});
  document.getElementById("year").textContent=new Date().getFullYear();
  applyLanguage(guessLanguage());
  refreshStatuses();
  setInterval(refreshStatuses,30000);
})();