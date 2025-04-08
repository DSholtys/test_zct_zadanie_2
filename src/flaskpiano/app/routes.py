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

# УДАЛИТЕ или ЗАКОММЕНТИРУЙТЕ старый маршрут /training
# @app.route('/training')
# def training_page():
#     """Маршрут для страницы тренировки."""
#     return render_template('training.html', title='Piano Training')

# ДОБАВЬТЕ новый маршрут для мини-игр
@app.route('/minigames')
def minigames_page():
    """Маршрут для страницы с мини-играми."""
    # Здесь можно передать список доступных мелодий в шаблон, если нужно
    melodies_list = [
        {"id": "happy_birthday", "name": "Happy Birthday"},
        {"id": "jingle_bells", "name": "Jingle Bells"}, # Пример новой мелодии
        # Добавьте другие мелодии здесь
    ]
    return render_template('minigames.html', title='Piano Mini-Games', melodies=melodies_list)

# Можно добавить другие маршруты при необходимости