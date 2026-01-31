// Main application logic

const App = {
    currentModule: '1.1',
    messages: [],
    isLoading: false,

    init() {
        this.bindEvents();
        this.loadState();
        this.updateUI();
    },

    bindEvents() {
        // Settings modal
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('open-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.closeSettings();
        });

        // Provider change
        document.getElementById('provider').addEventListener('change', (e) => {
            this.updateModelOptions(e.target.value);
        });

        // Start course
        document.getElementById('start-btn').addEventListener('click', () => this.startModule());

        // Send message
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('user-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('user-input').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });

        // Reset
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Начать курс заново? Весь прогресс будет сброшен.')) {
                this.reset();
            }
        });

        // Module dots
        document.querySelectorAll('.module-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                const moduleId = e.target.dataset.module;
                if (this.canAccessModule(moduleId)) {
                    this.switchModule(moduleId);
                }
            });
        });
    },

    loadState() {
        const settings = Storage.getSettings();
        const progress = Storage.getProgress();

        this.currentModule = progress.currentModule || '1.1';

        // Load history for current module
        this.messages = Storage.getHistory(this.currentModule);

        // Update settings form
        document.getElementById('provider').value = settings.provider;
        document.getElementById('api-key').value = settings.apiKey;
        this.updateModelOptions(settings.provider);
        document.getElementById('model').value = settings.model;
    },

    updateUI() {
        const isConfigured = Storage.isConfigured();
        const progress = Storage.getProgress();

        // Enable/disable controls
        document.getElementById('start-btn').disabled = !isConfigured;
        document.getElementById('user-input').disabled = !isConfigured || this.messages.length === 0;
        document.getElementById('send-btn').disabled = !isConfigured || this.messages.length === 0;

        // Update start button text
        const startBtn = document.getElementById('start-btn');
        if (this.messages.length > 0) {
            startBtn.textContent = 'Продолжить';
        } else {
            startBtn.textContent = 'Начать курс';
        }

        // Update progress bar
        const completedCount = progress.completedModules.length;
        const totalModules = Object.keys(Course.modules).length;
        const progressPercent = (completedCount / totalModules) * 100;
        document.getElementById('progress-fill').style.width = progressPercent + '%';

        // Update module dots
        document.querySelectorAll('.module-dot').forEach(dot => {
            const moduleId = dot.dataset.module;
            dot.classList.remove('active', 'completed');

            if (progress.completedModules.includes(moduleId)) {
                dot.classList.add('completed');
            } else if (moduleId === this.currentModule) {
                dot.classList.add('active');
            }
        });

        // Render messages
        this.renderMessages();

        // Update status
        if (!isConfigured) {
            this.setStatus('Настрой API для начала', 'error');
        } else {
            this.setStatus('');
        }
    },

    renderMessages() {
        const container = document.getElementById('messages');

        if (this.messages.length === 0) {
            // Show welcome message
            container.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        <h3>Добро пожаловать в Social Design Foundations!</h3>
                        <p>Интерактивный курс по проектированию кооперативных форматов.</p>
                        <p>Для начала <button id="open-settings-inline" class="btn-link">настрой API</button>, затем нажми "Начать курс".</p>
                    </div>
                </div>
            `;
            // Rebind settings link
            const settingsLink = document.getElementById('open-settings-inline');
            if (settingsLink) {
                settingsLink.addEventListener('click', () => this.openSettings());
            }
            return;
        }

        // Show messages when there are any
        container.innerHTML = '';

        this.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.role === 'user' ? 'user' : 'assistant'}`;

            const content = document.createElement('div');
            content.className = 'message-content';
            content.innerHTML = this.formatMarkdown(msg.content);

            div.appendChild(content);
            container.appendChild(div);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },

    formatMarkdown(text) {
        // Simple markdown formatting
        let html = text
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            // Blockquotes
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            // Tables (simple)
            .replace(/\|(.+)\|/g, (match) => {
                const cells = match.split('|').filter(c => c.trim());
                if (cells.every(c => c.trim().match(/^-+$/))) {
                    return ''; // Skip separator row
                }
                const isHeader = match.includes('---');
                const cellTag = isHeader ? 'th' : 'td';
                return '<tr>' + cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('') + '</tr>';
            })
            // Lists
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            // Paragraphs
            .replace(/\n\n/g, '</p><p>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap in paragraph
        html = '<p>' + html + '</p>';

        // Fix list wrapping
        html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

        // Fix table wrapping
        html = html.replace(/(<tr>.*?<\/tr>)+/g, '<table>$&</table>');

        return html;
    },

    openSettings() {
        document.getElementById('settings-modal').classList.add('active');
    },

    closeSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    },

    updateModelOptions(provider) {
        const select = document.getElementById('model');
        const models = API.getModels(provider);

        select.innerHTML = models.map(m =>
            `<option value="${m.id}">${m.name}</option>`
        ).join('');
    },

    saveSettings() {
        const settings = {
            provider: document.getElementById('provider').value,
            apiKey: document.getElementById('api-key').value,
            model: document.getElementById('model').value
        };

        Storage.saveSettings(settings);
        this.closeSettings();
        this.updateUI();

        if (Storage.isConfigured()) {
            this.setStatus('API настроен', '');
        }
    },

    async startModule() {
        console.log('startModule called, messages:', this.messages.length);

        if (this.messages.length > 0) {
            // Continue from where we left off
            document.getElementById('user-input').disabled = false;
            document.getElementById('send-btn').disabled = false;
            document.getElementById('user-input').focus();
            return;
        }

        // Start fresh
        this.setLoading(true);
        this.setStatus('Запускаю курс...', 'loading');

        try {
            const settings = Storage.getSettings();
            console.log('Settings:', { provider: settings.provider, model: settings.model, hasKey: !!settings.apiKey });

            const systemPrompt = Course.getSystemPrompt(this.currentModule);
            console.log('System prompt length:', systemPrompt.length);

            // Initial message to start the module
            const response = await API.sendMessage(
                systemPrompt,
                [{ role: 'user', content: 'Начинаем!' }],
                settings
            );

            console.log('Got response, length:', response.length);

            this.messages = [
                { role: 'user', content: 'Начинаем!' },
                { role: 'assistant', content: response }
            ];

            Storage.saveHistory(this.currentModule, this.messages);
            this.updateUI();

            document.getElementById('user-input').disabled = false;
            document.getElementById('send-btn').disabled = false;
            document.getElementById('user-input').focus();

        } catch (error) {
            console.error('startModule error:', error);
            this.setStatus('Ошибка: ' + error.message, 'error');
            // Show error in messages area too
            this.addSystemMessage('❌ Ошибка API: ' + error.message + '. Проверь API-ключ и попробуй снова.');
        } finally {
            this.setLoading(false);
        }
    },

    async sendMessage() {
        const input = document.getElementById('user-input');
        const text = input.value.trim();

        if (!text || this.isLoading) return;

        // Check for module navigation
        if (text.toLowerCase().includes('следующий модуль')) {
            const nextModule = Course.modules[this.currentModule]?.next;
            if (nextModule) {
                Storage.markModuleComplete(this.currentModule);
                this.switchModule(nextModule);
                input.value = '';
                return;
            }
        }

        // Add user message
        this.messages.push({ role: 'user', content: text });
        Storage.saveHistory(this.currentModule, this.messages);
        this.renderMessages();
        input.value = '';
        input.style.height = 'auto';

        this.setLoading(true);

        try {
            const settings = Storage.getSettings();
            const systemPrompt = Course.getSystemPrompt(this.currentModule);

            const response = await API.sendMessage(
                systemPrompt,
                this.messages,
                settings
            );

            this.messages.push({ role: 'assistant', content: response });
            Storage.saveHistory(this.currentModule, this.messages);
            this.renderMessages();

        } catch (error) {
            this.setStatus('Ошибка: ' + error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    },

    switchModule(moduleId) {
        this.currentModule = moduleId;
        Storage.setCurrentModule(moduleId);
        this.messages = Storage.getHistory(moduleId);
        this.updateUI();

        // Show module switch message
        const moduleName = Course.modules[moduleId]?.title || moduleId;
        this.addSystemMessage(`Переход к модулю ${moduleId}: ${moduleName}`);
    },

    canAccessModule(moduleId) {
        const progress = Storage.getProgress();
        const modules = Object.keys(Course.modules);
        const moduleIndex = modules.indexOf(moduleId);
        const currentIndex = modules.indexOf(this.currentModule);

        // Can access current, completed, or next module
        if (progress.completedModules.includes(moduleId)) return true;
        if (moduleId === this.currentModule) return true;
        if (moduleIndex === currentIndex + 1 && progress.completedModules.includes(this.currentModule)) return true;

        return false;
    },

    addSystemMessage(text) {
        const container = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = 'message system';
        div.innerHTML = `<div class="message-content"><p>${text}</p></div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    setStatus(text, type = '') {
        const status = document.getElementById('status');
        status.textContent = text;
        status.className = 'status' + (type ? ' ' + type : '');
    },

    setLoading(loading) {
        this.isLoading = loading;
        document.getElementById('send-btn').disabled = loading;
        document.getElementById('user-input').disabled = loading;
        document.getElementById('start-btn').disabled = loading;

        if (loading) {
            this.setStatus('Думаю...', 'loading');
        } else {
            this.setStatus('');
        }
    },

    reset() {
        Storage.clearHistory();
        this.currentModule = '1.1';
        this.messages = [];
        Storage.setCurrentModule('1.1');
        this.updateUI();

        // Restore welcome message
        const container = document.getElementById('messages');
        container.innerHTML = `
            <div class="message system">
                <div class="message-content">
                    <h3>Добро пожаловать в Social Design Foundations!</h3>
                    <p>Интерактивный курс по проектированию кооперативных форматов.</p>
                    <p>Для начала <button id="open-settings" class="btn-link">настрой API</button>, затем нажми "Начать курс".</p>
                </div>
            </div>
        `;

        // Rebind open-settings
        document.getElementById('open-settings').addEventListener('click', () => this.openSettings());
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => App.init());
