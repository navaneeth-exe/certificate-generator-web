const mammoth = require('mammoth');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Parse names from various file formats.
 * Supports .docx (Word), .xlsx (Excel), .txt (plain text), and .csv files.
 * Returns a cleaned, deduplicated array of names.
 */
async function parseNames(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();
    let rawNames = [];

    switch (ext) {
        case '.docx':
            rawNames = await parseDocx(filePath);
            break;
        case '.txt':
            rawNames = parseTxt(filePath);
            break;
        case '.csv':
            rawNames = parseCsv(filePath);
            break;
        case '.xlsx':
        case '.xls':
            rawNames = parseXlsx(filePath);
            break;
        default:
            throw new Error(`Unsupported file format: ${ext}. Please upload a .docx, .xlsx, .txt, or .csv file.`);
    }

    // Clean and deduplicate
    const cleaned = rawNames
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .filter(name => !/^(name|names|s\.?\s*no\.?|sr\.?\s*no\.?|serial|#|participant)/i.test(name)); // Skip headers

    // Deduplicate while preserving order
    const seen = new Set();
    const unique = [];
    for (const name of cleaned) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(name);
        }
    }

    return unique;
}

/**
 * Extract names from a Word document (.docx)
 * Each paragraph/line is treated as a separate name
 */
async function parseDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    // Split by newlines (mammoth uses \n\n between paragraphs, but also handle \n)
    return text.split(/\n+/);
}

/**
 * Extract names from a plain text file (.txt)
 * One name per line
 */
function parseTxt(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split(/\r?\n/);
}

/**
 * Extract names from a CSV file (.csv)
 * Assumes names are in the first column, handles quoted values
 */
function parseCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const names = [];

    for (const line of lines) {
        if (line.trim().length === 0) continue;

        // Take the first column value
        let value;
        if (line.startsWith('"')) {
            // Handle quoted CSV values
            const endQuote = line.indexOf('"', 1);
            value = endQuote > 0 ? line.substring(1, endQuote) : line;
        } else {
            value = line.split(',')[0];
        }

        names.push(value.trim());
    }

    return names;
}

/**
 * Extract names from an Excel file (.xlsx / .xls)
 * Reads the first sheet, takes values from the first column
 */
function parseXlsx(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const names = [];

    for (const row of rows) {
        if (row.length > 0 && row[0] != null) {
            const value = String(row[0]).trim();
            if (value.length > 0) {
                names.push(value);
            }
        }
    }

    return names;
}

module.exports = { parseNames };
