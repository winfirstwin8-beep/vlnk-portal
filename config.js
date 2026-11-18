/* Налаштування підключення. Заповніть після розгортання бекенду (див. ІНСТРУКЦІЯ.md). */
window.VLNK_CONFIG = {
  // Адреса вебзастосунку Apps Script (закінчується на /exec). Якщо порожня — її можна ввести на екрані входу.
  api: 'https://script.google.com/macros/s/AKfycbxpxED3ug2dEPem9MX7MFOXPEuzdrPHo6zrbPWBVxp3n8zi0cjTatIWrveInoc9TctX/exec',
  // Необовʼязково: OAuth Client ID для кнопки «Увійти через Google». Без нього вхід — за email + PIN.
  googleClientId: '',
  // Сервер даних: 'gas' — Google Apps Script (як зараз), 'm365' — Microsoft 365 / SharePoint. Пристрій можна перемкнути в Налаштування → Microsoft 365.
  backend: 'gas',
  m365: {
    tenant: '60c90dc4-2c12-4a20-ace8-b478f9616448',          // Directory (tenant) ID
    clientId: '79058944-feaa-4f19-8362-9d6b998cf1e6',                                           // Application (client) ID — від ІТ-служби після реєстрації застосунку
    site: 'https://cloudtsoua.sharepoint.com/teams/vlnk'      // сайт SharePoint «ВЛНК»
  }
};
