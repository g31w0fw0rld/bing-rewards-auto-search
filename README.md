# Bing Rewards Auto Search

Tampermonkey userscript that automates daily Bing searches to collect Microsoft Rewards points. / Userscript de Tampermonkey que automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards.

> [!WARNING]
> **USE AT YOUR OWN RISK / USO BAJO TU PROPIO RIESGO:** automating activity may violate the Microsoft Rewards terms and put your account at risk. / Automatizar la actividad puede infringir los términos de Microsoft Rewards y poner tu cuenta en riesgo.

<img src="docs/screenshot-search.png" width="330" alt="The search tab of the floating panel, showing the counter and the start button">

*Search tab: progress and the controls, which change with the state — start, continue, stop or restart. / Pestaña de búsqueda: el progreso y los controles, que cambian según el estado — iniciar, continuar, detener o reiniciar.*

<img src="docs/screenshot-keywords.png" width="330" alt="The keywords tab, with the keyword chips and the edit, reset and count controls">

*Keywords tab: every keyword as a chip you can click to delete, plus bulk edit, reset to defaults and the search-count setting. / Pestaña de palabras clave: cada palabra como una etiqueta que se borra con un clic, más edición masiva, restaurar predeterminadas y el ajuste del número de búsquedas.*

<img src="docs/screenshot-info.png" width="330" alt="The info tab, showing the language selector and the full script information">

*Info tab: the script's own language selector, then what it does, how it works and its privacy terms. / Pestaña de información: el selector de idioma del propio script, y luego qué hace, cómo funciona y sus términos de privacidad.*

## English

### What it does

**Searching**
- Runs your daily Bing searches automatically so you can collect the Microsoft Rewards search points without doing them one by one.
- **How many is up to you:** anywhere from 1 to 100, set with the ⚙ button (20 by default). The counter shows progress against that number.
- **Start, continue, stop and restart.** The controls change with the state: a paused run offers *continue* and *restart*, a finished one only *restart*.
- **Progress survives reloads.** Each search is a real navigation, so the counter lives in storage rather than in the page — closing the tab or navigating away does not lose your place.
- **The counter resets on its own each day at midnight,** which is when Rewards resets too.

**How it avoids looking like a robot**
- **Queries are built, not repeated:** each one combines one to three of your keywords at random, so no two runs look alike.
- **It rotates search types** the way a person browses — 70% web, plus images, videos, shopping and news.
- **Delays are randomised between 3 and 10 seconds**, biased toward the middle of that range rather than uniform, and roughly one search in five gets a long 10–25 second "reading pause" instead.
- **Each URL carries rotated parameters** (`form`, `cvid`, `PC`) of the kind Bing sets on its own searches, and the script detects mobile versus desktop to send the right ones.

**Keywords**
- The default list ships with about 35 everyday terms and phrases; it is yours to change.
- **Click a chip to delete it**, use **+** to add — several at once, separated by commas — or **edit all** as one comma-separated line.
- **Reset to default** puts the original list back.

**Panel**
- Three tabs — search, keywords, info — in a floating panel you can **collapse**, and it remembers whether you left it open.
- **Script language selector** in the info tab: Spanish, English or Auto. Bing does not expose its own language to the page in a way the script can read, so without this the panel would always follow your browser rather than the store you set. Changing it reloads the page.

**Language:** your browser's, or whichever you pick in the info tab.

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [bing-rewards-auto-search.user.js](https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Site:** `bing.com`

## Español

### Qué hace

**Búsquedas**
- Ejecuta tus búsquedas diarias en Bing automáticamente, para juntar los puntos de búsqueda de Microsoft Rewards sin hacerlas una por una.
- **Cuántas lo decides tú:** de 1 a 100, con el botón ⚙ (20 por defecto). El contador muestra el avance sobre ese número.
- **Iniciar, continuar, detener y reiniciar.** Los controles cambian según el estado: una corrida en pausa ofrece *continuar* y *reiniciar*, una terminada solo *reiniciar*.
- **El progreso sobrevive a las recargas.** Cada búsqueda es una navegación real, así que el contador vive en el almacenamiento y no en la página — cerrar la pestaña o irte a otro sitio no pierde tu avance.
- **El contador se reinicia solo cada día a medianoche,** que es cuando Rewards también se reinicia.

**Cómo evita parecer un robot**
- **Las consultas se construyen, no se repiten:** cada una combina al azar entre una y tres de tus palabras clave, así que no hay dos corridas iguales.
- **Rota los tipos de búsqueda** como navegaría una persona — 70% web, más imágenes, vídeos, compras y noticias.
- **Los retrasos son aleatorios entre 3 y 10 segundos**, sesgados hacia el centro de ese rango en vez de uniformes, y aproximadamente una de cada cinco búsquedas recibe en su lugar una "pausa de lectura" larga de 10 a 25 segundos.
- **Cada URL lleva parámetros rotados** (`form`, `cvid`, `PC`) del tipo que Bing pone en sus propias búsquedas, y el script detecta móvil o escritorio para enviar los correctos.

**Palabras clave**
- La lista por defecto trae unos 35 términos y frases cotidianas; es tuya para cambiarla.
- **Haz clic en una etiqueta para borrarla**, usa **+** para añadir —varias de golpe, separadas por comas— o **edítalas todas** como una sola línea separada por comas.
- **Restaurar predeterminadas** devuelve la lista original.

**Panel**
- Tres pestañas —búsqueda, palabras clave, información— en un panel flotante que puedes **plegar**, y recuerda si lo dejaste abierto.
- **Selector de idioma del script** en la pestaña de información: español, inglés o Auto. Bing no expone su propio idioma a la página de forma que el script pueda leerlo, así que sin esto el panel seguiría siempre al navegador y no a la tienda que hayas configurado. Al cambiarlo se recarga la página.

**Idioma:** el de tu navegador, o el que elijas en la pestaña de información.

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [bing-rewards-auto-search.user.js](https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitio:** `bing.com`

## Privacy / Privacidad

**EN:** the script makes no requests to external servers: to search it changes the URL within `bing.com`, exactly as if you typed the query yourself. It stores in the userscript manager's storage (`GM_setValue`, in your browser) only your keywords, the configured search total, the daily counter and date, whether the panel is collapsed, and your language preference. It does not read your Microsoft account or your history, and nothing is sent to third parties or to the author. Note that the searches appear in your Bing / Microsoft Rewards history like any normal search.

**ES:** el script no hace ninguna petición a servidores externos: para buscar cambia la URL dentro de `bing.com`, igual que si escribieras la consulta a mano. Guarda en el almacenamiento del gestor de userscripts (`GM_setValue`, en tu navegador) solo tus palabras clave, el total de búsquedas configurado, el contador y la fecha del día, si el panel está plegado y tu preferencia de idioma. No lee tu cuenta de Microsoft ni tu historial, y no se envía nada a terceros ni al autor. Ten en cuenta que las búsquedas quedan en tu historial de Bing / Microsoft Rewards como cualquier búsqueda normal.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
