// Storage module for localStorage persistence

const Storage = {
    KEYS: {
        SETTINGS: 'sd_settings',
        PROGRESS: 'sd_progress',
        HISTORY: 'sd_history',
        CURRENT_MODULE: 'sd_current_module'
    },

    // Settings (API key, provider, model)
    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : {
            provider: 'anthropic',
            apiKey: '',
            model: 'claude-sonnet-4-20250514'
        };
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    // Progress (completed modules)
    getProgress() {
        const data = localStorage.getItem(this.KEYS.PROGRESS);
        return data ? JSON.parse(data) : {
            completedModules: [],
            currentModule: '1.1'
        };
    },

    saveProgress(progress) {
        localStorage.setItem(this.KEYS.PROGRESS, JSON.stringify(progress));
    },

    markModuleComplete(moduleId) {
        const progress = this.getProgress();
        if (!progress.completedModules.includes(moduleId)) {
            progress.completedModules.push(moduleId);
        }
        this.saveProgress(progress);
        return progress;
    },

    setCurrentModule(moduleId) {
        const progress = this.getProgress();
        progress.currentModule = moduleId;
        this.saveProgress(progress);
    },

    // Chat history (per module)
    getHistory(moduleId) {
        const key = `${this.KEYS.HISTORY}_${moduleId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    saveHistory(moduleId, messages) {
        const key = `${this.KEYS.HISTORY}_${moduleId}`;
        localStorage.setItem(key, JSON.stringify(messages));
    },

    addMessage(moduleId, role, content) {
        const history = this.getHistory(moduleId);
        history.push({ role, content, timestamp: Date.now() });
        this.saveHistory(moduleId, history);
        return history;
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        // Also clear module-specific history
        ['1.1', '1.2', '1.3'].forEach(moduleId => {
            localStorage.removeItem(`${this.KEYS.HISTORY}_${moduleId}`);
        });
    },

    // Clear history only (keep settings)
    clearHistory() {
        localStorage.removeItem(this.KEYS.PROGRESS);
        ['1.1', '1.2', '1.3'].forEach(moduleId => {
            localStorage.removeItem(`${this.KEYS.HISTORY}_${moduleId}`);
        });
    },

    // Check if API is configured
    isConfigured() {
        const settings = this.getSettings();
        return settings.apiKey && settings.apiKey.length > 10;
    }
};
