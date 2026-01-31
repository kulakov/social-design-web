// API adapters for different LLM providers

const API = {
    PROVIDERS: {
        anthropic: {
            name: 'Claude (Anthropic)',
            models: [
                { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
                { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
                { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' }
            ],
            endpoint: 'https://api.anthropic.com/v1/messages'
        },
        openai: {
            name: 'ChatGPT (OpenAI)',
            models: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
            ],
            endpoint: 'https://api.openai.com/v1/chat/completions'
        },
        google: {
            name: 'Gemini (Google)',
            models: [
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' }
            ],
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
        }
    },

    getModels(provider) {
        return this.PROVIDERS[provider]?.models || [];
    },

    async sendMessage(systemPrompt, messages, settings) {
        const { provider, apiKey, model } = settings;

        switch (provider) {
            case 'anthropic':
                return this.sendAnthropic(systemPrompt, messages, apiKey, model);
            case 'openai':
                return this.sendOpenAI(systemPrompt, messages, apiKey, model);
            case 'google':
                return this.sendGoogle(systemPrompt, messages, apiKey, model);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    },

    async sendAnthropic(systemPrompt, messages, apiKey, model) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Anthropic API error');
        }

        const data = await response.json();
        return data.content[0].text;
    },

    async sendOpenAI(systemPrompt, messages, apiKey, model) {
        const allMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: allMessages,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    async sendGoogle(systemPrompt, messages, apiKey, model) {
        // Format messages for Gemini
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // Prepend system prompt to first user message
        if (contents.length > 0 && contents[0].role === 'user') {
            contents[0].parts[0].text =
                `[System Instructions]\n${systemPrompt}\n\n[User Message]\n${contents[0].parts[0].text}`;
        }

        console.log('Sending to Gemini:', { model, messagesCount: contents.length });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: {
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            let errorMessage = 'Google API error';
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.error?.message || errorMessage;
            } catch (e) {
                errorMessage = errorText.substring(0, 100);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Gemini response:', data);

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Unexpected response format from Gemini');
        }

        return data.candidates[0].content.parts[0].text;
    }
};
