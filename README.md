# CertForge — Bulk Certificate Generator

A high-performance, web-based tool for generating hundreds of personalized certificates from a single template. 

## Features

- **Bulk Generation:** Upload a single template and a list of names to generate hundreds of personalized certificates in seconds.
- **Canva/PowerPoint Integration:** Design your template in Canva, export as `.pptx`, and upload it.
- **Multiple Name Formats:** Supports `.docx` (Word), `.xlsx` / `.xls` (Excel), `.txt` (Plain Text), and `.csv` files for name lists.
- **PDF & PPTX Output:** Certificates are outputted as PDFs if LibreOffice is installed, or PPTX files as a fallback.
- **Streaming Archiver:** Outputs a ZIP file using a streaming approach, making it memory-efficient even for massive batches.
- **Premium UI:** Features a dark-mode glassmorphic wizard interface with drag-and-drop upload zones and Server-Sent Events (SSE) for real-time progress updates.

## Prerequisites

- **Node.js** (v14 or higher)
- **LibreOffice** (Optional, but required for converting PPTX to PDF).
  - Download from: [https://www.libreoffice.org/download/](https://www.libreoffice.org/download/)
  - Once installed, CertForge will auto-detect it and enable PDF output.

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/navaneeth-exe/certificate-generator-web.git
   cd certificate-generator-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   # Development mode (auto-reloads on file changes)
   npm run dev
   
   # Or production mode
   npm start
   ```

4. Open your browser and navigate to:
   **http://localhost:3000**

## How to Prepare Your Template

1. Design your certificate in **Canva** (or Microsoft PowerPoint).
2. Export or download the design as a **PowerPoint Document (.pptx)**.
3. Open the downloaded `.pptx` file in PowerPoint or Google Slides.
4. Replace the placeholder name text with `{NAME}` or `{{NAME}}` (with curly braces).
5. Save the file. It is now ready to be uploaded to CertForge!

## How to Prepare Your Names List

You can provide the list of participant names in three ways:
1. **Excel/CSV (.xlsx, .xls, .csv):** Place names in the first column. Headers (like "Name", "S.No") are automatically skipped.
2. **Word Document (.docx):** A list of names, one per line.
3. **Plain Text (.txt):** A simple text file with one name per line.
4. **Manual Entry:** Type or paste names directly into the manual entry box in the web app.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Template Processing:** `docxtemplater`, `pizzip`
- **Name Parsing:** `xlsx` (Excel), `mammoth` (Word)
- **PDF Conversion:** `libreoffice-convert`
- **Archiving:** `archiver`

## License

MIT License
