# Используем версию Node.js, указанную в .nvmrc 
FROM node:22.17.0-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код проекта
COPY . .

# Открываем порт 3000 (указан в angular.json)
EXPOSE 3000

# Запускаем команду dev с флагом host, чтобы контейнер был доступен извне
# Используем polling для отслеживания изменений файлов в Windows/Mac
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]