# CertForge — Bulk Certificate Generator

A high-performance, web-based tool for generating hundreds of personalized certificates from a single template. 

## Features

- **Bulk Generation:** Upload a single template and a list of names to generate hundreds of personalized certificates in seconds.
- **Canva/PowerPoint Integration:** Design your template in Canva, export as `.pptx`, and upload it.
- **Smart Spreadsheet Parsing:** Automatically detects name columns in `.csv` or `.xlsx` files using headers (e.g., "Name", "Participant", "Candidate"), completely eliminating formatting errors.
- **Live PDF Previews:** Instantly generate and preview a single PDF certificate directly in a web modal before committing to a massive batch generation.
- **PDF Output:** Certificates are outputted as PDFs if LibreOffice is installed, or PPTX files as a fallback.
- **Streaming Archiver:** Outputs a ZIP file using a streaming approach, making it memory-efficient even for massive batches.
- **Premium SaaS UI:** A sleek, minimal, Invoko-inspired user interface with smooth transitions, soft drop-shadows, and elegant typography (Instrument Serif & DM Sans).

## Prerequisites (Local Development)

- **Node.js** (v14 or higher)
- **LibreOffice** (Optional, but required for converting PPTX to PDF locally).
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

## Deployment (Docker & Render)

This application includes a `Dockerfile` that automatically configures an environment with **LibreOffice** pre-installed. This guarantees the PDF conversion engine works flawlessly in the cloud (so mobile users aren't served raw PowerPoint files).

**To deploy for free on Render.com:**
1. Connect your GitHub repository on Render.
2. Create a new **Web Service**.
3. Render will automatically detect the `Dockerfile`.
4. Select the **Free Tier** and click Deploy. 
*(Note: The first build takes 3-5 minutes to install LibreOffice).*

## How to Prepare Your Template

1. Design your certificate in **Canva** (or Microsoft PowerPoint).
2. Export or download the design as a **PowerPoint Document (.pptx)**.
3. Open the downloaded `.pptx` file in PowerPoint or Google Slides.
4. Replace the placeholder name text with `{NAME}` or `{{NAME}}` (with curly braces).
5. Save the file. It is now ready to be uploaded to CertForge!

## How to Prepare Your Names List

You can provide the list of participant names in three ways:
1. **Excel/CSV (.xlsx, .xls, .csv):** Add names to any column labeled "Name", "First Name", "Participant", etc., or place them in the very first column.
2. **Word Document (.docx):** A list of names, one per line.
3. **Plain Text (.txt):** A simple text file with one name per line.
4. **Manual Entry:** Type or paste names directly into the manual entry box in the web app.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Template Processing:** `docxtemplater`, `pizzip`
- **Name Parsing:** `xlsx` (Excel/CSV), `mammoth` (Word)
- **PDF Conversion:** `libreoffice-convert`
- **Deployment:** Docker
- **Archiving:** `archiver`

## License

MIT License
