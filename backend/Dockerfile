FROM node:20-alpine

# Install curl for container health check
RUN apk add --no-cache curl

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY src/ ./src/

# Create data directory mountpoint
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-privileged user for security
USER node

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/index.js"]
