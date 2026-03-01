// src/utils/minecraft-text.ts

export interface TextSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  black: "#000000",
  dark_blue: "#0000AA",
  dark_green: "#00AA00",
  dark_aqua: "#00AAAA",
  dark_red: "#AA0000",
  dark_purple: "#AA00AA",
  gold: "#FFAA00",
  gray: "#AAAAAA",
  dark_gray: "#555555",
  blue: "#5555FF",
  green: "#55FF55",
  aqua: "#55FFFF",
  red: "#FF5555",
  light_purple: "#FF55FF",
  yellow: "#FFFF55",
  white: "#FFFFFF",
};

const LEGACY_COLOR_MAP: Record<string, string> = {
  "0": "black",
  "1": "dark_blue",
  "2": "dark_green",
  "3": "dark_aqua",
  "4": "dark_red",
  "5": "dark_purple",
  "6": "gold",
  "7": "gray",
  "8": "dark_gray",
  "9": "blue",
  a: "green",
  b: "aqua",
  c: "red",
  d: "light_purple",
  e: "yellow",
  f: "white",
};

const LEGACY_DECORATION_MAP: Record<string, string> = {
  k: "obfuscated",
  l: "bold",
  m: "strikethrough",
  n: "underlined",
  o: "italic",
  r: "reset",
};

function convertLegacyToMiniMessage(text: string): string {
  let result = text;
  if (typeof result !== "string") {
    result = "&cError";
  }

  // FIX: Intercept BungeeCord protocol hex formats from server pings (e.g., §x§1§2§3§a§b§c)
  result = result.replace(/[&§]x([&§][0-9a-fA-F]){6}/g, (match) => {
    const hex = match.replace(/[&§x]/gi, "");
    return `<#${hex}>`;
  });

  // FIX: Replace legacy hex colors (Supports both &#00A3E3 and shorthand &#f00)
  result = result.replace(/[&§](#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))/g, (_, hex) => {
    return `<${hex}>`;
  });

  // Replace legacy color codes
  result = result.replace(/[&§]([0-9a-f])/gi, (_, code) => {
    const color = LEGACY_COLOR_MAP[code.toLowerCase()];
    return color ? `<${color}>` : "";
  });

  // Replace legacy decoration codes
  result = result.replace(/[&§]([k-or])/gi, (_, code) => {
    const decoration = LEGACY_DECORATION_MAP[code.toLowerCase()];
    return decoration === "reset" ? "<reset>" : `<${decoration}>`;
  });

  return result;
}

interface ActiveTag {
  name: string;
  value?: string;
  id: number; // FIX: Added to track unique gradient spans
}

interface InternalTextSegment extends TextSegment {
  _gradientId?: number;
  _gradientColors?: string[];
}

