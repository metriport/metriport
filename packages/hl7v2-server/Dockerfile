#########################################
### Build Stage                        ##
#########################################
FROM node:18 AS build
WORKDIR /app
# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install
# Copy the rest of your source code
COPY . /app
# Build TypeScript
RUN npm run build

#########################################
### Production Stage                   ##
#########################################
FROM node:18-slim
# Copy only the built app and production dependencies from build stage
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package*.json /app/
WORKDIR /app
# Install only production dependencies
RUN npm ci --production
# Expose the MLLP port for HL7 (commonly 2575)
EXPOSE 2575
# Start the HL7 server using the compiled JS
CMD ["node", "dist/app.js"]
