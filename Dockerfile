# Use Debian Bullseye to easily install LibreOffice
FROM node:18-bullseye-slim

# Install LibreOffice and clean up afterwards to keep image small
RUN apt-get update && \
    apt-get install -y --no-install-recommends libreoffice && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port (Render sets the PORT environment variable, our app defaults to 3000)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
