# Usa una imagen base oficial de Node
FROM node:18-alpine

# Crea el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de configuración y paquetes
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código
COPY . .

# Expone el puerto que usa Express
EXPOSE 3000

# Comando para iniciar la aplicación (usando nodemon para desarrollo)
CMD ["npm", "run", "dev"]