export function parseMinecraftText(text: string): TextSegment[] {
  const miniMessageText = convertLegacyToMiniMessage(text);
  const rawSegments: InternalTextSegment[] = [];
  let activeTags: ActiveTag[] = [];
  let tagIdCounter = 0; // Tracks unique tag instances

  const regex = /<(\/?)(#?[a-zA-Z0-9_]+)(?::([^>]*))?>/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(miniMessageText)) !== null) {
    const [fullMatch, isClosing, tagName, tagValue] = match;
    const index = match.index;

    // Push preceding text with current style
    if (index > lastIndex) {
      rawSegments.push({
        text: miniMessageText.substring(lastIndex, index),
        ...computeStyle(activeTags),
      });
    }

    lastIndex = index + fullMatch.length;
    const lowerTagName = tagName.toLowerCase();

    if (isClosing) {
      if (lowerTagName === "color" || lowerTagName === "c") {
        for (let i = activeTags.length - 1; i >= 0; i--) {
          const tName = activeTags[i].name;
          if (tName.startsWith("#") || COLOR_MAP[tName] || tName === "color" || tName === "c") {
            activeTags.splice(i, 1);
            break;
          }
        }
      } else if (lowerTagName === "gradient") {
        // Find and remove the most recent gradient tag
        for (let i = activeTags.length - 1; i >= 0; i--) {
          if (activeTags[i].name === "gradient") {
            activeTags.splice(i, 1);
            break;
          }
        }
      } else {
        const tagIndex = activeTags.map((t) => t.name).lastIndexOf(lowerTagName);
        if (tagIndex !== -1) {
          activeTags.splice(tagIndex, 1);
        }
      }
    } else {
      if (lowerTagName === "reset" || lowerTagName === "r") {
        activeTags = [];
      } else {
        activeTags.push({ name: lowerTagName, value: tagValue, id: tagIdCounter++ });
      }
    }
  }

  // Push remaining text
  if (lastIndex < miniMessageText.length) {
    rawSegments.push({
      text: miniMessageText.substring(lastIndex),
      ...computeStyle(activeTags),
    });
  }

  // === GRADIENT POST-PROCESSING ===

  // 1. Calculate the total character length for each unique gradient instance
  const gradientLengths: Record<number, number> = {};
  for (const seg of rawSegments) {
    if (seg._gradientId !== undefined) {
      gradientLengths[seg._gradientId] = (gradientLengths[seg._gradientId] || 0) + seg.text.length;
    }
  }

  const finalSegments: TextSegment[] = [];
  const gradientProgress: Record<number, number> = {};

  // 2. Iterate through segments, split gradients into 1-character chunks, and apply lerped colors
  for (const seg of rawSegments) {
    if (seg._gradientId !== undefined && seg._gradientColors && seg.text.length > 0) {
      const totalLength = gradientLengths[seg._gradientId];
      const colors = seg._gradientColors;
      let currentPos = gradientProgress[seg._gradientId] || 0;

      for (let i = 0; i < seg.text.length; i++) {
        // Calculate interpolation percentage (0.0 to 1.0)
        const t = totalLength > 1 ? currentPos / (totalLength - 1) : 0;

        // Strip the internal properties so React doesn't see them
        const { _gradientId, _gradientColors, text, ...rest } = seg;

        finalSegments.push({
          ...rest,
          text: seg.text[i],
          color: getGradientColor(colors, t),
        });
        currentPos++;
      }
      gradientProgress[seg._gradientId] = currentPos;
    } else {
      // Normal text: strip internal properties and push
      const { _gradientId, _gradientColors, ...rest } = seg;
      finalSegments.push(rest);
    }
  }

  return finalSegments;
}

function computeStyle(tags: ActiveTag[]): Partial<InternalTextSegment> {
  const style: Partial<InternalTextSegment> = {};

  for (const tag of tags) {
    const name = tag.name;

    if (name === "bold" || name === "b") style.bold = true;
    else if (name === "italic" || name === "i" || name === "em") style.italic = true;
    else if (name === "underlined" || name === "u") style.underlined = true;
    else if (name === "strikethrough" || name === "st") style.strikethrough = true;
    else if (name === "obfuscated" || name === "obf") style.obfuscated = true;
    else if (COLOR_MAP[name]) style.color = COLOR_MAP[name];
    else if (name.startsWith("#")) style.color = name;
    else if ((name === "color" || name === "c") && tag.value) {
      style.color = tag.value.startsWith("#")
        ? tag.value
        : (COLOR_MAP[tag.value.toLowerCase()] || tag.value);
    }
    // FIX: Catch gradient tags and store them temporarily for the post-processor
    else if (name === "gradient" && tag.value) {
      style._gradientId = tag.id;
      style._gradientColors = tag.value.split(":").map(c => {
        return c.startsWith("#") ? c : (COLOR_MAP[c.toLowerCase()] || "#FFFFFF");
      });
    }
  }

  return style;
}

export function getShadowColor(hex: string) {
  if (hex.startsWith("#")) {
    const fullHex = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

    const r = parseInt(fullHex.slice(1, 3), 16);
    const g = parseInt(fullHex.slice(3, 5), 16);
    const b = parseInt(fullHex.slice(5, 7), 16);

    return `rgb(${Math.floor(r * 0.25)}, ${Math.floor(g * 0.25)}, ${Math.floor(b * 0.25)})`;
  }
  return "#3F3F3F";
};

