# Frontend Dockerfile - Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Arguments de build
ARG VITE_API_URL=/api

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Variables d'environnement pour le build
ENV VITE_API_URL=$VITE_API_URL

# Build de l'application
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=build /app/dist /usr/share/nginx/html

# Exposer le port
EXPOSE 80

# Commande de démarrage
CMD ["nginx", "-g", "daemon off;"]
