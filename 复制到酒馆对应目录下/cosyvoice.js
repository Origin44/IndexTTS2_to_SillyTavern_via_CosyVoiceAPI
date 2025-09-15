import { saveTtsProviderSettings } from './index.js';

export { CosyVoiceProvider };

// CosyVoice TTS 提供商类 - 处理与 CosyVoice TTS 服务的交互
class CosyVoiceProvider {
    //########//
    // 配置部分 //
    //########//

    settings;           // 存储提供商的设置
    ready = false;      // 标记提供商是否准备就绪
    voices = [];        // 存储可用的语音列表
    separator = '. ';   // 文本分隔符
    audioElement = document.createElement('audio');  // 音频元素用于播放

    /**
     * 在传递给 TTS 引擎之前执行任何文本处理
     * @param {string} text 输入文本
     * @returns {string} 处理后的文本
     */
    processText(text) {
        return text;
    }

    // 支持的音频格式列表
    audioFormats = ['wav', 'ogg', 'silk', 'mp3', 'flac'];

    // 语言标签映射
    languageLabels = {
        'Auto': 'auto',
    };

    // 语言键到语言代码的映射
    langKey2LangCode = {
        'zh': 'zh-CN',  // 中文
        'en': 'en-US',  // 英文
        'ja': 'ja-JP',  // 日文
        'ko': 'ko-KR',  // 韩文
    };

    // 模型类型定义
    modelTypes = {
        CosyVoice: 'CosyVoice',
    };

    // 默认设置配置
    defaultSettings = {
        provider_endpoint: 'http://localhost:9880',  // 提供商端点
        format: 'wav',          // 音频格式
        lang: 'auto',           // 语言
        streaming: false,       // 是否启用流式传输
    };

    // 设置界面 HTML 生成器
    get settingsHtml() {
        let html = `

        <label for="tts_endpoint">提供商端点:</label>
        <input id="tts_endpoint" type="text" class="text_pole" maxlength="250" height="300" value="${this.defaultSettings.provider_endpoint}"/>
        <span>Windows 用户使用 <a target="_blank" href="https://github.com/v3ucn/CosyVoice_For_Windows">CosyVoice_For_Windows</a>(非官方).</span><br/>
        <span>Macos 用户使用 <a target="_blank" href="https://github.com/v3ucn/CosyVoice_for_MacOs">CosyVoice_for_MacOs</a>(非官方).</span><br/>
        <br/>

        `;

        return html;
    }

    // 设置变更处理函数
    onSettingsChange() {
        // 当从 UI 更新提供商设置时使用
        this.settings.provider_endpoint = $('#tts_endpoint').val();

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    // 加载设置并初始化界面
    async loadSettings(settings) {
        // 根据输入设置填充提供商 UI
        if (Object.keys(settings).length == 0) {
            console.info('使用默认 TTS 提供商设置');
            // 如果是第一次加载，使用默认设置
            this.settings = {...this.defaultSettings};
        } else {
            // 如果有保存的设置，使用保存的设置，并用默认设置填充缺失的键
            this.settings = {...this.defaultSettings, ...settings};
        }

        // 从设置中设置初始值
        $('#tts_endpoint').val(this.settings.provider_endpoint);

        await this.checkReady();

        console.info('TTS: 设置已加载');
    }

    // 执行简单的就绪检查，尝试获取语音 ID
    async checkReady() {
        await Promise.allSettled([this.fetchTtsVoiceObjects(), this.changeTTSSettings()]);
    }

    // 刷新按钮点击处理
    async onRefreshClick() {
        return;
    }

    //#################//
    // TTS 接口部分     //
    //#################//

    // 根据语音名称获取语音对象
    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const match = this.voices.filter(
            v => v.name == voiceName,
        )[0];
        console.log(match);
        if (!match) {
            throw `TTS 语音名称 ${voiceName} 未找到`;
        }
        return match;
    }

    // 生成 TTS 音频
    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    //###########//
    // API 调用部分 //
    //###########//

    // 从 API 获取可用的语音对象列表
    async fetchTtsVoiceObjects() {
        const response = await fetch(`${this.settings.provider_endpoint}/speakers`);
        console.info(response);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const responseJson = await response.json();

        this.voices = responseJson;

        return responseJson;
    }

    // 每次参数更改时，我们更改配置
    async changeTTSSettings() {
    }

    /**
     * 从 API 获取 TTS 生成
     * @param {string} inputText 要生成 TTS 的文本
     * @param {string} voiceId 要使用的语音 ID (model_type&speaker_id))
     * @returns {Promise<Response|string>} 获取响应
     */
    async fetchTtsGeneration(inputText, voiceId, lang = null, forceNoStreaming = false) {
        console.info(`为语音 ID ${voiceId} 生成新的 TTS`);

        const streaming = this.settings.streaming;

        // 检测情感后缀
        let processedText = inputText;
        let emotion = null;
        
        // 使用正则表达式匹配情感后缀（格式：_情感名称）
        const emotionRegex = /_([^_]+)$/;
        const emotionMatch = inputText.match(emotionRegex);
        
        if (emotionMatch) {
            // 提取情感名称并移除后缀
            emotion = emotionMatch[1];
            processedText = inputText.replace(emotionRegex, '');
            // processedText = processedText.replace(/["']+$/, '');
            console.info(`检测到情感后缀: ${emotion}, 处理后的文本: ${processedText}`);
        }

        const params = {
            text: processedText,
            speaker: voiceId,
        };

        // 如果有情感参数，添加到请求中
        if (emotion) {
            params['emotion'] = emotion;
            console.info(`添加情感参数: ${emotion}`);
        }

        if (streaming) {
            params['streaming'] = 1;
        }

        const url = `${this.settings.provider_endpoint}/`;

        const response = await fetch(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params), // 将参数对象转换为 JSON 字符串
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS 生成失败');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    // 未使用的接口 - 从历史记录获取 TTS
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}