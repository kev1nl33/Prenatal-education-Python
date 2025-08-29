import json
import traceback
import logging
from http.server import BaseHTTPRequestHandler
import sys
from pathlib import Path

# --- Project-level Imports ---
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services import get_speech_service
from services.logger_setup import truncate_and_sample
from .state import LAST_TTS_DEBUG_INFO # Import shared state

# Get a logger for this module
logger = logging.getLogger(__name__)

# --- Helper Functions ---
def _get_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }

def _sanitize_debug_log(log: dict) -> dict:
    """Remove sensitive information from the debug log before storing."""
    if not log: return {}
    # Sanitize tokens from payload
    if "steps" in log and isinstance(log["steps"], list):
        for step in log["steps"]:
            if "payload" in step and isinstance(step["payload"], dict):
                if "app" in step["payload"] and "token" in step["payload"]["app"]:
                    step["payload"]["app"]["token"] = "***REDACTED***"
    return log

# --- Main Handler ---
class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        for key, value in _get_cors_headers().items():
            self.send_header(key, value)
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            data = json.loads(raw_data.decode("utf-8")) if raw_data else {}

            # Extract parameters
            text = data.get("text", "").strip()
            voice_type = data.get("voice_type", "default")
            emotion = data.get("emotion", "neutral")
            quality = data.get("quality", "draft")

            if not text:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Text is required"}).encode('utf-8'))
                return

            # Log the request details
            logger.info(f"TTS request received for voice '{voice_type}' with text length {len(text)}.")
            logger.debug(
                "TTS request parameters", 
                extra={'text': text, 'voice_type': voice_type, 'emotion': emotion, 'quality': quality}
            )

            speech_service = get_speech_service()
            # Synthesize and get debug info
            audio_data, debug_log = speech_service.synthesize(
                text, voice_type=voice_type, emotion=emotion, quality=quality
            )
            
            # Store sanitized debug info and log it
            sanitized_log = _sanitize_debug_log(debug_log)
            LAST_TTS_DEBUG_INFO.append(sanitized_log)
            logger.debug("TTS synthesis successful", extra={
                "audio_info": truncate_and_sample(audio_data, field_name="audio"),
                "debug_log": sanitized_log
            })

            # --- 统一返回JSON格式 ---
            # 将二进制音频数据编码为Base64字符串
            import base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

            # 构建标准的JSON响应体
            response_payload = {
                "ok": True,
                "audio_base64": audio_base64,
                "mime_type": "audio/wav", # 明确告知前端MIME类型
                "debug_info": sanitized_log
            }

            # 发送标准的JSON响应
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            for key, value in _get_cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps(response_payload, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            logger.error("Unhandled exception in /api/tts", exc_info=True)
            
            # Try to extract debug info from custom exception
            error_message = str(e)
            debug_info = None
            if hasattr(e, 'debug_log'):
                debug_info = _sanitize_debug_log(e.debug_log)
                LAST_TTS_DEBUG_INFO.append(debug_info)

            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            for key, value in _get_cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            
            response = {
                "error": "Internal Server Error",
                "message": error_message,
                "debug_info": debug_info
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))