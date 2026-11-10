(() => {
  const params=new URLSearchParams(location.search);
  const raw=params.get("lang") || (navigator.languages?.[0]||navigator.language||"en");
  const lang=["pt","en","es","ru"].includes(String(raw).toLowerCase().split("-")[0])?String(raw).toLowerCase().split("-")[0]:"en";
  document.documentElement.lang={pt:"pt-BR",en:"en",es:"es",ru:"ru"}[lang];
  const dict={
    pt:{
      account:"Minha conta",secure:"CHECKOUT SEGURO",finalize:"Finalize sua compra.",intro:"Escolha o plano, informe seus dados e finalize pelo Mercado Pago. A compra fica registrada na sua conta.",
      plan:"ESCOLHA SEU PLANO",howLong:"Quanto tempo você quer?",buyer:"DADOS DO COMPRADOR",who:"Quem está comprando",name:"Nome completo",cpf:"CPF",email:"E-mail",
      yourAccount:"SUA CONTA",loginOrCreate:"Crie ou entre sem sair da compra",logged:"Conta conectada",linked:"Sua compra será vinculada a esta conta.",
      create:"Criar conta",login:"Já tenho conta",username:"Usuário",password:"Senha",accountNote:"O e-mail informado acima será usado na sua conta.",
      loginIdentifier:"Usuário ou e-mail",loginNote:"Entre aqui e continue o pagamento.",method:"FORMA DE PAGAMENTO",howPay:"Como deseja pagar?",
      loading:"Carregando pagamento seguro...",pixCreated:"Pix gerado com sucesso",copyPix:"Copiar código Pix",waiting:"Aguardando pagamento...",
      approved:"Pagamento aprovado",approvedNote:"Compra confirmada. Consulte seu acesso na área do cliente.",goAccount:"Ir para minha conta",
      security:"Pagamento processado pelo Mercado Pago. A ativação depende da aprovação. No iOS, a compra é uma pré-venda e não libera acesso imediato.",
      summary:"RESUMO DO PEDIDO",planLabel:"Plano",duration:"Duração",total:"Total",buySecure:"Compra segura",
      buySecureDetail:"Pagamento processado pelo Mercado Pago.",preorderTitle:"IMPORTANTE: Pré-venda para iOS",
      preorderNotice:"A versão iOS ainda não foi lançada. Esta é uma compra antecipada, sem acesso imediato. Ainda não existe data confirmada para o lançamento.",
      confirmPreorder:"Estou ciente de que esta é uma pré-compra sem acesso imediato e sem data de lançamento confirmada.",
      telegramInfo:"O Telegram Stars estará disponível quando o bot estiver ativo.",day:"dia",days:"dias",lifetime:"Vitalício",
      preorderApproved:"Pré-venda confirmada",preorderApprovedNote:"Seu pedido foi registrado. O acesso será liberado somente após o lançamento da versão iOS.",preorderMessage:"Pré-compra confirmada. Aguardando lançamento iOS.",
      approvedMessage:"Pagamento confirmado.",iosConfirmError:"Confirme que entende as condições da pré-venda iOS antes de pagar."
    },
    en:{
      account:"My account",secure:"SECURE CHECKOUT",finalize:"Complete your purchase.",intro:"Select a plan, enter your details and pay with Mercado Pago. Your purchase will be linked to your account.",
      plan:"CHOOSE YOUR PLAN",howLong:"Choose your duration",buyer:"BUYER DETAILS",who:"Your details",name:"Full name",cpf:"CPF (optional for foreign buyers)",email:"Email",
      yourAccount:"YOUR ACCOUNT",loginOrCreate:"Create an account or sign in",logged:"Account connected",linked:"Your purchase will be linked to this account.",
      create:"Create account",login:"I have an account",username:"Username",password:"Password",accountNote:"The email above will be used for your account.",
      loginIdentifier:"Username or email",loginNote:"Sign in to complete your purchase.",method:"PAYMENT",howPay:"How would you like to pay?",
      loading:"Loading secure checkout...",pixCreated:"Pix generated",copyPix:"Copy Pix code",waiting:"Waiting for payment...",
      approved:"Payment approved",approvedNote:"Purchase confirmed. Check your access in My account.",goAccount:"Go to my account",
      security:"Mercado Pago processes payments in BRL. Access depends on approval. An iOS purchase is a pre-order and does not give immediate access.",
      summary:"ORDER SUMMARY",planLabel:"Plan",duration:"Duration",total:"Total",buySecure:"Secure purchase",
      buySecureDetail:"Payment handled by Mercado Pago.",preorderTitle:"IMPORTANT: iOS pre-order",
      preorderNotice:"The iOS version has not yet been released. This is a pre-order, with no immediate access and no confirmed release date.",
      confirmPreorder:"I understand this is an iOS pre-order with no immediate access and no confirmed release date.",
      telegramInfo:"Telegram Stars will be available after the bot is activated.",day:"day",days:"days",lifetime:"Lifetime",
      preorderApproved:"Pre-order confirmed",preorderApprovedNote:"Your order was recorded. Access will be granted only when the iOS version launches.",preorderMessage:"Pre-order confirmed. Awaiting iOS release.",
      approvedMessage:"Payment confirmed.",iosConfirmError:"Please confirm that you understand the iOS pre-order conditions before paying."
    },
    es:{
      account:"Mi cuenta",secure:"PAGO SEGURO",finalize:"Finaliza tu compra.",intro:"Elige un plan, introduce tus datos y paga con Mercado Pago. Tu compra se vinculará a tu cuenta.",
      plan:"ELIGE TU PLAN",howLong:"¿Cuánto tiempo necesitas?",buyer:"DATOS DEL COMPRADOR",who:"Tus datos",name:"Nombre completo",cpf:"CPF (opcional para extranjeros)",email:"Correo electrónico",
      yourAccount:"TU CUENTA",loginOrCreate:"Crea una cuenta o inicia sesión",logged:"Cuenta conectada",linked:"Tu compra se vinculará a esta cuenta.",
      create:"Crear cuenta",login:"Ya tengo cuenta",username:"Usuario",password:"Contraseña",accountNote:"El correo de arriba se usará para tu cuenta.",
      loginIdentifier:"Usuario o correo",loginNote:"Entra aquí para completar la compra.",method:"PAGO",howPay:"¿Cómo quieres pagar?",
      loading:"Cargando pago seguro...",pixCreated:"Pix generado",copyPix:"Copiar código Pix",waiting:"Esperando el pago...",
      approved:"Pago aprobado",approvedNote:"Compra confirmada. Consulta tu acceso en Mi cuenta.",goAccount:"Ir a mi cuenta",
      security:"Mercado Pago procesa el pago en reales (BRL). iOS es una preventa sin acceso inmediato.",
      summary:"RESUMEN DEL PEDIDO",planLabel:"Plan",duration:"Duración",total:"Total",buySecure:"Compra segura",
      buySecureDetail:"Pago procesado por Mercado Pago.",preorderTitle:"IMPORTANTE: Preventa iOS",
      preorderNotice:"La versión de iOS aún no se lanzó. Compras por adelantado, sin acceso inmediato ni fecha confirmada.",
      confirmPreorder:"Entiendo que compro en preventa iOS, sin acceso inmediato ni fecha confirmada de lanzamiento.",
      telegramInfo:"Telegram Stars estará disponible cuando se active el bot.",day:"día",days:"días",lifetime:"De por vida",
      preorderApproved:"Preventa confirmada",preorderApprovedNote:"Tu pedido está registrado. El acceso llegará después del lanzamiento de iOS.",preorderMessage:"Preventa confirmada. Pendiente de lanzamiento iOS.",
      approvedMessage:"Pago confirmado.",iosConfirmError:"Confirma que entiendes las condiciones de preventa de iOS antes de pagar."
    },
    ru:{
      account:"Мой аккаунт",secure:"БЕЗОПАСНАЯ ОПЛАТА",finalize:"Оформите покупку.",intro:"Выберите тариф, укажите данные и оплатите через Mercado Pago. Покупка будет привязана к аккаунту.",
      plan:"ВЫБЕРИТЕ ТАРИФ",howLong:"Выберите срок",buyer:"ДАННЫЕ ПОКУПАТЕЛЯ",who:"Ваши данные",name:"Полное имя",cpf:"CPF (необязателен для иностранцев)",email:"Эл. почта",
      yourAccount:"АККАУНТ",loginOrCreate:"Создайте аккаунт или войдите",logged:"Аккаунт подключён",linked:"Покупка будет привязана к аккаунту.",
      create:"Регистрация",login:"У меня есть аккаунт",username:"Имя пользователя",password:"Пароль",accountNote:"Указанная почта будет использоваться для аккаунта.",
      loginIdentifier:"Логин или почта",loginNote:"Войдите, чтобы продолжить покупку.",method:"ОПЛАТА",howPay:"Как вы хотите оплатить?",
      loading:"Загрузка оплаты...",pixCreated:"Код Pix создан",copyPix:"Скопировать Pix",waiting:"Ожидание оплаты...",
      approved:"Оплата подтверждена",approvedNote:"Покупка оформлена. Проверьте доступ в аккаунте.",goAccount:"Мой аккаунт",
      security:"Mercado Pago принимает оплату в BRL. Для iOS доступен лишь предзаказ без мгновенного доступа.",
      summary:"ВАШ ЗАКАЗ",planLabel:"Тариф",duration:"Длительность",total:"Итого",buySecure:"Безопасная покупка",
      buySecureDetail:"Обработка платежа через Mercado Pago.",preorderTitle:"ВАЖНО: Предзаказ iOS",
      preorderNotice:"Версия для iOS ещё не вышла. Это предзаказ без мгновенного доступа и без подтверждённой даты выпуска.",
      confirmPreorder:"Я понимаю, что это предзаказ iOS без мгновенного доступа и даты выпуска.",
      telegramInfo:"Telegram Stars станет доступен после запуска бота.",day:"день",days:"дней",lifetime:"Навсегда",
      preorderApproved:"Предзаказ подтверждён",preorderApprovedNote:"Заказ зарегистрирован. Доступ откроется после выхода версии iOS.",preorderMessage:"Предзаказ зарегистрирован. Ожидается выход iOS.",
      approvedMessage:"Платёж подтверждён.",iosConfirmError:"Подтвердите условия предзаказа iOS перед оплатой."
    }
  };
  const t=(key)=>dict[lang][key] ?? dict.pt[key] ?? key;
  window.lbCheckoutText=t;
  const set=(selector,key)=>{const e=document.querySelector(selector);if(e)e.textContent=t(key);};
  const label=(selector,key)=>{const e=document.querySelector(selector);if(e && e.firstChild?.nodeType===Node.TEXT_NODE)e.firstChild.textContent=t(key)+"\n              ";};
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