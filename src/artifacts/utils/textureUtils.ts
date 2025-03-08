// Functions for creating and managing textures

/**
 * Creates an SVG texture pattern for a terrain type
 * @param type The terrain type to create texture for
 * @returns A data URL containing the SVG texture
 */
export function createTexture(type: string): string {
    const patterns: Record<string, string> = {
      field: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#4CAF50" />
        <path d="M0 4 L4 0 L8 4 L4 8 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(4,4)" />
        <path d="M16 4 L20 0 L24 4 L20 8 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(4,4)" />
        <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(4,4)" />
        <path d="M24 12 L28 8 L32 12 L28 16 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(0,4)" />
        <path d="M0 20 L4 16 L8 20 L4 24 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(4,4)" />
        <path d="M16 20 L20 16 L24 20 L20 24 Z" fill="#A5D6A7" fill-opacity="0.4" transform="translate(4,4)" />
      </svg>`,
      
      swamp: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#1B5E20" />
        <circle cx="8" cy="8" r="2" fill="#81C784" fill-opacity="0.3" />
        <circle cx="24" cy="8" r="3" fill="#81C784" fill-opacity="0.2" />
        <circle cx="16" cy="16" r="4" fill="#1B5E20" stroke="#81C784" stroke-opacity="0.3" />
        <circle cx="4" cy="24" r="2" fill="#81C784" fill-opacity="0.3" />
        <circle cx="28" cy="24" r="3" fill="#81C784" fill-opacity="0.2" />
      </svg>`,
      
      highland: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#F9A825" />
        <path d="M0 32 L32 0 L32 16 L16 32 Z" fill="#FBC02D" fill-opacity="0.4" />
        <path d="M0 16 L16 0 L32 0 L0 32 Z" fill="#F57F17" fill-opacity="0.2" />
      </svg>`,
      
      water: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#1976D2" />
        <path d="M0 8 Q8 4, 16 8 Q24 12, 32 8 L32 16 Q24 12, 16 16 Q8 20, 0 16 Z" fill="#2196F3" fill-opacity="0.4" />
        <path d="M0 24 Q8 20, 16 24 Q24 28, 32 24 L32 32 Q24 28, 16 32 Q8 36, 0 32 Z" fill="#2196F3" fill-opacity="0.4" />
      </svg>`,
      
      forest: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#33691E" />
        <path d="M8 20 L12 12 L16 20 Z" fill="#558B2F" fill-opacity="0.7" />
        <path d="M16 24 L20 16 L24 24 Z" fill="#558B2F" fill-opacity="0.7" />
        <path d="M0 28 L4 20 L8 28 Z" fill="#558B2F" fill-opacity="0.7" />
        <path d="M24 28 L28 20 L32 28 Z" fill="#558B2F" fill-opacity="0.7" />
        <rect x="11" y="20" width="2" height="4" fill="#795548" />
        <rect x="19" y="24" width="2" height="4" fill="#795548" />
        <rect x="3" y="28" width="2" height="4" fill="#795548" />
        <rect x="27" y="28" width="2" height="4" fill="#795548" />
      </svg>`,
      
      asphalt: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" fill="#424242" />
        <line x1="0" y1="8" x2="32" y2="8" stroke="#616161" stroke-width="1" />
        <line x1="0" y1="16" x2="32" y2="16" stroke="#616161" stroke-width="1" />
        <line x1="0" y1="24" x2="32" y2="24" stroke="#616161" stroke-width="1" />
        <circle cx="8" cy="4" r="1" fill="#757575" />
        <circle cx="20" cy="4" r="0.8" fill="#757575" />
        <circle cx="4" cy="12" r="0.6" fill="#757575" />
        <circle cx="26" cy="12" r="1.2" fill="#757575" />
        <circle cx="12" cy="20" r="0.7" fill="#757575" />
        <circle cx="28" cy="20" r="0.5" fill="#757575" />
        <circle cx="16" cy="28" r="0.9" fill="#757575" />
      </svg>`
    };
    
    const svg = patterns[type] || patterns.field;
    const url = `data:image/svg+xml;base64,${btoa(svg)}`;
    return url;
  }