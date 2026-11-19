# Публикация на GitHub Pages

1. Создайте на GitHub **новый публичный репозиторий** (например `elmira-black-friday`).
2. Положите в его корень содержимое этой папки: `index.html`, `styles.css`, `config.js`, `main.js`, `assets/`, `.github/`.
3. Репозиторий → Settings → Pages → Source: **GitHub Actions**.
4. Пуш в ветку `main` запускает публикацию. Адрес: `https://<логин>.github.io/<репозиторий>/`.
5. Свой домен: Settings → Pages → Custom domain → впишите домен, включите Enforce HTTPS.
   У регистратора домена:
   - поддомен (`bf.example.ru`): CNAME на `<логин>.github.io`;
   - основной домен: четыре A-записи на 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153.
6. Перед боевым запуском удалите из `index.html` строку `<meta name="robots" content="noindex, nofollow">`.
