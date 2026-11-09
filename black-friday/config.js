// Настройки лендинга. Меняйте только этот файл.
window.SITE_CONFIG = {
  // true — пока не заполнены ссылки/реквизиты: показываются заглушки и неактивные кнопки.
  // false — для публикации: пустые поля скрываются, кнопки без ссылки не показываются.
  previewMode: true,

  // Окончание акции (ISO с часовым поясом). Пусто — таймер и даты скрыты, в тексте «Только сейчас».
  saleEndsAt: '2026-11-30T23:59:59+03:00',
  // Часовой пояс для отображения даты («30 ноября»)
  timeZone: 'Europe/Moscow',

  // Цены, ₽ (проценты и экономия считаются автоматически)
  coursePrice: 3990,
  courseOldPrice: 5500,
  sunmakeupPrice: 1990,
  sunmakeupOldPrice: 3000,
  bundlePrice: 5780,

  // Ссылки на оплату
  courseCheckoutUrl: '',
  sunmakeupCheckoutUrl: '',
  bundleCheckoutUrl: '',

  // Сроки доступа
  courseAccess: '3 месяца',
  sunmakeupAccess: '',       // например: '1 месяц'
  accessDelivery: '',        // например: 'на почту' — добавляется в «Как проходит обучение»

  // Контент
  guideImage: '',            // путь/URL картинки с фрагментом гайда

  // Подвал
  sellerDetails: '',         // реквизиты, переносы строк сохраняются
  offerUrl: '',
  privacyPolicyUrl: '',
  supportContact: '',        // например: '@elmira_support'
  supportUrl: ''             // например: 'https://t.me/elmira_support'
};
