#!/usr/bin/env python3
"""
HTTP server for raw-to-core (DBT) transformation.
This allows the transformation to be called via HTTP requests for local development.
"""

import os
import logging
import traceback
from flask import Flask, request, jsonify
from main import handler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "core-transform"})

@app.route('/transform', methods=['POST'])
def transform_raw_to_core():
    """
    Transform raw data to core using DBT.
    
    Expected JSON payload:
    {
        "DATABASE": "database_name",
        "SCHEMA": "schema_name",
        "JOB_ID": "job_id",
        "FULL_REFRESH": "full_refresh",
        "LOOKBACK_TIMESTAMP": "lookback_timestamp",
        "LOOKBACK_HOURS": "lookback_hours"
    }
    """
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            raw_data = request.get_data(as_text=True)
            if not raw_data.strip():
                return jsonify({"error": "No request body provided"}), 400
            else:
                return jsonify({"error": "Invalid JSON data provided"}), 400
        
        logger.info(f"Starting core transform with request data: {data}")
        
        # Set environment variables from request for the handler
        if data.get("DATABASE"):
            os.environ["DATABASE"] = data["DATABASE"]
        if data.get("SCHEMA"):
            os.environ["SCHEMA"] = data["SCHEMA"]
        if data.get("JOB_ID"):
            os.environ["JOB_ID"] = data["JOB_ID"]
        if data.get("FULL_REFRESH"):
            os.environ["FULL_REFRESH"] = data["FULL_REFRESH"]
        if data.get("LOOKBACK_TIMESTAMP"):
            os.environ["LOOKBACK_TIMESTAMP"] = data["LOOKBACK_TIMESTAMP"]
        if data.get("LOOKBACK_HOURS"):
            os.environ["LOOKBACK_HOURS"] = data["LOOKBACK_HOURS"]
        # Perform the transformation using the main handler
        handler({}, {})
        
        logger.info("Transform completed successfully.")
        
        return jsonify({
            "status": "success",
            "message": "Core transform completed successfully"
        })
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Transform failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Transform failed: {str(e)}"}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('SERVER_PORT', 8000))
    host = os.environ.get('SERVER_HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting core transform HTTP server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)
