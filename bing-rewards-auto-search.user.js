// ==UserScript==
// @name         Bing Rewards Auto Search
// @namespace    https://www.bing.com/
// @version      1.2.0
// @description  Runs your daily Bing searches to collect Microsoft Rewards points: 1 to 100 per day, queries built from your own keywords, rotating search types (70% web plus images, videos, shopping, news), delays randomised 3-10s with occasional 10-25s reading pauses, rotated URL parameters and automatic mobile/desktop detection. Progress survives reloads, daily reset at midnight, and a script-language selector. USE AT YOUR OWN RISK: automating activity may violate the Microsoft Rewards terms.
// @author       g31w0fw0rld
// @license      MIT
// @match        https://www.bing.com/*
// @downloadURL  https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js
// @updateURL    https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.1.6';

    // =============================================
    // INTERNACIONALIZACION (i18n)
    // =============================================

    // Idioma del script. A diferencia de los otros userscripts del conjunto,
    // aqui NO sirve mirar el `lang` del documento: Bing lo fija segun el
    // mercado de la cuenta, asi que poner el sitio en ingles no cambiaria nada
    // y el widget seguiria en el idioma del navegador. Por eso hace falta una
    // preferencia manual: es la unica via para leer el script en un idioma
    // distinto al del navegador.
    //   'es' | 'en' -> forzado por el usuario
    //   ''          -> automatico (idioma del navegador)
    // Se lee con GM_getValue directo porque esto corre antes de que existan los
    // helpers de storage, y se necesita resuelto para elegir el diccionario.
    const LANG_KEY = 'bing-rewards-lang';

    // Idiomas del script: los 19 que Bing sirve en su tabla de mercados (40
    // combinaciones idioma-país sobre 19 lenguas), más vi, hi e id, que vienen
    // del conjunto estándar del catálogo. Esos tres Bing no los sirve, pero se
    // dejan porque el idioma de ESTE panel sigue al usuario, no al mercado: a
    // quien tiene el navegador en vietnamita le sirve igual aunque vea Bing en
    // inglés. Añadir uno es SOLO añadir su entrada a `i18n`: el selector del
    // panel se construye a partir de las claves de este objeto, no de una lista
    // aparte.
    const RTL_LANGS = ['ar'];

    // Bing distingue chino simplificado (zh-CN) del tradicional (zh-HK, zh-TW),
    // y ahí el texto cambia, así que no basta con reducir a la base 'zh'.
    const LANG_ALIASES = {
        'zh-hant': 'zh-tw', 'zh-cht': 'zh-tw', 'zh-hk': 'zh-tw', 'zh-mo': 'zh-tw',
        'zh-hans': 'zh', 'zh-chs': 'zh', 'zh-cn': 'zh', 'zh-sg': 'zh',
        'nb': 'no', 'nn': 'no'
    };

    // Reduce un código BCP-47 ('de-DE', 'zh-Hant-TW') a una clave de `i18n`, de
    // más específico a menos. '' si no hay ninguna, para seguir la cascada.
    function normalizeLang(raw) {
        const code = (raw || '').trim().toLowerCase().replace(/_/g, '-');
        if (!code) return '';
        const parts = code.split('-');
        for (let n = parts.length; n >= 1; n--) {
            const candidate = parts.slice(0, n).join('-');
            if (LANG_ALIASES[candidate]) return LANG_ALIASES[candidate];
            if (i18n[candidate]) return candidate;
        }
        return '';
    }

    function readLangPref() {
        try {
            const v = GM_getValue(LANG_KEY, '');
            return normalizeLang(v);
        } catch (e) { return ''; }
    }

    // Cascada, de la señal más fiel a la menos:
    //   1) la preferencia manual del selector del panel.
    //   2) <html lang>: Bing SÍ lo fija al idioma de su interfaz. Comprobado
    //      pidiendo /search?setlang=de, que responde <html lang="de" …>. Antes
    //      aquí se decía lo contrario y por eso solo se miraba el navegador;
    //      era falso, así que ahora "Auto" sigue de verdad al idioma en que
    //      estás viendo Bing, y solo cae al navegador si la página no lo dice.
    //   3) navigator.languages.
    //   4) inglés.
    function detectLang() {
        const fromDoc = normalizeLang(document.documentElement.getAttribute('lang'));
        if (fromDoc) return fromDoc;
        for (const l of [navigator.language, ...(navigator.languages || [])]) {
            const n = normalizeLang(l);
            if (n) return n;
        }
        return 'en';
    }

    const i18n = {
        es: {
            tabSearch: '🔍',
            tabKeywords: '🏷️',
            tabInfo: 'ℹ️',
            tabSearchTooltip: 'Búsqueda',
            tabKeywordsTooltip: 'Palabras clave',
            tabInfoTooltip: 'Información',
            langLabel: 'Idioma del script:',
            langAuto: 'Auto (navegador)',
            langTip: 'Idioma de ESTE script. Con "Auto" sigue el idioma en que estés viendo Bing y, si la página no lo dijera, el del navegador. Elige uno de la lista para fijarlo. Al cambiarlo se recarga la página.',
            start: '▶',
            continue_: '⏩',
            stop: '⏹',
            restart: '🔄',
            startTooltip: 'Iniciar búsquedas',
            continueTooltip: 'Continuar búsquedas',
            stopTooltip: 'Detener búsquedas',
            restartTooltip: 'Reiniciar contador',
            searching: 'Buscando',
            paused: 'Pausado',
            ready: 'Sin buscar',
            completed: 'Completado',
            editTotal: 'Cambiar número de búsquedas',
            editTotalPrompt: 'Número de búsquedas a realizar (1-100):',
            invalidNumber: 'Número inválido. Debe estar entre 1 y 100.',
            keywordsTitle: 'Palabras clave (clic para eliminar):',
            addKeyword: 'Añadir palabra clave',
            addKeywordPrompt: 'Nueva palabra o frase (separar varias con coma):',
            deleteKeywordConfirm: '¿Eliminar',
            editKeywords: 'Editar palabras clave',
            editKeywordsPrompt: 'Palabras clave separadas por coma:',
            resetKeywords: 'Restaurar predeterminadas',
            resetKeywordsConfirm: '¿Restaurar palabras clave por defecto?',
            accept: 'Aceptar',
            cancel: 'Cancelar',
            infoName: 'Nombre:',
            infoVersion: 'Versión:',
            infoDescription: 'Descripción:',
            infoDescriptionText: 'Automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards sin intervención manual. Número de búsquedas configurable con ⚙ (1-100, por defecto 20) y controles de iniciar / continuar / detener / reiniciar que cambian según el estado. En la pestaña de palabras clave puedes borrar cada una con un clic, añadir varias separadas por coma, editarlas todas de golpe o restaurar la lista original. El panel flotante se pliega y recuerda cómo lo dejaste, y el idioma del script se elige aquí arriba.',
            infoAuthor: 'Autor:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacidad:',
            infoPrivacyText: 'Tus palabras clave y el contador de búsquedas se guardan solo en el almacenamiento local del gestor de userscripts, en tu navegador. El script no hace ninguna petición de red propia: únicamente navega a URLs de búsqueda de bing.com, igual que si las escribieras tú. No hay terceros involucrados y no se envía nada al autor del script.',
            infoHow: 'Cómo funciona:',
            infoHowText: 'Genera queries combinando 1 a 3 palabras clave y rota entre búsquedas web (70%), imágenes, videos, shopping y noticias para simular navegación humana. Los delays son aleatorios entre 3-10s, con pausas ocasionales de 10-25s que imitan lectura de resultados. Cada URL incluye parámetros rotados (form, cvid, PC) que Bing identifica como tráfico legítimo. Detecta mobile/desktop automáticamente, el progreso persiste entre recargas de página y el contador se resetea cada día a medianoche.'
        },
        en: {
            tabSearch: '🔍',
            tabKeywords: '🏷️',
            tabInfo: 'ℹ️',
            tabSearchTooltip: 'Search',
            tabKeywordsTooltip: 'Keywords',
            tabInfoTooltip: 'Information',
            langLabel: 'Script language:',
            langAuto: 'Auto (browser)',
            langTip: 'Language of THIS script. With "Auto" it follows the language you are viewing Bing in and, if the page does not say, your browser language. Pick one from the list to pin it. Changing it reloads the page.',
            start: '▶',
            continue_: '⏩',
            stop: '⏹',
            restart: '🔄',
            startTooltip: 'Start searches',
            continueTooltip: 'Continue searches',
            stopTooltip: 'Stop searches',
            restartTooltip: 'Restart counter',
            searching: 'Searching',
            paused: 'Paused',
            ready: 'No searches yet',
            completed: 'Completed',
            editTotal: 'Change number of searches',
            editTotalPrompt: 'Number of searches to perform (1-100):',
            invalidNumber: 'Invalid number. Must be between 1 and 100.',
            keywordsTitle: 'Keywords (click to delete):',
            addKeyword: 'Add keyword',
            addKeywordPrompt: 'New word or phrase (separate multiple with comma):',
            deleteKeywordConfirm: 'Delete',
            editKeywords: 'Edit keywords',
            editKeywordsPrompt: 'Comma-separated keywords:',
            resetKeywords: 'Reset to default',
            resetKeywordsConfirm: 'Reset keywords to default?',
            accept: 'Accept',
            cancel: 'Cancel',
            infoName: 'Name:',
            infoVersion: 'Version:',
            infoDescription: 'Description:',
            infoDescriptionText: 'Automates daily Bing searches to collect Microsoft Rewards points without manual intervention. Search count configurable with ⚙ (1-100, default 20) and start / continue / stop / restart controls that change with the state. In the keywords tab you can delete each one with a click, add several separated by commas, edit them all at once or restore the original list. The floating panel collapses and remembers how you left it, and the script language is picked right above.',
            infoAuthor: 'Author:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Your keywords and the search counter are stored only in your userscript manager\'s local storage, in your browser. The script makes no network requests of its own: it only navigates to bing.com search URLs, exactly as if you typed them yourself. No third parties are involved and nothing is sent to the script author.',
            infoHow: 'How it works:',
            infoHowText: 'Generates queries by combining 1 to 3 keywords and rotates between web (70%), image, video, shopping, and news searches to simulate human browsing. Delays are randomized between 3-10s with occasional 10-25s "reading pauses". Each URL includes rotated parameters (form, cvid, PC) that Bing identifies as legitimate traffic. Mobile/desktop detection is automatic, progress persists across page reloads, and the counter resets daily at midnight.'
        },
        de: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Suche', tabKeywordsTooltip: 'Schlüsselwörter', tabInfoTooltip: 'Informationen',
            langLabel: 'Sprache des Skripts:', langAuto: 'Automatisch (Browser)',
            langTip: 'Sprache DIESES Skripts. Mit „Automatisch“ folgt es der Sprache, in der du Bing gerade siehst, und – falls die Seite nichts sagt – der deines Browsers. Wähle eine aus der Liste, um sie festzulegen. Eine Änderung lädt die Seite neu.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Suchen starten', continueTooltip: 'Suchen fortsetzen', stopTooltip: 'Suchen anhalten', restartTooltip: 'Zähler zurücksetzen',
            searching: 'Suche läuft', paused: 'Angehalten', ready: 'Nicht gesucht', completed: 'Abgeschlossen',
            editTotal: 'Anzahl der Suchen ändern',
            editTotalPrompt: 'Anzahl der durchzuführenden Suchen (1-100):',
            invalidNumber: 'Ungültige Zahl. Sie muss zwischen 1 und 100 liegen.',
            keywordsTitle: 'Schlüsselwörter (zum Löschen anklicken):',
            addKeyword: 'Schlüsselwort hinzufügen',
            addKeywordPrompt: 'Neues Wort oder neue Wortgruppe (mehrere durch Komma trennen):',
            deleteKeywordConfirm: 'Löschen:',
            editKeywords: 'Schlüsselwörter bearbeiten',
            editKeywordsPrompt: 'Durch Komma getrennte Schlüsselwörter:',
            resetKeywords: 'Standardwerte wiederherstellen',
            resetKeywordsConfirm: 'Standard-Schlüsselwörter wiederherstellen?',
            accept: 'OK', cancel: 'Abbrechen',
            infoName: 'Name:', infoVersion: 'Version:', infoDescription: 'Beschreibung:',
            infoDescriptionText: 'Automatisiert die täglichen Bing-Suchen, um ohne manuelles Zutun Punkte für Microsoft Rewards zu sammeln. Die Anzahl der Suchen lässt sich mit ⚙ einstellen (1-100, Standard 20), und die Schaltflächen zum Starten, Fortsetzen, Anhalten und Zurücksetzen wechseln je nach Zustand. Im Reiter für Schlüsselwörter kannst du jedes mit einem Klick löschen, mehrere durch Komma getrennt hinzufügen, alle auf einmal bearbeiten oder die ursprüngliche Liste wiederherstellen. Das schwebende Fenster lässt sich einklappen und merkt sich, wie du es hinterlassen hast; die Sprache des Skripts wird hier oben gewählt.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Datenschutz:',
            infoPrivacyText: 'Deine Schlüsselwörter und der Suchzähler werden nur im lokalen Speicher der Userscript-Verwaltung in deinem Browser abgelegt. Das Skript stellt keine eigenen Netzwerkanfragen: es navigiert lediglich zu Such-URLs von bing.com, genauso als hättest du sie selbst eingetippt. Dritte sind nicht beteiligt und an den Autor des Skripts wird nichts gesendet.',
            infoHow: 'Funktionsweise:',
            infoHowText: 'Es bildet Suchanfragen aus 1 bis 3 Schlüsselwörtern und wechselt zwischen Websuche (70 %), Bildern, Videos, Shopping und Nachrichten, um menschliches Surfen nachzuahmen. Die Wartezeiten liegen zufällig zwischen 3 und 10 s, mit gelegentlichen Pausen von 10 bis 25 s, die das Lesen von Ergebnissen nachbilden. Jede URL enthält wechselnde Parameter (form, cvid, PC), die Bing als legitimen Verkehr einstuft. Mobil und Desktop werden automatisch erkannt, der Fortschritt übersteht das Neuladen der Seite und der Zähler wird täglich um Mitternacht zurückgesetzt.'
        },
        fr: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Recherche', tabKeywordsTooltip: 'Mots-clés', tabInfoTooltip: 'Informations',
            langLabel: 'Langue du script :', langAuto: 'Auto (navigateur)',
            langTip: 'Langue de CE script. Avec « Auto », il suit la langue dans laquelle vous consultez Bing et, si la page ne l’indique pas, celle de votre navigateur. Choisissez-en une dans la liste pour la fixer. Toute modification recharge la page.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Lancer les recherches', continueTooltip: 'Poursuivre les recherches', stopTooltip: 'Arrêter les recherches', restartTooltip: 'Réinitialiser le compteur',
            searching: 'Recherche en cours', paused: 'En pause', ready: 'Aucune recherche', completed: 'Terminé',
            editTotal: 'Modifier le nombre de recherches',
            editTotalPrompt: 'Nombre de recherches à effectuer (1-100) :',
            invalidNumber: 'Nombre invalide. Il doit être compris entre 1 et 100.',
            keywordsTitle: 'Mots-clés (cliquez pour supprimer) :',
            addKeyword: 'Ajouter un mot-clé',
            addKeywordPrompt: 'Nouveau mot ou nouvelle expression (séparez-en plusieurs par une virgule) :',
            deleteKeywordConfirm: 'Supprimer',
            editKeywords: 'Modifier les mots-clés',
            editKeywordsPrompt: 'Mots-clés séparés par des virgules :',
            resetKeywords: 'Rétablir les valeurs par défaut',
            resetKeywordsConfirm: 'Rétablir les mots-clés par défaut ?',
            accept: 'Valider', cancel: 'Annuler',
            infoName: 'Nom :', infoVersion: 'Version :', infoDescription: 'Description :',
            infoDescriptionText: 'Automatise les recherches quotidiennes sur Bing pour accumuler des points Microsoft Rewards sans intervention manuelle. Le nombre de recherches se règle avec ⚙ (1-100, 20 par défaut) et les commandes démarrer / poursuivre / arrêter / réinitialiser changent selon l’état. Dans l’onglet des mots-clés, vous pouvez en supprimer un d’un clic, en ajouter plusieurs séparés par des virgules, les modifier tous d’un coup ou rétablir la liste d’origine. Le panneau flottant se replie et retient la position où vous l’avez laissé, et la langue du script se choisit ici en haut.',
            infoAuthor: 'Auteur :', infoGitHub: 'GitHub :', infoPrivacy: 'Confidentialité :',
            infoPrivacyText: 'Vos mots-clés et le compteur de recherches sont conservés uniquement dans le stockage local du gestionnaire de userscripts, dans votre navigateur. Le script n’effectue aucune requête réseau qui lui soit propre : il navigue seulement vers des URL de recherche de bing.com, exactement comme si vous les saisissiez vous-même. Aucun tiers n’est impliqué et rien n’est envoyé à l’auteur du script.',
            infoHow: 'Fonctionnement :',
            infoHowText: 'Il compose des requêtes en combinant 1 à 3 mots-clés et alterne entre recherche web (70 %), images, vidéos, shopping et actualités pour imiter une navigation humaine. Les délais sont aléatoires entre 3 et 10 s, avec des pauses occasionnelles de 10 à 25 s qui imitent la lecture des résultats. Chaque URL comporte des paramètres qui tournent (form, cvid, PC) et que Bing identifie comme du trafic légitime. Le mode mobile ou bureau est détecté automatiquement, la progression survit aux rechargements de page et le compteur se remet à zéro chaque jour à minuit.'
        },
        pt: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Pesquisa', tabKeywordsTooltip: 'Palavras-chave', tabInfoTooltip: 'Informação',
            langLabel: 'Idioma do script:', langAuto: 'Automático (navegador)',
            langTip: 'Idioma DESTE script. Com "Automático" segue o idioma em que está a ver o Bing e, se a página não o indicar, o do navegador. Escolha um da lista para o fixar. Ao alterá-lo, a página é recarregada.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Iniciar pesquisas', continueTooltip: 'Continuar pesquisas', stopTooltip: 'Parar pesquisas', restartTooltip: 'Reiniciar contador',
            searching: 'A pesquisar', paused: 'Em pausa', ready: 'Sem pesquisar', completed: 'Concluído',
            editTotal: 'Alterar número de pesquisas',
            editTotalPrompt: 'Número de pesquisas a realizar (1-100):',
            invalidNumber: 'Número inválido. Tem de estar entre 1 e 100.',
            keywordsTitle: 'Palavras-chave (clique para eliminar):',
            addKeyword: 'Adicionar palavra-chave',
            addKeywordPrompt: 'Nova palavra ou frase (separe várias por vírgula):',
            deleteKeywordConfirm: 'Eliminar',
            editKeywords: 'Editar palavras-chave',
            editKeywordsPrompt: 'Palavras-chave separadas por vírgula:',
            resetKeywords: 'Repor predefinições',
            resetKeywordsConfirm: 'Repor as palavras-chave predefinidas?',
            accept: 'Aceitar', cancel: 'Cancelar',
            infoName: 'Nome:', infoVersion: 'Versão:', infoDescription: 'Descrição:',
            infoDescriptionText: 'Automatiza pesquisas diárias no Bing para acumular pontos do Microsoft Rewards sem intervenção manual. O número de pesquisas configura-se com ⚙ (1-100, 20 por omissão) e os controlos de iniciar / continuar / parar / reiniciar mudam consoante o estado. No separador de palavras-chave pode apagar cada uma com um clique, adicionar várias separadas por vírgula, editá-las todas de uma vez ou repor a lista original. O painel flutuante recolhe-se e lembra-se de como o deixou, e o idioma do script escolhe-se aqui em cima.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacidade:',
            infoPrivacyText: 'As suas palavras-chave e o contador de pesquisas são guardados apenas no armazenamento local do gestor de userscripts, no seu navegador. O script não faz qualquer pedido de rede próprio: limita-se a navegar para URLs de pesquisa do bing.com, tal como se fosse você a escrevê-los. Não há terceiros envolvidos e nada é enviado ao autor do script.',
            infoHow: 'Como funciona:',
            infoHowText: 'Gera consultas combinando 1 a 3 palavras-chave e alterna entre pesquisas web (70%), imagens, vídeos, compras e notícias para simular navegação humana. Os atrasos são aleatórios entre 3-10 s, com pausas ocasionais de 10-25 s que imitam a leitura dos resultados. Cada URL inclui parâmetros rotativos (form, cvid, PC) que o Bing identifica como tráfego legítimo. Deteta automaticamente telemóvel ou computador, o progresso persiste entre recargas da página e o contador é reposto todos os dias à meia-noite.'
        },
        ru: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Поиск', tabKeywordsTooltip: 'Ключевые слова', tabInfoTooltip: 'Сведения',
            langLabel: 'Язык скрипта:', langAuto: 'Авто (браузер)',
            langTip: 'Язык ЭТОГО скрипта. При «Авто» он следует языку, на котором вы смотрите Bing, а если страница его не указывает — языку браузера. Выберите язык из списка, чтобы закрепить его. При изменении страница перезагружается.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Запустить поиск', continueTooltip: 'Продолжить поиск', stopTooltip: 'Остановить поиск', restartTooltip: 'Сбросить счётчик',
            searching: 'Идёт поиск', paused: 'Пауза', ready: 'Поиск не выполнялся', completed: 'Завершено',
            editTotal: 'Изменить количество запросов',
            editTotalPrompt: 'Сколько запросов выполнить (1-100):',
            invalidNumber: 'Недопустимое число. Оно должно быть от 1 до 100.',
            keywordsTitle: 'Ключевые слова (нажмите, чтобы удалить):',
            addKeyword: 'Добавить ключевое слово',
            addKeywordPrompt: 'Новое слово или фраза (несколько разделяйте запятой):',
            deleteKeywordConfirm: 'Удалить',
            editKeywords: 'Изменить ключевые слова',
            editKeywordsPrompt: 'Ключевые слова через запятую:',
            resetKeywords: 'Восстановить стандартные',
            resetKeywordsConfirm: 'Восстановить ключевые слова по умолчанию?',
            accept: 'ОК', cancel: 'Отмена',
            infoName: 'Название:', infoVersion: 'Версия:', infoDescription: 'Описание:',
            infoDescriptionText: 'Автоматизирует ежедневные запросы в Bing, чтобы копить баллы Microsoft Rewards без ручных действий. Количество запросов настраивается кнопкой ⚙ (1-100, по умолчанию 20), а кнопки запуска, продолжения, остановки и сброса меняются в зависимости от состояния. На вкладке ключевых слов каждое можно удалить одним щелчком, добавить несколько через запятую, изменить все сразу или вернуть исходный список. Плавающая панель сворачивается и запоминает, как вы её оставили, а язык скрипта выбирается здесь наверху.',
            infoAuthor: 'Автор:', infoGitHub: 'GitHub:', infoPrivacy: 'Конфиденциальность:',
            infoPrivacyText: 'Ваши ключевые слова и счётчик запросов хранятся только в локальном хранилище менеджера пользовательских скриптов, в вашем браузере. Скрипт не делает собственных сетевых запросов: он лишь переходит по поисковым адресам bing.com, ровно так же, как если бы вы набрали их сами. Третьи стороны не задействованы, автору скрипта ничего не отправляется.',
            infoHow: 'Как это работает:',
            infoHowText: 'Скрипт составляет запросы из 1-3 ключевых слов и чередует веб-поиск (70 %), изображения, видео, покупки и новости, изображая обычный просмотр. Задержки случайны в пределах 3-10 с, изредка с паузами 10-25 с, имитирующими чтение результатов. В каждый адрес подставляются меняющиеся параметры (form, cvid, PC), которые Bing принимает за обычный трафик. Мобильный и настольный режимы определяются автоматически, прогресс переживает перезагрузку страницы, а счётчик обнуляется каждый день в полночь.'
        },
        tr: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Arama', tabKeywordsTooltip: 'Anahtar kelimeler', tabInfoTooltip: 'Bilgi',
            langLabel: 'Betiğin dili:', langAuto: 'Otomatik (tarayıcı)',
            langTip: 'BU betiğin dili. "Otomatik" ile Bing’i hangi dilde görüyorsanız onu izler; sayfa belirtmezse tarayıcınızın dilini kullanır. Sabitlemek için listeden birini seçin. Değiştirdiğinizde sayfa yeniden yüklenir.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Aramaları başlat', continueTooltip: 'Aramaları sürdür', stopTooltip: 'Aramaları durdur', restartTooltip: 'Sayacı sıfırla',
            searching: 'Aranıyor', paused: 'Duraklatıldı', ready: 'Arama yapılmadı', completed: 'Tamamlandı',
            editTotal: 'Arama sayısını değiştir',
            editTotalPrompt: 'Yapılacak arama sayısı (1-100):',
            invalidNumber: 'Geçersiz sayı. 1 ile 100 arasında olmalı.',
            keywordsTitle: 'Anahtar kelimeler (silmek için tıklayın):',
            addKeyword: 'Anahtar kelime ekle',
            addKeywordPrompt: 'Yeni kelime veya ifade (birden fazlasını virgülle ayırın):',
            deleteKeywordConfirm: 'Silinsin mi:',
            editKeywords: 'Anahtar kelimeleri düzenle',
            editKeywordsPrompt: 'Virgülle ayrılmış anahtar kelimeler:',
            resetKeywords: 'Varsayılanları geri yükle',
            resetKeywordsConfirm: 'Varsayılan anahtar kelimeler geri yüklensin mi?',
            accept: 'Tamam', cancel: 'İptal',
            infoName: 'Ad:', infoVersion: 'Sürüm:', infoDescription: 'Açıklama:',
            infoDescriptionText: 'Microsoft Rewards puanı biriktirmek için günlük Bing aramalarını elle uğraşmadan otomatikleştirir. Arama sayısı ⚙ ile ayarlanır (1-100, varsayılan 20); başlat / sürdür / durdur / sıfırla düğmeleri duruma göre değişir. Anahtar kelimeler sekmesinde her birini tek tıkla silebilir, virgülle ayırarak birkaçını ekleyebilir, hepsini birden düzenleyebilir veya özgün listeyi geri yükleyebilirsiniz. Yüzen panel katlanır ve onu nasıl bıraktığınızı hatırlar; betiğin dili de buradan, en üstten seçilir.',
            infoAuthor: 'Yazar:', infoGitHub: 'GitHub:', infoPrivacy: 'Gizlilik:',
            infoPrivacyText: 'Anahtar kelimeleriniz ve arama sayacı yalnızca tarayıcınızdaki userscript yöneticisinin yerel deposunda tutulur. Betik kendine ait hiçbir ağ isteği yapmaz: yalnızca bing.com arama adreslerine gider, tıpkı siz yazmışsınız gibi. Üçüncü taraf yoktur ve betiğin yazarına hiçbir şey gönderilmez.',
            infoHow: 'Nasıl çalışır:',
            infoHowText: '1 ila 3 anahtar kelimeyi birleştirerek sorgular üretir ve insan gezinmesini taklit etmek için web araması (%70), görseller, videolar, alışveriş ve haberler arasında dönüşümlü geçer. Bekleme süreleri 3-10 sn arasında rastgeledir; ara sıra sonuçların okunmasını taklit eden 10-25 sn’lik duraklamalar olur. Her adres, Bing’in meşru trafik olarak gördüğü dönüşümlü parametreler (form, cvid, PC) içerir. Mobil ve masaüstü otomatik olarak algılanır, ilerleme sayfa yenilemelerinde korunur ve sayaç her gün gece yarısı sıfırlanır.'
        },
        ja: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: '検索', tabKeywordsTooltip: 'キーワード', tabInfoTooltip: '情報',
            langLabel: 'スクリプトの言語:', langAuto: '自動（ブラウザー）',
            langTip: 'この スクリプトの言語です。「自動」では、あなたが Bing を見ている言語に合わせ、ページが示していなければブラウザーの言語に従います。固定するには一覧から選んでください。変更するとページが再読み込みされます。',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: '検索を開始', continueTooltip: '検索を再開', stopTooltip: '検索を停止', restartTooltip: 'カウンターをリセット',
            searching: '検索中', paused: '一時停止', ready: '未検索', completed: '完了',
            editTotal: '検索回数を変更',
            editTotalPrompt: '実行する検索回数（1〜100）:',
            invalidNumber: '無効な数値です。1〜100 の範囲で指定してください。',
            keywordsTitle: 'キーワード（クリックで削除）:',
            addKeyword: 'キーワードを追加',
            addKeywordPrompt: '新しい語または語句（複数はカンマ区切り）:',
            deleteKeywordConfirm: '削除しますか:',
            editKeywords: 'キーワードを編集',
            editKeywordsPrompt: 'カンマ区切りのキーワード:',
            resetKeywords: '初期値に戻す',
            resetKeywordsConfirm: 'キーワードを初期値に戻しますか？',
            accept: 'OK', cancel: 'キャンセル',
            infoName: '名前:', infoVersion: 'バージョン:', infoDescription: '説明:',
            infoDescriptionText: 'Microsoft Rewards のポイントを手作業なしで貯めるため、Bing の毎日の検索を自動化します。検索回数は ⚙ で設定でき（1〜100、既定は 20）、開始・再開・停止・リセットのボタンは状態に応じて切り替わります。キーワードのタブでは、ひとつずつクリックで削除、カンマ区切りでまとめて追加、全体を一括編集、元の一覧に復元ができます。浮動パネルは折りたためて状態を記憶し、スクリプトの言語はこの上部で選べます。',
            infoAuthor: '作者:', infoGitHub: 'GitHub:', infoPrivacy: 'プライバシー:',
            infoPrivacyText: 'キーワードと検索カウンターは、ブラウザー内のユーザースクリプト管理アドオンのローカルストレージにのみ保存されます。このスクリプトは独自のネットワーク要求を一切行いません。自分で入力した場合とまったく同じように、bing.com の検索 URL へ移動するだけです。第三者は関与せず、スクリプトの作者にも何も送信されません。',
            infoHow: '仕組み:',
            infoHowText: 'キーワードを1〜3語組み合わせてクエリを作り、人間の閲覧に近づけるためウェブ検索（70%）、画像、動画、ショッピング、ニュースを切り替えます。待ち時間は3〜10秒のランダムで、結果を読む動作を模した10〜25秒の休止がときどき入ります。各 URL には Bing が正当なトラフィックとみなす可変パラメーター（form、cvid、PC）が付きます。モバイルとデスクトップは自動判定され、進捗はページの再読み込みをまたいで保持され、カウンターは毎日0時にリセットされます。'
        },
        ko: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: '검색', tabKeywordsTooltip: '키워드', tabInfoTooltip: '정보',
            langLabel: '스크립트 언어:', langAuto: '자동(브라우저)',
            langTip: '이 스크립트의 언어입니다. "자동"이면 지금 Bing을 보고 있는 언어를 따르고, 페이지가 알려주지 않으면 브라우저 언어를 씁니다. 고정하려면 목록에서 고르세요. 바꾸면 페이지가 다시 불러와집니다.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: '검색 시작', continueTooltip: '검색 계속', stopTooltip: '검색 중지', restartTooltip: '카운터 초기화',
            searching: '검색 중', paused: '일시 중지', ready: '검색 안 함', completed: '완료',
            editTotal: '검색 횟수 변경',
            editTotalPrompt: '수행할 검색 횟수(1-100):',
            invalidNumber: '잘못된 숫자입니다. 1에서 100 사이여야 합니다.',
            keywordsTitle: '키워드(클릭하면 삭제):',
            addKeyword: '키워드 추가',
            addKeywordPrompt: '새 단어 또는 문구(여러 개는 쉼표로 구분):',
            deleteKeywordConfirm: '삭제할까요:',
            editKeywords: '키워드 편집',
            editKeywordsPrompt: '쉼표로 구분한 키워드:',
            resetKeywords: '기본값 복원',
            resetKeywordsConfirm: '기본 키워드로 되돌릴까요?',
            accept: '확인', cancel: '취소',
            infoName: '이름:', infoVersion: '버전:', infoDescription: '설명:',
            infoDescriptionText: '손대지 않고도 Microsoft Rewards 포인트를 쌓도록 Bing의 일일 검색을 자동화합니다. 검색 횟수는 ⚙로 설정하며(1-100, 기본 20), 시작·계속·중지·초기화 버튼은 상태에 따라 바뀝니다. 키워드 탭에서는 하나씩 클릭해 삭제하거나, 쉼표로 구분해 여러 개를 추가하거나, 전체를 한 번에 편집하거나, 원래 목록으로 되돌릴 수 있습니다. 떠 있는 패널은 접을 수 있고 마지막 상태를 기억하며, 스크립트 언어는 이 위쪽에서 고릅니다.',
            infoAuthor: '제작자:', infoGitHub: 'GitHub:', infoPrivacy: '개인정보:',
            infoPrivacyText: '키워드와 검색 카운터는 브라우저 안 사용자 스크립트 관리자의 로컬 저장소에만 보관됩니다. 이 스크립트는 자체적인 네트워크 요청을 전혀 하지 않습니다. 직접 입력했을 때와 똑같이 bing.com의 검색 주소로 이동할 뿐입니다. 제3자는 관여하지 않으며 스크립트 제작자에게도 아무것도 보내지 않습니다.',
            infoHow: '작동 방식:',
            infoHowText: '키워드 1~3개를 조합해 검색어를 만들고, 사람이 둘러보는 것처럼 보이도록 웹 검색(70%), 이미지, 동영상, 쇼핑, 뉴스를 번갈아 사용합니다. 지연 시간은 3~10초 사이에서 무작위이며, 결과를 읽는 것을 흉내 낸 10~25초의 휴지가 가끔 들어갑니다. 각 주소에는 Bing이 정상 트래픽으로 인식하는 순환 매개변수(form, cvid, PC)가 붙습니다. 모바일과 데스크톱은 자동으로 구분하고, 진행 상황은 페이지를 새로 고쳐도 유지되며, 카운터는 매일 자정에 초기화됩니다.'
        },
        pl: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Wyszukiwanie', tabKeywordsTooltip: 'Słowa kluczowe', tabInfoTooltip: 'Informacje',
            langLabel: 'Język skryptu:', langAuto: 'Auto (przeglądarka)',
            langTip: 'Język TEGO skryptu. Przy „Auto” podąża za językiem, w którym oglądasz Bing, a jeśli strona go nie poda — za językiem przeglądarki. Wybierz jeden z listy, aby go ustalić. Zmiana przeładowuje stronę.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Rozpocznij wyszukiwania', continueTooltip: 'Kontynuuj wyszukiwania', stopTooltip: 'Zatrzymaj wyszukiwania', restartTooltip: 'Wyzeruj licznik',
            searching: 'Wyszukiwanie', paused: 'Wstrzymano', ready: 'Bez wyszukiwań', completed: 'Ukończono',
            editTotal: 'Zmień liczbę wyszukiwań',
            editTotalPrompt: 'Liczba wyszukiwań do wykonania (1-100):',
            invalidNumber: 'Nieprawidłowa liczba. Musi mieścić się w zakresie 1-100.',
            keywordsTitle: 'Słowa kluczowe (kliknij, aby usunąć):',
            addKeyword: 'Dodaj słowo kluczowe',
            addKeywordPrompt: 'Nowe słowo lub fraza (kilka oddziel przecinkami):',
            deleteKeywordConfirm: 'Usunąć',
            editKeywords: 'Edytuj słowa kluczowe',
            editKeywordsPrompt: 'Słowa kluczowe oddzielone przecinkami:',
            resetKeywords: 'Przywróć domyślne',
            resetKeywordsConfirm: 'Przywrócić domyślne słowa kluczowe?',
            accept: 'OK', cancel: 'Anuluj',
            infoName: 'Nazwa:', infoVersion: 'Wersja:', infoDescription: 'Opis:',
            infoDescriptionText: 'Automatyzuje codzienne wyszukiwania w Bingu, aby zbierać punkty Microsoft Rewards bez ręcznej pracy. Liczbę wyszukiwań ustawia się przyciskiem ⚙ (1-100, domyślnie 20), a przyciski start / kontynuuj / zatrzymaj / wyzeruj zmieniają się zależnie od stanu. W zakładce słów kluczowych możesz usunąć każde jednym kliknięciem, dodać kilka oddzielonych przecinkami, zmienić wszystkie naraz albo przywrócić pierwotną listę. Pływający panel zwija się i pamięta, jak go zostawiłeś, a język skryptu wybiera się tutaj, na górze.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Prywatność:',
            infoPrivacyText: 'Twoje słowa kluczowe i licznik wyszukiwań są zapisywane wyłącznie w pamięci lokalnej menedżera userscriptów, w twojej przeglądarce. Skrypt nie wykonuje żadnych własnych żądań sieciowych: jedynie przechodzi pod adresy wyszukiwania bing.com, dokładnie tak, jakbyś wpisał je sam. Nie ma żadnych osób trzecich i nic nie trafia do autora skryptu.',
            infoHow: 'Jak to działa:',
            infoHowText: 'Tworzy zapytania, łącząc od 1 do 3 słów kluczowych, i przeplata wyszukiwanie w sieci (70%), grafiki, filmy, zakupy i wiadomości, żeby przypominało to przeglądanie przez człowieka. Opóźnienia są losowe w zakresie 3-10 s, z okazjonalnymi przerwami 10-25 s naśladującymi czytanie wyników. Każdy adres zawiera zmieniające się parametry (form, cvid, PC), które Bing traktuje jako zwykły ruch. Tryb mobilny i komputerowy jest rozpoznawany automatycznie, postęp przetrwa przeładowanie strony, a licznik zeruje się codziennie o północy.'
        },
        fi: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Haku', tabKeywordsTooltip: 'Avainsanat', tabInfoTooltip: 'Tiedot',
            langLabel: 'Skriptin kieli:', langAuto: 'Automaattinen (selain)',
            langTip: 'TÄMÄN skriptin kieli. Asetuksella "Automaattinen" se seuraa kieltä, jolla katselet Bingiä, ja jos sivu ei sitä kerro, selaimesi kieltä. Valitse listalta yksi kiinnittääksesi sen. Muutos lataa sivun uudelleen.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Aloita haut', continueTooltip: 'Jatka hakuja', stopTooltip: 'Pysäytä haut', restartTooltip: 'Nollaa laskuri',
            searching: 'Haetaan', paused: 'Keskeytetty', ready: 'Ei hakuja', completed: 'Valmis',
            editTotal: 'Muuta hakujen määrää',
            editTotalPrompt: 'Tehtävien hakujen määrä (1-100):',
            invalidNumber: 'Virheellinen luku. Sen on oltava välillä 1-100.',
            keywordsTitle: 'Avainsanat (poista napsauttamalla):',
            addKeyword: 'Lisää avainsana',
            addKeywordPrompt: 'Uusi sana tai lauseke (erota useampi pilkulla):',
            deleteKeywordConfirm: 'Poistetaanko',
            editKeywords: 'Muokkaa avainsanoja',
            editKeywordsPrompt: 'Pilkulla erotetut avainsanat:',
            resetKeywords: 'Palauta oletukset',
            resetKeywordsConfirm: 'Palautetaanko oletusavainsanat?',
            accept: 'OK', cancel: 'Peruuta',
            infoName: 'Nimi:', infoVersion: 'Versio:', infoDescription: 'Kuvaus:',
            infoDescriptionText: 'Automatisoi päivittäiset Bing-haut, jotta Microsoft Rewards -pisteitä kertyy ilman käsityötä. Hakujen määrä säädetään ⚙-painikkeella (1-100, oletus 20), ja aloitus-, jatkamis-, pysäytys- ja nollauspainikkeet vaihtuvat tilan mukaan. Avainsanavälilehdellä voit poistaa jokaisen yhdellä napsautuksella, lisätä useita pilkulla eroteltuina, muokata kaikkia kerralla tai palauttaa alkuperäisen listan. Kelluva paneeli taittuu kokoon ja muistaa, mihin sen jätit, ja skriptin kieli valitaan täältä ylhäältä.',
            infoAuthor: 'Tekijä:', infoGitHub: 'GitHub:', infoPrivacy: 'Tietosuoja:',
            infoPrivacyText: 'Avainsanasi ja hakulaskuri tallennetaan vain käyttäjäskriptien hallinnan paikalliseen tallennustilaan selaimessasi. Skripti ei tee lainkaan omia verkkopyyntöjä: se vain siirtyy bing.comin hakuosoitteisiin täsmälleen kuten jos kirjoittaisit ne itse. Kolmansia osapuolia ei ole mukana eikä skriptin tekijälle lähetetä mitään.',
            infoHow: 'Miten se toimii:',
            infoHowText: 'Se muodostaa hakuja yhdistelemällä 1-3 avainsanaa ja vuorottelee verkkohaun (70 %), kuvien, videoiden, ostosten ja uutisten välillä jäljitelläkseen ihmisen selailua. Viiveet ovat satunnaisia 3-10 s, ja välillä tulee 10-25 s taukoja, jotka jäljittelevät tulosten lukemista. Jokaisessa osoitteessa on vaihtuvia parametreja (form, cvid, PC), jotka Bing tulkitsee tavalliseksi liikenteeksi. Mobiili ja työpöytä tunnistetaan automaattisesti, edistyminen säilyy sivun uudelleenlatausten yli ja laskuri nollautuu joka päivä keskiyöllä.'
        },
        vi: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Tìm kiếm', tabKeywordsTooltip: 'Từ khóa', tabInfoTooltip: 'Thông tin',
            langLabel: 'Ngôn ngữ của tập lệnh:', langAuto: 'Tự động (trình duyệt)',
            langTip: 'Ngôn ngữ của CHÍNH tập lệnh này. Với "Tự động", nó theo ngôn ngữ bạn đang xem Bing, và nếu trang không cho biết thì theo ngôn ngữ trình duyệt. Chọn một mục trong danh sách để cố định. Thay đổi sẽ tải lại trang.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Bắt đầu tìm kiếm', continueTooltip: 'Tiếp tục tìm kiếm', stopTooltip: 'Dừng tìm kiếm', restartTooltip: 'Đặt lại bộ đếm',
            searching: 'Đang tìm', paused: 'Tạm dừng', ready: 'Chưa tìm', completed: 'Hoàn tất',
            editTotal: 'Đổi số lần tìm kiếm',
            editTotalPrompt: 'Số lần tìm kiếm cần thực hiện (1-100):',
            invalidNumber: 'Số không hợp lệ. Phải nằm trong khoảng 1 đến 100.',
            keywordsTitle: 'Từ khóa (bấm để xóa):',
            addKeyword: 'Thêm từ khóa',
            addKeywordPrompt: 'Từ hoặc cụm từ mới (nhiều mục thì cách nhau bằng dấu phẩy):',
            deleteKeywordConfirm: 'Xóa',
            editKeywords: 'Sửa từ khóa',
            editKeywordsPrompt: 'Các từ khóa cách nhau bằng dấu phẩy:',
            resetKeywords: 'Khôi phục mặc định',
            resetKeywordsConfirm: 'Khôi phục các từ khóa mặc định?',
            accept: 'Đồng ý', cancel: 'Hủy',
            infoName: 'Tên:', infoVersion: 'Phiên bản:', infoDescription: 'Mô tả:',
            infoDescriptionText: 'Tự động hóa các lượt tìm kiếm hằng ngày trên Bing để tích điểm Microsoft Rewards mà không cần thao tác tay. Số lượt tìm kiếm được đặt bằng ⚙ (1-100, mặc định 20) và các nút bắt đầu / tiếp tục / dừng / đặt lại thay đổi theo trạng thái. Trong thẻ từ khóa, bạn có thể xóa từng mục bằng một cú bấm, thêm nhiều mục cách nhau bằng dấu phẩy, sửa tất cả cùng lúc hoặc khôi phục danh sách ban đầu. Bảng nổi có thể thu gọn và nhớ trạng thái bạn để lại, còn ngôn ngữ của tập lệnh được chọn ở phía trên này.',
            infoAuthor: 'Tác giả:', infoGitHub: 'GitHub:', infoPrivacy: 'Quyền riêng tư:',
            infoPrivacyText: 'Từ khóa và bộ đếm tìm kiếm của bạn chỉ được lưu trong bộ nhớ cục bộ của trình quản lý userscript, ngay trong trình duyệt. Tập lệnh không tự thực hiện bất kỳ yêu cầu mạng nào: nó chỉ điều hướng tới các địa chỉ tìm kiếm của bing.com, y như khi bạn tự gõ. Không có bên thứ ba nào tham gia và không gửi gì cho tác giả tập lệnh.',
            infoHow: 'Cách hoạt động:',
            infoHowText: 'Tập lệnh tạo truy vấn bằng cách ghép 1 đến 3 từ khóa và luân phiên giữa tìm kiếm web (70%), hình ảnh, video, mua sắm và tin tức để mô phỏng việc duyệt web của con người. Độ trễ ngẫu nhiên từ 3-10 giây, thỉnh thoảng có quãng nghỉ 10-25 giây mô phỏng việc đọc kết quả. Mỗi địa chỉ đều kèm các tham số luân phiên (form, cvid, PC) mà Bing xem là lưu lượng hợp lệ. Chế độ di động hay máy tính được nhận diện tự động, tiến trình được giữ lại qua các lần tải lại trang và bộ đếm được đặt lại mỗi ngày vào nửa đêm.'
        },
        zh: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: '搜索', tabKeywordsTooltip: '关键词', tabInfoTooltip: '信息',
            langLabel: '脚本语言：', langAuto: '自动（浏览器）',
            langTip: '本脚本的显示语言。选择“自动”时会跟随你当前浏览 Bing 所用的语言；若页面未标明，则跟随浏览器语言。从列表中选择即可固定。更改后页面会重新加载。',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: '开始搜索', continueTooltip: '继续搜索', stopTooltip: '停止搜索', restartTooltip: '重置计数器',
            searching: '搜索中', paused: '已暂停', ready: '尚未搜索', completed: '已完成',
            editTotal: '修改搜索次数',
            editTotalPrompt: '要执行的搜索次数（1-100）：',
            invalidNumber: '数字无效，必须介于 1 和 100 之间。',
            keywordsTitle: '关键词（点击即可删除）：',
            addKeyword: '添加关键词',
            addKeywordPrompt: '新的词或短语（多个请用逗号分隔）：',
            deleteKeywordConfirm: '要删除',
            editKeywords: '编辑关键词',
            editKeywordsPrompt: '用逗号分隔的关键词：',
            resetKeywords: '恢复默认',
            resetKeywordsConfirm: '要恢复默认关键词吗？',
            accept: '确定', cancel: '取消',
            infoName: '名称：', infoVersion: '版本：', infoDescription: '描述：',
            infoDescriptionText: '自动完成每日的 Bing 搜索，无需手动操作即可累积 Microsoft Rewards 积分。搜索次数可用 ⚙ 设置（1-100，默认 20），开始／继续／停止／重置按钮会随状态变化。在关键词标签页中，你可以点击逐个删除、用逗号分隔一次添加多个、一次性编辑全部，或恢复原始列表。浮动面板可以折叠并记住你上次的状态，脚本语言就在上方选择。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隐私：',
            infoPrivacyText: '你的关键词和搜索计数器只保存在浏览器中用户脚本管理器的本地存储里。本脚本不会发起任何自己的网络请求：它只是跳转到 bing.com 的搜索网址，和你自己输入完全一样。不涉及任何第三方，也不会向脚本作者发送任何内容。',
            infoHow: '工作原理：',
            infoHowText: '脚本会组合 1 到 3 个关键词生成查询，并在网页搜索（70%）、图片、视频、购物和资讯之间轮换，以模拟人类浏览。延迟在 3-10 秒之间随机，偶尔会有 10-25 秒的停顿来模拟阅读结果。每个网址都带有轮换参数（form、cvid、PC），Bing 会将其视为正常流量。脚本会自动识别移动端与桌面端，进度在页面重新加载后依然保留，计数器每天午夜重置。'
        },
        ar: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'البحث', tabKeywordsTooltip: 'الكلمات المفتاحية', tabInfoTooltip: 'معلومات',
            langLabel: 'لغة البرنامج النصي:', langAuto: 'تلقائي (المتصفح)',
            langTip: 'لغة هذا البرنامج النصي. مع «تلقائي» يتبع اللغة التي تتصفح بها Bing، وإن لم تُصرّح بها الصفحة فلغة متصفحك. اختر واحدة من القائمة لتثبيتها. تغييرها يعيد تحميل الصفحة.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'بدء عمليات البحث', continueTooltip: 'متابعة عمليات البحث', stopTooltip: 'إيقاف عمليات البحث', restartTooltip: 'تصفير العدّاد',
            searching: 'جارٍ البحث', paused: 'متوقف مؤقتًا', ready: 'لم يبدأ البحث', completed: 'اكتمل',
            editTotal: 'تغيير عدد عمليات البحث',
            editTotalPrompt: 'عدد عمليات البحث المطلوب تنفيذها (1-100):',
            invalidNumber: 'رقم غير صالح. يجب أن يكون بين 1 و100.',
            keywordsTitle: 'الكلمات المفتاحية (انقر للحذف):',
            addKeyword: 'إضافة كلمة مفتاحية',
            addKeywordPrompt: 'كلمة أو عبارة جديدة (افصل بينها بفواصل عند إضافة أكثر من واحدة):',
            deleteKeywordConfirm: 'هل تريد حذف',
            editKeywords: 'تحرير الكلمات المفتاحية',
            editKeywordsPrompt: 'الكلمات المفتاحية مفصولة بفواصل:',
            resetKeywords: 'استعادة الافتراضية',
            resetKeywordsConfirm: 'هل تريد استعادة الكلمات المفتاحية الافتراضية؟',
            accept: 'موافق', cancel: 'إلغاء',
            infoName: 'الاسم:', infoVersion: 'الإصدار:', infoDescription: 'الوصف:',
            infoDescriptionText: 'يؤتمت عمليات البحث اليومية في Bing لتجميع نقاط Microsoft Rewards دون تدخل يدوي. يُضبط عدد عمليات البحث بزر ⚙ (من 1 إلى 100، والافتراضي 20)، وتتغيّر أزرار البدء والمتابعة والإيقاف والتصفير بحسب الحالة. في تبويب الكلمات المفتاحية يمكنك حذف كل واحدة بنقرة، أو إضافة عدة كلمات مفصولة بفواصل، أو تحريرها كلها دفعة واحدة، أو استعادة القائمة الأصلية. تُطوى اللوحة العائمة وتتذكّر الوضع الذي تركتها عليه، ولغة البرنامج النصي تُختار من هنا في الأعلى.',
            infoAuthor: 'المؤلف:', infoGitHub: 'GitHub:', infoPrivacy: 'الخصوصية:',
            infoPrivacyText: 'تُحفَظ كلماتك المفتاحية وعدّاد عمليات البحث في التخزين المحلي لمدير البرامج النصية داخل متصفحك فقط. ولا يُجري البرنامج النصي أي طلبات شبكة خاصة به: فهو ينتقل إلى روابط البحث في bing.com فحسب، تمامًا كما لو كتبتها بنفسك. ولا تشارك أي جهة خارجية، ولا يُرسَل أي شيء إلى مؤلف البرنامج النصي.',
            infoHow: 'كيف يعمل:',
            infoHowText: 'يبني الاستعلامات بدمج كلمة إلى ثلاث كلمات مفتاحية، ويتنقّل بين بحث الويب (70%) والصور والفيديو والتسوق والأخبار لمحاكاة تصفّح بشري. والمهل عشوائية بين 3 و10 ثوانٍ، مع وقفات عارضة من 10 إلى 25 ثانية تحاكي قراءة النتائج. ويحمل كل رابط معاملات متبدّلة (form وcvid وPC) يعدّها Bing حركة مرور طبيعية. ويكتشف الهاتف أو الحاسب تلقائيًا، ويبقى التقدّم بعد إعادة تحميل الصفحة، ويُصفَّر العدّاد كل يوم عند منتصف الليل.'
        },
        hi: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'खोज', tabKeywordsTooltip: 'मुख्य शब्द', tabInfoTooltip: 'जानकारी',
            langLabel: 'स्क्रिप्ट की भाषा:', langAuto: 'स्वतः (ब्राउज़र)',
            langTip: 'इस स्क्रिप्ट की भाषा। "स्वतः" पर यह उसी भाषा का अनुसरण करती है जिसमें आप Bing देख रहे हैं, और यदि पृष्ठ न बताए तो आपके ब्राउज़र की भाषा का। तय करने के लिए सूची से कोई एक चुनें। बदलने पर पृष्ठ फिर से लोड होता है।',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'खोज शुरू करें', continueTooltip: 'खोज जारी रखें', stopTooltip: 'खोज रोकें', restartTooltip: 'काउंटर रीसेट करें',
            searching: 'खोज जारी', paused: 'रुका हुआ', ready: 'कोई खोज नहीं', completed: 'पूरा हुआ',
            editTotal: 'खोजों की संख्या बदलें',
            editTotalPrompt: 'कितनी खोजें करनी हैं (1-100):',
            invalidNumber: 'अमान्य संख्या। यह 1 से 100 के बीच होनी चाहिए।',
            keywordsTitle: 'मुख्य शब्द (हटाने के लिए क्लिक करें):',
            addKeyword: 'मुख्य शब्द जोड़ें',
            addKeywordPrompt: 'नया शब्द या वाक्यांश (एक से अधिक हों तो अल्पविराम से अलग करें):',
            deleteKeywordConfirm: 'क्या हटाएँ',
            editKeywords: 'मुख्य शब्द संपादित करें',
            editKeywordsPrompt: 'अल्पविराम से अलग किए गए मुख्य शब्द:',
            resetKeywords: 'डिफ़ॉल्ट बहाल करें',
            resetKeywordsConfirm: 'क्या डिफ़ॉल्ट मुख्य शब्द बहाल करें?',
            accept: 'ठीक है', cancel: 'रद्द करें',
            infoName: 'नाम:', infoVersion: 'संस्करण:', infoDescription: 'विवरण:',
            infoDescriptionText: 'बिना हाथ लगाए Microsoft Rewards अंक जमा करने के लिए Bing की रोज़ाना खोजों को स्वचालित करती है। खोजों की संख्या ⚙ से तय होती है (1-100, डिफ़ॉल्ट 20) और शुरू / जारी रखें / रोकें / रीसेट के बटन स्थिति के अनुसार बदलते हैं। मुख्य शब्दों वाले टैब में आप हर एक को एक क्लिक से हटा सकते हैं, अल्पविराम से अलग करके कई जोड़ सकते हैं, सबको एक साथ संपादित कर सकते हैं या मूल सूची बहाल कर सकते हैं। तैरता पैनल मुड़ जाता है और जैसा आपने छोड़ा था वैसा याद रखता है, और स्क्रिप्ट की भाषा यहीं ऊपर चुनी जाती है।',
            infoAuthor: 'लेखक:', infoGitHub: 'GitHub:', infoPrivacy: 'निजता:',
            infoPrivacyText: 'आपके मुख्य शब्द और खोज काउंटर केवल आपके ब्राउज़र में यूज़रस्क्रिप्ट प्रबंधक के स्थानीय भंडारण में सहेजे जाते हैं। स्क्रिप्ट अपनी ओर से कोई नेटवर्क अनुरोध नहीं करती: वह बस bing.com के खोज पतों पर जाती है, ठीक वैसे ही जैसे आप स्वयं टाइप करते। कोई तीसरा पक्ष शामिल नहीं है और स्क्रिप्ट के लेखक को कुछ भी नहीं भेजा जाता।',
            infoHow: 'यह कैसे काम करती है:',
            infoHowText: 'यह 1 से 3 मुख्य शब्दों को मिलाकर क्वेरी बनाती है और मानवीय ब्राउज़िंग जैसा दिखाने के लिए वेब खोज (70%), छवियों, वीडियो, शॉपिंग और समाचार के बीच बारी-बारी से चलती है। विलंब 3-10 सेकंड के बीच यादृच्छिक होते हैं, और बीच-बीच में 10-25 सेकंड के ठहराव आते हैं जो परिणाम पढ़ने जैसा प्रभाव देते हैं। हर पते में बदलते हुए पैरामीटर (form, cvid, PC) होते हैं जिन्हें Bing सामान्य ट्रैफ़िक मानता है। मोबाइल और डेस्कटॉप की पहचान अपने आप होती है, प्रगति पृष्ठ फिर से लोड होने पर भी बनी रहती है, और काउंटर हर दिन आधी रात को रीसेट हो जाता है।'
        },
        id: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Pencarian', tabKeywordsTooltip: 'Kata kunci', tabInfoTooltip: 'Informasi',
            langLabel: 'Bahasa skrip:', langAuto: 'Otomatis (peramban)',
            langTip: 'Bahasa skrip INI. Dengan "Otomatis" ia mengikuti bahasa yang Anda pakai saat melihat Bing dan, jika halaman tidak menyebutkannya, bahasa peramban Anda. Pilih satu dari daftar untuk menguncinya. Mengubahnya akan memuat ulang halaman.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Mulai pencarian', continueTooltip: 'Lanjutkan pencarian', stopTooltip: 'Hentikan pencarian', restartTooltip: 'Setel ulang penghitung',
            searching: 'Mencari', paused: 'Dijeda', ready: 'Belum mencari', completed: 'Selesai',
            editTotal: 'Ubah jumlah pencarian',
            editTotalPrompt: 'Jumlah pencarian yang akan dilakukan (1-100):',
            invalidNumber: 'Angka tidak valid. Harus antara 1 dan 100.',
            keywordsTitle: 'Kata kunci (klik untuk menghapus):',
            addKeyword: 'Tambah kata kunci',
            addKeywordPrompt: 'Kata atau frasa baru (pisahkan beberapa dengan koma):',
            deleteKeywordConfirm: 'Hapus',
            editKeywords: 'Sunting kata kunci',
            editKeywordsPrompt: 'Kata kunci dipisahkan koma:',
            resetKeywords: 'Kembalikan bawaan',
            resetKeywordsConfirm: 'Kembalikan kata kunci bawaan?',
            accept: 'Oke', cancel: 'Batal',
            infoName: 'Nama:', infoVersion: 'Versi:', infoDescription: 'Deskripsi:',
            infoDescriptionText: 'Mengotomatiskan pencarian harian di Bing untuk mengumpulkan poin Microsoft Rewards tanpa campur tangan manual. Jumlah pencarian diatur dengan ⚙ (1-100, bawaan 20) dan tombol mulai / lanjutkan / hentikan / setel ulang berubah sesuai keadaan. Di tab kata kunci Anda bisa menghapus tiap kata dengan sekali klik, menambahkan beberapa sekaligus dipisahkan koma, menyunting semuanya sekaligus, atau mengembalikan daftar aslinya. Panel mengambang bisa dilipat dan mengingat posisi terakhir Anda, dan bahasa skrip dipilih di bagian atas ini.',
            infoAuthor: 'Penulis:', infoGitHub: 'GitHub:', infoPrivacy: 'Privasi:',
            infoPrivacyText: 'Kata kunci dan penghitung pencarian Anda hanya disimpan di penyimpanan lokal pengelola userscript, di dalam peramban Anda. Skrip ini tidak melakukan permintaan jaringan sendiri: ia hanya membuka URL pencarian bing.com, persis seperti kalau Anda mengetiknya sendiri. Tidak ada pihak ketiga yang terlibat dan tidak ada apa pun yang dikirim ke penulis skrip.',
            infoHow: 'Cara kerjanya:',
            infoHowText: 'Skrip menyusun kueri dengan menggabungkan 1 sampai 3 kata kunci dan bergantian antara pencarian web (70%), gambar, video, belanja, dan berita untuk menyerupai penjelajahan manusia. Jedanya acak antara 3-10 detik, dengan rehat sesekali 10-25 detik yang meniru pembacaan hasil. Setiap URL memuat parameter yang berganti-ganti (form, cvid, PC) yang dikenali Bing sebagai lalu lintas wajar. Mode seluler dan desktop dideteksi otomatis, kemajuan bertahan melewati pemuatan ulang halaman, dan penghitung disetel ulang setiap hari pada tengah malam.'
        },
        it: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Ricerca', tabKeywordsTooltip: 'Parole chiave', tabInfoTooltip: 'Informazioni',
            langLabel: 'Lingua dello script:', langAuto: 'Auto (browser)',
            langTip: 'Lingua di QUESTO script. Con «Auto» segue la lingua con cui stai vedendo Bing e, se la pagina non la dichiara, quella del browser. Scegline una dall’elenco per fissarla. Cambiandola la pagina viene ricaricata.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Avvia le ricerche', continueTooltip: 'Riprendi le ricerche', stopTooltip: 'Ferma le ricerche', restartTooltip: 'Azzera il contatore',
            searching: 'Ricerca in corso', paused: 'In pausa', ready: 'Nessuna ricerca', completed: 'Completato',
            editTotal: 'Cambia il numero di ricerche',
            editTotalPrompt: 'Numero di ricerche da eseguire (1-100):',
            invalidNumber: 'Numero non valido. Deve essere compreso tra 1 e 100.',
            keywordsTitle: 'Parole chiave (clicca per eliminare):',
            addKeyword: 'Aggiungi parola chiave',
            addKeywordPrompt: 'Nuova parola o frase (separane più di una con virgole):',
            deleteKeywordConfirm: 'Eliminare',
            editKeywords: 'Modifica parole chiave',
            editKeywordsPrompt: 'Parole chiave separate da virgole:',
            resetKeywords: 'Ripristina predefinite',
            resetKeywordsConfirm: 'Ripristinare le parole chiave predefinite?',
            accept: 'OK', cancel: 'Annulla',
            infoName: 'Nome:', infoVersion: 'Versione:', infoDescription: 'Descrizione:',
            infoDescriptionText: 'Automatizza le ricerche quotidiane su Bing per accumulare punti Microsoft Rewards senza interventi manuali. Il numero di ricerche si imposta con ⚙ (1-100, valore predefinito 20) e i comandi avvia / riprendi / ferma / azzera cambiano a seconda dello stato. Nella scheda delle parole chiave puoi eliminarne una con un clic, aggiungerne diverse separate da virgole, modificarle tutte in una volta o ripristinare l’elenco originale. Il pannello flottante si richiude e ricorda come lo hai lasciato, e la lingua dello script si sceglie qui in alto.',
            infoAuthor: 'Autore:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Le tue parole chiave e il contatore delle ricerche sono salvati solo nell’archivio locale del gestore di userscript, nel tuo browser. Lo script non effettua richieste di rete proprie: si limita a navigare verso indirizzi di ricerca di bing.com, esattamente come se li scrivessi tu. Non è coinvolta alcuna terza parte e all’autore dello script non viene inviato nulla.',
            infoHow: 'Come funziona:',
            infoHowText: 'Genera query combinando da 1 a 3 parole chiave e alterna tra ricerca web (70%), immagini, video, shopping e notizie per simulare una navigazione umana. Gli intervalli sono casuali tra 3 e 10 s, con pause occasionali di 10-25 s che imitano la lettura dei risultati. Ogni indirizzo include parametri a rotazione (form, cvid, PC) che Bing riconosce come traffico legittimo. Rileva automaticamente mobile o desktop, l’avanzamento sopravvive ai ricaricamenti della pagina e il contatore si azzera ogni giorno a mezzanotte.'
        },
        nl: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Zoeken', tabKeywordsTooltip: 'Trefwoorden', tabInfoTooltip: 'Informatie',
            langLabel: 'Taal van het script:', langAuto: 'Auto (browser)',
            langTip: 'Taal van DIT script. Met "Auto" volgt het de taal waarin je Bing bekijkt en, als de pagina die niet noemt, die van je browser. Kies er een uit de lijst om hem vast te zetten. Wijzigen laadt de pagina opnieuw.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Zoekopdrachten starten', continueTooltip: 'Zoekopdrachten hervatten', stopTooltip: 'Zoekopdrachten stoppen', restartTooltip: 'Teller opnieuw instellen',
            searching: 'Bezig met zoeken', paused: 'Gepauzeerd', ready: 'Nog niet gezocht', completed: 'Voltooid',
            editTotal: 'Aantal zoekopdrachten wijzigen',
            editTotalPrompt: 'Aantal uit te voeren zoekopdrachten (1-100):',
            invalidNumber: 'Ongeldig getal. Het moet tussen 1 en 100 liggen.',
            keywordsTitle: 'Trefwoorden (klik om te verwijderen):',
            addKeyword: 'Trefwoord toevoegen',
            addKeywordPrompt: 'Nieuw woord of nieuwe zin (scheid er meerdere met komma’s):',
            deleteKeywordConfirm: 'Verwijderen',
            editKeywords: 'Trefwoorden bewerken',
            editKeywordsPrompt: 'Trefwoorden gescheiden door komma’s:',
            resetKeywords: 'Standaardwaarden herstellen',
            resetKeywordsConfirm: 'Standaardtrefwoorden herstellen?',
            accept: 'Oké', cancel: 'Annuleren',
            infoName: 'Naam:', infoVersion: 'Versie:', infoDescription: 'Beschrijving:',
            infoDescriptionText: 'Automatiseert de dagelijkse zoekopdrachten op Bing om Microsoft Rewards-punten te sparen zonder handwerk. Het aantal zoekopdrachten stel je in met ⚙ (1-100, standaard 20) en de knoppen starten / hervatten / stoppen / opnieuw instellen wisselen mee met de toestand. Op het tabblad met trefwoorden kun je elk trefwoord met één klik verwijderen, er meerdere tegelijk toevoegen gescheiden door komma’s, ze allemaal in één keer bewerken of de oorspronkelijke lijst herstellen. Het zwevende paneel klapt in en onthoudt hoe je het achterliet, en de taal van het script kies je hier bovenaan.',
            infoAuthor: 'Auteur:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Je trefwoorden en de zoekteller worden alleen bewaard in de lokale opslag van de userscriptbeheerder, in je browser. Het script doet geen enkele eigen netwerkaanvraag: het navigeert alleen naar zoek-URL’s van bing.com, precies alsof je ze zelf intypte. Er zijn geen derden bij betrokken en er wordt niets naar de auteur van het script gestuurd.',
            infoHow: 'Hoe het werkt:',
            infoHowText: 'Het stelt zoekopdrachten samen uit 1 tot 3 trefwoorden en wisselt af tussen webzoeken (70%), afbeeldingen, video’s, shopping en nieuws om menselijk surfgedrag na te bootsen. De wachttijden zijn willekeurig tussen 3 en 10 s, met af en toe pauzes van 10-25 s die het lezen van resultaten nabootsen. Elke URL bevat wisselende parameters (form, cvid, PC) die Bing als normaal verkeer herkent. Mobiel en desktop worden automatisch herkend, de voortgang overleeft het herladen van de pagina en de teller wordt elke dag om middernacht op nul gezet.'
        },
        sv: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Sökning', tabKeywordsTooltip: 'Nyckelord', tabInfoTooltip: 'Information',
            langLabel: 'Skriptets språk:', langAuto: 'Auto (webbläsare)',
            langTip: 'Språk för DETTA skript. Med "Auto" följer det språket du ser Bing på och, om sidan inte anger det, webbläsarens språk. Välj ett i listan för att låsa det. Ändringen laddar om sidan.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Starta sökningar', continueTooltip: 'Fortsätt sökningar', stopTooltip: 'Stoppa sökningar', restartTooltip: 'Nollställ räknaren',
            searching: 'Söker', paused: 'Pausad', ready: 'Inga sökningar', completed: 'Klar',
            editTotal: 'Ändra antal sökningar',
            editTotalPrompt: 'Antal sökningar att göra (1-100):',
            invalidNumber: 'Ogiltigt tal. Det måste vara mellan 1 och 100.',
            keywordsTitle: 'Nyckelord (klicka för att ta bort):',
            addKeyword: 'Lägg till nyckelord',
            addKeywordPrompt: 'Nytt ord eller ny fras (separera flera med kommatecken):',
            deleteKeywordConfirm: 'Ta bort',
            editKeywords: 'Redigera nyckelord',
            editKeywordsPrompt: 'Nyckelord separerade med kommatecken:',
            resetKeywords: 'Återställ standard',
            resetKeywordsConfirm: 'Återställa standardnyckelorden?',
            accept: 'OK', cancel: 'Avbryt',
            infoName: 'Namn:', infoVersion: 'Version:', infoDescription: 'Beskrivning:',
            infoDescriptionText: 'Automatiserar de dagliga sökningarna på Bing för att samla Microsoft Rewards-poäng utan handpåläggning. Antalet sökningar ställs in med ⚙ (1-100, standard 20) och knapparna starta / fortsätt / stoppa / nollställ växlar efter tillstånd. På fliken för nyckelord kan du ta bort vart och ett med ett klick, lägga till flera separerade med kommatecken, redigera alla på en gång eller återställa den ursprungliga listan. Den flytande panelen fälls ihop och minns hur du lämnade den, och skriptets språk väljs här uppe.',
            infoAuthor: 'Upphovsperson:', infoGitHub: 'GitHub:', infoPrivacy: 'Integritet:',
            infoPrivacyText: 'Dina nyckelord och sökräknaren sparas endast i den lokala lagringen hos användarskriptshanteraren, i din webbläsare. Skriptet gör inga egna nätverksanrop: det navigerar bara till sök-URL:er på bing.com, precis som om du skrev dem själv. Inga tredje parter är inblandade och ingenting skickas till skriptets upphovsperson.',
            infoHow: 'Så fungerar det:',
            infoHowText: 'Det bygger sökfrågor av 1 till 3 nyckelord och växlar mellan webbsökning (70 %), bilder, videor, shopping och nyheter för att efterlikna mänskligt surfande. Fördröjningarna är slumpmässiga mellan 3 och 10 s, med enstaka pauser på 10-25 s som efterliknar läsning av resultat. Varje URL innehåller roterande parametrar (form, cvid, PC) som Bing tolkar som vanlig trafik. Mobil och dator känns igen automatiskt, förloppet överlever omladdningar av sidan och räknaren nollställs varje dag vid midnatt.'
        },
        da: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Søgning', tabKeywordsTooltip: 'Nøgleord', tabInfoTooltip: 'Information',
            langLabel: 'Scriptets sprog:', langAuto: 'Auto (browser)',
            langTip: 'Sprog for DETTE script. Med "Auto" følger det det sprog, du ser Bing på, og hvis siden ikke angiver det, din browsers sprog. Vælg et på listen for at fastlåse det. En ændring genindlæser siden.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Start søgninger', continueTooltip: 'Fortsæt søgninger', stopTooltip: 'Stop søgninger', restartTooltip: 'Nulstil tælleren',
            searching: 'Søger', paused: 'Sat på pause', ready: 'Ingen søgninger', completed: 'Fuldført',
            editTotal: 'Skift antal søgninger',
            editTotalPrompt: 'Antal søgninger, der skal udføres (1-100):',
            invalidNumber: 'Ugyldigt tal. Det skal være mellem 1 og 100.',
            keywordsTitle: 'Nøgleord (klik for at slette):',
            addKeyword: 'Tilføj nøgleord',
            addKeywordPrompt: 'Nyt ord eller ny sætning (adskil flere med komma):',
            deleteKeywordConfirm: 'Slet',
            editKeywords: 'Rediger nøgleord',
            editKeywordsPrompt: 'Nøgleord adskilt af komma:',
            resetKeywords: 'Gendan standard',
            resetKeywordsConfirm: 'Gendan standardnøgleordene?',
            accept: 'OK', cancel: 'Annuller',
            infoName: 'Navn:', infoVersion: 'Version:', infoDescription: 'Beskrivelse:',
            infoDescriptionText: 'Automatiserer de daglige søgninger på Bing, så du kan samle Microsoft Rewards-point uden manuelt arbejde. Antallet af søgninger indstilles med ⚙ (1-100, standard 20), og knapperne start / fortsæt / stop / nulstil skifter efter tilstanden. På fanen med nøgleord kan du slette hvert enkelt med ét klik, tilføje flere adskilt af komma, redigere dem alle på én gang eller gendanne den oprindelige liste. Det flydende panel klapper sammen og husker, hvordan du efterlod det, og scriptets sprog vælges heroppe.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Privatliv:',
            infoPrivacyText: 'Dine nøgleord og søgetælleren gemmes kun i den lokale lagring i userscript-håndteringen, i din browser. Scriptet foretager ingen egne netværkskald: det navigerer blot til søge-URL’er på bing.com, præcis som hvis du selv skrev dem. Ingen tredjeparter er involveret, og der sendes intet til scriptets forfatter.',
            infoHow: 'Sådan virker det:',
            infoHowText: 'Det danner søgninger ved at kombinere 1 til 3 nøgleord og skifter mellem websøgning (70 %), billeder, videoer, shopping og nyheder for at efterligne menneskelig browsing. Forsinkelserne er tilfældige mellem 3 og 10 s, med lejlighedsvise pauser på 10-25 s, der efterligner læsning af resultater. Hver URL indeholder roterende parametre (form, cvid, PC), som Bing opfatter som almindelig trafik. Mobil og computer registreres automatisk, forløbet overlever genindlæsning af siden, og tælleren nulstilles hver dag ved midnat.'
        },
        no: {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: 'Søk', tabKeywordsTooltip: 'Nøkkelord', tabInfoTooltip: 'Informasjon',
            langLabel: 'Språk for skriptet:', langAuto: 'Auto (nettleser)',
            langTip: 'Språk for DETTE skriptet. Med "Auto" følger det språket du ser Bing på, og hvis siden ikke oppgir det, nettleserens språk. Velg ett fra listen for å låse det. En endring laster siden på nytt.',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: 'Start søk', continueTooltip: 'Fortsett søk', stopTooltip: 'Stopp søk', restartTooltip: 'Nullstill telleren',
            searching: 'Søker', paused: 'Satt på pause', ready: 'Ingen søk', completed: 'Fullført',
            editTotal: 'Endre antall søk',
            editTotalPrompt: 'Antall søk som skal utføres (1-100):',
            invalidNumber: 'Ugyldig tall. Det må være mellom 1 og 100.',
            keywordsTitle: 'Nøkkelord (klikk for å slette):',
            addKeyword: 'Legg til nøkkelord',
            addKeywordPrompt: 'Nytt ord eller ny frase (skill flere med komma):',
            deleteKeywordConfirm: 'Slette',
            editKeywords: 'Rediger nøkkelord',
            editKeywordsPrompt: 'Nøkkelord skilt med komma:',
            resetKeywords: 'Gjenopprett standard',
            resetKeywordsConfirm: 'Gjenopprette standardnøkkelordene?',
            accept: 'OK', cancel: 'Avbryt',
            infoName: 'Navn:', infoVersion: 'Versjon:', infoDescription: 'Beskrivelse:',
            infoDescriptionText: 'Automatiserer de daglige søkene på Bing slik at du samler Microsoft Rewards-poeng uten manuelt arbeid. Antall søk stilles inn med ⚙ (1-100, standard 20), og knappene start / fortsett / stopp / nullstill endrer seg etter tilstanden. I fanen for nøkkelord kan du slette hvert enkelt med ett klikk, legge til flere skilt med komma, redigere alle på én gang eller gjenopprette den opprinnelige listen. Det flytende panelet felles sammen og husker hvordan du forlot det, og språket for skriptet velges her oppe.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Personvern:',
            infoPrivacyText: 'Nøkkelordene dine og søketelleren lagres bare i den lokale lagringen til brukerskriptbehandleren, i nettleseren din. Skriptet gjør ingen egne nettverkskall: det navigerer bare til søke-URL-er på bing.com, akkurat som om du skrev dem selv. Ingen tredjeparter er involvert, og ingenting sendes til forfatteren av skriptet.',
            infoHow: 'Slik virker det:',
            infoHowText: 'Det bygger søk ved å kombinere 1 til 3 nøkkelord og veksler mellom nettsøk (70 %), bilder, videoer, shopping og nyheter for å etterligne menneskelig surfing. Forsinkelsene er tilfeldige mellom 3 og 10 s, med sporadiske pauser på 10-25 s som etterligner lesing av resultater. Hver URL inneholder roterende parametre (form, cvid, PC) som Bing oppfatter som vanlig trafikk. Mobil og datamaskin oppdages automatisk, framdriften overlever at siden lastes på nytt, og telleren nullstilles hver dag ved midnatt.'
        },
        'zh-tw': {
            tabSearch: '🔍', tabKeywords: '🏷️', tabInfo: 'ℹ️',
            tabSearchTooltip: '搜尋', tabKeywordsTooltip: '關鍵字', tabInfoTooltip: '資訊',
            langLabel: '腳本語言：', langAuto: '自動（瀏覽器）',
            langTip: '本腳本的顯示語言。選擇「自動」時會跟隨你目前瀏覽 Bing 所用的語言；若頁面未標明，則跟隨瀏覽器語言。從清單中選擇即可固定。變更後頁面會重新載入。',
            start: '▶', continue_: '⏩', stop: '⏹', restart: '🔄',
            startTooltip: '開始搜尋', continueTooltip: '繼續搜尋', stopTooltip: '停止搜尋', restartTooltip: '重設計數器',
            searching: '搜尋中', paused: '已暫停', ready: '尚未搜尋', completed: '已完成',
            editTotal: '修改搜尋次數',
            editTotalPrompt: '要執行的搜尋次數（1-100）：',
            invalidNumber: '數字無效，必須介於 1 與 100 之間。',
            keywordsTitle: '關鍵字（點擊即可刪除）：',
            addKeyword: '新增關鍵字',
            addKeywordPrompt: '新的字詞或片語（多個請用逗號分隔）：',
            deleteKeywordConfirm: '要刪除',
            editKeywords: '編輯關鍵字',
            editKeywordsPrompt: '以逗號分隔的關鍵字：',
            resetKeywords: '還原預設值',
            resetKeywordsConfirm: '要還原預設關鍵字嗎？',
            accept: '確定', cancel: '取消',
            infoName: '名稱：', infoVersion: '版本：', infoDescription: '描述：',
            infoDescriptionText: '自動完成每日的 Bing 搜尋，無須手動操作即可累積 Microsoft Rewards 點數。搜尋次數可用 ⚙ 設定（1-100，預設 20），開始／繼續／停止／重設按鈕會隨狀態變化。在關鍵字分頁中，你可以點擊逐一刪除、用逗號分隔一次新增多個、一次編輯全部，或還原原始清單。浮動面板可以收合並記住你上次的狀態，腳本語言就在上方選擇。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隱私：',
            infoPrivacyText: '你的關鍵字與搜尋計數器只儲存在瀏覽器中使用者腳本管理器的本機儲存空間裡。本腳本不會發出任何自己的網路請求：它只是前往 bing.com 的搜尋網址，和你自己輸入完全一樣。不涉及任何第三方，也不會向腳本作者傳送任何內容。',
            infoHow: '運作方式：',
            infoHowText: '腳本會組合 1 到 3 個關鍵字產生查詢，並在網頁搜尋（70%）、圖片、影片、購物與新聞之間輪替，以模擬人類瀏覽。延遲在 3-10 秒之間隨機，偶爾會有 10-25 秒的停頓來模擬閱讀結果。每個網址都帶有輪替參數（form、cvid、PC），Bing 會將其視為正常流量。腳本會自動辨識行動裝置與桌機，進度在頁面重新載入後仍會保留，計數器每天午夜重設。'
        }
    };
    // Merge sobre `en`: una clave que falte en un idioma cae al inglés en vez de
    // quedar en undefined. Así se pueden añadir idiomas incompletos sin romper nada.
    const LANG_PREF = readLangPref();
    const LANG = LANG_PREF || detectLang();
    const t = { ...i18n.en, ...(i18n[LANG] || {}) };
    const DIR = RTL_LANGS.includes(LANG) ? 'rtl' : 'ltr';

    // =============================================
    // CONSTANTES
    // =============================================

    const DEFAULT_TOTAL_SEARCHES = 20;

    // Delays (ms). La duración real se calcula con una distribución sesgada:
    // la mayoría de pausas son cortas (3-10s), pero ~20% son "pausas de lectura"
    // largas (10-25s) para simular que el usuario leyó un resultado.
    const MIN_DELAY = 3000;
    const MAX_DELAY = 10000;
    const LONG_PAUSE_MIN = 10000;
    const LONG_PAUSE_MAX = 25000;
    const LONG_PAUSE_CHANCE = 0.2;

    // Tipos de búsqueda rotados para parecer navegación humana.
    // Microsoft Rewards otorga puntos principalmente en búsquedas web,
    // pero visitar imágenes/videos/shopping entre medio simula uso natural.
    // Formato: { path, weight, form (desktop), formMobile, extra }
    const SEARCH_TYPES = [
        { name: 'web',      path: '/search',         weight: 70, form: 'QBLH',   formMobile: 'QBLH' },
        { name: 'images',   path: '/images/search',  weight: 12, form: 'QBIR',   formMobile: 'HDRSC2' },
        { name: 'videos',   path: '/videos/search',  weight: 10, form: 'QBVR',   formMobile: 'HDRSC6' },
        { name: 'shopping', path: '/search',         weight: 5,  form: 'QBLH',   formMobile: 'QBLH',   extra: { scope: 'shop' } },
        { name: 'news',     path: '/news/search',    weight: 3,  form: 'QBNH',   formMobile: 'HDRSC3' }
    ];

    // Parámetros "form" alternativos para búsquedas web (rotados con el principal).
    // Agrega variedad al origen: homepage, barra direcciones, sugerencia, etc.
    const WEB_FORMS_DESKTOP = ['QBLH', 'QBRE', 'QSRE1', 'HDRSC1', 'PORE'];
    const WEB_FORMS_MOBILE = ['QBLH', 'MY0291', 'QSHome'];

    // Detectar si el navegador es mobile para usar los form params apropiados
    const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const BING_BASE = 'https://www.bing.com';

    const KEY_COUNT = 'bing-rewards-count';
    const KEY_DATE = 'bing-rewards-date';
    const KEY_ACTIVE = 'bing-rewards-active';
    const KEY_KEYWORDS = 'bing-rewards-keywords';
    const KEY_COLLAPSED = 'bing-rewards-collapsed';
    const KEY_TOTAL = 'bing-rewards-total';

    const PANEL_ID = 'bing-rewards-panel';

    const colors = {
        bg: '#0f0f1a',
        surface: '#1a1a2e',
        border: '#2a2a4a',
        primary: '#0078d4',
        primaryDark: '#005a9e',
        text: '#e0e0e0',
        gray: '#8892a0',
        green: '#4caf50',
        red: '#e74c3c'
    };

    // =============================================
    // PALABRAS CLAVE POR DEFECTO
    // =============================================

    const DEFAULT_KEYWORDS = [
        'best', 'top', 'new', 'popular', 'easy', 'free', 'latest',
        'laptop', 'headphones', 'recipe', 'hotel', 'flights', 'shoes',
        'phone', 'camera', 'books', 'games', 'movies', 'restaurants',
        'coffee', 'pizza', 'guitar', 'bicycle', 'keyboard', 'monitor',
        'weather forecast', 'movie reviews', 'sports scores', 'tech news',
        'recipe ideas', 'travel destinations', 'cooking tips', 'music playlist',
        'how to make', 'what is the best', 'where to find', 'how to learn'
    ];

    // =============================================
    // FUNCIONES DE ESTADO
    // =============================================

    /**
     * Obtiene la fecha de hoy en formato YYYY-MM-DD.
     * @returns {string}
     */
    function getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * Revisa si el contador debe resetearse (nuevo día).
     */
    function checkDailyReset() {
        if (GM_getValue(KEY_DATE, '') !== getToday()) {
            GM_setValue(KEY_COUNT, 0);
            GM_setValue(KEY_DATE, getToday());
            GM_setValue(KEY_ACTIVE, false);
        }
    }

    /**
     * Obtiene las palabras clave almacenadas o las por defecto.
     * @returns {string[]}
     */
    function getKeywords() {
        return GM_getValue(KEY_KEYWORDS, DEFAULT_KEYWORDS);
    }

    /**
     * Guarda las palabras clave.
     * @param {string[]} kws
     */
    function setKeywords(kws) {
        GM_setValue(KEY_KEYWORDS, kws);
    }

    /**
     * Obtiene el número total de búsquedas configurado (default 20).
     * @returns {number}
     */
    function getTotal() {
        return GM_getValue(KEY_TOTAL, DEFAULT_TOTAL_SEARCHES);
    }

    /**
     * Guarda el número total de búsquedas.
     * @param {number} n
     */
    function setTotal(n) {
        GM_setValue(KEY_TOTAL, n);
    }

    // =============================================
    // GENERADOR DE QUERIES
    // =============================================

    /**
     * Selecciona un elemento aleatorio de un array.
     * @param {string[]} arr
     * @returns {string}
     */
    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Genera una query combinando 1-3 palabras clave aleatorias.
     * @returns {string}
     */
    function generateQuery() {
        const kws = getKeywords();
        if (kws.length === 0) return 'bing search';
        const count = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : 3;
        const selected = [];
        for (let i = 0; i < count && i < kws.length; i++) {
            let word;
            do { word = pickRandom(kws); } while (selected.includes(word) && selected.length < kws.length);
            selected.push(word);
        }
        return selected.join(' ');
    }

    // =============================================
    // MOTOR DE BÚSQUEDA
    // =============================================

    /**
     * Genera un delay aleatorio usando distribución sesgada:
     * - 80% del tiempo: pausa normal (3-10s)
     * - 20% del tiempo: pausa larga de "lectura" (10-25s)
     * Además aplica una variación gaussiana ligera para evitar patrones fijos.
     * @returns {number} Milisegundos.
     */
    function getRandomDelay() {
        const isLongPause = Math.random() < LONG_PAUSE_CHANCE;
        const [min, max] = isLongPause
            ? [LONG_PAUSE_MIN, LONG_PAUSE_MAX]
            : [MIN_DELAY, MAX_DELAY];
        // Distribución con ligero sesgo hacia el centro del rango
        const u = (Math.random() + Math.random()) / 2;
        return Math.floor(u * (max - min)) + min;
    }

    /**
     * Selecciona un tipo de búsqueda según los pesos configurados.
     * @returns {object} Objeto del array SEARCH_TYPES.
     */
    function pickSearchType() {
        const total = SEARCH_TYPES.reduce((sum, t) => sum + t.weight, 0);
        let roll = Math.random() * total;
        for (const type of SEARCH_TYPES) {
            roll -= type.weight;
            if (roll <= 0) return type;
        }
        return SEARCH_TYPES[0];
    }

    /**
     * Construye la URL de búsqueda con parámetros que Microsoft Rewards
     * reconoce como búsquedas legítimas (form rotado, PC, cvid, tipo rotado).
     * Rota entre web/imágenes/videos/shopping/news para simular uso humano.
     * @param {string} query - Texto a buscar.
     * @returns {{ url: string, type: string }}
     */
    function buildSearchUrl(query) {
        const type = pickSearchType();
        // Para búsquedas web usamos form rotado; para otras, el form específico del tipo
        const form = type.name === 'web'
            ? pickRandom(IS_MOBILE ? WEB_FORMS_MOBILE : WEB_FORMS_DESKTOP)
            : (IS_MOBILE ? type.formMobile : type.form);
        const cvid = generateCvid();
        const params = new URLSearchParams({
            q: query,
            form: form,
            qs: 'n',
            sp: '-1',
            pq: query.toLowerCase(),
            sc: '0-0',
            sk: '',
            cvid: cvid
        });
        if (!IS_MOBILE) params.set('PC', 'U316');
        if (type.extra) {
            for (const [k, v] of Object.entries(type.extra)) params.set(k, v);
        }
        return {
            url: `${BING_BASE}${type.path}?${params.toString()}`,
            type: type.name
        };
    }

    /**
     * Genera un CVID (correlation/conversation ID) alfanumérico de 32 chars,
     * formato usado por Bing para rastrear sesiones de búsqueda.
     * @returns {string}
     */
    function generateCvid() {
        const chars = 'ABCDEF0123456789';
        let id = '';
        for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }

    /** @type {number|null} */
    let searchTimeout = null;

    /**
     * Ejecuta la siguiente búsqueda si quedan pendientes.
     * @param {function} onUpdate - Callback para actualizar la interfaz.
     */
    function executeNextSearch(onUpdate) {
        const count = GM_getValue(KEY_COUNT, 0);

        if (count >= getTotal()) {
            GM_setValue(KEY_ACTIVE, false);
            onUpdate(count, false);
            return;
        }

        onUpdate(count, true);

        const delay = getRandomDelay();
        searchTimeout = setTimeout(() => {
            GM_setValue(KEY_COUNT, count + 1);
            window.location.href = buildSearchUrl(generateQuery()).url;
        }, delay);
    }

    // =============================================
    // MODALES
    // =============================================

    /**
     * Crea un overlay modal con animación de entrada.
     * @returns {{ overlay: HTMLElement, box: HTMLElement }}
     */
    function createModal() {
        const overlay = document.createElement('div');
        overlay.dir = DIR; // idem para los diálogos modales
        Object.assign(overlay.style, {
            position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '999999',
            transition: 'opacity 180ms ease', opacity: '0'
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            backgroundColor: colors.surface, color: colors.text, borderRadius: '14px',
            padding: '24px 28px', minWidth: '300px', maxWidth: '440px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: `1px solid ${colors.primary}`,
            fontFamily: 'Segoe UI, system-ui, sans-serif', fontSize: '13px',
            transition: 'transform 180ms ease, opacity 180ms ease',
            transform: 'translateY(8px) scale(0.98)', opacity: '0'
        });
        overlay.appendChild(box);
        return { overlay, box };
    }

    /**
     * Cierra un overlay modal con animación.
     * @param {HTMLElement} overlay
     */
    function closeModal(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
    }

    /**
     * Muestra un overlay modal con animación de entrada.
     * @param {HTMLElement} overlay
     * @param {HTMLElement} box
     */
    function showModal(overlay, box) {
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'translateY(0) scale(1)';
            box.style.opacity = '1';
        }, 10);
    }

    /**
     * Crea un botón estilizado para modales.
     * @param {string} text
     * @param {string} color
     * @param {function} onClick
     * @returns {HTMLButtonElement}
     */
    function createModalBtn(text, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '6px 16px', backgroundColor: colors.surface,
            color: color, border: `1px solid ${color}`, borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit'
        });
        btn.onmouseenter = () => { btn.style.backgroundColor = color; btn.style.color = '#fff'; };
        btn.onmouseleave = () => { btn.style.backgroundColor = colors.surface; btn.style.color = color; };
        btn.onclick = onClick;
        return btn;
    }

    /**
     * Modal de confirmación (Sí/No).
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    function confirmModal(message) {
        return new Promise(resolve => {
            const { overlay, box } = createModal();
            const msg = document.createElement('div');
            msg.textContent = message;
            msg.style.marginBottom = '16px';
            msg.style.lineHeight = '1.5';
            box.appendChild(msg);

            const actions = document.createElement('div');
            Object.assign(actions.style, { display: 'flex', justifyContent: 'center', gap: '8px' });
            actions.appendChild(createModalBtn(t.cancel, colors.red, () => { closeModal(overlay); resolve(false); }));
            actions.appendChild(createModalBtn(t.accept, colors.primary, () => { closeModal(overlay); resolve(true); }));
            box.appendChild(actions);
            showModal(overlay, box);
        });
    }

    /**
     * Modal de input de texto.
     * @param {string} message
     * @param {string} [defaultValue]
     * @returns {Promise<string|null>}
     */
    function inputModal(message, defaultValue = '') {
        return new Promise(resolve => {
            const { overlay, box } = createModal();
            const msg = document.createElement('div');
            msg.textContent = message;
            msg.style.marginBottom = '8px';
            box.appendChild(msg);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            Object.assign(input.style, {
                width: '100%', padding: '8px', marginBottom: '12px',
                boxSizing: 'border-box', borderRadius: '6px',
                border: `1px solid ${colors.primary}`,
                background: colors.bg, color: colors.text,
                fontFamily: 'inherit', fontSize: '13px'
            });
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') { closeModal(overlay); resolve(input.value); }
                if (e.key === 'Escape') { closeModal(overlay); resolve(null); }
            });
            box.appendChild(input);

            const actions = document.createElement('div');
            Object.assign(actions.style, { display: 'flex', justifyContent: 'center', gap: '8px' });
            actions.appendChild(createModalBtn(t.cancel, colors.red, () => { closeModal(overlay); resolve(null); }));
            actions.appendChild(createModalBtn(t.accept, colors.primary, () => { closeModal(overlay); resolve(input.value); }));
            box.appendChild(actions);
            showModal(overlay, box);
            setTimeout(() => input.focus(), 50);
        });
    }

    // =============================================
    // INTERFAZ - PANEL FLOTANTE
    // =============================================

    /**
     * Construye el panel flotante con tabs: Búsqueda, Keywords, Info.
     * @returns {{ updateUI: function }}
     */
    function buildPanel() {
        const existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.dir = DIR; // en árabe el panel se ordena de derecha a izquierda
        Object.assign(panel.style, {
            position: 'fixed', bottom: '16px', right: '16px', zIndex: '99999',
            backgroundColor: colors.surface, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: '12px',
            padding: '0', fontFamily: 'Segoe UI, system-ui, sans-serif',
            fontSize: '13px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            minWidth: '240px', maxWidth: '300px',
            // El panel esta anclado abajo a la derecha y crece hacia arriba, asi que
            // sin tope la pestaña Info (textos largos) se sale por arriba de la pantalla.
            // El tope deja los 16px de margen de arriba y de abajo; el desbordamiento
            // lo absorbe el scroll de cada pane.
            maxHeight: 'calc(100vh - 32px)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });

        // --- Header ---
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: `1px solid ${colors.border}`,
            background: `linear-gradient(135deg, ${colors.primaryDark}22, ${colors.surface})`,
            flexShrink: '0'
        });

        const titleEl = document.createElement('span');
        titleEl.textContent = '🔎 Bing Rewards';
        titleEl.style.fontWeight = 'bold';
        titleEl.style.fontSize = '13px';
        titleEl.style.color = colors.primary;

        const collapseBtn = document.createElement('span');
        const isCollapsed = GM_getValue(KEY_COLLAPSED, false);
        collapseBtn.textContent = isCollapsed ? '🔽' : '🔼';
        collapseBtn.style.cursor = 'pointer';
        collapseBtn.style.fontSize = '12px';

        header.appendChild(titleEl);
        header.appendChild(collapseBtn);
        panel.appendChild(header);

        // --- Body ---
        const body = document.createElement('div');
        Object.assign(body.style, {
            display: isCollapsed ? 'none' : 'flex',
            // minHeight 0 anula el min-height:auto de los items flex; sin el, el body
            // se niega a encoger por debajo de su contenido y el maxHeight del panel
            // no sirve de nada.
            flexDirection: 'column', overflow: 'hidden', minHeight: '0'
        });

        collapseBtn.onclick = () => {
            const collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'flex' : 'none';
            collapseBtn.textContent = collapsed ? '🔼' : '🔽';
            GM_setValue(KEY_COLLAPSED, !collapsed);
        };

        // --- Tabs ---
        const tabBar = document.createElement('div');
        Object.assign(tabBar.style, {
            display: 'flex', borderBottom: `1px solid ${colors.border}`,
            flexShrink: '0'
        });

        const tabs = [];
        const panes = [];

        function createTab(label, tooltip) {
            const tab = document.createElement('button');
            tab.textContent = label;
            tab.title = tooltip;
            Object.assign(tab.style, {
                flex: '1', padding: '6px 0', cursor: 'pointer', fontSize: '13px',
                fontWeight: 'bold', borderBottom: `2px solid transparent`,
                backgroundColor: 'transparent', color: colors.gray,
                border: 'none', fontFamily: 'inherit'
            });
            tab.onmouseenter = () => { if (!tab.dataset.active) tab.style.color = colors.text; };
            tab.onmouseleave = () => { if (!tab.dataset.active) tab.style.color = colors.gray; };
            tabBar.appendChild(tab);
            tabs.push(tab);

            const pane = document.createElement('div');
            Object.assign(pane.style, {
                display: 'none', padding: '10px 12px',
                // El pane es quien scrollea cuando el contenido no cabe en el tope
                // del panel. overscrollBehavior evita que al llegar al final el
                // scroll se propague y mueva la pagina de Bing por detras.
                overflowY: 'auto', minHeight: '0', overscrollBehavior: 'contain',
                scrollbarWidth: 'thin', scrollbarColor: `${colors.border} transparent`
            });
            panes.push(pane);

            return { tab, pane };
        }

        function activateTab(index) {
            tabs.forEach((tb, i) => {
                const active = i === index;
                tb.style.borderBottom = active ? `2px solid ${colors.primary}` : '2px solid transparent';
                tb.style.color = active ? colors.primary : colors.gray;
                tb.dataset.active = active ? '1' : '';
                panes[i].style.display = active ? 'block' : 'none';
            });
        }

        const searchTab = createTab(t.tabSearch, t.tabSearchTooltip);
        const kwTab = createTab(t.tabKeywords, t.tabKeywordsTooltip);
        const infoTab = createTab(t.tabInfo, t.tabInfoTooltip);

        searchTab.tab.onclick = () => activateTab(0);
        kwTab.tab.onclick = () => activateTab(1);
        infoTab.tab.onclick = () => activateTab(2);

        body.appendChild(tabBar);
        body.appendChild(searchTab.pane);
        body.appendChild(kwTab.pane);
        body.appendChild(infoTab.pane);

        // =============================================
        // TAB: BÚSQUEDA
        // =============================================

        const statusText = document.createElement('div');
        statusText.style.marginBottom = '8px';
        statusText.style.textAlign = 'center';
        statusText.style.fontSize = '12px';

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex', gap: '6px', justifyContent: 'center'
        });

        function createActionBtn(icon, tooltip, color, onClick) {
            const btn = document.createElement('button');
            btn.textContent = icon;
            btn.title = tooltip;
            Object.assign(btn.style, {
                padding: '6px 18px', backgroundColor: color, color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontFamily: 'inherit',
                transition: 'opacity 0.15s'
            });
            btn.onmouseenter = () => { btn.style.opacity = '0.8'; };
            btn.onmouseleave = () => { btn.style.opacity = '1'; };
            btn.onclick = onClick;
            return btn;
        }

        /** Inicia búsquedas desde el conteo actual. */
        function startSession() {
            GM_setValue(KEY_ACTIVE, true);
            executeNextSearch(updateUI);
        }

        /** Detiene la sesión activa. */
        function stopSession() {
            GM_setValue(KEY_ACTIVE, false);
            if (searchTimeout) clearTimeout(searchTimeout);
            updateUI(GM_getValue(KEY_COUNT, 0), false);
        }

        /** Resetea el contador a 0 sin iniciar. */
        function restartCounter() {
            GM_setValue(KEY_COUNT, 0);
            GM_setValue(KEY_ACTIVE, false);
            if (searchTimeout) clearTimeout(searchTimeout);
            updateUI(0, false);
        }

        /**
         * Actualiza el estado visual y los botones según el progreso.
         * @param {number} count
         * @param {boolean} active
         */
        function updateUI(count, active) {
            btnRow.innerHTML = '';
            const total = getTotal();

            if (count >= total) {
                statusText.textContent = `✓ ${t.completed} (${count}/${total})`;
                statusText.style.color = colors.green;
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.primary, restartCounter));
            } else if (active) {
                statusText.textContent = `${t.searching}... ${count}/${total}`;
                statusText.style.color = colors.text;
                btnRow.appendChild(createActionBtn(t.stop, t.stopTooltip, colors.red, stopSession));
            } else if (count > 0) {
                statusText.textContent = `${t.paused}: ${count}/${total}`;
                statusText.style.color = colors.gray;
                btnRow.appendChild(createActionBtn(t.continue_, t.continueTooltip, colors.primary, startSession));
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.red, restartCounter));
            } else {
                statusText.textContent = `${t.ready}: 0/${total}`;
                statusText.style.color = colors.gray;
                btnRow.appendChild(createActionBtn(t.start, t.startTooltip, colors.primary, startSession));
            }
        }

        searchTab.pane.appendChild(statusText);
        searchTab.pane.appendChild(btnRow);

        // =============================================
        // TAB: KEYWORDS
        // =============================================

        function renderKeywordsTab() {
            kwTab.pane.innerHTML = '';

            const label = document.createElement('div');
            label.textContent = t.keywordsTitle;
            label.style.marginBottom = '8px';
            label.style.fontSize = '11px';
            label.style.color = colors.gray;
            kwTab.pane.appendChild(label);

            const chipsContainer = document.createElement('div');
            Object.assign(chipsContainer.style, {
                display: 'flex', flexWrap: 'wrap', gap: '4px',
                maxHeight: '150px', overflowY: 'auto', marginBottom: '10px'
            });

            const kws = getKeywords();
            kws.forEach(kw => {
                const chip = document.createElement('span');
                chip.textContent = kw;
                Object.assign(chip.style, {
                    padding: '2px 8px', backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`, borderRadius: '12px',
                    fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                    color: colors.text
                });
                chip.onmouseenter = () => { chip.style.borderColor = colors.red; chip.style.color = colors.red; };
                chip.onmouseleave = () => { chip.style.borderColor = colors.border; chip.style.color = colors.text; };
                chip.onclick = async () => {
                    const ok = await confirmModal(`${t.deleteKeywordConfirm} "${kw}"?`);
                    if (ok) {
                        const updated = getKeywords().filter(k => k !== kw);
                        setKeywords(updated);
                        renderKeywordsTab();
                    }
                };
                chipsContainer.appendChild(chip);
            });

            // Botón + para añadir
            const addChip = document.createElement('span');
            addChip.textContent = '+';
            addChip.title = t.addKeyword;
            Object.assign(addChip.style, {
                padding: '2px 8px', backgroundColor: colors.bg,
                border: `1px solid ${colors.primary}`, borderRadius: '12px',
                fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                color: colors.primary, fontWeight: 'bold'
            });
            addChip.onmouseenter = () => { addChip.style.backgroundColor = colors.primary; addChip.style.color = '#fff'; };
            addChip.onmouseleave = () => { addChip.style.backgroundColor = colors.bg; addChip.style.color = colors.primary; };
            addChip.onclick = async () => {
                const val = await inputModal(t.addKeywordPrompt);
                if (val) {
                    const newKws = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                    const current = getKeywords();
                    const merged = [...current, ...newKws.filter(k => !current.includes(k))];
                    setKeywords(merged);
                    renderKeywordsTab();
                }
            };
            chipsContainer.appendChild(addChip);
            kwTab.pane.appendChild(chipsContainer);

            // Fila de botones
            const kwBtnRow = document.createElement('div');
            Object.assign(kwBtnRow.style, {
                display: 'flex', gap: '6px'
            });

            // Botón editar todas (separadas por coma)
            const editKwBtn = document.createElement('button');
            editKwBtn.textContent = `✏️ ${t.editKeywords}`;
            Object.assign(editKwBtn.style, {
                padding: '4px 10px', backgroundColor: colors.bg,
                color: colors.gray, border: `1px solid ${colors.border}`,
                borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                fontFamily: 'inherit', flex: '1', transition: 'all 0.15s'
            });
            editKwBtn.onmouseenter = () => { editKwBtn.style.borderColor = colors.primary; editKwBtn.style.color = colors.primary; };
            editKwBtn.onmouseleave = () => { editKwBtn.style.borderColor = colors.border; editKwBtn.style.color = colors.gray; };
            editKwBtn.onclick = async () => {
                const current = getKeywords().join(', ');
                const val = await inputModal(t.editKeywordsPrompt, current);
                if (val !== null) {
                    const updated = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                    if (updated.length > 0) {
                        setKeywords(updated);
                        renderKeywordsTab();
                    }
                }
            };
            kwBtnRow.appendChild(editKwBtn);

            // Botón restaurar predeterminadas
            const resetKwBtn = document.createElement('button');
            resetKwBtn.textContent = `🔄 ${t.resetKeywords}`;
            Object.assign(resetKwBtn.style, {
                padding: '4px 10px', backgroundColor: colors.bg,
                color: colors.gray, border: `1px solid ${colors.border}`,
                borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                fontFamily: 'inherit', flex: '1', transition: 'all 0.15s'
            });
            resetKwBtn.onmouseenter = () => { resetKwBtn.style.borderColor = colors.primary; resetKwBtn.style.color = colors.primary; };
            resetKwBtn.onmouseleave = () => { resetKwBtn.style.borderColor = colors.border; resetKwBtn.style.color = colors.gray; };
            resetKwBtn.onclick = async () => {
                const ok = await confirmModal(t.resetKeywordsConfirm);
                if (ok) {
                    setKeywords(DEFAULT_KEYWORDS);
                    renderKeywordsTab();
                }
            };
            kwBtnRow.appendChild(resetKwBtn);

            kwTab.pane.appendChild(kwBtnRow);

            // Fila de configuración: número total de búsquedas
            const configRow = document.createElement('div');
            Object.assign(configRow.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '6px', marginTop: '10px', paddingTop: '8px',
                borderTop: `1px solid ${colors.border}`
            });

            const configLabel = document.createElement('span');
            configLabel.textContent = `${t.editTotal}: ${getTotal()}`;
            Object.assign(configLabel.style, {
                fontSize: '11px', color: colors.gray
            });
            configRow.appendChild(configLabel);

            const editTotalBtn = document.createElement('button');
            editTotalBtn.textContent = '⚙️';
            editTotalBtn.title = t.editTotal;
            Object.assign(editTotalBtn.style, {
                padding: '2px 8px', backgroundColor: colors.bg,
                color: colors.gray, border: `1px solid ${colors.border}`,
                borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                fontFamily: 'inherit', transition: 'all 0.15s'
            });
            editTotalBtn.onmouseenter = () => { editTotalBtn.style.borderColor = colors.primary; };
            editTotalBtn.onmouseleave = () => { editTotalBtn.style.borderColor = colors.border; };
            editTotalBtn.onclick = async () => {
                const val = await inputModal(t.editTotalPrompt, String(getTotal()));
                if (val !== null) {
                    const n = parseInt(val, 10);
                    if (!isNaN(n) && n >= 1 && n <= 100) {
                        setTotal(n);
                        updateUI(GM_getValue(KEY_COUNT, 0), GM_getValue(KEY_ACTIVE, false));
                        renderKeywordsTab();
                    } else {
                        await confirmModal(t.invalidNumber);
                    }
                }
            };
            configRow.appendChild(editTotalBtn);

            kwTab.pane.appendChild(configRow);
        }

        renderKeywordsTab();

        // =============================================
        // TAB: INFO
        // =============================================

        // Selector de idioma, arriba del bloque informativo: es un ajuste, no un
        // dato, asi que no entra en infoLines (que son pares etiqueta/valor).
        {
            const langRow = document.createElement('div');
            langRow.style.display = 'flex';
            langRow.style.alignItems = 'center';
            langRow.style.gap = '6px';
            langRow.style.marginBottom = '10px';
            langRow.style.paddingBottom = '10px';
            langRow.style.borderBottom = `1px solid ${colors.border}`;
            langRow.title = t.langTip;
            const langLabel = document.createElement('span');
            langLabel.textContent = t.langLabel;
            langLabel.style.fontWeight = 'bold';
            langLabel.style.fontSize = '11px';
            langRow.appendChild(langLabel);
            const langSel = document.createElement('select');
            langSel.style.flex = '1';
            langSel.style.fontSize = '11px';
            langSel.style.padding = '3px 4px';
            langSel.style.background = colors.surface;
            langSel.style.color = colors.text;
            langSel.style.border = `1px solid ${colors.border}`;
            langSel.style.borderRadius = '4px';
            langSel.style.cursor = 'pointer';
            // Las opciones salen de las claves de `i18n`, así que añadir un
            // idioma al diccionario lo añade al selector solo. El nombre visible
            // lo pone Intl.DisplayNames en el propio idioma (Deutsch, 日本語…),
            // que es como se espera ver un selector de idioma; si no estuviera
            // disponible, queda el código, que sigue siendo elegible.
            const langOptions = [{ v: '', label: t.langAuto }].concat(
                Object.keys(i18n).map((code) => {
                    let label = code;
                    try {
                        label = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
                        label = label.charAt(0).toLocaleUpperCase(code) + label.slice(1);
                    } catch (e) { /* sin Intl: se queda el código */ }
                    return { v: code, label };
                }).sort((a, b) => a.label.localeCompare(b.label))
            );
            langOptions.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.v;
                opt.textContent = o.label;
                if (o.v === LANG_PREF) opt.selected = true;
                langSel.appendChild(opt);
            });
            // Recargar en vez de re-renderizar: `t` se resuelve una vez al
            // cargar y esta cableado en todos los nodos ya creados, asi que
            // repintar solo este panel dejaria el resto en el idioma viejo.
            langSel.onchange = () => {
                const v = langSel.value;
                GM_setValue(LANG_KEY, normalizeLang(v));
                location.reload();
            };
            langRow.appendChild(langSel);
            infoTab.pane.appendChild(langRow);
        }
        const infoLines = [
            { label: t.infoName, value: 'Bing Rewards Auto Search' },
            { label: t.infoVersion, value: SCRIPT_VERSION },
            { label: t.infoDescription, value: t.infoDescriptionText },
            { label: t.infoAuthor, value: 'g31w0fw0rld' },
            { label: t.infoGitHub, value: 'github.com/g31w0fw0rld/bing-rewards-auto-search', isLink: true },
            { label: '☕ Ko-fi:', value: 'ko-fi.com/g31w0fw0rld', isLink: true },
            { label: t.infoPrivacy, value: t.infoPrivacyText },
            { label: t.infoHow, value: t.infoHowText }
        ];

        infoLines.forEach(line => {
            const row = document.createElement('div');
            row.style.marginBottom = '6px';
            row.style.lineHeight = '1.4';

            const labelEl = document.createElement('span');
            labelEl.textContent = line.label + ' ';
            labelEl.style.fontWeight = 'bold';
            labelEl.style.fontSize = '11px';
            row.appendChild(labelEl);

            if (line.isLink) {
                const a = document.createElement('a');
                a.href = 'https://' + line.value;
                a.textContent = line.value;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.color = colors.primary;
                a.style.textDecoration = 'underline';
                a.style.fontSize = '11px';
                row.appendChild(a);
            } else {
                const val = document.createElement('span');
                val.textContent = line.value;
                val.style.fontSize = '11px';
                row.appendChild(val);
            }

            infoTab.pane.appendChild(row);
        });

        // --- Ensamblar panel ---
        panel.appendChild(body);
        document.body.appendChild(panel);

        // Activar tab de búsqueda por defecto
        activateTab(0);

        return { updateUI };
    }

    // =============================================
    // INICIALIZACIÓN
    // =============================================
    try {
        checkDailyReset();

        const { updateUI } = buildPanel();
        const count = GM_getValue(KEY_COUNT, 0);
        const active = GM_getValue(KEY_ACTIVE, false);

        if (active && count < getTotal()) {
            executeNextSearch(updateUI);
        } else {
            updateUI(count, active);
        }
    } catch (e) {
        console.error('(bing-rewards-auto-search): Error:', e);
    }
})();
