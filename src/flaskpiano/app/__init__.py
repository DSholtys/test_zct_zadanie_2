from flask import Flask

# Создаем экземпляр приложения Flask
app = Flask(__name__)

# Импортируем маршруты ПОСЛЕ создания app, чтобы избежать циклических импортов
from app import routes