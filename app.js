// YouTube to MP3/MP4 Converter - Minimal, YTMP3-style
// Note: No storage APIs used. All state is in-memory.
class YTMP3Converter {
    static URL_PATTERNS = {
        YOUTUBE_WATCH: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
        YOUTUBE_SHORTS: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
        YOUTUBE_MUSIC: /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/
    };
    
    static API_SERVICES = {
        PRIMARY: {
            name: 'RapidAPI YouTube Converter',
            endpoint: 'https://youtube-mp3-downloader2.p.rapidapi.com',
            key_required: true
        },
        FALLBACK1: {
            name: 'Alternative Conversion API',
            endpoint: 'https://api.vevioz.com/api',
            key_required: false
        },
        FALLBACK2: {
            name: 'Proxy Service',
            endpoint: 'https://api.allorigins.win/raw',
            method: 'proxy'
        }
    };
    
    static MESSAGES = [
        'Analyzing video...',
        'Extracting audio stream...',
        'Converting to MP3...',
        'Finalizing download...',
        'Ready for download!'
    ];
    
    constructor() {
        this.state = {
            format: 'mp3',
            quality: '320',
            isProcessing: false,
            videoId: null,
            downloadUrl: null,
            fileName: null,
            contentLength: 0
        };
        this.init();
    }
    init() {
        // Get DOM elements
        this.elements = {
            youtubeUrl: document.getElementById('youtubeUrl'),
            mp3Btn: document.getElementById('mp3Btn'),
            mp4Btn: document.getElementById('mp4Btn'),
            qualitySelect: document.getElementById('qualitySelect'),
            convertBtn: document.getElementById('convertBtn'),
            statusMessage: document.getElementById('statusMessage'),
            progressContainer: document.getElementById('progressContainer'),
            progressBar: document.getElementById('progressBar'),
            progressText: document.getElementById('progressText'),
            progressStep: document.getElementById('progressStep'),
            resultSection: document.getElementById('resultSection'),
            videoInfo: document.getElementById('videoInfo'),
            videoTitle: document.getElementById('videoTitle'),
            videoDuration: document.getElementById('videoDuration'),
            videoThumbnail: document.getElementById('videoThumbnail'),
            downloadBtn: document.getElementById('downloadBtn'),
            downloadFormat: document.getElementById('downloadFormat'),
            downloadSize: document.getElementById('downloadSize'),
            downloadIcon: document.getElementById('downloadIcon'),
            hiddenVideo: document.getElementById('hiddenVideo'),
            hiddenAudio: document.getElementById('hiddenAudio')
        };

        // Event listeners
        this.elements.mp3Btn.addEventListener('click', () => this.setFormat('mp3'));
        this.elements.mp4Btn.addEventListener('click', () => this.setFormat('mp4'));
        this.elements.qualitySelect.addEventListener('change', (e) => this.state.quality = e.target.value);
        this.elements.convertBtn.addEventListener('click', () => this.convert());
        this.elements.youtubeUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.state.isProcessing) this.convert();
        });

        // Initial UI
        this.resetUI();
    }

    setFormat(format) {
        this.state.format = format;
        // Toggle active state
        this.elements.mp3Btn.classList.toggle('active', format === 'mp3');
        this.elements.mp4Btn.classList.toggle('active', format === 'mp4');
        // Update quality options
        this.updateQualityOptions();
        // Update CTA
        const text = this.elements.convertBtn.querySelector('.btn-text');
        if (text) text.textContent = `Convert to ${format.toUpperCase()}`;
    }

    updateQualityOptions() {
        const select = this.elements.qualitySelect;
        if (this.state.format === 'mp3') {
            select.innerHTML = `
                <option value="320">320kbps - High Quality</option>
                <option value="192">192kbps - Standard</option>
                <option value="128">128kbps - Fast Download</option>
            `;
            this.elements.downloadFormat.textContent = 'MP3 Audio';
            this.elements.downloadIcon.textContent = '🎵';
        } else {
            select.innerHTML = `
                <option value="720">720p - HD</option>
                <option value="480">480p - SD</option>
                <option value="360">360p - Fast</option>
            `;
            this.elements.downloadFormat.textContent = 'MP4 Video';
            this.elements.downloadIcon.textContent = '🎬';
        }
    }

    isYouTubeUrl(url) {
        return (
            YTMP3Converter.URL_PATTERNS.YOUTUBE_WATCH.test(url) ||
            YTMP3Converter.URL_PATTERNS.YOUTUBE_SHORTS.test(url) ||
            YTMP3Converter.URL_PATTERNS.YOUTUBE_MUSIC.test(url)
        );
    }

    extractVideoId(url) {
        const matchWatch = url.match(YTMP3Converter.URL_PATTERNS.YOUTUBE_WATCH);
        if (matchWatch) return matchWatch[1];
        const matchShorts = url.match(YTMP3Converter.URL_PATTERNS.YOUTUBE_SHORTS);
        if (matchShorts) return matchShorts[1];
        const matchMusic = url.match(YTMP3Converter.URL_PATTERNS.YOUTUBE_MUSIC);
        if (matchMusic) return matchMusic[1];
        return null;
    }

    async convert() {
        const url = this.elements.videoUrl.value.trim();
        const urlType = this.detectUrlType(url);
        



    async fetchVideoInfo(url) {
        // Use YouTube oEmbed as a lightweight info source
        try {
            const infoUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const res = await fetch(infoUrl);
            if (!res.ok) throw new Error('Could not fetch video info');
            const data = await res.json();
            // Populate UI
            this.elements.videoTitle.textContent = data.title || 'YouTube Video';
            // Try thumbnail fallback list
            const thumb = (data.thumbnail_url || '').replace('hqdefault', 'mqdefault');
            this.elements.videoThumbnail.src = thumb;
            this.elements.videoDuration.textContent = 'Preparing...';
        } catch (e) {
            // Non-blocking
        }
    }

    async tryApisInOrder(url) {
        // 1) RapidAPI (requires key) - provide input for user to paste key when needed
        const primary = await this.tryRapidApi(url).catch(() => null);
        if (primary) return primary;
        this.showStatus('Primary service failed. Trying alternative...', 'info');

        // 2) Alternative API
        const alt = await this.tryAlternativeApi(url).catch(() => null);
        if (alt) return alt;
        this.showStatus('Alternative service failed. Trying proxy...', 'info');

        // 3) Proxy-based extraction
        const proxy = await this.tryProxyExtraction(url).catch(() => null);
        if (proxy) return proxy;

        return null;
    }

    async tryRapidApi(url) {
        // This endpoint family varies across providers. We expose a header prompt if missing.
        const RAPID_API_KEY = window.YTMP3_RAPIDAPI_KEY || '';
        if (!RAPID_API_KEY) throw new Error('RapidAPI key missing');

        // Example pattern: many YouTube-to-MP3 RapidAPI providers follow GET with params
        // We will attempt a generic path. If provider differs, user can plug their own endpoint later.
        const endpoint = `${YTMP3Converter.API_SERVICES.PRIMARY.endpoint}/ytmp3`;
        const params = new URLSearchParams({ url, quality: this.state.format === 'mp3' ? this.state.quality : '720' });
        const reqUrl = `${endpoint}?${params.toString()}`;
        const res = await fetch(reqUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPID_API_KEY,
                'X-RapidAPI-Host': new URL(YTMP3Converter.API_SERVICES.PRIMARY.endpoint).host
            }
        });
        if (!res.ok) throw new Error('RapidAPI request failed');
        const data = await res.json();
        // Expecting data.download_url or similar
        const dl = data.download_url || data.link || data.url;
        if (!dl) throw new Error('RapidAPI response missing download URL');
        return dl;
    }

    async tryAlternativeApi(url) {
        // Vevioz informal API often offers direct redirect endpoints
        // We will attempt a generic convert endpoint
        const endpoint = `${YTMP3Converter.API_SERVICES.FALLBACK1.endpoint}`;
        // Step 1: info or direct convert
        // Attempt: /Button?url=... (commonly used by vevioz frontends)
        const infoUrl = `${endpoint}/Button?url=${encodeURIComponent(url)}`;
        const res = await fetch(infoUrl, { method: 'GET' });
        if (res.ok) {
            const text = await res.text();
            // Heuristic: look for href with dl or mp3/mp4
            const match = text.match(/href=\"(https?:[^\"]+(?:mp3|mp4)[^\"]*)\"/i);
            if (match) return this.decodeHtml(match[1]);
        }
        throw new Error('Alternative API did not provide link');
    }

    async tryProxyExtraction(url) {
        // Use allorigins to proxy a well-known third-party extractor page and parse
        const extractorUrl = `https://youtubetoany.com/en1/?url=${encodeURIComponent(url)}`;
        const proxied = `${YTMP3Converter.API_SERVICES.FALLBACK2.endpoint}?url=${encodeURIComponent(extractorUrl)}`;
        const res = await fetch(proxied, { method: 'GET' });
        if (!res.ok) throw new Error('Proxy fetch failed');
        const html = await res.text();
        // Find plausible direct links (mp3/mp4) in returned HTML
        const link = this.findBestDownloadLink(html);
        if (link) return link;
        throw new Error('Proxy-based extraction failed');
    }

    findBestDownloadLink(html) {
        // Prefer MP3 when format is mp3, else MP4
        const reMp3 = /(https?:[^\"'\s>]+\.mp3[^\"'\s>]*)/i;
        const reMp4 = /(https?:[^\"'\s>]+\.mp4[^\"'\s>]*)/i;
        if (this.state.format === 'mp3') {
            const m = html.match(reMp3);
            if (m) return this.decodeHtml(m[1]);
        } else {
            const m = html.match(reMp4);
            if (m) return this.decodeHtml(m[1]);
        }
        // fallback: any
        const any = html.match(/(https?:[^\"'\s>]+\.(?:mp3|mp4)[^\"'\s>]*)/i);
        return any ? this.decodeHtml(any[1]) : null;
    }

    decodeHtml(str) {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    async fetchHead(url) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (!res.ok) return null;
            const len = res.headers.get('content-length');
            return { size: len ? parseInt(len, 10) : 0 };
        } catch {
            return null;
        }
    }

    prepareDownloadUI(originalUrl, downloadUrl) {
        const isMp3 = this.state.format === 'mp3';
        const ext = isMp3 ? '.mp3' : '.mp4';
        const title = this.elements.videoTitle.textContent || 'YouTube Video';
        const safeTitle = title.replace(/[^a-z0-9\-_. ]/gi, '_');
        const fileName = `${safeTitle}${ext}`;
        this.state.fileName = fileName;

        // Set details
        this.elements.downloadFormat.textContent = isMp3 ? 'MP3 Audio' : 'MP4 Video';
        if (this.state.contentLength) {
            const sizeMB = (this.state.contentLength / (1024 * 1024)).toFixed(2);
            this.elements.downloadSize.textContent = `${sizeMB} MB`;
        } else {
            this.elements.downloadSize.textContent = 'Ready for download';
        }

        this.elements.downloadBtn.href = downloadUrl;
        this.elements.downloadBtn.download = fileName;
        this.elements.resultSection.classList.remove('hidden');
        this.showStatus('Ready! Click Download Now if it didn\'t start automatically.', 'success');
    }

    autoDownload() {
        // Trigger automatic download
        setTimeout(() => {
            this.elements.downloadBtn.click();
        }, 400);
    }

    showProgress(percent, stepText) {
        this.elements.progressContainer.classList.remove('hidden');
        this.elements.progressBar.style.width = `${percent}%`;
        this.elements.progressText.textContent = `${Math.round(percent)}%`;
        if (stepText) this.elements.progressStep.textContent = stepText;
    }

    toggleButtonLoading(loading) {
        const btn = this.elements.convertBtn;
        const text = btn.querySelector('.btn-text');
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
            if (text) text.textContent = 'Processing...';
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            if (text) text.textContent = `Convert to ${this.state.format.toUpperCase()}`;
        }
    }

    showStatus(message, type = 'info') {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
    }

    clearStatus() {
        this.elements.statusMessage.textContent = '';
        this.elements.statusMessage.className = 'status-message';
    }

    friendlyError(err) {
        const msg = (err && err.message) ? err.message : 'Unknown error';
        if (/key/i.test(msg)) {
            return 'RapidAPI key missing or invalid. Add window.YTMP3_RAPIDAPI_KEY = "YOUR_KEY" in the console and retry, or wait to use fallback methods.';
        }
        if (/network|failed|fetch|timeout/i.test(msg)) {
            return 'Network issue detected. Check connection or try again in a moment.';
        }
        if (/unsupported|not available/i.test(msg)) {
            return 'This video may be unsupported. Try a different URL or quality.';
        }
        return `Conversion failed: ${msg}`;
    }

    resetUI() {
        this.setFormat('mp3');
        this.clearStatus();
        this.showProgress(0, 'Waiting for URL...');
        this.elements.resultSection.classList.add('hidden');
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// Initialize app
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    window.ytmp3App = new YTMP3Converter();
});


    showStatus(message, type = 'info') {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        this.elements.statusMessage.style.display = 'block';
    }

    clearStatus() {
        this.elements.statusMessage.textContent = '';
        this.elements.statusMessage.className = 'status-message';
        this.elements.statusMessage.style.display = 'none';
    }

    showProgress(percentage) {
        this.elements.progressContainer.classList.remove('hidden');
        this.elements.progressBar.style.width = percentage + '%';
        this.elements.progressText.textContent = Math.round(percentage) + '%';
    }




