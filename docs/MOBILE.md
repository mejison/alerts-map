# ВАРТА для iOS та Android

Застосунки використовують **Capacitor 8** і поточну React-карту. HTML, JavaScript, геометрія та шрифти входять у пакет; `server.url` не використовується. Зміни інтерфейсу потрапляють у застосунок після нової збірки. Актуальні тривоги надходять з чинного API й WebSocket, а не з кешу.

Ідентифікатор обох застосунків: `ua.varta.alerts`. Назва на пристрої: ВАРТА. Перед реєстрацією ідентифікатора в магазинах перевірте, що він доступний у вашій організації.

## Збірка

```sh
npm ci
npm run mobile:sync
npm run mobile:ios
# або
npm run mobile:android
```

`mobile:sync` перебудовує `dist-mobile/` і копіює вебресурси в обидва проєкти. Нативні каталоги `ios/` і `android/` зберігаються в Git, скопійовані вебресурси та секрети — ні. `npm run mobile:check` перевіряє інструменти.

iOS: потрібен Xcode 26+; мінімальна iOS — 15. Android: Java 21, Android SDK 36; мінімальна Android — 7/API 24. Іконки й splash-екрани згенеровані з `resources/icon.svg`.

Workflow `.github/workflows/mobile-build.yml` створює Android debug APK та iOS Simulator `.app` без приватних ключів. Артефакти: **Actions → Mobile builds → конкретний запуск → Artifacts**. Simulator `.app` не встановлюється на фізичний iPhone. APK має тестовий підпис; він не є фінальним пакетом для Google Play. Різні CI-запуски можуть мати різний debug-підпис, тому для перевстановлення тестової версії може знадобитися видалення попередньої.

## Нативні push через OneSignal

Використовується офіційний `@onesignal/capacitor-plugin`, App ID `3471bd1d-58b7-4529-903a-aca7f27149f5`. Вебверсія продовжує використовувати Web SDK v16 та окремий service worker. У нативному застосунку service worker не реєструється: повідомлення доставляють APNs/FCM, навіть коли застосунок закритий.

1. У **тому самому OneSignal app → Settings → Push & In-App** додайте платформи iOS та Android.
2. **iOS:** створіть Apple Developer membership; зареєструйте App ID `ua.varta.alerts` з Push Notifications. Завантажте APNs `.p8` у OneSignal і вкажіть Key ID, Team ID та Bundle ID. У Xcode оберіть свою signing team. Push capability, `aps-environment` для Debug/Release, Background Remote Notifications та `ios.handleApplicationNotifications: false` уже налаштовані.
3. **Android:** створіть Firebase-проєкт і Android app `ua.varta.alerts`; налаштуйте FCM v1 service account у OneSignal. За потреби вашого Firebase-проєкту покладіть клієнтський `google-services.json` у `android/app/` (він ігнорується Git). Приватний service-account JSON завантажуйте тільки в OneSignal, не в Git і не в мобільний пакет.
4. Після налаштування платформ додайте в Netlify **Production** `ONESIGNAL_IOS_READY=true` та/або `ONESIGNAL_ANDROID_READY=true`. До цього тестовий застосунок чесно показує, що нативні сповіщення ще готуються. Наявний `ONESIGNAL_REST_API_KEY` лишається тільки на сервері.
5. Перебудуйте, встановіть на фізичний пристрій, виберіть область, дозвольте сповіщення і натисніть **Перевірити**. Підписка вважається готовою після появи OneSignal Subscription ID, push-токена та opt-in.
6. Перевірте отримання тесту у foreground, background і після закриття застосунку, а також відкриття правильної області при натисканні. Перевірте зміну області, відписку та повторну підписку. Далі перевірте реальну зміну стану тривоги через чинний dispatcher; штучні тривоги в production не створюйте.

Ініціалізація не запитує дозволу автоматично. Дозвіл запитується кнопкою користувача; після відмови нативний OneSignal може запропонувати відкрити системні налаштування. Клік передає лише відому область, довільні URL з push не відкриваються. `web_url` у серверному повідомленні застосовується тільки до вебпідписок.

OneSignal location-модуль вимкнений через `ONESIGNAL_DISABLE_LOCATION=true` під час sync і CI-збірок. Для ручної збірки з Xcode/Android Studio також експортуйте цю змінну перед запуском IDE. Кнопка «Моє місце» окремо використовує Capacitor Geolocation лише за запитом користувача. Основні текстові push працюють без Notification Service Extension; для rich-media та confirmed-receipt аналітики додайте NSE, OneSignalExtension і спільну App Group за офіційною інструкцією.

API-запити нативного застосунку виконуються через CapacitorHttp по HTTPS на `https://alerts-map.netlify.app`, зі збереженням bearer-токена власника підписки. Це не потребує відкриття CORS для сторонніх вебсайтів. Таймаути мережі й непідтверджений стан карти збережені.

## Публікація

Для App Store / TestFlight потрібні Apple Developer, signing/provisioning і App Store Connect. Для Google Play — Play Console, власний release-keystore та AAB. Тестові CI-артефакти не замінюють магазинні release-збірки.

Перед відправкою додайте приватний контакт підтримки/приватності, фінальні дані розробника, скриншоти й описи, перевірте privacy policy та заповніть App Privacy/Data Safety відповідно до фактичної конфігурації OneSignal. Картка застосунку має описувати незалежний інформаційний сервіс без обіцянки гарантованої доставки чи заміни офіційних сигналів. Схвалення магазинами залежить від їхньої перевірки.

Після публікації запишіть реальні store URL у `lib/app-downloads.json`: `iosStoreUrl`, `androidStoreUrl`. Поле `androidPreviewUrl` — лише для перевіреного тестового APK. Порожні поля показують статус підготовки; вигаданих магазинних посилань немає.

Лендінг: `/download/`. Вебкарта: `/`. Приватність: `/privacy/`.

## Системні зони PWA на iPhone

Фон `html/body` має збігатися з шапкою та нижньою навігацією, оскільки iOS використовує його для системних зон поза вмістом сторінки. CSS `color-scheme` і метадані `theme-color` перемикаються разом із темою карти. Застарілий `black-translucent` прибраний; `viewport-fit=cover` та safe-area відступи шапки й навігації збережені. У встановленому режимі висота береться від layout viewport через `100%`, у вкладці — через `100dvh`.

Після деплою закрийте й повторно відкрийте PWA з мережею для оновлення оболонки. Якщо iOS зберегла старе оформлення встановлення, може знадобитися повторне додавання іконки; після перевстановлення перевірте підписку на сповіщення. Перевірка на фізичному iPhone 11 залишається потрібною: темна/світла тема, поворот екрана, повернення з фону та відкриття клавіатури. Локально перевірений WebKit-макет 414×896 з моделлю системних відступів 44/34 px; це не замінює перевірку iOS Home Screen.

Джерела: [WebKit про фон і safe-area](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [коментар WebKit про застарілий black-translucent](https://www2.webkit.org/show_bug.cgi?id=317153#c2).

Офіційні джерела: [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [OneSignal Capacitor SDK](https://documentation.onesignal.com/docs/en/capacitor-sdk-setup), [APNs](https://documentation.onesignal.com/docs/en/ios-p8-token-based-connection-to-apns), [FCM](https://documentation.onesignal.com/docs/en/android-firebase-credentials), [дані OneSignal SDK](https://documentation.onesignal.com/docs/en/data-collected-by-the-onesignal-sdk).
