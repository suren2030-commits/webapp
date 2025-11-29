from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Visitor

@api_view(['GET'])
def health(request):
    return Response({"status": "ok"})

@api_view(['GET'])
def echo(request):
    return Response({"msg": "hello from backend"})

@api_view(['POST'])
def visitors(request):
    name = request.data.get('name') or 'unknown'
    v = Visitor.objects.create(name=name)
    return Response({"id": v.id, "name": v.name})
