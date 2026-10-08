// Draws ```nomnoml code blocks as UML diagrams, the way Marp's Mermaid plugin draws ```mermaid blocks. It has the
// same shape as Marp's own plugins (a default export that makes a markdown-it plugin), so the story editor loads
// it beside them. nomnoml lays a diagram out synchronously, which is what lets it render inside Marp's render().
import { renderSvg } from 'https://esm.sh/nomnoml@1.7.0';

const LANGUAGE = 'nomnoml';

// A custom style directive, such as `#.tesco: visual=package fill=pink`: the name and colon, then the options.
const STYLE_DIRECTIVE = /^(\s*#\.[^:\s]+\s*:)(.*)$/gm;

// nomnoml draws a package's tab at its left, just as wide as the name, and its built-in <package> style
// left-aligns the name to sit in it. A custom style centres its title unless told otherwise, so a custom style
// drawn as a package puts its name in the middle of the package, outside the tab. The alignment is filled in
// here, unless the style already says where its title goes (title=left or title=center, or align=).
function alignPackageTitles(source) {
    return source.replace(STYLE_DIRECTIVE, (directive, head, options) => {
        if (!/(^|\s)visual=package(\s|$)/.test(options) || /(^|\s)align=/.test(options)) return directive;

        const title = options.match(/(^|\s)title=([^\s]*)/);
        if (!title) return `${head}${options.replace(/\s*$/, '')} title=left`;
        if (/\b(left|center)\b/.test(title[2])) return directive;
        return head + options.replace(`title=${title[2]}`, `title=${title[2] ? `${title[2]},` : ''}left`);
    });
}

export default function nomnomlPlugin() {
    return (md) => {
        // Wraps the fence renderer already in place (Shiki's, when it is loaded first), so any other code block,
        // and a diagram that fails to parse, still renders as highlighted code.
        const renderFence = md.renderer.rules.fence;

        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const [language] = md.utils.unescapeAll(token.info).trim().split(/\s+/, 1);

            if (language === LANGUAGE) {
                try {
                    const svg = renderSvg(alignPackageTitles(token.content)).replace(/^<svg\b/, '<svg data-nomnoml');
                    return `<p>${svg}</p>\n`;
                } catch (e) {
                    // A syntax error shows the source as a code block, so the author can see what to fix. The
                    // preview renders as the author types, so only the message is logged, not the stack.
                    console.warn('[Story] Failed to draw a nomnoml diagram:', e?.message ?? e);
                }
            }

            return renderFence(tokens, idx, options, env, self);
        };
    };
}
