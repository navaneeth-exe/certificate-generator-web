const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');

const { parseNames } = require('./utils/nameParser');
const { validateTemplate, generateCertificate } = require('./utils/templateProcessor');
const { convertToPdf, checkLibreOffice } = require('./utils/pdfConverter');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory store for active jobs
const jobs = new Map();

// ─── API: Check LibreOffice availability ───
app.get('/api/check-libreoffice', async (req, res) => {
    const available = await checkLibreOffice();
    res.json({ available });
});

// ─── API: Upload Template ───
app.post('/api/upload-template', upload.single('template'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext !== '.pptx') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Only .pptx files are supported. Please export your Canva design as PowerPoint.' });
        }

        const buffer = fs.readFileSync(req.file.path);
        const validation = validateTemplate(buffer);

        res.json({
            fileId: path.basename(req.file.path),
            fileName: req.file.originalname,
            fileSize: req.file.size,
            ...validation
        });
    } catch (error) {
        console.error('Template upload error:', error);
        res.status(500).json({ error: 'Failed to process template: ' + error.message });
    }
});

// ─── API: Upload Names ───
app.post('/api/upload-names', upload.single('names'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        if (!['.docx', '.xlsx', '.xls', '.txt', '.csv'].includes(ext)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Unsupported file format. Please upload a .docx, .xlsx, .txt, or .csv file.' });
        }

        const names = await parseNames(req.file.path, req.file.originalname);

        if (names.length === 0) {
            return res.status(400).json({ error: 'No names found in the uploaded file. Please check the file content.' });
        }

        res.json({
            fileId: path.basename(req.file.path),
            fileName: req.file.originalname,
            count: names.length,
            names
        });
    } catch (error) {
        console.error('Names upload error:', error);
        res.status(500).json({ error: 'Failed to parse names: ' + error.message });
    }
});

// ─── API: Generate Certificates (SSE for progress) ───
app.post('/api/generate', async (req, res) => {
    const { templateFileId, names } = req.body;

    if (!templateFileId || !names || !Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ error: 'Template file ID and a list of names are required.' });
    }

    const templatePath = path.join(uploadsDir, templateFileId);
    if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ error: 'Template file not found. Please re-upload.' });
    }

    // Setup SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const templateBuffer = fs.readFileSync(templatePath);
        const jobId = uuidv4();
        const jobDir = path.join(outputDir, jobId);
        fs.mkdirSync(jobDir, { recursive: true });

        const total = names.length;
        const files = [];
        let formatWarning = null;

        sendEvent('start', { jobId, total });

        // Check LibreOffice once
        const libreAvailable = await checkLibreOffice();
        if (!libreAvailable) {
            formatWarning = 'LibreOffice not found. Generating PPTX files instead of PDF. Install LibreOffice for PDF output.';
            sendEvent('warning', { message: formatWarning });
        }

        for (let i = 0; i < total; i++) {
            const name = names[i];
            const safeName = name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);

            try {
                // Generate certificate PPTX
                const certBuffer = generateCertificate(templateBuffer, name);

                // Convert to PDF if possible
                const result = await convertToPdf(certBuffer);
                const ext = result.format === 'pdf' ? '.pdf' : '.pptx';
                const fileName = `${safeName}${ext}`;
                const filePath = path.join(jobDir, fileName);

                fs.writeFileSync(filePath, result.buffer);
                files.push({ name, fileName, format: result.format });

                sendEvent('progress', {
                    current: i + 1,
                    total,
                    name,
                    fileName,
                    format: result.format
                });
            } catch (error) {
                sendEvent('error', {
                    current: i + 1,
                    total,
                    name,
                    error: error.message
                });
            }
        }

        // Store job info
        jobs.set(jobId, {
            dir: jobDir,
            files,
            createdAt: Date.now(),
            format: files[0]?.format || 'pptx'
        });

        sendEvent('complete', {
            jobId,
            total: files.length,
            format: files[0]?.format || 'pptx',
            warning: formatWarning
        });

        res.end();

        // Auto-cleanup after 1 hour
        setTimeout(() => {
            cleanupJob(jobId);
        }, 60 * 60 * 1000);

    } catch (error) {
        console.error('Generation error:', error);
        sendEvent('fatal', { error: error.message });
        res.end();
    }
});

// ─── API: Download Individual Certificate ───
app.get('/api/download/:jobId/:fileName', (req, res) => {
    const { jobId, fileName } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found or expired.' });
    }

    const filePath = path.join(job.dir, fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found.' });
    }

    res.download(filePath, fileName);
});

// ─── API: Download All as ZIP ───
app.get('/api/download-zip/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found or expired.' });
    }

    const archive = archiver('zip', { zlib: { level: 6 } });

    res.attachment('certificates.zip');
    archive.pipe(res);

    for (const file of job.files) {
        const filePath = path.join(job.dir, file.fileName);
        if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: file.fileName });
        }
    }

    archive.finalize();
});

// ─── Cleanup helper ───
function cleanupJob(jobId) {
    const job = jobs.get(jobId);
    if (job && fs.existsSync(job.dir)) {
        fs.rmSync(job.dir, { recursive: true, force: true });
        jobs.delete(jobId);
        console.log(`🗑️  Cleaned up job: ${jobId}`);
    }
}

// ─── Clean old uploads periodically (every 30 min) ───
setInterval(() => {
    const now = Date.now();
    // Clean uploads older than 1 hour
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > 60 * 60 * 1000) {
                fs.unlinkSync(filePath);
            }
        }
    }
    // Clean expired jobs
    for (const [jobId, job] of jobs.entries()) {
        if (now - job.createdAt > 60 * 60 * 1000) {
            cleanupJob(jobId);
        }
    }
}, 30 * 60 * 1000);

// ─── Start server ───
app.listen(PORT, () => {
    console.log(`\n🎓 Certificate Generator running at http://localhost:${PORT}\n`);
    checkLibreOffice().then(available => {
        if (available) {
            console.log('✅ LibreOffice detected — PDF output enabled');
        } else {
            console.log('⚠️  LibreOffice not found — will output PPTX files');
            console.log('   Install LibreOffice for PDF conversion: https://www.libreoffice.org/download/\n');
        }
    });
});
