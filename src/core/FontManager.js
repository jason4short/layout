/**
 * FontManager - Handles font loading and text-to-path conversion using opentype.js
 */

// Reference to the global opentype object loaded via CDN
const opentype = window.opentype;

// Available fonts - using jsDelivr CDN for fontsource packages (reliable)
const AVAILABLE_FONTS = [
	{
		name: 'Roboto',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.ttf',
		weight: 'normal',
		style: 'normal'
	},
	{
		name: 'Roboto',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf',
		weight: 'bold',
		style: 'normal'
	},
	{
		name: 'Roboto Mono',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto-mono@latest/latin-400-normal.ttf',
		weight: 'normal',
		style: 'normal'
	},
	{
		name: 'Roboto Mono',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto-mono@latest/latin-700-normal.ttf',
		weight: 'bold',
		style: 'normal'
	},
	{
		name: 'Lato',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@latest/latin-400-normal.ttf',
		weight: 'normal',
		style: 'normal'
	},
	{
		name: 'Lato',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@latest/latin-700-normal.ttf',
		weight: 'bold',
		style: 'normal'
	},
	{
		name: 'Oswald',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-400-normal.ttf',
		weight: 'normal',
		style: 'normal'
	},
	{
		name: 'Merriweather',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/merriweather@latest/latin-400-normal.ttf',
		weight: 'normal',
		style: 'normal'
	},
	{
		name: 'Merriweather',
		url: 'https://cdn.jsdelivr.net/fontsource/fonts/merriweather@latest/latin-700-normal.ttf',
		weight: 'bold',
		style: 'normal'
	}
];

class FontManager {
	constructor() {
		if (FontManager.instance) {
			return FontManager.instance;
		}
		FontManager.instance = this;

		// Cache for loaded fonts: key = "fontName-weight-style" or custom key
		this.fontCache = new Map();

		// User-uploaded fonts: name -> font object
		this.userFonts = new Map();

		// Loading promises to prevent duplicate loads
		this.loadingPromises = new Map();
	}

	/**
	 * Get list of available font names (built-in + user uploaded)
	 */
	getAvailableFonts() {
		const builtIn = [...new Set(AVAILABLE_FONTS.map(f => f.name))];
		const userFontNames = [...this.userFonts.keys()];
		return [...builtIn, ...userFontNames];
	}

	/**
	 * Get font key for caching
	 */
	getFontKey(fontName, weight = 'normal', style = 'normal') {
		return `${fontName}-${weight}-${style}`;
	}

	/**
	 * Find font info from AVAILABLE_FONTS
	 */
	findFontInfo(fontName, weight = 'normal', style = 'normal') {
		// Try exact match first
		let info = AVAILABLE_FONTS.find(f =>
			f.name === fontName && f.weight === weight && f.style === style
		);

		// Fall back to normal weight/style
		if (!info) {
			info = AVAILABLE_FONTS.find(f =>
				f.name === fontName && f.weight === 'normal' && f.style === 'normal'
			);
		}

		// Fall back to first available
		if (!info) {
			info = AVAILABLE_FONTS.find(f => f.name === fontName);
		}

		return info;
	}

	/**
	 * Load a font from URL
	 */
	async loadFont(fontName, weight = 'normal', style = 'normal') {
		const key = this.getFontKey(fontName, weight, style);

		// Return cached font
		if (this.fontCache.has(key)) {
			return this.fontCache.get(key);
		}

		// Check user fonts
		if (this.userFonts.has(fontName)) {
			return this.userFonts.get(fontName);
		}

		// Check if already loading
		if (this.loadingPromises.has(key)) {
			return this.loadingPromises.get(key);
		}

		// Find font URL
		const fontInfo = this.findFontInfo(fontName, weight, style);
		if (!fontInfo) {
			console.warn(`Font not found: ${fontName}`);
			// Fall back to first available font
			const fallback = AVAILABLE_FONTS[0];
			return this.loadFont(fallback.name, fallback.weight, fallback.style);
		}

		// Load font
		const loadPromise = new Promise((resolve, reject) => {
			opentype.load(fontInfo.url, (err, font) => {
				this.loadingPromises.delete(key);
				if (err) {
					console.error(`Failed to load font ${fontName}:`, err);
					reject(err);
				} else {
					this.fontCache.set(key, font);
					resolve(font);
				}
			});
		});

		this.loadingPromises.set(key, loadPromise);
		return loadPromise;
	}

	/**
	 * Load a font from a user-uploaded File object
	 */
	async loadFontFromFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const font = opentype.parse(e.target.result);
					const fontName = font.names.fontFamily?.en || file.name.replace(/\.(ttf|otf)$/i, '');
					this.userFonts.set(fontName, font);
					resolve({ name: fontName, font });
				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = reject;
			reader.readAsArrayBuffer(file);
		});
	}

	/**
	 * Get path commands for text
	 * Returns opentype path object with commands array
	 *
	 * COORDINATE SYSTEM BOUNDARY:
	 * This is where opentype coords are converted to CADC world coords.
	 * CADC uses Y-down (canvas coords). Currently opentype outputs
	 * canvas-compatible coords, so no transform is needed. If this
	 * changes (library update, different font source), apply Y-flip here.
	 */
	getTextPath(font, text, x, y, fontSize) {
		return font.getPath(text, x, y, fontSize);
	}

	/**
	 * Get bounding box for text
	 * Returns bbox in CADC world coords (Y-down)
	 */
	getTextBounds(font, text, x, y, fontSize) {
		const path = font.getPath(text, x, y, fontSize);
		return path.getBoundingBox();
	}

	/**
	 * Check if opentype is available
	 */
	isAvailable() {
		return typeof opentype !== 'undefined';
	}
}

const fontManager = new FontManager();
export default fontManager;
export { AVAILABLE_FONTS };
