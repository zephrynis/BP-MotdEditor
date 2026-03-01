import React, { useEffect, useRef } from "react";
import tw from 'twin.macro';
import { parseMinecraftText, TextSegment, getShadowColor, getMatchingObfuscatedChar, automateEmojiTextPresentation } from './minecraft-text';
import { ServerContext } from '@/state/server';

// Global cache to store characters by their rendered width and font style
const charCache: Record<string, string[]> = {};

// 1. Move font loading OUTSIDE the component so it only runs once per page load.
let areFontsLoaded = false;

const loadAllFonts = async () => {
  const fontsToLoad = [
    new FontFace('MinecraftDefault', 'url({webroot/public}/fonts/MinecraftDefault-Regular.ttf)', { weight: 'normal', style: 'normal' }),
    new FontFace('MinecraftDefault', 'url({webroot/public}/fonts/MinecraftDefault-Bold.ttf)', { weight: 'bold', style: 'normal' }),
    new FontFace('MinecraftDefault', 'url({webroot/public}/fonts/MinecraftDefault-Italic.ttf)', { weight: 'normal', style: 'italic' }),
    new FontFace('MinecraftDefault', 'url({webroot/public}/fonts/MinecraftDefault-BoldItalic.ttf)', { weight: 'bold', style: 'italic' }),
    new FontFace('Unifont', 'url({webroot/public}/fonts/unifont-17.0.03.otf)', { weight: 'normal', style: 'normal' }),
    new FontFace('UnifontUpper', 'url({webroot/public}/fonts/unifont_upper-17.0.03.otf)', { weight: 'normal', style: 'normal' })
  ];

  try {
    const loadedFonts = await Promise.all(fontsToLoad.map(font => font.load()));
    loadedFonts.forEach(font => document.fonts.add(font));
  } catch (error) {
    console.error("Failed to load one or more fonts:", error);
  } finally {
    // 2. ALWAYS set to true when done, even if a font fails.
    // This guarantees the canvas won't be permanently blank.
    areFontsLoaded = true;
  }
};

// Start loading the fonts immediately if we are in the browser
if (typeof window !== 'undefined') {
  loadAllFonts();
}

interface MotdDisplayProps {
  title: string;
  lineOne: string;
  lineTwo: string;
}

export default ({ title, lineOne, lineTwo }: MotdDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const server = ServerContext.useStoreState((state) => state.server.data!);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const logicalWidth = 305;
    const logicalHeight = 36;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const scaleX = rect.width / logicalWidth;
    const scaleY = rect.height / logicalHeight;

    ctx.scale(dpr * scaleX, dpr * scaleY);

    const parsedServerName = parseMinecraftText(automateEmojiTextPresentation(title) || "test");
    const parsedLineOne = parseMinecraftText(automateEmojiTextPresentation(lineOne) || "test");
    const parsedLineTwo = parseMinecraftText(automateEmojiTextPresentation(lineTwo) || "Test");

    let animationFrameId: number;

    const icon = new Image();
    let isIconLoaded = false;
    let iconObjectUrl: string | null = null;

    icon.onload = () => { isIconLoaded = true; };

    const fallbackIcon = "{webroot/public}/defaulticon.png";

    const loadIcon = async () => {
      try {
        const response = await fetch(`/api/client/servers/${server.uuid}/files/contents?file=/server-icon.png`, {
          headers: { 'Accept': 'image/png' }
        });
        if (!response.ok) throw new Error('Icon not found');
        const blob = await response.blob();
        iconObjectUrl = URL.createObjectURL(blob);
        icon.src = iconObjectUrl;
      } catch {
        icon.src = fallbackIcon;
      }
    };

    loadIcon();

    const ping = new Image();
    let isPingLoaded = false;
    ping.onload = () => { isPingLoaded = true; };
    ping.src = "{webroot/public}/ping.png";

    const render = () => {
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      const drawSegments = (segments: TextSegment[], startX: number, startY: number, defaultColor = "#AAAAAA") => {
        let currentX = startX;

        segments.forEach((segment) => {
          let fontStyle = "";
          if (segment.italic) fontStyle += "italic ";
          if (segment.bold) fontStyle += "bold ";

          // 3. Add standard double quotes and a 'monospace' fallback for maximum compatibility
          ctx.font = `${fontStyle}12px "MinecraftDefault", "Unifont", "UnifontUpper", monospace`;

          const textColor = segment.color || defaultColor;
          const shadowColor = getShadowColor(textColor);

          if (segment.obfuscated) {
            for (let i = 0; i < segment.text.length; i++) {
              const originalChar = segment.text[i];
              const targetWidth = ctx.measureText(originalChar).width;

              if (originalChar === ' ') {
                currentX += targetWidth;
                continue;
              }

              const obfChar = getMatchingObfuscatedChar(targetWidth, ctx, charCache);

              ctx.fillStyle = shadowColor;
              ctx.fillText(obfChar, currentX + 1, startY + 1);

              ctx.fillStyle = textColor;
              ctx.fillText(obfChar, currentX, startY);

              if (segment.strikethrough || segment.underlined) {
                const lineY = segment.strikethrough ? startY - 4 : startY + 1;
                ctx.fillStyle = shadowColor;
                ctx.fillRect(currentX + 1, lineY + 1, targetWidth, 1);
                ctx.fillStyle = textColor;
                ctx.fillRect(currentX, lineY, targetWidth, 1);
              }

              currentX += targetWidth;
            }
          } else {
            const textWidth = ctx.measureText(segment.text).width;

            ctx.fillStyle = shadowColor;
            ctx.fillText(segment.text, currentX + 1, startY + 1);

            if (segment.strikethrough || segment.underlined) {
              const lineY = segment.strikethrough ? startY - 4 : startY + 1;
              ctx.fillRect(currentX + 1, lineY + 1, textWidth, 1);
            }

            ctx.fillStyle = textColor;
            ctx.fillText(segment.text, currentX, startY);

            if (segment.strikethrough || segment.underlined) {
              const lineY = segment.strikethrough ? startY - 4 : startY + 1;
              ctx.fillRect(currentX, lineY, textWidth, 1);
            }

            currentX += textWidth;
          }
        });
      };

      // Now this correctly waits for global fonts to load without resetting
      if (areFontsLoaded) {
        drawSegments(parsedServerName, 37, 10, "#FFFFFF");
        drawSegments(parsedLineOne, 37, 21);
        drawSegments(parsedLineTwo, 37, 30);
      }

      if (isIconLoaded) {
        ctx.drawImage(icon, 2, 2, 32, 32);
      }

      if (isPingLoaded) {
        ctx.drawImage(ping, 290, 2, 10, 7)
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (iconObjectUrl) URL.revokeObjectURL(iconObjectUrl);
    };

  }, [title, lineOne, lineTwo, server.uuid]);

  return (
    <canvas
      ref={canvasRef}
      css={tw`flex-1 w-full bg-black`}
      style={{ aspectRatio: "305 / 36" }}
    ></canvas>
  );
}
