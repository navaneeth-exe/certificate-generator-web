/* ═══════════════════════════════════════════
   CertForge — Client-Side Application Logic
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ─── State ───
    const state = {
        currentStep: 1,
        templateFileId: null,
        templateFileName: null,
        names: [],
        jobId: null,
        outputFormat: 'pdf',
        libreOfficeAvailable: false,
    };

    // ─── DOM References ───
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    const els = {
        // Step Indicator
        stepIndicator: $('stepIndicator'),
        // Step 1
        templateDropzone: $('templateDropzone'),
        templateInput: $('templateInput'),
        templateResult: $('templateResult'),
        templateFileName: $('templateFileName'),
        templateMeta: $('templateMeta'),
        templateRemove: $('templateRemove'),
        templateError: $('templateError'),
        templateErrorText: $('templateErrorText'),
        btnToStep2: $('btnToStep2'),
        // Step 2
        namesDropzone: $('namesDropzone'),
        namesInput: $('namesInput'),
        tabFile: $('tabFile'),
        tabManual: $('tabManual'),
        tabContentFile: $('tabContentFile'),
        tabContentManual: $('tabContentManual'),
        manualNames: $('manualNames'),
        btnAddManual: $('btnAddManual'),
        namesListContainer: $('namesListContainer'),
        namesCount: $('namesCount'),
        namesList: $('namesList'),
        btnClearNames: $('btnClearNames'),
        btnBackToStep1: $('btnBackToStep1'),
        btnToStep3: $('btnToStep3'),
        // Step 3
        generateSubtitle: $('generateSubtitle'),
        generateSummary: $('generateSummary'),
        summaryTemplate: $('summaryTemplate'),
        summaryCount: $('summaryCount'),
        summaryFormat: $('summaryFormat'),
        progressContainer: $('progressContainer'),
        progressText: $('progressText'),
        progressPercent: $('progressPercent'),
        progressFill: $('progressFill'),
        progressCurrent: $('progressCurrent'),
        warningBanner: $('warningBanner'),
        warningText: $('warningText'),
        generateActions: $('generateActions'),
        btnBackToStep2: $('btnBackToStep2'),
        btnGenerate: $('btnGenerate'),
        generateSection: $('generateSection'),
        downloadSection: $('downloadSection'),
        downloadCount: $('downloadCount'),
        btnDownloadZip: $('btnDownloadZip'),
        fileList: $('fileList'),
        btnNewJob: $('btnNewJob'),
        // Preview Modal
        btnPreview: $('btnPreview'),
        previewModal: $('previewModal'),
        btnClosePreview: $('btnClosePreview'),
        previewModalBody: $('previewModalBody'),
        // Libre status
        libreStatus: $('libreStatus'),
        // Toast
        toastContainer: $('toastContainer'),
    };

    // ─── Init: Check LibreOffice ───
    checkLibreOffice();

    async function checkLibreOffice() {
        try {
            const res = await fetch('/api/check-libreoffice');
            const data = await res.json();
            state.libreOfficeAvailable = data.available;
            state.outputFormat = data.available ? 'pdf' : 'pptx';

            const statusEl = els.libreStatus;
            if (data.available) {
                statusEl.classList.add('available');
                statusEl.querySelector('.status-text').textContent = 'PDF output ready';
            } else {
                statusEl.classList.add('unavailable');
                statusEl.querySelector('.status-text').textContent = 'PPTX output (no LibreOffice)';
            }
        } catch {
            els.libreStatus.querySelector('.status-text').textContent = 'Status unknown';
        }
    }

    // ═══════════════════════════════════════
    //  STEP NAVIGATION
    // ═══════════════════════════════════════

    function goToStep(step) {
        state.currentStep = step;

        // Update step indicator
        $$('.step-item').forEach(item => {
            const s = parseInt(item.dataset.step);
            item.classList.toggle('active', s === step);
            item.classList.toggle('completed', s < step);
        });

        // Update panels
        $$('.step-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        $(`step${step}`).classList.add('active');

        // Update step 3 summary if going to step 3
        if (step === 3) {
            updateSummary();
        }
    }

    els.btnToStep2.addEventListener('click', () => goToStep(2));
    els.btnBackToStep1.addEventListener('click', () => goToStep(1));
    els.btnToStep3.addEventListener('click', () => goToStep(3));
    els.btnBackToStep2.addEventListener('click', () => goToStep(2));

    // ═══════════════════════════════════════
    //  STEP 1: Template Upload
    // ═══════════════════════════════════════

    // Dropzone events
    setupDropzone(els.templateDropzone, els.templateInput, handleTemplateFile);

    els.templateRemove.addEventListener('click', () => {
        state.templateFileId = null;
        state.templateFileName = null;
        els.templateResult.classList.add('hidden');
        els.templateError.classList.add('hidden');
        els.templateDropzone.classList.remove('hidden');
        els.btnToStep2.disabled = true;
    });

    async function handleTemplateFile(file) {
        if (!file.name.toLowerCase().endsWith('.pptx')) {
            showTemplateError('Please upload a .pptx file. Export your Canva design as PowerPoint.');
            return;
        }

        els.templateDropzone.classList.add('hidden');
        els.templateError.classList.add('hidden');

        const formData = new FormData();
        formData.append('template', file);

        try {
            showToast('Uploading template...', 'success');
            const res = await fetch('/api/upload-template', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) {
                showTemplateError(data.error);
                els.templateDropzone.classList.remove('hidden');
                return;
            }

            if (!data.valid) {
                showTemplateError(data.message);
                els.templateDropzone.classList.remove('hidden');
                return;
            }

            state.templateFileId = data.fileId;
            state.templateFileName = data.fileName;

            els.templateFileName.textContent = data.fileName;
            els.templateMeta.textContent = `${formatSize(data.fileSize)} · Placeholder ${data.placeholder} found`;
            els.templateResult.classList.remove('hidden');
            els.btnToStep2.disabled = false;
            showToast('Template uploaded successfully!', 'success');
        } catch (err) {
            showTemplateError('Upload failed. Please try again.');
            els.templateDropzone.classList.remove('hidden');
        }
    }

    function showTemplateError(message) {
        els.templateErrorText.textContent = message;
        els.templateError.classList.remove('hidden');
        showToast(message, 'error');
    }

    // ═══════════════════════════════════════
    //  STEP 2: Names Input
    // ═══════════════════════════════════════

    // Tabs
    els.tabFile.addEventListener('click', () => {
        els.tabFile.classList.add('active');
        els.tabManual.classList.remove('active');
        els.tabContentFile.classList.add('active');
        els.tabContentManual.classList.remove('active');
    });

    els.tabManual.addEventListener('click', () => {
        els.tabManual.classList.add('active');
        els.tabFile.classList.remove('active');
        els.tabContentManual.classList.add('active');
        els.tabContentFile.classList.remove('active');
    });

    // File upload
    setupDropzone(els.namesDropzone, els.namesInput, handleNamesFile);

    async function handleNamesFile(file) {
        const ext = file.name.toLowerCase().split('.').pop();
        if (!['docx', 'xlsx', 'xls', 'txt', 'csv'].includes(ext)) {
            showToast('Unsupported format. Please upload .docx, .xlsx, .txt, or .csv', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('names', file);

        try {
            showToast('Parsing names...', 'success');
            const res = await fetch('/api/upload-names', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) {
                showToast(data.error, 'error');
                return;
            }

            setNames(data.names);
            showToast(`Found ${data.names.length} names!`, 'success');
        } catch {
            showToast('Failed to parse names. Please try again.', 'error');
        }
    }

    // Manual entry
    els.btnAddManual.addEventListener('click', () => {
        const text = els.manualNames.value.trim();
        if (!text) return;

        const newNames = text.split('\n')
            .map(n => n.trim())
            .filter(n => n.length > 0);

        if (newNames.length === 0) {
            showToast('No valid names entered.', 'warning');
            return;
        }

        const combined = [...state.names, ...newNames];
        setNames(combined);
        els.manualNames.value = '';
        showToast(`Added ${newNames.length} name${newNames.length > 1 ? 's' : ''}!`, 'success');
    });

    // Clear all
    els.btnClearNames.addEventListener('click', () => {
        setNames([]);
    });

    function setNames(names) {
        // Deduplicate
        const seen = new Set();
        state.names = [];
        for (const name of names) {
            const key = name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                state.names.push(name);
            }
        }

        renderNamesList();
        els.btnToStep3.disabled = state.names.length === 0;
    }

    function renderNamesList() {
        const list = els.namesList;
        list.innerHTML = '';

        if (state.names.length === 0) {
            els.namesListContainer.classList.add('hidden');
            return;
        }

        els.namesListContainer.classList.remove('hidden');
        els.namesCount.textContent = state.names.length;

        state.names.forEach((name, i) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="name-index">${i + 1}</span>
                <span class="name-text">${escapeHtml(name)}</span>
                <button class="btn-icon" title="Remove" data-index="${i}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            list.appendChild(li);
        });

        // Remove individual name
        list.querySelectorAll('.btn-icon').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                state.names.splice(idx, 1);
                renderNamesList();
                els.btnToStep3.disabled = state.names.length === 0;
            });
        });
    }

    // ═══════════════════════════════════════
    //  STEP 3: Generate & Download
    // ═══════════════════════════════════════

    function updateSummary() {
        els.summaryTemplate.textContent = state.templateFileName || '—';
        els.summaryCount.textContent = state.names.length;
        els.summaryFormat.textContent = state.libreOfficeAvailable ? 'PDF' : 'PPTX';

        els.generateSubtitle.textContent = `Ready to generate ${state.names.length} certificate${state.names.length !== 1 ? 's' : ''}`;

        // Reset UI
        els.generateSection.classList.remove('hidden');
        els.downloadSection.classList.add('hidden');
        els.progressContainer.classList.add('hidden');
        els.warningBanner.classList.add('hidden');
        els.btnGenerate.disabled = false;
        els.btnGenerate.classList.remove('loading');
    }

    els.btnGenerate.addEventListener('click', startGeneration);

    async function startGeneration() {
        els.btnGenerate.disabled = true;
        els.btnGenerate.classList.add('loading');
        els.progressContainer.classList.remove('hidden');
        els.generateActions.classList.add('hidden');
        els.progressFill.style.width = '0%';
        els.progressPercent.textContent = '0%';
        els.progressCurrent.textContent = 'Starting...';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateFileId: state.templateFileId,
                    names: state.names
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let completedFiles = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        handleSSE(eventType, data, completedFiles);
                    }
                }
            }
        } catch (err) {
            showToast('Generation failed: ' + err.message, 'error');
            els.generateActions.classList.remove('hidden');
            els.btnGenerate.disabled = false;
            els.btnGenerate.classList.remove('loading');
        }
    }

    function handleSSE(event, data, completedFiles) {
        switch (event) {
            case 'start':
                state.jobId = data.jobId;
                els.progressText.textContent = `Generating ${data.total} certificates...`;
                break;

            case 'progress':
                const pct = Math.round((data.current / data.total) * 100);
                els.progressFill.style.width = pct + '%';
                els.progressPercent.textContent = pct + '%';
                els.progressCurrent.textContent = `${data.current}/${data.total} — ${data.name}`;
                els.progressText.textContent = `Generating ${data.total} certificates...`;
                completedFiles.push(data);
                break;

            case 'warning':
                els.warningBanner.classList.remove('hidden');
                els.warningText.textContent = data.message;
                break;

            case 'error':
                showToast(`Failed: ${data.name} — ${data.error}`, 'error');
                break;

            case 'complete':
                els.progressFill.style.width = '100%';
                els.progressPercent.textContent = '100%';
                els.progressText.textContent = 'Complete!';

                state.outputFormat = data.format;
                showDownloadSection(completedFiles, data);
                break;

            case 'fatal':
                showToast('Fatal error: ' + data.error, 'error');
                els.generateActions.classList.remove('hidden');
                els.btnGenerate.disabled = false;
                els.btnGenerate.classList.remove('loading');
                break;
        }
    }

    function showDownloadSection(files, completionData) {
        setTimeout(() => {
            els.generateSection.classList.add('hidden');
            els.downloadSection.classList.remove('hidden');
            els.downloadCount.textContent = completionData.total;

            // Set up ZIP download
            els.btnDownloadZip.onclick = () => {
                window.location.href = `/api/download-zip/${state.jobId}`;
            };

            // Render file list
            const listEl = els.fileList;
            listEl.innerHTML = '';

            files.forEach(file => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = `
                    <div class="file-item-info">
                        <div class="file-item-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                            </svg>
                        </div>
                        <div>
                            <p class="file-item-name">${escapeHtml(file.name)}</p>
                            <p class="file-item-format">${file.format.toUpperCase()}</p>
                        </div>
                    </div>
                    <a class="btn-download" href="/api/download/${state.jobId}/${encodeURIComponent(file.fileName)}" download>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download
                    </a>
                `;
                listEl.appendChild(div);
            });

            if (completionData.warning) {
                showToast(completionData.warning, 'warning');
            } else {
                showToast(`${completionData.total} certificates generated successfully!`, 'success');
            }
        }, 600);
    }

    // Start Over
    els.btnNewJob.addEventListener('click', () => {
        state.templateFileId = null;
        state.templateFileName = null;
        state.names = [];
        state.jobId = null;

        // Reset step 1
        els.templateResult.classList.add('hidden');
        els.templateError.classList.add('hidden');
        els.templateDropzone.classList.remove('hidden');
        els.btnToStep2.disabled = true;

        // Reset step 2
        els.namesListContainer.classList.add('hidden');
        els.namesList.innerHTML = '';
        els.manualNames.value = '';
        els.btnToStep3.disabled = true;

        goToStep(1);
    });

    // ═══════════════════════════════════════
    //  UTILITIES
    // ═══════════════════════════════════════

    function setupDropzone(zone, input, handler) {
        // Click to browse
        zone.addEventListener('click', () => input.click());

        // File input change
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handler(e.target.files[0]);
                input.value = ''; // Reset so same file can be re-selected
            }
        });

        // Drag and drop
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handler(e.dataTransfer.files[0]);
            }
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.success}<span>${escapeHtml(message)}</span>`;
        els.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    // ═══════════════════════════════════════
    //  LIVE PREVIEW
    // ═══════════════════════════════════════

    els.btnPreview.addEventListener('click', async () => {
        if (!state.templateFileId || state.names.length === 0) {
            showToast('Please upload a template and names first.', 'error');
            return;
        }

        els.previewModal.classList.remove('hidden');
        els.previewModalBody.innerHTML = '<div class="preview-loading">Generating preview...</div>';
        
        try {
            const firstName = state.names[0];
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateFileId: state.templateFileId,
                    name: firstName
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Preview failed');
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            if (blob.type === 'application/pdf') {
                // Mobile browsers (especially Android) cannot render PDFs inside an iframe.
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobile) {
                    els.previewModalBody.innerHTML = `
                        <div style="text-align:center; padding: 40px;">
                            <div class="success-icon" style="margin-bottom: 16px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <p style="margin-bottom: 24px; color: var(--text-secondary);">Mobile browsers do not support inline PDF previews.</p>
                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <a href="${blobUrl}" target="_blank" class="btn-secondary" style="text-decoration:none;">Open in Tab</a>
                                <a href="${blobUrl}" download="preview.pdf" class="btn-primary" style="text-decoration:none;">Download PDF</a>
                            </div>
                        </div>
                    `;
                } else {
                    // Desktop can handle the iframe
                    els.previewModalBody.innerHTML = `<iframe src="${blobUrl}#toolbar=0&navpanes=0&scrollbar=0" class="preview-iframe"></iframe>`;
                }
            } else {
                els.previewModalBody.innerHTML = `
                    <div style="text-align:center; padding: 40px;">
                        <p style="margin-bottom: 16px;">LibreOffice is not installed, so we generated a PPTX.</p>
                        <a href="${blobUrl}" download="preview.pptx" class="btn-primary" style="text-decoration:none;">Download Preview PPTX</a>
                    </div>
                `;
            }

        } catch (error) {
            els.previewModalBody.innerHTML = `<div class="error-banner"><span class="error-icon">!</span><p>${error.message}</p></div>`;
        }
    });

    els.btnClosePreview.addEventListener('click', () => {
        els.previewModal.classList.add('hidden');
        els.previewModalBody.innerHTML = '';
    });

});
