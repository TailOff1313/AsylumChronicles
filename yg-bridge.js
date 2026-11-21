/* ══════════════════════════════════════════════════════════════════════
   МОСТ К SDK ЯНДЕКС ИГР

   Подключается из index.html и game.html. Работает только на площадке
   (домены Яндекса, iframe с реферером Яндекса или ?ysdk=1 для отладки).
   В exe, apk и на своём сайте мост остаётся выключенным и ничего не делает,
   поэтому игра ходит одним и тем же кодом на всех площадках.

   Наружу отдаётся window.YG:
     YG.enabled        — площадка найдена
     YG.lang           — язык площадки ('ru', 'en', …)
     YG.ready()        — сообщить площадке, что игра готова к старту
     YG.gameplayStart(), YG.gameplayStop()
     YG.interstitial() — полноэкранная реклама в логической паузе
     YG.rewarded(fn)   — реклама за вознаграждение
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var YANDEX_DOMAINS = ['yandex.ru', 'yandex.com', 'yandex.net', 'yandex.kz', 'yandex.by', 'yandex.ua'];
  var host = (location.hostname || '').toLowerCase();
  var forced = /[?&]ysdk=1/.test(location.search);

  function onYandexDomain() {
    if (!host) return false;
    for (var i = 0; i < YANDEX_DOMAINS.length; i++) {
      var d = YANDEX_DOMAINS[i];
      if (host === d || host.slice(-(d.length + 1)) === '.' + d) return true;
    }
    return host.indexOf('games.s3.yandex') >= 0;
  }

  function fromYandex() {
    try { return /yandex\.(ru|com|net)/.test(document.referrer || ''); } catch (e) { return false; }
  }

  var enabled = forced || onYandexDomain() || fromYandex();

  var sdk = null;
  var sdkReady = false;
  var wantReady = false;
  var wantPlay = null;       // null — состояние ещё не запрашивали
  var lastAdAt = 0;
  var AD_GAP = 180000;       // не чаще одной полноэкранной рекламы в 3 минуты
  var AD_MIN_RUNS = 1;       // первый забег не прерываем

  var YG = window.YG = {
    enabled: enabled,
    lang: '',
    ready: function () {
      if (!enabled) return;
      wantReady = true;
      if (sdkReady) callReady();
    },
    gameplayStart: function () {
      if (!enabled) return;
      wantPlay = true;
      if (sdkReady) callPlay(true);
    },
    gameplayStop: function () {
      if (!enabled) return;
      wantPlay = false;
      if (sdkReady) callPlay(false);
    },
    interstitial: function () {
      if (!enabled || !sdkReady) return;
      if (Date.now() - lastAdAt < AD_GAP) return;
      try {
        lastAdAt = Date.now();
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: function () { },
            onError: function () { }
          }
        });
      } catch (e) { }
    },
    rewarded: function (onReward) {
      if (!enabled || !sdkReady) return false;
      try {
        lastAdAt = Date.now();
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: function () { try { if (onReward) onReward(); } catch (e) { } },
            onClose: function () { },
            onError: function () { }
          }
        });
        return true;
      } catch (e) { return false; }
    }
  };

  if (!enabled) return;

  function callReady() {
    try {
      if (sdk && sdk.features && sdk.features.LoadingAPI) sdk.features.LoadingAPI.ready();
    } catch (e) { }
  }

  function callPlay(on) {
    try {
      if (!sdk || !sdk.features || !sdk.features.GameplayAPI) return;
      if (on) sdk.features.GameplayAPI.start();
      else sdk.features.GameplayAPI.stop();
    } catch (e) { }
  }

  function publishLang(lang) {
    YG.lang = lang || '';
    window.__ygLang = YG.lang;
    try {
      document.dispatchEvent(new CustomEvent('yg:lang', { detail: { lang: YG.lang } }));
    } catch (e) { }
  }

  function boot() {
    if (!window.YaGames || typeof window.YaGames.init !== 'function') {
      YG.enabled = false;
      return;
    }
    window.YaGames.init().then(function (ysdk) {
      sdk = ysdk;
      sdkReady = true;

      var lang = '';
      try { lang = (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) || ''; } catch (e) { }
      publishLang(lang);

      if (wantReady) callReady();
      if (wantPlay !== null) callPlay(wantPlay);
    }).catch(function () {
      YG.enabled = false;
    });
  }

  var s = document.createElement('script');
  s.src = 'https://yandex.ru/games/sdk/v2';
  s.async = true;
  s.onload = boot;
  s.onerror = function () { YG.enabled = false; };
  (document.head || document.documentElement).appendChild(s);
})();
