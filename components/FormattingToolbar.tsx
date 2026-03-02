import React, { useState } from 'react';
import tw from 'twin.macro';

const COLOR_MAP: Record<string, string> = {
    black: '#000000',
    dark_blue: '#0000AA',
    dark_green: '#00AA00',
    dark_aqua: '#00AAAA',
    dark_red: '#AA0000',
    dark_purple: '#AA00AA',
    gold: '#FFAA00',
    gray: '#AAAAAA',
    dark_gray: '#555555',
    blue: '#5555FF',
    green: '#55FF55',
    aqua: '#55FFFF',
    red: '#FF5555',
    light_purple: '#FF55FF',
    yellow: '#FFFF55',
    white: '#FFFFFF',
};

export function insertTag(
    ref: React.RefObject<HTMLTextAreaElement>,
    openTag: string,
    closeTag: string,
    value: string,
    onChange: (v: string) => void
): void {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    let newValue: string;
    let newCursorPos: number;

    if (start !== end) {
        const selected = value.substring(start, end);
        newValue = value.substring(0, start) + openTag + selected + closeTag + value.substring(end);
        newCursorPos = start + openTag.length + selected.length + closeTag.length;
    } else {
        newValue = value.substring(0, start) + openTag + value.substring(start);
        newCursorPos = start + openTag.length;
    }

    onChange(newValue);

    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
}

interface FormattingToolbarProps {
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export default function FormattingToolbar({ textareaRef, value, onChange }: FormattingToolbarProps) {
    const [gradientColors, setGradientColors] = useState<string[]>(['#FF5555', '#5555FF']);
    const [gradientOpen, setGradientOpen] = useState(false);

    const handleInsert = (openTag: string, closeTag: string) => {
        insertTag(textareaRef, openTag, closeTag, value, (newValue) => {
            onChange({ target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>);
        });
    };

    const handleHexColor = (e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value.toUpperCase();
        handleInsert(`<${hex}>`, '</color>');
    };

    const handleGradientInsert = () => {
        const colorsStr = gradientColors.map((c) => c.toUpperCase()).join(':');
        handleInsert(`<gradient:${colorsStr}>`, '</gradient>');
    };

    const gradientStyle = `linear-gradient(to right, ${gradientColors.join(', ')})`;

    return (
        <div css={tw`mb-2 p-2 rounded flex flex-col gap-2`} style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            {/* Section 1: Decoration buttons */}
            <div css={tw`flex flex-wrap gap-1`}>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white font-bold text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<bold>', '</bold>')}
                    title='Bold'
                >
                    <strong>B</strong>
                </button>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white italic text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<italic>', '</italic>')}
                    title='Italic'
                >
                    <em>I</em>
                </button>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white underline text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<underlined>', '</underlined>')}
                    title='Underlined'
                >
                    U
                </button>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white line-through text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<strikethrough>', '</strikethrough>')}
                    title='Strikethrough'
                >
                    S
                </button>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<obfuscated>', '</obfuscated>')}
                    title='Obfuscated'
                >
                    ?
                </button>
                <button
                    type='button'
                    css={tw`px-2 py-1 rounded text-white text-sm hover:opacity-80`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => handleInsert('<reset>', '')}
                    title='Reset formatting'
                >
                    Reset
                </button>
            </div>

            {/* Section 2: Named color swatches */}
            <div css={tw`flex flex-wrap gap-1`}>
                {Object.entries(COLOR_MAP).map(([name, hex]) => (
                    <button
                        key={name}
                        type='button'
                        title={name}
                        onClick={() => handleInsert('<' + name + '>', '</' + name + '>')}
                        css={tw`rounded-full hover:opacity-80`}
                        style={{
                            backgroundColor: hex,
                            width: '20px',
                            height: '20px',
                            border: '1px solid rgba(255,255,255,0.25)',
                            padding: 0,
                            flexShrink: 0,
                        }}
                    />
                ))}
            </div>

            {/* Section 3: Hex color picker */}
            <div css={tw`flex items-center gap-2`}>
                <span css={tw`text-white text-xs`}>Hex color:</span>
                <input
                    type='color'
                    onChange={handleHexColor}
                    title='Pick a hex color'
                    style={{
                        width: '24px',
                        height: '24px',
                        padding: '0',
                        border: '1px solid rgba(255,255,255,0.25)',
                        cursor: 'pointer',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                    }}
                />
            </div>

            {/* Section 4: Gradient builder */}
            <div css={tw`flex flex-col gap-1`}>
                <button
                    type='button'
                    css={tw`text-white text-xs text-left hover:opacity-80 w-max`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    onClick={() => setGradientOpen((o) => !o)}
                >
                    {gradientOpen ? '▾' : '▸'} Gradient
                </button>
                {gradientOpen && (
                    <>
                        <div css={tw`flex items-center gap-2 flex-wrap`}>
                            {gradientColors.map((color, i) => (
                                <div key={i} css={tw`flex items-center gap-1`}>
                                    <input
                                        type='color'
                                        value={color}
                                        onChange={(e) => {
                                            const newColors = [...gradientColors];
                                            newColors[i] = e.target.value;
                                            setGradientColors(newColors);
                                        }}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid rgba(255,255,255,0.25)',
                                            cursor: 'pointer',
                                            borderRadius: '50%',
                                            backgroundColor: 'transparent',
                                        }}
                                    />
                                    {gradientColors.length > 2 && (
                                        <button
                                            type='button'
                                            css={tw`text-red-400 text-xs hover:text-red-300`}
                                            style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer' }}
                                            onClick={() => setGradientColors(gradientColors.filter((_, idx) => idx !== i))}
                                            title='Remove color stop'
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type='button'
                                css={tw`px-2 py-0.5 rounded text-white text-xs hover:opacity-80`}
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                                onClick={() => setGradientColors([...gradientColors, '#FFFFFF'])}
                                title='Add color stop'
                            >
                                +
                            </button>
                            <button
                                type='button'
                                css={tw`px-2 py-1 rounded text-white text-xs hover:opacity-80`}
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                                onClick={handleGradientInsert}
                            >
                                Insert
                            </button>
                        </div>
                        <div style={{ background: gradientStyle, height: '8px', borderRadius: '4px', marginTop: '2px' }} />
                    </>
                )}
            </div>
        </div>
    );
}
