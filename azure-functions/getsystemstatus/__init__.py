import logging
import azure.functions as func
import json
import os
from datetime import datetime
import requests

def get_function_list():
    # Get all .py files in the function app directory
    function_dir = os.path.dirname(os.path.dirname(__file__))
    functions = []
    
    for item in os.listdir(function_dir):
        # Skip tests folder, hidden folders, non-directories, and self
        if (os.path.isdir(os.path.join(function_dir, item)) 
            and not item.startswith('__') 
            and not item.startswith('.') 
            and item != 'tests'
            and item.lower() != 'getsystemstatus'):
            functions.append(item.lower())
    
    return functions

def check_function(func_name):
    base_url = "https://seeker-functions.azurewebsites.net/api"
    
    try:
        start_time = datetime.utcnow()
        response = requests.get(
            f"{base_url}/{func_name}",
            headers={'x-ms-client-principal-id': 'healthcheck'},
            timeout=5
        )
        elapsed = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            "name": func_name,
            "status": "running" if response.status_code < 500 else "error",
            "response_time": f"{elapsed:.0f}ms",
            "status_code": response.status_code,
            "elapsed": elapsed
        }
    except requests.exceptions.RequestException as e:
        return {
            "name": func_name,
            "status": "error",
            "response_time": "0ms",
            "status_code": 500,
            "elapsed": 0,
            "error": str(e)
        }

def main(req: func.HttpRequest) -> func.HttpResponse:
    def add_cors_headers(response):
        allowed_origins = ['http://localhost:5173', 'https://seeker.cityoftraitors.com']
        origin = req.headers.get('Origin', '')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    if req.method == "OPTIONS":
        response = func.HttpResponse(status_code=200)
        return add_cors_headers(response)

    try:
        functions = get_function_list()
        function_statuses = [check_function(func_name) for func_name in functions]
        
        # Calculate metrics
        healthy_functions = [f for f in function_statuses if f["status"] == "running"]
        total_response_time = sum(f["elapsed"] for f in function_statuses)
        avg_response_time = total_response_time / len(functions) if functions else 0
        health_percentage = (len(healthy_functions) / len(functions) * 100) if functions else 0

        status = {
            "state": "running" if len(healthy_functions) == len(functions) else "degraded",
            "availability": "normal" if len(healthy_functions) == len(functions) else "limited",
            "last_checked": datetime.utcnow().isoformat(),
            "host_names": ["seeker-functions.azurewebsites.net"],
            "functions": function_statuses,
            "metrics": [
                {
                    "name": "Total Functions",
                    "value": len(functions)
                },
                {
                    "name": "Healthy Functions",
                    "value": len(healthy_functions)
                },
                {
                    "name": "Average Response Time",
                    "value": f"{avg_response_time:.0f}ms"
                },
                {
                    "name": "Health Percentage",
                    "value": f"{health_percentage:.1f}%"
                }
            ]
        }

        response = func.HttpResponse(
            json.dumps(status),
            mimetype="application/json",
            status_code=200
        )
        return add_cors_headers(response)

    except Exception as e:
        logging.error(f"Error getting system status: {str(e)}")
        status = {
            "state": "error",
            "availability": "limited",
            "last_checked": datetime.utcnow().isoformat(),
            "host_names": ["seeker-functions.azurewebsites.net"],
            "error": str(e)
        }
        
        response = func.HttpResponse(
            json.dumps(status),
            mimetype="application/json",
            status_code=200
        )
        return add_cors_headers(response)