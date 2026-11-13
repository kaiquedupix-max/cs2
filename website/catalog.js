// Storefront catalog. The home page renders one card per entry and /produto/<slug> renders its page.
// To launch a new product: add an entry here (and its plans in mercadoPago.js + product code in server.js).
export const PRODUCT_CATALOG = [
  {
    slug: "counter-strike-2",
    checkoutProduct: "cs2",
    name: "Counter-Strike 2",
    tag: "PC • Windows",
    tagline: "ESP, mira e movimento para o Counter-Strike 2 no Windows.",
    glyph: "CS2",
    info: ["Counter-Strike 2", "Compatível com Windows 10 e 11"],
    screenshots: [],
    functions: [
      { title: "Mira", items: ["Aimbot", "Controle de recuo (RCS)", "TriggerBot"] },
      { title: "Visuais (ESP)", items: ["Caixa", "Esqueleto", "Nome", "Distância", "Barra de vida e de colete", "Chams", "Radar", "Rastros e linhas", "Bomba (C4) e temporizador", "Ping e lista de espectadores", "Visuais do mundo"] },
      { title: "Movimento e extras", items: ["Bunny hop", "Assistência de movimento", "Alterador de FOV", "Terceira pessoa", "Sem flash", "Hit marker e sons de acerto", "Skin changer"] },
      { title: "Configurações", items: ["Perfis de configuração (salvar, carregar, excluir)", "Cores, opacidade e animações", "Tecla do menu configurável"] }
    ],
    tutorial: [
      "Compre o plano e entre no loader com o mesmo usuário e senha do site. O primeiro login vincula o seu PC (HWID).",
      "No CS2, configure o vídeo em tela cheia em janela (borderless).",
      "No loader, escolha Counter-Strike 2 e clique em iniciar.",
      "Entre em uma partida e pressione INSERT para abrir o menu."
    ]
  },
  {
    slug: "combat-arms-external-brasil-7",
    checkoutProduct: "combatarms",
    name: "Combat Arms External Brasil 7",
    tag: "PC • Windows 10 e 11",
    tagline: "External para o servidor Combat Arms Brasil 7.",
    art: "/media/cabr_esp.webp",
    glyph: "CA",
    info: ["External para o servidor Combat Arms Brasil 7", "Compatível com Windows 10 e 11"],
    screenshots: [
      { src: "/media/cabr_esp.webp", caption: "Menu ESP" },
      { src: "/media/cabr_aimbot.webp", caption: "Menu Aimbot" },
      { src: "/media/cabr_game.webp", caption: "Em partida: caixa, esqueleto, nome e distância" }
    ],
    functions: [
      { title: "ESP", items: ["Caixa: completa, preenchida, somente cantos, cantos preenchidos ou preenchida + cantos", "Esqueleto e círculo da cabeça", "Nome e distância em metros (escala ajustável)", "Sua barra de vida", "Somente inimigos; distância máxima, opacidade e espessura", "Todas as cores configuráveis, com prévia ao vivo no menu"] },
      { title: "Aimbot", items: ["Tecla configurável (padrão: botão direito do mouse)", "FOV em pixels, com círculo opcional na tela", "Suavização (1–30), distância máxima, zona morta e ajuste da cabeça", "Boneco clicável de hitboxes: cabeça, pescoço, peito, abdômen, pélvis, braços e pernas; com várias marcadas, a mira sorteia uma", "Calibração da sensibilidade (F6) e calibração automática ao entrar na partida"] },
      { title: "Config", items: ["Salvar e carregar configurações", "Marca d’água ligável/desligável", "Tela cheia sem bordas (F7)", "Atalhos: INSERT abre/fecha o menu, END encerra"] }
    ],
    tutorial: [
      "Compre o plano e entre no loader com o mesmo usuário e senha do site. O primeiro login vincula o seu PC (HWID).",
      "No jogo, abra as opções de vídeo e escolha modo janela na resolução do seu monitor.",
      "Abra o loader como administrador, escolha Combat Arms External Brasil 7 e clique em iniciar. O jogo também roda como administrador.",
      "Entre em uma partida e pressione F7 (ou o botão na aba Config): a janela perde a borda e cobre o monitor inteiro. Fica como tela cheia e o overlay aparece.",
      "Se marcar “Tela cheia sem bordas ao iniciar” na aba Config, o F7 passa a ser automático.",
      "INSERT abre o menu. Pressione F6 vivo, dentro da partida, para calibrar o aimbot."
    ],
    warning: "Tela cheia exclusiva (D3D9) ignora o overlay externo. Se nada aparecer, volte ao modo janela e use o F7."
  },
  {
    slug: "counter-flame",
    checkoutProduct: "counterframe",
    name: "Counter Flame",
    tag: "Mobile • Android e iOS",
    tagline: "Counter Flame para Android e iOS, com ESP e ajustes de mira.",
    art: "/media/counterframe_aimbot.jpg",
    glyph: "CF",
    mobile: true,
    info: ["Android e iOS"],
    screenshots: [
      { src: "/media/counterframe_esp.jpg", caption: "Menu ESP" },
      { src: "/media/counterframe_aimbot.jpg", caption: "Menu Aimbot" },
      { src: "/media/counterframe_gameplay.jpg", caption: "Em jogo" }
    ],
    functions: [
      { title: "Visual • ESP", items: ["Ativar ESP", "Caixa (Box)", "Esqueleto", "Nome", "Vida", "Distância", "Arma", "Linha de mira"] },
      { title: "Configurações do ESP", items: ["Tipo de caixa", "Espessura", "Arredondamento", "Opacidade", "Tamanho do texto"] },
      { title: "Mira • Aimbot", items: ["Ativar mira", "Círculo de FOV", "Ativação: Sempre no FOV", "Ativação: Só ao disparar", "Hitbox: Cabeça", "Hitbox: Pescoço", "Hitbox: Peito"] },
      { title: "Ajustes da mira", items: ["FOV", "Suavidade", "Força de assistência", "Alcance máximo", "Filtros da mira"] }
    ],
    tutorial: [
      "Escolha a plataforma (Android ou iOS) e o plano, e conclua o pagamento.",
      "Depois da confirmação, a sua key aparece na página da conta.",
      "Baixe o loader da sua plataforma na conta e ative com a key."
    ]
  }
];

export const catalogView = () => PRODUCT_CATALOG;
