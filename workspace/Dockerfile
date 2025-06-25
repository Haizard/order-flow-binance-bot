# Stage 1: Install dependencies & Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json ./
# Using --production=false to ensure devDependencies like typescript and tailwind are available for the build
RUN npm install --production=false

# Copy source code
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy the standalone output from the builder stage.
# This includes the server, node_modules, and other necessary files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the user to the non-root user
USER nextjs

EXPOSE 8080
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# The standalone output includes a server.js file that starts the app
CMD ["node", "server.js"]
