# Stage 1: Build production static files
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build-time environment arguments
ARG VITE_API_URL=/api
ARG VITE_ML_SERVICE_URL=http://localhost:8000
ARG VITE_MAPTILER_API_KEY=""

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ML_SERVICE_URL=$VITE_ML_SERVICE_URL
ENV VITE_MAPTILER_API_KEY=$VITE_MAPTILER_API_KEY

# Compile production bundle
RUN npm run build

# Stage 2: Serve with lightweight Nginx
FROM nginx:1.27-alpine

# Install curl for container health check
RUN apk add --no-cache curl

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built application assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
