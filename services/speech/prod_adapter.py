import os
import json
import time
import random
import httpx
import base64
import uuid
from datetime import datetime
from collections import deque
from typing import Dict, Any, List, Optional
from .base import SpeechSynthesizer

class ProductionSpeechAdapter(SpeechSynthesizer):
    """生产环境语音合成适配器（火山引擎TTS）"""
    
    def __init__(self):
        # --- 统一使用高权限的default项目凭证 ---
        self.app_id = "5485778709"
        self.access_token = "ykNgIGTPREqObOmxE7Jf7vQMba8VuW57"
        self.vc_app_id = self.app_id
        self.vc_access_token = self.access_token

        # --- 端点定义 ---
        self.api_url = 'https://openspeech.bytedance.com/api/v1/tts'
        vc_base_url = 'https://openspeech.bytedance.com/api/v1/mega_tts'
        self.voice_clone_upload_url = f"{vc_base_url}/audio/upload"
        self.voice_clone_status_url = f"{vc_base_url}/status"

        # --- 可配置参数 ---
        self.timeout_ms = int(os.environ.get('TTS_MAX_WAIT_MS', '60000')) # Increased to 60s
        self.poll_interval_ms = int(os.environ.get('TTS_POLL_INTERVAL_MS', '1000'))
        self.backoff_factor = float(os.environ.get('TTS_BACKOFF_FACTOR', '1.5'))
        
        # --- httpx Client ---
        self.http_client = httpx.Client(timeout=(self.timeout_ms / 1000))

        print("-" * 50)
        print("TTS Adapter Configuration:")
        print(f"  - Max Wait: {self.timeout_ms}ms")
        print(f"  - Poll Interval: {self.poll_interval_ms}ms")
        print(f"  - Backoff Factor: {self.backoff_factor}")
        print("-" * 50)

    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> tuple[bytes, dict]:
        job_id = f"tts-job-{uuid.uuid4().hex[:12]}"
        debug_log = {
            "job_id": job_id,
            "submit_time_utc": datetime.utcnow().isoformat() + "Z",
            "steps": [],
            "final_audio_size": 0,
            "error_info": None,
            "total_duration_s": 0
        }

        start_time = time.time()
        try:
            if not self.validate_text(text):
                raise ValueError("Invalid text input")
            
            is_voice_clone = bool(voice_type and voice_type.startswith('S_'))
            
            if is_voice_clone and not self._validate_voice_clone_id(voice_type):
                raise ValueError(f"Invalid voice clone ID format: {voice_type}.")

            payload = {
                "app": {
                    "appid": self.app_id,
                    "token": self.access_token,
                    "cluster": "volcano_icl" if is_voice_clone else "volcano_tts"
                },
                "user": {"uid": "prenatal_education_user"},
                "audio": {
                    "voice_type": voice_type,
                    "encoding": "wav",
                    "speed_ratio": 1.0, "volume_ratio": 1.0, "pitch_ratio": 1.0
                },
                "request": {
                    "reqid": f"prenatal_{int(time.time() * 1000)}",
                    "text": text,
                    "text_type": "plain",
                    "operation": "submit"
                }
            }
            
            if is_voice_clone:
                if voice_type == "S_DrtguyIB1":
                     payload["request"]["resource_id"] = "Model_storage_yy3v7LU7E5J7Werh"
                emotion = kwargs.get('emotion', 'neutral')
                if emotion and emotion != 'neutral':
                    payload["audio"]["emotion"] = emotion

            audio_data = self._make_request_with_retry(payload, debug_log)
            debug_log["final_audio_size"] = len(audio_data)
            return audio_data, debug_log
        except Exception as e:
            debug_log["error_info"] = str(e)
            raise
        finally:
            debug_log["total_duration_s"] = round(time.time() - start_time, 3)

    def _make_request_with_retry(self, payload: Dict[str, Any], debug_log: Dict[str, Any]) -> bytes:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer;{self.access_token}"
        }
        
        # --- 1. Submit Task ---
        submit_step = {"action": "submit", "url": self.api_url}
        debug_log["steps"].append(submit_step)
        
        submit_start_time = time.time()

        try:
            response = self.http_client.post(self.api_url, json=payload, headers=headers)
            submit_step["first_packet_latency_s"] = round(time.time() - submit_start_time, 3)
            response.raise_for_status() # Raise exception for 4xx/5xx
            json_response = response.json()
            submit_step["http_status"] = response.status_code
            submit_step["response_body"] = json_response
        except httpx.HTTPStatusError as e:
            self._classify_and_raise(e, "submit", submit_step)
        except Exception as e:
            submit_step["error"] = {"type": "NETWORK", "message": str(e)}
            raise

        # --- 2. Handle Response & Poll if Necessary ---
        code = json_response.get("code")
        if code == 0:
            audio_base64 = json_response.get("data")
            if audio_base64 and isinstance(audio_base64, str):
                return base64.b64decode(audio_base64)
            raise Exception("API returned success code but no audio data")
        
        elif code in [3000, 3032]:
            reqid = json_response.get("reqid")
            if not reqid:
                raise Exception("API async response missing 'reqid'")
            
            debug_log["task_id"] = reqid
            last_poll_responses = deque(maxlen=3)
            deadline = time.time() + (self.timeout_ms / 1000) - (time.time() - submit_start_time)

            time.sleep(self.poll_interval_ms / 1000) # Initial wait

            while time.time() < deadline:
                poll_step = {"action": "poll", "url": self.api_url, "reqid": reqid}
                debug_log["steps"].append(poll_step)
                poll_start_time = time.time()

                query_payload = {
                    "app": payload["app"],
                    "user": payload["user"],
                    "audio": payload["audio"],
                    "request": {"reqid": reqid, "operation": "query", "text": payload["request"]["text"], "text_type": payload["request"]["text_type"]}
                }
                if payload["request"].get("resource_id"):
                    query_payload["request"]["resource_id"] = payload["request"]["resource_id"]

                try:
                    q_response = self.http_client.post(self.api_url, json=query_payload, headers=headers)
                    poll_step["first_packet_latency_s"] = round(time.time() - poll_start_time, 3)
                    q_response.raise_for_status()
                    q_json = q_response.json()
                    poll_step["http_status"] = q_response.status_code
                    poll_step["response_body"] = q_json
                    last_poll_responses.append(q_json)

                    q_code = q_json.get("code")
                    if q_code == 0:
                        audio_base64 = q_json.get("data")
                        if audio_base64 and isinstance(audio_base64, str):
                            return base64.b64decode(audio_base64)
                        # Still processing, no data yet, continue polling
                    elif q_code in [3000, 3032]:
                        # FIX: Check for data even with code 3000 (success with data)
                        audio_base64 = q_json.get("data")
                        if audio_base64 and isinstance(audio_base64, str):
                            return base64.b64decode(audio_base64)
                        # If no data, it's still processing, so continue polling
                        pass 
                    else:
                        raise Exception(f"Polling failed with API Error ({q_code}): {q_json.get('message', 'Unknown')}")
                except httpx.HTTPStatusError as e:
                    self._classify_and_raise(e, "poll", poll_step, list(last_poll_responses))
                except Exception as e:
                    poll_step["error"] = {"type": "NETWORK", "message": str(e)}
                    raise
                
                time.sleep(self.poll_interval_ms / 1000)

            raise Exception(f"Polling timeout: Audio not ready in time. Last 3 responses: {list(last_poll_responses)}")
        else:
            raise Exception(f"API Error ({code}): {json_response.get('message', 'Unknown')}")

    def _classify_and_raise(self, error: httpx.HTTPStatusError, action: str, step: dict, history: list = None):
        status = error.response.status_code
        error_body = error.response.text
        error_type = "UNKNOWN"
        if 401 <= status <= 403: error_type = "AUTH"
        elif status == 429: error_type = "RATE_LIMIT"
        elif 400 <= status < 500: error_type = "PARAMS"
        elif 500 <= status < 600: error_type = "SERVER"
        
        step["error"] = {"type": error_type, "http_status": status, "message": error_body}
        if history:
            step["error"]["history"] = history
        raise Exception(f"{error_type} error during {action}: {error_body}")

    def voice_clone(self, speaker_id: str, audio_data: bytes, audio_format: str = "wav", 
                   language: str = "zh", model_type: int = 1, **kwargs) -> Dict[str, Any]:
        try:
            payload = {
                "appid": self.app_id,
                "speaker_id": speaker_id,
                "audios": [{"audio_bytes": base64.b64encode(audio_data).decode('utf-8'), "audio_format": audio_format}],
                "source": 2,
                "language": 0 if language.lower() in ["zh", "cn"] else 1,
                "model_type": model_type,
                "extra_params": json.dumps(kwargs.get("extra_params", {}))
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer;{self.access_token}",
                "Resource-Id": "volc.megatts.voiceclone"
            }
            
            response = self.http_client.post(self.voice_clone_upload_url, json=payload, headers=headers)
            response.raise_for_status()
            json_response = response.json()

            base_resp = json_response.get("BaseResp", {})
            if base_resp.get("StatusCode") == 0:
                return {"success": True, "speaker_id": speaker_id, "status": "submitted", "message": base_resp.get("StatusMessage", "")}
            raise Exception(base_resp.get("StatusMessage", "Unknown error"))
        except Exception as e:
            return {"success": False, "error": f"Voice clone upload failed: {str(e)}"}
    
    def get_voice_clone_status(self, speaker_id: str, **kwargs) -> Dict[str, Any]:
        try:
            payload = {"appid": self.app_id, "speaker_id": speaker_id}
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer;{self.access_token}",
                "Resource-Id": "volc.megatts.voiceclone"
            }

            response = self.http_client.post(self.voice_clone_status_url, json=payload, headers=headers)
            response.raise_for_status()
            json_response = response.json()

            base_resp = json_response.get("BaseResp", {})
            if base_resp.get("StatusCode") == 0:
                status_map = {0: "not_found", 1: "training", 2: "success", 3: "failed", 4: "active"}
                status_val = json_response.get("status")
                return {
                    "success": True, "speaker_id": speaker_id,
                    "status": status_map.get(status_val, "unknown"),
                    "progress": 100 if status_val in (2, 4) else 50 if status_val == 1 else 0,
                    "message": base_resp.get("StatusMessage", "")
                }
            raise Exception(base_resp.get("StatusMessage", "Unknown error"))
        except Exception as e:
            return {"success": False, "error": f"Status query failed: {str(e)}"}

    def list_cloned_voices(self, **kwargs) -> List[Dict[str, Any]]:
        return []

    def _validate_voice_clone_id(self, voice_id: str) -> bool:
        return bool(voice_id and voice_id.startswith('S_') and 5 <= len(voice_id) <= 50)
    
    def get_provider_name(self) -> str:
        return "volcengine"

    def validate_text(self, text: str) -> bool:
        return bool(text and text.strip() and len(text) <= 10000)

    def estimate_cost(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> float:
        return 0.0
