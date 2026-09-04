// ==UserScript==
// @name         Bing Rewards Auto Search
// @namespace    https://www.bing.com/
// @version      1.3.10
// @description  Runs only the Bing searches you still need today: reads your Microsoft Rewards progress, does just the missing ones, stops when the day is complete, and shows what your points are worth in Xbox credit. Lists the day's other point offers, your streak bonus and protection, and the whole day's points, not just the search ones. Queries from your own keywords, rotating search types, randomised delays, 22 languages. USE AT YOUR OWN RISK: automating activity may violate the Microsoft Rewards terms.
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAOVBMVEVHcEwQbr4Qbr4QcL8Qbr8Qbr4Qbb4QcL8QcL8Qbr0Qb78Qb78QbrwQb70Qbr4Qb70Qbr0QbrwQbr7qzZxUAAAAEnRSTlMAkN8gf8+/QBCAn4+gn6CP0JCpAaXzAAAAmElEQVQ4y92TyxaCMAxE02daFdD5/481iNV4EnTjillNyc0QcijRwcS3CJQp7ZTbGU8tza1f8VLxiLW/ciOe1wxbT/K4b7aLZQNcgNPwFQgGKKqLgWgAiX3Pqw8KaC49FD9fUQwQ5CO9gUl1IW82i3XWLRGYmBpXqDC96gKl7BFhVOsOQWmWlBj4sez89c/4F0E/iH6k63QHcX8J1w5Wo/0AAAAASUVORK5CYII=
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

    const SCRIPT_VERSION = '1.3.10';

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
            stalledTip: 'Se hicieron varias búsquedas seguidas sin que subiera el contador de Rewards. Casi siempre es latencia: los puntos llegan con retraso. El script espera medio minuto, vuelve a mirar y sigue buscando hasta completar el día, aunque le lleve más búsquedas de las previstas. Si prefieres cortar, usa ⏹.',
            capReached: 'Límite de seguridad alcanzado',
            dailySetTip: 'Las tres actividades del día en Rewards, aparte de las búsquedas: cuentan para la racha. Cada enlace abre en una pestaña nueva la que falta. Si hay búsquedas automáticas en marcha, se detienen al abrirla, para que no te saquen de la página antes de completarla.',
            dailySet: 'Conjunto diario',
            streakDays: 'Racha: {n} días',
            streakTip: 'Cada línea es una racha aparte de siete pasos: los seis primeros días pagan poco y el séptimo da el premio gordo. El ✓ es lo que ya cuenta hoy; lo demás abre donde se hace.',
            offersTip: 'Ofertas de puntos del día que no van en el conjunto diario: temas destacados, la oferta fija de cada día de la semana… Cada enlace abre en una pestaña nueva la que falta. Si hay búsquedas automáticas en marcha, se detienen al abrirla, para que no te saquen de la página antes de completarla.',
            protectionTip: 'Días de protección de racha que te quedan. Si un día no completas las actividades, Rewards gasta uno y tu racha no se rompe.',
            todayPointsTip: 'Los puntos que llevas hoy de todas las fuentes, no solo de las búsquedas: conjunto diario, ofertas, rachas y bonificaciones. De lo que este panel sabe medir, hoy hay {n}; si tu total lo supera es porque has hecho actividades que desde aquí no se ven, como las de la app de Bing, Outlook o Xbox.',
            levelTip: 'Los puntos que llevas en el periodo con el que Rewards decide tu nivel, y los que te pide para mantenerlo. No es el mes natural: el periodo lo lleva Rewards por su cuenta y no dice cuándo lo cierra. Además de los puntos pide completar unas cuantas actividades, que no se cuentan aquí.',
            extraOffersNote: 'Más actividades en Rewards',
            extraOffersTip: 'En el panel de Rewards y en la app de Bing suele haber actividades extra que dan más puntos que estas. No son siempre las mismas: unas son búsquedas y otras no (puzles, preguntas, encuestas).',
            bingAppNote: 'Más puntos en la app de Bing',
            bingAppTip: 'La app de Bing tiene actividades de puntos que solo se pueden hacer ahí: en la web de Rewards salen marcadas como «Bloqueada» y aquí no aparecen. Este enlace lleva a descargarla.',
            xboxNote: 'Más puntos en Xbox',
            xboxTip: 'Xbox tiene sus propias tareas diarias, semanales y mensuales, que dan puntos aparte de estas. No aparecen ni aquí ni en el panel de Rewards: se acreditan desde la app o la consola, así que hay que mirarlas allí.',
            outlookNote: 'Misiones en Outlook',
            outlookTip: 'Outlook en el navegador tiene misiones de puntos que solo se ven ahí. No aparecen ni aquí ni en el panel de Rewards, así que hay que abrirlo para verlas y completarlas.',
            streakOffTip: 'Esta racha no está disponible en tu cuenta: Microsoft las ofrece solo a determinados miembros y en determinados mercados. Desde aquí no se puede avanzar.',
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
            infoDescriptionText: 'Automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards sin intervención manual. Le pregunta a Microsoft Rewards cuántos puntos de búsqueda te faltan hoy, ejecuta solo las búsquedas necesarias, se detiene solo al completarlas y muestra cuánto valen tus puntos en saldo Xbox; el número de ⚙ queda como suplente para cuando no hay sesión de Rewards. Número de búsquedas configurable con ⚙ (1-100, por defecto 20) y controles de iniciar / continuar / detener / reiniciar que cambian según el estado. En la pestaña de palabras clave puedes borrar cada una con un clic, añadir varias separadas por coma, editarlas todas de golpe o restaurar la lista original. El panel flotante se pliega y recuerda cómo lo dejaste, y el idioma del script se elige aquí arriba. Bajo los controles hay una lista con lo que Rewards pide hoy aparte de las búsquedas —la racha, el registro en la app, el conjunto diario— y un enlace a cada cosa que falte.',
            infoAuthor: 'Autor:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacidad:',
            infoPrivacyText: 'Tus palabras clave y el contador de búsquedas se guardan solo en el almacenamiento local del gestor de userscripts, en tu navegador. Con «Usar mi progreso de Rewards» activado, el script hace una petición GET a bing.com —el mismo endpoint que alimenta el panel de puntos de la cabecera de Bing— para leer tu progreso del día, tu saldo y el catálogo de canje; viaja con tu sesión de Bing y nada de eso sale hacia terceros ni hacia el autor del script. Desactiva esa casilla y el script no hace ninguna petición de red propia: solo navega a URLs de búsqueda de bing.com, igual que si las escribieras tú. De esa misma respuesta salen las tareas del día que aparecen en esa lista, y lo leído se guarda también en local para no volver a pedirlo en cada página de Bing.',
            infoHow: 'Cómo funciona:',
            infoHowText: 'Le pregunta a Rewards cuántos puntos de búsqueda faltan hoy y ejecuta solo las necesarias, parando cuando Rewards marca el día como completo; si el contador no sube en varias búsquedas seguidas espera medio minuto, vuelve a mirar y sigue, porque casi siempre es que Rewards acredita con retraso. Genera queries combinando 1 a 3 palabras clave y rota entre búsquedas web (70%), imágenes, videos, shopping y noticias para simular navegación humana. Los delays son aleatorios entre 3-10s, con pausas ocasionales de 10-25s que imitan lectura de resultados. Cada URL incluye parámetros rotados (form, cvid, PC) que Bing identifica como tráfico legítimo. Detecta mobile/desktop automáticamente, el progreso persiste entre recargas de página y el contador se resetea cada día a medianoche.'
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
            stalledTip: 'Several searches in a row went by without the Rewards counter moving. It is almost always latency: the points arrive late. The script waits half a minute, checks again and keeps searching until the day is done, even if that takes more searches than expected. Use ⏹ if you would rather stop.',
            capReached: 'Safety limit reached',
            dailySetTip: 'The three Rewards activities of the day, separate from searches: they count towards your streak. Each link opens a pending one in a new tab. If automatic searches are running, they stop when you open it, so they do not navigate you away before you finish it.',
            dailySet: 'Daily set',
            streakDays: 'Streak: {n} days',
            streakTip: 'Each line is a separate seven-step streak: the first six days pay little and the seventh pays the big one. A ✓ is what already counts today; the rest open where you do it.',
            offersTip: 'Point offers of the day that are not part of the daily set: featured topics, the fixed offer for each weekday… Each link opens a pending one in a new tab. If automatic searches are running, they stop when you open it, so they do not navigate you away before you finish it.',
            protectionTip: 'Streak protection days you have left. If you miss a day’s activities, Rewards spends one and your streak does not break.',
            todayPointsTip: 'The points you have earned today from every source, not just searches: the daily set, offers, streaks and bonuses. Of what this panel can measure, today there are {n}; if your total is higher it is because you have done activities it cannot see, such as those in the Bing app, Outlook or Xbox.',
            levelTip: 'The points you have in the period Rewards uses to set your level, and how many it asks for to keep it. It is not the calendar month: Rewards runs that period on its own and does not say when it closes. On top of the points it also asks you to complete a few activities, which are not counted here.',
            extraOffersNote: 'More activities in Rewards',
            extraOffersTip: 'The Rewards dashboard and the Bing app usually carry extra activities worth more points than these. They are not always the same: some are searches and some are not (puzzles, questions, polls).',
            bingAppNote: 'More points in the Bing app',
            bingAppTip: 'The Bing app has point activities you can only do there: on the Rewards site they show up as "Locked", and here they do not show up at all. This link takes you to download it.',
            xboxNote: 'More points on Xbox',
            xboxTip: 'Xbox has its own daily, weekly and monthly tasks, worth points on top of these. They show up neither here nor in the Rewards dashboard: they credit from the app or the console, so that is where you have to look.',
            outlookNote: 'Missions in Outlook',
            outlookTip: 'Outlook in the browser has point missions that can only be seen there. They show up neither here nor in the Rewards dashboard, so you have to open it to see them and complete them.',
            streakOffTip: 'This streak is not available on your account: Microsoft offers them only to select members and in select markets. There is no way to advance it from here.',
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
            infoDescriptionText: 'Automates daily Bing searches to collect Microsoft Rewards points without manual intervention. It asks Microsoft Rewards how many search points you still need today, runs only the searches required, stops on its own once they are done, and shows what your points are worth in Xbox credit; the ⚙ number stays as a stand-in for when there is no Rewards session. Search count configurable with ⚙ (1-100, default 20) and start / continue / stop / restart controls that change with the state. In the keywords tab you can delete each one with a click, add several separated by commas, edit them all at once or restore the original list. The floating panel collapses and remembers how you left it, and the script language is picked right above. Below the controls there is a list of what Rewards asks for today besides searches — your streak, the app check-in, the daily set — with a link to each one still pending.',
            infoAuthor: 'Author:',
            infoGitHub: 'GitHub:',
            infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Your keywords and the search counter are stored only in your userscript manager\'s local storage, in your browser. With "Use my Rewards progress" on, the script makes a GET request to bing.com — the same endpoint that feeds the points panel in the Bing header — to read your progress for the day, your balance and the redemption catalogue; it travels with your Bing session and none of it goes to third parties or to the script author. Turn that checkbox off and the script makes no network requests of its own: it only navigates to bing.com search URLs, exactly as if you typed them yourself. The tasks of the day shown in that list come from the same response, and what is read is also kept locally so it is not requested again on every Bing page.',
            infoHow: 'How it works:',
            infoHowText: 'It asks Rewards how many search points are missing today and runs only what is needed, stopping when Rewards marks the day as complete; if the counter does not move across several searches in a row it waits half a minute, checks again and carries on, because almost always Rewards is simply crediting late. Generates queries by combining 1 to 3 keywords and rotates between web (70%), image, video, shopping, and news searches to simulate human browsing. Delays are randomized between 3-10s with occasional 10-25s "reading pauses". Each URL includes rotated parameters (form, cvid, PC) that Bing identifies as legitimate traffic. Mobile/desktop detection is automatic, progress persists across page reloads, and the counter resets daily at midnight.'
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
            stalledTip: 'Mehrere Suchen hintereinander, ohne dass der Rewards-Zähler gestiegen ist. Fast immer ist es Latenz: Die Punkte kommen verspätet an. Das Skript wartet eine halbe Minute, sieht erneut nach und sucht weiter, bis der Tag komplett ist — auch wenn es mehr Suchen braucht als vorgesehen. Zum Abbrechen nutze ⏹.',
            capReached: 'Sicherheitsgrenze erreicht',
            dailySetTip: 'Die drei Rewards-Aktivitäten des Tages, getrennt von den Suchen: Sie zählen für deine Serie. Jeder Link öffnet eine offene Aktivität in einem neuen Tab. Laufen gerade automatische Suchen, werden sie beim Öffnen angehalten, damit sie dich nicht von der Seite wegführen, bevor du fertig bist.',
            dailySet: 'Tagesset',
            streakDays: 'Serie: {n} Tage',
            streakTip: 'Jede Zeile ist eine eigene Serie über sieben Schritte: Die ersten sechs Tage bringen wenig, der siebte den großen Bonus. Ein ✓ zählt heute schon; alles andere öffnet dort, wo es erledigt wird.',
            offersTip: 'Punkteangebote des Tages, die nicht zum Tagesset gehören: Themen-Specials, das feste Angebot je Wochentag … Jeder Link öffnet ein offenes Angebot in einem neuen Tab. Laufen gerade automatische Suchen, werden sie beim Öffnen angehalten, damit sie dich nicht von der Seite wegführen, bevor du fertig bist.',
            protectionTip: 'Verbleibende Tage Serienschutz. Wenn du an einem Tag die Aktivitäten nicht abschließt, verbraucht Rewards einen davon und deine Serie reißt nicht ab.',
            todayPointsTip: 'Die Punkte, die du heute aus allen Quellen gesammelt hast, nicht nur aus Suchen: Tagesset, Angebote, Serien und Boni. Von dem, was dieses Fenster messen kann, gibt es heute {n}; liegt dein Gesamtwert darüber, hast du Aktivitäten erledigt, die es nicht sieht — etwa in der Bing-App, in Outlook oder auf Xbox.',
            levelTip: 'Die Punkte, die du in dem Zeitraum hast, mit dem Rewards deine Stufe bestimmt, und wie viele es zum Halten verlangt. Es ist nicht der Kalendermonat: Rewards führt diesen Zeitraum selbst und sagt nicht, wann er endet. Zusätzlich zu den Punkten verlangt es einige abgeschlossene Aktivitäten, die hier nicht mitgezählt werden.',
            extraOffersNote: 'Mehr Aktivitäten in Rewards',
            extraOffersTip: 'Im Rewards-Dashboard und in der Bing-App gibt es meist zusätzliche Aktivitäten, die mehr Punkte bringen als diese. Sie sind nicht immer dieselben: Manche sind Suchen, andere nicht (Puzzles, Quizfragen, Umfragen).',
            bingAppNote: 'Mehr Punkte in der Bing-App',
            bingAppTip: 'Die Bing-App hat Punkte-Aktivitäten, die nur dort möglich sind: auf der Rewards-Website erscheinen sie als „Gesperrt“, und hier tauchen sie gar nicht auf. Dieser Link führt zum Download.',
            xboxNote: 'Mehr Punkte auf Xbox',
            xboxTip: 'Xbox hat eigene tägliche, wöchentliche und monatliche Aufgaben, die zusätzlich zu diesen Punkte bringen. Sie erscheinen weder hier noch im Rewards-Dashboard: Sie werden über die App oder die Konsole gutgeschrieben, dort muss man also nachsehen.',
            outlookNote: 'Missionen in Outlook',
            outlookTip: 'Outlook im Browser hat Punkte-Missionen, die man nur dort sieht. Sie erscheinen weder hier noch im Rewards-Dashboard, man muss es also öffnen, um sie zu sehen und zu erledigen.',
            streakOffTip: 'Diese Serie ist für dein Konto nicht verfügbar: Microsoft bietet sie nur bestimmten Mitgliedern und in bestimmten Märkten an. Von hier aus lässt sie sich nicht voranbringen.',
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
            infoDescriptionText: 'Automatisiert die täglichen Bing-Suchen, um ohne manuelles Zutun Punkte für Microsoft Rewards zu sammeln. Es fragt bei Microsoft Rewards nach, wie viele Suchpunkte dir heute noch fehlen, führt nur die nötigen Suchen aus, hört von selbst auf, wenn sie erledigt sind, und zeigt, was deine Punkte als Xbox-Guthaben wert sind; die Zahl unter ⚙ bleibt als Ersatz, wenn keine Rewards-Sitzung besteht. Die Anzahl der Suchen lässt sich mit ⚙ einstellen (1-100, Standard 20), und die Schaltflächen zum Starten, Fortsetzen, Anhalten und Zurücksetzen wechseln je nach Zustand. Im Reiter für Schlüsselwörter kannst du jedes mit einem Klick löschen, mehrere durch Komma getrennt hinzufügen, alle auf einmal bearbeiten oder die ursprüngliche Liste wiederherstellen. Das schwebende Fenster lässt sich einklappen und merkt sich, wie du es hinterlassen hast; die Sprache des Skripts wird hier oben gewählt. Unter den Schaltflächen steht eine Liste mit dem, was Rewards heute außer den Suchen verlangt — die Serie, das Einchecken in der App, das Tagesset — und ein Link zu allem, was noch fehlt.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Datenschutz:',
            infoPrivacyText: 'Deine Schlüsselwörter und der Suchzähler werden nur im lokalen Speicher der Userscript-Verwaltung in deinem Browser abgelegt. Ist „Meinen Rewards-Fortschritt verwenden“ aktiv, stellt das Skript eine GET-Anfrage an bing.com — an denselben Endpunkt, der das Punkte-Panel in der Bing-Kopfzeile versorgt —, um deinen Tagesfortschritt, dein Guthaben und den Einlösekatalog zu lesen; sie läuft über deine Bing-Sitzung, und nichts davon geht an Dritte oder an den Autor des Skripts. Schalte das Kästchen aus, dann stellt das Skript keine eigenen Netzwerkanfragen: es navigiert nur zu Such-URLs von bing.com, genauso als hättest du sie selbst eingetippt. Aus derselben Antwort stammen die Tagesaufgaben in dieser Liste, und das Gelesene wird ebenfalls lokal gespeichert, damit es nicht auf jeder Bing-Seite erneut abgefragt wird.',
            infoHow: 'Funktionsweise:',
            infoHowText: 'Es fragt bei Rewards nach, wie viele Suchpunkte heute noch fehlen, und führt nur die nötigen Suchen aus; es hört auf, sobald Rewards den Tag als abgeschlossen meldet. Steigt der Zähler über mehrere Suchen hinweg nicht, wartet es eine halbe Minute, sieht erneut nach und macht weiter, denn fast immer rechnet Rewards nur verspätet an. Es bildet Suchanfragen aus 1 bis 3 Schlüsselwörtern und wechselt zwischen Websuche (70 %), Bildern, Videos, Shopping und Nachrichten, um menschliches Surfen nachzuahmen. Die Wartezeiten liegen zufällig zwischen 3 und 10 s, mit gelegentlichen Pausen von 10 bis 25 s, die das Lesen von Ergebnissen nachbilden. Jede URL enthält wechselnde Parameter (form, cvid, PC), die Bing als legitimen Verkehr einstuft. Mobil und Desktop werden automatisch erkannt, der Fortschritt übersteht das Neuladen der Seite und der Zähler wird täglich um Mitternacht zurückgesetzt.'
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
            stalledTip: 'Plusieurs recherches d’affilée sans que le compteur Rewards bouge. C’est presque toujours de la latence : les points arrivent en retard. Le script attend une demi-minute, revérifie et continue de chercher jusqu’à terminer la journée, même s’il lui faut plus de recherches que prévu. Utilisez ⏹ si vous préférez arrêter.',
            capReached: 'Limite de sécurité atteinte',
            dailySetTip: 'Les trois activités Rewards du jour, distinctes des recherches : elles comptent pour votre série. Chaque lien ouvre dans un nouvel onglet celle qui reste. Si des recherches automatiques sont en cours, elles s’arrêtent à l’ouverture, pour ne pas vous faire quitter la page avant la fin.',
            dailySet: 'Ensemble quotidien',
            streakDays: 'Série : {n} jours',
            streakTip: 'Chaque ligne est une série distincte de sept étapes : les six premiers jours rapportent peu et le septième donne le gros lot. Un ✓ compte déjà aujourd’hui ; le reste ouvre là où cela se fait.',
            offersTip: 'Les offres de points du jour qui ne font pas partie de l’ensemble quotidien : thèmes à la une, l’offre fixe de chaque jour de la semaine… Chaque lien ouvre celle qui reste dans un nouvel onglet. Si des recherches automatiques sont en cours, elles s’arrêtent à l’ouverture.',
            protectionTip: 'Jours de protection de série qu’il vous reste. Si vous ne terminez pas les activités un jour, Rewards en consomme un et votre série n’est pas rompue.',
            todayPointsTip: 'Les points accumulés aujourd’hui, toutes sources confondues, pas seulement les recherches : ensemble quotidien, offres, séries et bonus. Parmi ce que ce panneau sait mesurer, il y a {n} aujourd’hui ; si votre total dépasse ce chiffre, c’est que vous avez fait des activités qu’il ne voit pas, comme celles de l’application Bing, d’Outlook ou de Xbox.',
            levelTip: 'Les points accumulés sur la période avec laquelle Rewards détermine votre niveau, et ceux qu’il demande pour le conserver. Ce n’est pas le mois civil : Rewards gère cette période lui-même et n’indique pas quand elle se termine. En plus des points, il demande aussi de réaliser quelques activités, qui ne sont pas comptées ici.',
            extraOffersNote: 'Plus d’activités dans Rewards',
            extraOffersTip: 'Le tableau de bord Rewards et l’application Bing proposent en général des activités supplémentaires qui rapportent plus que celles-ci. Elles ne sont pas toujours les mêmes : certaines sont des recherches, d’autres non (puzzles, questions, sondages).',
            bingAppNote: 'Plus de points dans l’application Bing',
            bingAppTip: 'L’application Bing propose des activités à points qui ne se font que là : sur le site Rewards elles apparaissent comme « Verrouillée », et ici elles n’apparaissent pas du tout. Ce lien mène à son téléchargement.',
            xboxNote: 'Plus de points sur Xbox',
            xboxTip: 'Xbox a ses propres tâches quotidiennes, hebdomadaires et mensuelles, qui rapportent des points en plus de celles-ci. Elles n’apparaissent ni ici ni dans le tableau de bord Rewards : elles sont créditées depuis l’application ou la console, c’est donc là qu’il faut regarder.',
            outlookNote: 'Missions dans Outlook',
            outlookTip: 'Outlook dans le navigateur a des missions à points que l’on ne voit que là. Elles n’apparaissent ni ici ni dans le tableau de bord Rewards, il faut donc l’ouvrir pour les voir et les terminer.',
            streakOffTip: 'Cette série n’est pas disponible sur votre compte : Microsoft ne les propose qu’à certains membres et sur certains marchés. Impossible de la faire avancer d’ici.',
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
            infoDescriptionText: 'Automatise les recherches quotidiennes sur Bing pour accumuler des points Microsoft Rewards sans intervention manuelle. Il demande à Microsoft Rewards combien de points de recherche vous manquent aujourd’hui, effectue uniquement les recherches nécessaires, s’arrête de lui-même une fois terminé et affiche ce que valent vos points en crédit Xbox ; le nombre sous ⚙ reste en réserve pour les cas où aucune session Rewards n’est ouverte. Le nombre de recherches se règle avec ⚙ (1-100, 20 par défaut) et les commandes démarrer / poursuivre / arrêter / réinitialiser changent selon l’état. Dans l’onglet des mots-clés, vous pouvez en supprimer un d’un clic, en ajouter plusieurs séparés par des virgules, les modifier tous d’un coup ou rétablir la liste d’origine. Le panneau flottant se replie et retient la position où vous l’avez laissé, et la langue du script se choisit ici en haut. Sous les commandes figure une liste de ce que Rewards demande aujourd’hui en dehors des recherches — la série, l’enregistrement dans l’application, l’ensemble quotidien — avec un lien vers chaque élément qui reste.',
            infoAuthor: 'Auteur :', infoGitHub: 'GitHub :', infoPrivacy: 'Confidentialité :',
            infoPrivacyText: 'Vos mots-clés et le compteur de recherches sont conservés uniquement dans le stockage local du gestionnaire de userscripts, dans votre navigateur. Lorsque « Utiliser ma progression Rewards » est activé, le script envoie une requête GET à bing.com — le même point d’accès qui alimente le panneau de points de l’en-tête de Bing — pour lire votre progression du jour, votre solde et le catalogue d’échange ; elle passe par votre session Bing et rien de tout cela ne part vers des tiers ni vers l’auteur du script. Décochez cette case et le script n’effectue aucune requête réseau qui lui soit propre : il navigue seulement vers des URL de recherche de bing.com, exactement comme si vous les saisissiez vous-même. Les tâches du jour affichées dans cette liste proviennent de la même réponse, et ce qui est lu est également conservé en local pour ne pas le redemander sur chaque page de bing.com.',
            infoHow: 'Fonctionnement :',
            infoHowText: 'Il demande à Rewards combien de points de recherche manquent aujourd’hui et n’effectue que les recherches nécessaires, en s’arrêtant lorsque Rewards déclare la journée terminée ; si le compteur ne bouge pas sur plusieurs recherches d’affilée, il attend une demi-minute, revérifie et poursuit, car il s’agit presque toujours d’un crédit tardif de Rewards. Il compose des requêtes en combinant 1 à 3 mots-clés et alterne entre recherche web (70 %), images, vidéos, shopping et actualités pour imiter une navigation humaine. Les délais sont aléatoires entre 3 et 10 s, avec des pauses occasionnelles de 10 à 25 s qui imitent la lecture des résultats. Chaque URL comporte des paramètres qui tournent (form, cvid, PC) et que Bing identifie comme du trafic légitime. Le mode mobile ou bureau est détecté automatiquement, la progression survit aux rechargements de page et le compteur se remet à zéro chaque jour à minuit.'
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
            stalledTip: 'Várias pesquisas seguidas sem o contador do Rewards subir. Quase sempre é latência: os pontos chegam com atraso. O script espera meio minuto, volta a verificar e continua a pesquisar até concluir o dia, mesmo que leve mais pesquisas do que o previsto. Se preferir parar, use ⏹.',
            capReached: 'Limite de segurança atingido',
            dailySetTip: 'As três atividades do dia no Rewards, à parte das pesquisas: contam para a sua sequência. Cada ligação abre num separador novo a que falta. Se houver pesquisas automáticas a decorrer, param ao abri-la, para não o tirarem da página antes de a concluir.',
            dailySet: 'Conjunto diário',
            streakDays: 'Sequência: {n} dias',
            streakTip: 'Cada linha é uma sequência à parte de sete passos: os seis primeiros dias pagam pouco e o sétimo dá o prémio grande. O ✓ é o que já conta hoje; o resto abre onde se faz.',
            offersTip: 'As ofertas de pontos do dia que não fazem parte do conjunto diário: temas em destaque, a oferta fixa de cada dia da semana… Cada ligação abre num separador novo a que falta. Se houver pesquisas automáticas a decorrer, param ao abri-la.',
            protectionTip: 'Dias de proteção de sequência que ainda tem. Se num dia não concluir as atividades, o Rewards gasta um e a sua sequência não se quebra.',
            todayPointsTip: 'Os pontos que já ganhou hoje de todas as fontes, não só das pesquisas: conjunto diário, ofertas, sequências e bonificações. Do que este painel consegue medir, hoje há {n}; se o seu total for maior é porque fez atividades que daqui não se veem, como as da aplicação Bing, do Outlook ou da Xbox.',
            levelTip: 'Os pontos que tem no período com que o Rewards define o seu nível, e os que pede para o manter. Não é o mês de calendário: o Rewards gere esse período por sua conta e não diz quando o fecha. Além dos pontos, pede também concluir algumas atividades, que aqui não se contam.',
            extraOffersNote: 'Mais atividades no Rewards',
            extraOffersTip: 'No painel do Rewards e na aplicação Bing costuma haver atividades extra que dão mais pontos do que estas. Nem sempre são as mesmas: umas são pesquisas e outras não (puzzles, perguntas, sondagens).',
            bingAppNote: 'Mais pontos na aplicação Bing',
            bingAppTip: 'A aplicação Bing tem atividades de pontos que só se fazem ali: no site do Rewards aparecem como «Bloqueada» e aqui não aparecem de todo. Esta ligação leva a transferi-la.',
            xboxNote: 'Mais pontos na Xbox',
            xboxTip: 'A Xbox tem as suas próprias tarefas diárias, semanais e mensais, que dão pontos além destas. Não aparecem aqui nem no painel do Rewards: são creditadas a partir da aplicação ou da consola, por isso é lá que há que ver.',
            outlookNote: 'Missões no Outlook',
            outlookTip: 'O Outlook no navegador tem missões de pontos que só se veem ali. Não aparecem aqui nem no painel do Rewards, por isso há que abri-lo para as ver e completar.',
            streakOffTip: 'Esta sequência não está disponível na sua conta: a Microsoft só as oferece a determinados membros e em determinados mercados. A partir daqui não é possível avançá-la.',
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
            infoDescriptionText: 'Automatiza pesquisas diárias no Bing para acumular pontos do Microsoft Rewards sem intervenção manual. Pergunta ao Microsoft Rewards quantos pontos de pesquisa lhe faltam hoje, faz apenas as pesquisas necessárias, para sozinho quando as termina e mostra quanto valem os seus pontos em saldo Xbox; o número do ⚙ fica como suplente para quando não há sessão do Rewards. O número de pesquisas configura-se com ⚙ (1-100, 20 por omissão) e os controlos de iniciar / continuar / parar / reiniciar mudam consoante o estado. No separador de palavras-chave pode apagar cada uma com um clique, adicionar várias separadas por vírgula, editá-las todas de uma vez ou repor a lista original. O painel flutuante recolhe-se e lembra-se de como o deixou, e o idioma do script escolhe-se aqui em cima. Por baixo dos controlos há uma lista com o que o Rewards pede hoje além das pesquisas — a sequência, o registo na aplicação, o conjunto diário — e uma ligação para cada coisa que falte.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacidade:',
            infoPrivacyText: 'As suas palavras-chave e o contador de pesquisas são guardados apenas no armazenamento local do gestor de userscripts, no seu navegador. Com «Usar o meu progresso do Rewards» ativado, o script faz um pedido GET ao bing.com — o mesmo ponto de acesso que alimenta o painel de pontos do cabeçalho do Bing — para ler o seu progresso do dia, o seu saldo e o catálogo de troca; viaja com a sua sessão do Bing e nada disso sai para terceiros nem para o autor do script. Desative essa caixa e o script não faz qualquer pedido de rede próprio: limita-se a navegar para URLs de pesquisa do bing.com, tal como se fosse você a escrevê-los. As tarefas do dia que aparecem nessa lista saem da mesma resposta, e o que é lido fica também guardado localmente para não voltar a ser pedido em cada página do Bing.',
            infoHow: 'Como funciona:',
            infoHowText: 'Pergunta ao Rewards quantos pontos de pesquisa faltam hoje e faz apenas as necessárias, parando quando o Rewards marca o dia como concluído; se o contador não subir ao longo de várias pesquisas seguidas, espera meio minuto, volta a verificar e continua, porque quase sempre é o Rewards a creditar com atraso. Gera consultas combinando 1 a 3 palavras-chave e alterna entre pesquisas web (70%), imagens, vídeos, compras e notícias para simular navegação humana. Os atrasos são aleatórios entre 3-10 s, com pausas ocasionais de 10-25 s que imitam a leitura dos resultados. Cada URL inclui parâmetros rotativos (form, cvid, PC) que o Bing identifica como tráfego legítimo. Deteta automaticamente telemóvel ou computador, o progresso persiste entre recargas da página e o contador é reposto todos os dias à meia-noite.'
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
            stalledTip: 'Несколько запросов подряд прошли без движения счётчика Rewards. Почти всегда это задержка: баллы приходят позже. Скрипт ждёт полминуты, проверяет снова и продолжает искать, пока день не будет завершён, даже если на это уйдёт больше запросов, чем ожидалось. Чтобы прервать, нажмите ⏹.',
            capReached: 'Достигнут предохранительный предел',
            dailySetTip: 'Три задания Rewards на сегодня, помимо поиска: они идут в зачёт серии. Каждая ссылка открывает невыполненное задание в новой вкладке. Если идёт автоматический поиск, при открытии он останавливается, чтобы не увести вас со страницы, пока вы его не закончите.',
            dailySet: 'Ежедневный набор',
            streakDays: 'Серия дней подряд: {n}',
            streakTip: 'Каждая строка — отдельная серия из семи шагов: первые шесть дней дают немного, а седьмой — крупный бонус. Галочка означает, что на сегодня уже засчитано; остальные строки открывают то, где это делается.',
            offersTip: 'Предложения с баллами на сегодня, не входящие в ежедневный набор: тематические подборки, постоянное предложение каждого дня недели… Каждая ссылка открывает невыполненное в новой вкладке. Если идёт автоматический поиск, при открытии он останавливается.',
            protectionTip: 'Оставшиеся дни защиты серии. Если однажды вы не выполните задания, Rewards потратит один день, и серия не прервётся.',
            todayPointsTip: 'Баллы, набранные сегодня из всех источников, а не только за поиск: ежедневный набор, предложения, серии и бонусы. Из того, что эта панель умеет считать, сегодня есть {n}; если ваш итог больше, значит вы выполнили задания, которых она не видит, — например в приложении Bing, в Outlook или на Xbox.',
            levelTip: 'Баллы, набранные за период, по которому Rewards определяет ваш уровень, и сколько нужно, чтобы его сохранить. Это не календарный месяц: Rewards ведёт этот период сам и не сообщает, когда он закончится. Кроме баллов требуется выполнить несколько заданий, которые здесь не учитываются.',
            extraOffersNote: 'Больше заданий в Rewards',
            extraOffersTip: 'На панели Rewards и в приложении Bing обычно есть дополнительные задания, которые дают больше баллов, чем эти. Они не всегда одинаковые: часть — поиски, часть — нет (головоломки, викторины, опросы).',
            bingAppNote: 'Больше баллов в приложении Bing',
            bingAppTip: 'В приложении Bing есть задания на баллы, которые выполняются только там: на сайте Rewards они помечены как «Заблокировано», а здесь их нет вовсе. Эта ссылка ведёт к его установке.',
            xboxNote: 'Больше баллов в Xbox',
            xboxTip: 'У Xbox есть свои ежедневные, еженедельные и ежемесячные задания, которые дают баллы сверх этих. Их нет ни здесь, ни на панели Rewards: они начисляются из приложения или с консоли, там их и надо смотреть.',
            outlookNote: 'Задания в Outlook',
            outlookTip: 'В Outlook в браузере есть задания на баллы, которые видны только там. Их нет ни здесь, ни на панели Rewards, поэтому его нужно открыть, чтобы увидеть и выполнить их.',
            streakOffTip: 'Эта серия недоступна в вашей учётной записи: Microsoft предлагает их только отдельным участникам и на отдельных рынках. Отсюда её не продвинуть.',
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
            infoDescriptionText: 'Автоматизирует ежедневные запросы в Bing, чтобы копить баллы Microsoft Rewards без ручных действий. Скрипт спрашивает у Microsoft Rewards, сколько поисковых баллов вам осталось получить сегодня, выполняет только нужные запросы, сам останавливается по завершении и показывает, сколько ваши баллы стоят в виде счёта Xbox; число под ⚙ остаётся на подмену, когда сессии Rewards нет. Количество запросов настраивается кнопкой ⚙ (1-100, по умолчанию 20), а кнопки запуска, продолжения, остановки и сброса меняются в зависимости от состояния. На вкладке ключевых слов каждое можно удалить одним щелчком, добавить несколько через запятую, изменить все сразу или вернуть исходный список. Плавающая панель сворачивается и запоминает, как вы её оставили, а язык скрипта выбирается здесь наверху. Под кнопками идёт список того, что Rewards просит сегодня помимо поиска — серия, отметка в приложении, ежедневный набор — со ссылкой на каждое невыполненное задание.',
            infoAuthor: 'Автор:', infoGitHub: 'GitHub:', infoPrivacy: 'Конфиденциальность:',
            infoPrivacyText: 'Ваши ключевые слова и счётчик запросов хранятся только в локальном хранилище менеджера пользовательских скриптов, в вашем браузере. Если включено «Использовать мой прогресс Rewards», скрипт делает GET-запрос к bing.com — к тому же адресу, который питает панель баллов в шапке Bing, — чтобы прочитать ваш прогресс за день, баланс и каталог обмена; запрос идёт через вашу сессию Bing, и ничто из этого не уходит третьим сторонам или автору скрипта. Снимите этот флажок, и скрипт не будет делать собственных сетевых запросов: он лишь переходит по поисковым адресам bing.com, ровно так же, как если бы вы набрали их сами. Задания дня в этом списке берутся из того же ответа, а прочитанное так же сохраняется локально, чтобы не запрашивать его на каждой странице Bing.',
            infoHow: 'Как это работает:',
            infoHowText: 'Скрипт спрашивает у Rewards, сколько поисковых баллов не хватает сегодня, и выполняет только нужные запросы, останавливаясь, когда Rewards отмечает день как завершённый; если счётчик не растёт несколько запросов подряд, он ждёт полминуты, проверяет снова и продолжает, потому что почти всегда Rewards просто начисляет с задержкой. Скрипт составляет запросы из 1-3 ключевых слов и чередует веб-поиск (70 %), изображения, видео, покупки и новости, изображая обычный просмотр. Задержки случайны в пределах 3-10 с, изредка с паузами 10-25 с, имитирующими чтение результатов. В каждый адрес подставляются меняющиеся параметры (form, cvid, PC), которые Bing принимает за обычный трафик. Мобильный и настольный режимы определяются автоматически, прогресс переживает перезагрузку страницы, а счётчик обнуляется каждый день в полночь.'
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
            stalledTip: 'Rewards sayacı hiç ilerlemeden üst üste birkaç arama yapıldı. Bu neredeyse her zaman gecikmedir: puanlar geç gelir. Betik yarım dakika bekler, yeniden bakar ve gün tamamlanana kadar aramaya devam eder; beklenenden fazla arama gerekse bile. Durdurmak isterseniz ⏹ kullanın.',
            capReached: 'Güvenlik sınırına ulaşıldı',
            dailySetTip: 'Günün üç Rewards etkinliği; aramalardan ayrıdır ve seriye sayılır. Her bağlantı, kalan etkinliği yeni bir sekmede açar. Otomatik aramalar sürüyorsa açtığınızda durur; böylece siz bitirmeden sizi sayfadan uzaklaştırmazlar.',
            dailySet: 'Günlük set',
            streakDays: 'Seri: {n} gün',
            streakTip: 'Her satır, yedi adımlık ayrı bir seridir: ilk altı gün az kazandırır, yedincisi büyük ikramiyeyi verir. ✓ bugün için zaten sayılanı gösterir; diğerleri yapıldığı yeri açar.',
            offersTip: 'Günlük sete dahil olmayan puan teklifleri: öne çıkan konular, haftanın her gününe ait sabit teklif… Her bağlantı kalan teklifi yeni bir sekmede açar. Otomatik aramalar sürüyorsa açtığınızda durur.',
            protectionTip: 'Kalan seri koruma günleriniz. Bir gün etkinlikleri tamamlamazsanız Rewards bir gün harcar ve seriniz bozulmaz.',
            todayPointsTip: 'Bugün yalnızca aramalardan değil, tüm kaynaklardan kazandığınız puanlar: günlük set, teklifler, seriler ve bonuslar. Bu panelin ölçebildiklerinden bugün {n} puan var; toplamınız bunu aşıyorsa buradan görünmeyen etkinlikleri yapmışsınız demektir; örneğin Bing uygulaması, Outlook veya Xbox.',
            levelTip: 'Rewards’ın seviyenizi belirlemek için kullandığı dönemde topladığınız puanlar ve seviyeyi korumak için istediği puan. Takvim ayı değildir: Rewards bu dönemi kendi yürütür ve ne zaman kapandığını söylemez. Puanların yanı sıra birkaç etkinliği tamamlamanızı da ister; onlar burada sayılmaz.',
            extraOffersNote: 'Rewards’ta daha fazla etkinlik',
            extraOffersTip: 'Rewards panelinde ve Bing uygulamasında genellikle bunlardan daha çok puan veren ek etkinlikler bulunur. Hep aynı olmazlar: bazıları aramadır, bazıları değil (yapbozlar, sorular, anketler).',
            bingAppNote: 'Bing uygulamasında daha fazla puan',
            bingAppTip: 'Bing uygulamasında yalnızca orada yapılabilen puan etkinlikleri var: Rewards sitesinde «Kilitli» olarak görünürler, burada ise hiç çıkmazlar. Bu bağlantı uygulamayı indirmeye götürür.',
            xboxNote: 'Xbox’ta daha fazla puan',
            xboxTip: 'Xbox’un kendi günlük, haftalık ve aylık görevleri var; bunlara ek puan verirler. Ne burada ne de Rewards panelinde görünürler: uygulamadan ya da konsoldan işlenirler, dolayısıyla oradan bakmak gerekir.',
            outlookNote: 'Outlook’ta görevler',
            outlookTip: 'Tarayıcıdaki Outlook’ta yalnızca orada görünen puan görevleri var. Ne burada ne de Rewards panelinde çıkarlar; görmek ve tamamlamak için Outlook’u açmak gerekir.',
            streakOffTip: 'Bu seri hesabınızda kullanılamıyor: Microsoft bunları yalnızca belirli üyelere ve belirli pazarlarda sunuyor. Buradan ilerletilemez.',
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
            infoDescriptionText: 'Microsoft Rewards puanı biriktirmek için günlük Bing aramalarını elle uğraşmadan otomatikleştirir. Betik, Microsoft Rewards’a bugün kaç arama puanınızın eksik olduğunu sorar, yalnızca gereken aramaları yapar, bitince kendiliğinden durur ve puanlarınızın Xbox bakiyesi olarak ne değerde olduğunu gösterir; ⚙ altındaki sayı, Rewards oturumu olmadığı durumlar için yedek kalır. Arama sayısı ⚙ ile ayarlanır (1-100, varsayılan 20); başlat / sürdür / durdur / sıfırla düğmeleri duruma göre değişir. Anahtar kelimeler sekmesinde her birini tek tıkla silebilir, virgülle ayırarak birkaçını ekleyebilir, hepsini birden düzenleyebilir veya özgün listeyi geri yükleyebilirsiniz. Yüzen panel katlanır ve onu nasıl bıraktığınızı hatırlar; betiğin dili de buradan, en üstten seçilir. Düğmelerin altında, Rewards’ın bugün aramaların dışında istediklerinin listesi vardır — seri, uygulamada oturum işaretleme, günlük set — ve eksik olan her birine bir bağlantı.',
            infoAuthor: 'Yazar:', infoGitHub: 'GitHub:', infoPrivacy: 'Gizlilik:',
            infoPrivacyText: 'Anahtar kelimeleriniz ve arama sayacı yalnızca tarayıcınızdaki userscript yöneticisinin yerel deposunda tutulur. “Rewards ilerlememi kullan” açıkken betik bing.com’a bir GET isteği yapar — Bing başlığındaki puan panelini besleyen aynı uç nokta — ve günün ilerlemesini, bakiyenizi ve kullanım katalogunu okur; istek sizin Bing oturumunuzla gider ve bunların hiçbiri üçüncü taraflara ya da betiğin yazarına ulaşmaz. O kutuyu kapatın, betik kendine ait hiçbir ağ isteği yapmaz: yalnızca bing.com arama adreslerine gider, tıpkı siz yazmışsınız gibi. O listedeki günün görevleri de aynı yanıttan gelir ve okunanlar her Bing sayfasında yeniden istenmesin diye yerel olarak saklanır.',
            infoHow: 'Nasıl çalışır:',
            infoHowText: 'Betik, Rewards’a bugün kaç arama puanı eksik olduğunu sorar ve yalnızca gerekenleri yapar; Rewards günü tamamlandı olarak işaretleyince durur. Sayaç üst üste birkaç aramada ilerlemezse yarım dakika bekler, yeniden bakar ve sürdürür; çünkü bu neredeyse her zaman Rewards’ın geç işlemesidir. 1 ila 3 anahtar kelimeyi birleştirerek sorgular üretir ve insan gezinmesini taklit etmek için web araması (%70), görseller, videolar, alışveriş ve haberler arasında dönüşümlü geçer. Bekleme süreleri 3-10 sn arasında rastgeledir; ara sıra sonuçların okunmasını taklit eden 10-25 sn’lik duraklamalar olur. Her adres, Bing’in meşru trafik olarak gördüğü dönüşümlü parametreler (form, cvid, PC) içerir. Mobil ve masaüstü otomatik olarak algılanır, ilerleme sayfa yenilemelerinde korunur ve sayaç her gün gece yarısı sıfırlanır.'
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
            stalledTip: 'Rewards のカウンターが動かないまま検索が数回続きました。ほとんどの場合は遅延で、ポイントは遅れて入ります。スクリプトは30秒ほど待って再確認し、その日の分が終わるまで検索を続けます。予定より回数が増えても続けます。止めたいときは ⏹ を押してください。',
            capReached: '安全上限に達しました',
            dailySetTip: '検索とは別の、その日の Rewards アクティビティ3つです。連続記録の対象になります。各リンクは未完了のものを新しいタブで開きます。自動検索が動いている場合は開いた時点で停止します。終わる前にページから移動させないためです。',
            dailySet: 'デイリーセット',
            streakDays: '連続記録: {n}日',
            streakTip: '各行はそれぞれ7段階の連続記録で、最初の6日は少しずつ、7日目にまとめて入ります。✓ は今日ぶんがすでに数えられているもの、それ以外は実施する場所を開きます。',
            offersTip: 'デイリーセットとは別の、その日のポイント特典です。特集トピックや曜日ごとの定番特典などがあります。各リンクは未完了のものを新しいタブで開きます。自動検索が動いている場合は開いた時点で停止します。',
            protectionTip: '連続記録の保護に使える残り日数です。ある日のアクティビティを完了できなくても、Rewards がこれを1日消費し、連続記録は途切れません。',
            todayPointsTip: '検索だけでなく、デイリーセット・特典・連続記録・ボーナスなど、今日すべての入手元から獲得したポイントです。このパネルが把握できる範囲では今日は {n} ポイントあります。合計がこれを超える場合は、Bing アプリや Outlook、Xbox など、ここからは見えないアクティビティを行ったからです。',
            levelTip: 'Rewards がレベルを決めるのに使う期間に獲得したポイントと、レベル維持に必要なポイントです。暦月ではありません。この期間は Rewards が独自に管理しており、いつ締まるかは示されません。ポイントのほかにいくつかのアクティビティの達成も求められますが、ここには含まれません。',
            extraOffersNote: 'Rewards の他のアクティビティ',
            extraOffersTip: 'Rewards のダッシュボードや Bing アプリには、これらより点数の高い追加アクティビティがあるのが普通です。毎回同じとは限らず、検索のものもあれば、そうでないもの（パズル、クイズ、アンケート）もあります。',
            bingAppNote: 'Bing アプリでさらにポイント',
            bingAppTip: 'Bing アプリには、そこでしか実行できないポイント アクティビティがあります。Rewards のサイトでは「ロック済み」と表示され、ここには出てきません。このリンクからアプリを入手できます。',
            xboxNote: 'Xbox でさらにポイント',
            xboxTip: 'Xbox には独自の日次・週次・月次のタスクがあり、これらとは別にポイントがもらえます。ここにも Rewards のダッシュボードにも出てきません。アプリか本体から加算されるので、確認はそちらで行います。',
            outlookNote: 'Outlook のミッション',
            outlookTip: 'ブラウザーの Outlook には、そこでしか見られないポイントミッションがあります。ここにも Rewards のダッシュボードにも出てこないので、確認と達成は Outlook を開いて行います。',
            streakOffTip: 'このストリークはあなたのアカウントでは利用できません。Microsoft は一部のメンバーと一部の市場にのみ提供しています。ここからは進められません。',
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
            infoDescriptionText: 'Microsoft Rewards のポイントを手作業なしで貯めるため、Bing の毎日の検索を自動化します。今日あと何ポイント足りないかを Microsoft Rewards に問い合わせ、必要な回数だけ検索し、終われば自動で停止して、ポイントが Xbox 残高でいくらになるかを表示します。⚙ の回数は、Rewards のセッションがないときの控えとして残ります。検索回数は ⚙ で設定でき（1〜100、既定は 20）、開始・再開・停止・リセットのボタンは状態に応じて切り替わります。キーワードのタブでは、ひとつずつクリックで削除、カンマ区切りでまとめて追加、全体を一括編集、元の一覧に復元ができます。浮動パネルは折りたためて状態を記憶し、スクリプトの言語はこの上部で選べます。ボタンの下には、検索以外にその日の Rewards が求めるもの（連続記録、アプリでの登録、デイリーセット）の一覧が出て、未完了のものにはリンクが付きます。',
            infoAuthor: '作者:', infoGitHub: 'GitHub:', infoPrivacy: 'プライバシー:',
            infoPrivacyText: 'キーワードと検索カウンターは、ブラウザー内のユーザースクリプト管理アドオンのローカルストレージにのみ保存されます。「Rewards の進捗を使う」がオンのときは、その日の進捗・残高・交換カタログを読むために bing.com へ GET 要求を1件送ります。宛先は Bing のヘッダーのポイント パネルを動かしているのと同じエンドポイントで、あなたの Bing セッションを通ります。その内容が第三者やスクリプトの作者に渡ることはありません。このチェックを外せば、スクリプトは独自のネットワーク要求を一切行いません。自分で入力した場合とまったく同じように、bing.com の検索 URL へ移動するだけです。その一覧に出る今日の課題も同じ応答から取り出し、読み取った内容は Bing のページごとに問い合わせ直さないようローカルにも保存します。',
            infoHow: '仕組み:',
            infoHowText: '今日あと何ポイント足りないかを Rewards に問い合わせ、必要な分だけ検索し、Rewards が「完了」と示したら停止します。検索を数回続けてもカウンターが上がらない場合は30秒ほど待って再確認し、そのまま続けます。ほとんどは Rewards の加算が遅れているだけだからです。 キーワードを1〜3語組み合わせてクエリを作り、人間の閲覧に近づけるためウェブ検索（70%）、画像、動画、ショッピング、ニュースを切り替えます。待ち時間は3〜10秒のランダムで、結果を読む動作を模した10〜25秒の休止がときどき入ります。各 URL には Bing が正当なトラフィックとみなす可変パラメーター（form、cvid、PC）が付きます。モバイルとデスクトップは自動判定され、進捗はページの再読み込みをまたいで保持され、カウンターは毎日0時にリセットされます。'
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
            stalledTip: 'Rewards 카운터가 오르지 않은 채 검색이 여러 번 이어졌습니다. 대개는 지연으로, 포인트가 늦게 들어옵니다. 스크립트는 30초쯤 기다렸다가 다시 확인하고, 예상보다 검색이 많아지더라도 그날 분량을 마칠 때까지 계속합니다. 멈추려면 ⏹ 를 누르세요.',
            capReached: '안전 한도에 도달했습니다',
            dailySetTip: '검색과는 별개인 오늘의 Rewards 활동 세 가지입니다. 연속 기록에 반영됩니다. 각 링크는 남은 활동을 새 탭에서 엽니다. 자동 검색이 실행 중이면 열 때 멈춥니다. 끝내기 전에 페이지를 벗어나지 않도록 하기 위해서입니다.',
            dailySet: '데일리 세트',
            streakDays: '연속 기록: {n}일',
            streakTip: '각 줄은 7단계짜리 별도의 연속 기록으로, 처음 엿새는 조금씩 주고 이레째에 크게 줍니다. ✓ 는 오늘 몫이 이미 반영된 것이고, 나머지는 해당 작업을 하는 곳을 엽니다.',
            offersTip: '데일리 세트와는 별개인 오늘의 포인트 혜택입니다. 특집 주제나 요일별 고정 혜택 등이 있습니다. 각 링크는 남은 항목을 새 탭에서 엽니다. 자동 검색이 실행 중이면 열 때 멈춥니다.',
            protectionTip: '남은 연속 기록 보호 일수입니다. 어느 날 활동을 완료하지 못해도 Rewards가 하루를 사용해 연속 기록이 끊기지 않습니다.',
            todayPointsTip: '검색뿐 아니라 데일리 세트, 혜택, 연속 기록, 보너스 등 모든 출처에서 오늘 획득한 포인트입니다. 이 패널이 파악할 수 있는 범위에서 오늘은 {n} 포인트가 있습니다. 합계가 이보다 크다면 Bing 앱, Outlook, Xbox처럼 여기서 보이지 않는 활동을 했기 때문입니다.',
            levelTip: 'Rewards가 등급을 정할 때 쓰는 기간에 모은 포인트와, 등급 유지에 요구하는 포인트입니다. 달력상의 한 달이 아닙니다. 이 기간은 Rewards가 자체적으로 관리하며 언제 끝나는지 알려주지 않습니다. 포인트 외에 몇 가지 활동 완료도 요구하는데, 여기에는 포함되지 않습니다.',
            extraOffersNote: 'Rewards의 다른 활동',
            extraOffersTip: 'Rewards 대시보드와 Bing 앱에는 보통 이보다 점수가 높은 추가 활동이 있습니다. 매번 같지도 않아서 검색인 것도 있고 아닌 것도 있습니다(퍼즐, 퀴즈, 설문).',
            bingAppNote: 'Bing 앱에서 더 많은 포인트',
            bingAppTip: 'Bing 앱에는 거기서만 할 수 있는 포인트 활동이 있습니다. Rewards 웹사이트에서는 "잠김"으로 표시되고 여기에는 아예 나오지 않습니다. 이 링크로 앱을 내려받을 수 있습니다.',
            xboxNote: 'Xbox에서 더 많은 포인트',
            xboxTip: 'Xbox에는 자체 일간·주간·월간 과제가 있어 이와 별도로 포인트를 줍니다. 여기에도 Rewards 대시보드에도 나오지 않습니다. 앱이나 콘솔에서 적립되므로 확인은 그쪽에서 해야 합니다.',
            outlookNote: 'Outlook의 미션',
            outlookTip: '브라우저의 Outlook에는 그곳에서만 볼 수 있는 포인트 미션이 있습니다. 여기에도 Rewards 대시보드에도 나오지 않으므로 Outlook을 열어서 확인하고 완료해야 합니다.',
            streakOffTip: '이 연속 기록은 계정에서 사용할 수 없습니다. Microsoft는 일부 회원과 일부 시장에만 제공합니다. 여기서는 진행할 수 없습니다.',
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
            infoDescriptionText: '손대지 않고도 Microsoft Rewards 포인트를 쌓도록 Bing의 일일 검색을 자동화합니다. 오늘 검색 포인트가 얼마나 남았는지 Microsoft Rewards에 물어보고, 필요한 만큼만 검색하고, 끝나면 스스로 멈추며, 포인트가 Xbox 잔액으로 얼마인지 보여줍니다. ⚙의 횟수는 Rewards 세션이 없을 때를 위한 대비로 남습니다. 검색 횟수는 ⚙로 설정하며(1-100, 기본 20), 시작·계속·중지·초기화 버튼은 상태에 따라 바뀝니다. 키워드 탭에서는 하나씩 클릭해 삭제하거나, 쉼표로 구분해 여러 개를 추가하거나, 전체를 한 번에 편집하거나, 원래 목록으로 되돌릴 수 있습니다. 떠 있는 패널은 접을 수 있고 마지막 상태를 기억하며, 스크립트 언어는 이 위쪽에서 고릅니다. 버튼 아래에는 검색 말고 오늘 Rewards가 요구하는 것들(연속 기록, 앱 체크인, 데일리 세트)이 목록으로 나오고, 남은 항목마다 링크가 붙습니다.',
            infoAuthor: '제작자:', infoGitHub: 'GitHub:', infoPrivacy: '개인정보:',
            infoPrivacyText: '키워드와 검색 카운터는 브라우저 안 사용자 스크립트 관리자의 로컬 저장소에만 보관됩니다. "내 Rewards 진행 상황 사용"이 켜져 있으면, 스크립트는 오늘의 진행 상황과 잔액, 교환 카탈로그를 읽기 위해 bing.com에 GET 요청을 보냅니다. Bing 머리글의 포인트 패널을 움직이는 것과 같은 엔드포인트이며, 사용자의 Bing 세션을 통해 전달됩니다. 그 내용이 제3자나 스크립트 제작자에게 가는 일은 없습니다. 이 체크를 끄면 스크립트는 자체적인 네트워크 요청을 전혀 하지 않습니다. 직접 입력했을 때와 똑같이 bing.com의 검색 주소로 이동할 뿐입니다. 그 목록에 나오는 오늘의 과제도 같은 응답에서 나오며, 읽은 내용은 Bing 페이지마다 다시 요청하지 않도록 로컬에도 보관합니다.',
            infoHow: '작동 방식:',
            infoHowText: '오늘 검색 포인트가 얼마나 남았는지 Rewards에 물어보고 필요한 만큼만 검색하며, Rewards가 완료로 표시하면 멈춥니다. 검색을 여러 번 해도 카운터가 오르지 않으면 30초쯤 기다렸다가 다시 확인하고 계속합니다. 대개는 Rewards가 늦게 적립할 뿐이기 때문입니다. 키워드 1~3개를 조합해 검색어를 만들고, 사람이 둘러보는 것처럼 보이도록 웹 검색(70%), 이미지, 동영상, 쇼핑, 뉴스를 번갈아 사용합니다. 지연 시간은 3~10초 사이에서 무작위이며, 결과를 읽는 것을 흉내 낸 10~25초의 휴지가 가끔 들어갑니다. 각 주소에는 Bing이 정상 트래픽으로 인식하는 순환 매개변수(form, cvid, PC)가 붙습니다. 모바일과 데스크톱은 자동으로 구분하고, 진행 상황은 페이지를 새로 고쳐도 유지되며, 카운터는 매일 자정에 초기화됩니다.'
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
            stalledTip: 'Kilka wyszukiwań pod rząd minęło bez wzrostu licznika Rewards. Prawie zawsze to opóźnienie: punkty przychodzą później. Skrypt czeka pół minuty, sprawdza ponownie i szuka dalej, aż ukończy dzień, nawet jeśli zajmie to więcej wyszukiwań niż zakładano. Jeśli wolisz przerwać, użyj ⏹.',
            capReached: 'Osiągnięto limit bezpieczeństwa',
            dailySetTip: 'Trzy dzisiejsze aktywności Rewards, osobne od wyszukiwań: liczą się do serii. Każdy odnośnik otwiera brakującą w nowej karcie. Jeśli trwają automatyczne wyszukiwania, po otwarciu zostają zatrzymane, żeby nie zabrały cię ze strony przed jej ukończeniem.',
            dailySet: 'Zestaw dzienny',
            streakDays: 'Seria dni z rzędu: {n}',
            streakTip: 'Każdy wiersz to osobna seria z siedmiu kroków: pierwsze sześć dni daje niewiele, a siódmy dużą premię. Znak ✓ oznacza, że na dziś już się liczy; pozostałe otwierają miejsce, gdzie się to robi.',
            offersTip: 'Dzisiejsze oferty punktowe spoza zestawu dziennego: tematy wyróżnione, stała oferta na każdy dzień tygodnia… Każdy odnośnik otwiera brakującą w nowej karcie. Jeśli trwają automatyczne wyszukiwania, po otwarciu zostają zatrzymane.',
            protectionTip: 'Pozostałe dni ochrony serii. Jeśli któregoś dnia nie ukończysz aktywności, Rewards zużyje jeden dzień, a Twoja seria nie zostanie przerwana.',
            todayPointsTip: 'Punkty zdobyte dziś ze wszystkich źródeł, nie tylko z wyszukiwań: zestaw dzienny, oferty, serie i bonusy. Z tego, co ten panel potrafi zmierzyć, jest dziś {n}; jeśli Twoja suma jest większa, to znaczy, że wykonałeś aktywności, których stąd nie widać — na przykład w aplikacji Bing, w Outlooku albo na Xboksie.',
            levelTip: 'Punkty zdobyte w okresie, na podstawie którego Rewards ustala Twój poziom, oraz tyle, ile wymaga do jego utrzymania. To nie jest miesiąc kalendarzowy: Rewards prowadzi ten okres po swojemu i nie podaje, kiedy się kończy. Poza punktami wymaga też ukończenia kilku aktywności, których się tu nie liczy.',
            extraOffersNote: 'Więcej aktywności w Rewards',
            extraOffersTip: 'W panelu Rewards i w aplikacji Bing zwykle są dodatkowe aktywności dające więcej punktów niż te. Nie zawsze są takie same: jedne to wyszukiwania, inne nie (układanki, pytania, ankiety).',
            bingAppNote: 'Więcej punktów w aplikacji Bing',
            bingAppTip: 'Aplikacja Bing ma aktywności punktowe, które można wykonać tylko tam: w serwisie Rewards są oznaczone jako „Zablokowana”, a tutaj nie pojawiają się wcale. Ten odnośnik prowadzi do jej pobrania.',
            xboxNote: 'Więcej punktów na Xbox',
            xboxTip: 'Xbox ma własne zadania dzienne, tygodniowe i miesięczne, dające punkty poza tymi. Nie widać ich ani tutaj, ani w panelu Rewards: naliczają się z aplikacji lub konsoli, więc tam trzeba zaglądać.',
            outlookNote: 'Misje w Outlooku',
            outlookTip: 'Outlook w przeglądarce ma misje punktowe, które widać tylko tam. Nie ma ich ani tutaj, ani w panelu Rewards, więc trzeba go otworzyć, żeby je zobaczyć i wykonać.',
            streakOffTip: 'Ta seria nie jest dostępna na twoim koncie: Microsoft oferuje je tylko wybranym użytkownikom i na wybranych rynkach. Stąd nie da się jej rozwinąć.',
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
            infoDescriptionText: 'Automatyzuje codzienne wyszukiwania w Bingu, aby zbierać punkty Microsoft Rewards bez ręcznej pracy. Skrypt pyta Microsoft Rewards, ile punktów za wyszukiwania brakuje ci dzisiaj, wykonuje tylko potrzebne wyszukiwania, sam się zatrzymuje po ich ukończeniu i pokazuje, ile twoje punkty są warte w środkach Xbox; liczba pod ⚙ zostaje na zastępstwo, gdy nie ma sesji Rewards. Liczbę wyszukiwań ustawia się przyciskiem ⚙ (1-100, domyślnie 20), a przyciski start / kontynuuj / zatrzymaj / wyzeruj zmieniają się zależnie od stanu. W zakładce słów kluczowych możesz usunąć każde jednym kliknięciem, dodać kilka oddzielonych przecinkami, zmienić wszystkie naraz albo przywrócić pierwotną listę. Pływający panel zwija się i pamięta, jak go zostawiłeś, a język skryptu wybiera się tutaj, na górze. Pod przyciskami jest lista tego, czego Rewards wymaga dziś poza wyszukiwaniami — seria, zameldowanie w aplikacji, zestaw dzienny — z odnośnikiem do każdej zaległej pozycji.',
            infoAuthor: 'Autor:', infoGitHub: 'GitHub:', infoPrivacy: 'Prywatność:',
            infoPrivacyText: 'Twoje słowa kluczowe i licznik wyszukiwań są zapisywane wyłącznie w pamięci lokalnej menedżera userscriptów, w twojej przeglądarce. Gdy włączone jest „Używaj mojego postępu Rewards”, skrypt wysyła żądanie GET do bing.com — do tego samego punktu, który zasila panel punktów w nagłówku Binga — aby odczytać twój dzisiejszy postęp, saldo i katalog wymiany; żądanie idzie przez twoją sesję Binga i nic z tego nie trafia do osób trzecich ani do autora skryptu. Odznacz to pole i skrypt nie wykona żadnych własnych żądań sieciowych: będzie tylko przechodził pod adresy wyszukiwania bing.com, dokładnie tak, jakbyś wpisał je sam. Zadania dnia z tej listy pochodzą z tej samej odpowiedzi, a to, co zostało odczytane, jest też zapisywane lokalnie, żeby nie pytać o nie na każdej stronie Binga.',
            infoHow: 'Jak to działa:',
            infoHowText: 'Skrypt pyta Rewards, ile punktów za wyszukiwania brakuje dzisiaj, i wykonuje tylko potrzebne, zatrzymując się, gdy Rewards oznaczy dzień jako ukończony; jeśli licznik nie rośnie przez kilka wyszukiwań pod rząd, skrypt czeka pół minuty, sprawdza ponownie i działa dalej, bo prawie zawsze Rewards po prostu nalicza z opóźnieniem. Tworzy zapytania, łącząc od 1 do 3 słów kluczowych, i przeplata wyszukiwanie w sieci (70%), grafiki, filmy, zakupy i wiadomości, żeby przypominało to przeglądanie przez człowieka. Opóźnienia są losowe w zakresie 3-10 s, z okazjonalnymi przerwami 10-25 s naśladującymi czytanie wyników. Każdy adres zawiera zmieniające się parametry (form, cvid, PC), które Bing traktuje jako zwykły ruch. Tryb mobilny i komputerowy jest rozpoznawany automatycznie, postęp przetrwa przeładowanie strony, a licznik zeruje się codziennie o północy.'
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
            stalledTip: 'Useita hakuja peräkkäin ilman että Rewards-laskuri nousi. Lähes aina kyse on viiveestä: pisteet tulevat myöhässä. Skripti odottaa puoli minuuttia, tarkistaa uudelleen ja jatkaa hakemista, kunnes päivä on valmis — vaikka se veisi enemmän hakuja kuin oli tarkoitus. Keskeytä ⏹-painikkeella.',
            capReached: 'Turvaraja saavutettu',
            dailySetTip: 'Päivän kolme Rewards-tehtävää, hauista erillään: ne kerryttävät putkea. Kukin linkki avaa puuttuvan tehtävän uuteen välilehteen. Jos automaattiset haut ovat käynnissä, ne pysähtyvät avattaessa, jotta ne eivät vie sinua pois sivulta ennen kuin saat sen valmiiksi.',
            dailySet: 'Päivän setti',
            streakDays: 'Putki: {n} päivää',
            streakTip: 'Kukin rivi on oma seitsenaskelinen putkensa: kuusi ensimmäistä päivää tuottavat vähän ja seitsemäs ison bonuksen. ✓ tarkoittaa, että tämä päivä on jo laskettu; muut avaavat paikan, jossa tehtävä tehdään.',
            offersTip: 'Päivän pistetarjoukset, jotka eivät kuulu päivän settiin: nostetut aiheet, kunkin viikonpäivän kiinteä tarjous… Kukin linkki avaa puuttuvan uuteen välilehteen. Jos automaattiset haut ovat käynnissä, ne pysähtyvät avattaessa.',
            protectionTip: 'Jäljellä olevat putken suojapäivät. Jos jonain päivänä et suorita tehtäviä, Rewards käyttää yhden eikä putkesi katkea.',
            todayPointsTip: 'Tänään kaikista lähteistä kertyneet pisteet, ei pelkästään hauista: päivän setti, tarjoukset, putket ja bonukset. Siitä, mitä tämä paneeli osaa mitata, tänään on {n}; jos summasi ylittää sen, olet tehnyt tehtäviä joita se ei näe — esimerkiksi Bing-sovelluksessa, Outlookissa tai Xboxilla.',
            levelTip: 'Pisteet, jotka olet kerännyt jaksolla, jonka perusteella Rewards määrittää tasosi, ja se, paljonko se vaatii tason säilyttämiseen. Kyse ei ole kalenterikuukaudesta: Rewards hoitaa jakson itse eikä kerro, milloin se päättyy. Pisteiden lisäksi se vaatii muutaman tehtävän suorittamista, joita ei lasketa tähän.',
            extraOffersNote: 'Lisää tehtäviä Rewardsissa',
            extraOffersTip: 'Rewards-koontinäytöllä ja Bing-sovelluksessa on yleensä lisätehtäviä, joista saa enemmän pisteitä kuin näistä. Ne eivät ole aina samoja: osa on hakuja, osa ei (palapelit, kysymykset, kyselyt).',
            bingAppNote: 'Lisää pisteitä Bing-sovelluksessa',
            bingAppTip: 'Bing-sovelluksessa on pistetehtäviä, jotka voi tehdä vain siellä: Rewards-sivustolla ne näkyvät ”Lukittuina”, eivätkä täällä lainkaan. Tämä linkki vie sen lataamiseen.',
            xboxNote: 'Lisää pisteitä Xboxissa',
            xboxTip: 'Xboxilla on omat päivittäiset, viikoittaiset ja kuukausittaiset tehtävänsä, joista saa pisteitä näiden lisäksi. Ne eivät näy täällä eivätkä Rewards-koontinäytöllä: ne kirjautuvat sovelluksesta tai konsolista, joten sieltä ne pitää katsoa.',
            outlookNote: 'Outlookin tehtävät',
            outlookTip: 'Selaimen Outlookissa on pistetehtäviä, jotka näkyvät vain siellä. Ne eivät näy täällä eivätkä Rewards-koontinäytöllä, joten se pitää avata, jotta ne näkee ja voi tehdä.',
            streakOffTip: 'Tämä putki ei ole käytettävissä tililläsi: Microsoft tarjoaa niitä vain tietyille jäsenille ja tietyillä markkinoilla. Täältä sitä ei voi edistää.',
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
            infoDescriptionText: 'Automatisoi päivittäiset Bing-haut, jotta Microsoft Rewards -pisteitä kertyy ilman käsityötä. Skripti kysyy Microsoft Rewardsilta, montako hakupistettä sinulta puuttuu tänään, tekee vain tarvittavat haut, pysähtyy itse kun ne on tehty ja näyttää, paljonko pisteesi ovat arvoltaan Xbox-saldona; ⚙-painikkeen luku jää varalle niitä tilanteita varten, joissa Rewards-istuntoa ei ole. Hakujen määrä säädetään ⚙-painikkeella (1-100, oletus 20), ja aloitus-, jatkamis-, pysäytys- ja nollauspainikkeet vaihtuvat tilan mukaan. Avainsanavälilehdellä voit poistaa jokaisen yhdellä napsautuksella, lisätä useita pilkulla eroteltuina, muokata kaikkia kerralla tai palauttaa alkuperäisen listan. Kelluva paneeli taittuu kokoon ja muistaa, mihin sen jätit, ja skriptin kieli valitaan täältä ylhäältä. Painikkeiden alla on lista siitä, mitä Rewards pyytää tänään hakujen lisäksi — putki, kirjautuminen sovelluksessa, päivän setti — ja linkki jokaiseen puuttuvaan.',
            infoAuthor: 'Tekijä:', infoGitHub: 'GitHub:', infoPrivacy: 'Tietosuoja:',
            infoPrivacyText: 'Avainsanasi ja hakulaskuri tallennetaan vain käyttäjäskriptien hallinnan paikalliseen tallennustilaan selaimessasi. Kun ”Käytä Rewards-edistymistäni” on käytössä, skripti tekee GET-pyynnön osoitteeseen bing.com — samaan päätepisteeseen, joka syöttää Bingin ylätunnisteen pistepaneelin — lukeakseen päivän edistymisen, saldosi ja lunastusluettelon; pyyntö kulkee Bing-istuntosi kautta, eikä mikään siitä mene kolmansille osapuolille tai skriptin tekijälle. Poista rasti ruudusta, niin skripti ei tee lainkaan omia verkkopyyntöjä: se vain siirtyy bing.comin hakuosoitteisiin täsmälleen kuten jos kirjoittaisit ne itse. Listan päivän tehtävät tulevat samasta vastauksesta, ja luettu tallennetaan myös paikallisesti, jottei sitä tarvitse pyytää joka Bing-sivulla.',
            infoHow: 'Miten se toimii:',
            infoHowText: 'Skripti kysyy Rewardsilta, montako hakupistettä tänään puuttuu, ja tekee vain tarvittavat haut pysähtyen, kun Rewards merkitsee päivän valmiiksi. Jos laskuri ei nouse usean haun aikana, skripti odottaa puoli minuuttia, tarkistaa uudelleen ja jatkaa, sillä lähes aina Rewards vain kirjaa pisteet myöhässä. Se muodostaa hakuja yhdistelemällä 1-3 avainsanaa ja vuorottelee verkkohaun (70 %), kuvien, videoiden, ostosten ja uutisten välillä jäljitelläkseen ihmisen selailua. Viiveet ovat satunnaisia 3-10 s, ja välillä tulee 10-25 s taukoja, jotka jäljittelevät tulosten lukemista. Jokaisessa osoitteessa on vaihtuvia parametreja (form, cvid, PC), jotka Bing tulkitsee tavalliseksi liikenteeksi. Mobiili ja työpöytä tunnistetaan automaattisesti, edistyminen säilyy sivun uudelleenlatausten yli ja laskuri nollautuu joka päivä keskiyöllä.'
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
            stalledTip: 'Nhiều lượt tìm liên tiếp mà bộ đếm Rewards không tăng. Hầu như luôn là do độ trễ: điểm về muộn. Tập lệnh chờ khoảng nửa phút, kiểm tra lại và tiếp tục tìm cho đến khi xong ngày, dù có tốn nhiều lượt tìm hơn dự kiến. Nếu muốn dừng, hãy bấm ⏹.',
            capReached: 'Đã tới giới hạn an toàn',
            dailySetTip: 'Ba hoạt động Rewards trong ngày, tách khỏi phần tìm kiếm: chúng được tính cho chuỗi ngày. Mỗi liên kết mở hoạt động còn thiếu trong tab mới. Nếu đang chạy tìm kiếm tự động, chúng sẽ dừng khi bạn mở, để không kéo bạn rời trang trước khi hoàn thành.',
            dailySet: 'Bộ nhiệm vụ hằng ngày',
            streakDays: 'Chuỗi: {n} ngày',
            streakTip: 'Mỗi dòng là một chuỗi bảy bước riêng: sáu ngày đầu trả ít, ngày thứ bảy trả phần lớn nhất. Dấu ✓ nghĩa là hôm nay đã được tính; các dòng còn lại mở nơi thực hiện.',
            offersTip: 'Các ưu đãi điểm trong ngày không thuộc bộ nhiệm vụ hằng ngày: chủ đề nổi bật, ưu đãi cố định của từng ngày trong tuần… Mỗi liên kết mở mục còn thiếu trong tab mới. Nếu đang chạy tìm kiếm tự động, chúng sẽ dừng khi bạn mở.',
            protectionTip: 'Số ngày bảo vệ chuỗi còn lại. Nếu một ngày bạn không hoàn thành các hoạt động, Rewards sẽ dùng một ngày và chuỗi của bạn không bị đứt.',
            todayPointsTip: 'Số điểm bạn kiếm được hôm nay từ mọi nguồn, không chỉ từ tìm kiếm: bộ nhiệm vụ hằng ngày, ưu đãi, chuỗi ngày và tiền thưởng. Trong phần bảng này đo được, hôm nay có {n}; nếu tổng của bạn vượt con số đó thì là do bạn đã làm những hoạt động không hiện ở đây, như trong ứng dụng Bing, Outlook hay Xbox.',
            levelTip: 'Số điểm bạn có trong kỳ mà Rewards dùng để xác định cấp của bạn, và số điểm cần để giữ cấp đó. Không phải tháng dương lịch: Rewards tự quản lý kỳ này và không cho biết khi nào kết thúc. Ngoài điểm, còn phải hoàn thành vài hoạt động nữa, không được tính ở đây.',
            extraOffersNote: 'Thêm hoạt động trong Rewards',
            extraOffersTip: 'Bảng điều khiển Rewards và ứng dụng Bing thường có thêm những hoạt động cho nhiều điểm hơn các mục này. Chúng không cố định: có cái là tìm kiếm, có cái không (xếp hình, câu hỏi, khảo sát).',
            bingAppNote: 'Thêm điểm trong ứng dụng Bing',
            bingAppTip: 'Ứng dụng Bing có các hoạt động tính điểm chỉ làm được ở đó: trên trang Rewards chúng hiện là «Đã khóa», còn ở đây không hiện chút nào. Liên kết này dẫn tới nơi tải ứng dụng.',
            xboxNote: 'Thêm điểm trên Xbox',
            xboxTip: 'Xbox có các nhiệm vụ ngày, tuần và tháng riêng, cho điểm ngoài những mục này. Chúng không hiện ở đây lẫn trong bảng điều khiển Rewards: điểm được cộng từ ứng dụng hoặc máy chơi game, nên phải xem ở đó.',
            outlookNote: 'Nhiệm vụ trong Outlook',
            outlookTip: 'Outlook trên trình duyệt có các nhiệm vụ tính điểm chỉ thấy được ở đó. Chúng không hiện ở đây lẫn trong bảng điều khiển Rewards, nên phải mở Outlook để xem và hoàn thành.',
            streakOffTip: 'Chuỗi này không khả dụng với tài khoản của bạn: Microsoft chỉ cung cấp cho một số thành viên và ở một số thị trường. Không thể tiến hành từ đây.',
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
            infoDescriptionText: 'Tự động hóa các lượt tìm kiếm hằng ngày trên Bing để tích điểm Microsoft Rewards mà không cần thao tác tay. Tập lệnh hỏi Microsoft Rewards xem hôm nay bạn còn thiếu bao nhiêu điểm tìm kiếm, chỉ chạy những lượt tìm cần thiết, tự dừng khi xong, và cho biết điểm của bạn quy ra bao nhiêu số dư Xbox; con số trong ⚙ vẫn còn đó để dự phòng cho lúc không có phiên Rewards. Số lượt tìm kiếm được đặt bằng ⚙ (1-100, mặc định 20) và các nút bắt đầu / tiếp tục / dừng / đặt lại thay đổi theo trạng thái. Trong thẻ từ khóa, bạn có thể xóa từng mục bằng một cú bấm, thêm nhiều mục cách nhau bằng dấu phẩy, sửa tất cả cùng lúc hoặc khôi phục danh sách ban đầu. Bảng nổi có thể thu gọn và nhớ trạng thái bạn để lại, còn ngôn ngữ của tập lệnh được chọn ở phía trên này. Bên dưới các nút là danh sách những gì Rewards yêu cầu hôm nay ngoài tìm kiếm — chuỗi ngày, việc điểm danh trong ứng dụng, bộ nhiệm vụ hằng ngày — kèm liên kết tới từng mục còn thiếu.',
            infoAuthor: 'Tác giả:', infoGitHub: 'GitHub:', infoPrivacy: 'Quyền riêng tư:',
            infoPrivacyText: 'Từ khóa và bộ đếm tìm kiếm của bạn chỉ được lưu trong bộ nhớ cục bộ của trình quản lý userscript, ngay trong trình duyệt. Khi bật «Dùng tiến độ Rewards của tôi», tập lệnh gửi một yêu cầu GET tới bing.com — cũng chính là điểm cuối đang chạy bảng điểm trên đầu trang Bing — để đọc tiến độ hôm nay, số dư của bạn và danh mục quy đổi; yêu cầu đi kèm phiên Bing của bạn, và không có phần nào trong đó tới bên thứ ba hay tới tác giả tập lệnh. Tắt ô đó thì tập lệnh không tự thực hiện bất kỳ yêu cầu mạng nào: nó chỉ điều hướng tới các địa chỉ tìm kiếm của bing.com, y như khi bạn tự gõ. Các nhiệm vụ trong ngày hiện ở danh sách đó cũng lấy từ chính phản hồi này, và những gì đọc được cũng lưu cục bộ để khỏi phải hỏi lại ở mỗi trang Bing.',
            infoHow: 'Cách hoạt động:',
            infoHowText: 'Tập lệnh hỏi Rewards xem hôm nay còn thiếu bao nhiêu điểm tìm kiếm và chỉ chạy những lượt cần thiết, dừng lại khi Rewards báo là đã xong ngày; nếu bộ đếm không tăng qua nhiều lượt tìm liên tiếp, nó chờ khoảng nửa phút, kiểm tra lại rồi đi tiếp, vì hầu như luôn chỉ là Rewards cộng điểm muộn. Tập lệnh tạo truy vấn bằng cách ghép 1 đến 3 từ khóa và luân phiên giữa tìm kiếm web (70%), hình ảnh, video, mua sắm và tin tức để mô phỏng việc duyệt web của con người. Độ trễ ngẫu nhiên từ 3-10 giây, thỉnh thoảng có quãng nghỉ 10-25 giây mô phỏng việc đọc kết quả. Mỗi địa chỉ đều kèm các tham số luân phiên (form, cvid, PC) mà Bing xem là lưu lượng hợp lệ. Chế độ di động hay máy tính được nhận diện tự động, tiến trình được giữ lại qua các lần tải lại trang và bộ đếm được đặt lại mỗi ngày vào nửa đêm.'
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
            stalledTip: '连续几次搜索后 Rewards 的计数都没有上涨。这几乎都是延迟，积分会晚一点到。脚本会等半分钟再看一次，并继续搜索直到当天完成，哪怕要多花几次搜索。想停下就按 ⏹。',
            capReached: '已达到安全上限',
            dailySetTip: '当天的三项 Rewards 活动，与搜索分开计算，会计入连续天数。每个链接会在新标签页中打开尚未完成的那一项。如果自动搜索正在进行，打开时会停止，以免在你完成之前把页面跳走。',
            dailySet: '每日任务',
            streakDays: '连续天数：{n} 天',
            streakTip: '每一行都是一个独立的七步连续记录：前六天给得少，第七天一次给足。✓ 表示今天这一份已经算上了，其余会打开完成任务的地方。',
            offersTip: '当天不属于每日任务的积分活动：专题推荐、每个星期几的固定活动等。每个链接会在新标签页中打开尚未完成的那一项。如果自动搜索正在进行，打开时会停止。',
            protectionTip: '剩余的连续天数保护天数。某天没有完成活动时，Rewards 会消耗一天，你的连续记录不会中断。',
            todayPointsTip: '今天从所有来源获得的积分，不只是搜索：每日任务、活动、连续天数和奖励。在本面板能统计到的范围内，今天共有 {n} 分；如果你的总数超过这个值，说明你完成了这里看不到的活动，比如 Bing 应用、Outlook 或 Xbox 里的。',
            levelTip: '你在 Rewards 用来判定等级的周期内获得的积分，以及保级所需的积分。这不是自然月：该周期由 Rewards 自行管理，也不会告知何时结束。除积分外还要求完成若干活动，这里没有计入。',
            extraOffersNote: 'Rewards 里还有更多活动',
            extraOffersTip: 'Rewards 面板和 Bing 应用里通常还有额外活动，给的分比这些多。它们并不固定：有的是搜索，有的不是（拼图、问答、问卷）。',
            bingAppNote: 'Bing 应用里还能拿更多分',
            bingAppTip: 'Bing 应用里有只能在那里完成的积分活动：在 Rewards 网站上它们显示为“已锁定”，这里则完全看不到。此链接可前往下载。',
            xboxNote: 'Xbox 里还能拿更多分',
            xboxTip: 'Xbox 有自己的每日、每周和每月任务，给的分和这些是分开的。这里和 Rewards 面板都看不到：它们从应用或主机上入账，只能到那边看。',
            outlookNote: 'Outlook 里的任务',
            outlookTip: '浏览器里的 Outlook 有只能在那里看到的积分任务。这里和 Rewards 面板都看不到，只能打开 Outlook 去看和完成。',
            streakOffTip: '这个连续记录在你的账户上不可用：微软只向部分会员、在部分市场提供。从这里无法推进。',
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
            infoDescriptionText: '自动完成每日的 Bing 搜索，无需手动操作即可累积 Microsoft Rewards 积分。脚本会向 Microsoft Rewards 查询你今天还差多少搜索积分，只执行必要的搜索，完成后自动停止，并显示你的积分折合多少 Xbox 余额；⚙ 里的次数则留作没有 Rewards 会话时的备用。搜索次数可用 ⚙ 设置（1-100，默认 20），开始／继续／停止／重置按钮会随状态变化。在关键词标签页中，你可以点击逐个删除、用逗号分隔一次添加多个、一次性编辑全部，或恢复原始列表。浮动面板可以折叠并记住你上次的状态，脚本语言就在上方选择。按钮下面会列出除搜索之外今天 Rewards 要求的事项（连续天数、在应用里登记、每日任务），未完成的都带链接。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隐私：',
            infoPrivacyText: '你的关键词和搜索计数器只保存在浏览器中用户脚本管理器的本地存储里。开启「使用我的 Rewards 进度」时，脚本会向 bing.com 发起一次 GET 请求，读取你今天的进度、余额和兑换目录；这个地址就是驱动 Bing 页首积分面板的同一个接口，请求随你的 Bing 会话发出，其中的内容不会流向任何第三方，也不会发给脚本作者。关掉这个勾选，脚本就不会发起任何自己的网络请求：它只是跳转到 bing.com 的搜索网址，和你自己输入完全一样。该列表里当天的任务也来自同一个响应，读到的内容同样保存在本地，以免每打开一个 Bing 页面就再问一次。',
            infoHow: '工作原理：',
            infoHowText: '脚本会向 Rewards 查询今天还差多少搜索积分，只做必要的那些，等 Rewards 把今天标记为已完成就停下；如果连续几次搜索计数都没上涨，它会等半分钟再看一次然后继续，因为多半只是 Rewards 发放得晚。 脚本会组合 1 到 3 个关键词生成查询，并在网页搜索（70%）、图片、视频、购物和资讯之间轮换，以模拟人类浏览。延迟在 3-10 秒之间随机，偶尔会有 10-25 秒的停顿来模拟阅读结果。每个网址都带有轮换参数（form、cvid、PC），Bing 会将其视为正常流量。脚本会自动识别移动端与桌面端，进度在页面重新加载后依然保留，计数器每天午夜重置。'
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
            stalledTip: 'مرّت عدة عمليات بحث متتالية دون أن يتحرك عدّاد Rewards. هذا في الغالب تأخّر في الاحتساب: النقاط تصل متأخرة. ينتظر البرنامج النصي نصف دقيقة، ثم يتحقق من جديد ويواصل البحث حتى يكتمل اليوم، ولو تطلّب ذلك عمليات بحث أكثر من المتوقع. وإن أردت الإيقاف، استخدم ⏹.',
            capReached: 'تم الوصول إلى حد الأمان',
            dailySetTip: 'أنشطة Rewards الثلاثة لليوم، منفصلة عن عمليات البحث، وتُحتسب لسلسلتك. يفتح كل رابط النشاط الناقص في علامة تبويب جديدة. وإذا كانت عمليات البحث التلقائية جارية، فإنها تتوقف عند فتحه، حتى لا تنقلك من الصفحة قبل إتمامه.',
            dailySet: 'المجموعة اليومية',
            streakDays: 'سلسلة الأيام المتتالية: {n}',
            streakTip: 'كل سطر سلسلة مستقلة من سبع خطوات: الأيام الستة الأولى تمنح القليل، واليوم السابع يمنح الجائزة الكبرى. وعلامة ✓ تعني أن نصيب اليوم محسوب بالفعل؛ أما البقية فتفتح المكان الذي تُنجَز فيه.',
            offersTip: 'عروض النقاط اليومية التي ليست جزءًا من المجموعة اليومية: الموضوعات المميزة، والعرض الثابت لكل يوم من أيام الأسبوع… يفتح كل رابط العرض الناقص في علامة تبويب جديدة. وإذا كانت عمليات البحث التلقائية جارية، فإنها تتوقف عند فتحه.',
            protectionTip: 'أيام حماية السلسلة المتبقية لديك. إذا لم تُكمل الأنشطة في يوم ما، يستهلك Rewards يومًا منها ولا تنكسر سلسلتك.',
            todayPointsTip: 'النقاط التي جمعتها اليوم من كل المصادر، وليس من عمليات البحث فقط: المجموعة اليومية والعروض والسلاسل والمكافآت. ومما تستطيع هذه اللوحة قياسه، يوجد اليوم {n}؛ فإذا تجاوز إجماليك ذلك فلأنك أنجزت أنشطة لا تظهر من هنا، مثل أنشطة تطبيق Bing أو Outlook أو Xbox.',
            levelTip: 'النقاط التي جمعتها في المدة التي يحدّد بها Rewards مستواك، وما يطلبه للحفاظ عليه. وهي ليست الشهر التقويمي: يدير Rewards تلك المدة بنفسه ولا يذكر متى تنتهي. وإلى جانب النقاط يطلب أيضًا إكمال بضعة أنشطة، لا تُحتسب هنا.',
            extraOffersNote: 'أنشطة أخرى في Rewards',
            extraOffersTip: 'عادةً ما توجد في لوحة Rewards وفي تطبيق Bing أنشطة إضافية تمنح نقاطًا أكثر من هذه. وهي ليست الأنشطة نفسها دائمًا: بعضها عمليات بحث وبعضها لا (ألغاز وأسئلة واستطلاعات).',
            bingAppNote: 'نقاط أكثر في تطبيق Bing',
            bingAppTip: 'في تطبيق Bing أنشطة نقاط لا يمكن إنجازها إلا هناك: تظهر في موقع Rewards بعلامة «مقفلة»، ولا تظهر هنا إطلاقًا. يقودك هذا الرابط إلى تنزيله.',
            xboxNote: 'نقاط أكثر في Xbox',
            xboxTip: 'لدى Xbox مهامها اليومية والأسبوعية والشهرية الخاصة، وهي تمنح نقاطًا إضافية غير هذه. لا تظهر هنا ولا في لوحة Rewards: تُضاف من التطبيق أو من الجهاز، ولذلك يجب مراجعتها هناك.',
            outlookNote: 'مهام في Outlook',
            outlookTip: 'لدى Outlook في المتصفح مهام نقاط لا تظهر إلا هناك. لا تظهر هنا ولا في لوحة Rewards، لذلك يجب فتحه لرؤيتها وإكمالها.',
            streakOffTip: 'هذه السلسلة غير متاحة في حسابك: تقدّمها Microsoft لأعضاء محدّدين وفي أسواق محدّدة فقط. ولا يمكن التقدّم فيها من هنا.',
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
            infoDescriptionText: 'يؤتمت عمليات البحث اليومية في Bing لتجميع نقاط Microsoft Rewards دون تدخل يدوي. يسأل البرنامج النصي Microsoft Rewards عن عدد نقاط البحث الناقصة اليوم، وينفّذ عمليات البحث اللازمة فقط، ويتوقّف من تلقاء نفسه عند إتمامها، ويعرض قيمة نقاطك كرصيد Xbox؛ ويبقى العدد الموجود في ⚙ بديلًا للحالات التي لا توجد فيها جلسة Rewards. يُضبط عدد عمليات البحث بزر ⚙ (من 1 إلى 100، والافتراضي 20)، وتتغيّر أزرار البدء والمتابعة والإيقاف والتصفير بحسب الحالة. في تبويب الكلمات المفتاحية يمكنك حذف كل واحدة بنقرة، أو إضافة عدة كلمات مفصولة بفواصل، أو تحريرها كلها دفعة واحدة، أو استعادة القائمة الأصلية. تُطوى اللوحة العائمة وتتذكّر الوضع الذي تركتها عليه، ولغة البرنامج النصي تُختار من هنا في الأعلى. وتحت الأزرار قائمة بما تطلبه Rewards اليوم إلى جانب عمليات البحث — السلسلة، والتسجيل في التطبيق، والمجموعة اليومية — مع رابط لكل ما لم يكتمل بعد.',
            infoAuthor: 'المؤلف:', infoGitHub: 'GitHub:', infoPrivacy: 'الخصوصية:',
            infoPrivacyText: 'تُحفظ كلماتك المفتاحية وعدّاد البحث في التخزين المحلي لمدير البرامج النصية داخل متصفحك فقط. وعند تشغيل «استخدام تقدّمي في Rewards» يُجري البرنامج النصي طلب GET إلى bing.com — وهو نفس نقطة الوصول التي تُغذّي لوحة النقاط في رأس صفحة Bing — لقراءة تقدّمك اليومي ورصيدك وكتالوج الاستبدال؛ ويمرّ الطلب عبر جلسة Bing الخاصة بك، ولا يذهب أي من ذلك إلى أطراف أخرى ولا إلى مؤلف البرنامج النصي. أوقف ذلك المربع فلا يُجري البرنامج النصي أي طلب شبكة خاص به: فهو ينتقل إلى عناوين بحث bing.com فقط، تمامًا كما لو كتبتها بنفسك. ومهام اليوم الظاهرة في تلك القائمة تأتي من الاستجابة نفسها، وما يُقرأ يُحفظ محليًا أيضًا حتى لا يُطلب من جديد في كل صفحة من Bing.',
            infoHow: 'كيف يعمل:',
            infoHowText: 'يسأل البرنامج النصي Rewards عن عدد نقاط البحث الناقصة اليوم وينفّذ اللازم منها فقط، ويتوقّف عندما تعلن Rewards أن اليوم مكتمل؛ وإن لم يتحرّك العدّاد خلال عدة عمليات بحث متتالية، انتظر نصف دقيقة ثم تحقّق من جديد وواصل، فذلك في الغالب مجرد تأخّر من Rewards في الاحتساب. يبني الاستعلامات بدمج كلمة إلى ثلاث كلمات مفتاحية، ويتنقّل بين بحث الويب (70%) والصور والفيديو والتسوق والأخبار لمحاكاة تصفّح بشري. والمهل عشوائية بين 3 و10 ثوانٍ، مع وقفات عارضة من 10 إلى 25 ثانية تحاكي قراءة النتائج. ويحمل كل رابط معاملات متبدّلة (form وcvid وPC) يعدّها Bing حركة مرور طبيعية. ويكتشف الهاتف أو الحاسب تلقائيًا، ويبقى التقدّم بعد إعادة تحميل الصفحة، ويُصفَّر العدّاد كل يوم عند منتصف الليل.'
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
            stalledTip: 'लगातार कई खोजें हुईं पर Rewards का काउंटर नहीं बढ़ा। यह लगभग हमेशा देरी होती है: अंक बाद में जुड़ते हैं। स्क्रिप्ट आधा मिनट रुकती है, फिर से देखती है और दिन पूरा होने तक खोजती रहती है, भले ही सोच से ज़्यादा खोजें लगें। रोकना हो तो ⏹ दबाएँ।',
            capReached: 'सुरक्षा सीमा पर पहुँच गए',
            dailySetTip: 'आज की तीन Rewards गतिविधियाँ, खोजों से अलग: ये आपकी लगातार दिनों की गिनती में जुड़ती हैं। हर लिंक बाकी गतिविधि को नए टैब में खोलता है। अगर स्वचालित खोजें चल रही हों, तो खोलते ही वे रुक जाती हैं, ताकि पूरा करने से पहले वे आपको पेज से हटा न दें।',
            dailySet: 'दैनिक सेट',
            streakDays: 'लगातार दिनों की शृंखला: {n}',
            streakTip: 'हर पंक्ति सात चरणों की अलग शृंखला है: पहले छह दिन थोड़े अंक देते हैं और सातवाँ दिन बड़ा बोनस। ✓ का मतलब है कि आज का हिस्सा पहले ही गिना जा चुका है; बाकी पंक्तियाँ वह जगह खोलती हैं जहाँ यह किया जाता है।',
            offersTip: 'दिन के वे पॉइंट ऑफ़र जो दैनिक सेट का हिस्सा नहीं हैं: विशेष विषय, सप्ताह के हर दिन का तय ऑफ़र… हर लिंक बाकी ऑफ़र को नए टैब में खोलता है। अगर स्वचालित खोजें चल रही हों, तो खोलते ही वे रुक जाती हैं।',
            protectionTip: 'आपके पास बची हुई स्ट्रीक सुरक्षा के दिन। किसी दिन गतिविधियाँ पूरी न होने पर Rewards एक दिन खर्च कर देता है और आपकी स्ट्रीक नहीं टूटती।',
            todayPointsTip: 'आज सभी स्रोतों से मिले पॉइंट, सिर्फ़ खोजों से नहीं: दैनिक सेट, ऑफ़र, स्ट्रीक और बोनस। यह पैनल जितना माप सकता है, उसमें आज {n} पॉइंट हैं; अगर आपका कुल इससे ज़्यादा है तो इसका मतलब है कि आपने ऐसी गतिविधियाँ की हैं जो यहाँ नहीं दिखतीं, जैसे Bing ऐप, Outlook या Xbox वाली।',
            levelTip: 'उस अवधि में मिले पॉइंट जिससे Rewards आपका स्तर तय करता है, और उसे बनाए रखने के लिए माँगे जाने वाले पॉइंट। यह कैलेंडर का महीना नहीं है: यह अवधि Rewards खुद चलाता है और यह नहीं बताता कि वह कब खत्म होती है। पॉइंट के अलावा कुछ गतिविधियाँ पूरी करने को भी कहता है, जो यहाँ नहीं गिनी जातीं।',
            extraOffersNote: 'Rewards में और गतिविधियाँ',
            extraOffersTip: 'Rewards के पैनल और Bing ऐप में आम तौर पर अतिरिक्त गतिविधियाँ होती हैं जो इनसे ज़्यादा अंक देती हैं। वे हमेशा एक जैसी नहीं होतीं: कुछ खोजें होती हैं और कुछ नहीं (पहेलियाँ, सवाल, सर्वेक्षण)।',
            bingAppNote: 'Bing ऐप में और अंक',
            bingAppTip: 'Bing ऐप में ऐसी अंक-गतिविधियाँ हैं जो सिर्फ़ वहीं की जा सकती हैं: Rewards की वेबसाइट पर वे «लॉक» दिखती हैं और यहाँ बिल्कुल नहीं दिखतीं। यह लिंक उसे डाउनलोड करने ले जाता है।',
            xboxNote: 'Xbox पर और अंक',
            xboxTip: 'Xbox की अपनी दैनिक, साप्ताहिक और मासिक गतिविधियाँ हैं, जो इनके अलावा अंक देती हैं। वे न यहाँ दिखती हैं और न Rewards के पैनल में: वे ऐप या कंसोल से जुड़ती हैं, इसलिए उन्हें वहीं देखना पड़ता है।',
            outlookNote: 'Outlook में मिशन',
            outlookTip: 'ब्राउज़र के Outlook में अंक-गतिविधियाँ हैं जो सिर्फ़ वहीं दिखती हैं। वे न यहाँ दिखती हैं और न Rewards के पैनल में, इसलिए उन्हें देखने और पूरा करने के लिए Outlook खोलना पड़ता है।',
            streakOffTip: 'यह शृंखला आपके खाते में उपलब्ध नहीं है: Microsoft इन्हें सिर्फ़ कुछ सदस्यों को और कुछ बाज़ारों में देता है। यहाँ से इसे आगे नहीं बढ़ाया जा सकता।',
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
            infoDescriptionText: 'बिना हाथ लगाए Microsoft Rewards अंक जमा करने के लिए Bing की रोज़ाना खोजों को स्वचालित करती है। स्क्रिप्ट Microsoft Rewards से पूछती है कि आज आपके कितने खोज-अंक बाकी हैं, सिर्फ़ ज़रूरी खोजें करती है, पूरा होने पर खुद रुक जाती है, और बताती है कि आपके अंक Xbox बैलेंस में कितने बनते हैं; ⚙ में दी गई संख्या उन मौकों के लिए बची रहती है जब Rewards का सत्र न हो। खोजों की संख्या ⚙ से तय होती है (1-100, डिफ़ॉल्ट 20) और शुरू / जारी रखें / रोकें / रीसेट के बटन स्थिति के अनुसार बदलते हैं। मुख्य शब्दों वाले टैब में आप हर एक को एक क्लिक से हटा सकते हैं, अल्पविराम से अलग करके कई जोड़ सकते हैं, सबको एक साथ संपादित कर सकते हैं या मूल सूची बहाल कर सकते हैं। तैरता पैनल मुड़ जाता है और जैसा आपने छोड़ा था वैसा याद रखता है, और स्क्रिप्ट की भाषा यहीं ऊपर चुनी जाती है। बटनों के नीचे उन चीज़ों की सूची रहती है जो Rewards आज खोजों के अलावा माँगता है — शृंखला, ऐप में हाज़िरी, दैनिक सेट — और हर बाकी चीज़ का लिंक।',
            infoAuthor: 'लेखक:', infoGitHub: 'GitHub:', infoPrivacy: 'निजता:',
            infoPrivacyText: 'आपके कीवर्ड और खोज काउंटर सिर्फ़ आपके ब्राउज़र में यूज़रस्क्रिप्ट मैनेजर के लोकल स्टोरेज में रखे जाते हैं। जब «मेरी Rewards प्रगति इस्तेमाल करें» चालू हो, तो स्क्रिप्ट आज की प्रगति, आपका बैलेंस और भुनाने का कैटलॉग पढ़ने के लिए bing.com को एक GET अनुरोध भेजती है; यह वही एंडपॉइंट है जो Bing के हेडर वाले अंक पैनल को चलाता है, और अनुरोध आपके Bing सत्र के साथ जाता है। इसमें से कुछ भी किसी तीसरे पक्ष या स्क्रिप्ट के लेखक तक नहीं जाता। यह चेकबॉक्स बंद कर दें और स्क्रिप्ट अपनी कोई भी नेटवर्क अनुरोध नहीं करती: वह सिर्फ़ bing.com के खोज URL पर जाती है, ठीक जैसे आप खुद टाइप करते। उस सूची में दिखने वाले आज के काम भी इसी उत्तर से आते हैं, और पढ़ा हुआ स्थानीय रूप से भी रखा जाता है ताकि Bing के हर पृष्ठ पर दोबारा न माँगना पड़े।',
            infoHow: 'यह कैसे काम करती है:',
            infoHowText: 'स्क्रिप्ट Rewards से पूछती है कि आज कितने खोज-अंक बाकी हैं और सिर्फ़ ज़रूरी खोजें करती है, और जब Rewards दिन को पूरा बता देता है तो रुक जाती है; अगर लगातार कई खोजों में काउंटर न बढ़े, तो यह आधा मिनट रुककर फिर देखती है और आगे बढ़ती है, क्योंकि लगभग हमेशा Rewards देर से अंक जोड़ता है। यह 1 से 3 मुख्य शब्दों को मिलाकर क्वेरी बनाती है और मानवीय ब्राउज़िंग जैसा दिखाने के लिए वेब खोज (70%), छवियों, वीडियो, शॉपिंग और समाचार के बीच बारी-बारी से चलती है। विलंब 3-10 सेकंड के बीच यादृच्छिक होते हैं, और बीच-बीच में 10-25 सेकंड के ठहराव आते हैं जो परिणाम पढ़ने जैसा प्रभाव देते हैं। हर पते में बदलते हुए पैरामीटर (form, cvid, PC) होते हैं जिन्हें Bing सामान्य ट्रैफ़िक मानता है। मोबाइल और डेस्कटॉप की पहचान अपने आप होती है, प्रगति पृष्ठ फिर से लोड होने पर भी बनी रहती है, और काउंटर हर दिन आधी रात को रीसेट हो जाता है।'
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
            stalledTip: 'Beberapa penelusuran berturut-turut tanpa penghitung Rewards bertambah. Hampir selalu ini soal keterlambatan: poinnya datang belakangan. Skrip menunggu setengah menit, memeriksa lagi, dan terus menelusuri sampai hari itu selesai, sekalipun butuh lebih banyak penelusuran dari perkiraan. Kalau ingin berhenti, pakai ⏹.',
            capReached: 'Batas keamanan tercapai',
            dailySetTip: 'Tiga aktivitas Rewards hari ini, terpisah dari penelusuran: semuanya dihitung untuk runtunan Anda. Setiap tautan membuka aktivitas yang belum selesai di tab baru. Jika penelusuran otomatis sedang berjalan, semuanya berhenti saat Anda membukanya, supaya tidak memindahkan Anda dari halaman sebelum selesai.',
            dailySet: 'Set harian',
            streakDays: 'Runtunan: {n} hari',
            streakTip: 'Setiap baris adalah runtunan tujuh langkah tersendiri: enam hari pertama memberi sedikit dan hari ketujuh memberi hadiah besarnya. Tanda ✓ berarti bagian hari ini sudah dihitung; sisanya membuka tempat mengerjakannya.',
            offersTip: 'Penawaran poin hari ini yang bukan bagian dari set harian: topik pilihan, penawaran tetap untuk tiap hari dalam seminggu… Setiap tautan membuka yang belum selesai di tab baru. Jika penelusuran otomatis sedang berjalan, semuanya berhenti saat Anda membukanya.',
            protectionTip: 'Sisa hari perlindungan runtunan Anda. Jika suatu hari Anda tidak menyelesaikan aktivitas, Rewards memakai satu hari dan runtunan Anda tidak putus.',
            todayPointsTip: 'Poin yang Anda peroleh hari ini dari semua sumber, bukan hanya penelusuran: set harian, penawaran, runtunan, dan bonus. Dari yang bisa diukur panel ini, hari ini ada {n}; jika total Anda melebihinya, berarti Anda mengerjakan aktivitas yang tidak terlihat dari sini, seperti di aplikasi Bing, Outlook, atau Xbox.',
            levelTip: 'Poin yang Anda kumpulkan dalam periode yang dipakai Rewards untuk menentukan level Anda, dan berapa yang diminta untuk mempertahankannya. Bukan bulan kalender: Rewards mengelola periode itu sendiri dan tidak memberitahu kapan berakhir. Selain poin, ia juga meminta beberapa aktivitas diselesaikan, yang tidak dihitung di sini.',
            extraOffersNote: 'Aktivitas lain di Rewards',
            extraOffersTip: 'Di dasbor Rewards dan aplikasi Bing biasanya ada aktivitas tambahan yang memberi lebih banyak poin daripada ini. Tidak selalu sama: sebagian berupa penelusuran dan sebagian bukan (teka-teki, pertanyaan, jajak pendapat).',
            bingAppNote: 'Lebih banyak poin di aplikasi Bing',
            bingAppTip: 'Aplikasi Bing punya aktivitas poin yang hanya bisa dikerjakan di sana: di situs Rewards ditandai «Terkunci», dan di sini tidak muncul sama sekali. Tautan ini menuju unduhannya.',
            xboxNote: 'Lebih banyak poin di Xbox',
            xboxTip: 'Xbox punya tugas harian, mingguan, dan bulanannya sendiri, yang memberi poin di luar yang ini. Semuanya tidak muncul di sini maupun di dasbor Rewards: poinnya masuk dari aplikasi atau konsol, jadi harus dilihat di sana.',
            outlookNote: 'Misi di Outlook',
            outlookTip: 'Outlook di peramban punya misi poin yang hanya terlihat di sana. Semuanya tidak muncul di sini maupun di dasbor Rewards, jadi harus dibuka untuk dilihat dan diselesaikan.',
            streakOffTip: 'Runtunan ini tidak tersedia di akun Anda: Microsoft hanya menawarkannya kepada anggota tertentu dan di pasar tertentu. Dari sini tidak bisa dilanjutkan.',
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
            infoDescriptionText: 'Mengotomatiskan pencarian harian di Bing untuk mengumpulkan poin Microsoft Rewards tanpa campur tangan manual. Skrip menanyakan ke Microsoft Rewards berapa poin penelusuran yang masih Anda kurang hari ini, menjalankan hanya penelusuran yang perlu, berhenti sendiri setelah selesai, dan menampilkan nilai poin Anda dalam saldo Xbox; angka pada ⚙ tetap ada sebagai cadangan untuk saat tidak ada sesi Rewards. Jumlah pencarian diatur dengan ⚙ (1-100, bawaan 20) dan tombol mulai / lanjutkan / hentikan / setel ulang berubah sesuai keadaan. Di tab kata kunci Anda bisa menghapus tiap kata dengan sekali klik, menambahkan beberapa sekaligus dipisahkan koma, menyunting semuanya sekaligus, atau mengembalikan daftar aslinya. Panel mengambang bisa dilipat dan mengingat posisi terakhir Anda, dan bahasa skrip dipilih di bagian atas ini. Di bawah tombol ada daftar hal yang diminta Rewards hari ini selain penelusuran — runtunan, absen di aplikasi, set harian — dengan tautan ke setiap yang belum selesai.',
            infoAuthor: 'Penulis:', infoGitHub: 'GitHub:', infoPrivacy: 'Privasi:',
            infoPrivacyText: 'Kata kunci Anda dan penghitung penelusuran hanya disimpan di penyimpanan lokal pengelola userscript, di peramban Anda. Bila «Gunakan progres Rewards saya» aktif, skrip membuat satu permintaan GET ke bing.com — titik akhir yang sama yang menggerakkan panel poin di kepala halaman Bing — untuk membaca progres hari ini, saldo Anda, dan katalog penukaran; permintaan itu berjalan lewat sesi Bing Anda, dan tidak ada bagian darinya yang pergi ke pihak ketiga maupun ke penulis skrip. Matikan kotak itu dan skrip tidak membuat permintaan jaringan apa pun sendiri: ia hanya membuka URL penelusuran bing.com, persis seperti kalau Anda mengetiknya sendiri. Tugas hari ini yang tampil di daftar itu berasal dari respons yang sama, dan apa yang dibaca juga disimpan secara lokal agar tidak diminta ulang di setiap halaman Bing.',
            infoHow: 'Cara kerjanya:',
            infoHowText: 'Skrip menanyakan ke Rewards berapa poin penelusuran yang masih kurang hari ini dan menjalankan hanya yang perlu, lalu berhenti saat Rewards menandai hari ini selesai; jika penghitung tidak bertambah selama beberapa penelusuran berturut-turut, skrip menunggu setengah menit, memeriksa lagi, lalu melanjutkan, karena hampir selalu Rewards hanya terlambat memberi poin. Skrip menyusun kueri dengan menggabungkan 1 sampai 3 kata kunci dan bergantian antara pencarian web (70%), gambar, video, belanja, dan berita untuk menyerupai penjelajahan manusia. Jedanya acak antara 3-10 detik, dengan rehat sesekali 10-25 detik yang meniru pembacaan hasil. Setiap URL memuat parameter yang berganti-ganti (form, cvid, PC) yang dikenali Bing sebagai lalu lintas wajar. Mode seluler dan desktop dideteksi otomatis, kemajuan bertahan melewati pemuatan ulang halaman, dan penghitung disetel ulang setiap hari pada tengah malam.'
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
            stalledTip: 'Diverse ricerche di seguito senza che il contatore Rewards salisse. Quasi sempre è latenza: i punti arrivano in ritardo. Lo script aspetta mezzo minuto, ricontrolla e continua a cercare finché la giornata non è completa, anche se servono più ricerche del previsto. Se preferisci fermarlo, usa ⏹.',
            capReached: 'Limite di sicurezza raggiunto',
            dailySetTip: 'Le tre attività Rewards del giorno, separate dalle ricerche: contano per la tua serie. Ogni collegamento apre in una nuova scheda quella che manca. Se ci sono ricerche automatiche in corso, si fermano all’apertura, così non ti portano via dalla pagina prima di averla completata.',
            dailySet: 'Set giornaliero',
            streakDays: 'Serie: {n} giorni',
            streakTip: 'Ogni riga è una serie a sé di sette passi: i primi sei giorni rendono poco e il settimo dà il premio grosso. Il ✓ è ciò che oggi conta già; il resto apre il punto in cui si fa.',
            offersTip: 'Le offerte di punti del giorno che non fanno parte del set giornaliero: temi in evidenza, l’offerta fissa di ogni giorno della settimana… Ogni collegamento apre in una nuova scheda quella che manca. Se ci sono ricerche automatiche in corso, si fermano all’apertura.',
            protectionTip: 'Giorni di protezione della serie che ti restano. Se un giorno non completi le attività, Rewards ne consuma uno e la tua serie non si interrompe.',
            todayPointsTip: 'I punti che hai accumulato oggi da tutte le fonti, non solo dalle ricerche: set giornaliero, offerte, serie e bonus. Di quello che questo pannello sa misurare, oggi ce ne sono {n}; se il tuo totale lo supera è perché hai fatto attività che da qui non si vedono, come quelle dell’app Bing, di Outlook o di Xbox.',
            levelTip: 'I punti accumulati nel periodo con cui Rewards stabilisce il tuo livello, e quanti ne chiede per mantenerlo. Non è il mese solare: Rewards gestisce quel periodo per conto suo e non dice quando si chiude. Oltre ai punti chiede anche di completare alcune attività, che qui non vengono conteggiate.',
            extraOffersNote: 'Altre attività in Rewards',
            extraOffersTip: 'Nel pannello Rewards e nell’app Bing di solito ci sono attività extra che danno più punti di queste. Non sono sempre le stesse: alcune sono ricerche e altre no (rompicapi, domande, sondaggi).',
            bingAppNote: 'Più punti nell’app Bing',
            bingAppTip: 'L’app Bing ha attività a punti che si fanno solo lì: sul sito Rewards compaiono come «Bloccata» e qui non compaiono affatto. Questo collegamento porta a scaricarla.',
            xboxNote: 'Più punti su Xbox',
            xboxTip: 'Xbox ha le sue attività giornaliere, settimanali e mensili, che danno punti oltre a queste. Non compaiono né qui né nel pannello Rewards: vengono accreditate dall’app o dalla console, quindi è lì che bisogna guardare.',
            outlookNote: 'Missioni in Outlook',
            outlookTip: 'Outlook nel browser ha missioni a punti che si vedono solo lì. Non compaiono né qui né nel pannello Rewards, quindi bisogna aprirlo per vederle e completarle.',
            streakOffTip: 'Questa serie non è disponibile sul tuo account: Microsoft le offre solo ad alcuni membri e in alcuni mercati. Da qui non si può portare avanti.',
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
            infoDescriptionText: 'Automatizza le ricerche quotidiane su Bing per accumulare punti Microsoft Rewards senza interventi manuali. Chiede a Microsoft Rewards quanti punti ricerca ti mancano oggi, esegue solo le ricerche necessarie, si ferma da sé quando sono finite e mostra quanto valgono i tuoi punti in credito Xbox; il numero sotto ⚙ resta come riserva per quando non c’è una sessione Rewards. Il numero di ricerche si imposta con ⚙ (1-100, valore predefinito 20) e i comandi avvia / riprendi / ferma / azzera cambiano a seconda dello stato. Nella scheda delle parole chiave puoi eliminarne una con un clic, aggiungerne diverse separate da virgole, modificarle tutte in una volta o ripristinare l’elenco originale. Il pannello flottante si richiude e ricorda come lo hai lasciato, e la lingua dello script si sceglie qui in alto. Sotto i comandi c’è un elenco di ciò che Rewards chiede oggi oltre alle ricerche — la serie, la registrazione nell’app, il set giornaliero — con un collegamento a tutto quello che manca.',
            infoAuthor: 'Autore:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Le tue parole chiave e il contatore delle ricerche sono salvati solo nella memoria locale del gestore di userscript, nel tuo browser. Con «Usa i miei progressi Rewards» attivo, lo script invia una richiesta GET a bing.com — lo stesso endpoint che alimenta il pannello dei punti nell’intestazione di Bing — per leggere i progressi della giornata, il tuo saldo e il catalogo di conversione; passa dalla tua sessione Bing e nulla di tutto ciò va a terzi né all’autore dello script. Disattiva quella casella e lo script non effettua nessuna richiesta di rete propria: si limita a navigare verso URL di ricerca di bing.com, esattamente come se le digitassi tu. Le attività del giorno mostrate in quell’elenco vengono dalla stessa risposta, e quanto letto resta salvato anche in locale per non richiederlo a ogni pagina di Bing.',
            infoHow: 'Come funziona:',
            infoHowText: 'Chiede a Rewards quanti punti ricerca mancano oggi ed esegue solo quelle necessarie, fermandosi quando Rewards segna la giornata come completata; se il contatore non sale per diverse ricerche di seguito, aspetta mezzo minuto, ricontrolla e prosegue, perché quasi sempre è Rewards che accredita in ritardo. Genera query combinando da 1 a 3 parole chiave e alterna tra ricerca web (70%), immagini, video, shopping e notizie per simulare una navigazione umana. Gli intervalli sono casuali tra 3 e 10 s, con pause occasionali di 10-25 s che imitano la lettura dei risultati. Ogni indirizzo include parametri a rotazione (form, cvid, PC) che Bing riconosce come traffico legittimo. Rileva automaticamente mobile o desktop, l’avanzamento sopravvive ai ricaricamenti della pagina e il contatore si azzera ogni giorno a mezzanotte.'
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
            stalledTip: 'Meerdere zoekopdrachten op rij zonder dat de Rewards-teller omhoogging. Bijna altijd is het vertraging: de punten komen later binnen. Het script wacht een halve minuut, kijkt opnieuw en blijft zoeken tot de dag rond is, ook als dat meer zoekopdrachten kost dan verwacht. Wil je stoppen, gebruik dan ⏹.',
            capReached: 'Veiligheidslimiet bereikt',
            dailySetTip: 'De drie Rewards-activiteiten van de dag, los van de zoekopdrachten: ze tellen mee voor je reeks. Elke link opent een openstaande activiteit in een nieuw tabblad. Lopen er automatische zoekopdrachten, dan stoppen die bij het openen, zodat ze je niet van de pagina halen voordat je klaar bent.',
            dailySet: 'Dagelijkse set',
            streakDays: 'Reeks: {n} dagen',
            streakTip: 'Elke regel is een eigen reeks van zeven stappen: de eerste zes dagen leveren weinig op en de zevende de grote bonus. Een ✓ telt vandaag al mee; de rest opent de plek waar je het doet.',
            offersTip: 'De puntenaanbiedingen van de dag die niet bij de dagelijkse set horen: uitgelichte onderwerpen, de vaste aanbieding van elke weekdag… Elke link opent een openstaande in een nieuw tabblad. Lopen er automatische zoekopdrachten, dan stoppen die bij het openen.',
            protectionTip: 'Resterende dagen reeksbescherming. Rond je op een dag de activiteiten niet af, dan gebruikt Rewards er één en blijft je reeks intact.',
            todayPointsTip: 'De punten die je vandaag uit alle bronnen hebt verdiend, niet alleen uit zoekopdrachten: dagelijkse set, aanbiedingen, reeksen en bonussen. Van wat dit paneel kan meten zijn er vandaag {n}; ligt jouw totaal hoger, dan heb je activiteiten gedaan die het niet ziet, zoals die in de Bing-app, Outlook of Xbox.',
            levelTip: 'De punten die je hebt in de periode waarmee Rewards je niveau bepaalt, en hoeveel het vraagt om dat te behouden. Het is niet de kalendermaand: Rewards beheert die periode zelf en zegt niet wanneer die afloopt. Naast de punten vraagt het ook een paar activiteiten af te ronden, die hier niet worden meegeteld.',
            extraOffersNote: 'Meer activiteiten in Rewards',
            extraOffersTip: 'In het Rewards-dashboard en de Bing-app staan meestal extra activiteiten die meer punten opleveren dan deze. Ze zijn niet altijd hetzelfde: sommige zijn zoekopdrachten en andere niet (puzzels, vragen, peilingen).',
            bingAppNote: 'Meer punten in de Bing-app',
            bingAppTip: 'De Bing-app heeft puntenactiviteiten die je alleen daar kunt doen: op de Rewards-site staan ze als "Vergrendeld" en hier verschijnen ze helemaal niet. Deze link leidt naar de download.',
            xboxNote: 'Meer punten op Xbox',
            xboxTip: 'Xbox heeft eigen dagelijkse, wekelijkse en maandelijkse opdrachten, die punten opleveren naast deze. Ze staan niet hier en ook niet in het Rewards-dashboard: ze worden vanuit de app of de console bijgeschreven, dus daar moet je kijken.',
            outlookNote: 'Missies in Outlook',
            outlookTip: 'Outlook in de browser heeft puntenmissies die je alleen daar ziet. Ze staan niet hier en ook niet in het Rewards-dashboard, dus je moet het openen om ze te zien en te doen.',
            streakOffTip: 'Deze reeks is niet beschikbaar op je account: Microsoft biedt ze alleen aan bepaalde leden en in bepaalde markten aan. Vanaf hier valt er niets aan te doen.',
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
            infoDescriptionText: 'Automatiseert de dagelijkse zoekopdrachten op Bing om Microsoft Rewards-punten te sparen zonder handwerk. Het vraagt bij Microsoft Rewards op hoeveel zoekpunten je vandaag nog mist, voert alleen de nodige zoekopdrachten uit, stopt zelf zodra ze klaar zijn en laat zien wat je punten waard zijn aan Xbox-krediet; het aantal onder ⚙ blijft als achtervang voor wanneer er geen Rewards-sessie is. Het aantal zoekopdrachten stel je in met ⚙ (1-100, standaard 20) en de knoppen starten / hervatten / stoppen / opnieuw instellen wisselen mee met de toestand. Op het tabblad met trefwoorden kun je elk trefwoord met één klik verwijderen, er meerdere tegelijk toevoegen gescheiden door komma’s, ze allemaal in één keer bewerken of de oorspronkelijke lijst herstellen. Het zwevende paneel klapt in en onthoudt hoe je het achterliet, en de taal van het script kies je hier bovenaan. Onder de knoppen staat een lijst met wat Rewards vandaag naast de zoekopdrachten vraagt — de reeks, het inchecken in de app, de dagelijkse set — met een link naar alles wat nog openstaat.',
            infoAuthor: 'Auteur:', infoGitHub: 'GitHub:', infoPrivacy: 'Privacy:',
            infoPrivacyText: 'Je trefwoorden en de zoekteller worden alleen opgeslagen in de lokale opslag van je userscriptbeheerder, in je browser. Staat «Mijn Rewards-voortgang gebruiken» aan, dan doet het script één GET-verzoek aan bing.com — hetzelfde eindpunt dat het puntenpaneel in de Bing-koptekst voedt — om je voortgang van de dag, je saldo en de inwisselcatalogus te lezen; dat verloopt via je Bing-sessie en niets daarvan gaat naar derden of naar de auteur van het script. Zet dat vinkje uit en het script doet geen enkel eigen netwerkverzoek: het navigeert alleen naar zoek-URL\'s van bing.com, precies alsof je ze zelf typte. De dagtaken in die lijst komen uit dezelfde respons, en wat gelezen is wordt ook lokaal bewaard om het niet op elke Bing-pagina opnieuw op te vragen.',
            infoHow: 'Hoe het werkt:',
            infoHowText: 'Het vraagt bij Rewards op hoeveel zoekpunten er vandaag nog missen en voert alleen de nodige zoekopdrachten uit, en stopt zodra Rewards de dag als voltooid meldt; blijft de teller over meerdere zoekopdrachten staan, dan wacht het een halve minuut, kijkt opnieuw en gaat door, want bijna altijd schrijft Rewards gewoon later bij. Het stelt zoekopdrachten samen uit 1 tot 3 trefwoorden en wisselt af tussen webzoeken (70%), afbeeldingen, video’s, shopping en nieuws om menselijk surfgedrag na te bootsen. De wachttijden zijn willekeurig tussen 3 en 10 s, met af en toe pauzes van 10-25 s die het lezen van resultaten nabootsen. Elke URL bevat wisselende parameters (form, cvid, PC) die Bing als normaal verkeer herkent. Mobiel en desktop worden automatisch herkend, de voortgang overleeft het herladen van de pagina en de teller wordt elke dag om middernacht op nul gezet.'
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
            stalledTip: 'Flera sökningar i rad utan att Rewards-räknaren rörde sig. Nästan alltid handlar det om fördröjning: poängen kommer senare. Skriptet väntar en halv minut, tittar igen och fortsätter söka tills dagen är klar, även om det tar fler sökningar än beräknat. Vill du avbryta, använd ⏹.',
            capReached: 'Säkerhetsgränsen nådd',
            dailySetTip: 'Dagens tre Rewards-aktiviteter, skilda från sökningarna: de räknas till din svit. Varje länk öppnar den som återstår i en ny flik. Om automatiska sökningar pågår stoppas de när du öppnar den, så att de inte lämnar sidan innan du är klar.',
            dailySet: 'Dagens uppsättning',
            streakDays: 'Svit: {n} dagar',
            streakTip: 'Varje rad är en egen svit på sju steg: de sex första dagarna ger lite och den sjunde ger den stora bonusen. Ett ✓ räknas redan i dag; de övriga öppnar där uppgiften görs.',
            offersTip: 'Dagens poängerbjudanden som inte ingår i dagens uppsättning: utvalda teman, det fasta erbjudandet för varje veckodag… Varje länk öppnar den som återstår i en ny flik. Om automatiska sökningar pågår stoppas de när du öppnar den.',
            protectionTip: 'Återstående dagar med svitskydd. Om du någon dag inte slutför aktiviteterna förbrukar Rewards en dag och din svit bryts inte.',
            todayPointsTip: 'Poängen du fått i dag från alla källor, inte bara från sökningar: dagens uppsättning, erbjudanden, sviter och bonusar. Av det som den här panelen kan mäta finns det {n} i dag; om din summa är högre beror det på att du gjort aktiviteter som inte syns härifrån, till exempel i Bing-appen, Outlook eller Xbox.',
            levelTip: 'Poängen du har under den period som Rewards använder för att bestämma din nivå, och hur många som krävs för att behålla den. Det är inte kalendermånaden: Rewards sköter perioden själv och säger inte när den tar slut. Utöver poängen krävs också att några aktiviteter slutförs, vilka inte räknas här.',
            extraOffersNote: 'Fler aktiviteter i Rewards',
            extraOffersTip: 'I Rewards-panelen och i Bing-appen finns oftast extra aktiviteter som ger mer poäng än de här. De är inte alltid desamma: vissa är sökningar och andra inte (pussel, frågor, enkäter).',
            bingAppNote: 'Fler poäng i Bing-appen',
            bingAppTip: 'Bing-appen har poängaktiviteter som bara går att göra där: på Rewards webbplats visas de som ”Låst”, och här syns de inte alls. Den här länken leder till nedladdningen.',
            xboxNote: 'Fler poäng på Xbox',
            xboxTip: 'Xbox har egna dagliga, veckovisa och månatliga uppdrag som ger poäng utöver de här. De syns varken här eller i Rewards-panelen: de krediteras från appen eller konsolen, så det är där man får titta.',
            outlookNote: 'Uppdrag i Outlook',
            outlookTip: 'Outlook i webbläsaren har poänguppdrag som bara syns där. De syns varken här eller i Rewards-panelen, så man får öppna det för att se och göra dem.',
            streakOffTip: 'Den här sviten är inte tillgänglig på ditt konto: Microsoft erbjuder dem bara till vissa medlemmar och på vissa marknader. Härifrån går den inte att föra vidare.',
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
            infoDescriptionText: 'Automatiserar de dagliga sökningarna på Bing för att samla Microsoft Rewards-poäng utan handpåläggning. Skriptet frågar Microsoft Rewards hur många sökpoäng du saknar i dag, gör bara de sökningar som behövs, stannar av sig själv när de är klara och visar vad dina poäng är värda som Xbox-kredit; talet under ⚙ finns kvar som reserv för när ingen Rewards-session finns. Antalet sökningar ställs in med ⚙ (1-100, standard 20) och knapparna starta / fortsätt / stoppa / nollställ växlar efter tillstånd. På fliken för nyckelord kan du ta bort vart och ett med ett klick, lägga till flera separerade med kommatecken, redigera alla på en gång eller återställa den ursprungliga listan. Den flytande panelen fälls ihop och minns hur du lämnade den, och skriptets språk väljs här uppe. Under knapparna finns en lista över vad Rewards begär i dag utöver sökningarna — sviten, incheckningen i appen, dagens uppsättning — med en länk till allt som återstår.',
            infoAuthor: 'Upphovsperson:', infoGitHub: 'GitHub:', infoPrivacy: 'Integritet:',
            infoPrivacyText: 'Dina nyckelord och sökräknaren sparas endast i den lokala lagringen för din hanterare av användarskript, i din webbläsare. När ”Använd mina Rewards-framsteg” är på gör skriptet en GET-förfrågan till bing.com — samma slutpunkt som försörjer poängpanelen i Bings sidhuvud — för att läsa dagens framsteg, ditt saldo och inlösenkatalogen; den går via din Bing-session och inget av det skickas till tredje part eller till skriptets upphovsman. Stäng av den kryssrutan och skriptet gör inga egna nätverksanrop: det navigerar bara till sök-URL:er på bing.com, precis som om du skrev in dem själv. Dagens uppgifter i den listan kommer från samma svar, och det som lästs sparas också lokalt för att slippa hämtas på nytt på varje Bing-sida.',
            infoHow: 'Så fungerar det:',
            infoHowText: 'Skriptet frågar Rewards hur många sökpoäng som saknas i dag och gör bara de nödvändiga sökningarna, och stannar när Rewards markerar dagen som klar; om räknaren inte rör sig under flera sökningar i rad väntar det en halv minut, tittar igen och fortsätter, eftersom det nästan alltid bara är Rewards som bokför sent. Det bygger sökfrågor av 1 till 3 nyckelord och växlar mellan webbsökning (70 %), bilder, videor, shopping och nyheter för att efterlikna mänskligt surfande. Fördröjningarna är slumpmässiga mellan 3 och 10 s, med enstaka pauser på 10-25 s som efterliknar läsning av resultat. Varje URL innehåller roterande parametrar (form, cvid, PC) som Bing tolkar som vanlig trafik. Mobil och dator känns igen automatiskt, förloppet överlever omladdningar av sidan och räknaren nollställs varje dag vid midnatt.'
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
            stalledTip: 'Flere søgninger i træk uden at Rewards-tælleren steg. Det er næsten altid forsinkelse: pointene kommer senere. Scriptet venter et halvt minut, tjekker igen og bliver ved med at søge, indtil dagen er fuldført — også selvom det kræver flere søgninger end ventet. Vil du stoppe, så brug ⏹.',
            capReached: 'Sikkerhedsgrænsen er nået',
            dailySetTip: 'Dagens tre Rewards-aktiviteter, adskilt fra søgningerne: de tæller med til din stime. Hvert link åbner den manglende i en ny fane. Kører der automatiske søgninger, stopper de, når du åbner den, så de ikke fører dig væk fra siden, før du er færdig.',
            dailySet: 'Dagens sæt',
            streakDays: 'Stime: {n} dage',
            streakTip: 'Hver linje er en selvstændig stime på syv trin: de første seks dage giver lidt, og den syvende giver den store bonus. Et ✓ tæller allerede med i dag; resten åbner der, hvor opgaven løses.',
            offersTip: 'Dagens pointtilbud, der ikke hører til dagens sæt: fremhævede emner, det faste tilbud for hver ugedag… Hvert link åbner det manglende i en ny fane. Kører der automatiske søgninger, stopper de, når du åbner det.',
            protectionTip: 'Resterende dage med stimebeskyttelse. Hvis du en dag ikke gennemfører aktiviteterne, bruger Rewards en af dem, og din stime brydes ikke.',
            todayPointsTip: 'De point, du har fået i dag fra alle kilder, ikke kun fra søgninger: dagens sæt, tilbud, stimer og bonusser. Af det, som dette panel kan måle, er der {n} i dag; er din sum højere, skyldes det aktiviteter, der ikke kan ses herfra, for eksempel i Bing-appen, Outlook eller Xbox.',
            levelTip: 'De point, du har i den periode, som Rewards bruger til at fastsætte dit niveau, og hvor mange der kræves for at beholde det. Det er ikke kalendermåneden: Rewards styrer perioden selv og oplyser ikke, hvornår den slutter. Ud over pointene kræves også, at nogle aktiviteter gennemføres, og de tælles ikke med her.',
            extraOffersNote: 'Flere aktiviteter i Rewards',
            extraOffersTip: 'I Rewards-panelet og i Bing-appen er der som regel ekstra aktiviteter, der giver flere point end disse. De er ikke altid de samme: nogle er søgninger, andre ikke (puslespil, spørgsmål, afstemninger).',
            bingAppNote: 'Flere point i Bing-appen',
            bingAppTip: 'Bing-appen har pointaktiviteter, der kun kan løses dér: på Rewards-webstedet vises de som „Låst“, og her dukker de slet ikke op. Dette link fører til download.',
            xboxNote: 'Flere point på Xbox',
            xboxTip: 'Xbox har sine egne daglige, ugentlige og månedlige opgaver, der giver point ud over disse. De vises hverken her eller i Rewards-panelet: de krediteres fra appen eller konsollen, så det er dér, man skal kigge.',
            outlookNote: 'Missioner i Outlook',
            outlookTip: 'Outlook i browseren har pointmissioner, der kun kan ses dér. De vises hverken her eller i Rewards-panelet, så man skal åbne det for at se og løse dem.',
            streakOffTip: 'Denne stime er ikke tilgængelig på din konto: Microsoft tilbyder dem kun til udvalgte medlemmer og på udvalgte markeder. Herfra kan den ikke føres videre.',
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
            infoDescriptionText: 'Automatiserer de daglige søgninger på Bing, så du kan samle Microsoft Rewards-point uden manuelt arbejde. Scriptet spørger Microsoft Rewards, hvor mange søgepoint du mangler i dag, udfører kun de nødvendige søgninger, stopper af sig selv, når de er klaret, og viser, hvad dine point er værd som Xbox-kredit; tallet under ⚙ bliver stående som reserve til de gange, hvor der ikke er nogen Rewards-session. Antallet af søgninger indstilles med ⚙ (1-100, standard 20), og knapperne start / fortsæt / stop / nulstil skifter efter tilstanden. På fanen med nøgleord kan du slette hvert enkelt med ét klik, tilføje flere adskilt af komma, redigere dem alle på én gang eller gendanne den oprindelige liste. Det flydende panel klapper sammen og husker, hvordan du efterlod det, og scriptets sprog vælges heroppe. Under knapperne står en liste over det, Rewards beder om i dag ud over søgningerne — stimen, tjek ind i appen, dagens sæt — med et link til alt det, der mangler.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Privatliv:',
            infoPrivacyText: 'Dine nøgleord og søgetælleren gemmes kun i den lokale lagring i din userscript-manager, i din browser. Når „Brug mine Rewards-fremskridt“ er slået til, sender scriptet en GET-anmodning til bing.com — samme endepunkt, der forsyner pointpanelet i Bings sidehoved — for at læse dagens fremskridt, din saldo og indløsningskataloget; den følger din Bing-session, og intet af det går til tredjeparter eller til scriptets forfatter. Slå det felt fra, og scriptet foretager ingen egne netværksanmodninger: det navigerer kun til søge-URL\'er på bing.com, præcis som hvis du selv skrev dem. Dagens opgaver i den liste kommer fra samme svar, og det læste gemmes også lokalt, så det ikke skal hentes igen på hver Bing-side.',
            infoHow: 'Sådan virker det:',
            infoHowText: 'Scriptet spørger Rewards, hvor mange søgepoint der mangler i dag, og udfører kun de nødvendige søgninger, og stopper når Rewards markerer dagen som fuldført; hvis tælleren ikke rykker sig over flere søgninger i træk, venter det et halvt minut, tjekker igen og fortsætter, for næsten altid krediterer Rewards bare sent. Det danner søgninger ved at kombinere 1 til 3 nøgleord og skifter mellem websøgning (70 %), billeder, videoer, shopping og nyheder for at efterligne menneskelig browsing. Forsinkelserne er tilfældige mellem 3 og 10 s, med lejlighedsvise pauser på 10-25 s, der efterligner læsning af resultater. Hver URL indeholder roterende parametre (form, cvid, PC), som Bing opfatter som almindelig trafik. Mobil og computer registreres automatisk, forløbet overlever genindlæsning af siden, og tælleren nulstilles hver dag ved midnat.'
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
            stalledTip: 'Flere søk på rad uten at Rewards-telleren steg. Det er nesten alltid forsinkelse: poengene kommer senere. Skriptet venter et halvt minutt, ser etter på nytt og fortsetter å søke til dagen er fullført, selv om det tar flere søk enn ventet. Vil du avbryte, bruk ⏹.',
            capReached: 'Sikkerhetsgrensen er nådd',
            dailySetTip: 'Dagens tre Rewards-aktiviteter, atskilt fra søkene: de teller med i rekken din. Hver lenke åpner den som mangler i en ny fane. Hvis automatiske søk pågår, stopper de når du åpner den, så de ikke tar deg bort fra siden før du er ferdig.',
            dailySet: 'Dagens sett',
            streakDays: 'Rekke: {n} dager',
            streakTip: 'Hver linje er en egen rekke på sju trinn: de seks første dagene gir lite, og den sjuende gir den store bonusen. En ✓ teller allerede i dag; resten åpner der oppgaven gjøres.',
            offersTip: 'Dagens poengtilbud som ikke hører til dagens sett: utvalgte temaer, det faste tilbudet for hver ukedag… Hver lenke åpner den som mangler i en ny fane. Hvis automatiske søk pågår, stopper de når du åpner den.',
            protectionTip: 'Gjenstående dager med rekkebeskyttelse. Hvis du en dag ikke fullfører aktivitetene, bruker Rewards én av dem, og rekken din brytes ikke.',
            todayPointsTip: 'Poengene du har fått i dag fra alle kilder, ikke bare fra søk: dagens sett, tilbud, rekker og bonuser. Av det denne panelen kan måle, finnes det {n} i dag; er summen din høyere, kommer det av aktiviteter som ikke synes herfra, for eksempel i Bing-appen, Outlook eller Xbox.',
            levelTip: 'Poengene du har i perioden Rewards bruker til å fastsette nivået ditt, og hvor mange som kreves for å beholde det. Det er ikke kalendermåneden: Rewards styrer perioden selv og sier ikke når den avsluttes. I tillegg til poengene kreves det at noen aktiviteter fullføres, og de telles ikke med her.',
            extraOffersNote: 'Flere aktiviteter i Rewards',
            extraOffersTip: 'I Rewards-panelet og i Bing-appen finnes det som regel ekstra aktiviteter som gir flere poeng enn disse. De er ikke alltid de samme: noen er søk og andre ikke (puslespill, spørsmål, spørreundersøkelser).',
            bingAppNote: 'Flere poeng i Bing-appen',
            bingAppTip: 'Bing-appen har poengaktiviteter som bare kan gjøres der: på Rewards-nettstedet vises de som «Låst», og her dukker de ikke opp i det hele tatt. Denne lenken fører til nedlastingen.',
            xboxNote: 'Flere poeng på Xbox',
            xboxTip: 'Xbox har sine egne daglige, ukentlige og månedlige oppgaver som gir poeng i tillegg til disse. De vises verken her eller i Rewards-panelet: de godskrives fra appen eller konsollen, så det er der man må se etter.',
            outlookNote: 'Oppdrag i Outlook',
            outlookTip: 'Outlook i nettleseren har poengoppdrag som bare vises der. De vises verken her eller i Rewards-panelet, så man må åpne det for å se og gjøre dem.',
            streakOffTip: 'Denne rekken er ikke tilgjengelig på kontoen din: Microsoft tilbyr dem bare til utvalgte medlemmer og i utvalgte markeder. Herfra kan den ikke føres videre.',
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
            infoDescriptionText: 'Automatiserer de daglige søkene på Bing slik at du samler Microsoft Rewards-poeng uten manuelt arbeid. Skriptet spør Microsoft Rewards om hvor mange søkepoeng du mangler i dag, utfører bare de nødvendige søkene, stopper av seg selv når de er ferdige, og viser hva poengene dine er verdt som Xbox-kreditt; tallet under ⚙ blir stående som reserve for de gangene det ikke finnes noen Rewards-økt. Antall søk stilles inn med ⚙ (1-100, standard 20), og knappene start / fortsett / stopp / nullstill endrer seg etter tilstanden. I fanen for nøkkelord kan du slette hvert enkelt med ett klikk, legge til flere skilt med komma, redigere alle på én gang eller gjenopprette den opprinnelige listen. Det flytende panelet felles sammen og husker hvordan du forlot det, og språket for skriptet velges her oppe. Under knappene står en liste over det Rewards ber om i dag i tillegg til søkene — rekken, innsjekk i appen, dagens sett — med en lenke til alt som gjenstår.',
            infoAuthor: 'Forfatter:', infoGitHub: 'GitHub:', infoPrivacy: 'Personvern:',
            infoPrivacyText: 'Nøkkelordene dine og søketelleren lagres bare i det lokale lageret til brukerskript-behandleren, i nettleseren din. Når «Bruk fremgangen min i Rewards» er slått på, sender skriptet en GET-forespørsel til bing.com — samme endepunkt som forsyner poengpanelet i topplinjen på Bing — for å lese dagens fremgang, saldoen din og innløsningskatalogen; den følger Bing-økten din, og ingenting av dette går til tredjeparter eller til forfatteren av skriptet. Slå av den avkrysningsboksen, og skriptet gjør ingen egne nettverksforespørsler: det navigerer bare til søke-URL-er på bing.com, akkurat som om du skrev dem inn selv. Dagens oppgaver i den listen kommer fra samme svar, og det som leses lagres også lokalt for å slippe å hente det på nytt på hver Bing-side.',
            infoHow: 'Slik virker det:',
            infoHowText: 'Skriptet spør Rewards om hvor mange søkepoeng som mangler i dag, og utfører bare de nødvendige søkene, og stopper når Rewards markerer dagen som fullført; hvis telleren ikke rører seg over flere søk på rad, venter det et halvt minutt, ser etter på nytt og fortsetter, for nesten alltid er det bare Rewards som godskriver sent. Det bygger søk ved å kombinere 1 til 3 nøkkelord og veksler mellom nettsøk (70 %), bilder, videoer, shopping og nyheter for å etterligne menneskelig surfing. Forsinkelsene er tilfeldige mellom 3 og 10 s, med sporadiske pauser på 10-25 s som etterligner lesing av resultater. Hver URL inneholder roterende parametre (form, cvid, PC) som Bing oppfatter som vanlig trafikk. Mobil og datamaskin oppdages automatisk, framdriften overlever at siden lastes på nytt, og telleren nullstilles hver dag ved midnatt.'
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
            stalledTip: '連續幾次搜尋後 Rewards 的計數都沒有上升。這幾乎都是延遲，點數會晚一點才到。腳本會等半分鐘再看一次，並繼續搜尋直到當天完成，就算要多花幾次搜尋。想停下就按 ⏹。',
            capReached: '已達安全上限',
            dailySetTip: '當天的三項 Rewards 活動，與搜尋分開計算，會計入連續天數。每個連結會在新分頁中開啟尚未完成的那一項。如果自動搜尋正在進行，開啟時會停止，以免在你完成之前把頁面跳走。',
            dailySet: '每日任務',
            streakDays: '連續天數：{n} 天',
            streakTip: '每一行都是獨立的七步連續記錄：前六天給得少，第七天一次給足。✓ 表示今天這一份已經算進去了，其餘會開啟完成任務的地方。',
            offersTip: '當天不屬於每日任務的積分活動：專題推薦、每個星期幾的固定活動等。每個連結會在新分頁中開啟尚未完成的那一項。如果自動搜尋正在進行，開啟時會停止。',
            protectionTip: '剩餘的連續天數保護天數。某天沒有完成活動時，Rewards 會消耗一天，你的連續紀錄不會中斷。',
            todayPointsTip: '今天從所有來源獲得的積分，不只是搜尋：每日任務、活動、連續天數和獎勵。在本面板能統計到的範圍內，今天共有 {n} 分；若你的總數超過這個值，表示你完成了這裡看不到的活動，例如 Bing 應用程式、Outlook 或 Xbox 裡的。',
            levelTip: '你在 Rewards 用來判定等級的週期內獲得的積分，以及保級所需的積分。這不是自然月：該週期由 Rewards 自行管理，也不會告知何時結束。除積分外還要求完成若干活動，這裡沒有計入。',
            extraOffersNote: 'Rewards 裡還有更多活動',
            extraOffersTip: 'Rewards 面板和 Bing 應用程式裡通常還有額外活動，給的分比這些多。它們並不固定：有的是搜尋，有的不是（拼圖、問答、問卷）。',
            bingAppNote: 'Bing 應用程式裡還能拿更多分',
            bingAppTip: 'Bing 應用程式裡有只能在那裡完成的積分活動：在 Rewards 網站上顯示為「已鎖定」，這裡則完全看不到。此連結可前往下載。',
            xboxNote: 'Xbox 裡還能拿更多分',
            xboxTip: 'Xbox 有自己的每日、每週和每月任務，給的分和這些是分開的。這裡和 Rewards 面板都看不到：它們從應用程式或主機上入帳，只能到那邊看。',
            outlookNote: 'Outlook 裡的任務',
            outlookTip: '瀏覽器裡的 Outlook 有只能在那裡看到的積分任務。這裡和 Rewards 面板都看不到，只能打開 Outlook 去看和完成。',
            streakOffTip: '這個連續記錄在你的帳戶上無法使用：微軟只向部分會員、在部分市場提供。從這裡無法推進。',
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
            infoDescriptionText: '自動完成每日的 Bing 搜尋，無須手動操作即可累積 Microsoft Rewards 點數。腳本會向 Microsoft Rewards 查詢你今天還差多少搜尋點數，只執行必要的搜尋，完成後自動停止，並顯示你的點數折合多少 Xbox 餘額；⚙ 裡的次數則留作沒有 Rewards 工作階段時的備用。搜尋次數可用 ⚙ 設定（1-100，預設 20），開始／繼續／停止／重設按鈕會隨狀態變化。在關鍵字分頁中，你可以點擊逐一刪除、用逗號分隔一次新增多個、一次編輯全部，或還原原始清單。浮動面板可以收合並記住你上次的狀態，腳本語言就在上方選擇。按鈕下方會列出除了搜尋以外今天 Rewards 要求的事項（連續天數、在應用程式中登記、每日任務），未完成的都附連結。',
            infoAuthor: '作者：', infoGitHub: 'GitHub：', infoPrivacy: '隱私：',
            infoPrivacyText: '你的關鍵字和搜尋計數器只保存在瀏覽器中使用者腳本管理器的本機儲存裡。開啟「使用我的 Rewards 進度」時，腳本會向 bing.com 發出一次 GET 請求，讀取你今天的進度、餘額和兌換目錄；這個位址就是驅動 Bing 頁首點數面板的同一個端點，請求隨你的 Bing 工作階段送出，其中的內容不會流向任何第三方，也不會傳給腳本作者。關掉這個勾選，腳本就不會發出任何自己的網路請求：它只是跳轉到 bing.com 的搜尋網址，和你自己輸入完全一樣。該清單中當天的任務也來自同一個回應，讀到的內容同樣保存在本機，以免每開一個 Bing 頁面就再問一次。',
            infoHow: '運作方式：',
            infoHowText: '腳本會向 Rewards 查詢今天還差多少搜尋點數，只做必要的那些，等 Rewards 將今天標記為已完成就停下；若連續幾次搜尋計數都沒上升，它會等半分鐘再看一次然後繼續，因為多半只是 Rewards 發放得晚。 腳本會組合 1 到 3 個關鍵字產生查詢，並在網頁搜尋（70%）、圖片、影片、購物與新聞之間輪替，以模擬人類瀏覽。延遲在 3-10 秒之間隨機，偶爾會有 10-25 秒的停頓來模擬閱讀結果。每個網址都帶有輪替參數（form、cvid、PC），Bing 會將其視為正常流量。腳本會自動辨識行動裝置與桌機，進度在頁面重新載入後仍會保留，計數器每天午夜重設。'
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
    const KEY_STALL_RETRY = 'bing-rewards-stall-retry';
    // Búsquedas forzadas: la salida de mano cuando Rewards dice que el día está
    // completo y el usuario sabe que no. Guarda el día —para que caduque solo—
    // y el contador desde el que se forzó, que es lo que hace que ▶ signifique
    // «busca otras N» y no «vuelve a empezar»: el contador del día no se toca.
    const KEY_FORCE = 'bing-rewards-force';

    // Tope absoluto de búsquedas por día. En modo automático quien manda es la
    // API, pero si su contador se quedara congelado el bucle no tendría freno,
    // así que este es el último. Queda por encima del máximo manual (100) para
    // no recortar a quien lo tenga puesto a tope.
    const HARD_CAP = 120;

    // Búsquedas seguidas sin que el contador de puntos suba antes de rendirse.
    // Bing deja de acreditar en cuanto marca el tráfico como automático, y sin
    // esto el script seguiría buscando hasta el HARD_CAP sin ganar un punto.
    const STALL_LIMIT = 5;

    // Antes de dar el día por perdido, el atasco se reintenta. Casi siempre es
    // latencia del propio Rewards —los puntos llegan, pero tarde—, y pararse ahí
    // deja el día a medias por un retraso de medio minuto.
    //
    // El reintento NO gasta una búsqueda: solo vuelve a leer el progreso desde
    // esta misma página. Si subió, el contador de atascos se limpia solo y la
    // sesión sigue; si no, se cuenta un reintento más. Agotados los tres, se para
    // como siempre, que a partir de ahí ya no es latencia.
    const STALL_RETRY_MIN = 15000;
    const STALL_RETRY_MAX = 30000;
    const STALL_RETRIES = 3;

    // El widget se pinta en cada página de Bing, no solo mientras busca. Sin un
    // TTL, navegar normalmente por Bing dispararía una petición por página; con
    // sesión activa siempre se relee, que ahí el dato de hace 5 minutos no vale.
    const SNAPSHOT_TTL = 5 * 60 * 1000;

    const PANEL_ID = 'bing-rewards-panel';
    // El bloque de tareas del día lleva id propio para poder apuntarlo desde
    // fuera: es lo que permite comprobarlo en las pruebas sin adivinarlo por el
    // texto, que es como se colaba la línea de estado (empieza igual, con «✓»).
    const TASKS_ID = 'bing-rewards-tasks';

    const colors = {
        bg: '#0f0f1a',
        surface: '#1a1a2e',
        border: '#2a2a4a',
        primary: '#0078d4',
        primaryDark: '#005a9e',
        text: '#e0e0e0',
        gray: '#8892a0',
        green: '#4caf50',
        red: '#e74c3c',
        // Solo para la escalera que está a punto de cerrarse. Ni verde (que aquí
        // significa «ya hecho») ni rojo (que significa «algo va mal»): esto no
        // es un problema, es un día caro.
        gold: '#ffb900'
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
     * Fecha de hoy en formato YYYY-MM-DD y en hora LOCAL.
     *
     * Aquí NO vale `toISOString()`, que es UTC: al oeste de Greenwich la fecha
     * UTC cambia por la tarde, y a partir de esa hora todo lo que este valor
     * decide se adelanta un día. Decide dos cosas, las dos «de hoy»: el reseteo
     * del contador (`checkDailyReset`) y la validez del snapshot de Rewards
     * (`readSnapshot`). Con UTC, en México (UTC−6) el contador se reiniciaba a
     * las 18:00 —no a medianoche, como dice la pestaña de información— y un
     * snapshot guardado ayer por la tarde llegaba a hoy marcado como del día en
     * curso: el panel pintaba el progreso de ayer y, si venía completo,
     * bloqueaba las búsquedas de hoy sin gastar ninguna. Con el mismo origen se
     * arrastraba `KEY_SEEN_POINTS`, así que el progreso de hoy quedaba por
     * debajo del de ayer y cada relectura contaba como atasco.
     * @returns {string}
     */
    function getToday() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
            GM_setValue(KEY_STALL_RETRY, 0);
            // Forzar es cosa de un día: mañana vuelve a mandar Rewards.
            GM_setValue(KEY_FORCE, null);
        }
    }

    /**
     * ¿Hay búsquedas forzadas a mano HOY? Devuelve desde qué cuenta se forzó,
     * o null. El día se comprueba aquí y no solo en `checkDailyReset` porque una
     * pestaña abierta desde ayer no pasa por el reseteo hasta que se recarga.
     * @returns {{day:string,from:number}|null}
     */
    function getForce() {
        const f = GM_getValue(KEY_FORCE, null);
        return (f && typeof f === 'object' && f.day === getToday()) ? f : null;
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

    // Enlaces al panel de Rewards, cada uno a su sección. No se usa el
    // `destinationUrl` que Bing da para el socio del conjunto diario
    // (`bing.com/?form=ML2PCO`): deja en la portada de Bing, no donde se hacen
    // las actividades.
    const REWARDS_MORE = 'https://rewards.bing.com/earn#moreactivities';
    const REWARDS_DAILYSET = 'https://rewards.bing.com/dashboard?section=dailyset';

    // Xbox va aparte y sin locale: `microsoft.com/rewards/xbox` redirige aquí
    // con un 301, y esta página se sirve ya traducida al mercado del usuario
    // (verificado el 2026-08-26: desde mx devuelve es-MX sin pedirlo). Es el
    // ÚNICO enlace del panel que apunta a algo que el script no puede leer: las
    // tareas de Xbox no salen ni en el flyout ni en el panel de Rewards —se
    // comprobó con controles positivos del propio sitio el 2026-08-26—, así que
    // se acreditan desde la app o la consola y no hay número que enseñar. Por
    // eso es un enlace con aviso y no una fila de tarea con estado.
    const XBOX_REWARDS = 'https://www.xbox.com/rewards';

    // Outlook web, la bandeja. NO es `partner_outlook_destinationUrl`, y la
    // diferencia importa: ese enlace lleva a la página de la RACHA de Outlook,
    // que Microsoft describe como «Available on Android mobile devices only»
    // para «select Microsoft Rewards members in the United States». Las misiones
    // que Outlook enseña en el navegador de escritorio —«Explorar en Outlook»,
    // tarjetas de 10 puntos— son OTRA promoción: se ven en es-MX y en
    // escritorio, o sea justo donde esa página dice que no hay nada. Mandar ahí
    // al usuario sería contradecir lo que tiene delante.
    //
    // Tampoco vale quitarle el idioma a la URL como se hizo con Xbox
    // (`microsoft.com/rewards/xbox` redirige y se sirve traducida):
    // `microsoft.com/rewards/outlook-rewards` responde 404 sin el segmento.
    const OUTLOOK_REWARDS = 'https://outlook.live.com/mail/0/';

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
     * Fecha de hoy en el formato MM/DD/YYYY de `daily_set_date`, y en hora
     * LOCAL, como `getToday()`. Son dos funciones porque el formato es otro:
     * aquí hay que casar contra el MM/DD/YYYY que manda Bing. Lo de la hora
     * local no es cosmético: el conjunto de mañana viene en la misma respuesta,
     * así que una fecha adelantada daría tres actividades "pendientes" que aún
     * no se pueden hacer.
     * @returns {string}
     */
    function todaySlash() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    }

    /**
     * Reduce `promotions[]` al conjunto diario de HOY: cuántas actividades son,
     * cuántas están hechas y a dónde va cada una de las que faltan.
     *
     * Verificado contra un volcado real (es-MX, 2026-08-14). Cuatro cosas del
     * dato que no se adivinan:
     *
     *  - La respuesta trae VARIOS DÍAS por delante (en el volcado, el 14, el 15
     *    y el 16). Filtrar por fecha no es una precaución: sin ello el panel
     *    cuenta como pendientes las actividades de mañana.
     *  - `daily_set_date` viene en MM/DD/YYYY.
     *  - El prefijo del `name` es del mercado —`Global_DailySet_…` aquí, pero en
     *    la misma respuesta conviven `ESMX_…` y `WW_…`—, así que lo que
     *    identifica al conjunto es tener `daily_set_date`, no cómo se llame.
     *  - Hay promos con `hidden: "True"` que Bing no enseña en ninguna parte
     *    (`ENStar_TodayInHistory_Info`, 20 puntos). Recordar una de esas sería
     *    mandar al usuario a una oferta fantasma.
     *
     * @param {object[]} promotions
     * @returns {{total:number,done:number,pending:{title:string,url:string}[]}|null}
     */
    function readDailySet(promotions) {
        const all = (promotions || []).filter(Boolean).filter((p) => {
            const a = p.attributes || {};
            return a.daily_set_date && !isTrue(a.hidden);
        });
        if (!all.length) return null;

        // MM/DD/YYYY -> YYYYMMDD, que sí ordena como texto.
        const key = (d) => String(d).replace(/^(\d+)\/(\d+)\/(\d+)$/, '$3$1$2');
        const today = todaySlash();
        let items = all.filter((p) => p.attributes.daily_set_date === today);
        if (!items.length) {
            // El mercado puede ir un día por delante o por detrás del reloj del
            // navegador. La fecha más temprana que llega es la del día en curso:
            // Bing manda hoy y los días siguientes, nunca los pasados.
            const first = all.map((p) => key(p.attributes.daily_set_date)).sort()[0];
            items = all.filter((p) => key(p.attributes.daily_set_date) === first);
        }

        const done = items.filter((p) => isTrue(p.attributes.complete)).length;
        const pending = items
            .filter((p) => !isTrue(p.attributes.complete))
            .map((p) => ({ title: p.attributes.title || '', url: p.attributes.destination || '' }))
            // Sin destino no hay nada que enlazar; se cuenta igual en el total,
            // que para el aviso lo que importa es cuántas faltan.
            .filter((x) => x.url);

        return {
            total: items.length, done: done, pending: pending,
            // Los puntos del conjunto de hoy, hechas o no: los usa `readDayMax`.
            points: items.reduce((n, p) => n + num(p.attributes.max), 0)
        };
    }

    /**
     * El contador global, con la etiqueta que le pone Bing, o null si no llega.
     *
     * Sale de `Gamification_Streak_Counter_Promotion` (`activity_progress`), que
     * viene con `hidden: "True"`. Ahí ese atributo NO significa lo mismo que en
     * las ofertas: el flyout enseña este contador —es su «Jornada actual»—, y
     * con `hidden` vienen también `level_info` y los `layout_*`. Marca «esto no
     * es una tarjeta de la lista», no «esto no se enseña».
     *
     * Y NO son días seguidos, aunque el panel lo llamara «Racha: N días» hasta
     * 1.3.6: el 2026-08-22 este contador marcaba 228 con las tres escaleras del
     * check-in en 4/7, 3/7 y 4/7 el mismo día, así que es acumulado. La racha de
     * verdad es la de cada socio (`currentStep`). Por eso la etiqueta se toma del
     * `title` de la propia promo —«Jornada actual», ya traducido al idioma del
     * mercado—: es la única que no miente y no cuesta una cadena en 22 idiomas.
     * @param {object[]} promotions
     * @returns {{n:number,title:string}|null}
     */
    function readStreak(promotions) {
        const p = (promotions || []).filter(Boolean).find((x) => (x.attributes || {}).type === 'streak');
        const n = p ? num(p.attributes.activity_progress) : 0;
        return n > 0 ? { n: n, title: String(p.attributes.title || '') } : null;
    }

    /** Quita el marcado de los textos que Bing manda con `<b>` dentro. */
    function stripTags(text) {
        return String(text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Las ofertas sueltas del día: `urlreward` que NO son del conjunto diario.
     *
     * Son los «Bing Bonus Items» que el panel no listaba, y son puntos de
     * verdad: el 2026-09-04, con dos volcados separados por minutos, los dos
     * `WW_Bing_MonthlyFeaturedTopic_20260904_7` y `_8` pasaron de `0/10
     * complete=False` a `10/10 complete=True` al abrirlos, y `todays_points`
     * los recogió. Dos al día a 10 puntos, más la evergreen de 5, son ~25
     * diarios que estaban ahí sin cobrar.
     *
     * Cinco condiciones, y ninguna sobra (verificadas contra dos cuentas):
     *
     *  - `daily_set_date` fuera: los `Global_DailySet_*` TAMBIÉN son
     *    `urlreward`, así que sin esto se duplicaría el bloque del conjunto
     *    diario —y con los días siguientes dentro, que la respuesta trae hoy,
     *    mañana y pasado—.
     *  - `max > 0` mata las tarjetas promocionales, que llegan con `0/0`
     *    (`WW_flyout_wallpaper_free_Dec25`, la extensión del navegador, el
     *    programa de referidos) y las de HVA con `-1/-1`. Es además lo único
     *    que separaba a las dos cuentas: sus juegos de tareas eran idénticos y
     *    lo que cambiaba era ese ruido comercial.
     *  - `hidden` fuera: `ENStar_TodayInHistory_Info` viene con 0/20 y Bing no
     *    la enseña en ninguna parte. Enlazarla sería mandar a una oferta
     *    fantasma.
     *  - Sin `destination` no hay nada que abrir.
     *
     * **NO se filtra por día de la semana, aunque el nombre lo invite.** Las
     * `..._Evergreen_<Weekday>` llegan LAS CINCO en la misma respuesta y el
     * 2026-09-04 —viernes— las cinco marcaban `complete=True`. Llegué a
     * concluir que las otras cuatro eran `complete` heredado de sus días y a
     * casar el nombre contra el día local; era falso. La página de
     * `rewards.bing.com/earn#moreactivities` de ese mismo día enseña las CINCO
     * como tarjetas vivas e independientes —«Cita del día», «¿Conoces la
     * respuesta?», «¿Sabes la respuesta?», «Puzle de mitad de semana» y
     * «Comienza el día con una cita», a 5 puntos cada una— y su contador de
     * sección lo confirma por aritmética: 10+10 de los temas destacados, 5 de
     * «Fija un objetivo» y 25 de las cinco evergreen son los 50 del «50/100».
     *
     * Con el filtro puesto, un día con varias pendientes el panel habría
     * listado una y escondido hasta 20 puntos. Es la misma trampa que el
     * `_27Days` con `activity_max` 7: **el nombre no es el dato**. Quien dice
     * si una oferta cuenta hoy es su `complete`, que es per-oferta y ya está.
     *
     * @param {object[]} promotions
     * @returns {{title:string,url:string,points:number}[]|null}
     */
    function isLooseOffer(p) {
        const a = (p && p.attributes) || {};
        return a.type === 'urlreward' && !isTrue(a.hidden) && !a.daily_set_date &&
            !!a.destination && num(a.max) > 0;
    }

    function readOffers(promotions) {
        const out = [];
        for (const p of (promotions || []).filter(Boolean)) {
            if (!isLooseOffer(p) || isTrue(p.attributes.complete)) continue;
            const a = p.attributes;
            // El título viene ya traducido por Bing al idioma del mercado.
            out.push({ title: String(a.title || ''), url: String(a.destination), points: num(a.max) });
        }
        return out.length ? out : null;
    }

    /**
     * Los puntos que HAY hoy en lo que este panel sabe medir, hechos o no.
     *
     * No es el total del día y no se puede pintar como denominador: faltan las
     * actividades que solo están en la app (50 de los 100 de «Seguir ganando»
     * el 2026-09-04), Xbox y las misiones de Outlook. Es un SUELO, y por eso
     * vive en el aviso de los puntos de hoy y no como `X/N` en la línea:
     * superarlo es lo normal, y una barra que se pasa del tope se lee como un
     * error del panel.
     *
     * Suma tres cosas y **deja fuera a propósito los pasos de las escaleras**,
     * que son el único término dudoso: no está resuelto si el paso de «Buscar
     * con Bing» son 3 puntos aparte o los mismos de los 60 de búsquedas. Con
     * ellos dentro salen 183 y sin ellos 140, y el día marcaba 147, así que
     * cualquiera de las dos cifras sería falsa la mitad de las veces. Sin
     * ellos el número es un suelo de verdad, que es lo que el aviso promete.
     *
     * Se resuelve con una lectura: un día en cero, solo las búsquedas, y mirar
     * `todays_points`. 60 = incluido, 63 = aparte.
     *
     * @param {object[]} promotions
     * @returns {number} 0 si no hay nada medible.
     */
    function readDayMax(promotions) {
        const promos = (promotions || []).filter(Boolean);
        const search = readSearchProgress(promos);
        const dailySet = readDailySet(promos);
        // Las ofertas van TODAS, hechas incluidas: es lo que hay hoy, no lo que
        // falta. `readOffers` filtra por `complete` porque lista pendientes.
        const offers = promos.filter(isLooseOffer)
            .reduce((n, p) => n + num(p.attributes.max), 0);
        return (search ? search.max : 0) + (dailySet ? dailySet.points : 0) + offers;
    }

    /**
     * La bonificación de racha que está EN CURSO, con la frase que Bing ya trae
     * hecha («Faltan 3 días para desbloquear tu bonificación de 150 puntos»).
     *
     * Llegan DOS promociones `streakbonus` y hay que elegir una. Dos cosas del
     * dato, las dos contraintuitivas y las dos verificadas en dos cuentas el
     * 2026-09-04:
     *
     *  - **El nombre miente.** `Gamification_Streak_Bonus_Promotion_27Days`
     *    tiene `activity_max` **7** y paga 105 puntos. Sacar el ciclo del
     *    nombre —la lectura obvia— habría escrito 20 días de más. Enumerar por
     *    `type` y leer `activity_max`, nunca el nombre.
     *  - **`activity_progress` significa dos cosas distintas.** En la promo
     *    cuyo bono ya está ganado es la RACHA ENTERA (241 y 21 en las dos
     *    cuentas, clavado con `streakCount` de `StreakProtection`); en la que
     *    está en curso es el ciclo (7 de 10, 1 de 7). De ahí el filtro
     *    `progress <= max`, que deja exactamente una por cuenta sin mirar
     *    nombres.
     *
     * Y por eso se pinta `description` y no un cálculo propio: llega con la
     * cuenta hecha y traducida por el mercado, así que no cuesta una cadena en
     * 22 idiomas. Las dos tarifas vistas son 150/10 y 105/7, o sea 15 puntos
     * por día de racha.
     *
     * @param {object[]} promotions
     * @returns {{text:string,done:number,total:number}|null}
     */
    function readStreakBonus(promotions) {
        const live = (promotions || []).filter(Boolean).find((p) => {
            const a = p.attributes || {};
            if (a.type !== 'streakbonus') return false;
            const total = num(a.activity_max);
            return total > 0 && num(a.activity_progress) <= total;
        });
        if (!live) return null;
        const text = stripTags(live.attributes.description);
        return text ? {
            text: text,
            done: num(live.attributes.activity_progress),
            total: num(live.attributes.activity_max)
        } : null;
    }

    /**
     * La protección de racha: cuántos días de gracia quedan.
     *
     * `type` va con MAYÚSCULA inicial (`StreakProtection`), así que un filtro
     * por `type === 'streak'` no lo ve. Trae además `streakCount`, que es la
     * racha de verdad en días y confirma que la «Jornada actual» del panel SÍ
     * son días seguidos: el 2026-08-22 el contador marcaba 228 y el 2026-09-04
     * —13 días después— `streakCount` marcaba 241, con la otra cuenta cuadrando
     * igual en 21.
     *
     * `isTodayStreakComplete` se lee pero NO se usa como puerta de
     * `decideNext`: es «la racha de hoy está cumplida», que el conjunto diario
     * puede satisfacer sin que queden las búsquedas hechas. La puerta de las
     * búsquedas sigue siendo `search.complete`, que es el dato específico. El
     * 2026-09-04 los dos valían `True` a la vez, o sea que ese volcado no
     * distingue las dos lecturas y no puede autorizar el cambio.
     *
     * @param {object[]} promotions
     * @returns {{days:number,streak:number,todayDone:boolean}|null}
     */
    function readProtection(promotions) {
        const p = (promotions || []).filter(Boolean)
            .find((x) => (x.attributes || {}).type === 'StreakProtection');
        if (!p || !isTrue(p.attributes.streakProtectionStatus)) return null;
        const days = num(p.attributes.remainingDays);
        return days > 0 ? {
            days: days,
            streak: num(p.attributes.streakCount),
            todayDone: isTrue(p.attributes.isTodayStreakComplete)
        } : null;
    }

    /**
     * Los puntos de HOY de todas las fuentes, no solo de las búsquedas.
     *
     * Sale de `level_info.todays_points`, que nunca se había leído. El panel
     * solo sabía de búsquedas (60 de 60), y el 2026-09-04 el día iba por 147.
     *
     * Del resto de `level_info` no se pinta nada, y `level_privileges` en
     * particular NO se puede pintar: dice «5 puntos por cada Búsqueda de Bing,
     * hasta 100 puntos al día» para Oro cuando `points_per_pc_search` es 3 y
     * `bing_search_daily_points` 60. Es texto del programa viejo, idéntico en
     * las dos cuentas.
     *
     * @param {object[]} promotions
     * @returns {number}
     */
    function readTodayPoints(promotions) {
        const p = (promotions || []).filter(Boolean).find((x) => x.name === 'level_info');
        return p ? num((p.attributes || {}).todays_points) : 0;
    }

    /**
     * El nivel de Rewards: cómo se llama, cuántos puntos llevas en su periodo y
     * cuántos te pide para mantenerlo.
     *
     * Es el ÚNICO X/MAX agregado que se puede pintar sin inventar nada, y por
     * eso está aquí a pesar de aportar poco: en las dos cuentas del 2026-09-04
     * iba 2,6× y 2,0× por encima del umbral, o sea que casi siempre dirá «vas
     * bien». Se descartó a cambio el «hoy llevas X de Y en total», que sería
     * mucho más útil pero cuyo denominador NO se puede construir: faltarían las
     * actividades que solo están en la app (50 de los 100 de «Seguir ganando»
     * ese día) y encima no está resuelto si el paso de cada escalera son puntos
     * aparte o los mismos de la actividad que lo dispara — sumando las piezas
     * visibles salen 183 o 140 según cómo se cuente, y el día marcaba 147.
     *
     * El NOMBRE lo pone Bing y no el diccionario: `level_values` es la lista de
     * nombres («Miembro;Nivel Plata;Nivel Oro») y `level_keys` la de claves, así
     * que el nombre es el del mismo puesto que ocupa `level`. Llega traducido
     * por el mercado, igual que «Jornada actual».
     *
     * Lo que NO se lee de aquí son las «2 actividades» que `level_tasks` pide
     * además de los puntos: ese 2 solo existe dentro de una frase localizada, y
     * sacarlo con una regex sería adivinar en 22 mercados. `level_up_actions_progress`
     * da el numerador (3) pero no hay denominador en ningún campo.
     *
     * @param {object[]} promotions
     * @returns {{name:string,progress:number,max:number}|null}
     */
    function readLevel(promotions) {
        const p = (promotions || []).filter(Boolean).find((x) => x.name === 'level_info');
        if (!p) return null;
        const a = p.attributes || {};
        const max = num(a.max);
        if (max <= 0) return null;
        const keys = String(a.level_keys || '').split(';');
        const values = String(a.level_values || '').split(';');
        const i = keys.indexOf(String(a.level || ''));
        return {
            // Sin la pareja de listas la línea se queda con los números, que se
            // entienden igual con el aviso; no se inventa un nombre de nivel.
            name: (i >= 0 && values[i]) ? values[i].trim() : '',
            progress: num(a.progress),
            max: max
        };
    }

    // Socios del check-in que van primero, en este orden: buscar en Bing, el
    // conjunto diario y el registro de la app (`sapphire`), que es lo que se
    // hace sin salir de Bing, y luego Edge. Lo que no esté aquí va después.
    const PARTNER_ORDER = ['bing', 'dset', 'sapphire', 'edge'];

    /** @param {string} key @returns {number} Puesto del socio; los no listados, al final. */
    function partnerRank(key) {
        const i = PARTNER_ORDER.indexOf(key);
        return i === -1 ? PARTNER_ORDER.length : i;
    }

    /**
     * Reduce la tarjeta de check-in a una lista de socios con su racha.
     *
     * Todo vive en UNA promoción (`type: "daily_checkin"`) con los atributos
     * aplanados por socio: `partner_edge_completed`, `partner_edge_currentStep`,
     * `partner_dset_totalSteps`… Los socios NO se listan en ninguna parte, así
     * que se descubren de las propias claves: lo que haya con `_totalSteps` es
     * un socio. Es lo que hace que un socio nuevo (o uno que solo exista en
     * ciertos mercados) entre solo, sin tocar esto.
     *
     * La etiqueta la pone Bing, no el diccionario del script:
     * `partner_X_title` no es texto sino una clave de `localizedStrings`
     * ("DailyCheckIn_Edge_Title"), cuya plantilla lleva los huecos {0} y {1} que
     * rellenan `titleArg0` y `titleArg1` — así sale "Explorar con Edge (0/30
     * min)" o "Conjunto diario (3/3 actividades)". Viene en el idioma del
     * MERCADO, que puede no ser el del panel; es el mismo trato que ya reciben
     * los títulos de las actividades del conjunto diario, y la alternativa sería
     * reescribir a mano un texto que Bing ya da bien.
     *
     * De la misma promo salen dos cosas más, verificadas atributo por atributo
     * el 2026-08-22:
     *
     *  - **Los sellos del puzle**: `activityProgress` / `activity_max` (10 de 12
     *    en el volcado) y `point_max`, que es lo que paga completarlo (1000).
     *    El `offerid` lo dice: `DailyCheckIn_Parent_PuzzleOffer`.
     *  - **El premio del séptimo paso** de cada socio, en `partner_X_points`:
     *    una lista de siete pagos donde el último es el gordo —búsquedas y
     *    conjunto diario `[3…,100]` y `[30…,100]`, la app
     *    `[5,5,10,10,15,15,50]`, Edge `[5,10,20,30,40,80,120]`—. Llega como
     *    TEXTO, como todo lo demás, así que se lee con una regex y no con
     *    JSON.parse.
     *
     * @param {object[]} promotions
     * @param {object} strings - `localizedStrings` de la respuesta (raíz, no userInfo).
     * @returns {{partners:object[],stamps:{done:number,max:number,points:number,label:string}|null}|null}
     */
    function readCheckIn(promotions, strings) {
        const promo = (promotions || []).filter(Boolean)
            .find((p) => (p.attributes || {}).type === 'daily_checkin');
        if (!promo) return null;
        const a = promo.attributes;
        const dict = strings || {};

        const partners = Object.keys(a)
            .map((k) => /^partner_(.+)_totalSteps$/.exec(k))
            .filter(Boolean)
            .map((m) => m[1])
            .map((k) => {
                const template = dict[a[`partner_${k}_title`]] || '';
                const label = template
                    .replace('{0}', a[`partner_${k}_titleArg0`] || '0')
                    .replace('{1}', a[`partner_${k}_titleArg1`] || '0')
                    // Sin plantilla queda el nombre del socio, que es reconocible
                    // (edge, ntp, outlook) y mejor que una línea sin etiqueta.
                    || (k.charAt(0).toUpperCase() + k.slice(1));
                return {
                    key: k,
                    label: label,
                    done: isTrue(a[`partner_${k}_completed`]),
                    step: num(a[`partner_${k}_currentStep`]),
                    total: num(a[`partner_${k}_totalSteps`]),
                    url: a[`partner_${k}_destinationUrl`] || '',
                    priority: num(a[`partner_${k}_cardPriority`]),
                    // `streakEnabled` es el ÚNICO campo que dice si la racha se
                    // puede avanzar. `isEnabled` NO sirve y es una trampa: el
                    // 2026-08-28 llegó `False` en `bing` —la escalera MÁS
                    // avanzada de la cuenta, 3/7— y `undefined` en cuatro de los
                    // siete socios; marcar por él habría tachado justo la que
                    // funciona. Ausente se toma por ACTIVA: no se esconde un
                    // socio porque falte un campo, que es lo que ya pasa con
                    // `claimingPending` (solo existe en `bing`).
                    enabled: String(a[`partner_${k}_streakEnabled`] || '').toLowerCase() !== 'false',
                    // El último de la lista de pagos: lo que da llegar al final
                    // de la escalera, que es lo que hace que valga la pena
                    // seguirla y lo único que el panel no decía.
                    prize: (() => {
                        const nums = String(a[`partner_${k}_points`] || '').match(/\d+/g);
                        return nums ? num(nums[nums.length - 1]) : 0;
                    })()
                };
            })
            // Orden propio, y NO el `cardPriority` de Bing. Manda primero lo
            // que se PUEDE hacer: las rachas que no están habilitadas para esta
            // cuenta se van todas al final, sea cual sea el socio. Antes el
            // corte era por socio fijo, y eso mezclaba `edge` —accionable, solo
            // que sin empezar— con `ntp`, `outlook` y `visualsearch`, que no se
            // pueden avanzar desde aquí; se veían las cuatro igual, en 1/7.
            //
            // Dentro de las habilitadas sigue el orden de siempre: primero lo
            // que se hace en Bing mismo —buscar, el conjunto diario y el
            // registro de la app—, después Edge, y lo que no esté en la lista
            // detrás, donde entre ellos sí manda el orden de Bing.
            .sort((x, y) => (Number(y.enabled) - Number(x.enabled))
                || (partnerRank(x.key) - partnerRank(y.key))
                || (x.priority - y.priority));

        // Los sellos van SIN etiqueta de Bing, al contrario que los socios. Sus
        // `title` y `description` también son claves de `localizedStrings`, pero
        // ahí no son plantillas de dato sino texto motivacional que Bing elige
        // SEGÚN EL ESTADO, y sus huecos no significan lo mismo en cada uno:
        // verificado el 2026-08-25 con 10 de 12 sellos, `DailyCheckIn_Title_Progress`
        // es «¡Ya casi está!» —sin huecos— y `DailyCheckIn_Description_Progress`
        // «¡Estás cerca del gran premio de {0} puntos!», donde {0} son los PUNTOS
        // del premio y no el número de sellos. Rellenarlo como se rellenan los
        // socios habría escrito «el gran premio de 10 puntos». Y como el texto
        // cambia con el estado, tampoco vale fijar qué es {0}: en 3 de 12 la
        // plantilla es otra. Los dos números de la línea (`10/12 · ✱1000`) se
        // entienden solos, así que no hay nada que explicar mal.
        const stampsMax = num(a.activity_max);
        const stamps = stampsMax > 0 ? {
            done: num(a.activityProgress),
            max: stampsMax,
            points: num(a.point_max)
        } : null;

        // El enlace para descargar la app de Bing, sacado de la propia
        // respuesta y NO de una URL fija. Hace falta porque la app es donde
        // vive la mitad de los puntos que este panel no puede enseñar
        // (verificado el 2026-09-04: cinco tarjetas «solo en la aplicación
        // Rewards» a 10 puntos, 50 de los 100 de «Seguir ganando»), y sin nota
        // no hay forma de enterarse de que existe.
        //
        // Se busca por HOST entre los destinos de los socios, no por la clave
        // `sapphire`. Es lo que se quiere de verdad —un enlace a la app— y no
        // un socio con cierto nombre en clave, así que un renombrado no deja la
        // nota apuntando a otra cosa. Hoy lo trae `sapphire` («Registrarse en
        // la aplicación Bing»), y `bingapp.microsoft.com` es la ÚNICA URL de
        // toda la respuesta que no es una imagen.
        //
        // Fijarla a mano se descartó: no se sabe cuál sería la buena, y el
        // precedente está en `OUTLOOK_REWARDS` —`microsoft.com/rewards/outlook-rewards`
        // da 404 sin el segmento de idioma—. Sin enlace en la respuesta no hay
        // nota, que es mejor que una nota a un 404.
        const appUrl = Object.keys(a)
            .filter((k) => /_destinationUrl$/.test(k))
            .map((k) => String(a[k] || ''))
            .find((u) => /^https:\/\/bingapp\.microsoft\.com\//i.test(u)) || '';

        return partners.length ? { partners: partners, stamps: stamps, appUrl: appUrl } : null;
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
            // null cuando el mercado no manda conjunto diario; el panel se
            // limita a no enseñar el bloque.
            dailySet: readDailySet(info.promotions),
            // Las etiquetas del check-in salen de `localizedStrings`, que cuelga
            // de la RAÍZ de la respuesta y no de userInfo.
            checkIn: readCheckIn(info.promotions, data.localizedStrings),
            // `streak` se queda como número y la etiqueta va aparte a
            // propósito: así un snapshot guardado por una versión anterior
            // —que lo tiene como número— sigue pintándose, solo que con la
            // etiqueta vieja del diccionario hasta la siguiente lectura.
            streak: (readStreak(info.promotions) || {}).n || null,
            streakTitle: (readStreak(info.promotions) || {}).title || '',
            // Los cuatro nuevos van como `null`/0 cuando el mercado no los
            // mande, y el panel se limita a no pintar esa línea. Un snapshot
            // guardado por una versión anterior no los trae: llegan como
            // `undefined` y los guardas de `renderTasks` lo tratan igual que la
            // ausencia, así que se pintan a partir de la siguiente lectura.
            offers: readOffers(info.promotions),
            streakBonus: readStreakBonus(info.promotions),
            protection: readProtection(info.promotions),
            todayPoints: readTodayPoints(info.promotions),
            level: readLevel(info.promotions),
            dayMax: readDayMax(info.promotions),
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
        // Un fallo de red NO se guarda. Guardarlo hacía dos daños a la vez:
        // satisfacía el TTL —o sea que bloqueaba los reintentos cinco minutos,
        // y en el móvil el timeout de 8 s se agota con mucha más facilidad— y
        // tiraba el progreso bueno del día, dejando el panel en modo manual sin
        // más síntoma que un aviso gris. Sin guardarlo, la siguiente carga
        // vuelve a encontrar el último dato bueno y lo relee en cuanto caduque.
        if (!s || !s.ok) return;
        GM_setValue(KEY_SNAPSHOT, s);
    }

    /**
     * ¿El snapshot que hay en memoria sirve para decidir? No sirve si no hay, si
     * es de otro día o si pasó el TTL.
     *
     * Hace falta porque el script solo corre al CARGAR la página: una pestaña de
     * Bing abierta desde ayer sigue con su panel pintado y su `rewards` de
     * entonces, sin nada que lo caduque, y quien decide si el día está hecho es
     * el `complete` de ese dato (`decideNext`). Verificado el 2026-08-20: el
     * teléfono mostraba el estado del día anterior —racha, saldo y conjunto
     * diario incluidos— con el escritorio marcando 12/60 pendientes en el mismo
     * momento.
     *
     * Y no sirve tampoco si el último intento falló: guardar el fallo dejaba el
     * panel en modo manual y sin reintentar hasta que caducara el TTL (ver
     * `writeSnapshot`).
     * @returns {boolean}
     */
    function snapshotStale() {
        return !rewards || !rewards.ok || rewards.day !== getToday() ||
            (Date.now() - rewards.at) > SNAPSHOT_TTL;
    }

    /**
     * ¿La página se cargó porque el usuario la recargó a mano (F5, tirar hacia
     * abajo en el móvil)?
     *
     * Eso es una ORDEN de releer, no una consulta, así que no puede mirar el
     * TTL: recargar era justamente lo que el usuario hacía para salir de un
     * «✓ Completado» heredado, y no servía de nada. Navegar por Bing sí sigue
     * mirándolo, que es para lo que existe —si no, sería una petición por
     * página—.
     * @returns {boolean}
     */
    function reloadedByHand() {
        try {
            const nav = performance.getEntriesByType('navigation')[0];
            if (nav) return nav.type === 'reload';
            // Safari viejo (iOS < 15) no trae la entrada de navegación; el API
            // obsoleto sigue ahí y para esto vale igual (1 === TYPE_RELOAD).
            if (performance.navigation) return performance.navigation.type === 1;
        } catch (e) { /* sin dato, se sigue mirando el TTL */ }
        return false;
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
        // El contador BAJANDO no es un atasco: es Rewards estrenando su día.
        // Y no rueda a la medianoche local, sino con el reloj de Microsoft, así
        // que basta con abrir Bing en esa franja para que la referencia se
        // quede con los 60 puntos de ayer. A partir de ahí NINGUNA búsqueda del
        // día puede superarla —el máximo es justo ese 60—, con lo que todas
        // contaban como atasco: a la quinta se gastaban las tres esperas de
        // medio minuto y el resto del día el panel avisaba en rojo de que Bing
        // había dejado de acreditar, siendo falso.
        if (snap.search.progress < seen) {
            GM_setValue(KEY_SEEN_POINTS, snap.search.progress);
            GM_setValue(KEY_STALL, 0);
            GM_setValue(KEY_STALL_RETRY, 0);
            return;
        }
        if (snap.search.progress > seen) {
            GM_setValue(KEY_SEEN_POINTS, snap.search.progress);
            GM_setValue(KEY_STALL, 0);
            // El progreso subió: si veníamos de un atasco, era latencia y ya se
            // resolvió, así que los reintentos vuelven a estar enteros para el
            // siguiente. Sin esto, tres retrasos sueltos a lo largo del día se
            // sumarían y el tercero pararía la sesión sin motivo.
            GM_setValue(KEY_STALL_RETRY, 0);
        } else if (seen >= 0 && GM_getValue(KEY_ACTIVE, false) && !getForce()) {
            // Solo cuenta como atasco mientras se busca: con el panel parado es
            // normal que el contador no se mueva entre cargas.
            //
            // Y tampoco en forzado, donde el contador quieto no es un atasco
            // sino lo esperable: el día está completo y por eso se forzó. Sin
            // esta condición, una sesión pedida a mano se llevaba tres esperas
            // de medio minuto y un aviso en rojo de que Bing dejó de acreditar,
            // que ahí es cierto y no le sirve de nada a quien ya lo sabe.
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
        // El atasco NO entra aquí: no es motivo para parar. Si Bing tarda en
        // acreditar, lo que hace falta son más búsquedas, no rendirse, así que
        // solo cambia el ritmo (una espera para releer) y pinta el aviso. Lo
        // único que detiene la sesión sola es completar el día o el tope de
        // seguridad de arriba.
        // Forzado a mano: manda el número manual y NO el `complete` de la API,
        // que es justo lo que se está sorteando. Se cuenta desde donde se forzó,
        // así que son N búsquedas más y no N en total.
        const forced = getForce();
        if (forced) {
            return (count - forced.from) >= getTotal()
                ? { go: false, reason: 'done' } : { go: true, reason: '' };
        }
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

        // Bing lleva varias búsquedas sin acreditar. Casi siempre es latencia,
        // así que antes de gastar otra búsqueda se espera medio minuto y se
        // relee el progreso —eso no cuesta una búsqueda—, por si los puntos
        // solo venían con retraso.
        //
        // Agotadas las esperas, NO se para: se sigue buscando al ritmo normal
        // hasta completar el día. Las esperas vuelven a estar disponibles en
        // cuanto el contador se mueva (lo hace trackProgress), así que el freno
        // se rearma solo sin necesidad de contarlas aquí.
        const stalled = GM_getValue(KEY_STALL, 0) >= STALL_LIMIT;
        if (stalled) {
            const tries = GM_getValue(KEY_STALL_RETRY, 0);
            if (tries < STALL_RETRIES) {
                GM_setValue(KEY_STALL_RETRY, tries + 1);
                onUpdate(count, true, 'stalled');
                searchTimeout = setTimeout(() => {
                    // Releer, no navegar: la espera no gasta una búsqueda.
                    requestRewards().then((snap) => {
                        rewards = snap;
                        writeSnapshot(snap);
                        // Si el progreso subió, esto pone el contador de atascos
                        // a cero y la siguiente vuelta ya sigue como si nada.
                        trackProgress(snap);
                        executeNextSearch(onUpdate);
                    }).catch((e) => {
                        console.error('(bing-rewards-auto-search): reintento:', e);
                        executeNextSearch(onUpdate);
                    });
                }, Math.floor(Math.random() * (STALL_RETRY_MAX - STALL_RETRY_MIN)) + STALL_RETRY_MIN);
                return;
            }
        }

        onUpdate(count, true, stalled ? 'stalled' : '');

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
    // TOOLTIP PROPIO
    // =============================================
    // Misma caja que en Xbox y Microsoft Store, aquí con la paleta del panel. La
    // regla que lo decide no es si el sitio tiene tooltip nativo, sino de quién es
    // el control: el panel lo pinta este script, con sus colores, así que una caja
    // con esos mismos colores no imita a nadie, se lee como una pieza más suya.
    // Fuera del panel no se toca nada: los `title` de Bing se quedan como están.
    //
    // El código de color sale del propio panel y no de una paleta aparte: fondo
    // `surface`, borde `primary` (el azul de Bing) y sombra, que es exactamente la
    // receta del modal de este script. Así las dos cosas que flotan sobre la
    // página —el diálogo y el aviso— se leen como la misma familia.
    //
    // Va por delegación en el documento y leyendo el `title` que los controles ya
    // llevan puesto, en vez de engancharse a cada uno. Dos motivos:
    //   1. El panel se repinta solo: updateUI vacía la fila de botones en cada
    //      búsqueda, y renderValue y renderKeywordsTab rehacen su pane con
    //      innerHTML. Cualquier enganche por elemento moriría en el primer
    //      repintado, y hay repintado cada 3-10 s mientras la sesión corre.
    //   2. El `title` sigue siendo la fuente del texto, así que un control nuevo
    //      dentro del panel hereda el aviso sin tocar esta sección.
    // Mientras la caja está arriba el `title` se guarda en TIP_STASH_ATTR y se
    // quita del elemento: es lo que evita ver los dos avisos, el nuestro y el del
    // navegador, uno encima del otro. Al cerrarla se devuelve, así que el `title`
    // sigue siendo el nombre accesible del control y el respaldo.
    const TIP_ID = 'bing-rewards-tip';
    const TIP_STYLES_ID = 'bing-rewards-tip-styles';
    const TIP_STASH_ATTR = 'data-bing-rewards-tip';
    const TIP_DELAY_MS = 250;
    const TIP_GAP = 10;     // hueco entre la caja y el panel (o el control)
    const TIP_MARGIN = 8;   // margen que se respeta al borde de la ventana
    // Un elemento deja de casar con [title] en cuanto se le guarda el aviso, así
    // que el escondite entra también en el selector: sin él, volver a entrar en el
    // mismo control se leería como salir de la zona con tooltip y cerraría la caja.
    // El `title` vacío se descarta a propósito: la línea de pista lleva `title=""`
    // cuando no hay nada que avisar, y sin el :not() casaría igual y taparía la
    // búsqueda del aviso de verdad en sus antepasados.
    const TIP_SELECTOR = `[title]:not([title=""]), [${TIP_STASH_ATTR}]`;

    let tipEl = null;
    let tipAnchor = null;    // control que tiene la caja arriba ahora mismo
    let tipPending = null;   // control cuyo retardo está corriendo
    let tipTimer = null;
    let tipBound = false;

    function injectTipStyles() {
        if (document.getElementById(TIP_STYLES_ID)) return;
        const style = document.createElement('style');
        style.id = TIP_STYLES_ID;
        style.textContent = `
            /* Cuelga del <body> y no del panel: el panel tiene overflow:hidden y
               borde redondeado, y sus panes scrollean, así que dentro se
               recortaría. Al colgar de fuera hay que repetir la tipografía, que
               si no la hereda del sitio. */
            #${TIP_ID} {
                position: fixed;
                /* Por encima del panel (99999) y por debajo de los modales
                   (999999), que sí deben taparlo. */
                z-index: 999998;
                /* El tope en vw es para el móvil: el panel ya ocupa casi todo el
                   ancho y una caja de 300px fijos se saldría de la pantalla. */
                max-width: min(300px, calc(100vw - ${TIP_MARGIN * 2}px));
                padding: 8px 10px;
                background: ${colors.surface}; color: ${colors.text};
                border: 1px solid ${colors.primary};
                border-radius: 6px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                font-family: Segoe UI, system-ui, sans-serif;
                font-size: 12px; line-height: 1.35;
                /* Varios avisos pasan de cien caracteres: sin esto salen en una
                   línea infinita fuera de la pantalla. */
                white-space: normal;
                /* La caja no puede robarle el hover al control ni taparle el clic. */
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.12s ease;
            }
            #${TIP_ID}.bing-rewards-tip-visible { opacity: 1; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureTipNode() {
        injectTipStyles();
        if (tipEl && tipEl.isConnected) return tipEl;
        tipEl = document.createElement('div');
        tipEl.id = TIP_ID;
        tipEl.dir = DIR; // en árabe el aviso se ordena como el panel
        tipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tipEl);
        return tipEl;
    }

    /**
     * Coloca la caja al lado del PANEL y centrada en el control, no encima de él
     * como en Xbox: el panel está anclado abajo a la derecha y crece hacia arriba,
     * así que encima de un control lo que hay es más panel y la caja se comería lo
     * que se está mirando. Anclando al panel, además, todos los avisos salen
     * alineados en la misma columna en vez de bailar según el control.
     * @param {HTMLElement} anchor - El control apuntado.
     */
    function positionTip(anchor) {
        const scope = anchor.closest(`#${PANEL_ID}`) || anchor;
        const box = tipEl.getBoundingClientRect();
        const a = anchor.getBoundingClientRect();
        const s = scope.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        // Por defecto a la izquierda del panel; si ahí no cabe, al otro lado.
        let left = s.left - box.width - TIP_GAP;
        if (left < TIP_MARGIN) left = s.right + TIP_GAP;
        let top = a.top + a.height / 2 - box.height / 2;

        // Pantalla estrecha (móvil): no cabe a ningún lado sin salirse, y forzarlo
        // dejaría la caja medio fuera. Ahí se pasa a la regla de Xbox —encima del
        // control, o debajo si arriba no cabe—, que es donde queda sitio cuando lo
        // que falta es ancho y no alto.
        if (left + box.width > vw - TIP_MARGIN) {
            left = a.left + a.width / 2 - box.width / 2;
            top = a.top - box.height - TIP_GAP;
            if (top < TIP_MARGIN) top = a.bottom + TIP_GAP;
        }

        left = Math.max(TIP_MARGIN, Math.min(left, vw - box.width - TIP_MARGIN));
        top = Math.max(TIP_MARGIN, Math.min(top, vh - box.height - TIP_MARGIN));

        tipEl.style.left = `${left}px`;
        tipEl.style.top = `${top}px`;
    }

    /** Muestra la caja de un control y le guarda el `title`. */
    function showTip(anchor) {
        if (!anchor.isConnected) return;  // el panel se repintó durante el retardo
        const text = anchor.getAttribute('title') || anchor.getAttribute(TIP_STASH_ATTR);
        if (!text) return;
        ensureTipNode();
        tipEl.textContent = text;
        anchor.setAttribute(TIP_STASH_ATTR, text);
        anchor.removeAttribute('title');
        tipAnchor = anchor;
        // Primero el texto y la posición, y solo después visible: si no, la caja
        // aparece un fotograma en la esquina anterior antes de recolocarse.
        positionTip(anchor);
        tipEl.classList.add('bing-rewards-tip-visible');
    }

    /** Cierra la caja y le devuelve el `title` al control. */
    function hideTip() {
        clearTimeout(tipTimer);
        tipTimer = null;
        tipPending = null;
        if (tipAnchor) {
            const stashed = tipAnchor.getAttribute(TIP_STASH_ATTR);
            // Se mira el atributo y no su valor: mientras la caja está arriba el
            // control no tiene `title`, así que tenerlo significa que alguien lo
            // reescribió mientras tanto y restaurar pisaría el dato fresco con el
            // viejo. Un `title=""` también cuenta como reescritura: es lo que pone
            // updateUI cuando el aviso deja de aplicar.
            if (stashed != null && !tipAnchor.hasAttribute('title')) tipAnchor.title = stashed;
            tipAnchor.removeAttribute(TIP_STASH_ATTR);
            tipAnchor = null;
        }
        if (tipEl) tipEl.classList.remove('bing-rewards-tip-visible');
    }

    /**
     * Cierra la caja si su control ya no está en el documento. El panel se repinta
     * solo mientras la sesión corre, y sin esto un aviso abierto se quedaría
     * flotando —con el texto viejo— hasta que el ratón se moviera.
     */
    function hideTipIfDetached() {
        if (tipAnchor && !tipAnchor.isConnected) hideTip();
    }

    /**
     * Escribe el aviso de un control respetando la caja abierta. Si el control es
     * justo el que la tiene arriba, su `title` no está puesto —está guardado—, así
     * que escribirlo ahí haría salir los dos avisos a la vez. Lo usa la línea de
     * pista bajo el progreso, que se reescribe sola en cada búsqueda y puede
     * hacerlo con el ratón encima.
     * @param {HTMLElement} el - El control.
     * @param {string} text - El aviso, o '' si ya no hay ninguno.
     */
    function setTipText(el, text) {
        if (tipAnchor === el) {
            if (!text) { hideTip(); el.title = ''; return; }
            el.setAttribute(TIP_STASH_ATTR, text);
            if (tipEl) { tipEl.textContent = text; positionTip(el); }
            return;
        }
        el.title = text;
    }

    /** El control con aviso bajo el puntero/foco, o null si no lo hay. */
    function tipTargetFrom(node) {
        if (!node || !node.closest) return null;
        const el = node.closest(TIP_SELECTOR);
        return el && el.closest(`#${PANEL_ID}`) ? el : null;
    }

    function tipEnter(target) {
        if (!target) { if (tipAnchor || tipPending) hideTip(); return; }
        if (target === tipAnchor || target === tipPending) return;
        hideTip();
        tipPending = target;
        tipTimer = setTimeout(() => { tipPending = null; showTip(target); }, TIP_DELAY_MS);
    }

    /**
     * Engancha el tooltip propio. Una sola vez y por delegación en el documento:
     * no hay nada que reenganchar cuando el panel se repinta.
     */
    function initOwnTooltips() {
        if (tipBound) return;
        tipBound = true;
        // mouseover salta en CADA elemento al que se entra, también en los que no
        // llevan aviso: por eso cierra la caja el simple hecho de salir del
        // control, sin necesidad de un mouseout aparte.
        document.addEventListener('mouseover', (e) => tipEnter(tipTargetFrom(e.target)));
        // Con el puntero fuera del documento (barra del navegador, otra ventana)
        // ya no hay mouseover que cierre la caja.
        document.addEventListener('mouseleave', hideTip);
        // Por teclado el aviso sale sin retardo: llegar tabulando ya es intención.
        // focusin/focusout y no focus/blur porque burbujean: el aviso del modo
        // automático y el del idioma cuelgan de la fila, y quien recibe el foco es
        // la casilla o el <select> de dentro.
        document.addEventListener('focusin', (e) => {
            const target = tipTargetFrom(e.target);
            hideTip();
            if (target) showTip(target);
        });
        document.addEventListener('focusout', hideTip);
        // Con la página en movimiento la caja quedaría flotando fuera de sitio, y
        // tras un clic estorba (el botón ya hizo lo suyo).
        window.addEventListener('scroll', hideTip, { passive: true, capture: true });
        window.addEventListener('resize', hideTip, { passive: true });
        document.addEventListener('click', hideTip, true);
    }

    // =============================================
    // INTERFAZ - PANEL FLOTANTE
    // =============================================

    /**
     * Corta un texto en frases. El punto solo cuenta como final si le sigue un
     * espacio, para no partir "v1.3.2" ni "ko-fi.com"; el punto japonés y el chino
     * (。！？) y el danda del hindi (।) no llevan espacio detrás, así que valen solos.
     */
    function splitSentences(text) {
        const out = [];
        let buf = '';
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            buf += c;
            const cjkEnd = c === '。' || c === '！' || c === '？';
            const plainEnd = (c === '.' || c === '!' || c === '?' || c === '।') &&
                (i + 1 >= text.length || /\s/.test(text[i + 1]));
            if (cjkEnd || plainEnd) { out.push(buf.trim()); buf = ''; }
        }
        if (buf.trim()) out.push(buf.trim());
        return out;
    }

    /** Agrupa las frases en párrafos de `perPara`, para que la prosa respire. */
    function infoParagraphs(text, perPara) {
        const src = String(text || '');
        const sentences = splitSentences(src);
        // Japonés y chino no separan frases con espacio: unirlas con uno metería un
        // hueco que el original no tiene.
        const joiner = /^(ja|zh)/.test(LANG) ? '' : ' ';
        const out = [];
        for (let i = 0; i < sentences.length; i += perPara) {
            out.push(sentences.slice(i, i + perPara).join(joiner));
        }
        return out.length ? out : [src];
    }

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

        // Cuarta línea: la edad del dato de Rewards. En el móvil no hay
        // consola, así que es la única forma de contestar «¿esto es de ahora o
        // es la caché?» —la pregunta que dejó el panel clavado en 60/60—.
        const ageText = document.createElement('div');
        Object.assign(ageText.style, {
            marginTop: '6px', textAlign: 'center', fontSize: '10px',
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

        /**
         * Corre `next` con el progreso del día ya releído.
         *
         * Lo usan los DOS botones con los que el usuario reconsidera el día, y
         * releen SIEMPRE, sin mirar el TTL: un clic es una orden. Mirándolo, de
         * un «✓ Completado» heredado no se salía durante los cinco minutos
         * siguientes —el estado completado no ofrece ▶, solo 🔄, y 🔄 repintaba
         * la misma caché—, que es el mismo encierro de 1.3.4 con otra cerradura.
         * Releer no gasta una búsqueda.
         * @param {function} next
         */
        function withFreshRewards(next) {
            if (!getAuto()) { next(); return; }
            requestRewards().then((snap) => {
                rewards = snap;
                writeSnapshot(snap);
                // La sesión está parada, así que esto solo pone al día la
                // referencia del detector de atascos; su rama de atasco pide
                // KEY_ACTIVE y no cuenta ninguno.
                trackProgress(snap);
                next();
            }).catch((e) => {
                // Un fallo de red no puede dejar el botón muerto: se sigue
                // igual y manda el número manual, como en el resto del script.
                console.error('(bing-rewards-auto-search): al releer:', e);
                next();
            });
        }

        /** Inicia búsquedas desde el conteo actual. */
        function startSession() {
            withFreshRewards(() => {
                GM_setValue(KEY_ACTIVE, true);
                executeNextSearch(updateUI);
            });
        }

        /**
         * Arranca una sesión saltándose el «completado» de Rewards: N búsquedas
         * más contadas desde ahora, con N el número manual de la pestaña ⚙.
         *
         * Releer primero no sobra: casi siempre el «completado» es de verdad y
         * el usuario está viendo dato viejo, y en ese caso lo que quiere es el
         * dato bueno, no gastar veinte búsquedas. Si tras releer sigue completo,
         * el ▶ que pulsó ya dejó el forzado puesto y la sesión sale igual.
         */
        function forceSession() {
            withFreshRewards(() => {
                GM_setValue(KEY_FORCE, { day: getToday(), from: GM_getValue(KEY_COUNT, 0) });
                // Forzar es soltar todos los frenos del día, como reiniciar: si
                // quedó marcado como atascado, el primer paso serían tres
                // esperas de medio minuto antes de buscar nada.
                GM_setValue(KEY_STALL, 0);
                GM_setValue(KEY_STALL_RETRY, 0);
                GM_setValue(KEY_ACTIVE, true);
                executeNextSearch(updateUI);
            });
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
            // hay que soltar el freno, o el botón no haría nada. Y con él los
            // reintentos, que si no el primer atasco pararía la sesión en seco.
            GM_setValue(KEY_STALL, 0);
            GM_setValue(KEY_STALL_RETRY, 0);
            // Y el forzado, que si no el contador a cero se leería contra el
            // punto desde el que se forzó y el panel arrancaría en negativo.
            GM_setValue(KEY_FORCE, null);
            if (searchTimeout) clearTimeout(searchTimeout);
            // Reiniciar vuelve a poner a Rewards al mando, así que relee: es el
            // camino de vuelta del forzado al automático.
            withFreshRewards(() => updateUI(0, false, ''));
        }

        /**
         * Edad del dato de Rewards, en el idioma del panel y SIN cadenas nuevas:
         * Intl.RelativeTimeFormat ya sabe decir «hace 12 segundos» en los 22
         * idiomas del script, así que esto no pasa por el diccionario.
         * @param {number} at - Sello del snapshot (Date.now() de su lectura).
         */
        function ago(at) {
            const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
            const [n, unit] = secs < 60 ? [secs, 'second']
                : secs < 3600 ? [Math.round(secs / 60), 'minute']
                : [Math.round(secs / 3600), 'hour'];
            try {
                return new Intl.RelativeTimeFormat(LANG, { numeric: 'auto' }).format(-n, unit);
            } catch (e) {
                return `-${n} ${unit}`;
            }
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
            // Forzado se pinta como el modo manual: lo que gobierna es el número
            // de búsquedas, no los puntos. Enseñar «60/60 pts» mientras busca a
            // propósito por encima de eso, con un estimado de «~0 restantes»,
            // sería el panel contradiciéndose a sí mismo.
            const forced = getForce();
            const api = usingApi() && !forced;
            const s = api ? rewards.search : null;
            const total = getTotal();
            const local = count - (forced ? forced.from : 0);
            const done = api ? s.complete : local >= total;
            const progress = api ? `${fmt(s.progress)}/${fmt(s.max)} ${t.pointsShort}` : `${local}/${total}`;

            hintText.style.display = 'none';
            // Por setTipText y no por `title` directo: este repintado corre en cada
            // búsqueda y puede pillar el ratón encima de la pista, con su aviso ya
            // abierto (ver la sección TOOLTIP PROPIO).
            setTipText(hintText, '');

            // Va antes de cualquier return de esta función: el estado que más
            // necesita saber la edad del dato es justo el que corta arriba.
            if (rewards && rewards.ok) {
                ageText.textContent = `↻ ${ago(rewards.at)}`;
                ageText.style.display = 'block';
            } else {
                ageText.style.display = 'none';
            }

            /** Aviso bajo el progreso: estimado si sigue, motivo si paró. */
            function hint(text, tip, color) {
                hintText.textContent = text;
                setTipText(hintText, tip || '');
                hintText.style.color = color || colors.gray;
                hintText.style.display = 'block';
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
                // ▶ TAMBIÉN en completado, y es la única salida de mano que hay
                // cuando Rewards dice que el día está hecho y el usuario sabe
                // que no: antes el estado terminal solo ofrecía 🔄, que releía
                // el mismo «completo» y volvía aquí. Reutiliza la etiqueta y el
                // aviso de ▶ a propósito, para no meter una cadena nueva en los
                // 22 idiomas por un botón que hace lo mismo que dice: buscar.
                btnRow.appendChild(createActionBtn(t.start, t.startTooltip, colors.primary, forceSession));
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

            // El aviso de atasco ya no acompaña a una parada: la sesión sigue,
            // y esto solo explica por qué está tardando más de lo previsto. Va
            // primero porque, mientras dura, es más útil que el estimado —que
            // justo entonces es el número menos fiable del panel—.
            if (reason === 'stalled') {
                hint(t.stalled, t.stalledTip, colors.red);
            // El estimado va con "~" a propósito: en varios mercados las primeras
            // búsquedas del día no acreditan, así que suele quedarse corto. Quien
            // decide cuándo parar es la API, no este número.
            } else if (!done && api && s.remaining !== null) {
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

        // --- Tareas del día ---
        //
        // Las búsquedas ya las cubre el resto del panel; esto es lo OTRO que
        // pide la racha y que no se automatiza: el conjunto diario. Va encima
        // del valor de los puntos porque es accionable y aquello es informativo.

        const tasksBox = document.createElement('div');
        tasksBox.id = TASKS_ID;
        Object.assign(tasksBox.style, {
            marginTop: '10px', paddingTop: '8px',
            borderTop: `1px solid ${colors.border}`,
            fontSize: '11px', lineHeight: '1.5', display: 'none'
        });

        /**
         * Una línea de la lista. Enlace si la tarea está por hacer y hay a dónde
         * ir; texto a secas si ya está hecha.
         *
         * El paso de la racha va DELANTE de la etiqueta a propósito: la etiqueta
         * de Bing puede pasar de sesenta caracteres ("Leer correos electrónicos
         * de Outlook (0/3 correos electrónicos)") y la línea se recorta por la
         * derecha, así que detrás el número sería lo primero en desaparecer.
         *
         * @param {string} label
         * @param {boolean} done
         * @param {string} url - '' si no hay destino.
         * @param {string} [tip] - Aviso; por omisión, la etiqueta entera.
         */
        function taskLine(label, done, url, tip) {
            const link = !done && !!url;
            const row = document.createElement(link ? 'a' : 'div');
            row.textContent = `${done ? '✓' : '→'} ${label}`;
            row.title = tip || label;
            Object.assign(row.style, {
                display: 'block', color: done ? colors.green : colors.primary,
                textDecoration: 'none',
                // La etiqueta de Bing ya trae su propio recuento y no cabe en el
                // ancho del panel; el texto entero queda en el aviso.
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            });
            if (!link) return row;

            row.href = url;
            row.target = '_blank';
            row.rel = 'noopener noreferrer';
            row.onmouseenter = () => { row.style.textDecoration = 'underline'; };
            row.onmouseleave = () => { row.style.textDecoration = 'none'; };
            row.onclick = () => {
                // Abrir una tarea DE BING con la sesión corriendo la echaría a
                // perder: el script se ejecuta también en la pestaña nueva, ve la
                // sesión activa y a los 3-10 s la manda a otra búsqueda —y el
                // cuestionario del conjunto diario hay que contestarlo—. Así que
                // se detiene, que es lo que haría el usuario a mano. Fuera de
                // bing.com no hay nada que parar (Edge, MSN y Outlook se van a
                // otro dominio, donde este script ni corre).
                //
                // Diferido a propósito: stopSession repinta el panel y se lleva
                // por delante esta misma fila. Quitar el elemento durante el
                // manejador puede cancelar la apertura de la pestaña, que es la
                // acción por omisión del clic; con el setTimeout el enlace ya se
                // ha abierto cuando llega el repintado.
                if (/^https?:\/\/(www\.)?bing\.com\//i.test(url) && GM_getValue(KEY_ACTIVE, false)) {
                    setTimeout(stopSession, 0);
                }
            };
            return row;
        }

        /**
         * Pinta las tareas del día: la racha global, una línea por socio del
         * check-in y, colgando del conjunto diario, un enlace por actividad que
         * falte. Solo aparece con la casilla del modo automático marcada, que es
         * la que autoriza a consultar; sin ella no hay dato que enseñar.
         */
        function renderTasks() {
            tasksBox.innerHTML = '';
            const ok = getAuto() && rewards && rewards.ok;
            const ci = ok ? rewards.checkIn : null;
            const ds = (ok && rewards.dailySet && rewards.dailySet.total) ? rewards.dailySet : null;
            const offers = (ok && rewards.offers && rewards.offers.length) ? rewards.offers : null;
            const bonus = ok ? rewards.streakBonus : null;
            const prot = ok ? rewards.protection : null;
            const today = ok ? num(rewards.todayPoints) : 0;
            const lvl = ok ? rewards.level : null;
            if (!ci && !ds && !offers && !bonus && !prot && !today && !lvl) {
                tasksBox.style.display = 'none';
                return;
            }
            tasksBox.style.display = 'block';

            if (ok && rewards.streak) {
                const head = document.createElement('div');
                // Con la etiqueta de Bing («Jornada actual») no va tooltip: el
                // que había decía «días seguidos cumpliendo con Rewards», y este
                // contador no es eso (ver readStreak). Un aviso propio costaría
                // una cadena en 22 idiomas para explicar un número que Bing ya
                // nombra bien. Sin `streakTitle` —snapshot de una versión
                // anterior— se cae a la cadena vieja hasta la siguiente lectura.
                head.textContent = rewards.streakTitle
                    ? `${rewards.streakTitle}: ${fmt(rewards.streak)}`
                    : t.streakDays.replace('{n}', fmt(rewards.streak));
                head.style.color = colors.gray;
                tasksBox.appendChild(head);

                // Los sellos, justo debajo: es el marcador de todo lo de abajo
                // —cada escalera completada da uno— y lo que paga cerrarlo. El
                // ✱ es el mismo glifo con el que Bing marca los puntos en sus
                // propias tarjetas, así que no hace falta ninguna etiqueta.
                const st = ci ? ci.stamps : null;
                if (st && st.max) {
                    const line = document.createElement('div');
                    line.textContent = `🧩 ${fmt(st.done)}/${fmt(st.max)}` +
                        (st.points ? ` · ✱${fmt(st.points)}` : '');
                    // Aquí sí va `streakTip`, que era el aviso de la jornada: su
                    // primera frase —«días seguidos cumpliendo con Rewards»— era
                    // falsa y se quitó de los 22 idiomas, y lo que queda explica
                    // justo esto: las escaleras de siete pasos de abajo, de las
                    // que sale cada sello, y que el séptimo paga el premio gordo.
                    line.title = t.streakTip;
                    line.style.cursor = 'help';
                    line.style.color = colors.gray;
                    tasksBox.appendChild(line);
                }
            }

            /**
             * Una línea de contexto: gris, con su glifo y su aviso, sin estado
             * que marcar. Es el formato que ya tenían los sellos, y por lo mismo
             * no lleva rótulo propio: el número lo explica el aviso, que ya
             * había que traducir, y no una etiqueta aparte en 22 idiomas.
             */
            function infoLine(text, tip) {
                const line = document.createElement('div');
                line.textContent = text;
                line.title = tip;
                line.style.cursor = 'help';
                line.style.color = colors.gray;
                tasksBox.appendChild(line);
            }

            // Los puntos del día ENTEROS, que no son los de las búsquedas: el
            // 2026-09-04 el panel decía 60/60 con el día ya en 147.
            if (today) infoLine(`\u{1F4C8} ${fmt(today)} ${t.pointsShort}`,
                t.todayPointsTip.replace('{n}', fmt(ok ? num(rewards.dayMax) : 0)));
            // La frase de Bing tal cual, que ya trae la cuenta hecha y traducida
            // por el mercado («Faltan 3 días para desbloquear tu bonificación de
            // 150 puntos»). A diferencia de `taskLine`, `infoLine` NO recorta:
            // la frase pasa de los sesenta caracteres y en el ancho del panel
            // se parte en dos líneas, que es lo que hay que hacer aquí — con
            // puntos suspensivos lo primero en perderse sería justo la cifra.
            // El aviso repite el texto para quien llegue por teclado.
            if (bonus) infoLine(`\u{1F525} ${bonus.text}`, bonus.text);
            if (prot) infoLine(`\u{1F6E1}\uFE0F ${fmt(prot.days)}`, t.protectionTip);
            // El nivel va el último de las líneas grises: es lo de plazo más
            // largo de las cuatro, y lo que menos cambia de un día a otro.
            if (lvl) infoLine(`\u{1F3C5} ${lvl.name ? lvl.name + ' \u00B7 ' : ''}` +
                `${fmt(lvl.progress)}/${fmt(lvl.max)}`, t.levelTip);

            /** Las actividades que faltan, colgando del conjunto diario. */
            function appendDailySetLinks() {
                if (!ds || !ds.pending.length) return;
                const group = document.createElement('div');
                group.title = t.dailySetTip;
                group.style.paddingLeft = '12px';
                ds.pending.forEach((item) => {
                    // El título viene ya traducido por Bing al idioma del
                    // mercado, así que no pasa por `t`.
                    group.appendChild(taskLine(item.title, false, item.url));
                });
                tasksBox.appendChild(group);
            }

            /**
             * Las ofertas sueltas del día, cada una con lo que paga. Van ENCIMA
             * de la nota «Más actividades en Rewards», no colgando de ella.
             *
             * Se probó al revés —sangradas bajo la nota, como el conjunto diario
             * cuelga de su socio— porque son literalmente esas actividades: las
             * tres que lista el panel salen en
             * `rewards.bing.com/earn#moreactivities`, verificado el 2026-09-04.
             * Y ESO ES JUSTO POR LO QUE NO VALE. Colgadas, la nota deja de ser
             * un sitio al que ir y se convierte en el rótulo de la lista: quien
             * la lee da por hecho que abajo está todo, y ya no abre el enlace.
             * Lo que hay al otro lado es medio centenar de puntos que el panel
             * NO puede enseñar —el 2026-09-04, cinco tarjetas «solo en la
             * aplicación Rewards» a 10 puntos, o sea 50 de los 100 de la
             * sección— y, con ellas, la existencia misma de la app de Rewards,
             * que es lo que el aviso quiere que descubra. Es el mismo papel que
             * hace la nota de Xbox.
             *
             * Así que el orden importa y no es cosmético: primero lo que se
             * puede hacer desde aquí, y al final el enlace a lo que no.
             *
             * Van con el mismo glifo de premio que los séptimos pasos de las
             * escaleras, así que no necesitan rótulo: el título llega traducido
             * por Bing y el resto lo dice el número. Y como apuntan a bing.com,
             * `taskLine` ya detiene la sesión al abrirlas, que es justo lo que
             * hace falta con un cuestionario que hay que contestar.
             */
            function appendOffers() {
                if (!offers) return;
                offers.forEach((o) => {
                    tasksBox.appendChild(taskLine(
                        `\u2731${fmt(o.points)} \u00B7 ${o.title}`, false, o.url, t.offersTip));
                });
            }

            /**
             * Una nota: un enlace a algo que no es una tarea con estado —ni se
             * marca ni se cuenta, solo dice dónde mirar—, por eso va en gris y
             * en negrita y no como fila de `taskLine`.
             *
             * @param {string} url
             * @param {string} text
             * @param {string} tip
             */
            function noteLine(url, text, tip) {
                const note = document.createElement('a');
                note.href = url;
                note.target = '_blank';
                note.rel = 'noopener noreferrer';
                note.textContent = `+ ${text}`;
                note.title = tip;
                Object.assign(note.style, {
                    display: 'block', color: colors.gray, textDecoration: 'none',
                    // Del mismo tamaño que las filas —lo hereda del bloque— y en
                    // negrita, que es lo que la separa: no es una tarea con
                    // estado, no se marca ni se cuenta.
                    fontWeight: 'bold', marginTop: '2px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                });
                note.onmouseenter = () => { note.style.color = colors.text; };
                note.onmouseleave = () => { note.style.color = colors.gray; };
                tasksBox.appendChild(note);
            }

            /** Cierra la lista de socios con el enlace a las demás actividades. */
            function appendExtraNote() {
                noteLine(REWARDS_MORE, t.extraOffersNote, t.extraOffersTip);
            }

            /**
             * Pasos COMPLETADOS de la escalera, que no es lo que trae Bing.
             *
             * `currentStep` NOMBRA EL PASO EN CURSO empezando en 1, no cuenta
             * completados. Estuvo sin decidir desde el 2026-08-26 y lo zanjó la
             * propia interfaz de Microsoft el 2026-08-28: la ficha «Racha de
             * navegación en Edge» dibuja `+5` y SEIS CÍRCULOS VACÍOS con
             * «Minutos: 0/30» mientras `partner_edge_currentStep` vale 1. Cero
             * días hechos, `currentStep` en 1. Así que el panel llevaba toda la
             * vida pintando un día de más en las siete escaleras.
             *
             * Contrastado paso a paso contra las tarjetas de «Racha» del
             * dashboard, con los cuatro socios habilitados de una cuenta:
             *
             *   bing      ✔ ✔ ✓3  ○○○ ✱100 → 3 ganados, currentStep 3, hoy hecho
             *   dset      ✔ ✓30   ○○○○✱100 → 2 ganados, currentStep 2, hoy hecho
             *   sapphire  ✔ ✔ ✓10 ○○○ ✱50  → 3 ganados, currentStep 3, hoy hecho
             *   edge      +5      ○○○○○✱120→ 0 ganados, currentStep 1, hoy NO
             *
             * La píldora OSCURA con ✓ es el día de hoy ya ganado; la CLARA con
             * `+` es hoy pendiente. Y el 🔥 de cada tarjeta cuenta los ganados,
             * así que confirma lo mismo por otra vía. De ahí sale la fórmula:
             * `step` si hoy está hecho, `step - 1` si no.
             *
             * **Un caso donde las dos hipótesis coinciden no es evidencia.** El
             * panel de Outlook enseñaba «CONJUNTO DIARIO 2/7» con `currentStep`
             * 2, y estuvo a punto de hacer revertir esto por «desalinearnos de
             * la interfaz de Microsoft»: con el día ya hecho, contar completados
             * y nombrar el paso dan el MISMO número. Quien separa las dos
             * lecturas es una escalera con hoy sin hacer, que es Edge.
             */
            function doneSteps(p) {
                return Math.max(0, Math.min(p.total, p.done ? p.step : p.step - 1));
            }

            let dsetShown = false;
            if (ci) {
                ci.partners.forEach((p) => {
                    const steps = p.total ? `${fmt(doneSteps(p))}/${fmt(p.total)}` : '';
                    const prize = p.prize ? `${steps ? ' ' : ''}✱${fmt(p.prize)}` : '';
                    const lead = (steps || prize) ? `${steps}${prize} · ` : '';
                    // El conjunto diario va a su sección del panel de Rewards,
                    // que es donde de verdad se hacen sus actividades.
                    const url = p.key === 'dset' ? REWARDS_DAILYSET : p.url;

                    // La escalera a punto de cerrarse, en dorado y con 🎁. No es
                    // un capricho de color: el séptimo paso es donde está el
                    // dinero. Verificado el 2026-08-26 en dos cuentas, los siete
                    // socios pagan 1203 puntos por semana y 670 de ellos —el
                    // 56%— están en los séptimos pasos (bing 3·6+100, dset
                    // 30·6+100, edge 5,10,20,30,40,80+120, sapphire 60+50, y
                    // ntp, outlook y visualsearch 5·6+100). Saltarse ese día
                    // cuesta más que los seis anteriores juntos.
                    //
                    // El `- 1` que había aquí era una cobertura mientras no se
                    // supiera si `currentStep` contaba completados o nombraba el
                    // paso en curso: con `>=` se encendía bajo las dos lecturas.
                    // Resuelto el 2026-08-28 (ver `doneSteps`), nombra el paso,
                    // así que el día del premio es `step === total` y la
                    // cobertura sobraba —encendía DOS días antes, no uno como
                    // decía este comentario—.
                    //
                    // Una racha que no se puede avanzar no cierra nada, por muy
                    // arriba que esté su `currentStep`: sin `p.enabled` el 🎁
                    // saldría en escaleras que el usuario no puede tocar.
                    const closing = p.enabled && !p.done && p.total > 1 && p.step >= p.total;
                    const row = taskLine(`${closing ? '🎁 ' : ''}${lead}${p.label}`, p.done, url,
                        p.enabled ? '' : t.streakOffTip);
                    // Después de `taskLine`, que fija el color por el ✓/→. El
                    // hover solo toca el subrayado, así que el color aguanta.
                    if (closing) row.style.color = colors.gold;
                    // Las que no se pueden avanzar desde esta cuenta van en gris,
                    // el mismo tono de las notas: siguen a la vista —son puntos
                    // que existen— pero dejan de leerse como tarea pendiente.
                    //
                    // El aviso es CADENA PROPIA y no el `toggleDescription` del
                    // socio, aunque ese venga de Bing. Se probó con el de Bing y
                    // el de `outlook` llega SIN TRADUCIR («Go to your mobile
                    // device, log into Outlook.com on the mobile browser…»), así
                    // que el panel en español enseñaba un aviso en inglés. Que un
                    // texto venga del mercado no garantiza que venga en el idioma
                    // del mercado, y las ramas poco transitadas son justo donde
                    // falla —el mismo trato de las etiquetas NO vale aquí, porque
                    // aquellas sí llegan traducidas—.
                    //
                    // Lo que dice es lo único afirmable de las tres y viene de
                    // Microsoft: la página de la promoción de Outlook las
                    // encuadra como «disponible para determinados miembros… en
                    // determinados mercados». O sea «no disponible para ti», no
                    // «no existe» — por eso la fila no desaparece.
                    else if (!p.enabled) row.style.color = colors.gray;
                    tasksBox.appendChild(row);
                    if (p.key === 'dset') { dsetShown = true; appendDailySetLinks(); }
                });
                // Al final de TODOS los socios, no a mitad de la lista. Antes
                // partía el grupo por socio fijo, y con el orden nuevo —activas
                // primero, inactivas al final— ese corte habría dejado «Más
                // actividades en Rewards» justo delante de las rachas
                // inhabilitadas, que no son «más actividades»: la nota es un
                // enlace, y como enlace cierra bien la lista entera. Separar
                // activas de inactivas con un rótulo propio habría costado una
                // cadena nueva en 22 idiomas para decir lo que ya dicen el gris
                // y el aviso de Bing.
                // Las que sí se pueden hacer desde aquí, y la nota cerrando.
                appendOffers();
                appendExtraNote();
            }
            // Sin tarjeta de check-in —o con una que no traiga el conjunto
            // diario— este queda igualmente, que es la tarea con enlaces útiles.
            if (!dsetShown && ds) {
                tasksBox.appendChild(taskLine(
                    `${t.dailySet}: ${fmt(ds.done)}/${fmt(ds.total)}`,
                    !ds.pending.length, REWARDS_DAILYSET, t.dailySetTip));
                appendDailySetLinks();
            }
            // Sin socios no hubo `appendExtraNote`: aquí van las dos, en el
            // mismo orden que arriba.
            if (!ci && offers) { appendOffers(); appendExtraNote(); }

            // Outlook y Xbox van al final del todo y fuera de cualquier grupo:
            // son lo único de la lista que el script no puede leer ni marcar. Su
            // aviso existe sobre todo para contestar la pregunta que provoca su
            // ausencia —«¿y los puntos de Xbox?»—, no para mandar a ninguna parte.
            //
            // Lo de Outlook se comprobó el 2026-08-28 y es firme: la tarjeta
            // «Explorar en Outlook» EXISTE en el flyout: el control
            // `ExploreOnOutlookEngagementCard` llega con `enabled: true`, está
            // en el layout de esta superficie y su encabezado viene ya
            // traducido en `localizedStrings`. Pero el
            // servidor no le manda ofertas. Los títulos de las misiones dan cero
            // apariciones en el JSON entero (con `partner_outlook_totalSteps` y
            // `PCSearch` de control positivo), y con el flyout abierto no hay
            // NINGUNA petición que las traiga: los recursos son el propio
            // `getuserinfo`, el `ncheader`, un `reportActivity` de telemetría y
            // el JS del widget. No hay nada que leer desde Bing.
            //
            // Y el aviso NO lleva cifra a propósito. Las misiones rotan: dos de
            // 10 puntos dos días seguidos y tres de 10 al siguiente, así que
            // cualquier número escrito aquí mentiría la mayoría de los días —y
            // no se puede calcular, que es justo el hallazgo—.
            // La app de Bing va primera de las tres: es la más cercana a lo
            // que el panel ya hace —sus actividades salen en la MISMA sección
            // del panel de Rewards a la que manda la nota de arriba, solo que
            // marcadas «Bloqueada»— y la única cuyo enlace sale de la
            // respuesta en vez de estar fijado aquí.
            if (ci && ci.appUrl) noteLine(ci.appUrl, t.bingAppNote, t.bingAppTip);
            noteLine(OUTLOOK_REWARDS, t.outlookNote, t.outlookTip);
            noteLine(XBOX_REWARDS, t.xboxNote, t.xboxTip);
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
            // Las tareas se repintan aquí y no en updateUI porque renderValue es
            // el final de TODOS sus caminos, incluidos los tres que salen antes
            // por `return`.
            renderTasks();
            // Cierre del aviso huérfano. Va detrás de los vaciados de arriba y
            // del de renderTasks; updateUI ya vació la fila de botones antes de
            // llegar aquí, así que una sola llamada cubre los tres repintados.
            hideTipIfDetached();
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
        searchTab.pane.appendChild(ageText);
        searchTab.pane.appendChild(tasksBox);
        searchTab.pane.appendChild(valueBox);

        // =============================================
        // TAB: KEYWORDS
        // =============================================

        function renderKeywordsTab() {
            kwTab.pane.innerHTML = '';
            hideTipIfDetached();   // ídem: la pestaña se rehace entera

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
        // Ficha en rejilla de dos columnas y prosa en bloques aparte, como el modal
        // de informacion de los scripts de Twitch y Kick. Antes los ocho datos —los
        // cuatro cortos y los tres parrafos largos— iban por igual como "etiqueta en
        // negrita + valor" en la misma linea: el ancho de cada etiqueta empujaba a su
        // valor, asi que los cortos salian escalonados, y los largos arrancaban a
        // media linea y seguian hasta el final sin un solo corte.
        const infoMeta = document.createElement('div');
        Object.assign(infoMeta.style, {
            display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)',
            columnGap: '8px', rowGap: '4px', fontSize: '11px', lineHeight: '1.4'
        });
        [
            { label: t.infoName, value: 'Bing Rewards Auto Search' },
            { label: t.infoVersion, value: SCRIPT_VERSION },
            { label: t.infoAuthor, value: 'g31w0fw0rld' },
            { label: t.infoGitHub, value: 'github.com/g31w0fw0rld/bing-rewards-auto-search', isLink: true },
            { label: '☕ Ko-fi:', value: 'ko-fi.com/g31w0fw0rld', isLink: true }
        ].forEach(line => {
            const labelEl = document.createElement('div');
            labelEl.textContent = line.label;
            Object.assign(labelEl.style, {
                fontWeight: 'bold', color: colors.gray, whiteSpace: 'nowrap'
            });
            infoMeta.appendChild(labelEl);

            const val = document.createElement('div');
            // Sin esto la URL no parte y estira el panel mas alla de su ancho.
            Object.assign(val.style, { minWidth: '0', overflowWrap: 'anywhere' });
            if (line.isLink) {
                const a = document.createElement('a');
                a.href = 'https://' + line.value;
                a.textContent = line.value;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.color = colors.primary;
                a.style.textDecoration = 'underline';
                val.appendChild(a);
            } else {
                val.textContent = line.value;
            }
            infoMeta.appendChild(val);
        });
        infoTab.pane.appendChild(infoMeta);

        // Los tres bloques de prosa, cada uno con su encabezado y troceado en
        // parrafos. La descripcion pasa de 1000 caracteres: en un solo bloque no se
        // lee, y aqui no hay markdown que la estructure.
        [
            { title: t.infoDescription, text: t.infoDescriptionText },
            { title: t.infoPrivacy, text: t.infoPrivacyText },
            { title: t.infoHow, text: t.infoHowText }
        ].forEach(sec => {
            const h = document.createElement('div');
            // La misma etiqueta de antes, sin los dos puntos: ya no encabeza una
            // linea, encabeza un bloque. Se quitan tambien los de ancho completo del
            // chino y el espacio previo del frances.
            h.textContent = String(sec.title || '').replace(/\s*[:：]\s*$/, '');
            Object.assign(h.style, {
                fontWeight: 'bold', color: colors.primary, fontSize: '11px',
                marginTop: '12px', marginBottom: '4px'
            });
            infoTab.pane.appendChild(h);
            infoParagraphs(sec.text, 2).forEach(p => {
                const para = document.createElement('div');
                para.textContent = p;
                Object.assign(para.style, {
                    fontSize: '11px', lineHeight: '1.45', marginBottom: '6px'
                });
                infoTab.pane.appendChild(para);
            });
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
        initOwnTooltips();
        const count = GM_getValue(KEY_COUNT, 0);
        const active = GM_getValue(KEY_ACTIVE, false);

        // Se pinta primero con el último snapshot conocido para que el panel no
        // aparezca vacío mientras la red va y viene.
        rewards = readSnapshot();
        updateUI(count, active, '');

        // Con sesión activa se relee siempre: cada carga de página es una
        // búsqueda hecha y el progreso de hace un minuto ya no vale. Y con una
        // recarga a mano también, que es una orden explícita. Navegando parado
        // basta el snapshot mientras esté fresco, para no lanzar una petición
        // por cada página de Bing que se visite.
        const needsFetch = getAuto() && (active || reloadedByHand() || snapshotStale());

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
