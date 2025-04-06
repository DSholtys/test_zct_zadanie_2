from flask import render_template, url_for
from app import app # Импортируем экземпляр app из пакета app

@app.route('/')
def index():
    """Маршрут для главной страницы."""
    return render_template('index.html', title='Web Piano Home')

@app.route('/piano')
def piano_page():
    """Маршрут для страницы с пианино."""
    return render_template('piano.html', title='ESP32 Web Piano')

@app.route('/training')
def training_page():
    """Маршрут для страницы тренировки."""
    return render_template('training.html', title='Piano Training')

# Можно добавить другие маршруты при необходимости