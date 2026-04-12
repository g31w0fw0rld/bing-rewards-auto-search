// ==UserScript==
// @name         Bing Rewards Auto Search
// @namespace    https://www.bing.com/
// @version      1.0.0
// @description  Automates daily Bing searches to collect Microsoft Rewards points. Multi-language panel with customizable keywords.
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

    const SCRIPT_VERSION = '1.0.0';

    // =============================================
    // INTERNACIONALIZACION (i18n)
    // =============================================

    const userLang = (navigator.language || 'en').split('-')[0];
    const i18n = {
        es: {
            tabSearch: '🔍',
            tabKeywords: '🏷️',
            tabInfo: 'ℹ️',
            tabSearchTooltip: 'Búsqueda',
            tabKeywordsTooltip: 'Palabras clave',
            tabInfoTooltip: 'Información',
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
            infoTitle: 'Información del script',
            infoName: 'Nombre:',
            infoVersion: 'Versión:',
            infoDescription: 'Descripción:',
            infoDescriptionText: 'Automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards. Panel con palabras clave personalizables y soporte multiidioma.',
            infoAuthor: 'Autor:',
            infoGitHub: 'GitHub:',
            infoHow: 'Cómo funciona:',
            infoHowText: 'El script genera búsquedas combinando las palabras clave configuradas. Cada búsqueda navega a Bing con un delay aleatorio de 3-8 segundos para simular uso natural. El contador se resetea diariamente.',
        },
        en: {
            tabSearch: '🔍',
            tabKeywords: '🏷️',
            tabInfo: 'ℹ️',
            tabSearchTooltip: 'Search',
            tabKeywordsTooltip: 'Keywords',
            tabInfoTooltip: 'Information',
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
            infoTitle: 'Script Information',
            infoName: 'Name:',
            infoVersion: 'Version:',
            infoDescription: 'Description:',
            infoDescriptionText: 'Automates daily Bing searches to collect Microsoft Rewards points. Panel with customizable keywords and multi-language support.',
            infoAuthor: 'Author:',
            infoGitHub: 'GitHub:',
            infoHow: 'How it works:',
            infoHowText: 'The script generates searches by combining configured keywords. Each search navigates to Bing with a random 3-8 second delay to simulate natural usage. The counter resets daily.',
        },
    };
    const t = i18n[userLang] || i18n.en;

    // =============================================
    // CONSTANTES
    // =============================================

    const SEARCH_URL = 'https://www.bing.com/search?q=';
    const TOTAL_SEARCHES = 20;
    const MIN_DELAY = 3000;
    const MAX_DELAY = 8000;

    const KEY_COUNT = 'bing-rewards-count';
    const KEY_DATE = 'bing-rewards-date';
    const KEY_ACTIVE = 'bing-rewards-active';
    const KEY_KEYWORDS = 'bing-rewards-keywords';
    const KEY_COLLAPSED = 'bing-rewards-collapsed';

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
        red: '#e74c3c',
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
        'how to make', 'what is the best', 'where to find', 'how to learn',
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
     * Genera un delay aleatorio entre MIN_DELAY y MAX_DELAY.
     * @returns {number}
     */
    function getRandomDelay() {
        return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;
    }

    /** @type {number|null} */
    let searchTimeout = null;

    /**
     * Ejecuta la siguiente búsqueda si quedan pendientes.
     * @param {function} onUpdate - Callback para actualizar la interfaz.
     */
    function executeNextSearch(onUpdate) {
        const count = GM_getValue(KEY_COUNT, 0);

        if (count >= TOTAL_SEARCHES) {
            GM_setValue(KEY_ACTIVE, false);
            onUpdate(count, false);
            return;
        }

        onUpdate(count, true);

        const delay = getRandomDelay();
        searchTimeout = setTimeout(() => {
            GM_setValue(KEY_COUNT, count + 1);
            window.location.href = SEARCH_URL + encodeURIComponent(generateQuery());
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
        Object.assign(overlay.style, {
            position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '999999',
            transition: 'opacity 180ms ease', opacity: '0',
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            backgroundColor: colors.surface, color: colors.text, borderRadius: '14px',
            padding: '24px 28px', minWidth: '300px', maxWidth: '440px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: `1px solid ${colors.primary}`,
            fontFamily: 'Segoe UI, system-ui, sans-serif', fontSize: '13px',
            transition: 'transform 180ms ease, opacity 180ms ease',
            transform: 'translateY(8px) scale(0.98)', opacity: '0',
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
            cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit',
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
                fontFamily: 'inherit', fontSize: '13px',
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
        Object.assign(panel.style, {
            position: 'fixed', bottom: '16px', right: '16px', zIndex: '99999',
            backgroundColor: colors.surface, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: '12px',
            padding: '0', fontFamily: 'Segoe UI, system-ui, sans-serif',
            fontSize: '13px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            minWidth: '240px', maxWidth: '300px',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        });

        // --- Header ---
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: `1px solid ${colors.border}`,
            background: `linear-gradient(135deg, ${colors.primaryDark}22, ${colors.surface})`,
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
            flexDirection: 'column', overflow: 'hidden',
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
                border: 'none', fontFamily: 'inherit',
            });
            tab.onmouseenter = () => { if (!tab.dataset.active) tab.style.color = colors.text; };
            tab.onmouseleave = () => { if (!tab.dataset.active) tab.style.color = colors.gray; };
            tabBar.appendChild(tab);
            tabs.push(tab);

            const pane = document.createElement('div');
            pane.style.display = 'none';
            pane.style.padding = '10px 12px';
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
            display: 'flex', gap: '6px', justifyContent: 'center',
        });

        function createActionBtn(icon, tooltip, color, onClick) {
            const btn = document.createElement('button');
            btn.textContent = icon;
            btn.title = tooltip;
            Object.assign(btn.style, {
                padding: '6px 18px', backgroundColor: color, color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontFamily: 'inherit',
                transition: 'opacity 0.15s',
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

            if (count >= TOTAL_SEARCHES) {
                statusText.textContent = `✓ ${t.completed} (${count}/${TOTAL_SEARCHES})`;
                statusText.style.color = colors.green;
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.primary, restartCounter));
            } else if (active) {
                statusText.textContent = `${t.searching}... ${count}/${TOTAL_SEARCHES}`;
                statusText.style.color = colors.text;
                btnRow.appendChild(createActionBtn(t.stop, t.stopTooltip, colors.red, stopSession));
            } else if (count > 0) {
                statusText.textContent = `${t.paused}: ${count}/${TOTAL_SEARCHES}`;
                statusText.style.color = colors.gray;
                btnRow.appendChild(createActionBtn(t.continue_, t.continueTooltip, colors.primary, startSession));
                btnRow.appendChild(createActionBtn(t.restart, t.restartTooltip, colors.red, restartCounter));
            } else {
                statusText.textContent = `${t.ready}: 0/${TOTAL_SEARCHES}`;
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
                maxHeight: '150px', overflowY: 'auto', marginBottom: '10px',
            });

            const kws = getKeywords();
            kws.forEach(kw => {
                const chip = document.createElement('span');
                chip.textContent = kw;
                Object.assign(chip.style, {
                    padding: '2px 8px', backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`, borderRadius: '12px',
                    fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                    color: colors.text,
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
                color: colors.primary, fontWeight: 'bold',
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
                display: 'flex', gap: '6px',
            });

            // Botón editar todas (separadas por coma)
            const editKwBtn = document.createElement('button');
            editKwBtn.textContent = `✏️ ${t.editKeywords}`;
            Object.assign(editKwBtn.style, {
                padding: '4px 10px', backgroundColor: colors.bg,
                color: colors.gray, border: `1px solid ${colors.border}`,
                borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                fontFamily: 'inherit', flex: '1', transition: 'all 0.15s',
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
                fontFamily: 'inherit', flex: '1', transition: 'all 0.15s',
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
        }

        renderKeywordsTab();

        // =============================================
        // TAB: INFO
        // =============================================

        const infoLines = [
            { label: t.infoName, value: 'Bing Rewards Auto Search' },
            { label: t.infoVersion, value: SCRIPT_VERSION },
            { label: t.infoDescription, value: t.infoDescriptionText },
            { label: t.infoAuthor, value: 'g31w0fw0rld' },
            { label: t.infoGitHub, value: 'github.com/g31w0fw0rld/bing-rewards-auto-search', isLink: true },
            { label: t.infoHow, value: t.infoHowText },
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

        if (active && count < TOTAL_SEARCHES) {
            executeNextSearch(updateUI);
        } else {
            updateUI(count, active);
        }
    } catch (e) {
        console.error('(bing-rewards-auto-search): Error:', e);
    }
})();
