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
        case '.xlsx':
        case '.xls':
            rawNames = parseSpreadsheet(filePath);
            break;
        default:
            throw new Error(`Unsupported file format: ${ext}. Please upload a .docx, .xlsx, .txt, or .csv file.`);
    }

    // Clean and deduplicate
    const cleaned = rawNames
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .filter(name => !/^(name|names|s\.?\s*no\.?|sr\.?\s*no\.?|serial|#|participant)/i.test(name)); // Skip generic headers just in case

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
 * Extract names from an Excel or CSV file (.xlsx / .xls / .csv)
 * Intelligently scans the header row to find the "name" column.
 * Defaults to the first column if no explicit header is found.
 */
function parseSpreadsheet(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const names = [];

    if (rows.length === 0) return names;

    let nameColIndex = 0;
    const headerRow = rows[0] || [];
    const nameRegex = /^(name|full\s*name|first\s*name|participant|candidate|student|employee)/i;
    
    // Look for a column header that matches a typical "name" column
    for (let i = 0; i < headerRow.length; i++) {
        if (nameRegex.test(String(headerRow[i]).trim())) {
            nameColIndex = i;
            break;
        }
    }

    // If the first row was determined to be a header, skip it
    let startRow = 0;
    if (headerRow.length > nameColIndex && nameRegex.test(String(headerRow[nameColIndex]).trim())) {
        startRow = 1;
    }

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (row.length > nameColIndex && row[nameColIndex] != null) {
            const value = String(row[nameColIndex]).trim();
            if (value.length > 0) {
                names.push(value);
            }
        }
    }

    return names;
}

module.exports = { parseNames };