export function getMatchingObfuscatedChar(targetWidth: number, ctx: CanvasRenderingContext2D, charCache: Record<string, string[]>) {
  // We must key the cache by BOTH width and font (bold/italic changes width)
  const cacheKey = `${targetWidth}_${ctx.font}`;

  if (!charCache[cacheKey]) {
    charCache[cacheKey] = [];
  }

  const cache = charCache[cacheKey];

  // If we have a healthy pool of characters for this exact width, pick one randomly
  if (cache.length > 15) {
    return cache[Math.floor(Math.random() * cache.length)];
  }

  // Broad Unicode ranges (avoiding unprintables and obscure blocks that render as empty boxes)
  const ranges = [
    [0x0021, 0x007E], // Basic Latin
    [0x00A1, 0x00FF], // Latin-1 Supplement
    [0x0100, 0x017F], // Latin Extended-A
    [0x0391, 0x03C9], // Greek
    [0x0400, 0x044F], // Cyrillic
    [0x3041, 0x3096], // Hiragana
    [0x30A0, 0x30FF], // Katakana
  ];

  // Hunt for a character that matches the exact width
  for (let i = 0; i < 50; i++) {
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const code = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    const char = String.fromCharCode(code);
    const width = ctx.measureText(char).width;

    const widthKey = `${width}_${ctx.font}`;
    if (!charCache[widthKey]) charCache[widthKey] = [];

    // Add to our global cache so we never have to measure this character again
    if (charCache[widthKey].length < 30 && !charCache[widthKey].includes(char)) {
      charCache[widthKey].push(char);
    }

    if (width === targetWidth) {
      return char;
    }
  }

  // Fallback: If we couldn't find a perfect match in 50 tries, use whatever is in the cache
  // for this width, or a default block if it's completely empty.
  return cache.length > 0
    ? cache[Math.floor(Math.random() * cache.length)]
    : String.fromCharCode(0x2588);
};

// Forces the browser to render emojis as flat text (Unifont) rather than OS color emojis
// export function forceUnifontEmojis(str: string) {
//   if (!str) return "";

//   // \p{Emoji} targets all emoji characters natively
//   return str.replace(/\p{Emoji}/gu, (match) => {
//     // If the emoji already has a color-forcing selector (\uFE0F), strip it and add the text one
//     if (match.includes('\uFE0F')) {
//       return match.replace('\uFE0F', '\uFE0E');
//     }
//     // Otherwise, append the text-forcing selector (\uFE0E) if it doesn't already have one
//     return match.includes('\uFE0E') ? match : match + '\uFE0E';
//   });
// };

// Automatically finds ALL emojis and forces them to render as flat text using UnifontUpper
// Automatically finds ALL emojis and forces them to render as flat text using UnifontUpper
export function automateEmojiTextPresentation(text: string) {
  if (!text) return "";

  // \p{Emoji} automatically matches every single emoji in existence natively
  return text.replace(/\p{Emoji}/gu, (match) => {
    // FIX: Skip basic ASCII characters (#, *, 0-9) that are technically "emojis" in Unicode.
    // Without this, invisible \uFE0E characters get injected and break the MiniMessage parser.
    if (match.length === 1 && match.charCodeAt(0) < 128) {
      return match;
    }

    return match.includes('\uFE0E') ? match : match + '\uFE0E';
  });
};

// --- GRADIENT MATH HELPERS ---
function hexToRgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

function lerpColor(c1: string, c2: string, t: number) {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
  return rgbToHex(r, g, b);
}

function getGradientColor(colors: string[], t: number): string {
  if (colors.length === 0) return "#FFFFFF";
  if (colors.length === 1) return colors[0];
  if (t <= 0) return colors[0];
  if (t >= 1) return colors[colors.length - 1];

  // Scale t to the number of color segments (e.g., 3 colors = 2 segments)
  const scaled = t * (colors.length - 1);
  const index = Math.floor(scaled);
  const fraction = scaled - index;

  return lerpColor(colors[index], colors[index + 1], fraction);
}
