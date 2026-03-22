FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Temp directories used by the service
RUN mkdir -p /tmp/tcgdex-image-intake/uploads /tmp/tcgdex-image-intake/extracted

EXPOSE 4102

CMD ["node", "src/server.js"]
