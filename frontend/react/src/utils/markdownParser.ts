// Ported 1:1 from nginx/static/profile/modules/markdownParser.js — a lightweight
// Markdown-to-HTML parser for AI chat responses, used only by AiChatWidget.
// Escapes HTML first, then applies transformations in the same order the
// legacy code did (order matters: code blocks before inline code, before
// bold/italic, etc).

const escapeHtml = (text: string): string => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

const parseCodeBlocks = (text: string): string =>
    text.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code.trim()}</code></pre>`);

const parseInlineCode = (text: string): string => text.replace(/`([^`]+)`/g, '<code>$1</code>');

const parseLinks = (text: string): string =>
    text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

const parseBold = (text: string): string =>
    text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');

const parseItalic = (text: string): string =>
    text.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\b_([^_]+)_\b/g, '<em>$1</em>');

const parseStrikethrough = (text: string): string => text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

const parseHeadings = (text: string): string =>
    text.replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes: string, content: string) => {
        const level = hashes.length;
        return `<h${level}>${content.trim()}</h${level}>`;
    });

const parseLists = (text: string): string => {
    let out = text.replace(/^([\s]*[-*+]\s+.+(\n[\s]*[-*+]\s+.+)*)/gm, (match) => {
        const items = match.split('\n')
            .map((line) => line.replace(/^[\s]*[-*+]\s+/, '').trim())
            .filter((item) => item.length > 0)
            .map((item) => `<li>${item}</li>`)
            .join('');
        return `<ul>${items}</ul>`;
    });
    out = out.replace(/^([\s]*\d+\.\s+.+(\n[\s]*\d+\.\s+.+)*)/gm, (match) => {
        const items = match.split('\n')
            .map((line) => line.replace(/^[\s]*\d+\.\s+/, '').trim())
            .filter((item) => item.length > 0)
            .map((item) => `<li>${item}</li>`)
            .join('');
        return `<ol>${items}</ol>`;
    });
    return out;
};

const parseBlockquotes = (text: string): string => text.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

const parseLineBreaks = (text: string): string => text.replace(/\n/g, '<br>');

const parse = (text: string): string => {
    if (!text) return '';
    let html = escapeHtml(text);
    html = parseCodeBlocks(html);
    html = parseInlineCode(html);
    html = parseLinks(html);
    html = parseBold(html);
    html = parseItalic(html);
    html = parseStrikethrough(html);
    html = parseHeadings(html);
    html = parseLists(html);
    html = parseBlockquotes(html);
    html = parseLineBreaks(html);
    return html;
};

// Additional safety pass on top of parse() — strips javascript: URLs, inline
// event handlers, and <script> tags. Matches the legacy safeParse()'s own
// caveat: a basic implementation, not a full HTML sanitizer.
export const safeParseMarkdown = (text: string): string => {
    if (!text) return '';
    return parse(text)
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '');
};
