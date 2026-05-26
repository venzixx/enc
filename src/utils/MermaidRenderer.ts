import puppeteer, { Browser, Page } from 'puppeteer';

export interface MermaidRenderOptions {
    theme?: 'dark' | 'default' | 'forest' | 'neutral';
    fontFamily?: string;
    backgroundColor?: string;
    maxWidth?: number;
}

/**
 * Renders Mermaid.js diagram definitions to PNG buffers using headless Chromium.
 * Maintains a singleton browser instance for performance across multiple renders.
 */
export class MermaidRenderer {
    private static browser: Browser | null = null;
    private static launching: Promise<Browser> | null = null;

    /**
     * Get or launch the shared browser instance.
     */
    private static async getBrowser(): Promise<Browser> {
        if (this.browser && this.browser.connected) {
            return this.browser;
        }

        // Prevent multiple simultaneous launches
        if (this.launching) {
            return this.launching;
        }

        this.launching = puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions'
            ]
        });

        try {
            this.browser = await this.launching;
            return this.browser;
        } finally {
            this.launching = null;
        }
    }

    /**
     * Render a Mermaid definition string to a PNG buffer.
     */
    static async renderToBuffer(definition: string, options: MermaidRenderOptions = {}): Promise<Buffer> {
        const {
            theme = 'default',
            fontFamily = 'Georgia, Times New Roman, serif',
            backgroundColor = '#ffffff',
            maxWidth = 2400
        } = options;

        const browser = await this.getBrowser();
        let page: Page | null = null;

        try {
            page = await browser.newPage();
            await page.setViewport({ width: maxWidth, height: 800, deviceScaleFactor: 2 });

        // Extract primary font name to load from Google Fonts if needed
        const primaryFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        const commonFonts = ['segoe ui', 'arial', 'sans-serif', 'system-ui', 'tahoma', 'verdana', 'helvetica', 'times new roman', 'courier new', 'inter'];
        const isCommon = commonFonts.includes(primaryFont.toLowerCase());
        const fontImportHtml = isCommon ? '' : `<style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@300;400;500;600;700&display=swap');</style>`;

        const html = `
<!DOCTYPE html>
<html>
<head>
    ${fontImportHtml}
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: ${backgroundColor};
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            padding: 40px 30px;
            font-family: ${fontFamily};
        }
        #mermaid-container {
            display: inline-block;
            max-width: ${maxWidth}px;
        }
        /* Force sharp rectangular nodes, black background, black border */
        .node rect, .node polygon, .node circle {
            rx: 0px !important;
            ry: 0px !important;
            fill: #000000 !important;
            stroke: #000000 !important;
            stroke-width: 1px !important;
        }
        /* Force text inside nodes to be white and clean */
        .nodeLabel {
            font-family: ${fontFamily} !important;
            font-size: 14px !important;
            color: #ffffff !important;
        }
        /* Highlight node (the blue one) */
        .selfNode rect, .highlightNode rect {
            fill: #0000ff !important;
            stroke: #0000ff !important;
        }
        /* Style for marriage junction nodes (rendered as a small gray dot) */
        .junctionNode circle, .junctionNode rect, .junctionNode polygon {
            fill: #666666 !important;
            stroke: #666666 !important;
            rx: 3px !important;
            ry: 3px !important;
            r: 3px !important;
            min-width: 6px !important;
            min-height: 6px !important;
            width: 6px !important;
            height: 6px !important;
        }
        .junctionNode .nodeLabel {
            font-size: 0px !important;
            color: transparent !important;
            line-height: 0px !important;
        }
        /* Thin dark gray connecting lines, hiding arrowheads */
        .edgePath .path {
            stroke: #666666 !important;
            stroke-width: 1.2px !important;
            marker-end: none !important;
        }
        .edgePath {
            marker-end: none !important;
        }
        /* Extra safety to hide all arrowheads/markers */
        marker, marker * {
            display: none !important;
            fill: none !important;
            stroke: none !important;
        }
        .arrowheadPath {
            display: none !important;
        }
        .markerPath {
            display: none !important;
        }
    </style>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        
        mermaid.initialize({
            startOnLoad: false,
            theme: '${theme}',
            themeVariables: {
                darkMode: false,
                background: '${backgroundColor}',
                primaryColor: '#000000',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#000000',
                lineColor: '#666666',
                secondaryColor: '#0000ff',
                tertiaryColor: '#ffffff',
                fontFamily: '${fontFamily}',
                fontSize: '14px',
                nodeBorder: '#000000',
                mainBkg: '#000000',
                clusterBkg: 'rgba(0,0,0,0.02)',
                clusterBorder: 'rgba(0,0,0,0.1)',
                edgeLabelBackground: 'transparent',
                nodeTextColor: '#ffffff'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis',
                rankSpacing: 80,
                nodeSpacing: 50,
                padding: 15,
                useMaxWidth: false
            },
            securityLevel: 'loose'
        });
        
        try {
            const definition = decodeURIComponent("${encodeURIComponent(definition)}");
            const { svg } = await mermaid.render('mermaid-diagram', definition);
            document.getElementById('mermaid-container').innerHTML = svg;
            
            // Signal ready
            window.__mermaidReady = true;
        } catch (err) {
            document.getElementById('mermaid-container').innerHTML = 
                '<div style="color: red; padding: 20px; font-size: 18px;">Mermaid render error: ' + err.message + '</div>';
            window.__mermaidReady = true;
            window.__mermaidError = err.message;
        }
    </script>
</head>
<body>
    <div id="mermaid-container"></div>
</body>
</html>`;

            await page.setContent(html, { timeout: 30000 });

            // Wait for mermaid to finish rendering
            await page.waitForFunction('window.__mermaidReady === true', { timeout: 20000 });

            // Check for errors
            const error = await page.evaluate(() => (window as any).__mermaidError);
            if (error) {
                throw new Error(`Mermaid render error: ${error}`);
            }

            // Get the SVG element and screenshot it
            const svgElement = await page.$('#mermaid-container svg');
            if (!svgElement) {
                throw new Error('Mermaid SVG element not found');
            }

            // Get bounding box and add padding
            const bbox = await svgElement.boundingBox();
            if (!bbox) {
                throw new Error('Could not get SVG bounding box');
            }

            const padding = 40;
            const clip = {
                x: Math.max(0, bbox.x - padding),
                y: Math.max(0, bbox.y - padding),
                width: bbox.width + padding * 2,
                height: bbox.height + padding * 2
            };

            const screenshot = await page.screenshot({
                type: 'png',
                clip,
                omitBackground: false
            });

            return Buffer.from(screenshot);
        } finally {
            if (page) {
                await page.close().catch(() => {});
            }
        }
    }

    /**
     * Close the browser instance. Call on bot shutdown.
     */
    static async cleanup(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch {
                // Ignore close errors
            }
            this.browser = null;
        }
    }
}
