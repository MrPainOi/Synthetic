/**
 * CEISA 4.0 - Custom Select & Dropdown Engine
 * Hallmark Cobalt Precision UI Component
 * Provides full 2-way sync with native <select> elements, keyboard a11y,
 * badge extraction, custom SVG chevrons, and complete light/dark theme support.
 */

(function () {
    'use strict';

    const CHEVRON_SVG = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    `;

    const CHECK_SVG = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    `;

    let activeOpenDropdown = null;

    // Helper: Parse label and badge from option text or attributes
    function parseOptionData(option) {
        const fullText = option.textContent.trim();
        let label = fullText;
        let badge = option.dataset.badge || '';
        let badgeType = option.dataset.badgeType || 'default';

        if (!badge) {
            // Check for pattern like "Memiliki API (PPh 2.5%)"
            const match = fullText.match(/^(.*?)\s*\((.*?)\)$/);
            if (match) {
                label = match[1].trim();
                badge = match[2].trim();
            }
        }

        if (badge) {
            if (badge.includes('7.5%') || badge.toLowerCase().includes('lartas') || badge.toLowerCase().includes('non-api')) {
                badgeType = 'warn';
            } else if (badge.includes('2.5%') || badge.toLowerCase().includes('bebas')) {
                badgeType = 'success';
            }
        }

        return {
            value: option.value,
            label: label,
            badge: badge,
            badgeType: badgeType,
            disabled: option.disabled,
            selected: option.selected
        };
    }

    function createCustomSelect(nativeSelect) {
        if (!nativeSelect || nativeSelect.dataset.customSelectInit === 'true') {
            return;
        }

        nativeSelect.dataset.customSelectInit = 'true';
        nativeSelect.classList.add('ceisa-select-native-hidden');

        // Create main wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'ceisa-custom-select';
        if (nativeSelect.id) {
            wrapper.id = 'customSelect_' + nativeSelect.id;
        }
        if (nativeSelect.dataset.selectWidth) {
            wrapper.style.width = nativeSelect.dataset.selectWidth;
        }

        // Create Trigger Button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'ceisa-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const currentDisplay = document.createElement('div');
        currentDisplay.className = 'ceisa-select-current';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'ceisa-select-label';

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'ceisa-select-badge';
        badgeSpan.style.display = 'none';

        currentDisplay.appendChild(labelSpan);
        currentDisplay.appendChild(badgeSpan);

        const chevronSpan = document.createElement('span');
        chevronSpan.className = 'ceisa-select-chevron';
        chevronSpan.innerHTML = CHEVRON_SVG;

        trigger.appendChild(currentDisplay);
        trigger.appendChild(chevronSpan);
        wrapper.appendChild(trigger);

        // Create Dropdown Box
        const dropdown = document.createElement('div');
        dropdown.className = 'ceisa-select-dropdown';
        dropdown.setAttribute('role', 'listbox');

        // Search bar if options count is large (> 6)
        let searchInput = null;
        if (nativeSelect.options.length > 6) {
            const searchWrap = document.createElement('div');
            searchWrap.className = 'ceisa-select-search-wrap';
            searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'ceisa-select-search-input';
            searchInput.placeholder = 'Cari opsi...';
            searchWrap.appendChild(searchInput);
            dropdown.appendChild(searchWrap);
        }

        // Options List Container
        const optionsList = document.createElement('div');
        optionsList.className = 'ceisa-select-options';
        dropdown.appendChild(optionsList);
        wrapper.appendChild(dropdown);

        // Populate Options
        function renderOptions() {
            optionsList.innerHTML = '';
            Array.from(nativeSelect.options).forEach((opt, idx) => {
                const data = parseOptionData(opt);
                const optEl = document.createElement('div');
                optEl.className = 'ceisa-select-option';
                optEl.setAttribute('role', 'option');
                optEl.dataset.value = data.value;
                optEl.dataset.index = idx;

                if (data.selected) {
                    optEl.classList.add('is-selected');
                }
                if (data.disabled) {
                    optEl.classList.add('is-disabled');
                }

                const textSpan = document.createElement('span');
                textSpan.className = 'ceisa-select-option-text';
                textSpan.textContent = data.label;
                optEl.appendChild(textSpan);

                if (data.badge) {
                    const b = document.createElement('span');
                    b.className = 'ceisa-select-badge ' + (data.badgeType === 'warn' ? 'warn' : (data.badgeType === 'success' ? 'success' : ''));
                    b.textContent = data.badge;
                    optEl.appendChild(b);
                }

                const checkSpan = document.createElement('span');
                checkSpan.className = 'ceisa-select-option-check';
                checkSpan.innerHTML = CHECK_SVG;
                optEl.appendChild(checkSpan);

                optEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (data.disabled) return;
                    selectValue(data.value);
                });

                optionsList.appendChild(optEl);
            });
            updateTriggerDisplay();
        }

        // Update trigger presentation
        function updateTriggerDisplay() {
            const selectedOpt = nativeSelect.options[nativeSelect.selectedIndex];
            if (!selectedOpt) return;

            const data = parseOptionData(selectedOpt);
            labelSpan.textContent = data.label;

            if (data.badge) {
                badgeSpan.textContent = data.badge;
                badgeSpan.className = 'ceisa-select-badge ' + (data.badgeType === 'warn' ? 'warn' : (data.badgeType === 'success' ? 'success' : ''));
                badgeSpan.style.display = 'inline-block';
            } else {
                badgeSpan.style.display = 'none';
            }

            // Sync selected class in dropdown
            optionsList.querySelectorAll('.ceisa-select-option').forEach(el => {
                if (el.dataset.value === nativeSelect.value) {
                    el.classList.add('is-selected');
                } else {
                    el.classList.remove('is-selected');
                }
            });
        }

        // Selection Handler
        function selectValue(val) {
            if (nativeSelect.value !== val) {
                nativeSelect.value = val;
                // Dispatch native events so calculators / forms react immediately
                nativeSelect.dispatchEvent(new Event('input', { bubbles: true }));
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateTriggerDisplay();
            closeDropdown();
            trigger.focus();
        }

        // Open Dropdown
        function openDropdown() {
            if (activeOpenDropdown && activeOpenDropdown !== wrapper) {
                activeOpenDropdown.classList.remove('is-open');
                const prevTrigger = activeOpenDropdown.querySelector('.ceisa-select-trigger');
                if (prevTrigger) prevTrigger.setAttribute('aria-expanded', 'false');
            }

            wrapper.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            activeOpenDropdown = wrapper;

            // Scroll selected option inside options container only (never scroll parent window!)
            const selectedEl = optionsList.querySelector('.ceisa-select-option.is-selected');
            if (selectedEl) {
                optionsList.scrollTop = selectedEl.offsetTop - optionsList.offsetTop;
            }

            if (searchInput) {
                searchInput.value = '';
                filterOptions('');
                setTimeout(() => searchInput.focus({ preventScroll: true }), 50);
            }
        }

        // Close Dropdown
        function closeDropdown() {
            wrapper.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            if (activeOpenDropdown === wrapper) {
                activeOpenDropdown = null;
            }
        }

        // Toggle
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrapper.classList.contains('is-open')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        // Search Filter
        function filterOptions(query) {
            const q = query.toLowerCase().trim();
            optionsList.querySelectorAll('.ceisa-select-option').forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(q)) {
                    opt.style.display = 'flex';
                } else {
                    opt.style.display = 'none';
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterOptions(e.target.value);
            });
            searchInput.addEventListener('click', (e) => e.stopPropagation());
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeDropdown();
                    trigger.focus();
                } else if (e.key === 'Enter') {
                    // Select first visible option
                    const firstVis = optionsList.querySelector('.ceisa-select-option:not([style*="display: none"])');
                    if (firstVis && !firstVis.classList.contains('is-disabled')) {
                        selectValue(firstVis.dataset.value);
                    }
                }
            });
        }

        // Keyboard navigation on trigger
        trigger.addEventListener('keydown', (e) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
                e.preventDefault();
                if (!wrapper.classList.contains('is-open')) {
                    openDropdown();
                } else if (e.key === 'ArrowDown') {
                    moveHighlight(1);
                } else if (e.key === 'ArrowUp') {
                    moveHighlight(-1);
                } else if (e.key === 'Enter' || e.key === ' ') {
                    const highlighted = optionsList.querySelector('.ceisa-select-option.is-highlighted');
                    if (highlighted) {
                        selectValue(highlighted.dataset.value);
                    } else {
                        closeDropdown();
                    }
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        function moveHighlight(direction) {
            const visibleOpts = Array.from(optionsList.querySelectorAll('.ceisa-select-option:not([style*="display: none"])'));
            if (!visibleOpts.length) return;

            let currIdx = visibleOpts.findIndex(el => el.classList.contains('is-highlighted'));
            if (currIdx === -1) {
                currIdx = visibleOpts.findIndex(el => el.classList.contains('is-selected'));
            }

            visibleOpts.forEach(el => el.classList.remove('is-highlighted'));

            let nextIdx = currIdx + direction;
            if (nextIdx < 0) nextIdx = visibleOpts.length - 1;
            if (nextIdx >= visibleOpts.length) nextIdx = 0;

            const target = visibleOpts[nextIdx];
            target.classList.add('is-highlighted');
            optionsList.scrollTop = target.offsetTop - optionsList.offsetTop;
        }

        // Listen for programmatic updates to native select
        nativeSelect.addEventListener('change', () => {
            updateTriggerDisplay();
        });

        // Initial render and insert into DOM
        renderOptions();
        nativeSelect.parentNode.insertBefore(wrapper, nativeSelect.nextSibling);

        // Expose instance helper
        wrapper._ceisaSelect = {
            refresh: renderOptions,
            select: selectValue
        };
    }

    // Global click listener to close open select
    document.addEventListener('click', (e) => {
        if (activeOpenDropdown && !activeOpenDropdown.contains(e.target)) {
            activeOpenDropdown.classList.remove('is-open');
            const trig = activeOpenDropdown.querySelector('.ceisa-select-trigger');
            if (trig) trig.setAttribute('aria-expanded', 'false');
            activeOpenDropdown = null;
        }
    });

    // Public API
    window.initCustomSelects = function (container = document) {
        // Query elements to upgrade
        const targets = container.querySelectorAll(`
            select[data-custom-select],
            select.ceisa-custom-select-target,
            .hscode-calc-card select,
            select.form-control-ceisa
        `);

        targets.forEach(createCustomSelect);
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.initCustomSelects());
    } else {
        window.initCustomSelects();
    }
})();
