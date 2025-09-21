/**
 * Lightweight Markdown Parser
 * Handles common Markdown formatting for AI chat responses
 */

const MarkdownParser = {
    /**
     * Parse Markdown text to HTML
     * @param {string} text - Markdown text to parse
     * @returns {string} - HTML string
     */
    parse(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Escape HTML first to prevent XSS, then apply Markdown
        let html = this.escapeHtml(text);
        
        // Apply Markdown transformations in order
        html = this.parseCodeBlocks(html);
        html = this.parseInlineCode(html);
        html = this.parseLinks(html);
        html = this.parseBold(html);
        html = this.parseItalic(html);
        html = this.parseStrikethrough(html);
        html = this.parseHeadings(html);
        html = this.parseLists(html);
        html = this.parseBlockquotes(html);
        html = this.parseLineBreaks(html);
        
        return html;
    },

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Parse code blocks (```code```)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseCodeBlocks(text) {
        return text.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
    },

    /**
     * Parse inline code (`code`)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseInlineCode(text) {
        return text.replace(/`([^`]+)`/g, '<code>$1</code>');
    },

    /**
     * Parse links [text](url)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseLinks(text) {
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    },

    /**
     * Parse bold text (**text** or __text__)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseBold(text) {
        // Handle **text** and __text__
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        return text;
    },

    /**
     * Parse italic text (*text* or _text_)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseItalic(text) {
        // Handle *text* and _text_ (but not inside words)
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
        return text;
    },

    /**
     * Parse strikethrough text (~~text~~)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseStrikethrough(text) {
        return text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    },

    /**
     * Parse headings (# ## ### etc.)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseHeadings(text) {
        return text.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content.trim()}</h${level}>`;
        });
    },

    /**
     * Parse unordered lists (- or * or +)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseLists(text) {
        // Handle unordered lists
        text = text.replace(/^([\s]*[-*+]\s+.+(\n[\s]*[-*+]\s+.+)*)/gm, (match) => {
            const items = match
                .split('\n')
                .map(line => line.replace(/^[\s]*[-*+]\s+/, '').trim())
                .filter(item => item.length > 0)
                .map(item => `<li>${item}</li>`)
                .join('');
            return `<ul>${items}</ul>`;
        });

        // Handle ordered lists
        text = text.replace(/^([\s]*\d+\.\s+.+(\n[\s]*\d+\.\s+.+)*)/gm, (match) => {
            const items = match
                .split('\n')
                .map(line => line.replace(/^[\s]*\d+\.\s+/, '').trim())
                .filter(item => item.length > 0)
                .map(item => `<li>${item}</li>`)
                .join('');
            return `<ol>${items}</ol>`;
        });

        return text;
    },

    /**
     * Parse blockquotes (> text)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseBlockquotes(text) {
        return text.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    },

    /**
     * Parse line breaks (convert \n to <br>)
     * @param {string} text - Text to parse
     * @returns {string} - Parsed text
     */
    parseLineBreaks(text) {
        return text.replace(/\n/g, '<br>');
    },

    /**
     * Parse text with safe Markdown rendering
     * This method provides additional safety checks
     * @param {string} text - Text to parse
     * @returns {string} - Safely parsed HTML
     */
    safeParse(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        const parsed = this.parse(text);
        
        // Additional safety: remove any potentially dangerous attributes
        // This is a basic implementation - for production, consider using a proper HTML sanitizer
        return parsed
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '');
    }
};