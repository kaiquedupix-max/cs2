(() => {
  "use strict";
  const translations = {
    pt: {
      skip:"Pular para o conteúdo", language:"Idioma", navHome:"Início",navProducts:"Produtos",navStatus:"Status",account:"Minha conta",
      eyebrow:"SUA LOJA DIGITAL",heroTitle:"Seu próximo nível <em>começa aqui.</em>",heroLead:"ESP, ajustes de mira e sua licença em um só lugar. Escolha seu plano e receba sua key após a confirmação.",
      explore:"Ver produtos",checkStatus:"Ver status",trust1:"Pagamento seguro",trust2:"Suporte",trust3:"Atualizações",
      androidLive:"Android disponível",ourProducts:"ESCOLHA SEU PRODUTO",productsTitle:"Produtos",productsLead:"Escolha o produto e abra os planos disponíveis.",
      windows:"Windows",csSubtitle:"Planos para o projeto CS2 no Windows.",buy:"Comprar",
      androidAvailable:"Android disponível",iosPresale:"iOS disponível",cfSubtitle:"Android e iOS disponíveis.",
      service:"DISPONIBILIDADE",statusTitle:"Status",statusLead:"Situação informada no painel administrativo.",
      help:"DÚVIDAS RÁPIDAS",faqLead:"O essencial antes da compra.",faqQ1:"Como escolho meu plano?",faqA1:"Clique em Comprar no produto desejado. Os planos aparecem antes de ir para o pagamento.",
      faqQ2:"Quais métodos de pagamento existem?",faqA2:"No Brasil, pague por Pix ou cartão via Mercado Pago. Fora do Brasil, pague com cartão via Stripe. No bot Counter Flame, compre com Telegram Stars.",
      faqQ3:"Como funciona o iOS?",faqA3:"Counter Flame está disponível para iOS.",
      faqQ4:"Como consulto o status?",faqA4:"Abra Status para ver as informações publicadas pela administração.",
      selectPlan:"ESCOLHA SEU PLANO",platform:"Plataforma",presaleTitle:"iOS disponível",iosNotice:"Counter Flame está disponível para iOS.",
      functionsEyebrow:"RECURSOS DO MENU REAL",functionsHeadline:"Funções do Counter Flame",functionsSubhead:"Conheça o ESP, os ajustes de mira e as opções de personalização do Counter Flame.",regionBR:"🇧🇷 Brasil • preços em reais",regionIntl:"🌍 Internacional • preços em dólares",pricingRegion:"Região detectada pelo IP",intlCardUnavailable:"O pagamento internacional com cartão será ativado quando as chaves do Stripe forem configuradas.",intlCardNote:"Clientes fora do Brasil pagam com cartão pelo Stripe.",cfFeatureToggle:"Ver todas as funções do Counter Flame",viewPhotos:"Ver fotos reais do menu",realScreenshots:"CAPTURAS REAIS",realScreenshotsNote:"Fotos reais do menu durante o jogo. Consulte o status da sua plataforma.",payCard:"Continuar com Pix ou cartão",openTelegram:"Comprar no Telegram • Stars",noteStars:"Também disponível no Telegram com Stars e cupons de desconto.",
      buyNote:"Selecione um plano para prosseguir.",checkoutUnavailable:"Pagamento online não configurado. Entre em contato com o suporte.",
      days:"dias",day:"dia",lifetime:"Vitalício",status_loading:"Consultando",status_online:"ONLINE",status_offline:"OFFLINE",status_maintenance:"MANUTENÇÃO",status_coming_soon:"EM BREVE",status_presale:"DISPONÍVEL",
      statusGeneric_online:"Produto disponível conforme o painel.",statusGeneric_offline:"Produto indisponível.",statusGeneric_maintenance:"Produto em manutenção.",statusGeneric_coming_soon:"Lançamento em preparação.",statusGeneric_presale:"Counter Flame está disponível para iOS.",
      iosRequired:"Counter Flame está disponível para iOS."
    },
    en: {
      skip:"Skip to content",language:"Language",navHome:"Home",navProducts:"Products",navStatus:"Status",account:"My account",
      eyebrow:"DIGITAL STORE",heroTitle:"Your next level <em>starts here.</em>",heroLead:"ESP, aim controls and your license in one place. Choose a plan and receive your key after confirmation.",
      explore:"Explore products",checkStatus:"Check status",trust1:"Secure payments",trust2:"Support",trust3:"Updates",
      androidLive:"Android available",ourProducts:"CHOOSE YOUR PRODUCT",productsTitle:"Products",productsLead:"Pick a product to see its plans.",
      windows:"Windows",csSubtitle:"Plans for the CS2 Windows product.",buy:"Buy now",
      androidAvailable:"Android available",iosPresale:"iOS available",cfSubtitle:"Android and iOS available.",
      service:"AVAILABILITY",statusTitle:"Status",statusLead:"Availability published by the admin team.",
      help:"QUICK ANSWERS",faqLead:"What you need to know before buying.",faqQ1:"How do I choose a plan?",faqA1:"Click Buy on the product you want. Plans will appear before checkout.",
      faqQ2:"Which payment methods are available?",faqA2:"In Brazil, pay by Pix or card through Mercado Pago. Outside Brazil, pay by card through Stripe. The Counter Flame bot accepts Telegram Stars.",
      faqQ3:"What about iOS?",faqA3:"Counter Flame is available for iOS.",
      faqQ4:"How do I check the status?",faqA4:"Open Status to see availability updates from the admin team.",
      selectPlan:"CHOOSE YOUR PLAN",platform:"Platform",presaleTitle:"iOS available",iosNotice:"Counter Flame is available for iOS.",
      functionsEyebrow:"REAL MENU FEATURES",functionsHeadline:"Counter Flame features",functionsSubhead:"Explore Counter Flame ESP, aim controls and customization.",regionBR:"🇧🇷 Brazil • prices in BRL",regionIntl:"🌍 International • prices in USD",pricingRegion:"Region detected by IP",intlCardUnavailable:"International card checkout will be enabled after the Stripe keys are configured.",intlCardNote:"Customers outside Brazil pay by card through Stripe.",cfFeatureToggle:"View all Counter Flame features",viewPhotos:"View real menu screenshots",realScreenshots:"REAL SCREENSHOTS",realScreenshotsNote:"Real menu screenshots taken during gameplay. Check your platform status.",payCard:"Continue with Pix or card",openTelegram:"Buy on Telegram • Stars",noteStars:"Also available on Telegram with Stars and discount coupons.",
      buyNote:"Select a plan to continue.",checkoutUnavailable:"Online checkout is not configured. Contact support.",
      days:"days",day:"day",lifetime:"Lifetime",status_loading:"Loading",status_online:"ONLINE",status_offline:"OFFLINE",status_maintenance:"MAINTENANCE",status_coming_soon:"COMING SOON",status_presale:"AVAILABLE",
      statusGeneric_online:"Available as reported by the admin team.",statusGeneric_offline:"Currently unavailable.",statusGeneric_maintenance:"Temporarily under maintenance.",statusGeneric_coming_soon:"Launch in preparation.",statusGeneric_presale:"Counter Flame is available for iOS.",
      iosRequired:"Counter Flame is available for iOS."
    },
    es: {
      skip:"Saltar al contenido",language:"Idioma",navHome:"Inicio",navProducts:"Productos",navStatus:"Estado",account:"Mi cuenta",
      eyebrow:"TIENDA DIGITAL",heroTitle:"Tu próximo nivel <em>empieza aquí.</em>",heroLead:"ESP, ajustes de mira y tu licencia en un solo lugar. Elige un plan y recibe tu key tras la confirmación.",
      explore:"Ver productos",checkStatus:"Ver estado",trust1:"Pagos seguros",trust2:"Soporte",trust3:"Actualizaciones",
      androidLive:"Android disponible",ourProducts:"ELIGE TU PRODUCTO",productsTitle:"Productos",productsLead:"Elige el producto para ver sus planes.",
      windows:"Windows",csSubtitle:"Planes del producto CS2 para Windows.",buy:"Comprar",
      androidAvailable:"Android disponible",iosPresale:"iOS disponible",cfSubtitle:"Android e iOS disponibles.",
      service:"DISPONIBILIDAD",statusTitle:"Estado",statusLead:"Información publicada por administración.",
      help:"RESPUESTAS RÁPIDAS",faqLead:"Lo esencial antes de comprar.",faqQ1:"¿Cómo elijo un plan?",faqA1:"Pulsa Comprar en el producto. Los planes se muestran antes del pago.",
      faqQ2:"¿Qué métodos de pago hay?",faqA2:"En Brasil, paga con Pix o tarjeta por Mercado Pago. Fuera de Brasil, paga con tarjeta por Stripe. El bot Counter Flame acepta Telegram Stars.",
      faqQ3:"¿Cómo funciona iOS?",faqA3:"Counter Flame está disponible para iOS.",
      faqQ4:"¿Cómo consulto el estado?",faqA4:"Abre Estado para ver la información publicada por administración.",
      selectPlan:"ELIGE TU PLAN",platform:"Plataforma",presaleTitle:"iOS disponible",iosNotice:"Counter Flame está disponible para iOS.",
      functionsEyebrow:"FUNCIONES DEL MENÚ REAL",functionsHeadline:"Funciones de Counter Flame",functionsSubhead:"Descubre el ESP, los ajustes de mira y la personalización de Counter Flame.",regionBR:"🇧🇷 Brasil • precios en reales",regionIntl:"🌍 Internacional • precios en USD",pricingRegion:"Región detectada por IP",intlCardUnavailable:"El pago internacional con tarjeta se activará cuando se configuren las claves de Stripe.",intlCardNote:"Los clientes fuera de Brasil pagan con tarjeta por Stripe.",cfFeatureToggle:"Ver todas las funciones de Counter Flame",viewPhotos:"Ver capturas reales del menú",realScreenshots:"CAPTURAS REALES",realScreenshotsNote:"Capturas reales del menú durante el juego. Consulta el estado de tu plataforma.",payCard:"Continuar con Pix o tarjeta",openTelegram:"Comprar en Telegram • Stars",noteStars:"También disponible en Telegram con Stars y cupones.",
      buyNote:"Selecciona un plan para continuar.",checkoutUnavailable:"El pago online no está configurado. Contacta con soporte.",
      days:"días",day:"día",lifetime:"De por vida",status_loading:"Cargando",status_online:"DISPONIBLE",status_offline:"SIN SERVICIO",status_maintenance:"MANTENIMIENTO",status_coming_soon:"PRÓXIMAMENTE",status_presale:"DISPONIBLE",
      statusGeneric_online:"Disponible según administración.",statusGeneric_offline:"No disponible actualmente.",statusGeneric_maintenance:"En mantenimiento temporal.",statusGeneric_coming_soon:"Lanzamiento en preparación.",statusGeneric_presale:"Counter Flame está disponible para iOS.",
      iosRequired:"Counter Flame está disponible para iOS."
    },
    ru: {
      skip:"Перейти к содержимому",language:"Язык",navHome:"Главная",navProducts:"Продукты",navStatus:"Статус",account:"Мой аккаунт",
      eyebrow:"ЦИФРОВОЙ МАГАЗИН",heroTitle:"Новый уровень <em>начинается здесь.</em>",heroLead:"ESP, настройки прицела и лицензия в одном месте. Выберите тариф и получите ключ после подтверждения.",
      explore:"Смотреть продукты",checkStatus:"Проверить статус",trust1:"Безопасная оплата",trust2:"Поддержка",trust3:"Обновления",
      androidLive:"Android доступен",ourProducts:"ВЫБЕРИТЕ ПРОДУКТ",productsTitle:"Продукты",productsLead:"Выберите продукт, чтобы увидеть тарифы.",
      windows:"Windows",csSubtitle:"Тарифы продукта CS2 для Windows.",buy:"Купить",
      androidAvailable:"Android доступен",iosPresale:"iOS доступен",cfSubtitle:"Доступно для Android и iOS.",
      service:"ДОСТУПНОСТЬ",statusTitle:"Статус",statusLead:"Информация от администрации.",
      help:"КРАТКИЕ ОТВЕТЫ",faqLead:"Важная информация перед покупкой.",faqQ1:"Как выбрать тариф?",faqA1:"Нажмите «Купить» у нужного продукта. Тарифы появятся до оплаты.",
      faqQ2:"Какие способы оплаты?",faqA2:"В Бразилии платите через Mercado Pago картой или Pix. За пределами Бразилии оплата картой через Stripe. Бот Counter Flame принимает Telegram Stars.",
      faqQ3:"Что с iOS?",faqA3:"Counter Flame доступен для iOS.",
      faqQ4:"Где проверить статус?",faqA4:"Откройте раздел «Статус» для информации администрации.",
      selectPlan:"ВЫБЕРИТЕ ТАРИФ",platform:"Платформа",presaleTitle:"iOS доступен",iosNotice:"Counter Flame доступен для iOS.",
      functionsEyebrow:"ФУНКЦИИ РЕАЛЬНОГО МЕНЮ",functionsHeadline:"Функции Counter Flame",functionsSubhead:"Узнайте о функциях ESP, настройках прицела и персонализации Counter Flame.",regionBR:"🇧🇷 Бразилия • цены в реалах",regionIntl:"🌍 Международные цены в USD",pricingRegion:"Регион определён по IP",intlCardUnavailable:"Оплата иностранными картами будет включена после настройки ключей Stripe.",intlCardNote:"Покупатели за пределами Бразилии платят картой через Stripe.",cfFeatureToggle:"Все функции Counter Flame",viewPhotos:"Реальные скриншоты меню",realScreenshots:"РЕАЛЬНЫЕ СНИМКИ",realScreenshotsNote:"Реальные снимки меню во время игры. Проверяйте статус платформы.",payCard:"Перейти к оплате картой или Pix",openTelegram:"Купить в Telegram • Stars",noteStars:"Также доступно в Telegram за Stars с промокодами.",
      buyNote:"Выберите тариф для продолжения.",checkoutUnavailable:"Онлайн-оплата не настроена. Обратитесь в поддержку.",
      days:"дней",day:"день",lifetime:"Навсегда",status_loading:"Загрузка",status_online:"ДОСТУПНО",status_offline:"НЕДОСТУПНО",status_maintenance:"НА ОБСЛУЖИВАНИИ",status_coming_soon:"СКОРО",status_presale:"ДОСТУПНО",
      statusGeneric_online:"Доступно по данным администрации.",statusGeneric_offline:"Сейчас недоступно.",statusGeneric_maintenance:"Временно на обслуживании.",statusGeneric_coming_soon:"Подготовка к запуску.",statusGeneric_presale:"Counter Flame доступен для iOS.",
      iosRequired:"Counter Flame доступен для iOS."
    }
  };

  Object.assign(translations.pt,{intlCardUnavailable:'O pagamento internacional por cartão será ativado quando as chaves do Stripe forem configuradas.',intlCardNote:'Clientes fora do Brasil pagam com cartão pelo Stripe.',payStripe:'Pagar com Stripe',faqA2:'No Brasil, pague por Pix ou cartão via Mercado Pago. Fora do Brasil, pague com cartão via Stripe. No bot Counter Flame, compre com Telegram Stars.'});
  Object.assign(translations.en,{intlCardUnavailable:'International card checkout will be enabled after the Stripe keys are configured.',intlCardNote:'Customers outside Brazil pay by card through Stripe.',payStripe:'Pay with Stripe',faqA2:'In Brazil, pay by Pix or card through Mercado Pago. Outside Brazil, pay by card through Stripe. The Counter Flame bot accepts Telegram Stars.'});
  Object.assign(translations.es,{intlCardUnavailable:'El pago internacional con tarjeta se activará cuando se configuren las claves de Stripe.',intlCardNote:'Los clientes fuera de Brasil pagan con tarjeta por Stripe.',payStripe:'Pagar con Stripe',faqA2:'En Brasil, paga con Pix o tarjeta por Mercado Pago. Fuera de Brasil, paga con tarjeta por Stripe. El bot Counter Flame acepta Telegram Stars.'});
  Object.assign(translations.ru,{intlCardUnavailable:'Оплата иностранными картами будет включена после настройки ключей Stripe.',intlCardNote:'Покупатели за пределами Бразилии платят картой через Stripe.',payStripe:'Оплатить через Stripe',faqA2:'В Бразилии платите через Mercado Pago картой или Pix. За пределами Бразилии оплата картой через Stripe. Бот Counter Flame принимает Telegram Stars.'});


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
  const statusNames = {"cs2":"CS2 • Windows","counterFrameAndroid":"Counter Flame • Android","counterFrameIos":"Counter Flame • iOS"};
  const langSelect = document.getElementById("site-language");
  const dlg = document.getElementById("purchase-dialog");
  const galleryDlg = document.getElementById("gallery-dialog");
  const productTitle = document.getElementById("purchase-title");
  const planGrid = document.getElementById("modal-plans");
  const platformChoice = document.getElementById("platform-choice");
  const marketChoice = document.getElementById("pricing-region-choice");
  const detectedRegion = document.getElementById("detected-region");
  const platformSelect = document.getElementById("purchase-platform");
  const iosNotice = document.getElementById("ios-notice");
  const cardBtn = document.getElementById("pay-card");
  const telegramBtn = document.getElementById("pay-stars");
  const checkoutNote = document.getElementById("checkout-note");
  let lang = "pt", selectedProduct = null, selectedPlan = "d30", loadedPlans = pricesFallback, checkoutAvailable = true, productStatuses = {};
  // Price region always comes from the server-side IP check, never the browser language.
  let market = "INTL";
  let regionResolved = false;

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
    document.querySelector('#purchase-platform option[value="ios"]').textContent = "iOS";
    if (selectedProduct) renderPlans();
    renderStatuses();
    renderCounterFrameFeatures();
    if (regionResolved) detectedRegion.textContent = tr(market === "BR" ? "regionBR" : "regionIntl");
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
    const ref=localStorage.getItem("lb_referral");if(ref)params.set("ref",ref);
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
    iosNotice.hidden = true;
    platformChoice.hidden = selectedProduct!=="counterframe";
    marketChoice.hidden = selectedProduct !== "counterframe";
    detectedRegion.textContent = regionResolved
      ? tr(market === "BR" ? "regionBR" : "regionIntl")
      : "...";
    // Telegram is informational and is NEVER offered on the CS2 checkout.
    telegramBtn.hidden = selectedProduct !== "counterframe";
    cardBtn.disabled = !checkoutAvailable;
    const international = selectedProduct === "counterframe" && market === "INTL";
    cardBtn.textContent=international?tr('payStripe'):tr('payCard');
    const note = !checkoutAvailable
      ? (international ? tr("intlCardUnavailable") : tr("checkoutUnavailable"))
      : international ? tr("intlCardNote")
      : selectedProduct==="counterframe" ? tr("noteStars") : tr("buyNote");
    checkoutNote.textContent = ios ? tr("iosRequired")+" "+note : note;
    if (selectedProduct==="counterframe") {
      telegramBtn.href = "https://t.me/LegitCheatsCFBot?start=cf_"+platformSelect.value+"_"+selectedPlan;
    }
  }
  async function openPurchase(product) {
    selectedProduct = product;
    selectedPlan = "d30";
    productTitle.textContent = product==="cs2" ? "Counter-Strike 2" : "Counter Flame";
    if (product==="counterframe") platformSelect.value="android";
    checkoutAvailable = false;
    regionResolved = product !== "counterframe";
    if (!dlg.open) dlg.showModal();
    renderPlans();
    try {
      const response = await fetch("/api/checkout/config?product=" + encodeURIComponent(product), {cache:"no-store"});
      if(!response.ok) throw Error("checkout_unavailable");
      const config = await response.json();
      if (selectedProduct !== product) return;
      market = product === "counterframe" && config.market !== "BR" ? "INTL" : "BR";
      regionResolved = true;
      if(Array.isArray(config.plans) && config.plans.length) loadedPlans[product] = config.plans;
      checkoutAvailable = Boolean(config.configured);
    } catch {
      checkoutAvailable = false;
      if(product === "counterframe") market = "INTL";
      regionResolved = true;
    }
    if (selectedProduct === product) renderPlans();
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

  cardBtn.addEventListener("click",()=>{if(selectedProduct&&checkoutAvailable)location.assign(purchaseLink());});
  document.getElementById("year").textContent=new Date().getFullYear();
  applyLanguage(guessLanguage());
  refreshStatuses();
  setInterval(refreshStatuses,30000);
})();

