const libre = require('libreoffice-convert');
const util = require('util');

const convertAsync = util.promisify(libre.convert);

let libreOfficeAvailable = null;

/**
 * Check if LibreOffice is available on the system.
 * Caches the result for subsequent calls.
 */
async function checkLibreOffice() {
    if (libreOfficeAvailable !== null) return libreOfficeAvailable;

    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    // 1. Try direct commands first
    const commands = ['soffice --version', 'libreoffice --version'];
    for (const cmd of commands) {
        try {
            execSync(cmd, { stdio: 'pipe', timeout: 10000 });
            libreOfficeAvailable = true;
            return true;
        } catch {
            // Continue to next check
        }
    }

    // 2. Check common Windows install paths
    const windowsPaths = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'LibreOffice', 'program', 'soffice.exe'),
    ];

    for (const p of windowsPaths) {
        if (fs.existsSync(p)) {
            // Add to PATH for libreoffice-convert to find it
            const dir = path.dirname(p);
            process.env.PATH = dir + path.delimiter + process.env.PATH;
            libreOfficeAvailable = true;
            console.log(`📍 Found LibreOffice at: ${dir}`);
            return true;
        }
    }

    // 3. Try 'where' command on Windows
    try {
        execSync('where soffice', { stdio: 'pipe', timeout: 5000 });
        libreOfficeAvailable = true;
        return true;
    } catch {
        // Not found
    }

    libreOfficeAvailable = false;
    return false;
}

/**
 * Convert a PPTX buffer to PDF.
 * Returns { buffer, format } where format is 'pdf' or 'pptx' (fallback).
 */
async function convertToPdf(pptxBuffer) {
    const isAvailable = await checkLibreOffice();

    if (!isAvailable) {
        console.warn('⚠️  LibreOffice not found. Returning PPTX instead of PDF.');
        return {
            buffer: pptxBuffer,
            format: 'pptx',
            warning: 'LibreOffice is not installed. Certificates are in PPTX format. Install LibreOffice for PDF output.'
        };
    }

    try {
        const pdfBuffer = await convertAsync(pptxBuffer, '.pdf', undefined);
        return {
            buffer: pdfBuffer,
            format: 'pdf',
            warning: null
        };
    } catch (error) {
        console.error('PDF conversion failed:', error.message);
        return {
            buffer: pptxBuffer,
            format: 'pptx',
            warning: `PDF conversion failed: ${error.message}. Falling back to PPTX format.`
        };
    }
}

module.exports = { convertToPdf, checkLibreOffice };
