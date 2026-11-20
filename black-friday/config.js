// Настройки лендинга. Меняйте только этот файл.
window.SITE_CONFIG = {
  // true — пока не заполнено всё нужное: показываются заглушки.
  // false — для публикации: пустые поля скрываются, кнопки без ссылки не показываются.
  previewMode: true,

  // Окончание акции (ISO с часовым поясом). Пусто — таймер и даты скрыты, в тексте «Только сейчас».
  saleEndsAt: '2026-11-30T23:59:59+03:00',
  timeZone: 'Europe/Moscow',

  // Цены, ₽ (проценты и экономия считаются автоматически)
  coursePrice: 3990,
  courseOldPrice: 7000,
  sunmakeupPrice: 1990,
  sunmakeupOldPrice: 5000,
  bundlePrice: 5690,
  bundleOldPrice: 12000,

  // Ссылки на оплату (Продамус)
  courseCheckoutUrl: 'https://payform.ru/nud4MpL/',
  sunmakeupCheckoutUrl: 'https://payform.ru/and4MiJ/',
  bundleCheckoutUrl: 'https://payform.ru/snd4Msj/',

  // Сроки доступа
  courseAccess: '3 месяца',
  sunmakeupAccess: '3 месяца',
  bundleAccess: '5 месяцев',
  accessDelivery: '',        // например: 'в течение 15 минут' — добавляется в шаг «Пришлю доступ на почту»

  // Ответы на вопросы про оплату и возврат (пусто — вопрос скрывается на опубликованном сайте)
  faqPayment: '',
  faqRefund: '',

  // Адреса картинок. Пусто — берутся из папки assets/.
  // Для Tilda: загрузите файлы и впишите их ссылки, например bride: 'https://static.tildacdn.com/...'
  images: { bride: '', bathroom: '', evening: '', vanity: '', dior: '', envelope: '', tablet: '', 'elmira-mirror': '', 'bg-flowers': '' },

  // Подвал
  sellerDetails: '',         // реквизиты, переносы строк сохраняются
  offerUrl: '',
  privacyPolicyUrl: '',
  supportContact: '',        // например: '@elmira_support'
  supportUrl: ''             // например: 'https://t.me/elmira_support'
};
