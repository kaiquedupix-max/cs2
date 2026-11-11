(() => {
  const params=new URLSearchParams(location.search);
  const raw=params.get("lang") || (navigator.languages?.[0]||navigator.language||"en");
  const lang=["pt","en","es","ru"].includes(String(raw).toLowerCase().split("-")[0])?String(raw).toLowerCase().split("-")[0]:"en";
  document.documentElement.lang={pt:"pt-BR",en:"en",es:"es",ru:"ru"}[lang];
  const dict={
    pt:{
      account:"Minha conta",secure:"PAGAMENTO",finalize:"Finalize sua compra.",intro:"Escolha o plano, informe seus dados e finalize pelo Mercado Pago. A compra fica registrada na sua conta.",
      plan:"ESCOLHA SEU PLANO",howLong:"Quanto tempo você quer?",buyer:"DADOS DO COMPRADOR",who:"Quem está comprando",name:"Nome completo",cpf:"CPF",email:"E-mail",
      yourAccount:"SUA CONTA",loginOrCreate:"Crie ou entre sem sair da compra",logged:"Conta conectada",linked:"Sua compra será vinculada a esta conta.",
      create:"Criar conta",login:"Já tenho conta",username:"Usuário",password:"Senha",accountNote:"O e-mail informado acima será usado na sua conta.",
      loginIdentifier:"Usuário ou e-mail",loginNote:"Entre aqui e continue o pagamento.",method:"FORMA DE PAGAMENTO",howPay:"Como deseja pagar?",
      loading:"Carregando opções de pagamento...",pixCreated:"Pix gerado com sucesso",copyPix:"Copiar código Pix",waiting:"Aguardando pagamento...",
      approved:"Pagamento aprovado",approvedNote:"Compra confirmada. Consulte seu acesso na área do cliente.",goAccount:"Keys e downloads • Minha conta",
      security:"Pagamento processado pelo Mercado Pago. A ativação depende da aprovação.",
      summary:"RESUMO DO PEDIDO",planLabel:"Plano",duration:"Duração",total:"Total",buySecure:"Compra segura",
      buySecureDetail:"Pagamento processado pelo Mercado Pago.",preorderTitle:"Counter Flame para iOS disponível",
      preorderNotice:"Counter Flame está disponível para iOS.",
      confirmPreorder:"Counter Flame está disponível para iOS.",
      telegramInfo:"Telegram exclusivo do Counter Flame para catálogo e suporte. Pagamentos somente pelo site.",telegramSupport:"Telegram do Counter Flame • Suporte ↗",day:"dia",days:"dias",lifetime:"Vitalício",
      preorderApproved:"Pedido confirmado",preorderApprovedNote:"Seu pedido foi confirmado.",preorderMessage:"Pedido confirmado.",
      approvedMessage:"Pagamento confirmado.",iosConfirmError:"Counter Flame está disponível para iOS."
    },
    en:{
      account:"My account",secure:"PAYMENT",finalize:"Complete your purchase.",intro:"Select a plan, enter your details and pay with Mercado Pago. Your purchase will be linked to your account.",
      plan:"CHOOSE YOUR PLAN",howLong:"Choose your duration",buyer:"BUYER DETAILS",who:"Your details",name:"Full name",cpf:"CPF (optional for foreign buyers)",email:"Email",
      yourAccount:"YOUR ACCOUNT",loginOrCreate:"Create an account or sign in",logged:"Account connected",linked:"Your purchase will be linked to this account.",
      create:"Create account",login:"I have an account",username:"Username",password:"Password",accountNote:"The email above will be used for your account.",
      loginIdentifier:"Username or email",loginNote:"Sign in to complete your purchase.",method:"PAYMENT",howPay:"How would you like to pay?",
      loading:"Loading payment options...",pixCreated:"Pix generated",copyPix:"Copy Pix code",waiting:"Waiting for payment...",
      approved:"Payment approved",approvedNote:"Purchase confirmed. Check your access in My account.",goAccount:"Keys and downloads • My account",
      security:"Mercado Pago processes payments in BRL. Activation follows payment approval.",
      summary:"ORDER SUMMARY",planLabel:"Plan",duration:"Duration",total:"Total",buySecure:"Secure purchase",
      buySecureDetail:"Payment handled by Mercado Pago.",preorderTitle:"Counter Flame for iOS available",
      preorderNotice:"Counter Flame is available for iOS.",
      confirmPreorder:"Counter Flame is available for iOS.",
      telegramInfo:"Counter Flame Telegram is for information and support. Payments are made on the website only.",telegramSupport:"Counter Flame Telegram • Support ↗",day:"day",days:"days",lifetime:"Lifetime",
      preorderApproved:"Order confirmed",preorderApprovedNote:"Your order was confirmed.",preorderMessage:"Order confirmed.",
      approvedMessage:"Payment confirmed.",iosConfirmError:"Please confirm that you understand the Counter Flame for iOS conditions before paying."
    },
    es:{
      account:"Mi cuenta",secure:"PAGO",finalize:"Finaliza tu compra.",intro:"Elige un plan, introduce tus datos y paga con Mercado Pago. Tu compra se vinculará a tu cuenta.",
      plan:"ELIGE TU PLAN",howLong:"¿Cuánto tiempo necesitas?",buyer:"DATOS DEL COMPRADOR",who:"Tus datos",name:"Nombre completo",cpf:"CPF (opcional para extranjeros)",email:"Correo electrónico",
      yourAccount:"TU CUENTA",loginOrCreate:"Crea una cuenta o inicia sesión",logged:"Cuenta conectada",linked:"Tu compra se vinculará a esta cuenta.",
      create:"Crear cuenta",login:"Ya tengo cuenta",username:"Usuario",password:"Contraseña",accountNote:"El correo de arriba se usará para tu cuenta.",
      loginIdentifier:"Usuario o correo",loginNote:"Entra aquí para completar la compra.",method:"PAGO",howPay:"¿Cómo quieres pagar?",
      loading:"Cargando opciones de pago...",pixCreated:"Pix generado",copyPix:"Copiar código Pix",waiting:"Esperando el pago...",
      approved:"Pago aprobado",approvedNote:"Compra confirmada. Consulta tu acceso en Mi cuenta.",goAccount:"Keys y descargas • Mi cuenta",
      security:"Mercado Pago procesa pagos en BRL. La activación depende de la aprobación.",
      summary:"RESUMEN DEL PEDIDO",planLabel:"Plan",duration:"Duración",total:"Total",buySecure:"Compra segura",
      buySecureDetail:"Pago procesado por Mercado Pago.",preorderTitle:"Counter Flame para iOS disponible",
      preorderNotice:"Counter Flame está disponible para iOS.",
      confirmPreorder:"Counter Flame está disponible para iOS.",
      telegramInfo:"Telegram solo para catálogo y soporte de Counter Flame. Pagos únicamente en el sitio.",telegramSupport:"Telegram Counter Flame • Soporte ↗",day:"día",days:"días",lifetime:"De por vida",
      preorderApproved:"Pedido confirmado",preorderApprovedNote:"Tu pedido fue confirmado.",preorderMessage:"Pedido confirmado.",
      approvedMessage:"Pago confirmado.",iosConfirmError:"Counter Flame está disponible para iOS."
    },
    ru:{
      account:"Мой аккаунт",secure:"ОПЛАТА",finalize:"Оформите покупку.",intro:"Выберите тариф, укажите данные и оплатите через Mercado Pago. Покупка будет привязана к аккаунту.",
      plan:"ВЫБЕРИТЕ ТАРИФ",howLong:"Выберите срок",buyer:"ДАННЫЕ ПОКУПАТЕЛЯ",who:"Ваши данные",name:"Полное имя",cpf:"CPF (необязателен для иностранцев)",email:"Эл. почта",
      yourAccount:"АККАУНТ",loginOrCreate:"Создайте аккаунт или войдите",logged:"Аккаунт подключён",linked:"Покупка будет привязана к аккаунту.",
      create:"Регистрация",login:"У меня есть аккаунт",username:"Имя пользователя",password:"Пароль",accountNote:"Указанная почта будет использоваться для аккаунта.",
      loginIdentifier:"Логин или почта",loginNote:"Войдите, чтобы продолжить покупку.",method:"ОПЛАТА",howPay:"Как вы хотите оплатить?",
      loading:"Загрузка способов оплаты...",pixCreated:"Код Pix создан",copyPix:"Скопировать Pix",waiting:"Ожидание оплаты...",
      approved:"Оплата подтверждена",approvedNote:"Покупка оформлена. Проверьте доступ в аккаунте.",goAccount:"Ключи и загрузки • Мой аккаунт",
      security:"Mercado Pago принимает оплату в BRL. Активация после подтверждения оплаты.",
      summary:"ВАШ ЗАКАЗ",planLabel:"Тариф",duration:"Длительность",total:"Итого",buySecure:"Безопасная покупка",
      buySecureDetail:"Обработка платежа через Mercado Pago.",preorderTitle:"Counter Flame для iOS доступен",
      preorderNotice:"Counter Flame доступен для iOS.",
      confirmPreorder:"Counter Flame доступен для iOS.",
      telegramInfo:"Telegram для каталога и поддержки Counter Flame. Оплата только на сайте.",telegramSupport:"Telegram Counter Flame • Поддержка ↗",day:"день",days:"дней",lifetime:"Навсегда",
      preorderApproved:"Заказ подтверждён",preorderApprovedNote:"Заказ подтверждён.",preorderMessage:"Заказ подтверждён.",
      approvedMessage:"Платёж подтверждён.",iosConfirmError:"Counter Flame доступен для iOS."
    }
  };
  const t=(key)=>dict[lang][key] ?? dict.pt[key] ?? key;
  window.lbCheckoutText=t;
  const set=(selector,key)=>{const e=document.querySelector(selector);if(e)e.textContent=t(key);};
  const label=(selector,key)=>{const item=document.querySelector(selector);const e=item?.matches("input") ? item.closest("label") : item;if(e && e.firstChild?.nodeType===Node.TEXT_NODE)e.firstChild.textContent=t(key)+"\n              ";};
  [
    [".header-actions .account-link","account"],[".topbar .button-outline","account"],
    [".checkout-heading .eyebrow","secure"],[".checkout-heading h1","finalize"],["#checkoutIntro","intro"],
    [".checkout-section-title:nth-child(1) small","plan"],
    ["#accountCreateTab","create"],["#accountLoginTab","login"],
    ["#checkoutAccountLogged strong","logged"],["#checkoutAccountLoggedText","linked"],
    ["#accountCreateFields .checkout-account-note","accountNote"],["#accountLoginFields .checkout-account-note","loginNote"],
    ["#paymentLoading","loading"],["#pixResult>strong","pixCreated"],["#copyPixBtn","copyPix"],["#pixStatus","waiting"],
    ["#paymentApproved strong","approved"],["#paymentApproved p","approvedNote"],["#paymentApproved a","goAccount"],
    [".secure-note","security"],[".checkout-summary .eyebrow","summary"],
    ["#cfTelegramInfo","telegramInfo"],[".checkout-security strong","buySecure"],[".checkout-security span","buySecureDetail"]
  ].forEach(([s,k])=>set(s,k));
  const sectionTitles=document.querySelectorAll(".checkout-section-title");
  const sectionKeys=[["plan","howLong"],["buyer","who"],["yourAccount","loginOrCreate"],["method","howPay"]];
  sectionTitles.forEach((section,i)=>{
    const keys=sectionKeys[i];if(!keys)return;
    const small=section.querySelector("small");const h=section.querySelector("h2");
    if(small)small.textContent=t(keys[0]);if(h)h.textContent=t(keys[1]);
  });
  label("#buyerName", "name");
  label("#buyerCpfLabel", "cpf");
  label("#buyerEmail", "email");
  label("#checkoutUsername","username");
  label("#checkoutPassword","password");
  label("#checkoutLoginIdentifier","loginIdentifier");
  label("#checkoutLoginPassword","password");
  document.querySelectorAll("[data-checkout-i18n]").forEach(e=>e.textContent=t(e.dataset.checkoutI18n));
  const summaryLabels=document.querySelectorAll(".summary-row > span");
  ["planLabel","duration","total"].forEach((k,i)=>{if(summaryLabels[i])summaryLabels[i].textContent=t(k);});
  window.lbCheckoutLocale=lang;
})();

