#!/usr/bin/env python3
"""
HTTP server for FHIR to CSV transformation.
This allows the transformation to be called via HTTP requests for local development.
"""

import os
import json
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
    return jsonify({"status": "healthy", "service": "fhir-to-csv-transform"})

@app.route('/transform', methods=['POST'])
def transform_fhir_to_csv():
    """
    Transform FHIR data to CSV format.
    
    Expected JSON payload:
    {
        "CX_ID": "customer_id",
        "PATIENT_ID": "patient_id", 
        "INPUT_S3_BUCKET": "input_bucket",
        "OUTPUT_S3_BUCKET": "output_bucket", 
        "OUTPUT_PREFIX": "output_prefix"
    }
    """
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            # Check if there's any body content at all
            raw_data = request.get_data(as_text=True)
            if not raw_data.strip():
                return jsonify({"error": "No request body provided"}), 400
            else:
                return jsonify({"error": "Invalid JSON data provided"}), 400
        
        logger.info(f"Starting FHIR to CSV transform with request data: {data}")
        
        # Perform the transformation using the main handler
        # The handler will validate all required parameters and throw ValueError if any are missing
        handler(data, {})
        
        logger.info("Transform completed successfully.")
        
        return jsonify({
            "status": "success",
            "message": "Transform completed successfully"
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
    port = int(os.environ.get('PORT', 8000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting FHIR to CSV HTTP server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)
