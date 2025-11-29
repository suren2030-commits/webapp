from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health),
    path('echo/', views.echo),
    path('visitors/', views.visitors),
]
