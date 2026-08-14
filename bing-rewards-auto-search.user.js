// ==UserScript==
// @name         Bing Rewards Auto Search
// @namespace    https://www.bing.com/
// @version      1.3.0
// @description  Runs only the Bing searches you still need today: reads your Microsoft Rewards progress, does just the missing ones, stops when the day is complete, and shows what your points are worth in Xbox credit. Also stops if Bing stops crediting. Queries from your own keywords, rotating search types (70% web plus images, videos, shopping, news), 3-10s delays with 10-25s reading pauses, 22 languages. USE AT YOUR OWN RISK: automating activity may violate the Microsoft Rewards terms.
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

    const SCRIPT_VERSION = '1.3.0';

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
            pointsShort: 'pts',
            searchesLeft: 'búsquedas restantes',
            searchesLeftTip: 'Estimado a partir de los puntos que faltan hoy y de lo que Rewards paga por búsqueda en tu mercado. Suele quedarse corto porque las primeras búsquedas del día no siempre acreditan, así que el script no se detiene por este número: sigue hasta que Rewards marque el día como completo.',
            stalled: 'Bing dejó de acreditar puntos',
            stalledTip: 'Se hicieron varias búsquedas seguidas sin que subiera el contador de Rewards. Suele significar que Bing dejó de pagar esta sesión, así que el script paró en vez de seguir gastando búsquedas para nada. Prueba más tarde, o desde otra red o navegador.',
            capReached: 'Límite de seguridad alcanzado',
            autoLabel: 'Usar mi progreso de Rewards',
            autoTip: 'Con esto activado el script le pregunta a Bing cuántos puntos de búsqueda te faltan hoy, ejecuta solo las búsquedas necesarias, se detiene solo al completarlas y muestra cuánto valen tus puntos. Desactivado no hace ninguna petición de red y usa el número manual de abajo.',
            manualFallbackTip: 'No se pudo leer tu progreso de Rewards, así que manda el número manual de la pestaña de palabras clave.',
            apiNoSession: 'Inicia sesión en Bing para leer tu progreso',
            apiOffline: 'No se pudo leer tu progreso de Rewards',
            xboxBalance: 'en saldo Xbox / Microsoft Store',
            cheapestCard: 'Tarjeta más barata:',
            needMore: 'faltan {n}',
            valueTipExact: 'Calculado con la tasa oficial de canje que publica Rewards para tu mercado: {r} puntos por 1 {c}. Ojo, las tarjetas de importe pequeño salen a peor precio, así que canjeando importes altos aprovechas más los puntos.',
            valueTipApprox: 'Rewards no publica una tasa oficial en tu mercado, así que este cambio se deduce del precio de las tarjetas del catálogo: {r} puntos por 1 {c}. Es aproximado.',
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
            infoDescriptionText: 'Automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards sin intervención manual. Le pregunta a Microsoft Rewards cuántos puntos de búsqueda te faltan hoy, ejecuta solo las búsquedas necesarias, se detiene solo al completarlas y muestra cuánto valen tus puntos en saldo Xbox; el número de ⚙ queda como suplente para cuando no hay sesión de Rewards. Número de búsquedas configurable con ⚙ (1-100, por defecto 20) y controles de iniciar / continuar / detener / reiniciar que cambian según el estado. En la pestaña de palabras clave puedes borrar cada una con un clic, añadir varias separadas por coma, editarlas todas de golpe o restaurar la lista original. El panel flotante se pliega y recuerda cómo lo dejaste, y el idioma del script se elige aquí arriba.',
            infoAuthor: 'Autor:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacidad:',
            infoPrivacyText: 'Tus palabras clave y el contador de búsquedas se guardan solo en el almacenamiento local del gestor de userscripts, en tu navegador. Con «Usar mi progreso de Rewards» activado, el script hace una petición GET a bing.com —el mismo endpoint que alimenta el panel de puntos de la cabecera de Bing— para leer tu progreso del día, tu saldo y el catálogo de canje; viaja con tu sesión de Bing y nada de eso sale hacia terceros ni hacia el autor del script. Desactiva esa casilla y el script no hace ninguna petición de red propia: solo navega a URLs de búsqueda de bing.com, igual que si las escribieras tú.',
            infoHow: 'Cómo funciona:',
            infoHowText: 'Le pregunta a Rewards cuántos puntos de búsqueda faltan hoy y ejecuta solo las necesarias, parando cuando Rewards marca el día como completo; si el contador no sube en varias búsquedas seguidas, para en vez de seguir gastándolas. Genera queries combinando 1 a 3 palabras clave y rota entre búsquedas web (70%), imágenes, videos, shopping y noticias para simular navegación humana. Los delays son aleatorios entre 3-10s, con pausas ocasionales de 10-25s que imitan lectura de resultados. Cada URL incluye parámetros rotados (form, cvid, PC) que Bing identifica como tráfico legítimo. Detecta mobile/desktop automáticamente, el progreso persiste entre recargas de página y el contador se resetea cada día a medianoche.'
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
            pointsShort: 'pts',
            searchesLeft: 'searches left',
            searchesLeftTip: 'Estimated from the points you still need today and what Rewards pays per search in your market. It usually runs low, because the first searches of the day do not always credit, so the script does not stop at this number: it keeps going until Rewards marks the day as complete.',
            stalled: 'Bing stopped crediting points',
            stalledTip: 'Several searches in a row went by without the Rewards counter moving. That usually means Bing stopped paying for this session, so the script stopped instead of burning searches for nothing. Try again later, or from another network or browser.',
            capReached: 'Safety limit reached',
            autoLabel: 'Use my Rewards progress',
            autoTip: 'With this on, the script asks Bing how many search points you still need today, runs only the searches required, stops on its own once they are done, and shows what your points are worth. With it off it makes no network request and uses the manual number below.',
            manualFallbackTip: 'Your Rewards progress could not be read, so the manual number in the keywords tab is what counts.',
            apiNoSession: 'Sign in to Bing to read your progress',
            apiOffline: 'Could not read your Rewards progress',
            xboxBalance: 'in Xbox / Microsoft Store credit',
            cheapestCard: 'Cheapest card:',
            needMore: '{n} to go',
            valueTipExact: 'Worked out with the official redemption rate Rewards publishes for your market: {r} points per 1 {c}. Note that small-value cards are priced worse, so redeeming larger amounts gets more out of your points.',
            valueTipApprox: 'Rewards publishes no official rate for your market, so this rate is inferred from the catalogue card prices: {r} points per 1 {c}. It is approximate.',
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
            infoDescriptionText: 'Automates daily Bing searches to collect Microsoft Rewards points without manual intervention. It asks Microsoft Rewards how many search points you still need today, runs only the searches required, stops on its own once they are done, and shows what your points are worth in Xbox credit; the ⚙ number stays as a stand-in for when there is no Rewards session. Search count configurable with ⚙ (1-100, default 20) and start / continue / stop / restart controls that change with the state. In the keywords tab you can delete each one with a click, add several separated by commas, edit them all at once or restore the original list. The floating panel collapses and remembers how you left it, and the script language is picked right above.',
            infoAuthor: 'Author:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Your keywords and the search counter are stored only in your userscript manager\'s local storage, in your browser. With "Use my Rewards progress" on, the script makes a GET request to bing.com — the same endpoint that feeds the points panel in the Bing header — to read your progress for the day, your balance and the redemption catalogue; it travels with your Bing session and none of it goes to third parties or to the script author. Turn that checkbox off and the script makes no network requests of its own: it only navigates to bing.com search URLs, exactly as if you typed them yourself.',
            infoHow: 'How it works:',
            infoHowText: 'It asks Rewards how many search points are missing today and runs only what is needed, stopping when Rewards marks the day as complete; if the counter does not move across several searches in a row, it stops instead of burning more. Generates queries by combining 1 to 3 keywords and rotates between web (70%), image, video, shopping, and news searches to simulate human browsing. Delays are randomized between 3-10s with occasional 10-25s "reading pauses". Each URL includes rotated parameters (form, cvid, PC) that Bing identifies as legitimate traffic. Mobile/desktop detection is automatic, progress persists across page reloads, and the counter resets daily at midnight.'
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
            pointsShort: 'Pkt.',
            searchesLeft: 'Suchen übrig',
            searchesLeftTip: 'Geschätzt aus den Punkten, die dir heute noch fehlen, und dem, was Rewards in deinem Markt pro Suche zahlt. Der Wert liegt meist zu niedrig, weil die ersten Suchen des Tages nicht immer angerechnet werden. Das Skript hält sich daher nicht an diese Zahl, sondern macht weiter, bis Rewards den Tag als abgeschlossen meldet.',
            stalled: 'Bing rechnet keine Punkte mehr an',
            stalledTip: 'Mehrere Suchen hintereinander, ohne dass der Rewards-Zähler gestiegen ist. Meist heißt das, dass Bing für diese Sitzung nicht mehr zahlt, also hat das Skript aufgehört, statt Suchen zu verschwenden. Versuch es später noch einmal oder aus einem anderen Netzwerk oder Browser.',
            capReached: 'Sicherheitsgrenze erreicht',
            autoLabel: 'Meinen Rewards-Fortschritt verwenden',
            autoTip: 'Ist das aktiv, fragt das Skript bei Bing nach, wie viele Suchpunkte dir heute noch fehlen, führt nur die nötigen Suchen aus, hört von selbst auf, wenn sie erledigt sind, und zeigt, was deine Punkte wert sind. Ist es aus, stellt es keine Netzwerkanfrage und nutzt die manuelle Zahl darunter.',
            manualFallbackTip: 'Dein Rewards-Fortschritt ließ sich nicht lesen, also zählt die manuelle Zahl im Reiter für Schlüsselwörter.',
            apiNoSession: 'Melde dich bei Bing an, um deinen Fortschritt zu lesen',
            apiOffline: 'Rewards-Fortschritt nicht lesbar',
            xboxBalance: 'als Xbox-/Microsoft-Store-Guthaben',
            cheapestCard: 'Günstigste Karte:',
            needMore: 'noch {n}',
            valueTipExact: 'Berechnet mit dem offiziellen Einlösekurs, den Rewards für deinen Markt veröffentlicht: {r} Punkte pro 1 {c}. Achtung: Karten mit kleinem Betrag sind schlechter bepreist, mit größeren Beträgen holst du also mehr aus deinen Punkten.',
            valueTipApprox: 'Rewards veröffentlicht für deinen Markt keinen offiziellen Kurs, daher ist dieser aus den Kartenpreisen im Katalog abgeleitet: {r} Punkte pro 1 {c}. Der Wert ist ungefähr.',
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
            infoDescriptionText: 'Automatisiert die täglichen Bing-Suchen, um ohne manuelles Zutun Punkte für Microsoft Rewards zu sammeln. Es fragt bei Microsoft Rewards nach, wie viele Suchpunkte dir heute noch fehlen, führt nur die nötigen Suchen aus, hört von selbst auf, wenn sie erledigt sind, und zeigt, was deine Punkte als Xbox-Guthaben wert sind; die Zahl unter ⚙ bleibt als Ersatz, wenn keine Rewards-Sitzung besteht. Die Anzahl der Suchen lässt sich mit ⚙ einstellen (1-100, Standard 20), und die Schaltflächen zum Starten, Fortsetzen, Anhalten und Zurücksetzen wechseln je nach Zustand. Im Reiter für Schlüsselwörter kannst du jedes mit einem Klick löschen, mehrere durch Komma getrennt hinzufügen, alle auf einmal bearbeiten oder die ursprüngliche Liste wiederherstellen. Das schwebende Fenster lässt sich einklappen und merkt sich, wie du es hinterlassen hast; die Sprache des Skripts wird hier oben gewählt.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Datenschutz:',
            infoPrivacyText: 'Deine Schlüsselwörter und der Suchzähler werden nur im lokalen Speicher der Userscript-Verwaltung in deinem Browser abgelegt. Ist „Meinen Rewards-Fortschritt verwenden“ aktiv, stellt das Skript eine GET-Anfrage an bing.com — an denselben Endpunkt, der das Punkte-Panel in der Bing-Kopfzeile versorgt —, um deinen Tagesfortschritt, dein Guthaben und den Einlösekatalog zu lesen; sie läuft über deine Bing-Sitzung, und nichts davon geht an Dritte oder an den Autor des Skripts. Schalte das Kästchen aus, dann stellt das Skript keine eigenen Netzwerkanfragen: es navigiert nur zu Such-URLs von bing.com, genauso als hättest du sie selbst eingetippt.',
            infoHow: 'Funktionsweise:',
            infoHowText: 'Es fragt bei Rewards nach, wie viele Suchpunkte heute noch fehlen, und führt nur die nötigen Suchen aus; es hört auf, sobald Rewards den Tag als abgeschlossen meldet. Steigt der Zähler über mehrere Suchen hinweg nicht, hört es auf, statt weitere zu verbrauchen. Es bildet Suchanfragen aus 1 bis 3 Schlüsselwörtern und wechselt zwischen Websuche (70 %), Bildern, Videos, Shopping und Nachrichten, um menschliches Surfen nachzuahmen. Die Wartezeiten liegen zufällig zwischen 3 und 10 s, mit gelegentlichen Pausen von 10 bis 25 s, die das Lesen von Ergebnissen nachbilden. Jede URL enthält wechselnde Parameter (form, cvid, PC), die Bing als legitimen Verkehr einstuft. Mobil und Desktop werden automatisch erkannt, der Fortschritt übersteht das Neuladen der Seite und der Zähler wird täglich um Mitternacht zurückgesetzt.'
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
            pointsShort: 'pts',
            searchesLeft: 'recherches restantes',
            searchesLeftTip: 'Estimation calculée à partir des points qui vous manquent aujourd’hui et de ce que Rewards paie par recherche sur votre marché. Elle est le plus souvent sous-évaluée, car les premières recherches de la journée ne sont pas toujours créditées. Le script ne s’arrête donc pas à ce nombre : il continue jusqu’à ce que Rewards déclare la journée terminée.',
            stalled: 'Bing ne crédite plus de points',
            stalledTip: 'Plusieurs recherches d’affilée sans que le compteur Rewards bouge. Cela signifie en général que Bing ne paie plus pour cette session ; le script s’est donc arrêté au lieu de gaspiller des recherches. Réessayez plus tard, ou depuis un autre réseau ou navigateur.',
            capReached: 'Limite de sécurité atteinte',
            autoLabel: 'Utiliser ma progression Rewards',
            autoTip: 'Avec cette option activée, le script demande à Bing combien de points de recherche vous manquent aujourd’hui, effectue uniquement les recherches nécessaires, s’arrête de lui-même une fois terminé et affiche ce que valent vos points. Désactivée, il ne fait aucune requête réseau et utilise le nombre manuel ci-dessous.',
            manualFallbackTip: 'Votre progression Rewards n’a pas pu être lue : c’est donc le nombre manuel de l’onglet des mots-clés qui compte.',
            apiNoSession: 'Connectez-vous à Bing pour lire votre progression',
            apiOffline: 'Progression Rewards illisible',
            xboxBalance: 'en crédit Xbox / Microsoft Store',
            cheapestCard: 'Carte la moins chère :',
            needMore: 'il manque {n}',
            valueTipExact: 'Calculé avec le taux d’échange officiel que Rewards publie pour votre marché : {r} points pour 1 {c}. Attention, les cartes de petit montant sont moins avantageuses ; échanger de plus gros montants rentabilise mieux vos points.',
            valueTipApprox: 'Rewards ne publie aucun taux officiel pour votre marché ; ce taux est donc déduit du prix des cartes du catalogue : {r} points pour 1 {c}. Il est approximatif.',
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
            infoDescriptionText: 'Automatise les recherches quotidiennes sur Bing pour accumuler des points Microsoft Rewards sans intervention manuelle. Il demande à Microsoft Rewards combien de points de recherche vous manquent aujourd’hui, effectue uniquement les recherches nécessaires, s’arrête de lui-même une fois terminé et affiche ce que valent vos points en crédit Xbox ; le nombre sous ⚙ reste en réserve pour les cas où aucune session Rewards n’est ouverte. Le nombre de recherches se règle avec ⚙ (1-100, 20 par défaut) et les commandes démarrer / poursuivre / arrêter / réinitialiser changent selon l’état. Dans l’onglet des mots-clés, vous pouvez en supprimer un d’un clic, en ajouter plusieurs séparés par des virgules, les modifier tous d’un coup ou rétablir la liste d’origine. Le panneau flottant se replie et retient la position où vous l’avez laissé, et la langue du script se choisit ici en haut.',
            infoAuthor: 'Auteur :', infoGitHub: 'GitHub :', infoPrivacy: 'Confidentialité :',
            infoPrivacyText: 'Vos mots-clés et le compteur de recherches sont conservés uniquement dans le stockage local du gestionnaire de userscripts, dans votre navigateur. Lorsque « Utiliser ma progression Rewards » est activé, le script envoie une requête GET à bing.com — le même point d’accès qui alimente le panneau de points de l’en-tête de Bing — pour lire votre progression du jour, votre solde et le catalogue d’échange ; elle passe par votre session Bing et rien de tout cela ne part vers des tiers ni vers l’auteur du script. Décochez cette case et le script n’effectue aucune requête réseau qui lui soit propre : il navigue seulement vers des URL de recherche de bing.com, exactement comme si vous les saisissiez vous-même.',
            infoHow: 'Fonctionnement :',
            infoHowText: 'Il demande à Rewards combien de points de recherche manquent aujourd’hui et n’effectue que les recherches nécessaires, en s’arrêtant lorsque Rewards déclare la journée terminée ; si le compteur ne bouge pas sur plusieurs recherches d’affilée, il s’arrête au lieu d’en gaspiller davantage. Il compose des requêtes en combinant 1 à 3 mots-clés et alterne entre recherche web (70 %), images, vidéos, shopping et actualités pour imiter une navigation humaine. Les délais sont aléatoires entre 3 et 10 s, avec des pauses occasionnelles de 10 à 25 s qui imitent la lecture des résultats. Chaque URL comporte des paramètres qui tournent (form, cvid, PC) et que Bing identifie comme du trafic légitime. Le mode mobile ou bureau est détecté automatiquement, la progression survit aux rechargements de page et le compteur se remet à zéro chaque jour à minuit.'
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
            pointsShort: 'pts',
            searchesLeft: 'pesquisas restantes',
            searchesLeftTip: 'Estimativa a partir dos pontos que ainda lhe faltam hoje e do que o Rewards paga por pesquisa no seu mercado. Costuma ficar abaixo do real, porque as primeiras pesquisas do dia não são sempre creditadas. Por isso o script não para neste número: continua até o Rewards marcar o dia como concluído.',
            stalled: 'O Bing deixou de creditar pontos',
            stalledTip: 'Várias pesquisas seguidas sem o contador do Rewards subir. Normalmente significa que o Bing deixou de pagar nesta sessão, por isso o script parou em vez de gastar pesquisas em vão. Tente mais tarde, ou a partir de outra rede ou navegador.',
            capReached: 'Limite de segurança atingido',
            autoLabel: 'Usar o meu progresso do Rewards',
            autoTip: 'Com isto ativado o script pergunta ao Bing quantos pontos de pesquisa lhe faltam hoje, faz apenas as pesquisas necessárias, para sozinho quando terminam e mostra quanto valem os seus pontos. Desativado não faz qualquer pedido de rede e usa o número manual abaixo.',
            manualFallbackTip: 'Não foi possível ler o seu progresso do Rewards, por isso vale o número manual do separador de palavras-chave.',
            apiNoSession: 'Inicie sessão no Bing para ler o seu progresso',
            apiOffline: 'Não foi possível ler o progresso do Rewards',
            xboxBalance: 'em saldo Xbox / Microsoft Store',
            cheapestCard: 'Cartão mais barato:',
            needMore: 'faltam {n}',
            valueTipExact: 'Calculado com a taxa oficial de troca que o Rewards publica para o seu mercado: {r} pontos por 1 {c}. Atenção: os cartões de valor pequeno têm pior preço, por isso trocar valores maiores aproveita melhor os pontos.',
            valueTipApprox: 'O Rewards não publica uma taxa oficial no seu mercado, por isso esta é deduzida do preço dos cartões do catálogo: {r} pontos por 1 {c}. É aproximada.',
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
            infoDescriptionText: 'Automatiza pesquisas diárias no Bing para acumular pontos do Microsoft Rewards sem intervenção manual. Pergunta ao Microsoft Rewards quantos pontos de pesquisa lhe faltam hoje, faz apenas as pesquisas necessárias, para sozinho quando as termina e mostra quanto valem os seus pontos em saldo Xbox; o número do ⚙ fica como suplente para quando não há sessão do Rewards. O número de pesquisas configura-se com ⚙ (1-100, 20 por omissão) e os controlos de iniciar / continuar / parar / reiniciar mudam consoante o estado. No separador de palavras-chave pode apagar cada uma com um clique, adicionar várias separadas por vírgula, editá-las todas de uma vez ou repor a lista original. O painel flutuante recolhe-se e lembra-se de como o deixou, e o idioma do script escolhe-se aqui em cima.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacidade:',
            infoPrivacyText: 'As suas palavras-chave e o contador de pesquisas são guardados apenas no armazenamento local do gestor de userscripts, no seu navegador. Com «Usar o meu progresso do Rewards» ativado, o script faz um pedido GET ao bing.com — o mesmo ponto de acesso que alimenta o painel de pontos do cabeçalho do Bing — para ler o seu progresso do dia, o seu saldo e o catálogo de troca; viaja com a sua sessão do Bing e nada disso sai para terceiros nem para o autor do script. Desative essa caixa e o script não faz qualquer pedido de rede próprio: limita-se a navegar para URLs de pesquisa do bing.com, tal como se fosse você a escrevê-los.',
            infoHow: 'Como funciona:',
            infoHowText: 'Pergunta ao Rewards quantos pontos de pesquisa faltam hoje e faz apenas as necessárias, parando quando o Rewards marca o dia como concluído; se o contador não subir ao longo de várias pesquisas seguidas, para em vez de gastar mais. Gera consultas combinando 1 a 3 palavras-chave e alterna entre pesquisas web (70%), imagens, vídeos, compras e notícias para simular navegação humana. Os atrasos são aleatórios entre 3-10 s, com pausas ocasionais de 10-25 s que imitam a leitura dos resultados. Cada URL inclui parâmetros rotativos (form, cvid, PC) que o Bing identifica como tráfego legítimo. Deteta automaticamente telemóvel ou computador, o progresso persiste entre recargas da página e o contador é reposto todos os dias à meia-noite.'
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
            pointsShort: 'б.',
            searchesLeft: 'запросов осталось',
            searchesLeftTip: 'Оценка по баллам, которых вам сегодня не хватает, и по тому, сколько Rewards платит за запрос в вашем регионе. Обычно она занижена: первые запросы дня начисляются не всегда. Поэтому скрипт не останавливается на этом числе, а продолжает, пока Rewards не отметит день как завершённый.',
            stalled: 'Bing перестал начислять баллы',
            stalledTip: 'Несколько запросов подряд прошли без движения счётчика Rewards. Обычно это значит, что Bing больше не платит за эту сессию, поэтому скрипт остановился, а не стал тратить запросы впустую. Попробуйте позже или из другой сети либо браузера.',
            capReached: 'Достигнут предохранительный предел',
            autoLabel: 'Использовать мой прогресс Rewards',
            autoTip: 'Когда включено, скрипт спрашивает у Bing, сколько поисковых баллов вам осталось получить сегодня, выполняет только нужные запросы, сам останавливается по завершении и показывает, сколько стоят ваши баллы. Когда выключено, он не делает ни одного сетевого запроса и берёт число, заданное вручную ниже.',
            manualFallbackTip: 'Прочитать ваш прогресс Rewards не удалось, поэтому решает число, заданное вручную на вкладке ключевых слов.',
            apiNoSession: 'Войдите в Bing, чтобы прочитать прогресс',
            apiOffline: 'Не удалось прочитать прогресс Rewards',
            xboxBalance: 'на счёт Xbox / Microsoft Store',
            cheapestCard: 'Самая дешёвая карта:',
            needMore: 'не хватает {n}',
            valueTipExact: 'Рассчитано по официальному курсу обмена, который Rewards публикует для вашего региона: {r} баллов за 1 {c}. Учтите, что карты на небольшие суммы стоят невыгоднее, так что обмен на крупные суммы даёт больше отдачи от баллов.',
            valueTipApprox: 'Для вашего региона Rewards не публикует официальный курс, поэтому он выведен из цен карт в каталоге: {r} баллов за 1 {c}. Значение приблизительное.',
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
            infoDescriptionText: 'Автоматизирует ежедневные запросы в Bing, чтобы копить баллы Microsoft Rewards без ручных действий. Скрипт спрашивает у Microsoft Rewards, сколько поисковых баллов вам осталось получить сегодня, выполняет только нужные запросы, сам останавливается по завершении и показывает, сколько ваши баллы стоят в виде счёта Xbox; число под ⚙ остаётся на подмену, когда сессии Rewards нет. Количество запросов настраивается кнопкой ⚙ (1-100, по умолчанию 20), а кнопки запуска, продолжения, остановки и сброса меняются в зависимости от состояния. На вкладке ключевых слов каждое можно удалить одним щелчком, добавить несколько через запятую, изменить все сразу или вернуть исходный список. Плавающая панель сворачивается и запоминает, как вы её оставили, а язык скрипта выбирается здесь наверху.',
            infoAuthor: 'Автор:', infoGitHub: 'GitHub:', infoPrivacy: 'Конфиденциальность:',
            infoPrivacyText: 'Ваши ключевые слова и счётчик запросов хранятся только в локальном хранилище менеджера пользовательских скриптов, в вашем браузере. Если включено «Использовать мой прогресс Rewards», скрипт делает GET-запрос к bing.com — к тому же адресу, который питает панель баллов в шапке Bing, — чтобы прочитать ваш прогресс за день, баланс и каталог обмена; запрос идёт через вашу сессию Bing, и ничто из этого не уходит третьим сторонам или автору скрипта. Снимите этот флажок, и скрипт не будет делать собственных сетевых запросов: он лишь переходит по поисковым адресам bing.com, ровно так же, как если бы вы набрали их сами.',
            infoHow: 'Как это работает:',
            infoHowText: 'Скрипт спрашивает у Rewards, сколько поисковых баллов не хватает сегодня, и выполняет только нужные запросы, останавливаясь, когда Rewards отмечает день как завершённый; если счётчик не растёт несколько запросов подряд, он останавливается, а не тратит их дальше. Скрипт составляет запросы из 1-3 ключевых слов и чередует веб-поиск (70 %), изображения, видео, покупки и новости, изображая обычный просмотр. Задержки случайны в пределах 3-10 с, изредка с паузами 10-25 с, имитирующими чтение результатов. В каждый адрес подставляются меняющиеся параметры (form, cvid, PC), которые Bing принимает за обычный трафик. Мобильный и настольный режимы определяются автоматически, прогресс переживает перезагрузку страницы, а счётчик обнуляется каждый день в полночь.'
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
            pointsShort: 'p',
            searchesLeft: 'arama kaldı',
            searchesLeftTip: 'Bugün eksik kalan puanlarınıza ve Rewards’ın pazarınızda arama başına ödediği puana göre yapılan tahmin. Genellikle olduğundan düşük çıkar, çünkü günün ilk aramaları her zaman hesaba geçmez. Bu yüzden betik bu sayıya göre durmaz; Rewards günü tamamlandı olarak işaretleyene kadar sürdürür.',
            stalled: 'Bing puan vermeyi bıraktı',
            stalledTip: 'Rewards sayacı hiç ilerlemeden üst üste birkaç arama yapıldı. Bu genellikle Bing’in bu oturum için artık ödeme yapmadığı anlamına gelir; betik de boşa arama harcamak yerine durdu. Daha sonra ya da başka bir ağ veya tarayıcıdan deneyin.',
            capReached: 'Güvenlik sınırına ulaşıldı',
            autoLabel: 'Rewards ilerlememi kullan',
            autoTip: 'Bu açıkken betik Bing’e bugün kaç arama puanınızın eksik olduğunu sorar, yalnızca gereken aramaları yapar, bitince kendiliğinden durur ve puanlarınızın ne değerde olduğunu gösterir. Kapalıyken hiçbir ağ isteği yapmaz ve aşağıdaki elle girilen sayıyı kullanır.',
            manualFallbackTip: 'Rewards ilerlemeniz okunamadı, bu yüzden anahtar kelimeler sekmesindeki elle girilen sayı geçerli.',
            apiNoSession: 'İlerlemenizi okumak için Bing’de oturum açın',
            apiOffline: 'Rewards ilerlemesi okunamadı',
            xboxBalance: 'Xbox / Microsoft Store bakiyesi olarak',
            cheapestCard: 'En ucuz kart:',
            needMore: '{n} eksik',
            valueTipExact: 'Rewards’ın pazarınız için yayımladığı resmi kullanım kuruna göre hesaplandı: 1 {c} için {r} puan. Dikkat: küçük tutarlı kartların fiyatı daha kötüdür, yani büyük tutarlarda kullanmak puanlarınızdan daha çok yararlanmanızı sağlar.',
            valueTipApprox: 'Rewards pazarınız için resmi bir kur yayımlamıyor, bu yüzden bu kur katalogdaki kart fiyatlarından çıkarıldı: 1 {c} için {r} puan. Yaklaşık bir değerdir.',
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
            infoDescriptionText: 'Microsoft Rewards puanı biriktirmek için günlük Bing aramalarını elle uğraşmadan otomatikleştirir. Betik, Microsoft Rewards’a bugün kaç arama puanınızın eksik olduğunu sorar, yalnızca gereken aramaları yapar, bitince kendiliğinden durur ve puanlarınızın Xbox bakiyesi olarak ne değerde olduğunu gösterir; ⚙ altındaki sayı, Rewards oturumu olmadığı durumlar için yedek kalır. Arama sayısı ⚙ ile ayarlanır (1-100, varsayılan 20); başlat / sürdür / durdur / sıfırla düğmeleri duruma göre değişir. Anahtar kelimeler sekmesinde her birini tek tıkla silebilir, virgülle ayırarak birkaçını ekleyebilir, hepsini birden düzenleyebilir veya özgün listeyi geri yükleyebilirsiniz. Yüzen panel katlanır ve onu nasıl bıraktığınızı hatırlar; betiğin dili de buradan, en üstten seçilir.',
            infoAuthor: 'Yazar:', infoGitHub: 'GitHub:', infoPrivacy: 'Gizlilik:',
            infoPrivacyText: 'Anahtar kelimeleriniz ve arama sayacı yalnızca tarayıcınızdaki userscript yöneticisinin yerel deposunda tutulur. “Rewards ilerlememi kullan” açıkken betik bing.com’a bir GET isteği yapar — Bing başlığındaki puan panelini besleyen aynı uç nokta — ve günün ilerlemesini, bakiyenizi ve kullanım katalogunu okur; istek sizin Bing oturumunuzla gider ve bunların hiçbiri üçüncü taraflara ya da betiğin yazarına ulaşmaz. O kutuyu kapatın, betik kendine ait hiçbir ağ isteği yapmaz: yalnızca bing.com arama adreslerine gider, tıpkı siz yazmışsınız gibi.',
            infoHow: 'Nasıl çalışır:',
            infoHowText: 'Betik, Rewards’a bugün kaç arama puanı eksik olduğunu sorar ve yalnızca gerekenleri yapar; Rewards günü tamamlandı olarak işaretleyince durur. Sayaç üst üste birkaç aramada ilerlemezse, daha fazla harcamak yerine durur. 1 ila 3 anahtar kelimeyi birleştirerek sorgular üretir ve insan gezinmesini taklit etmek için web araması (%70), görseller, videolar, alışveriş ve haberler arasında dönüşümlü geçer. Bekleme süreleri 3-10 sn arasında rastgeledir; ara sıra sonuçların okunmasını taklit eden 10-25 sn’lik duraklamalar olur. Her adres, Bing’in meşru trafik olarak gördüğü dönüşümlü parametreler (form, cvid, PC) içerir. Mobil ve masaüstü otomatik olarak algılanır, ilerleme sayfa yenilemelerinde korunur ve sayaç her gün gece yarısı sıfırlanır.'
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
            pointsShort: 'pt',
            searchesLeft: '件の検索が残り',
            searchesLeftTip: '今日まだ足りないポイントと、あなたの市場で Rewards が1検索あたりに払うポイントから出した目安です。その日の最初の数回は加算されないことがあるため、実際より少なく出るのが普通です。そのためスクリプトはこの数では止まらず、Rewards が「完了」と示すまで続けます。',
            stalled: 'Bing がポイントを加算しなくなりました',
            stalledTip: 'Rewards のカウンターが動かないまま検索が数回続きました。多くの場合、このセッションでは Bing が支払いをやめたということなので、検索を無駄にせずスクリプトを止めました。時間をおくか、別のネットワークやブラウザーで試してください。',
            capReached: '安全上限に達しました',
            autoLabel: 'Rewards の進捗を使う',
            autoTip: 'オンにすると、今日あと何ポイント足りないかを Bing に問い合わせ、必要な回数だけ検索し、終われば自動で停止して、ポイントの価値を表示します。オフにするとネットワーク要求は一切行わず、下の手動の回数を使います。',
            manualFallbackTip: 'Rewards の進捗を読めなかったので、キーワードのタブにある手動の回数が有効になります。',
            apiNoSession: '進捗を読むには Bing にサインインしてください',
            apiOffline: 'Rewards の進捗を読めませんでした',
            xboxBalance: 'Xbox / Microsoft Store の残高として',
            cheapestCard: '最安のカード:',
            needMore: 'あと {n}',
            valueTipExact: 'Rewards があなたの市場向けに公開している公式の交換レート（1 {c} あたり {r} ポイント）で計算しています。少額のカードは割高なので、大きい額で交換したほうがポイントを活かせます。',
            valueTipApprox: 'あなたの市場には Rewards の公式レートがないため、カタログのカード価格から割り出しています（1 {c} あたり {r} ポイント）。おおよその値です。',
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
            infoDescriptionText: 'Microsoft Rewards のポイントを手作業なしで貯めるため、Bing の毎日の検索を自動化します。今日あと何ポイント足りないかを Microsoft Rewards に問い合わせ、必要な回数だけ検索し、終われば自動で停止して、ポイントが Xbox 残高でいくらになるかを表示します。⚙ の回数は、Rewards のセッションがないときの控えとして残ります。検索回数は ⚙ で設定でき（1〜100、既定は 20）、開始・再開・停止・リセットのボタンは状態に応じて切り替わります。キーワードのタブでは、ひとつずつクリックで削除、カンマ区切りでまとめて追加、全体を一括編集、元の一覧に復元ができます。浮動パネルは折りたためて状態を記憶し、スクリプトの言語はこの上部で選べます。',
            infoAuthor: '作者:', infoGitHub: 'GitHub:', infoPrivacy: 'プライバシー:',
            infoPrivacyText: 'キーワードと検索カウンターは、ブラウザー内のユーザースクリプト管理アドオンのローカルストレージにのみ保存されます。「Rewards の進捗を使う」がオンのときは、その日の進捗・残高・交換カタログを読むために bing.com へ GET 要求を1件送ります。宛先は Bing のヘッダーのポイント パネルを動かしているのと同じエンドポイントで、あなたの Bing セッションを通ります。その内容が第三者やスクリプトの作者に渡ることはありません。このチェックを外せば、スクリプトは独自のネットワーク要求を一切行いません。自分で入力した場合とまったく同じように、bing.com の検索 URL へ移動するだけです。',
            infoHow: '仕組み:',
            infoHowText: '今日あと何ポイント足りないかを Rewards に問い合わせ、必要な分だけ検索し、Rewards が「完了」と示したら停止します。検索を数回続けてもカウンターが上がらない場合は、それ以上使わずに止まります。 キーワードを1〜3語組み合わせてクエリを作り、人間の閲覧に近づけるためウェブ検索（70%）、画像、動画、ショッピング、ニュースを切り替えます。待ち時間は3〜10秒のランダムで、結果を読む動作を模した10〜25秒の休止がときどき入ります。各 URL には Bing が正当なトラフィックとみなす可変パラメーター（form、cvid、PC）が付きます。モバイルとデスクトップは自動判定され、進捗はページの再読み込みをまたいで保持され、カウンターは毎日0時にリセットされます。'
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
            pointsShort: 'pt',
            searchesLeft: '회 남음',
            searchesLeftTip: '오늘 아직 모자란 포인트와, 사용자의 시장에서 Rewards가 검색 한 번에 주는 포인트로 계산한 어림값입니다. 하루의 처음 몇 번은 적립되지 않을 때가 있어 보통 실제보다 적게 나옵니다. 그래서 스크립트는 이 숫자에서 멈추지 않고, Rewards가 완료로 표시할 때까지 계속합니다.',
            stalled: 'Bing이 포인트 적립을 멈췄습니다',
            stalledTip: 'Rewards 카운터가 오르지 않은 채 검색이 여러 번 이어졌습니다. 보통 이 세션에서 Bing이 더 이상 지급하지 않는다는 뜻이라, 검색을 낭비하지 않도록 스크립트가 멈췄습니다. 나중에 다시, 또는 다른 네트워크나 브라우저에서 시도해 보세요.',
            capReached: '안전 한도에 도달했습니다',
            autoLabel: '내 Rewards 진행 상황 사용',
            autoTip: '켜 두면 스크립트가 오늘 검색 포인트가 얼마나 남았는지 Bing에 물어보고, 필요한 만큼만 검색하고, 끝나면 스스로 멈추며, 포인트의 가치를 보여줍니다. 끄면 네트워크 요청을 전혀 하지 않고 아래의 수동 횟수를 씁니다.',
            manualFallbackTip: 'Rewards 진행 상황을 읽지 못했으므로 키워드 탭의 수동 횟수가 기준이 됩니다.',
            apiNoSession: '진행 상황을 읽으려면 Bing에 로그인하세요',
            apiOffline: 'Rewards 진행 상황을 읽지 못했습니다',
            xboxBalance: 'Xbox / Microsoft Store 잔액으로',
            cheapestCard: '가장 싼 카드:',
            needMore: '{n} 부족',
            valueTipExact: 'Rewards가 사용자의 시장에 공개한 공식 교환 비율(1 {c}당 {r} 포인트)로 계산했습니다. 소액 카드는 값이 더 나쁘니, 큰 금액으로 교환하면 포인트를 더 잘 활용할 수 있습니다.',
            valueTipApprox: '사용자의 시장에는 Rewards의 공식 비율이 없어 카탈로그의 카드 가격에서 유추했습니다(1 {c}당 {r} 포인트). 어림값입니다.',
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
            infoDescriptionText: '손대지 않고도 Microsoft Rewards 포인트를 쌓도록 Bing의 일일 검색을 자동화합니다. 오늘 검색 포인트가 얼마나 남았는지 Microsoft Rewards에 물어보고, 필요한 만큼만 검색하고, 끝나면 스스로 멈추며, 포인트가 Xbox 잔액으로 얼마인지 보여줍니다. ⚙의 횟수는 Rewards 세션이 없을 때를 위한 대비로 남습니다. 검색 횟수는 ⚙로 설정하며(1-100, 기본 20), 시작·계속·중지·초기화 버튼은 상태에 따라 바뀝니다. 키워드 탭에서는 하나씩 클릭해 삭제하거나, 쉼표로 구분해 여러 개를 추가하거나, 전체를 한 번에 편집하거나, 원래 목록으로 되돌릴 수 있습니다. 떠 있는 패널은 접을 수 있고 마지막 상태를 기억하며, 스크립트 언어는 이 위쪽에서 고릅니다.',
            infoAuthor: '제작자:', infoGitHub: 'GitHub:', infoPrivacy: '개인정보:',
            infoPrivacyText: '키워드와 검색 카운터는 브라우저 안 사용자 스크립트 관리자의 로컬 저장소에만 보관됩니다. "내 Rewards 진행 상황 사용"이 켜져 있으면, 스크립트는 오늘의 진행 상황과 잔액, 교환 카탈로그를 읽기 위해 bing.com에 GET 요청을 보냅니다. Bing 머리글의 포인트 패널을 움직이는 것과 같은 엔드포인트이며, 사용자의 Bing 세션을 통해 전달됩니다. 그 내용이 제3자나 스크립트 제작자에게 가는 일은 없습니다. 이 체크를 끄면 스크립트는 자체적인 네트워크 요청을 전혀 하지 않습니다. 직접 입력했을 때와 똑같이 bing.com의 검색 주소로 이동할 뿐입니다.',
            infoHow: '작동 방식:',
            infoHowText: '오늘 검색 포인트가 얼마나 남았는지 Rewards에 물어보고 필요한 만큼만 검색하며, Rewards가 완료로 표시하면 멈춥니다. 검색을 여러 번 해도 카운터가 오르지 않으면 더 쓰지 않고 멈춥니다. 키워드 1~3개를 조합해 검색어를 만들고, 사람이 둘러보는 것처럼 보이도록 웹 검색(70%), 이미지, 동영상, 쇼핑, 뉴스를 번갈아 사용합니다. 지연 시간은 3~10초 사이에서 무작위이며, 결과를 읽는 것을 흉내 낸 10~25초의 휴지가 가끔 들어갑니다. 각 주소에는 Bing이 정상 트래픽으로 인식하는 순환 매개변수(form, cvid, PC)가 붙습니다. 모바일과 데스크톱은 자동으로 구분하고, 진행 상황은 페이지를 새로 고쳐도 유지되며, 카운터는 매일 자정에 초기화됩니다.'
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
            pointsShort: 'pkt',
            searchesLeft: 'wyszukiwań zostało',
            searchesLeftTip: 'Szacunek na podstawie punktów, których dziś jeszcze brakuje, i tego, ile Rewards płaci za wyszukiwanie na twoim rynku. Zwykle wypada za nisko, bo pierwsze wyszukiwania dnia nie zawsze są zaliczane. Dlatego skrypt nie zatrzymuje się na tej liczbie, lecz działa, aż Rewards oznaczy dzień jako ukończony.',
            stalled: 'Bing przestał przyznawać punkty',
            stalledTip: 'Kilka wyszukiwań pod rząd minęło bez wzrostu licznika Rewards. Zwykle oznacza to, że Bing przestał płacić w tej sesji, więc skrypt się zatrzymał, zamiast marnować wyszukiwania. Spróbuj później albo z innej sieci lub przeglądarki.',
            capReached: 'Osiągnięto limit bezpieczeństwa',
            autoLabel: 'Używaj mojego postępu Rewards',
            autoTip: 'Gdy to jest włączone, skrypt pyta Bing, ile punktów za wyszukiwania brakuje ci dzisiaj, wykonuje tylko potrzebne wyszukiwania, sam się zatrzymuje po ich ukończeniu i pokazuje, ile warte są twoje punkty. Gdy jest wyłączone, nie wykonuje żadnego żądania sieciowego i używa ręcznej liczby poniżej.',
            manualFallbackTip: 'Nie udało się odczytać twojego postępu Rewards, więc liczy się ręczna liczba z zakładki słów kluczowych.',
            apiNoSession: 'Zaloguj się w Bingu, aby odczytać postęp',
            apiOffline: 'Nie udało się odczytać postępu Rewards',
            xboxBalance: 'w środkach Xbox / Microsoft Store',
            cheapestCard: 'Najtańsza karta:',
            needMore: 'brakuje {n}',
            valueTipExact: 'Wyliczone według oficjalnego kursu wymiany, który Rewards podaje dla twojego rynku: {r} punktów za 1 {c}. Uwaga: karty o małej wartości mają gorszą cenę, więc wymiana na wyższe kwoty lepiej wykorzystuje punkty.',
            valueTipApprox: 'Rewards nie podaje oficjalnego kursu dla twojego rynku, więc ten wynika z cen kart w katalogu: {r} punktów za 1 {c}. Jest przybliżony.',
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
            infoDescriptionText: 'Automatyzuje codzienne wyszukiwania w Bingu, aby zbierać punkty Microsoft Rewards bez ręcznej pracy. Skrypt pyta Microsoft Rewards, ile punktów za wyszukiwania brakuje ci dzisiaj, wykonuje tylko potrzebne wyszukiwania, sam się zatrzymuje po ich ukończeniu i pokazuje, ile twoje punkty są warte w środkach Xbox; liczba pod ⚙ zostaje na zastępstwo, gdy nie ma sesji Rewards. Liczbę wyszukiwań ustawia się przyciskiem ⚙ (1-100, domyślnie 20), a przyciski start / kontynuuj / zatrzymaj / wyzeruj zmieniają się zależnie od stanu. W zakładce słów kluczowych możesz usunąć każde jednym kliknięciem, dodać kilka oddzielonych przecinkami, zmienić wszystkie naraz albo przywrócić pierwotną listę. Pływający panel zwija się i pamięta, jak go zostawiłeś, a język skryptu wybiera się tutaj, na górze.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Prywatność:',
            infoPrivacyText: 'Twoje słowa kluczowe i licznik wyszukiwań są zapisywane wyłącznie w pamięci lokalnej menedżera userscriptów, w twojej przeglądarce. Gdy włączone jest „Używaj mojego postępu Rewards”, skrypt wysyła żądanie GET do bing.com — do tego samego punktu, który zasila panel punktów w nagłówku Binga — aby odczytać twój dzisiejszy postęp, saldo i katalog wymiany; żądanie idzie przez twoją sesję Binga i nic z tego nie trafia do osób trzecich ani do autora skryptu. Odznacz to pole i skrypt nie wykona żadnych własnych żądań sieciowych: będzie tylko przechodził pod adresy wyszukiwania bing.com, dokładnie tak, jakbyś wpisał je sam.',
            infoHow: 'Jak to działa:',
            infoHowText: 'Skrypt pyta Rewards, ile punktów za wyszukiwania brakuje dzisiaj, i wykonuje tylko potrzebne, zatrzymując się, gdy Rewards oznaczy dzień jako ukończony; jeśli licznik nie rośnie przez kilka wyszukiwań pod rząd, skrypt się zatrzymuje, zamiast marnować kolejne. Tworzy zapytania, łącząc od 1 do 3 słów kluczowych, i przeplata wyszukiwanie w sieci (70%), grafiki, filmy, zakupy i wiadomości, żeby przypominało to przeglądanie przez człowieka. Opóźnienia są losowe w zakresie 3-10 s, z okazjonalnymi przerwami 10-25 s naśladującymi czytanie wyników. Każdy adres zawiera zmieniające się parametry (form, cvid, PC), które Bing traktuje jako zwykły ruch. Tryb mobilny i komputerowy jest rozpoznawany automatycznie, postęp przetrwa przeładowanie strony, a licznik zeruje się codziennie o północy.'
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
            pointsShort: 'p',
            searchesLeft: 'hakua jäljellä',
            searchesLeftTip: 'Arvio perustuu tänään vielä puuttuviin pisteisiin ja siihen, paljonko Rewards maksaa haulta markkinallasi. Arvio jää yleensä liian pieneksi, koska päivän ensimmäiset haut eivät aina kerry. Siksi skripti ei pysähdy tähän lukuun vaan jatkaa, kunnes Rewards merkitsee päivän valmiiksi.',
            stalled: 'Bing lakkasi kirjaamasta pisteitä',
            stalledTip: 'Useita hakuja peräkkäin ilman että Rewards-laskuri nousi. Yleensä se tarkoittaa, ettei Bing enää maksa tästä istunnosta, joten skripti pysähtyi eikä kuluttanut hakuja turhaan. Yritä myöhemmin uudelleen tai toisesta verkosta tai selaimesta.',
            capReached: 'Turvaraja saavutettu',
            autoLabel: 'Käytä Rewards-edistymistäni',
            autoTip: 'Kun tämä on käytössä, skripti kysyy Bingiltä, montako hakupistettä sinulta puuttuu tänään, tekee vain tarvittavat haut, pysähtyy itse kun ne on tehty ja näyttää, paljonko pisteesi ovat arvoltaan. Kun se on pois käytöstä, skripti ei tee lainkaan verkkopyyntöjä ja käyttää alla olevaa käsin annettua lukua.',
            manualFallbackTip: 'Rewards-edistymistäsi ei saatu luettua, joten ratkaisee avainsanavälilehden käsin annettu luku.',
            apiNoSession: 'Kirjaudu Bingiin, niin edistyminen voidaan lukea',
            apiOffline: 'Rewards-edistymistä ei saatu luettua',
            xboxBalance: 'Xbox- / Microsoft Store -saldona',
            cheapestCard: 'Halvin kortti:',
            needMore: 'puuttuu {n}',
            valueTipExact: 'Laskettu virallisella lunastuskurssilla, jonka Rewards julkaisee markkinallesi: {r} pistettä / 1 {c}. Huomaa, että pienten summien kortit on hinnoiteltu huonommin, joten suuremmat summat hyödyntävät pisteitä paremmin.',
            valueTipApprox: 'Rewards ei julkaise markkinallesi virallista kurssia, joten tämä on päätelty luettelon korttihinnoista: {r} pistettä / 1 {c}. Arvo on likimääräinen.',
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
            infoDescriptionText: 'Automatisoi päivittäiset Bing-haut, jotta Microsoft Rewards -pisteitä kertyy ilman käsityötä. Skripti kysyy Microsoft Rewardsilta, montako hakupistettä sinulta puuttuu tänään, tekee vain tarvittavat haut, pysähtyy itse kun ne on tehty ja näyttää, paljonko pisteesi ovat arvoltaan Xbox-saldona; ⚙-painikkeen luku jää varalle niitä tilanteita varten, joissa Rewards-istuntoa ei ole. Hakujen määrä säädetään ⚙-painikkeella (1-100, oletus 20), ja aloitus-, jatkamis-, pysäytys- ja nollauspainikkeet vaihtuvat tilan mukaan. Avainsanavälilehdellä voit poistaa jokaisen yhdellä napsautuksella, lisätä useita pilkulla eroteltuina, muokata kaikkia kerralla tai palauttaa alkuperäisen listan. Kelluva paneeli taittuu kokoon ja muistaa, mihin sen jätit, ja skriptin kieli valitaan täältä ylhäältä.',
            infoAuthor: 'Tekijä:', infoGitHub: 'GitHub:', infoPrivacy: 'Tietosuoja:',
            infoPrivacyText: 'Avainsanasi ja hakulaskuri tallennetaan vain käyttäjäskriptien hallinnan paikalliseen tallennustilaan selaimessasi. Kun ”Käytä Rewards-edistymistäni” on käytössä, skripti tekee GET-pyynnön osoitteeseen bing.com — samaan päätepisteeseen, joka syöttää Bingin ylätunnisteen pistepaneelin — lukeakseen päivän edistymisen, saldosi ja lunastusluettelon; pyyntö kulkee Bing-istuntosi kautta, eikä mikään siitä mene kolmansille osapuolille tai skriptin tekijälle. Poista rasti ruudusta, niin skripti ei tee lainkaan omia verkkopyyntöjä: se vain siirtyy bing.comin hakuosoitteisiin täsmälleen kuten jos kirjoittaisit ne itse.',
            infoHow: 'Miten se toimii:',
            infoHowText: 'Skripti kysyy Rewardsilta, montako hakupistettä tänään puuttuu, ja tekee vain tarvittavat haut pysähtyen, kun Rewards merkitsee päivän valmiiksi. Jos laskuri ei nouse usean haun aikana, skripti pysähtyy sen sijaan että kuluttaisi hakuja lisää. Se muodostaa hakuja yhdistelemällä 1-3 avainsanaa ja vuorottelee verkkohaun (70 %), kuvien, videoiden, ostosten ja uutisten välillä jäljitelläkseen ihmisen selailua. Viiveet ovat satunnaisia 3-10 s, ja välillä tulee 10-25 s taukoja, jotka jäljittelevät tulosten lukemista. Jokaisessa osoitteessa on vaihtuvia parametreja (form, cvid, PC), jotka Bing tulkitsee tavalliseksi liikenteeksi. Mobiili ja työpöytä tunnistetaan automaattisesti, edistyminen säilyy sivun uudelleenlatausten yli ja laskuri nollautuu joka päivä keskiyöllä.'
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
            pointsShort: 'điểm',
            searchesLeft: 'lượt tìm còn lại',
            searchesLeftTip: 'Ước tính từ số điểm bạn còn thiếu hôm nay và số điểm Rewards trả cho mỗi lượt tìm ở thị trường của bạn. Thường thấp hơn thực tế, vì những lượt tìm đầu ngày không luôn được tính. Vì vậy tập lệnh không dừng ở con số này, mà tiếp tục đến khi Rewards báo là đã xong ngày.',
            stalled: 'Bing đã ngừng cộng điểm',
            stalledTip: 'Nhiều lượt tìm liên tiếp mà bộ đếm Rewards không tăng. Thường điều đó nghĩa là Bing đã ngừng trả điểm cho phiên này, nên tập lệnh dừng lại thay vì tiêu lượt tìm vô ích. Hãy thử lại sau, hoặc từ mạng hay trình duyệt khác.',
            capReached: 'Đã tới giới hạn an toàn',
            autoLabel: 'Dùng tiến độ Rewards của tôi',
            autoTip: 'Khi bật, tập lệnh hỏi Bing xem hôm nay bạn còn thiếu bao nhiêu điểm tìm kiếm, chỉ chạy những lượt tìm cần thiết, tự dừng khi xong, và cho biết điểm của bạn đáng giá bao nhiêu. Khi tắt, nó không thực hiện bất kỳ yêu cầu mạng nào và dùng con số đặt tay ở dưới.',
            manualFallbackTip: 'Không đọc được tiến độ Rewards của bạn, nên con số đặt tay ở thẻ từ khóa là con số quyết định.',
            apiNoSession: 'Đăng nhập Bing để đọc tiến độ của bạn',
            apiOffline: 'Không đọc được tiến độ Rewards của bạn',
            xboxBalance: 'thành số dư Xbox / Microsoft Store',
            cheapestCard: 'Thẻ rẻ nhất:',
            needMore: 'còn thiếu {n}',
            valueTipExact: 'Tính theo tỷ lệ quy đổi chính thức mà Rewards công bố cho thị trường của bạn: {r} điểm cho 1 {c}. Lưu ý thẻ mệnh giá nhỏ có giá kém hơn, nên đổi mệnh giá lớn sẽ tận dụng điểm tốt hơn.',
            valueTipApprox: 'Rewards không công bố tỷ lệ chính thức ở thị trường của bạn, nên tỷ lệ này được suy ra từ giá thẻ trong danh mục: {r} điểm cho 1 {c}. Đây là con số gần đúng.',
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
            infoDescriptionText: 'Tự động hóa các lượt tìm kiếm hằng ngày trên Bing để tích điểm Microsoft Rewards mà không cần thao tác tay. Tập lệnh hỏi Microsoft Rewards xem hôm nay bạn còn thiếu bao nhiêu điểm tìm kiếm, chỉ chạy những lượt tìm cần thiết, tự dừng khi xong, và cho biết điểm của bạn quy ra bao nhiêu số dư Xbox; con số trong ⚙ vẫn còn đó để dự phòng cho lúc không có phiên Rewards. Số lượt tìm kiếm được đặt bằng ⚙ (1-100, mặc định 20) và các nút bắt đầu / tiếp tục / dừng / đặt lại thay đổi theo trạng thái. Trong thẻ từ khóa, bạn có thể xóa từng mục bằng một cú bấm, thêm nhiều mục cách nhau bằng dấu phẩy, sửa tất cả cùng lúc hoặc khôi phục danh sách ban đầu. Bảng nổi có thể thu gọn và nhớ trạng thái bạn để lại, còn ngôn ngữ của tập lệnh được chọn ở phía trên này.',
            infoAuthor: 'Tác giả:', infoGitHub: 'GitHub:', infoPrivacy: 'Quyền riêng tư:',
            infoPrivacyText: 'Từ khóa và bộ đếm tìm kiếm của bạn chỉ được lưu trong bộ nhớ cục bộ của trình quản lý userscript, ngay trong trình duyệt. Khi bật «Dùng tiến độ Rewards của tôi», tập lệnh gửi một yêu cầu GET tới bing.com — cũng chính là điểm cuối đang chạy bảng điểm trên đầu trang Bing — để đọc tiến độ hôm nay, số dư của bạn và danh mục quy đổi; yêu cầu đi kèm phiên Bing của bạn, và không có phần nào trong đó tới bên thứ ba hay tới tác giả tập lệnh. Tắt ô đó thì tập lệnh không tự thực hiện bất kỳ yêu cầu mạng nào: nó chỉ điều hướng tới các địa chỉ tìm kiếm của bing.com, y như khi bạn tự gõ.',
            infoHow: 'Cách hoạt động:',
            infoHowText: 'Tập lệnh hỏi Rewards xem hôm nay còn thiếu bao nhiêu điểm tìm kiếm và chỉ chạy những lượt cần thiết, dừng lại khi Rewards báo là đã xong ngày; nếu bộ đếm không tăng qua nhiều lượt tìm liên tiếp, nó dừng thay vì tiêu thêm. Tập lệnh tạo truy vấn bằng cách ghép 1 đến 3 từ khóa và luân phiên giữa tìm kiếm web (70%), hình ảnh, video, mua sắm và tin tức để mô phỏng việc duyệt web của con người. Độ trễ ngẫu nhiên từ 3-10 giây, thỉnh thoảng có quãng nghỉ 10-25 giây mô phỏng việc đọc kết quả. Mỗi địa chỉ đều kèm các tham số luân phiên (form, cvid, PC) mà Bing xem là lưu lượng hợp lệ. Chế độ di động hay máy tính được nhận diện tự động, tiến trình được giữ lại qua các lần tải lại trang và bộ đếm được đặt lại mỗi ngày vào nửa đêm.'
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
            pointsShort: '分',
            searchesLeft: '次搜索',
            searchesLeftTip: '根据你今天还差的积分，以及 Rewards 在你所在市场每次搜索给的积分估算得出。通常会偏低，因为每天最初几次搜索并不总会计入。因此脚本不会按这个数字停下，而是一直做到 Rewards 把今天标记为已完成。',
            stalled: 'Bing 已停止发放积分',
            stalledTip: '连续几次搜索后 Rewards 的计数都没有上涨。这通常说明 Bing 在本次会话中已不再发放积分，所以脚本停了下来，不再白费搜索。请稍后再试，或换个网络或浏览器。',
            capReached: '已达到安全上限',
            autoLabel: '使用我的 Rewards 进度',
            autoTip: '开启后，脚本会向 Bing 查询你今天还差多少搜索积分，只执行必要的搜索，完成后自动停止，并显示你的积分值多少钱。关闭后，脚本不会发起任何网络请求，改用下面手动设置的次数。',
            manualFallbackTip: '没能读到你的 Rewards 进度，因此以关键词标签页中手动设置的次数为准。',
            apiNoSession: '登录 Bing 才能读取你的进度',
            apiOffline: '无法读取你的 Rewards 进度',
            xboxBalance: '可兑换 Xbox / Microsoft Store 余额',
            cheapestCard: '最便宜的卡：',
            needMore: '还差 {n}',
            valueTipExact: '按 Rewards 为你所在市场公布的官方兑换比率计算：每 1 {c} 需 {r} 积分。注意小额卡的价格更差，兑换大额更能发挥积分的价值。',
            valueTipApprox: 'Rewards 未在你所在市场公布官方比率，因此这个比率是从目录中的卡价推算的：每 1 {c} 需 {r} 积分。仅为近似值。',
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
            infoDescriptionText: '自动完成每日的 Bing 搜索，无需手动操作即可累积 Microsoft Rewards 积分。脚本会向 Microsoft Rewards 查询你今天还差多少搜索积分，只执行必要的搜索，完成后自动停止，并显示你的积分折合多少 Xbox 余额；⚙ 里的次数则留作没有 Rewards 会话时的备用。搜索次数可用 ⚙ 设置（1-100，默认 20），开始／继续／停止／重置按钮会随状态变化。在关键词标签页中，你可以点击逐个删除、用逗号分隔一次添加多个、一次性编辑全部，或恢复原始列表。浮动面板可以折叠并记住你上次的状态，脚本语言就在上方选择。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隐私：',
            infoPrivacyText: '你的关键词和搜索计数器只保存在浏览器中用户脚本管理器的本地存储里。开启「使用我的 Rewards 进度」时，脚本会向 bing.com 发起一次 GET 请求，读取你今天的进度、余额和兑换目录；这个地址就是驱动 Bing 页首积分面板的同一个接口，请求随你的 Bing 会话发出，其中的内容不会流向任何第三方，也不会发给脚本作者。关掉这个勾选，脚本就不会发起任何自己的网络请求：它只是跳转到 bing.com 的搜索网址，和你自己输入完全一样。',
            infoHow: '工作原理：',
            infoHowText: '脚本会向 Rewards 查询今天还差多少搜索积分，只做必要的那些，等 Rewards 把今天标记为已完成就停下；如果连续几次搜索计数都没上涨，它会停止，而不是继续消耗搜索。 脚本会组合 1 到 3 个关键词生成查询，并在网页搜索（70%）、图片、视频、购物和资讯之间轮换，以模拟人类浏览。延迟在 3-10 秒之间随机，偶尔会有 10-25 秒的停顿来模拟阅读结果。每个网址都带有轮换参数（form、cvid、PC），Bing 会将其视为正常流量。脚本会自动识别移动端与桌面端，进度在页面重新加载后依然保留，计数器每天午夜重置。'
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
            pointsShort: 'نقطة',
            searchesLeft: 'عملية بحث متبقية',
            searchesLeftTip: 'تقدير مبني على النقاط الناقصة اليوم وعلى ما تمنحه Rewards لكل عملية بحث في سوقك. يخرج عادةً أقل من الواقع، لأن عمليات البحث الأولى في اليوم لا تُحتسب دائمًا. لذلك لا يتوقف البرنامج النصي عند هذا الرقم، بل يواصل حتى تعلن Rewards أن اليوم مكتمل.',
            stalled: 'توقّفت Bing عن منح النقاط',
            stalledTip: 'مرّت عدة عمليات بحث متتالية دون أن يتحرك عدّاد Rewards. يعني ذلك عادةً أن Bing لم تعد تمنح نقاطًا في هذه الجلسة، فتوقّف البرنامج النصي بدل إهدار عمليات البحث. جرّب لاحقًا، أو من شبكة أو متصفح آخر.',
            capReached: 'تم الوصول إلى حد الأمان',
            autoLabel: 'استخدام تقدّمي في Rewards',
            autoTip: 'عند تشغيل هذا يسأل البرنامج النصي Bing عن عدد نقاط البحث الناقصة اليوم، وينفّذ عمليات البحث اللازمة فقط، ويتوقّف من تلقاء نفسه عند إتمامها، ويعرض قيمة نقاطك. وعند إيقافه لا يُجري أي طلب شبكة ويستخدم العدد اليدوي أدناه.',
            manualFallbackTip: 'لم يتسنَّ قراءة تقدّمك في Rewards، لذا فالعدد اليدوي في علامة تبويب الكلمات المفتاحية هو المعتبر.',
            apiNoSession: 'سجّل الدخول إلى Bing لقراءة تقدّمك',
            apiOffline: 'لم يتسنَّ قراءة تقدّمك في Rewards',
            xboxBalance: 'كرصيد Xbox / Microsoft Store',
            cheapestCard: 'أرخص بطاقة:',
            needMore: 'ناقص {n}',
            valueTipExact: 'محسوب بسعر الاستبدال الرسمي الذي تنشره Rewards لسوقك: {r} نقطة لكل 1 {c}. لاحظ أن البطاقات ذات القيمة الصغيرة أسوأ سعرًا، فاستبدال المبالغ الأكبر يستفيد من نقاطك أكثر.',
            valueTipApprox: 'لا تنشر Rewards سعرًا رسميًا في سوقك، لذا استُنتج هذا السعر من أسعار البطاقات في الكتالوج: {r} نقطة لكل 1 {c}. وهو تقريبي.',
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
            infoDescriptionText: 'يؤتمت عمليات البحث اليومية في Bing لتجميع نقاط Microsoft Rewards دون تدخل يدوي. يسأل البرنامج النصي Microsoft Rewards عن عدد نقاط البحث الناقصة اليوم، وينفّذ عمليات البحث اللازمة فقط، ويتوقّف من تلقاء نفسه عند إتمامها، ويعرض قيمة نقاطك كرصيد Xbox؛ ويبقى العدد الموجود في ⚙ بديلًا للحالات التي لا توجد فيها جلسة Rewards. يُضبط عدد عمليات البحث بزر ⚙ (من 1 إلى 100، والافتراضي 20)، وتتغيّر أزرار البدء والمتابعة والإيقاف والتصفير بحسب الحالة. في تبويب الكلمات المفتاحية يمكنك حذف كل واحدة بنقرة، أو إضافة عدة كلمات مفصولة بفواصل، أو تحريرها كلها دفعة واحدة، أو استعادة القائمة الأصلية. تُطوى اللوحة العائمة وتتذكّر الوضع الذي تركتها عليه، ولغة البرنامج النصي تُختار من هنا في الأعلى.',
            infoAuthor: 'المؤلف:', infoGitHub: 'GitHub:', infoPrivacy: 'الخصوصية:',
            infoPrivacyText: 'تُحفظ كلماتك المفتاحية وعدّاد البحث في التخزين المحلي لمدير البرامج النصية داخل متصفحك فقط. وعند تشغيل «استخدام تقدّمي في Rewards» يُجري البرنامج النصي طلب GET إلى bing.com — وهو نفس نقطة الوصول التي تُغذّي لوحة النقاط في رأس صفحة Bing — لقراءة تقدّمك اليومي ورصيدك وكتالوج الاستبدال؛ ويمرّ الطلب عبر جلسة Bing الخاصة بك، ولا يذهب أي من ذلك إلى أطراف أخرى ولا إلى مؤلف البرنامج النصي. أوقف ذلك المربع فلا يُجري البرنامج النصي أي طلب شبكة خاص به: فهو ينتقل إلى عناوين بحث bing.com فقط، تمامًا كما لو كتبتها بنفسك.',
            infoHow: 'كيف يعمل:',
            infoHowText: 'يسأل البرنامج النصي Rewards عن عدد نقاط البحث الناقصة اليوم وينفّذ اللازم منها فقط، ويتوقّف عندما تعلن Rewards أن اليوم مكتمل؛ وإن لم يتحرّك العدّاد خلال عدة عمليات بحث متتالية، توقّف بدل أن يستهلك المزيد. يبني الاستعلامات بدمج كلمة إلى ثلاث كلمات مفتاحية، ويتنقّل بين بحث الويب (70%) والصور والفيديو والتسوق والأخبار لمحاكاة تصفّح بشري. والمهل عشوائية بين 3 و10 ثوانٍ، مع وقفات عارضة من 10 إلى 25 ثانية تحاكي قراءة النتائج. ويحمل كل رابط معاملات متبدّلة (form وcvid وPC) يعدّها Bing حركة مرور طبيعية. ويكتشف الهاتف أو الحاسب تلقائيًا، ويبقى التقدّم بعد إعادة تحميل الصفحة، ويُصفَّر العدّاد كل يوم عند منتصف الليل.'
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
            pointsShort: 'अंक',
            searchesLeft: 'खोज बाकी',
            searchesLeftTip: 'आज आपके जितने अंक बाकी हैं और आपके बाज़ार में Rewards हर खोज पर जितने अंक देता है, उससे लगाया गया अनुमान। यह आम तौर पर कम निकलता है, क्योंकि दिन की पहली कुछ खोजों के अंक हमेशा नहीं जुड़ते। इसलिए स्क्रिप्ट इस संख्या पर नहीं रुकती, बल्कि तब तक चलती है जब तक Rewards दिन को पूरा न बता दे।',
            stalled: 'Bing ने अंक देना बंद कर दिया',
            stalledTip: 'लगातार कई खोजें हुईं पर Rewards का काउंटर नहीं बढ़ा। आम तौर पर इसका मतलब है कि इस सत्र में Bing अब अंक नहीं दे रहा, इसलिए स्क्रिप्ट बेकार खोजें खर्च करने के बजाय रुक गई। बाद में, या किसी दूसरे नेटवर्क या ब्राउज़र से आज़माएँ।',
            capReached: 'सुरक्षा सीमा पर पहुँच गए',
            autoLabel: 'मेरी Rewards प्रगति इस्तेमाल करें',
            autoTip: 'यह चालू होने पर स्क्रिप्ट Bing से पूछती है कि आज आपके कितने खोज-अंक बाकी हैं, सिर्फ़ ज़रूरी खोजें करती है, पूरा होने पर खुद रुक जाती है, और बताती है कि आपके अंकों का मूल्य कितना है। बंद होने पर यह कोई नेटवर्क अनुरोध नहीं करती और नीचे दी गई मैनुअल संख्या का उपयोग करती है।',
            manualFallbackTip: 'आपकी Rewards प्रगति पढ़ी नहीं जा सकी, इसलिए कीवर्ड टैब में दी गई मैनुअल संख्या ही मान्य है।',
            apiNoSession: 'प्रगति पढ़ने के लिए Bing में साइन इन करें',
            apiOffline: 'आपकी Rewards प्रगति पढ़ी नहीं जा सकी',
            xboxBalance: 'Xbox / Microsoft Store बैलेंस के रूप में',
            cheapestCard: 'सबसे सस्ता कार्ड:',
            needMore: '{n} बाकी',
            valueTipExact: 'Rewards आपके बाज़ार के लिए जो आधिकारिक विनिमय दर बताता है, उससे गणना की गई: 1 {c} के लिए {r} अंक। ध्यान दें, छोटी रकम के कार्ड की दर खराब होती है, इसलिए बड़ी रकम भुनाने पर अंकों का ज़्यादा फ़ायदा मिलता है।',
            valueTipApprox: 'आपके बाज़ार के लिए Rewards कोई आधिकारिक दर नहीं बताता, इसलिए यह दर कैटलॉग के कार्ड दामों से निकाली गई है: 1 {c} के लिए {r} अंक। यह अनुमानित है।',
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
            infoDescriptionText: 'बिना हाथ लगाए Microsoft Rewards अंक जमा करने के लिए Bing की रोज़ाना खोजों को स्वचालित करती है। स्क्रिप्ट Microsoft Rewards से पूछती है कि आज आपके कितने खोज-अंक बाकी हैं, सिर्फ़ ज़रूरी खोजें करती है, पूरा होने पर खुद रुक जाती है, और बताती है कि आपके अंक Xbox बैलेंस में कितने बनते हैं; ⚙ में दी गई संख्या उन मौकों के लिए बची रहती है जब Rewards का सत्र न हो। खोजों की संख्या ⚙ से तय होती है (1-100, डिफ़ॉल्ट 20) और शुरू / जारी रखें / रोकें / रीसेट के बटन स्थिति के अनुसार बदलते हैं। मुख्य शब्दों वाले टैब में आप हर एक को एक क्लिक से हटा सकते हैं, अल्पविराम से अलग करके कई जोड़ सकते हैं, सबको एक साथ संपादित कर सकते हैं या मूल सूची बहाल कर सकते हैं। तैरता पैनल मुड़ जाता है और जैसा आपने छोड़ा था वैसा याद रखता है, और स्क्रिप्ट की भाषा यहीं ऊपर चुनी जाती है।',
            infoAuthor: 'लेखक:', infoGitHub: 'GitHub:', infoPrivacy: 'निजता:',
            infoPrivacyText: 'आपके कीवर्ड और खोज काउंटर सिर्फ़ आपके ब्राउज़र में यूज़रस्क्रिप्ट मैनेजर के लोकल स्टोरेज में रखे जाते हैं। जब «मेरी Rewards प्रगति इस्तेमाल करें» चालू हो, तो स्क्रिप्ट आज की प्रगति, आपका बैलेंस और भुनाने का कैटलॉग पढ़ने के लिए bing.com को एक GET अनुरोध भेजती है; यह वही एंडपॉइंट है जो Bing के हेडर वाले अंक पैनल को चलाता है, और अनुरोध आपके Bing सत्र के साथ जाता है। इसमें से कुछ भी किसी तीसरे पक्ष या स्क्रिप्ट के लेखक तक नहीं जाता। यह चेकबॉक्स बंद कर दें और स्क्रिप्ट अपनी कोई भी नेटवर्क अनुरोध नहीं करती: वह सिर्फ़ bing.com के खोज URL पर जाती है, ठीक जैसे आप खुद टाइप करते।',
            infoHow: 'यह कैसे काम करती है:',
            infoHowText: 'स्क्रिप्ट Rewards से पूछती है कि आज कितने खोज-अंक बाकी हैं और सिर्फ़ ज़रूरी खोजें करती है, और जब Rewards दिन को पूरा बता देता है तो रुक जाती है; अगर लगातार कई खोजों में काउंटर न बढ़े, तो यह और खर्च करने के बजाय रुक जाती है। यह 1 से 3 मुख्य शब्दों को मिलाकर क्वेरी बनाती है और मानवीय ब्राउज़िंग जैसा दिखाने के लिए वेब खोज (70%), छवियों, वीडियो, शॉपिंग और समाचार के बीच बारी-बारी से चलती है। विलंब 3-10 सेकंड के बीच यादृच्छिक होते हैं, और बीच-बीच में 10-25 सेकंड के ठहराव आते हैं जो परिणाम पढ़ने जैसा प्रभाव देते हैं। हर पते में बदलते हुए पैरामीटर (form, cvid, PC) होते हैं जिन्हें Bing सामान्य ट्रैफ़िक मानता है। मोबाइल और डेस्कटॉप की पहचान अपने आप होती है, प्रगति पृष्ठ फिर से लोड होने पर भी बनी रहती है, और काउंटर हर दिन आधी रात को रीसेट हो जाता है।'
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
            pointsShort: 'poin',
            searchesLeft: 'penelusuran tersisa',
            searchesLeftTip: 'Perkiraan dari poin yang masih kurang hari ini dan dari besaran yang Rewards bayar per penelusuran di pasar Anda. Biasanya hasilnya lebih rendah dari kenyataan, karena beberapa penelusuran pertama dalam sehari tidak selalu dihitung. Karena itu skrip tidak berhenti pada angka ini, melainkan lanjut sampai Rewards menandai hari ini selesai.',
            stalled: 'Bing berhenti memberi poin',
            stalledTip: 'Beberapa penelusuran berturut-turut tanpa penghitung Rewards bertambah. Biasanya itu berarti Bing berhenti membayar pada sesi ini, jadi skrip berhenti daripada membuang penelusuran. Coba lagi nanti, atau dari jaringan atau peramban lain.',
            capReached: 'Batas keamanan tercapai',
            autoLabel: 'Gunakan progres Rewards saya',
            autoTip: 'Bila ini aktif, skrip menanyakan ke Bing berapa poin penelusuran yang masih Anda kurang hari ini, menjalankan hanya penelusuran yang perlu, berhenti sendiri setelah selesai, dan menampilkan nilai poin Anda. Bila nonaktif, skrip tidak membuat permintaan jaringan apa pun dan memakai angka manual di bawah.',
            manualFallbackTip: 'Progres Rewards Anda tidak dapat dibaca, jadi angka manual di tab kata kunci yang berlaku.',
            apiNoSession: 'Masuk ke Bing untuk membaca progres Anda',
            apiOffline: 'Tidak dapat membaca progres Rewards Anda',
            xboxBalance: 'sebagai saldo Xbox / Microsoft Store',
            cheapestCard: 'Kartu termurah:',
            needMore: 'kurang {n}',
            valueTipExact: 'Dihitung dengan kurs penukaran resmi yang Rewards terbitkan untuk pasar Anda: {r} poin per 1 {c}. Perhatikan bahwa kartu bernilai kecil harganya lebih buruk, jadi menukar nominal besar lebih memanfaatkan poin Anda.',
            valueTipApprox: 'Rewards tidak menerbitkan kurs resmi untuk pasar Anda, jadi kurs ini disimpulkan dari harga kartu di katalog: {r} poin per 1 {c}. Nilainya perkiraan.',
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
            infoDescriptionText: 'Mengotomatiskan pencarian harian di Bing untuk mengumpulkan poin Microsoft Rewards tanpa campur tangan manual. Skrip menanyakan ke Microsoft Rewards berapa poin penelusuran yang masih Anda kurang hari ini, menjalankan hanya penelusuran yang perlu, berhenti sendiri setelah selesai, dan menampilkan nilai poin Anda dalam saldo Xbox; angka pada ⚙ tetap ada sebagai cadangan untuk saat tidak ada sesi Rewards. Jumlah pencarian diatur dengan ⚙ (1-100, bawaan 20) dan tombol mulai / lanjutkan / hentikan / setel ulang berubah sesuai keadaan. Di tab kata kunci Anda bisa menghapus tiap kata dengan sekali klik, menambahkan beberapa sekaligus dipisahkan koma, menyunting semuanya sekaligus, atau mengembalikan daftar aslinya. Panel mengambang bisa dilipat dan mengingat posisi terakhir Anda, dan bahasa skrip dipilih di bagian atas ini.',
            infoAuthor: 'Penulis:', infoGitHub: 'GitHub:', infoPrivacy: 'Privasi:',
            infoPrivacyText: 'Kata kunci Anda dan penghitung penelusuran hanya disimpan di penyimpanan lokal pengelola userscript, di peramban Anda. Bila «Gunakan progres Rewards saya» aktif, skrip membuat satu permintaan GET ke bing.com — titik akhir yang sama yang menggerakkan panel poin di kepala halaman Bing — untuk membaca progres hari ini, saldo Anda, dan katalog penukaran; permintaan itu berjalan lewat sesi Bing Anda, dan tidak ada bagian darinya yang pergi ke pihak ketiga maupun ke penulis skrip. Matikan kotak itu dan skrip tidak membuat permintaan jaringan apa pun sendiri: ia hanya membuka URL penelusuran bing.com, persis seperti kalau Anda mengetiknya sendiri.',
            infoHow: 'Cara kerjanya:',
            infoHowText: 'Skrip menanyakan ke Rewards berapa poin penelusuran yang masih kurang hari ini dan menjalankan hanya yang perlu, lalu berhenti saat Rewards menandai hari ini selesai; jika penghitung tidak bertambah selama beberapa penelusuran berturut-turut, skrip berhenti daripada memakai lebih banyak. Skrip menyusun kueri dengan menggabungkan 1 sampai 3 kata kunci dan bergantian antara pencarian web (70%), gambar, video, belanja, dan berita untuk menyerupai penjelajahan manusia. Jedanya acak antara 3-10 detik, dengan rehat sesekali 10-25 detik yang meniru pembacaan hasil. Setiap URL memuat parameter yang berganti-ganti (form, cvid, PC) yang dikenali Bing sebagai lalu lintas wajar. Mode seluler dan desktop dideteksi otomatis, kemajuan bertahan melewati pemuatan ulang halaman, dan penghitung disetel ulang setiap hari pada tengah malam.'
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
            pointsShort: 'pt',
            searchesLeft: 'ricerche rimaste',
            searchesLeftTip: 'Stima ricavata dai punti che ti mancano oggi e da quanto Rewards paga per ricerca nel tuo mercato. Di solito resta sotto il reale, perché le prime ricerche della giornata non vengono sempre accreditate. Per questo lo script non si ferma a questo numero: continua finché Rewards non segna la giornata come completata.',
            stalled: 'Bing ha smesso di accreditare punti',
            stalledTip: 'Diverse ricerche di seguito senza che il contatore Rewards salisse. In genere significa che Bing ha smesso di pagare per questa sessione, quindi lo script si è fermato invece di sprecare ricerche. Riprova più tardi, o da un’altra rete o browser.',
            capReached: 'Limite di sicurezza raggiunto',
            autoLabel: 'Usa i miei progressi Rewards',
            autoTip: 'Con questa opzione attiva lo script chiede a Bing quanti punti ricerca ti mancano oggi, esegue solo le ricerche necessarie, si ferma da sé quando sono finite e mostra quanto valgono i tuoi punti. Disattivata non fa nessuna richiesta di rete e usa il numero manuale qui sotto.',
            manualFallbackTip: 'Non è stato possibile leggere i tuoi progressi Rewards, quindi vale il numero manuale nella scheda delle parole chiave.',
            apiNoSession: 'Accedi a Bing per leggere i tuoi progressi',
            apiOffline: 'Impossibile leggere i progressi Rewards',
            xboxBalance: 'in credito Xbox / Microsoft Store',
            cheapestCard: 'Carta più economica:',
            needMore: 'mancano {n}',
            valueTipExact: 'Calcolato con il tasso di conversione ufficiale che Rewards pubblica per il tuo mercato: {r} punti per 1 {c}. Attenzione: le carte di importo piccolo hanno un prezzo peggiore, quindi convertire importi più alti sfrutta meglio i punti.',
            valueTipApprox: 'Rewards non pubblica un tasso ufficiale per il tuo mercato, quindi questo è dedotto dai prezzi delle carte in catalogo: {r} punti per 1 {c}. È approssimativo.',
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
            infoDescriptionText: 'Automatizza le ricerche quotidiane su Bing per accumulare punti Microsoft Rewards senza interventi manuali. Chiede a Microsoft Rewards quanti punti ricerca ti mancano oggi, esegue solo le ricerche necessarie, si ferma da sé quando sono finite e mostra quanto valgono i tuoi punti in credito Xbox; il numero sotto ⚙ resta come riserva per quando non c’è una sessione Rewards. Il numero di ricerche si imposta con ⚙ (1-100, valore predefinito 20) e i comandi avvia / riprendi / ferma / azzera cambiano a seconda dello stato. Nella scheda delle parole chiave puoi eliminarne una con un clic, aggiungerne diverse separate da virgole, modificarle tutte in una volta o ripristinare l’elenco originale. Il pannello flottante si richiude e ricorda come lo hai lasciato, e la lingua dello script si sceglie qui in alto.',
            infoAuthor: 'Autore:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Le tue parole chiave e il contatore delle ricerche sono salvati solo nella memoria locale del gestore di userscript, nel tuo browser. Con «Usa i miei progressi Rewards» attivo, lo script invia una richiesta GET a bing.com — lo stesso endpoint che alimenta il pannello dei punti nell’intestazione di Bing — per leggere i progressi della giornata, il tuo saldo e il catalogo di conversione; passa dalla tua sessione Bing e nulla di tutto ciò va a terzi né all’autore dello script. Disattiva quella casella e lo script non effettua nessuna richiesta di rete propria: si limita a navigare verso URL di ricerca di bing.com, esattamente come se le digitassi tu.',
            infoHow: 'Come funziona:',
            infoHowText: 'Chiede a Rewards quanti punti ricerca mancano oggi ed esegue solo quelle necessarie, fermandosi quando Rewards segna la giornata come completata; se il contatore non sale per diverse ricerche di seguito, si ferma invece di consumarne altre. Genera query combinando da 1 a 3 parole chiave e alterna tra ricerca web (70%), immagini, video, shopping e notizie per simulare una navigazione umana. Gli intervalli sono casuali tra 3 e 10 s, con pause occasionali di 10-25 s che imitano la lettura dei risultati. Ogni indirizzo include parametri a rotazione (form, cvid, PC) che Bing riconosce come traffico legittimo. Rileva automaticamente mobile o desktop, l’avanzamento sopravvive ai ricaricamenti della pagina e il contatore si azzera ogni giorno a mezzanotte.'
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
            pointsShort: 'ptn',
            searchesLeft: 'zoekopdrachten over',
            searchesLeftTip: 'Schatting op basis van de punten die je vandaag nog mist en van wat Rewards in jouw markt per zoekopdracht betaalt. De schatting valt meestal te laag uit, omdat de eerste zoekopdrachten van de dag niet altijd worden bijgeschreven. Het script stopt daarom niet bij dit getal, maar gaat door totdat Rewards de dag als voltooid meldt.',
            stalled: 'Bing schrijft geen punten meer bij',
            stalledTip: 'Meerdere zoekopdrachten op rij zonder dat de Rewards-teller omhoogging. Dat betekent meestal dat Bing voor deze sessie niet meer betaalt, dus is het script gestopt in plaats van zoekopdrachten te verspillen. Probeer het later opnieuw, of via een ander netwerk of een andere browser.',
            capReached: 'Veiligheidslimiet bereikt',
            autoLabel: 'Mijn Rewards-voortgang gebruiken',
            autoTip: 'Staat dit aan, dan vraagt het script bij Bing op hoeveel zoekpunten je vandaag nog mist, voert alleen de nodige zoekopdrachten uit, stopt zelf zodra ze klaar zijn en laat zien wat je punten waard zijn. Staat het uit, dan doet het geen enkel netwerkverzoek en gebruikt het het handmatige aantal hieronder.',
            manualFallbackTip: 'Je Rewards-voortgang kon niet worden gelezen, dus geldt het handmatige aantal op het tabblad met trefwoorden.',
            apiNoSession: 'Meld je aan bij Bing om je voortgang te lezen',
            apiOffline: 'Rewards-voortgang niet te lezen',
            xboxBalance: 'aan Xbox-/Microsoft Store-krediet',
            cheapestCard: 'Goedkoopste kaart:',
            needMore: 'nog {n}',
            valueTipExact: 'Berekend met de officiële inwisselkoers die Rewards voor jouw markt publiceert: {r} punten per 1 {c}. Let op: kaarten met een klein bedrag zijn ongunstiger geprijsd, dus met grotere bedragen haal je meer uit je punten.',
            valueTipApprox: 'Rewards publiceert geen officiële koers voor jouw markt, dus deze is afgeleid uit de kaartprijzen in de catalogus: {r} punten per 1 {c}. Het is een benadering.',
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
            infoDescriptionText: 'Automatiseert de dagelijkse zoekopdrachten op Bing om Microsoft Rewards-punten te sparen zonder handwerk. Het vraagt bij Microsoft Rewards op hoeveel zoekpunten je vandaag nog mist, voert alleen de nodige zoekopdrachten uit, stopt zelf zodra ze klaar zijn en laat zien wat je punten waard zijn aan Xbox-krediet; het aantal onder ⚙ blijft als achtervang voor wanneer er geen Rewards-sessie is. Het aantal zoekopdrachten stel je in met ⚙ (1-100, standaard 20) en de knoppen starten / hervatten / stoppen / opnieuw instellen wisselen mee met de toestand. Op het tabblad met trefwoorden kun je elk trefwoord met één klik verwijderen, er meerdere tegelijk toevoegen gescheiden door komma’s, ze allemaal in één keer bewerken of de oorspronkelijke lijst herstellen. Het zwevende paneel klapt in en onthoudt hoe je het achterliet, en de taal van het script kies je hier bovenaan.',
            infoAuthor: 'Auteur:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Je trefwoorden en de zoekteller worden alleen opgeslagen in de lokale opslag van je userscriptbeheerder, in je browser. Staat «Mijn Rewards-voortgang gebruiken» aan, dan doet het script één GET-verzoek aan bing.com — hetzelfde eindpunt dat het puntenpaneel in de Bing-koptekst voedt — om je voortgang van de dag, je saldo en de inwisselcatalogus te lezen; dat verloopt via je Bing-sessie en niets daarvan gaat naar derden of naar de auteur van het script. Zet dat vinkje uit en het script doet geen enkel eigen netwerkverzoek: het navigeert alleen naar zoek-URL\'s van bing.com, precies alsof je ze zelf typte.',
            infoHow: 'Hoe het werkt:',
            infoHowText: 'Het vraagt bij Rewards op hoeveel zoekpunten er vandaag nog missen en voert alleen de nodige zoekopdrachten uit, en stopt zodra Rewards de dag als voltooid meldt; blijft de teller over meerdere zoekopdrachten staan, dan stopt het in plaats van er nog meer te verbruiken. Het stelt zoekopdrachten samen uit 1 tot 3 trefwoorden en wisselt af tussen webzoeken (70%), afbeeldingen, video’s, shopping en nieuws om menselijk surfgedrag na te bootsen. De wachttijden zijn willekeurig tussen 3 en 10 s, met af en toe pauzes van 10-25 s die het lezen van resultaten nabootsen. Elke URL bevat wisselende parameters (form, cvid, PC) die Bing als normaal verkeer herkent. Mobiel en desktop worden automatisch herkend, de voortgang overleeft het herladen van de pagina en de teller wordt elke dag om middernacht op nul gezet.'
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
            pointsShort: 'p',
            searchesLeft: 'sökningar kvar',
            searchesLeftTip: 'Uppskattning utifrån de poäng du saknar i dag och vad Rewards betalar per sökning på din marknad. Den blir oftast för låg, eftersom dagens första sökningar inte alltid ger poäng. Därför stannar skriptet inte vid detta tal utan fortsätter tills Rewards markerar dagen som klar.',
            stalled: 'Bing ger inte längre poäng',
            stalledTip: 'Flera sökningar i rad utan att Rewards-räknaren rörde sig. Det betyder oftast att Bing slutat betala för den här sessionen, så skriptet stannade i stället för att slösa sökningar. Försök senare, eller från ett annat nätverk eller en annan webbläsare.',
            capReached: 'Säkerhetsgränsen nådd',
            autoLabel: 'Använd mina Rewards-framsteg',
            autoTip: 'När detta är på frågar skriptet Bing hur många sökpoäng du saknar i dag, gör bara de sökningar som behövs, stannar av sig själv när de är klara och visar vad dina poäng är värda. När det är av gör det inga nätverksanrop och använder det manuella antalet nedan.',
            manualFallbackTip: 'Dina Rewards-framsteg kunde inte läsas, så det manuella antalet på fliken för nyckelord är det som gäller.',
            apiNoSession: 'Logga in på Bing för att läsa dina framsteg',
            apiOffline: 'Kunde inte läsa dina Rewards-framsteg',
            xboxBalance: 'i Xbox-/Microsoft Store-kredit',
            cheapestCard: 'Billigaste kortet:',
            needMore: '{n} kvar',
            valueTipExact: 'Beräknat med den officiella inlösenkurs som Rewards publicerar för din marknad: {r} poäng per 1 {c}. Observera att kort med små belopp är sämre prissatta, så större belopp ger mer för dina poäng.',
            valueTipApprox: 'Rewards publicerar ingen officiell kurs för din marknad, så den här är härledd ur kortpriserna i katalogen: {r} poäng per 1 {c}. Den är ungefärlig.',
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
            infoDescriptionText: 'Automatiserar de dagliga sökningarna på Bing för att samla Microsoft Rewards-poäng utan handpåläggning. Skriptet frågar Microsoft Rewards hur många sökpoäng du saknar i dag, gör bara de sökningar som behövs, stannar av sig själv när de är klara och visar vad dina poäng är värda som Xbox-kredit; talet under ⚙ finns kvar som reserv för när ingen Rewards-session finns. Antalet sökningar ställs in med ⚙ (1-100, standard 20) och knapparna starta / fortsätt / stoppa / nollställ växlar efter tillstånd. På fliken för nyckelord kan du ta bort vart och ett med ett klick, lägga till flera separerade med kommatecken, redigera alla på en gång eller återställa den ursprungliga listan. Den flytande panelen fälls ihop och minns hur du lämnade den, och skriptets språk väljs här uppe.',
            infoAuthor: 'Upphovsperson:', infoGitHub: 'GitHub:', infoPrivacy: 'Integritet:',
            infoPrivacyText: 'Dina nyckelord och sökräknaren sparas endast i den lokala lagringen för din hanterare av användarskript, i din webbläsare. När ”Använd mina Rewards-framsteg” är på gör skriptet en GET-förfrågan till bing.com — samma slutpunkt som försörjer poängpanelen i Bings sidhuvud — för att läsa dagens framsteg, ditt saldo och inlösenkatalogen; den går via din Bing-session och inget av det skickas till tredje part eller till skriptets upphovsman. Stäng av den kryssrutan och skriptet gör inga egna nätverksanrop: det navigerar bara till sök-URL:er på bing.com, precis som om du skrev in dem själv.',
            infoHow: 'Så fungerar det:',
            infoHowText: 'Skriptet frågar Rewards hur många sökpoäng som saknas i dag och gör bara de nödvändiga sökningarna, och stannar när Rewards markerar dagen som klar; om räknaren inte rör sig under flera sökningar i rad stannar det i stället för att göra av med fler. Det bygger sökfrågor av 1 till 3 nyckelord och växlar mellan webbsökning (70 %), bilder, videor, shopping och nyheter för att efterlikna mänskligt surfande. Fördröjningarna är slumpmässiga mellan 3 och 10 s, med enstaka pauser på 10-25 s som efterliknar läsning av resultat. Varje URL innehåller roterande parametrar (form, cvid, PC) som Bing tolkar som vanlig trafik. Mobil och dator känns igen automatiskt, förloppet överlever omladdningar av sidan och räknaren nollställs varje dag vid midnatt.'
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
            pointsShort: 'p',
            searchesLeft: 'søgninger tilbage',
            searchesLeftTip: 'Skøn ud fra de point, du mangler i dag, og hvad Rewards betaler pr. søgning på dit marked. Det bliver oftest for lavt, fordi dagens første søgninger ikke altid bliver krediteret. Derfor stopper scriptet ikke ved dette tal, men fortsætter, indtil Rewards markerer dagen som fuldført.',
            stalled: 'Bing krediterer ikke længere point',
            stalledTip: 'Flere søgninger i træk uden at Rewards-tælleren steg. Det betyder oftest, at Bing er stoppet med at betale for denne session, så scriptet stoppede i stedet for at spilde søgninger. Prøv senere, eller fra et andet netværk eller en anden browser.',
            capReached: 'Sikkerhedsgrænsen er nået',
            autoLabel: 'Brug mine Rewards-fremskridt',
            autoTip: 'Når dette er slået til, spørger scriptet Bing om, hvor mange søgepoint du mangler i dag, udfører kun de nødvendige søgninger, stopper af sig selv, når de er klaret, og viser, hvad dine point er værd. Er det slået fra, foretager det ingen netværksanmodninger og bruger det manuelle antal nedenfor.',
            manualFallbackTip: 'Dine Rewards-fremskridt kunne ikke læses, så det manuelle antal på fanen med nøgleord er det, der gælder.',
            apiNoSession: 'Log ind på Bing for at læse dine fremskridt',
            apiOffline: 'Kunne ikke læse dine Rewards-fremskridt',
            xboxBalance: 'i Xbox-/Microsoft Store-kredit',
            cheapestCard: 'Billigste kort:',
            needMore: '{n} mangler',
            valueTipExact: 'Beregnet med den officielle indløsningskurs, som Rewards offentliggør for dit marked: {r} point pr. 1 {c}. Bemærk, at kort med små beløb er dårligere prissat, så større beløb får mere ud af dine point.',
            valueTipApprox: 'Rewards offentliggør ingen officiel kurs for dit marked, så denne er udledt af kortpriserne i kataloget: {r} point pr. 1 {c}. Den er omtrentlig.',
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
            infoDescriptionText: 'Automatiserer de daglige søgninger på Bing, så du kan samle Microsoft Rewards-point uden manuelt arbejde. Scriptet spørger Microsoft Rewards, hvor mange søgepoint du mangler i dag, udfører kun de nødvendige søgninger, stopper af sig selv, når de er klaret, og viser, hvad dine point er værd som Xbox-kredit; tallet under ⚙ bliver stående som reserve til de gange, hvor der ikke er nogen Rewards-session. Antallet af søgninger indstilles med ⚙ (1-100, standard 20), og knapperne start / fortsæt / stop / nulstil skifter efter tilstanden. På fanen med nøgleord kan du slette hvert enkelt med ét klik, tilføje flere adskilt af komma, redigere dem alle på én gang eller gendanne den oprindelige liste. Det flydende panel klapper sammen og husker, hvordan du efterlod det, og scriptets sprog vælges heroppe.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Privatliv:',
            infoPrivacyText: 'Dine nøgleord og søgetælleren gemmes kun i den lokale lagring i din userscript-manager, i din browser. Når „Brug mine Rewards-fremskridt“ er slået til, sender scriptet en GET-anmodning til bing.com — samme endepunkt, der forsyner pointpanelet i Bings sidehoved — for at læse dagens fremskridt, din saldo og indløsningskataloget; den følger din Bing-session, og intet af det går til tredjeparter eller til scriptets forfatter. Slå det felt fra, og scriptet foretager ingen egne netværksanmodninger: det navigerer kun til søge-URL\'er på bing.com, præcis som hvis du selv skrev dem.',
            infoHow: 'Sådan virker det:',
            infoHowText: 'Scriptet spørger Rewards, hvor mange søgepoint der mangler i dag, og udfører kun de nødvendige søgninger, og stopper når Rewards markerer dagen som fuldført; hvis tælleren ikke rykker sig over flere søgninger i træk, stopper det i stedet for at bruge flere. Det danner søgninger ved at kombinere 1 til 3 nøgleord og skifter mellem websøgning (70 %), billeder, videoer, shopping og nyheder for at efterligne menneskelig browsing. Forsinkelserne er tilfældige mellem 3 og 10 s, med lejlighedsvise pauser på 10-25 s, der efterligner læsning af resultater. Hver URL indeholder roterende parametre (form, cvid, PC), som Bing opfatter som almindelig trafik. Mobil og computer registreres automatisk, forløbet overlever genindlæsning af siden, og tælleren nulstilles hver dag ved midnat.'
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
            pointsShort: 'p',
            searchesLeft: 'søk igjen',
            searchesLeftTip: 'Anslag ut fra poengene du mangler i dag og hva Rewards betaler per søk i markedet ditt. Anslaget blir oftest for lavt, fordi de første søkene på dagen ikke alltid gir poeng. Derfor stopper ikke skriptet på dette tallet, men fortsetter til Rewards markerer dagen som fullført.',
            stalled: 'Bing gir ikke lenger poeng',
            stalledTip: 'Flere søk på rad uten at Rewards-telleren steg. Det betyr oftest at Bing har sluttet å betale for denne økten, så skriptet stoppet i stedet for å sløse med søk. Prøv senere, eller fra et annet nettverk eller en annen nettleser.',
            capReached: 'Sikkerhetsgrensen er nådd',
            autoLabel: 'Bruk fremgangen min i Rewards',
            autoTip: 'Når dette er slått på, spør skriptet Bing om hvor mange søkepoeng du mangler i dag, utfører bare de nødvendige søkene, stopper av seg selv når de er ferdige, og viser hva poengene dine er verdt. Er det slått av, gjør det ingen nettverksforespørsler og bruker det manuelle antallet nedenfor.',
            manualFallbackTip: 'Fremgangen din i Rewards kunne ikke leses, så det manuelle antallet i fanen for nøkkelord er det som gjelder.',
            apiNoSession: 'Logg inn på Bing for å lese fremgangen din',
            apiOffline: 'Kunne ikke lese fremgangen din i Rewards',
            xboxBalance: 'i Xbox-/Microsoft Store-kreditt',
            cheapestCard: 'Billigste kort:',
            needMore: '{n} mangler',
            valueTipExact: 'Regnet ut med den offisielle innløsningskursen Rewards publiserer for markedet ditt: {r} poeng per 1 {c}. Merk at kort med små beløp er dårligere priset, så større beløp gir mer igjen for poengene.',
            valueTipApprox: 'Rewards publiserer ingen offisiell kurs for markedet ditt, så denne er utledet av kortprisene i katalogen: {r} poeng per 1 {c}. Den er omtrentlig.',
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
            infoDescriptionText: 'Automatiserer de daglige søkene på Bing slik at du samler Microsoft Rewards-poeng uten manuelt arbeid. Skriptet spør Microsoft Rewards om hvor mange søkepoeng du mangler i dag, utfører bare de nødvendige søkene, stopper av seg selv når de er ferdige, og viser hva poengene dine er verdt som Xbox-kreditt; tallet under ⚙ blir stående som reserve for de gangene det ikke finnes noen Rewards-økt. Antall søk stilles inn med ⚙ (1-100, standard 20), og knappene start / fortsett / stopp / nullstill endrer seg etter tilstanden. I fanen for nøkkelord kan du slette hvert enkelt med ett klikk, legge til flere skilt med komma, redigere alle på én gang eller gjenopprette den opprinnelige listen. Det flytende panelet felles sammen og husker hvordan du forlot det, og språket for skriptet velges her oppe.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Personvern:',
            infoPrivacyText: 'Nøkkelordene dine og søketelleren lagres bare i det lokale lageret til brukerskript-behandleren, i nettleseren din. Når «Bruk fremgangen min i Rewards» er slått på, sender skriptet en GET-forespørsel til bing.com — samme endepunkt som forsyner poengpanelet i topplinjen på Bing — for å lese dagens fremgang, saldoen din og innløsningskatalogen; den følger Bing-økten din, og ingenting av dette går til tredjeparter eller til forfatteren av skriptet. Slå av den avkrysningsboksen, og skriptet gjør ingen egne nettverksforespørsler: det navigerer bare til søke-URL-er på bing.com, akkurat som om du skrev dem inn selv.',
            infoHow: 'Slik virker det:',
            infoHowText: 'Skriptet spør Rewards om hvor mange søkepoeng som mangler i dag, og utfører bare de nødvendige søkene, og stopper når Rewards markerer dagen som fullført; hvis telleren ikke rører seg over flere søk på rad, stopper det i stedet for å bruke opp flere. Det bygger søk ved å kombinere 1 til 3 nøkkelord og veksler mellom nettsøk (70 %), bilder, videoer, shopping og nyheter for å etterligne menneskelig surfing. Forsinkelsene er tilfeldige mellom 3 og 10 s, med sporadiske pauser på 10-25 s som etterligner lesing av resultater. Hver URL inneholder roterende parametre (form, cvid, PC) som Bing oppfatter som vanlig trafikk. Mobil og datamaskin oppdages automatisk, framdriften overlever at siden lastes på nytt, og telleren nullstilles hver dag ved midnatt.'
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
            pointsShort: '分',
            searchesLeft: '次搜尋',
            searchesLeftTip: '依你今天還差的點數，以及 Rewards 在你所在市場每次搜尋給的點數估算。通常會偏低，因為每天最初幾次搜尋並不一定計入。因此腳本不會照這個數字停下，而是一直做到 Rewards 將今天標記為已完成。',
            stalled: 'Bing 已停止給點數',
            stalledTip: '連續幾次搜尋後 Rewards 的計數都沒有上升。這通常表示 Bing 在這次工作階段已不再給點，所以腳本停了下來，不再白費搜尋。請稍後再試，或換個網路或瀏覽器。',
            capReached: '已達安全上限',
            autoLabel: '使用我的 Rewards 進度',
            autoTip: '開啟後，腳本會向 Bing 查詢你今天還差多少搜尋點數，只執行必要的搜尋，完成後自動停止，並顯示你的點數值多少錢。關閉後，腳本不會發出任何網路請求，改用下面手動設定的次數。',
            manualFallbackTip: '沒能讀到你的 Rewards 進度，因此以關鍵字標籤頁中手動設定的次數為準。',
            apiNoSession: '登入 Bing 才能讀取你的進度',
            apiOffline: '無法讀取你的 Rewards 進度',
            xboxBalance: '可兌換 Xbox / Microsoft Store 餘額',
            cheapestCard: '最便宜的卡：',
            needMore: '還差 {n}',
            valueTipExact: '依 Rewards 為你所在市場公布的官方兌換比率計算：每 1 {c} 需 {r} 點。請注意小額卡的價格較差，兌換大額更能發揮點數的價值。',
            valueTipApprox: 'Rewards 未在你所在市場公布官方比率，因此這個比率是從目錄中的卡價推算的：每 1 {c} 需 {r} 點。僅為近似值。',
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
            infoDescriptionText: '自動完成每日的 Bing 搜尋，無須手動操作即可累積 Microsoft Rewards 點數。腳本會向 Microsoft Rewards 查詢你今天還差多少搜尋點數，只執行必要的搜尋，完成後自動停止，並顯示你的點數折合多少 Xbox 餘額；⚙ 裡的次數則留作沒有 Rewards 工作階段時的備用。搜尋次數可用 ⚙ 設定（1-100，預設 20），開始／繼續／停止／重設按鈕會隨狀態變化。在關鍵字分頁中，你可以點擊逐一刪除、用逗號分隔一次新增多個、一次編輯全部，或還原原始清單。浮動面板可以收合並記住你上次的狀態，腳本語言就在上方選擇。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隱私：',
            infoPrivacyText: '你的關鍵字和搜尋計數器只保存在瀏覽器中使用者腳本管理器的本機儲存裡。開啟「使用我的 Rewards 進度」時，腳本會向 bing.com 發出一次 GET 請求，讀取你今天的進度、餘額和兌換目錄；這個位址就是驅動 Bing 頁首點數面板的同一個端點，請求隨你的 Bing 工作階段送出，其中的內容不會流向任何第三方，也不會傳給腳本作者。關掉這個勾選，腳本就不會發出任何自己的網路請求：它只是跳轉到 bing.com 的搜尋網址，和你自己輸入完全一樣。',
            infoHow: '運作方式：',
            infoHowText: '腳本會向 Rewards 查詢今天還差多少搜尋點數，只做必要的那些，等 Rewards 將今天標記為已完成就停下；若連續幾次搜尋計數都沒上升，它會停止，而不是繼續消耗搜尋。 腳本會組合 1 到 3 個關鍵字產生查詢，並在網頁搜尋（70%）、圖片、影片、購物與新聞之間輪替，以模擬人類瀏覽。延遲在 3-10 秒之間隨機，偶爾會有 10-25 秒的停頓來模擬閱讀結果。每個網址都帶有輪替參數（form、cvid、PC），Bing 會將其視為正常流量。腳本會自動辨識行動裝置與桌機，進度在頁面重新載入後仍會保留，計數器每天午夜重設。'
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
    const KEY_AUTO = 'bing-rewards-auto';
    const KEY_SNAPSHOT = 'bing-rewards-snapshot';
    const KEY_SEEN_POINTS = 'bing-rewards-seen-points';
    const KEY_STALL = 'bing-rewards-stall';

    // Tope absoluto de búsquedas por día. En modo automático quien manda es la
    // API, pero si su contador se quedara congelado el bucle no tendría freno,
    // así que este es el último. Queda por encima del máximo manual (100) para
    // no recortar a quien lo tenga puesto a tope.
    const HARD_CAP = 120;

    // Búsquedas seguidas sin que el contador de puntos suba antes de rendirse.
    // Bing deja de acreditar en cuanto marca el tráfico como automático, y sin
    // esto el script seguiría buscando hasta el HARD_CAP sin ganar un punto.
    const STALL_LIMIT = 5;

    // El widget se pinta en cada página de Bing, no solo mientras busca. Sin un
    // TTL, navegar normalmente por Bing dispararía una petición por página; con
    // sesión activa siempre se relee, que ahí el dato de hace 5 minutos no vale.
    const SNAPSHOT_TTL = 5 * 60 * 1000;

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
            // El detector de atascos y el progreso visto son del día: sin
            // limpiarlos, un atasco de ayer bloquearía las búsquedas de hoy.
            GM_setValue(KEY_SEEN_POINTS, -1);
            GM_setValue(KEY_STALL, 0);
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

    /**
     * ¿Se deja que la API decida cuántas búsquedas faltan? Por defecto sí; el
     * número manual queda como suplente para cuando no hay sesión de Rewards.
     * @returns {boolean}
     */
    function getAuto() {
        return GM_getValue(KEY_AUTO, true);
    }

    /**
     * @param {boolean} v
     */
    function setAuto(v) {
        GM_setValue(KEY_AUTO, !!v);
    }

    // =============================================
    // API DE MICROSOFT REWARDS
    // =============================================

    // Único endpoint que consulta el script: el que alimenta el flyout de puntos
    // de la cabecera de Bing. Vive en www.bing.com, así que entra en el @match,
    // es MISMO ORIGEN y viaja con la cookie de sesión sin necesidad de
    // GM_xmlhttpRequest ni @connect. Devuelve saldo, progreso del día y catálogo
    // de canje en una sola petición.
    //
    // Se descartó `rewards.bing.com/api/getuserinfo?type=1` —el que usan los
    // bots de Rewards—: es cross-origin, responde 302 hacia login.windows.net
    // cuando la sesión no viaja, y encima no trae catálogo, solo el dashboard.
    const REWARDS_API = '/rewards/panelflyout/getuserinfo?channel=BingFlyout&partnerId=BingRewards';

    const API_TIMEOUT = 8000;

    /** Los atributos del flyout son TEXTO, incluso los numéricos ("60", "3"). */
    function num(v) {
        const n = parseFloat(v);
        return isFinite(n) ? n : 0;
    }

    /** Y los booleanos vienen como "True" / "False". */
    function isTrue(v) {
        return String(v).toLowerCase() === 'true';
    }

    /**
     * Saca la unidad monetaria del texto que ya localizó Bing, en vez de
     * inventarla a partir del país. Los títulos de canje son plantillas
     * ("Tarjeta de regalo XBOX de MXN {0} para Microsoft Store"), así que basta
     * con leer el token pegado al importe; unos mercados lo ponen delante y
     * otros detrás.
     * @param {string} text
     * @returns {string} '' si no se reconoce.
     */
    function currencyFrom(text) {
        const s = String(text || '').replace('{0}', '0');
        const before = s.match(/([A-Z]{3}|[^\s\d.,{}]{1,3})\s*\d/);
        if (before) return before[1];
        const after = s.match(/\d\s*([A-Z]{3}|[^\s\d.,{}]{1,3})/);
        return after ? after[1] : '';
    }

    /**
     * Primer importe de un texto localizado, tolerando 1.234,56 y 1,234.56.
     * Solo se usa en el camino de reserva: si el mercado ofrece canje variable,
     * la tasa viene en un campo numérico y no hay que leer ningún texto.
     * @param {string} text
     * @returns {number} 0 si no hay número.
     */
    function amountFrom(text) {
        const m = String(text || '').match(/\d[\d.,]*/);
        if (!m) return 0;
        // Quita separadores de miles (los que van seguidos de tres dígitos) y
        // normaliza la coma decimal.
        return num(m[0].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    }

    /**
     * Reduce `promotions[]` al progreso de búsquedas del día.
     *
     * El flyout NO trae `counters` —viene `{}` incluso con sesión válida
     * (verificado con un volcado real: isRewardsUser true, errorCode 0)—, así
     * que el progreso sale de la promoción de búsqueda. Dos cosas que no son
     * obvias del dato:
     *
     *  - `progress` / `max` van en PUNTOS, no en búsquedas, y lo que vale cada
     *    búsqueda cambia por mercado y nivel (3 en mx, 5 en us). El valor exacto
     *    está en `level_info.points_per_pc_search`.
     *  - la descripción de la promo avisa de que "los puntos empiezan con su
     *    tercera búsqueda", y eso no está en ningún campo numérico. Por eso el
     *    número de búsquedas es solo un ESTIMADO y quien manda para parar es
     *    `complete`.
     *
     * @param {object[]} promotions
     * @returns {{progress:number,max:number,complete:boolean,perSearch:number,remaining:number|null}|null}
     */
    function readSearchProgress(promotions) {
        const promos = (promotions || []).filter(Boolean);
        const level = promos.find(p => p.name === 'level_info');

        // Comparación exacta: `GoBig_search_and_earn` es 'searchAndEarnCardType'
        // y colaría con un /search/i, pero no lleva contador.
        const found = promos.filter(p => (p.attributes || {}).type === 'search');
        if (!found.length) return null;

        // El endpoint devuelve el contador del dispositivo desde el que se pide
        // —con UA de escritorio solo llega el de PC—, así que normalmente hay
        // uno y no hay que elegir. El desempate queda por si algún mercado
        // devolviera los dos.
        let promo = found[0];
        if (found.length > 1) {
            const want = IS_MOBILE ? /mobile/i : /pc/i;
            promo = found.find(p => want.test(p.attributes['Classification.Tag'] || p.name || '')) || promo;
        }

        const a = promo.attributes || {};
        const progress = num(a.progress);
        const max = num(a.max) || num(a.originalmax);
        const base = num(level && level.attributes && (
            level.attributes.points_per_pc_search ||
            level.attributes.points_per_pc_search_new_levels
        ));
        const perSearch = Math.max(1, Math.round(base * (num(a.SearchMultiplier) || 1)));

        return {
            progress: progress,
            max: max,
            complete: isTrue(a.complete) || (max > 0 && progress >= max),
            perSearch: perSearch,
            // Sin `points_per_pc_search` no se puede traducir puntos a
            // búsquedas; se deja en null y el panel muestra solo los puntos en
            // vez de un estimado inventado.
            remaining: base > 0 ? Math.ceil(Math.max(0, max - progress) / perSearch) : null
        };
    }

    /**
     * Reduce `catalogItems[]` a la tarjeta de saldo Xbox más barata y a la tasa
     * de puntos a moneda.
     *
     * El detalle que importa: dentro de un mismo mercado la MISMA tarjeta se
     * vende a tasas distintas, y la más barata es la PEOR. En mx, MXN 20 cuesta
     * 1145 puntos (57,25 por MXN) y MXN 100 cuesta 4895 (48,95). Así que la
     * tarjeta barata sirve como umbral de "ya puedes canjear", no como tipo de
     * cambio; para eso está `variableItemPointsToCurrencyConversionRatio`, que
     * el ítem de canje variable trae ya calculado.
     *
     * @param {object[]} items
     * @param {number} points Saldo actual, para convertirlo.
     */
    function readCatalog(items, points) {
        const titleOf = it => {
            const a = it.attributes || {};
            return [a.english_title, a.group_title, a.title].join(' ');
        };

        const shop = (items || []).filter(Boolean).filter(it => {
            const a = it.attributes || {};
            // Los sorteos ("Concurso XBOX Series X") vienen con price 0 y sin
            // categoría: sin este filtro serían siempre "la más barata".
            if (it.isWinnerItem || it.isHidden) return false;
            if (a.category !== 'Shop') return false;
            return typeof it.price === 'number' && it.price > 0;
        });

        // Solo las familias de SALDO traen tasa de conversión. Es lo que separa
        // una tarjeta de crédito de un producto: Solitaire Premium también se
        // llama "Tarjeta de regalo Microsoft…" pero es una suscripción y no la
        // tiene, así que este filtro la deja fuera sin mirar su título.
        const credit = shop.filter(it => num((it.attributes || {}).variableItemPointsToCurrencyConversionRatio) > 0);

        // "XBOX" es marca y Bing no la traduce en ningún mercado (en es-MX el
        // título es "Tarjeta de regalo XBOX de MXN 20 …"), así que buscarla en
        // los títulos aguanta mejor que fijar ids de grupo del catálogo.
        // Si el mercado no vendiera tarjeta XBOX, la de Microsoft Store da el
        // mismo saldo y en mx cuesta exactamente igual, así que hace de suplente.
        const anchor = credit.find(it => /xbox/i.test(titleOf(it))) || credit[0] || null;

        // El `group` del ítem variable identifica a toda la familia: en mx el
        // grupo 000418000023 agrupa las XBOX de MXN 20, 40 y 100. Así "la más
        // barata" sale de un campo estructural y no de comparar títulos.
        const group = anchor && (anchor.attributes || {}).group;
        const family = group
            ? shop.filter(it => (it.attributes || {}).group === group)
            : shop.filter(it => /xbox/i.test(titleOf(it)));

        const cheapest = family.reduce((min, it) => (!min || it.price < min.price ? it : min), null);

        let value = null;
        const exactRatio = anchor ? num(anchor.attributes.variableItemPointsToCurrencyConversionRatio) : 0;
        if (exactRatio > 0) {
            value = {
                ratio: exactRatio,
                currency: currencyFrom(anchor.attributes.title),
                exact: true
            };
        } else {
            // Reserva deliberadamente acotada: sin ítem variable hay que sacar
            // el importe de un texto localizado. Se toma la MEJOR tasa de las
            // que se logren leer, no la primera ni la de la tarjeta más barata.
            let best = 0;
            let bestItem = null;
            for (const it of family) {
                const a = it.attributes || {};
                const amount = amountFrom(a['desc.group_text'] || a.title);
                if (amount <= 0) continue;
                const r = it.price / amount;
                if (!best || r < best) { best = r; bestItem = it; }
            }
            if (best > 0) {
                value = {
                    ratio: best,
                    currency: currencyFrom((bestItem.attributes['desc.group_text'] || bestItem.attributes.title)),
                    exact: false
                };
            }
        }

        if (value) value.amount = Math.floor(points / value.ratio);

        return {
            value: value,
            cheapest: cheapest ? { price: cheapest.price, title: (cheapest.attributes || {}).title || '' } : null
        };
    }

    /**
     * Pide el flyout y lo reduce a lo que usa el panel. No lanza nunca: todos
     * los fallos salen como `{ ok: false, reason }` para que el widget pueda
     * decir qué pasó y caer al número manual.
     * @returns {Promise<object>} Snapshot serializable (se guarda en storage).
     */
    async function requestRewards() {
        const stamp = { at: Date.now(), day: getToday() };
        let data;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
            try {
                const res = await fetch(REWARDS_API, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    signal: ctrl.signal
                });
                if (!res.ok) return { ...stamp, ok: false, reason: 'network' };
                data = await res.json();
            } finally {
                clearTimeout(timer);
            }
        } catch (e) {
            return { ...stamp, ok: false, reason: 'network' };
        }

        const info = (data && data.userInfo) || {};
        // Sin sesión de Rewards responde 200 con isRewardsUser false y
        // errorCode 5, así que el fallo no se ve en el status HTTP.
        if (!data.isRewardsUser || info.errorCode) {
            return { ...stamp, ok: false, reason: 'nosession' };
        }

        const points = num(info.balance);
        const catalog = readCatalog(info.catalogItems, points);

        return {
            ...stamp,
            ok: true,
            reason: '',
            points: points,
            // null si hoy no hay promoción de búsqueda (pasa en algunos mercados
            // y niveles). No es motivo para tirar el resto: el saldo y la tasa
            // siguen valiendo, y el panel solo cae al número manual para decidir
            // cuántas búsquedas hacer.
            search: readSearchProgress(info.promotions),
            value: catalog.value,
            cheapest: catalog.cheapest
        };
    }

    /** Último snapshot guardado, descartando el de días anteriores. */
    function readSnapshot() {
        const s = GM_getValue(KEY_SNAPSHOT, null);
        if (!s || typeof s !== 'object') return null;
        // El progreso del día no se arrastra; el saldo y la tasa sí siguen
        // valiendo, pero es más simple no mostrar nada que mostrar algo viejo
        // como si fuera de hoy.
        return s.day === getToday() ? s : null;
    }

    function writeSnapshot(s) {
        GM_setValue(KEY_SNAPSHOT, s);
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
     * Snapshot de la API para ESTA carga de página. null hasta que responda (o
     * falle), así que el panel se pinta antes de que haya red.
     * @type {object|null}
     */
    let rewards = null;

    /** ¿Hay dato de la API utilizable para decidir cuántas faltan? */
    function usingApi() {
        return getAuto() && !!rewards && rewards.ok && !!rewards.search;
    }

    /**
     * Vigila que las búsquedas sigan acreditando puntos. Con sesión activa cada
     * carga de página es una búsqueda hecha, así que si el progreso no sube en
     * varias seguidas es que Bing dejó de acreditar —lo hace en cuanto marca el
     * tráfico como automático— y seguir buscando no gana nada.
     * @param {object|null} snap
     */
    function trackProgress(snap) {
        if (!snap || !snap.ok || !snap.search) return;
        const seen = GM_getValue(KEY_SEEN_POINTS, -1);
        if (snap.search.progress > seen) {
            GM_setValue(KEY_SEEN_POINTS, snap.search.progress);
            GM_setValue(KEY_STALL, 0);
        } else if (seen >= 0 && GM_getValue(KEY_ACTIVE, false)) {
            // Solo cuenta como atasco mientras se busca: con el panel parado es
            // normal que el contador no se mueva entre cargas.
            GM_setValue(KEY_STALL, GM_getValue(KEY_STALL, 0) + 1);
        }
    }

    /**
     * Decide si toca otra búsqueda y, si no, por qué no.
     *
     * En modo automático manda `complete` de la API, NO el estimado de búsquedas
     * restantes: ese estimado se queda corto a propósito, porque en varios
     * mercados las primeras búsquedas del día no acreditan (la propia promo lo
     * avisa en su descripción, no en ningún campo). Pararse por el estimado
     * dejaría puntos sin cobrar; pararse por `complete` no.
     *
     * @returns {{go: boolean, reason: string}} reason: '' | 'done' | 'cap' | 'stalled'
     */
    function decideNext() {
        const count = GM_getValue(KEY_COUNT, 0);
        if (count >= HARD_CAP) return { go: false, reason: 'cap' };
        if (GM_getValue(KEY_STALL, 0) >= STALL_LIMIT) return { go: false, reason: 'stalled' };
        if (usingApi()) {
            return rewards.search.complete ? { go: false, reason: 'done' } : { go: true, reason: '' };
        }
        // Sin API (o en manual) se mantiene el comportamiento de siempre.
        return count >= getTotal() ? { go: false, reason: 'done' } : { go: true, reason: '' };
    }

    /**
     * Ejecuta la siguiente búsqueda si quedan pendientes.
     * @param {function} onUpdate - Callback para actualizar la interfaz.
     */
    function executeNextSearch(onUpdate) {
        const count = GM_getValue(KEY_COUNT, 0);
        const next = decideNext();

        if (!next.go) {
            GM_setValue(KEY_ACTIVE, false);
            onUpdate(count, false, next.reason);
            return;
        }

        onUpdate(count, true, '');

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
        statusText.style.marginBottom = '2px';
        statusText.style.textAlign = 'center';
        statusText.style.fontSize = '12px';

        // Segunda línea: el estimado de búsquedas que faltan, o el motivo por el
        // que no hay dato. Va aparte porque es una aproximación y no debe
        // mezclarse con el progreso, que sí es exacto.
        const hintText = document.createElement('div');
        Object.assign(hintText.style, {
            marginBottom: '8px', textAlign: 'center', fontSize: '11px',
            color: colors.gray, display: 'none'
        });

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
            updateUI(GM_getValue(KEY_COUNT, 0), false, '');
        }

        /** Resetea el contador a 0 sin iniciar. */
        function restartCounter() {
            GM_setValue(KEY_COUNT, 0);
            GM_setValue(KEY_ACTIVE, false);
            // Reiniciar es empezar de cero: si el día quedó marcado como atascado
            // hay que soltar el freno, o el botón no haría nada.
            GM_setValue(KEY_STALL, 0);
            if (searchTimeout) clearTimeout(searchTimeout);
            updateUI(0, false, '');
        }

        /** Números con el separador de miles del idioma del panel. */
        function fmt(n) {
            try {
                return new Intl.NumberFormat(LANG).format(n);
            } catch (e) {
                return String(n);
            }
        }

        /**
         * Actualiza el estado visual y los botones según el progreso.
         *
         * Con la API se muestran los PUNTOS del día, que es lo que Bing cuenta
         * de verdad; el contador local de búsquedas solo se usa cuando no hay
         * dato de Rewards.
         *
         * @param {number} count
         * @param {boolean} active
         * @param {string} reason - '' | 'done' | 'cap' | 'stalled'
         */
        function updateUI(count, active, reason) {
            btnRow.innerHTML = '';
            const api = usingApi();
            const s = api ? rewards.search : null;
            const total = getTotal();
            const done = api ? s.complete : count >= total;
            const progress = api ? `${fmt(s.progress)}/${fmt(s.max)} ${t.pointsShort}` : `${count}/${total}`;

            hintText.style.display = 'none';
            hintText.title = '';

            /** Aviso bajo el progreso: estimado si sigue, motivo si paró. */
            function hint(text, tip, color) {
                hintText.textContent = text;
                hintText.title = tip || '';
                hintText.style.color = color || colors.gray;
                hintText.style.display = 'block';
            }

            if (reason === 'stalled') {
                statusText.textContent = `⚠ ${progress}`;
                statusText.style.color = colors.red;
                hint(t.stalled, t.stalledTip, colors.red);
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.primary, restartCounter));
                renderValue();
                return;
            }

            if (reason === 'cap') {
                statusText.textContent = `⚠ ${progress}`;
                statusText.style.color = colors.red;
                hint(t.capReached, '', colors.red);
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.primary, restartCounter));
                renderValue();
                return;
            }

            if (done) {
                statusText.textContent = `✓ ${t.completed} (${progress})`;
                statusText.style.color = colors.green;
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.primary, restartCounter));
            } else if (active) {
                statusText.textContent = `${t.searching}... ${progress}`;
                statusText.style.color = colors.text;
                btnRow.appendChild(createActionBtn(t.stop, t.stopTooltip, colors.red, stopSession));
            } else if (count > 0) {
                statusText.textContent = `${t.paused}: ${progress}`;
                statusText.style.color = colors.gray;
                btnRow.appendChild(createActionBtn(t.continue_, t.continueTooltip, colors.primary, startSession));
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.red, restartCounter));
            } else {
                statusText.textContent = `${t.ready}: ${progress}`;
                statusText.style.color = colors.gray;
                btnRow.appendChild(createActionBtn(t.start, t.startTooltip, colors.primary, startSession));
            }

            // El estimado va con "~" a propósito: en varios mercados las primeras
            // búsquedas del día no acreditan, así que suele quedarse corto. Quien
            // decide cuándo parar es la API, no este número.
            if (!done && api && s.remaining !== null) {
                hint(`~${fmt(s.remaining)} ${t.searchesLeft}`, t.searchesLeftTip);
            } else if (!done && getAuto() && rewards && (!rewards.ok || !rewards.search)) {
                // Modo automático pedido pero sin progreso legible: se avisa de
                // que lo que manda es el número manual, y de por qué. Cubre
                // también el caso de respuesta buena sin promoción de búsqueda,
                // que si no degradaría al número manual en silencio.
                hint(rewards.reason === 'nosession' ? t.apiNoSession : t.apiOffline, t.manualFallbackTip);
            }

            renderValue();
        }

        // --- Valor de los puntos ---

        const valueBox = document.createElement('div');
        Object.assign(valueBox.style, {
            marginTop: '10px', paddingTop: '8px',
            borderTop: `1px solid ${colors.border}`,
            fontSize: '11px', lineHeight: '1.5', display: 'none'
        });

        /**
         * Pinta el saldo, su equivalente en saldo Xbox y el umbral de canje.
         *
         * La conversión NO usa la tarjeta más barata: dentro de un mismo mercado
         * la misma tarjeta se vende a tasas distintas y la barata es la peor (en
         * mx, MXN 20 sale a 57,25 puntos por MXN y MXN 100 a 48,95). Se usa la
         * tasa oficial del ítem de canje variable, y la tarjeta barata queda
         * para lo que sí sirve: saber a partir de cuándo se puede canjear.
         */
        function renderValue() {
            valueBox.innerHTML = '';
            // Con la casilla desmarcada el script no consulta nada, así que
            // tampoco muestra saldo: es el interruptor que devuelve el
            // comportamiento de no hacer ninguna petición de red.
            // Se compara con typeof y no con truthiness para que un saldo de 0
            // siga pintando el bloque: saber que faltan N puntos para la tarjeta
            // más barata es justo lo útil cuando no tienes ninguno.
            if (!getAuto() || !rewards || !rewards.ok || typeof rewards.points !== 'number') {
                valueBox.style.display = 'none';
                return;
            }
            valueBox.style.display = 'block';

            const line1 = document.createElement('div');
            const v = rewards.value;
            if (v) {
                const cur = v.currency ? `${v.currency} ` : '';
                line1.textContent = `${fmt(rewards.points)} ${t.pointsShort} ≈ ${cur}${fmt(v.amount)}`;
                line1.title = (v.exact ? t.valueTipExact : t.valueTipApprox)
                    .replace('{r}', fmt(Math.round(v.ratio * 100) / 100))
                    .replace('{c}', v.currency || '?');
                line1.style.cursor = 'help';
            } else {
                line1.textContent = `${fmt(rewards.points)} ${t.pointsShort}`;
            }
            line1.style.color = colors.text;
            valueBox.appendChild(line1);

            const sub = document.createElement('div');
            sub.style.color = colors.gray;
            if (v) sub.textContent = t.xboxBalance;
            valueBox.appendChild(sub);

            const c = rewards.cheapest;
            if (c) {
                const line2 = document.createElement('div');
                line2.style.marginTop = '4px';
                line2.title = c.title;
                const affordable = rewards.points >= c.price;
                line2.textContent = affordable
                    ? `${t.cheapestCard} ${fmt(c.price)} ${t.pointsShort} ✓`
                    : `${t.cheapestCard} ${fmt(c.price)} ${t.pointsShort} · ${t.needMore.replace('{n}', fmt(c.price - rewards.points))}`;
                line2.style.color = affordable ? colors.green : colors.gray;
                valueBox.appendChild(line2);
            }
        }

        searchTab.pane.appendChild(statusText);
        searchTab.pane.appendChild(hintText);
        searchTab.pane.appendChild(btnRow);
        searchTab.pane.appendChild(valueBox);

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

            // Fila del modo automático: es lo que decide si el número manual de
            // abajo se usa o solo queda de suplente, así que va antes que él.
            const autoRow = document.createElement('div');
            Object.assign(autoRow.style, {
                display: 'flex', alignItems: 'center', gap: '6px',
                marginTop: '10px', paddingTop: '8px',
                borderTop: `1px solid ${colors.border}`
            });
            autoRow.title = t.autoTip;

            const autoBox = document.createElement('input');
            autoBox.type = 'checkbox';
            autoBox.checked = getAuto();
            autoBox.style.cursor = 'pointer';
            autoBox.style.margin = '0';

            const autoLabel = document.createElement('label');
            autoLabel.textContent = t.autoLabel;
            Object.assign(autoLabel.style, {
                fontSize: '11px', color: colors.gray, cursor: 'pointer', flex: '1'
            });
            autoLabel.onclick = () => { autoBox.click(); };

            autoBox.onchange = () => {
                setAuto(autoBox.checked);
                // Cambiar de modo cambia el criterio de parada, así que hay que
                // repintar el estado, no solo guardar la preferencia.
                updateUI(GM_getValue(KEY_COUNT, 0), GM_getValue(KEY_ACTIVE, false), '');
                renderKeywordsTab();
            };

            autoRow.appendChild(autoBox);
            autoRow.appendChild(autoLabel);
            kwTab.pane.appendChild(autoRow);

            // Fila de configuración: número total de búsquedas
            const configRow = document.createElement('div');
            Object.assign(configRow.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '6px', marginTop: '6px'
            });

            const configLabel = document.createElement('span');
            configLabel.textContent = `${t.editTotal}: ${getTotal()}`;
            Object.assign(configLabel.style, {
                fontSize: '11px',
                // Siempre en gray. Se probó atenuarlo con colors.border cuando
                // manda la API, para marcar que es el suplente, y sobre
                // colors.surface eso da 1,24:1 de contraste: no se leía. Que sea
                // el suplente lo explica el tooltip de la casilla de arriba, que
                // no cuesta legibilidad.
                color: colors.gray
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
                        updateUI(GM_getValue(KEY_COUNT, 0), GM_getValue(KEY_ACTIVE, false), '');
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

        // Se pinta primero con el último snapshot conocido para que el panel no
        // aparezca vacío mientras la red va y viene.
        rewards = readSnapshot();
        updateUI(count, active, '');

        // Con sesión activa se relee siempre: cada carga de página es una
        // búsqueda hecha y el progreso de hace un minuto ya no vale. Parado,
        // basta el snapshot mientras esté fresco, para no lanzar una petición
        // por cada página de Bing que se visite navegando normalmente.
        const stale = !rewards || (Date.now() - rewards.at) > SNAPSHOT_TTL;
        const needsFetch = getAuto() && (active || stale);

        if (needsFetch) {
            requestRewards().then(snap => {
                rewards = snap;
                writeSnapshot(snap);
                trackProgress(snap);
                if (active) {
                    // La API es quien dice si quedan búsquedas, así que la sesión
                    // no continúa hasta tener su respuesta (o su fallo).
                    executeNextSearch(updateUI);
                } else {
                    updateUI(GM_getValue(KEY_COUNT, 0), false, '');
                }
            }).catch(e => {
                console.error('(bing-rewards-auto-search): Rewards API:', e);
                if (active) executeNextSearch(updateUI);
            });
        } else if (active) {
            executeNextSearch(updateUI);
        }
    } catch (e) {
        console.error('(bing-rewards-auto-search): Error:', e);
    }
})();
