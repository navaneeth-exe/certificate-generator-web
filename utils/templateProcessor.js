const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const PLACEHOLDER = 'NAME';
const TAG = `{${PLACEHOLDER}}`;

/**
 * Normalize and fix placeholder tags in PPTX slide XML.
 *
 * Handles multiple common issues:
 * 1. Users typing {{NAME}} (double braces) instead of {NAME}
 * 2. Canva/PowerPoint splitting {NAME} across multiple <a:r> XML runs
 * 3. Mixed casing like {name} or {Name}
 */
function fixSlideXml(xmlContent) {
    // Step 1: Normalize double-brace variants to single-brace
    // Handles {{NAME}}, {{ NAME }}, {{name}}, etc.
    xmlContent = xmlContent.replace(/\{\{\s*NAME\s*\}\}/gi, TAG);

    // Step 2: If {NAME} already exists cleanly, we're done
    if (xmlContent.includes(TAG)) {
        return xmlContent;
    }

    // Step 3: Handle split runs — {NAME} broken across multiple <a:t> elements
    // e.g., <a:t>{</a:t></a:r><a:r><a:t>NAME}</a:t>
    // Strategy: extract text from consecutive <a:t> tags, find {NAME} pattern,
    // and merge those runs.

    // Find all <a:t> content and their positions
    const textTagRegex = /<a:t[^>]*>(.*?)<\/a:t>/g;
    let match;
    const textNodes = [];

    while ((match = textTagRegex.exec(xmlContent)) !== null) {
        textNodes.push({
            fullMatch: match[0],
            text: match[1],
            index: match.index,
            end: match.index + match[0].length,
        });
    }

    // Concatenate all text content and find {NAME} (case-insensitive)
    const allText = textNodes.map(n => n.text).join('');
    const nameIndex = allText.toUpperCase().indexOf('{NAME}');

    if (nameIndex === -1) {
        // Also check for {{NAME}} in concatenated text
        const doubleIndex = allText.toUpperCase().indexOf('{{NAME}}');
        if (doubleIndex !== -1) {
            // Find which text nodes span {{NAME}} and replace
            return replaceInTextNodes(xmlContent, textNodes, allText, doubleIndex, 8, TAG);
        }
        return xmlContent;
    }

    // {NAME} is found spanning across text nodes — replace
    return replaceInTextNodes(xmlContent, textNodes, allText, nameIndex, 6, TAG);
}

/**
 * Replace text spanning across multiple <a:t> nodes in the XML.
 */
function replaceInTextNodes(xmlContent, textNodes, allText, startPos, length, replacement) {
    // Find which text nodes contain the target text
    let charPos = 0;
    let startNodeIdx = -1, endNodeIdx = -1;
    let startOffset = -1, endOffset = -1;

    for (let i = 0; i < textNodes.length; i++) {
        const nodeStart = charPos;
        const nodeEnd = charPos + textNodes[i].text.length;

        if (startNodeIdx === -1 && startPos >= nodeStart && startPos < nodeEnd) {
            startNodeIdx = i;
            startOffset = startPos - nodeStart;
        }
        if (startPos + length > nodeStart && startPos + length <= nodeEnd) {
            endNodeIdx = i;
            endOffset = startPos + length - nodeStart;
        }

        charPos = nodeEnd;
    }

    if (startNodeIdx === -1 || endNodeIdx === -1) return xmlContent;

    if (startNodeIdx === endNodeIdx) {
        // All within one node — simple replacement
        const node = textNodes[startNodeIdx];
        const newText = node.text.substring(0, startOffset) + replacement + node.text.substring(endOffset);
        const newTag = node.fullMatch.replace(node.text, newText);
        return xmlContent.substring(0, node.index) + newTag + xmlContent.substring(node.end);
    }

    // Spans multiple nodes: put replacement in first node, clear the rest
    let result = xmlContent;
    // Work backwards to preserve indices
    for (let i = endNodeIdx; i >= startNodeIdx; i--) {
        const node = textNodes[i];
        let newText;
        if (i === startNodeIdx) {
            newText = node.text.substring(0, startOffset) + replacement;
        } else if (i === endNodeIdx) {
            newText = node.text.substring(endOffset);
        } else {
            newText = '';
        }
        const newTag = node.fullMatch.replace(`>${node.text}<`, `>${newText}<`);
        result = result.substring(0, node.index) + newTag + result.substring(node.end);
    }

    return result;
}

/**
 * Pre-process a PPTX zip to fix tags in all slides.
 * Returns the modified zip.
 */
function preprocessTemplate(zip) {
    const files = zip.files;
    for (const fileName in files) {
        if (fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')) {
            let content = zip.file(fileName).asText();
            const fixed = fixSlideXml(content);
            if (fixed !== content) {
                zip.file(fileName, fixed);
            }
        }
    }
    return zip;
}

/**
 * Validate that a PPTX template buffer contains the {NAME} placeholder.
 * Returns an object with validation results and detected placeholders.
 */
function validateTemplate(buffer) {
    try {
        const zip = new PizZip(buffer);

        // Pre-process to fix split/double-brace tags
        preprocessTemplate(zip);

        // Check for placeholder in slide XML directly (most reliable)
        let foundInSlides = false;
        for (const fileName in zip.files) {
            if (fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')) {
                const slideContent = zip.file(fileName).asText();
                if (slideContent.includes(TAG)) {
                    foundInSlides = true;
                    break;
                }
            }
        }

        // Also try docxtemplater parsing (with error suppression)
        let hasNamePlaceholder = false;
        try {
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{', end: '}' }
            });
            const fullText = doc.getFullText();
            hasNamePlaceholder = fullText.includes(TAG);
        } catch {
            // Ignore docxtemplater parse errors during validation
            // We rely on the direct XML check
        }

        const isValid = hasNamePlaceholder || foundInSlides;

        return {
            valid: isValid,
            placeholder: TAG,
            message: isValid
                ? `Template is valid. Found ${TAG} placeholder.`
                : `Template does not contain ${TAG} placeholder. Please add ${TAG} (with single curly braces) where the participant name should appear.`
        };
    } catch (error) {
        return {
            valid: false,
            placeholder: TAG,
            message: `Could not read PPTX file. Please ensure it's a valid PowerPoint file: ${error.message}`
        };
    }
}

/**
 * Generate a certificate by replacing the {NAME} placeholder in the template.
 * Returns a Buffer containing the modified PPTX file.
 */
function generateCertificate(templateBuffer, name) {
    const zip = new PizZip(templateBuffer);

    // Pre-process to fix split/double-brace tags
    preprocessTemplate(zip);

    try {
        // Try docxtemplater first (best quality — preserves formatting)
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
        });

        doc.render({ [PLACEHOLDER]: name });

        return doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE'
        });
    } catch {
        // Fallback: direct XML string replacement
        console.warn(`Docxtemplater failed for "${name}", using direct XML replacement`);

        for (const fileName in zip.files) {
            if (fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')) {
                let content = zip.file(fileName).asText();
                if (content.includes(TAG)) {
                    content = content.split(TAG).join(escapeXml(name));
                    zip.file(fileName, content);
                }
            }
        }

        return zip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE'
        });
    }
}

/**
 * Escape special XML characters in a name
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = { validateTemplate, generateCertificate, PLACEHOLDER };
