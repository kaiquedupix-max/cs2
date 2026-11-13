// Notice for loaders that cannot update in place to the build signed with the new key.
// Limits come from /api/admin/cf/notifications: title <= 80, body <= 500.
export const OLD_CERT = '92168fe76e8dd4f557e690bb84b071605d872672bc1b7cb6a4ef536fe2f94166';
export const NEW_CERT = '1ba2ec2d9044fe7c250b5b3557837a27a4eac0052792707d8780c9ff0ba701e6';
export const ALLOWED_CERTS = [OLD_CERT, NEW_CERT];

export const MIGRATION_NOTICES = {
  pt: {
    title: 'Atualização importante do Loader',
    body: 'Devido a um problema com a assinatura digital, a próxima versão do nosso Loader não poderá ser instalada automaticamente sobre a versão atual. Para continuar recebendo atualizações, será necessário baixar e instalar manualmente o novo Loader pelo nosso site oficial (legitbaratinho.xyz). Pode ser necessário desinstalar o Loader antigo antes, o que pode apagar os dados locais dele. O jogo e seus dados não são afetados. Agradecemos pela compreensão!'
  },
  en: {
    title: 'Important Loader Update',
    body: 'Due to a digital signature issue, the next version of our Loader cannot be installed automatically over your current version. To continue receiving updates, you will need to manually download and install the new Loader from our official website (legitbaratinho.xyz). You may need to uninstall the old Loader first, which may erase its local data. The game and its data are not affected. Thank you for your understanding!'
  },
  ru: {
    title: 'Важное обновление Loader',
    body: 'Из-за проблемы с цифровой подписью следующая версия нашего Loader не сможет автоматически установиться поверх текущей версии. Чтобы продолжать получать обновления, вам потребуется вручную скачать и установить новый Loader с нашего официального сайта (legitbaratinho.xyz). Возможно, сначала придётся удалить старый Loader, и его локальные данные могут быть стёрты. Игра и её данные не затрагиваются. Спасибо за понимание!'
  },
  es: {
    title: 'Actualización importante del Loader',
    body: 'Debido a un problema con la firma digital, la próxima versión de nuestro Loader no podrá instalarse automáticamente sobre la versión actual. Para seguir recibiendo actualizaciones, tendrás que descargar e instalar manualmente el nuevo Loader desde nuestro sitio web oficial (legitbaratinho.xyz). Puede que debas desinstalar antes el Loader antiguo, lo que puede borrar sus datos locales. El juego y sus datos no se ven afectados. ¡Gracias por tu comprensión!'
  }
};
